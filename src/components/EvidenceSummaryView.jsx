const rowStyle = { marginBottom: 10 }
const labelStyle = { fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }
const valueStyle = { fontSize: '0.85rem', color: '#1A202C', lineHeight: 1.5 }

function formatDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={rowStyle}>
      <p style={labelStyle}>{label}</p>
      <p style={valueStyle}>{value}</p>
    </div>
  )
}

// Small, purpose-built read-only summary of a single evidence entry — used by the
// approval popup so an approver can see enough to decide without opening the full
// (fully-editable) evidence modal.
export default function EvidenceSummaryView({ evidence }) {
  if (!evidence) {
    return <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No evidence has been recorded for this point yet.</p>
  }

  const cost = evidence.cost != null && evidence.cost !== '' ? `£${Number(evidence.cost).toLocaleString('en-GB')}` : null

  return (
    <div>
      <Field label="Description" value={evidence.brief_description} />
      <Field label="Cost" value={cost} />
      <Field label="Started" value={formatDate(evidence.date_started)} />
      <Field label="Last reviewed" value={formatDate(evidence.date_last_reviewed)} />
      <Field label="Next review due" value={formatDate(evidence.next_review_due)} />
      {evidence.supporting_document_link && (
        <div style={rowStyle}>
          <p style={labelStyle}>Supporting document</p>
          <a href={evidence.supporting_document_link} target="_blank" rel="noreferrer"
            style={{ fontSize: '0.85rem', color: '#1B365D', fontWeight: 500 }}>
            View document ↗
          </a>
        </div>
      )}
      <Field label="Intended outcomes" value={evidence.intended_outcomes} />
      <Field label="Impact on outcomes" value={evidence.impact_on_outcomes} />
    </div>
  )
}
