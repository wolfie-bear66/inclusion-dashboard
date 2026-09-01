import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_ROLES = ['contributor', 'approver', 'mat_admin']

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

async function requireFounder(req: Request, admin: any): Promise<{ error: Response } | { callerId: string }> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return { error: forbidden('Missing bearer token') }

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) return { error: forbidden('Invalid or expired session') }

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('is_founder')
    .eq('id', userData.user.id)
    .single()
  if (profileError || !callerProfile) return { error: forbidden('Caller profile not found') }
  if (callerProfile.is_founder !== true) return { error: forbidden('Your account is not permitted to change user roles') }

  return { callerId: userData.user.id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')
  if (!serviceRoleKey) return fail('Server misconfiguration: missing service role key')

  const admin = createClient(
    'https://zgolrthcrupvrrvfokvz.supabase.co',
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const auth = await requireFounder(req, admin)
  if ('error' in auth) return auth.error

  let profileId: string, role: string
  try {
    const body = await req.json()
    profileId = body.profile_id
    role = body.role
    if (!profileId || !role) return fail('profile_id and role are required', 400)
    if (!VALID_ROLES.includes(role)) return fail(`role must be one of: ${VALID_ROLES.join(', ')}`, 400)
  } catch {
    return fail('Invalid request body', 400)
  }

  // Never let this function be used to demote/edit the founder's own record by accident —
  // is_founder is untouched either way, but role changes on a founder account don't make sense.
  const { data: target, error: targetErr } = await admin
    .from('profiles')
    .select('is_founder')
    .eq('id', profileId)
    .single()
  if (targetErr || !target) return fail('Profile not found', 404)
  if (target.is_founder === true) return fail('Cannot change the role of a founder account this way', 400)

  const { error: updateErr } = await admin.from('profiles').update({ role }).eq('id', profileId)
  if (updateErr) return fail(updateErr.message, 400)

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
