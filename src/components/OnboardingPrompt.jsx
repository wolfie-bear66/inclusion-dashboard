import { useState } from 'react'
import AssignmentModal from './AssignmentModal'

export default function OnboardingPrompt({
  onboardingState,
  userId,
  firstName,
  schoolId,
  supabase,
  onClose,
  onGoToTeam,
}) {
  const os = onboardingState ?? {}
  const selfAssignEntered  = os.self_assign_entered  === true
  const hasTeamMembers     = os.has_team_members     === true
  const dismissed          = os.team_prompt_dismissed === true
  const secondLogin        = os.second_login_or_later === true

  // Local state for in-prompt transitions
  const [localOs, setLocalOs]       = useState(os)
  const [showSelfAssign, setShowSelfAssign] = useState(false)
  const [toast, setToast]           = useState(null)
  const [saving, setSaving]         = useState(false)

  if (dismissed) return null

  const selfEntered  = localOs.self_assign_entered  === true
  const hasTeam      = localOs.has_team_members     === true
  const secondL      = localOs.second_login_or_later === true

  // Determine current prompt state
  let promptState
  if (hasTeam) promptState = 'C'
  else if (selfEntered) promptState = 'B'
  else promptState = 'A'

  async function patchOnboardingState(patch) {
    const merged = { ...localOs, ...patch }
    setLocalOs(merged)
    await supabase
      .from('profiles')
      .update({ onboarding_state: merged })
      .eq('id', userId)
    return merged
  }

  async function handleDismiss(patch = {}) {
    setSaving(true)
    const merged = await patchOnboardingState({
      ...patch,
      team_prompt_dismissed: true,
      second_login_or_later: true,
    })
    setSaving(false)
    onClose({ dismissed: true, flash: !merged.has_team_members })
  }

  async function handleSkip() {
    await handleDismiss()
  }

  async function handleDontShowAgain() {
    await handleDismiss()
  }

  async function handleGoToTeam() {
    // Mark that we left for team setup; re-reading happens on return
    await patchOnboardingState({ second_login_or_later: true })
    onGoToTeam()
  }

  async function handleDoneNotify() {
    setSaving(true)
    await patchOnboardingState({ team_prompt_dismissed: true, second_login_or_later: true })
    setSaving(false)
    setToast('Your team has been notified.')
    setTimeout(() => {
      onClose({ dismissed: true, flash: false })
    }, 1800)
  }

  function handleSelfAssignSaved() {
    // Update local state — self_assign_entered = true
    patchOnboardingState({ self_assign_entered: true, second_login_or_later: true })
    setShowSelfAssign(false)
  }

  const selfPerson = {
    id: userId,
    first_name: firstName ?? 'Me',
    last_name: '',
    role: 'approver',
  }

  // ── Prompt copy & buttons ─────────────────────────────────────────

  const content = {
    A: {
      heading: "Welcome. Let’s set up your inclusion team.",
      sub: 'You can assign provision points to yourself and your colleagues, or come back to this later.',
      buttons: (
        <>
          <button type="button" onClick={() => setShowSelfAssign(true)} style={btnPrimary}>
            Assign points to myself
          </button>
          <button type="button" onClick={handleGoToTeam} style={btnOutlined}>
            Add team members
          </button>
          <button type="button" onClick={handleSkip} disabled={saving} style={btnText}>
            Skip for now
          </button>
          {secondL && (
            <button type="button" onClick={handleDontShowAgain} disabled={saving} style={{ ...btnText, marginTop: 4, opacity: 0.7 }}>
              Don't show this again
            </button>
          )}
        </>
      ),
    },
    B: {
      heading: 'Your points are saved.',
      sub: 'Would you like to add team members now?',
      buttons: (
        <>
          <button type="button" onClick={handleGoToTeam} style={btnPrimary}>
            Add team members
          </button>
          <button type="button" onClick={handleSkip} disabled={saving} style={btnText}>
            Skip for now
          </button>
          {secondL && (
            <button type="button" onClick={handleDontShowAgain} disabled={saving} style={{ ...btnText, marginTop: 4, opacity: 0.7 }}>
              Don't show this again
            </button>
          )}
        </>
      ),
    },
    C: {
      heading: 'Good progress.',
      sub: "Add another team member, or notify your team when you're ready.",
      buttons: (
        <>
          <button type="button" onClick={handleGoToTeam} style={btnPrimary}>
            Add another team member
          </button>
          <button type="button" onClick={handleDoneNotify} disabled={saving} style={btnOutlined}>
            {saving ? 'Saving…' : 'Done — notify my team'}
          </button>
          <button type="button" onClick={handleSkip} disabled={saving} style={btnText}>
            Come back to it later
          </button>
        </>
      ),
    },
  }

  const { heading, sub, buttons } = content[promptState]

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1050,
        background: 'rgba(0,0,0,0.50)',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1051,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: 480,
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          pointerEvents: 'all',
        }}>
          {/* Navy header */}
          <div style={{ background: '#1B365D', padding: '28px 32px 24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', lineHeight: 1.35, marginBottom: 8 }}>
              {heading}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.55 }}>
              {sub}
            </p>
          </div>

          {/* White body */}
          <div style={{ background: '#fff', padding: '24px 32px 28px' }}>
            {toast ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(37,122,59,0.08)', border: '1px solid rgba(37,122,59,0.25)',
                borderRadius: 10, padding: '14px 18px',
              }}>
                <i className="ti ti-circle-check" style={{ color: '#257A3B', fontSize: '1.1rem' }} />
                <p style={{ fontSize: '0.88rem', color: '#166534', fontWeight: 500 }}>{toast}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {promptState === 'A' && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #94a3b8)', lineHeight: 1.55, marginBottom: 4 }}>
                    The EEF's Implementation Guide recommends assigning clear ownership before provision is evidenced — this is your planning step.
                  </p>
                )}
                {promptState === 'A' && secondL && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #94a3b8)', lineHeight: 1.55, marginBottom: 4 }}>
                    Evidence-informed implementation works best when ownership is clear from the start.
                  </p>
                )}
                {buttons}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Self-assign modal — rendered on top of the prompt */}
      {showSelfAssign && (
        <AssignmentModal
          person={selfPerson}
          schoolId={schoolId}
          currentUserId={userId}
          supabase={supabase}
          onClose={() => {
            // Even if cancelled, mark self_assign_entered
            patchOnboardingState({ self_assign_entered: true, second_login_or_later: true })
            setShowSelfAssign(false)
          }}
          onSaved={handleSelfAssignSaved}
        />
      )}
    </>
  )
}

// ── Button styles ─────────────────────────────────────────────────────

const btnPrimary = {
  display: 'block', width: '100%', padding: '11px 20px',
  border: 'none', borderRadius: 9,
  background: '#1B365D', color: '#fff',
  fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  textAlign: 'center',
}
const btnOutlined = {
  display: 'block', width: '100%', padding: '11px 20px',
  border: '1.5px solid #1B365D', borderRadius: 9,
  background: '#fff', color: '#1B365D',
  fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  textAlign: 'center',
}
const btnText = {
  display: 'block', width: '100%', padding: '8px 20px',
  border: 'none', borderRadius: 9,
  background: 'none', color: '#94a3b8',
  fontSize: '0.82rem', fontWeight: 400, cursor: 'pointer', fontFamily: 'inherit',
  textAlign: 'center',
}
