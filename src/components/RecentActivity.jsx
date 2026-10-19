import { useEffect, useState } from 'react'

// "Recent activity" card for the school home screen, plus its "See all" pop-out. The only source is
// the activity_log table, which database triggers fill (see 20261019120000_activity_log.sql).
// Whole school, for every role: no Viewing/personal filtering. Names are snapshots stored on each
// row, so a MAT admin visiting (who cannot read another school's profiles) still sees them.

const LONDON = 'Europe/London'
const CARD_COUNT = 3
const FETCH_LIMIT = 500

const STATUS_LABEL = { in_place: 'In place', in_progress: 'In progress', not_in_place: 'Not in place' }
const DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
})
const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, hour: '2-digit', minute: '2-digit', hour12: false })

// Monday of the Europe/London calendar week containing `date`, as 'YYYY-MM-DD'. Same grouping as
// date_trunc('week', ts at time zone 'Europe/London') in Postgres (weeks run Monday to Sunday).
function londonWeekStart(date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map(x => [x.type, x.value]))
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day - DOW[p.weekday])).toISOString().slice(0, 10)
}

function weekHeading(weekKey, nowKey) {
  const lastKey = new Date(Date.parse(nowKey + 'T00:00:00Z') - 7 * 86400000).toISOString().slice(0, 10)
  if (weekKey === nowKey) return 'This week'
  if (weekKey === lastKey) return 'Last week'
  const d = new Date(weekKey + 'T00:00:00Z')
  return `w/c ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
}

function groupByWeek(items, now = new Date()) {
  const nowKey = londonWeekStart(now)
  const groups = []
  for (const it of items) {
    const key = londonWeekStart(new Date(it.created_at))
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) { g = { key, heading: weekHeading(key, nowKey), items: [] }; groups.push(g) }
    g.items.push(it)
  }
  return groups
}

function ActivityItem({ item, canOpen, onOpen }) {
  const who = item.actor_name || 'A team member'
  const when = new Date(item.created_at)
  const isEvidence = item.event_type !== 'status_changed'
  const linkable = isEvidence && !item.removed && !!item.evidence_id && canOpen(item)
  const meta = [item.principle, item.entry_label].filter(Boolean).join(' · ')

  let body
  if (isEvidence) {
    const title = item.removed ? 'Evidence Removed' : (item.evidence_title || 'Untitled evidence')
    const titleEl = linkable
      ? <button type="button" className="activity-link" onClick={() => onOpen(item)}>{title}</button>
      : <span style={{ fontWeight: 600 }}>{title}</span>
    body = (
      <>
        {who} {item.event_type === 'evidence_first' ? 'logged their first evidence' : 'added evidence'}: {titleEl}
        {item.removed && <span className="activity-tag">Removed</span>}
      </>
    )
  } else {
    const to = STATUS_LABEL[item.status_to] ?? item.status_to
    const from = item.status_from ? (STATUS_LABEL[item.status_from] ?? item.status_from) : null
    body = from
      ? <>{who} updated <span style={{ fontWeight: 600 }}>{item.entry_label}</span>: {from} → {to}</>
      : <>{who} set <span style={{ fontWeight: 600 }}>{item.entry_label}</span> to {to}</>
  }

  return (
    <div className="activity-row">
      <p className="activity-line">{body}</p>
      {isEvidence && meta && <p className="activity-meta">{meta}</p>}
      {!isEvidence && item.principle && <p className="activity-meta">{item.principle}</p>}
      <p className="activity-when">{dateFmt.format(when)}, {timeFmt.format(when)}</p>
    </div>
  )
}

export default function RecentActivity({ supabase, schoolId, refreshKey, canOpen, onOpen }) {
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!schoolId) return
    let cancelled = false
    supabase
      .from('activity_log')
      .select('id, event_type, actor_name, entry_id, entry_label, principle, evidence_id, evidence_title, status_from, status_to, removed, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT)
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) { console.error('Error loading recent activity:', err); setError(true); setLoaded(true); return }
        setError(false)
        setItems(data ?? [])
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [supabase, schoolId, refreshKey])

  const handleOpen = item => { setOpen(false); onOpen(item) }
  const recent = items.slice(0, CARD_COUNT)

  return (
    <>
      <div className="hp-card hp-activity">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="hp-font-display" style={{ fontSize: 18, fontWeight: 600, color: 'var(--hp-text-primary)', margin: 0 }}>Recent activity</h2>
          {items.length > 0 && (
            <button type="button" className="activity-seeall" onClick={() => setOpen(true)}>See all</button>
          )}
        </div>
        {!loaded ? null : error ? (
          <p className="activity-empty">Recent activity can't be shown right now.</p>
        ) : recent.length === 0 ? (
          <p className="activity-empty">Updates will appear here as your team works.</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {recent.map(it => <ActivityItem key={it.id} item={it} canOpen={canOpen} onOpen={handleOpen} />)}
          </div>
        )}
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Recent activity</span>
              <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="modal-body" style={{ paddingTop: 8 }}>
              {groupByWeek(items).map(g => (
                <section key={g.key}>
                  <h3 className="activity-week">{g.heading}</h3>
                  {g.items.map(it => <ActivityItem key={it.id} item={it} canOpen={canOpen} onOpen={handleOpen} />)}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
