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
  let first_name: string, last_name: string, job_title: string
  try {
    const body = await req.json()
    email      = body.email
    role       = body.role ?? 'contributor'
    school_id  = body.school_id
    mat_id     = body.mat_id ?? null
    first_name = body.first_name ?? ''
    last_name  = body.last_name ?? ''
    job_title  = body.job_title ?? ''
    console.log('Body parsed:', email, role, first_name, last_name, job_title)

    if (!email || !school_id) {
      return new Response(JSON.stringify({ error: 'email and school_id are required' }), {
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

  // Step 4: identify the caller from their access token (never trust a client-supplied id)
  let callerId: string
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return forbidden('Missing bearer token')
    }
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData?.user) {
      console.error('Failed at step 4:', userError?.message)
      return forbidden('Invalid or expired session')
    }
    callerId = userData.user.id
    console.log('Caller identified:', callerId)
  } catch (err: any) {
    console.error('Failed at step 4 (exception):', err.message)
    return forbidden('Invalid or expired session')
  }

  // Step 5: look up the caller's own profile — this is what determines their real permissions
  let callerRole: string, callerSchoolId: string, callerMatId: string | null
  try {
    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('role, school_id, mat_id')
      .eq('id', callerId)
      .single()
    if (callerProfileError || !callerProfile) {
      console.error('Failed at step 5:', callerProfileError?.message)
      return forbidden('Caller profile not found')
    }
    callerRole     = callerProfile.role
    callerSchoolId = callerProfile.school_id
    callerMatId    = callerProfile.mat_id
    console.log('Caller profile:', { callerRole, callerSchoolId, callerMatId })
  } catch (err: any) {
    console.error('Failed at step 5 (exception):', err.message)
    return forbidden('Caller profile not found')
  }

  // Step 6: enforce permission rules
  //   - only approver / mat_admin may invite
  //   - approver may only invite into their own school
  //   - mat_admin may only invite into a school belonging to their own MAT
  //   - neither role may grant mat_admin (mat_admin self-service creation is not yet supported)
  if (callerRole !== 'approver' && callerRole !== 'mat_admin') {
    return forbidden('Your role is not permitted to invite users')
  }

  if (role === 'mat_admin') {
    return forbidden('Granting the mat_admin role is not currently supported via invite')
  }

  if (callerRole === 'approver') {
    if (school_id !== callerSchoolId) {
      return forbidden('You can only invite users into your own school')
    }
    if (role !== 'contributor') {
      return forbidden('Approvers can only invite contributors')
    }
  }

  if (callerRole === 'mat_admin') {
    if (!callerMatId) {
      return forbidden('Your account is not associated with a MAT')
    }
    try {
      const { data: targetSchool, error: targetSchoolError } = await admin
        .from('schools')
        .select('mat_id')
        .eq('id', school_id)
        .single()
      if (targetSchoolError || !targetSchool) {
        console.error('Failed at step 6:', targetSchoolError?.message)
        return forbidden('Target school not found')
      }
      if (targetSchool.mat_id !== callerMatId) {
        return forbidden('You can only invite users into schools within your own MAT')
      }
    } catch (err: any) {
      console.error('Failed at step 6 (exception):', err.message)
      return forbidden('Target school not found')
    }
    if (role !== 'contributor' && role !== 'approver') {
      return forbidden('mat_admin can only invite contributors or approvers')
    }
  }

  // Step 7: send invite
  let userId: string
  try {
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email)
    if (inviteError) {
      console.error('Failed at step 7:', inviteError.message)
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    userId = inviteData.user.id
    console.log('Invite sent, userId:', userId)
  } catch (err: any) {
    console.error('Failed at step 7:', err.message)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Step 8: insert profile — soft failure so invite success is still communicated
  try {
    console.log('Attempting profile insert with:', { id: userId, first_name, last_name, school_id })
    const { error: profileError } = await admin.from('profiles').insert({
      id:         userId,
      school_id,
      mat_id,
      role,
      first_name,
      last_name,
      onboarding_state: {
        self_assign_entered:   false,
        has_team_members:      false,
        team_prompt_dismissed: false,
        second_login_or_later: false,
      },
      welcomed: false,
    })
    if (profileError) {
      console.error('Profile insert error:', JSON.stringify(profileError, null, 2))
      // Invite was already sent — return success with a profileError flag so the
      // frontend can show a tailored message rather than a generic error.
      return new Response(JSON.stringify({ success: true, profileError: profileError.message }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    console.log('Profile inserted')
  } catch (err: any) {
    console.error('Failed at step 8 (exception):', err.message)
    return new Response(JSON.stringify({ success: true, profileError: String(err) }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true, userId }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
