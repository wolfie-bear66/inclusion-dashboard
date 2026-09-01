import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_STATUSES = ['trial', 'paid', 'churned']
const VALID_PHASES = ['primary', 'secondary', 'all_through', 'special']

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
  if (callerProfile.is_founder !== true) return { error: forbidden('Your account is not permitted to edit schools') }

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

  let body: any
  try {
    body = await req.json()
  } catch {
    return fail('Invalid request body', 400)
  }

  const { school_id, name, phase, subscription_status, price_tier, annual_price, mat_id, new_mat_name } = body
  if (!school_id) return fail('school_id is required', 400)

  if (phase && !VALID_PHASES.includes(phase)) return fail(`phase must be one of: ${VALID_PHASES.join(', ')}`, 400)
  if (subscription_status && !VALID_STATUSES.includes(subscription_status)) {
    return fail(`subscription_status must be one of: ${VALID_STATUSES.join(', ')}`, 400)
  }

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (phase !== undefined) updates.phase = phase
  if (subscription_status !== undefined) {
    updates.subscription_status = subscription_status
    // Moving to 'paid' for the first time stamps confirmed_at, unless one already exists —
    // this is what the founder-pricing lock-in date should be based on, not a re-edit.
    if (subscription_status === 'paid') {
      const { data: existing } = await admin.from('schools').select('confirmed_at').eq('id', school_id).single()
      if (!existing?.confirmed_at) updates.confirmed_at = new Date().toISOString()
    }
  }
  if (price_tier !== undefined) updates.price_tier = price_tier
  if (annual_price !== undefined) updates.annual_price = annual_price

  // MAT assignment — either attach to an existing MAT (mat_id), create a brand-new one
  // (new_mat_name, same as the onboarding flow), or detach entirely (mat_id explicitly null).
  if (new_mat_name) {
    const { data: matData, error: matError } = await admin
      .from('mats').insert({ name: new_mat_name }).select('id, name').single()
    if (matError || !matData) return fail(matError?.message ?? 'Failed to create MAT', 400)
    updates.mat_id = matData.id
    updates.mat_name = matData.name
  } else if (mat_id !== undefined) {
    if (mat_id === null) {
      updates.mat_id = null
      updates.mat_name = null
    } else {
      const { data: matData, error: matError } = await admin.from('mats').select('id, name').eq('id', mat_id).single()
      if (matError || !matData) return fail('MAT not found', 404)
      updates.mat_id = matData.id
      updates.mat_name = matData.name
    }
  }

  if (Object.keys(updates).length === 0) return fail('No fields to update', 400)

  const { error: updateErr } = await admin.from('schools').update(updates).eq('id', school_id)
  if (updateErr) return fail(updateErr.message, 400)

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
