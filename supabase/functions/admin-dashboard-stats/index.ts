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
  if (callerProfile.is_founder !== true) return { error: forbidden('Your account is not permitted to view this data') }

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

  try {
    // Schools — includes the new commercial fields plus is_demo, so the frontend
    // can filter demo/test rows out of both the tiles and the table in one place.
    const { data: schools, error: schoolsErr } = await admin
      .from('schools')
      .select('id, name, mat_id, is_demo, subscription_status, price_tier, annual_price, confirmed_at')
      .order('name')
    if (schoolsErr) throw schoolsErr

    const realSchools = (schools ?? []).filter((s: any) => !s.is_demo)
    const schoolIds = realSchools.map((s: any) => s.id)

    // Profiles (per school, plus we need ids to join against auth.users for login data)
    const { data: profiles, error: profilesErr } = await admin
      .from('profiles')
      .select('id, school_id, first_name, last_name, role, job_title, mat_id, password_set')
      .in('school_id', schoolIds.length ? schoolIds : ['00000000-0000-0000-0000-000000000000'])
    if (profilesErr) throw profilesErr

    const profileIds = (profiles ?? []).map((p: any) => p.id)

    // auth.users isn't exposed via the normal client — admin.auth.admin.listUsers()
    // is the only way to get last_sign_in_at, and it's paginated, so page through it
    // rather than assuming everyone fits on one page.
    const lastSignInByUserId: Record<string, string | null> = {}
    const emailByUserId: Record<string, string> = {}
    let page = 1
    while (true) {
      const { data: pageData, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (listErr) throw listErr
      for (const u of pageData.users) {
        lastSignInByUserId[u.id] = u.last_sign_in_at
        if (u.email) emailByUserId[u.id] = u.email
      }
      if (pageData.users.length < 1000) break
      page += 1
    }

    const profileSchoolById: Record<string, string> = {}
    for (const p of profiles ?? []) profileSchoolById[p.id] = p.school_id

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Evidence entries — for "active in last 30 days" / most recent activity per school
    const { data: entries, error: entriesErr } = await admin
      .from('entries')
      .select('id, school_id')
      .in('school_id', schoolIds.length ? schoolIds : ['00000000-0000-0000-0000-000000000000'])
    if (entriesErr) throw entriesErr
    const entryIdToSchool: Record<string, string> = {}
    for (const e of entries ?? []) entryIdToSchool[e.id] = e.school_id

    const entryIds = (entries ?? []).map((e: any) => e.id)
    const { data: evidence, error: evidenceErr } = await admin
      .from('evidence_entries')
      .select('id, entry_id, created_at')
      .in('entry_id', entryIds.length ? entryIds : ['00000000-0000-0000-0000-000000000000'])
    if (evidenceErr) throw evidenceErr

    const lastEvidenceBySchool: Record<string, string> = {}
    for (const ev of evidence ?? []) {
      const sid = entryIdToSchool[ev.entry_id]
      if (!sid) continue
      if (!lastEvidenceBySchool[sid] || ev.created_at > lastEvidenceBySchool[sid]) {
        lastEvidenceBySchool[sid] = ev.created_at
      }
    }

    // Per-school login rollup
    const loggedInBySchool: Record<string, boolean> = {}
    const lastLoginBySchool: Record<string, string | null> = {}
    for (const p of profiles ?? []) {
      const signIn = lastSignInByUserId[p.id]
      if (signIn) {
        loggedInBySchool[p.school_id] = true
        if (!lastLoginBySchool[p.school_id] || signIn > (lastLoginBySchool[p.school_id] ?? '')) {
          lastLoginBySchool[p.school_id] = signIn
        }
      }
    }

    // Build per-school rows + engagement bucket
    let activeLast30 = 0, stalled = 0, neverLoggedIn = 0
    const rows = realSchools.map((s: any) => {
      const hasLoggedIn = !!loggedInBySchool[s.id]
      const lastLogin = lastLoginBySchool[s.id] ?? null
      const lastEvidence = lastEvidenceBySchool[s.id] ?? null
      const isActive = lastEvidence && lastEvidence >= thirtyDaysAgo

      let engagementStatus: 'active' | 'stalled' | 'never_logged_in'
      if (!hasLoggedIn) { engagementStatus = 'never_logged_in'; neverLoggedIn += 1 }
      else if (isActive) { engagementStatus = 'active'; activeLast30 += 1 }
      else { engagementStatus = 'stalled'; stalled += 1 }

      const schoolProfiles = (profiles ?? []).filter((p: any) => p.school_id === s.id)
      // Eligible for a resend iff they haven't finished onboarding — matches resend-invite's
      // own guard (`profile.password_set === true` blocks a resend) exactly. Previously this
      // filtered on `!lastSignInByUserId[p.id]` (never signed in at all), which drops anyone
      // who authenticated once via an invite link but never got to set a password — e.g. a
      // dead-ended link — silently hiding their only recovery path in the admin UI.
      const pendingInvites = schoolProfiles
        .filter((p: any) => p.password_set !== true)
        .map((p: any) => ({ profile_id: p.id, email: emailByUserId[p.id] ?? null }))

      const staff = schoolProfiles.map((p: any) => ({
        profile_id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        role: p.role,
        job_title: p.job_title,
        email: emailByUserId[p.id] ?? null,
        last_login: lastSignInByUserId[p.id] ?? null,
      }))

      return {
        id: s.id,
        name: s.name,
        mat_id: s.mat_id,
        subscription_status: s.subscription_status,
        price_tier: s.price_tier,
        annual_price: s.annual_price,
        confirmed_at: s.confirmed_at,
        staff_count: schoolProfiles.length,
        last_login: lastLogin,
        last_evidence: lastEvidence,
        engagement_status: engagementStatus,
        pending_invites: pendingInvites,
        staff,
      }
    })

    // Pipeline tile
    const pipeline = { trial: 0, paid: 0, churned: 0 }
    for (const s of realSchools) {
      const status = (s.subscription_status ?? 'trial') as 'trial' | 'paid' | 'churned'
      pipeline[status] = (pipeline[status] ?? 0) + 1
    }

    // Revenue tile — only counts schools with a locked-in annual_price
    const annualRevenue = realSchools.reduce((sum: number, s: any) => sum + (Number(s.annual_price) || 0), 0)

    const { data: mats, error: matsErr } = await admin.from('mats').select('id, name').order('name')
    if (matsErr) throw matsErr

    return new Response(JSON.stringify({
      pipeline,
      engagement: { active_last_30: activeLast30, stalled, never_logged_in: neverLoggedIn },
      revenue: { annual_total: annualRevenue, paid_school_count: pipeline.paid },
      rows,
      mats: mats ?? [],
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return fail(String(err?.message ?? err))
  }
})
