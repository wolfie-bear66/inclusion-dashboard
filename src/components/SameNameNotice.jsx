import { displayPersonName } from '../utils/duplicateNames'

// Non-blocking same-name warning shown under an "add a person" form.
//   match  - someone at the school with exactly this name (shows the two-choice warning)
//   maybe  - same surname and first initial (shows a quiet one-line hint, only if no match)
//   onAssign - when given, offers "Assign to them" (wizard, Team page). The Invite modal has
//              nothing to assign, so it leaves this out and explains instead.
//   onDifferent - "No, this is a different person": the caller carries on and sends the
//              override to invite-user.
export default function SameNameNotice({ match, maybe, onAssign, onDifferent, disabled = false }) {
  if (match) {
    const name = displayPersonName(match)
    return (
      <div role="alert" style={{
        flex: '1 1 100%', fontSize: '0.8rem', lineHeight: 1.5, color: '#7A4A06',
        background: 'rgba(212,117,26,0.09)', border: '1px solid rgba(212,117,26,0.35)',
        borderRadius: 8, padding: '8px 12px',
      }}>
        <div>
          This looks like <strong>{name}</strong>
          {match.job_title ? ` (${match.job_title})` : ''}, who is already on your team.
          {onAssign ? ' Assign to them instead?' : ' They may already have an account.'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {onAssign && (
            <button type="button" onClick={onAssign} disabled={disabled} style={{
              padding: '5px 12px', borderRadius: 7, border: 'none', background: '#1B365D', color: '#fff',
              fontSize: '0.78rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>
              Assign to them
            </button>
          )}
          <button type="button" onClick={onDifferent} disabled={disabled} style={{
            padding: '5px 12px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#fff', color: '#475569',
            fontSize: '0.78rem', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>
            No, this is a different person
          </button>
        </div>
      </div>
    )
  }

  if (maybe) {
    return (
      <div style={{ flex: '1 1 100%', fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>
        Might this be {displayPersonName(maybe)}, who is already on your team?
        {onAssign && (
          <>
            {' '}
            <button type="button" onClick={onAssign} disabled={disabled} style={{
              background: 'none', border: 'none', padding: 0, color: '#64748b', textDecoration: 'underline',
              fontSize: '0.74rem', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>
              Assign to them
            </button>
          </>
        )}
      </div>
    )
  }

  return null
}
