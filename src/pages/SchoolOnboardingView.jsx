import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const FUNCTION_URL = 'https://zgolrthcrupvrrvfokvz.supabase.co/functions/v1/onboard-school'
const PUBLISHABLE_KEY = 'sb_publishable_zjiIMtJYOTWCOpx5s1ABVw_yt6VKiEb'

const PHASES = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'all_through', label: 'All-through' },
  { value: 'special', label: 'Special' },
]

const STANDALONE = '__standalone__'

const emptyForm = {
  school_name: '',
  urn: '',
  phase: '',
  matChoice: STANDALONE,
  first_name: '',
  last_name: '',
  email: '',
  job_title: '',
}

export default function SchoolOnboardingView() {
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [mats, setMats] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // { type: 'success' | 'error', text, detail? }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.replace('/')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_founder')
        .eq('id', session.user.id)
        .single()
      if (!profile?.is_founder) {
        window.location.replace('/')
        return
      }
      setAllowed(true)
      setChecking(false)

      try {
        const res = await fetch(FUNCTION_URL, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': PUBLISHABLE_KEY,
          },
        })
        const json = await res.json()
        if (res.ok) setMats(json.mats ?? [])
      } catch (err) {
        // Non-fatal — the form still works with "Standalone school" only.
      }
    })
  }, [])

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)

    const selectedMat = mats.find(m => m.id === form.matChoice)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          school_name: form.school_name.trim(),
          urn: form.urn.trim(),
          phase: form.phase || null,
          mat_id: selectedMat?.id ?? null,
          mat_name: selectedMat?.name ?? null,
          email: form.email.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          job_title: form.job_title.trim() || 'Approver',
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setResult({ type: 'error', text: json.error ?? 'Something went wrong. Please try again.' })
      } else {
        setResult({ type: 'success', text: `${form.school_name} created and invite sent to ${form.email}.` })
        setForm(emptyForm)
      }
    } catch (err) {
      setResult({ type: 'error', text: 'Could not reach the server. Check your connection and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (checking || !allowed) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif', padding: '32px 24px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <a href="/admin" style={{ fontSize: '0.8125rem', color: '#1B365D', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
          ← Back to admin
        </a>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1B365D' }}>Onboard a New School</h1>
        <p style={{ margin: '4px 0 24px', fontSize: '0.8125rem', color: '#64748b' }}>
          Creates the school, invites its first approver, and links their profile — all in one step.
        </p>

        <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="School name" required>
            <input required value={form.school_name} onChange={e => update('school_name', e.target.value)} style={inputStyle} />
          </Field>

          <Field label="URN (optional)">
            <input value={form.urn} onChange={e => update('urn', e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Phase" required>
            <select required value={form.phase} onChange={e => update('phase', e.target.value)} style={inputStyle}>
              <option value="" disabled>Select phase…</option>
              {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>

          <Field label="MAT">
            <select value={form.matChoice} onChange={e => update('matChoice', e.target.value)} style={inputStyle}>
              <option value={STANDALONE}>Standalone school — no MAT</option>
              {mats.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>

          <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '4px 0' }} />

          <Field label="Approver first name" required>
            <input required value={form.first_name} onChange={e => update('first_name', e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Approver last name" required>
            <input required value={form.last_name} onChange={e => update('last_name', e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Approver email" required>
            <input required type="email" value={form.email} onChange={e => update('email', e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Job title">
            <input placeholder="Approver" value={form.job_title} onChange={e => update('job_title', e.target.value)} style={inputStyle} />
          </Field>

          {result && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: '0.8125rem',
              background: result.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: result.type === 'success' ? '#166534' : '#991b1b',
              border: `1px solid ${result.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {result.text}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{
            marginTop: 4,
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            background: submitting ? '#94a3b8' : '#1B365D',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: submitting ? 'default' : 'pointer',
          }}>
            {submitting ? 'Creating…' : 'Create school & send invite'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8125rem', color: '#334155', fontWeight: 600 }}>
      <span>{label}{required && <span style={{ color: '#EA4335' }}> *</span>}</span>
      {children}
    </label>
  )
}

const inputStyle = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #CBD5E1',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
}
