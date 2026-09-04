import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function SetPasswordPage() {
  const [sessionReady, setSessionReady] = useState(false)
  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [validationError, setValidationError] = useState(null)
  const [serverError, setServerError]   = useState(null)
  const [saving, setSaving]             = useState(false)
  const [success, setSuccess]           = useState(false)
  const [linkExpired, setLinkExpired]   = useState(false)

  // Wait for Supabase to process the invite-link hash and establish a session.
  // getSession() catches an already-resolved session; onAuthStateChange catches
  // SIGNED_IN firing a moment after the hash is consumed.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
      else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            setSessionReady(true)
            subscription.unsubscribe()
          }
        })
        // No session after 5s means the invite link's token was invalid, already used,
        // or expired (e.g. superseded by a later resend) — surface that instead of
        // silently dropping the visitor onto the public site with no explanation.
        const bail = setTimeout(() => { setLinkExpired(true); subscription.unsubscribe() }, 5000)
        return () => { clearTimeout(bail); subscription.unsubscribe() }
      }
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setValidationError(null)
    setServerError(null)

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setValidationError('Passwords do not match.')
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (error) {
      setServerError(error.message)
      return
    }

    // Mark password as set so App routing no longer redirects here
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase.from('profiles').update({ password_set: true }).eq('id', session.user.id)
    }

    setSuccess(true)
    setTimeout(() => window.location.replace('/home'), 1000)
  }

  return (
    <div className="login-page">
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
        width: '100%', maxWidth: 440,
        boxShadow: '0 4px 32px rgba(0,0,0,0.09)',
        padding: '48px 40px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Wordmark */}
        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 28 }}>
          Inclusion Dashboard
        </p>

        <h1 className="login-title" style={{ marginBottom: 8 }}>
          Welcome to Inclusion Dashboard
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.55, marginBottom: 32 }}>
          Set a password to secure your account.
        </p>

        {success ? (
          <p style={{ fontSize: '0.88rem', color: '#257A3B', fontWeight: 500 }}>Password set successfully — taking you in…</p>
        ) : linkExpired ? (
          <div>
            <p style={{ fontSize: '0.88rem', color: '#B91C1C', fontWeight: 500, marginBottom: 8 }}>
              This invite link has expired or already been used.
            </p>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.55, marginBottom: 20 }}>
              Ask your admin to resend it — only the most recently sent invite link will work.
            </p>
            <a href="/" className="login-btn" style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>
              Return to sign in
            </a>
          </div>
        ) : !sessionReady ? (
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Setting up your account…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="login-field">
              <label htmlFor="sp-password">Password</label>
              <input
                id="sp-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            <div className="login-field">
              <label htmlFor="sp-confirm">Confirm password</label>
              <input
                id="sp-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
              />
            </div>

            {validationError && (
              <p className="login-error">{validationError}</p>
            )}

            <button type="submit" className="login-btn" disabled={saving} style={{ marginTop: 8 }}>
              {saving ? 'Setting password…' : 'Set password'}
            </button>

            {serverError && (
              <p className="login-error" style={{ marginTop: 4 }}>{serverError}</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
