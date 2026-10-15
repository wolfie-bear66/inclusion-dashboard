// Same-name detection for the "add a person" forms (first-login wizard, Team page,
// Invite modal). Names only: profiles has no email column, and the server (invite-user)
// applies the same rule when the caller opts in with `check_duplicates`.

export function normaliseName(s) {
  return (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

// The wizard has a single "Name" box; split on the first space, as it does when inviting.
export function splitFullName(fullName) {
  const trimmed = (fullName ?? '').trim().replace(/\s+/g, ' ')
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return { first_name: trimmed, last_name: '' }
  return { first_name: trimmed.slice(0, spaceIdx), last_name: trimmed.slice(spaceIdx + 1) }
}

// Key used to remember "No, this is a different person" for exactly this typed name.
// Editing the name changes the key, so the warning comes back if it still matches.
export function nameKey(first, last) {
  return `${normaliseName(first)}|${normaliseName(last)}`
}

// Exact match: same first and last name (case-insensitive). Blank names never match.
export function findSameName(people, first, last) {
  const f = normaliseName(first)
  const l = normaliseName(last)
  if (!f || !l) return null
  return (people ?? []).find(p => normaliseName(p.first_name) === f && normaliseName(p.last_name) === l) ?? null
}

// Quiet hint: same surname and the same first initial, but not an exact match.
export function findMaybeSame(people, first, last) {
  const f = normaliseName(first)
  const l = normaliseName(last)
  if (!f || !l) return null
  return (people ?? []).find(p => {
    const pf = normaliseName(p.first_name)
    const pl = normaliseName(p.last_name)
    return pl === l && pf !== f && pf.charAt(0) === f.charAt(0)
  }) ?? null
}

export function displayPersonName(p) {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || 'Unnamed colleague'
}

// Everyone in one school, for pickers and same-name checks. Same-school only (the school
// is passed in, and profiles RLS only exposes the caller's own school). No emails.
export async function fetchSchoolPeople(supabase, schoolId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, job_title, role, password_set')
    .eq('school_id', schoolId)
  return (data ?? []).slice().sort((a, b) =>
    displayPersonName(a).localeCompare(displayPersonName(b), undefined, { sensitivity: 'base' }))
}
