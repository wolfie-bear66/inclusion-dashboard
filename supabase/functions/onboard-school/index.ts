import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function forbidden(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function fail(message: string, status = 500, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Identifies the caller from their bearer token and confirms is_founder = true.
// Returns null if allowed, or a Response to return immediately if not. Shared by both
// the GET (mats list) and POST (onboard) handlers so the founder gate can't drift.
async function requireFounder(req: Request, admin: any): Promise<Response | null> {
  let callerId: string
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return forbidden('Missing bearer token')
    }
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData?.user) {
      return forbidden('Invalid or expired session')
    }
    callerId = userData.user.id
  } catch (err: any) {
    return forbidden('Invalid or expired session')
  }

  try {
    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('is_founder')
      .eq('id', callerId)
      .single()
    if (callerProfileError || !callerProfile) {
      return forbidden('Caller profile not found')
    }
    if (callerProfile.is_founder !== true) {
      return forbidden('Your account is not permitted to onboard new schools')
    }
  } catch (err: any) {
    return forbidden('Caller profile not found')
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // Step 1: key check
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')
  if (!serviceRoleKey) {
    return fail('Server misconfiguration: missing service role key')
  }

  // Step 2: create admin client
  const admin = createClient(
    'https://zgolrthcrupvrrvfokvz.supabase.co',
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // GET: return the mats list for the onboarding form's dropdown. Goes through the
  // service role (not client-side RLS) since mats' actual SELECT policy shape isn't
  // verified to include a founder bypass the way schools_select_scoped does.
  if (req.method === 'GET') {
    const deny = await requireFounder(req, admin)
    if (deny) return deny

    const { data: mats, error: matsError } = await admin
      .from('mats')
      .select('id, name')
      .order('name')
    if (matsError) {
      return fail(matsError.message)
    }
    return new Response(JSON.stringify({ mats: mats ?? [] }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Step 3: parse request body
  let school_name: string, urn: string | null, mat_name: string | null, mat_id: string | null, phase: string | null
  let new_mat_name: string | null
  let email: string, first_name: string, last_name: string, job_title: string
  try {
    const body = await req.json()
    school_name  = body.school_name
    urn          = body.urn || null
    mat_name     = body.mat_name || null
    mat_id       = body.mat_id || null
    new_mat_name = body.new_mat_name || null
    phase        = body.phase || null
    email        = body.email
    first_name   = body.first_name ?? ''
    last_name    = body.last_name ?? ''
    job_title    = body.job_title || 'Approver'

    if (!school_name || !email) {
      return fail('school_name and email are required', 400)
    }
  } catch (err: any) {
    return fail(String(err))
  }

  // Steps 4-6: identify the caller from their access token and enforce founder-only access
  const deny = await requireFounder(req, admin)
  if (deny) return deny

  // Step 6b: if a brand-new MAT was requested, create it first — nothing else has happened
  // yet, so a failure here is a clean failure with nothing to clean up.
  if (new_mat_name) {
    try {
      const { data: matData, error: matError } = await admin
        .from('mats')
        .insert({ name: new_mat_name })
        .select('id')
        .single()
      if (matError || !matData) {
        return fail(matError?.message ?? 'Failed to create MAT')
      }
      mat_id = matData.id
      mat_name = new_mat_name
    } catch (err: any) {
      return fail(String(err))
    }
  }

  // Step 7: insert the school
  let schoolId: string
  try {
    const { data: schoolData, error: schoolError } = await admin
      .from('schools')
      .insert({ name: school_name, urn, mat_name, mat_id, phase })
      .select('id')
      .single()
    if (schoolError || !schoolData) {
      return fail(schoolError?.message ?? 'Failed to create school')
    }
    schoolId = schoolData.id
  } catch (err: any) {
    return fail(String(err))
  }

  // Step 8: send the invite. If this fails, the school row is already there and orphaned —
  // hand back its id/name so the caller can decide whether to delete it or retry.
  let userId: string
  try {
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email)
    if (inviteError) {
      return fail(
        `School "${school_name}" was created (id: ${schoolId}) but the invite to ${email} failed: ${inviteError.message}. Delete the orphaned school row or retry the invite.`,
        400,
        { school_id: schoolId, school_name },
      )
    }
    userId = inviteData.user.id
  } catch (err: any) {
    return fail(
      `School "${school_name}" was created (id: ${schoolId}) but the invite to ${email} failed: ${String(err)}. Delete the orphaned school row or retry the invite.`,
      500,
      { school_id: schoolId, school_name },
    )
  }

  // Step 9: insert the profile. Unlike invite-user, this must NOT soft-succeed — the auth
  // invite has already gone out, so a failure here needs to be surfaced clearly with enough
  // detail (userId, schoolId) for the caller to finish the job manually.
  try {
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      school_id: schoolId,
      mat_id,
      role: 'approver',
      first_name,
      last_name,
      job_title,
      onboarding_state: {
        self_assign_entered:   false,
        has_team_members:      false,
        team_prompt_dismissed: false,
        second_login_or_later: false,
      },
      welcomed: false,
    })
    if (profileError) {
      return fail(
        `The invite to ${email} already went out (userId: ${userId}), but the profile could not be created: ${profileError.message}. School "${school_name}" (id: ${schoolId}) exists — you'll need to manually insert the profile row (id: ${userId}, school_id: ${schoolId}) or investigate.`,
        500,
        { school_id: schoolId, school_name, user_id: userId, email },
      )
    }
  } catch (err: any) {
    return fail(
      `The invite to ${email} already went out (userId: ${userId}), but the profile could not be created: ${String(err)}. School "${school_name}" (id: ${schoolId}) exists — you'll need to manually insert the profile row (id: ${userId}, school_id: ${schoolId}) or investigate.`,
      500,
      { school_id: schoolId, school_name, user_id: userId, email },
    )
  }

  return new Response(JSON.stringify({ success: true, school_id: schoolId, userId }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
