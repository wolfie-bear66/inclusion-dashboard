// Marks a browser that arrived from a password-reset email link. Kept in localStorage
// (not sessionStorage) so closing the tab does not skip the "set a new password" step;
// the Supabase session from the link is itself persisted across tabs.
const KEY = 'passwordRecovery'

export function isPasswordRecovery() {
  try { return localStorage.getItem(KEY) === 'true' } catch { return false }
}

export function setPasswordRecovery() {
  try { localStorage.setItem(KEY, 'true') } catch { /* storage unavailable */ }
}

export function clearPasswordRecovery() {
  try { localStorage.removeItem(KEY) } catch { /* storage unavailable */ }
}
