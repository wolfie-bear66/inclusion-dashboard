import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://zgolrthcrupvrrvfokvz.supabase.co'
// Same publishable key App.jsx uses when calling invite-user directly — required by the
// Supabase function gateway for routing, not used for permission checks.
const PUBLISHABLE_KEY = 'sb_publishable_zjiIMtJYOTWCOpx5s1ABVw_yt6VKiEb'

function forbidden(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function fail(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const authHeader = req.headers.get('Authorization') ?? ''

  // Step 1: service role key + admin client
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')
  if (!serviceRoleKey) {
    return fail('Server misconfiguration: missing service role key')
  }
  const admin = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Step 2: parse request body
  let departing_user_id: string
  let point_decisions: Array<{ provision_point_id: string; action: 'reassign' | 'unassign'; replacement_user_id?: string }>
  let new_person: { first_name: string; last_name: string; job_title: string; email: string } | null
  try {
    const body = await req.json()
    departing_user_id = body.departing_user_id
    point_decisions = Array.isArray(body.point_decisions) ? body.point_decisions : []
    new_person = body.new_person ?? null

    if (!departing_user_id) {
      return fail('departing_user_id is required', 400)
    }
  } catch (err: any) {
    return fail(String(err))
  }

  // Step 3: identify the caller from their access token (never trust a client-supplied id)
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return forbidden('Missing bearer token')
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) return forbidden('Invalid or expired session')
  const callerId = userData.user.id

  // Step 4: look up the caller's own profile — this is what determines their real permissions
  const { data: callerProfile, error: callerProfileError } = await admin
    .from('profiles')
    .select('role, school_id')
    .eq('id', callerId)
    .single()
  if (callerProfileError || !callerProfile) return forbidden('Caller profile not found')
  const callerRole = callerProfile.role
  const callerSchoolId = callerProfile.school_id

  if (callerRole !== 'approver' && callerRole !== 'mat_admin') {
    return forbidden('Your role is not permitted to remove team members')
  }
  if (departing_user_id === callerId) {
    return forbidden('You cannot remove your own account')
  }

  // Step 5: look up the departing profile and confirm same-school scope
  const { data: departingProfile, error: departingProfileError } = await admin
    .from('profiles')
    .select('first_name, last_name, job_title, school_id')
    .eq('id', departing_user_id)
    .single()
  if (departingProfileError || !departingProfile) return fail('Departing profile not found', 404)
  if (departingProfile.school_id !== callerSchoolId) {
    return forbidden('You can only remove team members from your own school')
  }

  // Step 6: if a brand-new replacement was supplied, create them via the existing
  // invite-user Edge Function — reused as-is, not duplicated. Forwards the caller's own
  // bearer token so invite-user's own permission checks run against the real caller.
  let newPersonUserId: string | null = null
  if (new_person) {
    try {
      const inviteRes = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'apikey': PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          first_name: new_person.first_name,
          last_name: new_person.last_name,
          job_title: new_person.job_title,
          email: new_person.email,
          role: 'contributor',
          school_id: callerSchoolId,
          mat_id: null,
        }),
      })
      const inviteJson = await inviteRes.json()
      if (!inviteRes.ok || inviteJson.error) {
        return fail(`Could not create new person: ${inviteJson.error ?? 'unknown error'}`, 400)
      }
      newPersonUserId = inviteJson.userId
      if (newPersonUserId && new_person.job_title) {
        const { error: jobTitleError } = await admin
          .from('profiles')
          .update({ job_title: new_person.job_title })
          .eq('id', newPersonUserId)
        if (jobTitleError) console.warn('[remove-team-member] job_title update failed:', jobTitleError.message)
      }
    } catch (err: any) {
      return fail(`Could not create new person: ${String(err)}`)
    }
  }

  function resolveReplacementId(id: string | undefined): string | null {
    if (id === 'new') return newPersonUserId
    return id ?? null
  }

  // Step 7: apply point decisions. Reassign/unassign are ordered before the
  // assigned_by rewrite, log insert, and profile/auth deletion below — if anything
  // here fails, we stop and report the error before anything irreversible happens.
  let reassignedCount = 0
  let unassignedCount = 0
  let logReplacementUserId: string | null = null
  let logReplacementName: string | null = null

  for (const decision of point_decisions) {
    if (decision.action === 'unassign') {
      const { error: delErr } = await admin
        .from('point_assignments')
        .delete()
        .eq('school_id', callerSchoolId)
        .eq('assignee_user_id', departing_user_id)
        .eq('provision_point_id', decision.provision_point_id)
      if (delErr) return fail(`Failed to unassign a point: ${delErr.message}`)
      unassignedCount++
    } else if (decision.action === 'reassign') {
      const replacementId = resolveReplacementId(decision.replacement_user_id)
      if (!replacementId) return fail('Reassign decision is missing a resolvable replacement_user_id', 400)

      const { error: delErr } = await admin
        .from('point_assignments')
        .delete()
        .eq('school_id', callerSchoolId)
        .eq('assignee_user_id', departing_user_id)
        .eq('provision_point_id', decision.provision_point_id)
      if (delErr) return fail(`Failed to reassign a point: ${delErr.message}`)

      const { error: insErr } = await admin.from('point_assignments').insert({
        provision_point_id: decision.provision_point_id,
        assignee_user_id: replacementId,
        school_id: callerSchoolId,
        assigned_by: callerId,
      })
      if (insErr) return fail(`Failed to reassign a point: ${insErr.message}`)

      reassignedCount++
      logReplacementUserId = new_person ? null : replacementId
      logReplacementName = new_person ? `${new_person.first_name} ${new_person.last_name}`.trim() : null
    }
  }

  // Step 8: Option B fix — rewrite any historical assignments this person made (for
  // themselves or anyone else) to the performing approver, since
  // point_assignments.assigned_by has no ON DELETE action and would otherwise block
  // the profile delete below.
  const { error: assignedByErr } = await admin
    .from('point_assignments')
    .update({ assigned_by: callerId })
    .eq('assigned_by', departing_user_id)
  if (assignedByErr) return fail(`Failed to update historical assignment records: ${assignedByErr.message}`)

  // Step 9: audit log — inserted before the destructive deletes below, so the record
  // of what happened survives even though the departing profile won't.
  const { error: logErr } = await admin.from('team_member_reassignment_log').insert({
    school_id: callerSchoolId,
    removed_first_name: departingProfile.first_name ?? '',
    removed_last_name: departingProfile.last_name ?? '',
    removed_job_title: departingProfile.job_title ?? null,
    replacement_user_id: logReplacementUserId,
    replacement_name: logReplacementName,
    performed_by: callerId,
    points_reassigned_count: reassignedCount,
    points_unassigned_count: unassignedCount,
  })
  if (logErr) return fail(`Failed to write audit log: ${logErr.message}`)

  // Step 10: delete the profile row.
  const { error: profileDelErr } = await admin.from('profiles').delete().eq('id', departing_user_id)
  if (profileDelErr) return fail(`Failed to delete profile: ${profileDelErr.message}`)

  // Step 11: revoke their auth login entirely.
  const { error: authDelErr } = await admin.auth.admin.deleteUser(departing_user_id)
  if (authDelErr) {
    // Profile row is already gone at this point — report clearly rather than pretending
    // this fully succeeded, but don't attempt to roll back the profile delete.
    return fail(`Profile removed but auth login could not be revoked: ${authDelErr.message}`)
  }

  return new Response(JSON.stringify({
    success: true,
    points_reassigned_count: reassignedCount,
    points_unassigned_count: unassignedCount,
    new_person_user_id: newPersonUserId,
  }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
