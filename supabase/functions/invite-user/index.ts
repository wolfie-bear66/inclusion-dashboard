import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('SERVICE_ROLE_KEY present:', !!Deno.env.get('SERVICE_ROLE_KEY'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // Step 1: key check
  let serviceRoleKey: string
  try {
    const key = Deno.env.get('SERVICE_ROLE_KEY')
    if (!key) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: missing service role key' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    serviceRoleKey = key
    console.log('Past key check')
  } catch (err: any) {
    console.error('Failed at step 1:', err.message)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Step 2: create admin client
  let admin: any
  try {
    admin = createClient(
      'https://zgolrthcrupvrrvfokvz.supabase.co',
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    console.log('Client created')
  } catch (err: any) {
    console.error('Failed at step 2:', err.message)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Step 3: parse request body
  let email: string, role: string, school_id: string, mat_id: string | null
  try {
    const body = await req.json()
    email = body.email
    role = body.role
    school_id = body.school_id
    mat_id = body.mat_id ?? null
    console.log('Body parsed:', email, role)

    if (!email || !role || !school_id) {
      return new Response(JSON.stringify({ error: 'email, role, and school_id are required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  } catch (err: any) {
    console.error('Failed at step 3:', err.message)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Step 4: send invite
  let userId: string
  try {
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email)
    if (inviteError) {
      console.error('Failed at step 4:', inviteError.message)
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    userId = inviteData.user.id
    console.log('Invite sent')
  } catch (err: any) {
    console.error('Failed at step 4:', err.message)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Step 5: insert profile
  try {
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      school_id,
      mat_id,
      role,
    })
    if (profileError) {
      console.error('Failed at step 5:', profileError.message)
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    console.log('Profile inserted')
  } catch (err: any) {
    console.error('Failed at step 5:', err.message)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
