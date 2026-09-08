import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateTempPassword, sendTempPasswordEmail } from '../_shared/temp-password.ts'

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
  if (callerProfile.is_founder !== true) return { error: forbidden('Your account is not permitted to resend invites') }

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

  let profileId: string
  try {
    const body = await req.json()
    profileId = body.profile_id
    if (!profileId) return fail('profile_id is required', 400)
  } catch {
    return fail('Invalid request body', 400)
  }

  // Guard: only resend to someone who hasn't actually logged in / set a password yet.
  // Prevents accidentally re-inviting (and thus disrupting) an already-active user.
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('password_set, first_name, school_id')
    .eq('id', profileId)
    .single()
  if (profileErr || !profile) return fail('Profile not found', 404)
  if (profile.password_set === true) {
    return fail('This user has already set a password — resending would not be a normal invite email.', 400)
  }

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(profileId)
  if (userErr || !userData?.user?.email) return fail('Could not find the auth account for this profile', 404)

  const email = userData.user.email
  // GoTrue marks a user "confirmed" (email_confirmed_at/confirmed_at) as soon as they
  // authenticate via any link — including one that dead-ended before they set a password
  // (see the SetPasswordPage timeout fixed previously, and Jenny Carson/Blackmoor Park
  // Junior specifically, confirmed live: her account is already confirmed even though
  // profiles.password_set is still false). inviteUserByEmail errors ("already registered")
  // once a user is confirmed, so route those through resetPasswordForEmail instead — same
  // built-in Supabase email delivery already used for the app's own "forgot password" flow
  // (App.jsx handleForgotPassword), so it needs no extra email infrastructure. Left
  // deliberately as an upfront branch on the account's actual confirmation state rather
  // than a catch-and-retry on inviteUserByEmail's error text, since that message isn't a
  // stable contract to match against.
  const isConfirmed = !!(userData.user.email_confirmed_at || userData.user.confirmed_at)

  if (isConfirmed) {
    const { error: resetErr } = await admin.auth.resetPasswordForEmail(email)
    if (resetErr) return fail(resetErr.message, 400)
  } else {
    // Unconfirmed user: reissue a fresh temporary password rather than resending a
    // magic-link invite (see Phase 1 plan — link-based invites get consumed by school
    // email-security gateways before the real recipient clicks them). The account already
    // exists, so update its password in place rather than creating a new one.
    const newTempPassword = generateTempPassword()
    const { error: updateErr } = await admin.auth.admin.updateUserById(profileId, { password: newTempPassword, email_confirm: true })
    if (updateErr) return fail(updateErr.message, 400)

    const { error: touchErr } = await admin
      .from('profiles')
      .update({ temp_password_issued_at: new Date().toISOString() })
      .eq('id', profileId)
    if (touchErr) return fail(`Password was reissued but temp_password_issued_at could not be updated: ${touchErr.message}`, 500)

    let schoolName = ''
    if (profile.school_id) {
      const { data: schoolRow } = await admin
        .from('schools')
        .select('name')
        .eq('id', profile.school_id)
        .single()
      schoolName = schoolRow?.name ?? ''
    }

    try {
      await sendTempPasswordEmail({
        to: email,
        firstName: profile.first_name ?? '',
        schoolName,
        tempPassword: newTempPassword,
      })
    } catch (err: any) {
      return fail(`Password was reissued but the email failed to send: ${String(err?.message ?? err)}`, 500)
    }
  }

  return new Response(JSON.stringify({ success: true, email }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
