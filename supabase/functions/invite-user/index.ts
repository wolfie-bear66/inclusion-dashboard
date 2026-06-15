import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { email, role, school_id, mat_id } = await req.json()

    if (!email || !role || !school_id) {
      return new Response(JSON.stringify({ error: 'email, role, and school_id are required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: missing service role key' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      'https://zgolrthcrupvrrvfokvz.supabase.co',
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email)
    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id:        inviteData.user.id,
      school_id,
      mat_id:    mat_id ?? null,
      role,
    })

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
