import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Palette ───────────────────────────────────────────────────────────
// Exported so generateReportWord.js can reuse the identical brand/RAG colours
// rather than redefining them — same navy/RAG values as the PDF and brand kit.
export const NAVY   = [27,  54,  93]
export const WHITE  = [255, 255, 255]
export const DARK   = [30,  41,  59]
export const MID    = [100, 116, 139]
export const GREEN  = [37,  122, 59]
export const AMBER  = [212, 117, 26]
export const RED    = [220, 38,  38]
export const GREY   = [248, 250, 252]
export const LTGREY = [226, 232, 240]

// Portrait A4 layout constants
const ML    = 14
const CW    = 182
const MAX_Y = 277

// ── Domain identity colours ───────────────────────────────────────────
const DOMAIN_COLOUR_KEYS = {
  SEND:       '#4338CA',
  Equity:     '#7A5C13',
  Attendance: '#0E6251',
  Enrichment: '#6B21A8',
  Belonging:  '#334E68',
  Wellbeing:  '#5B3A9C',
}
export function domainColour(name = '') {
  for (const [key, col] of Object.entries(DOMAIN_COLOUR_KEYS)) {
    if (name.includes(key)) return col
  }
  return '#64748b'
}
export function hexToRgb(hex) {
  const h = (hex || '#94a3b8').replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// ── Student group boolean keys ────────────────────────────────────────
export const GROUP_TO_BOOL = {
  'Pupil Premium':      'grp_pp',
  'SEND':               'grp_send',
  'FSM':                'grp_fsm',
  'EAL':                'grp_eal',
  'LAC':                'grp_lac',
  'White Working Class':'grp_wwc',
  'Social Care':             'grp_social_care',
  'Young Carer':             'grp_young_carer',
  'Mental Health Support':   'grp_mental_health_support',
}
export const ALL_GROUP_KEYS = [
  { key: 'grp_pp',   label: 'Pupil Premium' },
  { key: 'grp_send', label: 'SEND' },
  { key: 'grp_fsm',  label: 'FSM' },
  { key: 'grp_eal',  label: 'EAL' },
  { key: 'grp_lac',  label: 'LAC' },
  { key: 'grp_wwc',  label: 'White Working Class' },
  { key: 'grp_social_care',           label: 'Social Care' },
  { key: 'grp_young_carer',           label: 'Young Carer' },
  { key: 'grp_mental_health_support', label: 'Mental Health Support' },
]

// barriers.student_groups (object format) is keyed by short codes with no 'grp_'
// prefix (e.g. 'send', 'pp') — derive their display labels from ALL_GROUP_KEYS
// rather than a second hand-typed list. 'other' isn't in ALL_GROUP_KEYS (no
// grp_other column exists), so it's added explicitly.
export const BARRIER_GROUP_LABELS = {
  ...Object.fromEntries(ALL_GROUP_KEYS.map(g => [g.key.replace('grp_', ''), g.label])),
  other: 'Other',
}

export const DFE_PRINCIPLES = [
  'Leadership & Governance',
  'Early & Evidence-Based Support',
  'High Quality Adaptive Teaching',
  'Enriching Provision',
  'Safe & Respectful Culture',
  'Family & Wider Partnerships',
  'Accessible & Inclusive Environments',
]

// ── Helpers ───────────────────────────────────────────────────────────
export function fmt() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
export function academicYear() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth() // 0-indexed, Sep = 8
  return m >= 8 ? `${y}/${String(y + 1).slice(2)}` : `${y - 1}/${String(y).slice(2)}`
}
export function statusLabel(s) {
  if (s === 'in_place')    return 'In Place'
  if (s === 'in_progress') return 'In Progress'
  return 'Not In Place'
}
function statusColour(s) {
  if (s === 'in_place')    return GREEN
  if (s === 'in_progress') return AMBER
  return RED
}
function checkNewPage(doc, y, needed = 20) {
  if (y + needed > MAX_Y) { doc.addPage(); return 14 }
  return y
}

// Full-width navy section bar with white text
function sectionBar(doc, y, label) {
  doc.setFillColor(...NAVY)
  doc.rect(0, y, 210, 8, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(label.toUpperCase(), ML, y + 5.5)
  return y + 8
}

// Domain-coloured sub-section bar (inset to margin)
function domainBar(doc, y, label) {
  const [r, g, b] = hexToRgb(domainColour(label))
  doc.setFillColor(r, g, b)
  doc.rect(ML, y, CW, 6, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(label, ML + 3, y + 4.5)
  return y + 6
}

// Per-page headers and footers — skips cover page (page 1)
function applyHeadersFooters(doc, schoolName, subtitle) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    if (i === 1) continue
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, 210, 10, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(schoolName, ML, 6.5)
    doc.setFont('helvetica', 'normal')
    doc.text(subtitle, 196, 6.5, { align: 'right' })
    doc.setFillColor(...NAVY)
    doc.rect(0, 287, 210, 10, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(7)
    doc.text('Inclusion Dashboard · inclusiondashboard.co.uk', ML, 293)
    doc.text(`Page ${i} of ${n}`, 196, 293, { align: 'right' })
  }
}

// Filter entries by domain UUID list (empty = all)
function filterByDomain(entries, selectedDomains) {
  if (selectedDomains.length === 0) return entries
  return entries.filter(e => selectedDomains.includes(e.provision_points?.sub_domains?.domains?.id))
}

// Filter entries by group — evidence_entries must have at least one group flag true
function filterByGroup(entries, selectedGroups) {
  if (selectedGroups.length === 0) return entries
  return entries.filter(e =>
    (e.evidence_entries ?? []).some(ev =>
      selectedGroups.some(g => {
        const key = GROUP_TO_BOOL[g]
        return key && ev[key]
      })
    )
  )
}

// ─────────────────────────────────────────────────────────────────────
// COVER PAGE
// ─────────────────────────────────────────────────────────────────────
function drawCoverPage(doc, { schoolName, purpose, selectedDomains, selectedGroups, domainList, userProfile, dateStr, ay }) {
  const isFullStrategy = purpose === 'full_strategy'
  const titleLine1 = isFullStrategy ? 'Inclusion Strategy Statement' : 'Inclusion Evidence Report'
  const titleLine2 = ay

  doc.setFillColor(...NAVY)
  doc.rect(0, 0, 210, 297, 'F')

  // School name
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(schoolName || 'School', 105, 88, { align: 'center' })

  // Title
  doc.setFontSize(15)
  doc.text(titleLine1, 105, 106, { align: 'center' })
  doc.setFontSize(12)
  doc.text(titleLine2, 105, 118, { align: 'center' })

  // Generated date
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(180, 200, 220)
  doc.text(`Generated: ${dateStr}`, 105, 134, { align: 'center' })

  // Filter summary pill row
  const purposeLabels = {
    full_strategy:       'Full Strategy Statement',
    domain_focus:        'Domain Focus',
    compliance_snapshot: 'Compliance Snapshot',
    outcomes_summary:    'Outcomes Summary',
  }
  const domainNames = selectedDomains.length === 0
    ? ['All domains']
    : domainList.filter(d => selectedDomains.includes(d.id)).map(d => d.name)
  const groupStr = selectedGroups.length === 0 ? 'All groups' : selectedGroups.join(' + ')
  const summaryText = [purposeLabels[purpose] ?? purpose, ...domainNames, groupStr].join(' · ')
  const wrapped = doc.splitTextToSize(summaryText, 160)
  doc.setFontSize(8)
  doc.setTextColor(200, 215, 235)
  doc.text(wrapped, 105, 150, { align: 'center' })

  // Prepared by
  if (userProfile?.first_name) {
    const name = [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ')
    const prepLine = userProfile.job_title ? `${name}, ${userProfile.job_title}` : name
    doc.setFontSize(8.5)
    doc.setTextColor(180, 200, 220)
    doc.text(`Prepared by: ${prepLine}`, 105, 172, { align: 'center' })
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(120, 150, 180)
  doc.text('Generated by Inclusion Dashboard · inclusiondashboard.co.uk', 105, 285, { align: 'center' })
}

// Per-domain in_place/in_progress/not_in_place counts — the input readinessData
// that both the School Context and Domain Readiness sections filter/aggregate further.
// Extracted from generateEvidenceReport's body (Session 57) so generateReportWord.js
// can reuse the identical computation rather than re-deriving it.
export function getReadinessData(entries, domains) {
  return domains.map(d => {
    const de = entries.filter(e => e.provision_points?.sub_domains?.domains?.id === d.id)
    return {
      id:         d.id,
      name:       d.name,
      inPlace:    de.filter(e => e.status === 'in_place').length,
      inProgress: de.filter(e => e.status === 'in_progress').length,
      notInPlace: de.filter(e => e.status === 'not_in_place').length,
      total:      de.length,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 1 — School Context
// ─────────────────────────────────────────────────────────────────────
export function getSchoolContextSectionData({ schoolCtx, readinessData, selectedDomains }) {
  const ay = academicYear()

  const cards = [
    { label: 'Total Pupils',        value: schoolCtx.totalPupils || '—' },
    { label: 'Pupil Premium',       value: schoolCtx.ppCount     || '—' },
    { label: 'SEND',                value: schoolCtx.sendCount   || '—' },
    { label: 'FSM',                 value: schoolCtx.fsmCount    || '—' },
    { label: 'EAL',                 value: schoolCtx.ealCount    || '—' },
    { label: 'LAC',                 value: schoolCtx.lacCount    || '—' },
    { label: 'White Working Class', value: schoolCtx.wwcCount    || '—' },
    { label: 'Social Care',            value: schoolCtx.socialCareCount          || '—' },
    { label: 'Young Carer',            value: schoolCtx.youngCarerCount          || '—' },
    { label: 'Mental Health Support',  value: schoolCtx.mentalHealthSupportCount || '—' },
  ]

  // Readiness headline
  const relevant = selectedDomains.length === 0
    ? readinessData
    : readinessData.filter(d => selectedDomains.includes(d.id))
  const total   = relevant.reduce((s, d) => s + d.total, 0)
  const inPlace = relevant.reduce((s, d) => s + d.inPlace, 0)
  const pct     = total ? Math.round((inPlace / total) * 100) : 0
  const readinessLabel = selectedDomains.length === 0
    ? `Overall readiness: ${pct}%`
    : `Domain readiness (selected domains): ${pct}%`

  return { ay, cards, readinessLabel }
}

function drawSchoolContext(doc, y, { schoolCtx, readinessData, selectedDomains }) {
  const { ay, cards, readinessLabel } = getSchoolContextSectionData({ schoolCtx, readinessData, selectedDomains })

  y = sectionBar(doc, y, '1 — School Context')
  y += 4

  doc.setTextColor(...MID)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text(`Cohort Profile ${ay}`, ML, y)
  y += 5

  const COLS = 4, GAP = 3
  const cardW = (CW - GAP * (COLS - 1)) / COLS
  const cardH = 16

  for (let i = 0; i < cards.length; i++) {
    const col = i % COLS, row = Math.floor(i / COLS)
    const cx = ML + col * (cardW + GAP)
    const cy = y + row * (cardH + GAP)
    doc.setFillColor(241, 245, 249)
    doc.rect(cx, cy, cardW, cardH, 'F')
    doc.setTextColor(...DARK)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(String(cards[i].value), cx + cardW / 2, cy + 8, { align: 'center' })
    doc.setTextColor(...MID)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.text(cards[i].label, cx + cardW / 2, cy + 13.5, { align: 'center' })
  }
  y += Math.ceil(cards.length / COLS) * (cardH + GAP) + 4

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(readinessLabel, ML, y)
  y += 6

  return y
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 2 — Identified Barriers
// ─────────────────────────────────────────────────────────────────────
export function getBarriersSectionData({ barriers, selectedDomains, selectedGroups }) {
  let filtered = barriers ?? []

  if (selectedDomains.length > 0) {
    filtered = filtered.filter(b => selectedDomains.includes(b.domain_id))
  }
  if (selectedGroups.length > 0) {
    filtered = filtered.filter(b => {
      const sg = b.student_groups
      if (!sg) return false
      if (Array.isArray(sg)) {
        return selectedGroups.some(g => {
          const norm = g === 'Pupil Premium' ? 'PP' : g
          return sg.some(s => s === g || s === norm || s.toLowerCase() === g.toLowerCase())
        })
      }
      // Object format fallback: {"send": true, ...}
      return selectedGroups.some(g => {
        const key = GROUP_TO_BOOL[g]?.replace('grp_', '')
        return key && sg[key]
      })
    })
  }

  const scaleMap = { individual: 'Individual', group: 'Group', whole_school: 'Whole school' }
  const statusMap = { active: 'Active', being_addressed: 'Being addressed', resolved: 'Resolved' }

  const rows = filtered.map(b => {
    const domLabel = b.sub_domains?.name
      ? `${b.domains?.name ?? ''} — ${b.sub_domains.name}`
      : (b.domains?.name ?? '—')
    const sg = b.student_groups
    const groups = Array.isArray(sg)
      // Legacy array format already stores full labels (e.g. 'Pupil Premium'), not codes.
      ? sg.join(', ')
      : (sg && typeof sg === 'object'
          ? Object.keys(sg).filter(k => sg[k]).map(k => BARRIER_GROUP_LABELS[k] ?? k).join(', ')
          : '—')
    return {
      barrier: b,
      description: b.description ?? '—',
      domLabel,
      groups: groups || '—',
      scale: scaleMap[b.scale] ?? (b.scale ?? '—'),
      source: (b.source ?? '').replace(/_/g, ' ') || '—',
      status: statusMap[b.status] ?? (b.status ?? '—'),
      actions: b.actions ?? '—',
      nextReviewDue: b.next_review_due
        ? new Date(b.next_review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—',
    }
  })

  return { filtered, rows }
}

function drawBarriers(doc, y, { barriers, selectedDomains, selectedGroups }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, '2 — Identified Barriers')
  y += 4

  const { filtered, rows } = getBarriersSectionData({ barriers, selectedDomains, selectedGroups })

  if (filtered.length === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No barriers currently recorded.', ML, y + 5)
    return y + 14
  }

  const body = rows.map(r => [
    r.description, r.domLabel, r.groups, r.scale, r.source, r.status, r.actions, r.nextReviewDue,
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: ML, top: 14, bottom: 12 },
    head: [['Description', 'Domain', 'Groups', 'Scale', 'Source', 'Status', 'Actions', 'Next Review']],
    body,
    styles:            { font: 'helvetica', fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles:{ fillColor: GREY },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 32 },
      2: { cellWidth: 24 },
      3: { cellWidth: 18 },
      4: { cellWidth: 20 },
      5: { cellWidth: 20 },
      6: { cellWidth: 21 },
      7: { cellWidth: 12 },
    },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index !== 5) return
      const b = filtered[data.row.index]
      if (!b) return
      data.cell.styles.fontStyle = 'bold'
      if (b.status === 'active') data.cell.styles.textColor = RED
      else if (b.status === 'being_addressed') data.cell.styles.textColor = AMBER
      else if (b.status === 'resolved') data.cell.styles.textColor = GREEN
    },
  })

  return doc.lastAutoTable.finalY + 4
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 3 — Domain Readiness Summary
// ─────────────────────────────────────────────────────────────────────
export function getDomainReadinessSectionData({ readinessData, selectedDomains }) {
  const relevant = selectedDomains.length === 0
    ? readinessData
    : readinessData.filter(d => selectedDomains.includes(d.id))

  // pct is null (not 0) when a domain has no provision points at all — a true
  // "no data recorded" state, distinct from a domain that has points but 0% in place.
  const rows = relevant.map(d => ({
    ...d,
    pct: d.total ? Math.round((d.inPlace / d.total) * 100) : null,
  }))

  const gaps  = relevant.filter(d => d.notInPlace > 0)
  const inDev = relevant.filter(d => d.inProgress > 0 && d.notInPlace === 0)

  return { relevant, rows, gaps, inDev }
}

function drawDomainReadiness(doc, y, { readinessData, selectedDomains }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, '3 — Domain Readiness Summary')

  const { relevant, rows, gaps, inDev } = getDomainReadinessSectionData({ readinessData, selectedDomains })

  const body = rows.map(d => [d.name, d.inPlace, d.inProgress, d.notInPlace, d.total, d.pct === null ? 'No data' : `${d.pct}%`, ''])

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: ML, top: 14, bottom: 12 },
    head: [['Domain', 'In Place', 'In Progress', 'Not In Place', 'Total', '% Ready', 'Bar']],
    body,
    styles:            { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles:{ fillColor: GREY },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 28 },
    },
    didParseCell(data) {
      if (data.section !== 'body') return
      if (data.column.index === 1) { data.cell.styles.textColor = GREEN; data.cell.styles.fontStyle = 'bold' }
      if (data.column.index === 2) { data.cell.styles.textColor = AMBER; data.cell.styles.fontStyle = 'bold' }
      if (data.column.index === 3) { data.cell.styles.textColor = RED;   data.cell.styles.fontStyle = 'bold' }
      if (data.column.index === 5) {
        const d = rows[data.row.index]
        if (d && d.pct === null) { data.cell.styles.textColor = MID; data.cell.styles.fontStyle = 'italic' }
      }
    },
    didDrawCell(data) {
      if (data.section !== 'body' || data.column.index !== 6) return
      const d = relevant[data.row.index]
      if (!d || !d.total) return
      const frac = d.inPlace / d.total
      const bx = data.cell.x + 2, by = data.cell.y + (data.cell.height - 3) / 2, bw = data.cell.width - 4
      doc.setFillColor(...LTGREY)
      doc.rect(bx, by, bw, 3, 'F')
      if (frac > 0) {
        doc.setFillColor(...hexToRgb(domainColour(d.name)))
        doc.rect(bx, by, bw * frac, 3, 'F')
      }
    },
  })
  y = doc.lastAutoTable.finalY + 4

  // Compliance gaps list
  if (gaps.length > 0) {
    y = checkNewPage(doc, y, 12)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...RED)
    doc.text('Compliance Gaps — Not In Place:', ML, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...DARK)
    for (const d of gaps) {
      y = checkNewPage(doc, y, 6)
      doc.text(`• ${d.name}: ${d.notInPlace} provision point${d.notInPlace !== 1 ? 's' : ''} not in place`, ML + 3, y)
      y += 5
    }
    y += 2
  }

  if (inDev.length > 0) {
    y = checkNewPage(doc, y, 10)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...AMBER)
    doc.text('In Development:', ML, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...DARK)
    for (const d of inDev) {
      y = checkNewPage(doc, y, 6)
      doc.text(`• ${d.name}: ${d.inProgress} provision point${d.inProgress !== 1 ? 's' : ''} in progress`, ML + 3, y)
      y += 5
    }
    y += 2
  }

  return y
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 4 — Funding & Cost
// ─────────────────────────────────────────────────────────────────────
export const FUNDING_LABELS = {
  pupil_premium:             'Pupil Premium',
  send_budget:               'SEND Budget',
  inclusive_mainstream_fund: 'Inclusive Mainstream Fund',
  sport_premium:             'Sport Premium',
  school_general_budget:     'General Budget',
}

export function getFundingSectionData({ entries, selectedDomains, schoolCtx }) {
  const domainFiltered = filterByDomain(entries, selectedDomains)
  const allEvidence = domainFiltered.flatMap(e =>
    (e.evidence_entries ?? []).map(ev => ({
      ...ev,
      domainName: e.provision_points?.sub_domains?.domains?.name ?? '',
    }))
  )

  const bySource = {}, byDomain = {}
  for (const ev of allEvidence) {
    const cost = Number(ev.cost)
    if (!cost) continue
    if (ev.funding_source) {
      const lbl = FUNDING_LABELS[ev.funding_source] ?? ev.funding_source
      bySource[lbl] = (bySource[lbl] ?? 0) + cost
    }
    if (ev.domainName) {
      byDomain[ev.domainName] = (byDomain[ev.domainName] ?? 0) + cost
    }
  }

  const totalCost = Object.values(bySource).reduce((s, v) => s + v, 0)

  const equitySpend = byDomain['Equity & Disadvantage'] ?? 0
  const sendSpend   = byDomain['SEND Support & Needs']   ?? 0
  const perPupil    = schoolCtx.totalPupils ? Math.round(totalCost   / schoolCtx.totalPupils) : null
  const perPP       = schoolCtx.ppCount     ? Math.round(equitySpend / schoolCtx.ppCount)     : null
  const perSEND     = schoolCtx.sendCount   ? Math.round(sendSpend   / schoolCtx.sendCount)   : null

  const fCards = [
    { label: 'Total Spend',    value: `£${totalCost.toLocaleString()}` },
    { label: 'Per Pupil',      value: perPupil ? `£${perPupil.toLocaleString()}`  : '—' },
    { label: 'Per PP Pupil',   value: perPP    ? `£${perPP.toLocaleString()}`     : '—' },
    { label: 'Per SEND Pupil', value: perSEND  ? `£${perSEND.toLocaleString()}`   : '—' },
  ]

  const streamRows = Object.entries(bySource).map(([name, value]) => ({
    name, value,
    pctOfTotal: totalCost ? Math.round(value / totalCost * 100) : 0,
  }))

  const domainRows = Object.entries(byDomain)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  return { totalCost, bySource, byDomain, fCards, streamRows, domainRows }
}

function drawFunding(doc, y, { entries, selectedDomains, schoolCtx }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, '4 — Funding & Cost')
  y += 4

  const { totalCost, fCards, streamRows, domainRows } = getFundingSectionData({ entries, selectedDomains, schoolCtx })

  if (totalCost === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No cost data recorded yet.', ML, y + 6)
    return y + 14
  }

  // Summary cards
  const COLS = 4, GAP = 3
  const cardW = (CW - GAP * (COLS - 1)) / COLS, cardH = 16
  for (let i = 0; i < fCards.length; i++) {
    const cx = ML + i * (cardW + GAP)
    doc.setFillColor(241, 245, 249)
    doc.rect(cx, y, cardW, cardH, 'F')
    doc.setTextColor(...DARK)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(fCards[i].value, cx + cardW / 2, y + 8, { align: 'center' })
    doc.setTextColor(...MID)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(fCards[i].label, cx + cardW / 2, y + 13.5, { align: 'center' })
  }
  y += cardH + 5

  // Funding streams table
  const streamBody = streamRows.map(r => [r.name, `£${r.value.toLocaleString()}`, `${r.pctOfTotal}%`])
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: ML, top: 14, bottom: 12 },
    head: [['Funding Stream', 'Total Spend', '% of Total']],
    body: streamBody,
    styles:            { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
    alternateRowStyles:{ fillColor: GREY },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 42, halign: 'right' },
      2: { cellWidth: 30, halign: 'center' },
    },
  })
  y = doc.lastAutoTable.finalY + 3

  // Domain spend (when domain-scoped, show selected domains only)
  const domainBody = domainRows.map(r => [r.name, `£${r.value.toLocaleString()}`])

  if (domainBody.length > 0) {
    y = checkNewPage(doc, y, 20)
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML, top: 14, bottom: 12 },
      head: [['Domain', selectedDomains.length > 0 ? 'Spend (selected domains)' : 'Spend by Domain']],
      body: domainBody,
      styles:            { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
      headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles:{ fillColor: GREY },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 62, halign: 'right' },
      },
    })
    y = doc.lastAutoTable.finalY + 3
  }

  return y
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 5 — Provision in Place
// ─────────────────────────────────────────────────────────────────────
export function getProvisionSectionData({ entries, selectedDomains, selectedGroups }) {
  let filtered = (entries ?? []).filter(e => e.provision_points?.active !== false)
  filtered = filterByDomain(filtered, selectedDomains)
  filtered = filterByGroup(filtered, selectedGroups)
  return filtered
}

function drawProvisionInPlace(doc, y, { entries, selectedDomains, selectedGroups, provisionView, domainList }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, '5 — Provision in Place')
  y += 4

  const filtered = getProvisionSectionData({ entries, selectedDomains, selectedGroups })

  if (filtered.length === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No provision points match the current filter.', ML, y + 5)
    return y + 14
  }

  if (provisionView === 'principle') {
    return drawProvisionByPrinciple(doc, y, filtered)
  }
  return drawProvisionByDomain(doc, y, filtered, domainList)
}

export function provisionRowData(e) {
  const pp  = e.provision_points ?? {}
  const evs = e.evidence_entries ?? []
  const groups  = ALL_GROUP_KEYS.filter(g => evs.some(ev => ev[g.key])).map(g => g.label)
  const intended = evs.find(ev => ev.intended_outcomes)?.intended_outcomes ?? 'Not yet recorded'
  const ut = pp.universal_or_targeted
  return [
    pp.label ?? '—',
    statusLabel(e.status),
    ut === 'universal' ? 'Universal' : ut === 'targeted' ? 'Targeted' : '—',
    groups.join(', ') || '—',
    intended,
  ]
}

const PROVISION_TABLE_OPTS = {
  styles:            { font: 'helvetica', fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
  headStyles:        { fillColor: [226, 232, 240], textColor: DARK, fontStyle: 'bold', fontSize: 7 },
  alternateRowStyles:{ fillColor: [250, 251, 252] },
  columnStyles: {
    0: { cellWidth: 52 },
    1: { cellWidth: 20 },
    2: { cellWidth: 18 },
    3: { cellWidth: 30 },
    4: { cellWidth: 59 },
  },
}

function provisionDidParseCell(filteredSlice) {
  return function(data) {
    if (data.section !== 'body' || data.column.index !== 1) return
    const e = filteredSlice[data.row.index]
    if (!e) return
    data.cell.styles.fontStyle = 'bold'
    if (e.status === 'in_place')    data.cell.styles.textColor = GREEN
    else if (e.status === 'in_progress') data.cell.styles.textColor = AMBER
    else                            data.cell.styles.textColor = RED
  }
}

export function getProvisionByDomainData(filtered, domainList) {
  // Group by domain UUID → sub-domain name
  const byDomain = {}
  for (const e of filtered) {
    const domId   = e.provision_points?.sub_domains?.domains?.id   ?? 'unknown'
    const domName = e.provision_points?.sub_domains?.domains?.name ?? 'Other'
    const sdName  = e.provision_points?.sub_domains?.name          ?? 'Other'
    if (!byDomain[domId]) byDomain[domId] = { name: domName, bySD: {} }
    if (!byDomain[domId].bySD[sdName]) byDomain[domId].bySD[sdName] = []
    byDomain[domId].bySD[sdName].push(e)
  }

  const orderedIds = (domainList ?? []).map(d => d.id).filter(id => byDomain[id])
  const extraIds   = Object.keys(byDomain).filter(id => !orderedIds.includes(id))

  return [...orderedIds, ...extraIds].map(domId => {
    const dom = byDomain[domId]
    const subDomains = Object.entries(dom.bySD).map(([sdName, sdEntries]) => ({
      sdName,
      entries: sdEntries.sort((a, b) => (a.provision_points?.display_order ?? 0) - (b.provision_points?.display_order ?? 0)),
    }))
    return { domId, name: dom.name, subDomains }
  })
}

function drawProvisionByDomain(doc, y, filtered, domainList) {
  const domains = getProvisionByDomainData(filtered, domainList)

  for (const dom of domains) {
    y = checkNewPage(doc, y, 16)
    y = domainBar(doc, y, dom.name)
    y += 3

    // Enrichment: insert equity supplementary table
    if (dom.name.includes('Enrichment')) {
      const enrichAll = dom.subDomains.flatMap(sd => sd.entries)
      y = drawEnrichmentEquityCompact(doc, y, enrichAll)
    }

    for (const { sdName, entries: sdEntries } of dom.subDomains) {
      y = checkNewPage(doc, y, 10)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...MID)
      doc.text(sdName, ML + 3, y)
      y += 5

      autoTable(doc, {
        startY: y,
        margin: { left: ML + 3, right: ML, top: 14, bottom: 12 },
        head: [['Provision', 'Status', 'Type', 'Student Groups', 'Intended Outcome']],
        body: sdEntries.map(provisionRowData),
        ...PROVISION_TABLE_OPTS,
        didParseCell: provisionDidParseCell(sdEntries),
      })
      y = doc.lastAutoTable.finalY + 4
    }
  }
  return y
}

export function getProvisionByPrincipleData(filtered) {
  return DFE_PRINCIPLES
    .map(principle => ({
      principle,
      entries: filtered
        .filter(e => e.provision_points?.principle === principle)
        .sort((a, b) => (a.provision_points?.display_order ?? 0) - (b.provision_points?.display_order ?? 0)),
    }))
    .filter(g => g.entries.length > 0)
}

function drawProvisionByPrinciple(doc, y, filtered) {
  const groups = getProvisionByPrincipleData(filtered)

  for (const { principle, entries: pEntries } of groups) {
    y = checkNewPage(doc, y, 16)
    doc.setFillColor(...NAVY)
    doc.rect(ML, y, CW, 7, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.text(principle, ML + 3, y + 5)
    y += 7 + 3

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML, top: 14, bottom: 12 },
      head: [['Provision', 'Status', 'Type', 'Student Groups', 'Intended Outcome']],
      body: pEntries.map(provisionRowData),
      ...PROVISION_TABLE_OPTS,
      didParseCell: provisionDidParseCell(pEntries),
    })
    y = doc.lastAutoTable.finalY + 4
  }
  return y
}

// Compact enrichment equity table for Section 5 (Part 4 — moved here from standalone)
// NOTE: 'groups'/'keys' here duplicate the same 9-group list as GROUP_TO_BOOL/ALL_GROUP_KEYS
// above — pre-existing duplication, left as-is per this session's scope (flagged, not fixed).
export function getEnrichmentEquityData(entries) {
  const bySD = {}
  for (const e of entries) {
    const sd = e.provision_points?.sub_domains?.name ?? 'Other'
    if (!bySD[sd]) bySD[sd] = []
    bySD[sd].push(e)
  }
  const groups = ['Pupil Premium', 'SEND', 'FSM', 'EAL', 'LAC', 'White Working Class', 'Social Care', 'Young Carer', 'Mental Health Support']
  const keys   = ['grp_pp', 'grp_send', 'grp_fsm', 'grp_eal', 'grp_lac', 'grp_wwc', 'grp_social_care', 'grp_young_carer', 'grp_mental_health_support']

  const rows = Object.entries(bySD).map(([sdName, es]) => ({
    sdName,
    values: keys.map(key => {
      const count = es.filter(e => (e.evidence_entries ?? []).some(ev => ev[key])).length
      return es.length ? Math.round(count / es.length * 100) : 0
    }),
  }))

  return { groups, rows }
}

function drawEnrichmentEquityCompact(doc, y, entries) {
  const { groups, rows } = getEnrichmentEquityData(entries)
  const body = rows.map(r => [r.sdName, ...r.values.map(v => `${v}%`)])

  if (body.length === 0) return y

  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...MID)
  doc.text('Group coverage by enrichment sub-domain (% of provision points):', ML + 3, y)
  y += 4

  autoTable(doc, {
    startY: y,
    margin: { left: ML + 3, right: ML, top: 14, bottom: 12 },
    head: [['Sub-domain', ...groups]],
    body,
    styles:            { font: 'helvetica', fontSize: 7, cellPadding: 2 },
    headStyles:        { fillColor: [240, 242, 246], textColor: DARK, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles:{ fillColor: [250, 251, 252] },
    columnStyles: {
      0: { cellWidth: 40 },
      ...Object.fromEntries(groups.map((_, i) => [i + 1, { cellWidth: 15, halign: 'center' }])),
    },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index === 0) return
      const val = parseInt(data.cell.raw)
      if (isNaN(val)) return
      data.cell.styles.fontStyle = 'bold'
      if (val >= 80)      data.cell.styles.textColor = GREEN
      else if (val >= 50) data.cell.styles.textColor = AMBER
      else                data.cell.styles.textColor = RED
    },
  })
  return doc.lastAutoTable.finalY + 4
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 6 — Reviews (overdue + next 28 days only)
// ─────────────────────────────────────────────────────────────────────
export function getReviewsSectionData({ entries, selectedDomains }) {
  const today = new Date()
  const domainFiltered = filterByDomain(entries, selectedDomains)

  const reviews = domainFiltered
    .flatMap(e =>
      (e.evidence_entries ?? [])
        .filter(ev => ev.next_review_due)
        .map(ev => {
          const days_remaining = Math.ceil((new Date(ev.next_review_due) - today) / 86400000)
          return {
            provision: e.provision_points?.label ?? '—',
            domainName: e.provision_points?.sub_domains?.domains?.name ?? '—',
            next_review_due: ev.next_review_due,
            days_remaining,
          }
        })
    )
    .filter(ev => ev.days_remaining < 0 || ev.days_remaining <= 28)
    .sort((a, b) => a.days_remaining - b.days_remaining)

  return reviews
}

function drawReviews(doc, y, { entries, selectedDomains }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, '6 — Evaluate & Sustain Reviews')
  y += 4

  const reviews = getReviewsSectionData({ entries, selectedDomains })

  if (reviews.length === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No reviews overdue or due in the next 28 days.', ML, y + 5)
    return y + 14
  }

  const body = reviews.map(ev => [
    ev.provision,
    ev.domainName,
    new Date(ev.next_review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    ev.days_remaining < 0 ? 'Overdue' : `Due in ${ev.days_remaining}d`,
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: ML, top: 14, bottom: 12 },
    head: [['Provision', 'Domain', 'Due Date', 'Status']],
    body,
    styles:            { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5 },
    headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
    alternateRowStyles:{ fillColor: GREY },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 52 },
      2: { cellWidth: 24 },
      3: { cellWidth: 16, halign: 'center' },
    },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index !== 3) return
      const ev = reviews[data.row.index]
      if (!ev) return
      data.cell.styles.fontStyle = 'bold'
      data.cell.styles.textColor = ev.days_remaining < 0 ? RED : AMBER
    },
  })

  return doc.lastAutoTable.finalY + 4
}

// ─────────────────────────────────────────────────────────────────────
// APPENDIX A — Full Outcomes & Impact
// ─────────────────────────────────────────────────────────────────────
export function getAppendixASectionData({ entries, selectedDomains, selectedGroups, domainList }) {
  const byDomain = {}
  const domFiltered = filterByDomain(entries, selectedDomains)

  for (const e of domFiltered) {
    const domId   = e.provision_points?.sub_domains?.domains?.id   ?? 'unknown'
    const domName = e.provision_points?.sub_domains?.domains?.name ?? 'Other'
    for (const ev of (e.evidence_entries ?? [])) {
      // Group filter on evidence_entries
      if (selectedGroups.length > 0) {
        const matches = selectedGroups.some(g => {
          const key = GROUP_TO_BOOL[g]
          return key && ev[key]
        })
        if (!matches) continue
      }
      if (!byDomain[domId]) byDomain[domId] = { name: domName, rows: [] }
      byDomain[domId].rows.push({
        provision: e.provision_points?.label ?? '—',
        intended:  ev.intended_outcomes  ?? 'Not yet recorded',
        impact:    ev.impact_on_outcomes ?? 'Not yet recorded',
      })
    }
  }

  const orderedIds = (domainList ?? []).map(d => d.id).filter(id => byDomain[id])
  const extraIds   = Object.keys(byDomain).filter(id => !orderedIds.includes(id))

  const domains = [...orderedIds, ...extraIds].map(domId => byDomain[domId])

  return { domains }
}

function drawAppendixA(doc, y, { entries, selectedDomains, selectedGroups, domainList }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, 'Appendix A — Full Outcomes & Impact')
  y += 4

  const { domains } = getAppendixASectionData({ entries, selectedDomains, selectedGroups, domainList })

  if (domains.length === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No outcomes or impact evidence recorded.', ML, y + 5)
    return y + 14
  }

  for (const dom of domains) {
    y = checkNewPage(doc, y, 14)
    y = domainBar(doc, y, dom.name)
    y += 3

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML, top: 14, bottom: 12 },
      head: [['Provision', 'Intended Outcome', 'Evidence of Impact']],
      body: dom.rows.map(r => [r.provision, r.intended, r.impact]),
      styles:            { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles:{ fillColor: GREY },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 63.5 },
        2: { cellWidth: 63.5 },
      },
    })
    y = doc.lastAutoTable.finalY + 4
  }

  return y
}

// ─────────────────────────────────────────────────────────────────────
// APPENDIX B — Full Provision Checklist
// ─────────────────────────────────────────────────────────────────────
export function getAppendixBSectionData({ entries, domainList }) {
  const byDomain = {}
  for (const e of entries) {
    if (e.provision_points?.active === false) continue
    const domId   = e.provision_points?.sub_domains?.domains?.id   ?? 'unknown'
    const domName = e.provision_points?.sub_domains?.domains?.name ?? 'Other'
    const sdName  = e.provision_points?.sub_domains?.name          ?? 'Other'
    if (!byDomain[domId]) byDomain[domId] = { name: domName, bySD: {} }
    if (!byDomain[domId].bySD[sdName]) byDomain[domId].bySD[sdName] = []
    byDomain[domId].bySD[sdName].push(e)
  }

  const orderedIds = (domainList ?? []).map(d => d.id).filter(id => byDomain[id])

  const domains = orderedIds.map(domId => {
    const dom = byDomain[domId]
    const subDomains = Object.entries(dom.bySD).map(([sdName, sdEntries]) => ({
      sdName,
      entries: sdEntries.sort((a, b) => (a.provision_points?.display_order ?? 0) - (b.provision_points?.display_order ?? 0)),
    }))
    return { domId, name: dom.name, subDomains }
  })

  return { domains }
}

function drawAppendixB(doc, y, { entries, domainList }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, 'Appendix B — Full Provision Checklist')
  y += 4

  const { domains } = getAppendixBSectionData({ entries, domainList })

  for (const dom of domains) {
    y = checkNewPage(doc, y, 14)
    y = domainBar(doc, y, dom.name)
    y += 3

    for (const { sdName, entries: sorted } of dom.subDomains) {
      y = checkNewPage(doc, y, 10)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...MID)
      doc.text(sdName, ML + 3, y)
      y += 4

      autoTable(doc, {
        startY: y,
        margin: { left: ML + 3, right: ML, top: 14, bottom: 12 },
        body: sorted.map(e => [
          e.provision_points?.label ?? '—',
          statusLabel(e.status),
          e.provision_points?.universal_or_targeted ?? '—',
        ]),
        styles:            { font: 'helvetica', fontSize: 7, cellPadding: 2 },
        alternateRowStyles:{ fillColor: GREY },
        columnStyles: {
          0: { cellWidth: 118 },
          1: { cellWidth: 30 },
          2: { cellWidth: 31 },
        },
        didParseCell(data) {
          if (data.column.index !== 1) return
          const e = sorted[data.row.index]
          if (!e) return
          data.cell.styles.fontStyle = 'bold'
          if (e.status === 'in_place')    data.cell.styles.textColor = GREEN
          else if (e.status === 'in_progress') data.cell.styles.textColor = AMBER
          else                            data.cell.styles.textColor = RED
        },
      })
      y = doc.lastAutoTable.finalY + 3
    }
  }

  return y
}

// Which sections appear for each report "purpose" — shared decision logic,
// reused as-is by generateReportWord.js so PDF and Word never disagree on
// which sections a given purpose includes.
export function getShowSections(purpose, includeAppendixB) {
  return {
    schoolContext:    purpose !== 'outcomes_summary',
    barriers:         purpose === 'full_strategy' || purpose === 'domain_focus' || purpose === 'outcomes_summary',
    domainReadiness:  purpose !== 'outcomes_summary',
    funding:          purpose === 'full_strategy' || purpose === 'domain_focus',
    provision:        purpose === 'full_strategy' || purpose === 'domain_focus',
    reviews:          purpose !== 'outcomes_summary',
    appendixA:        purpose === 'full_strategy' || purpose === 'domain_focus' || purpose === 'outcomes_summary',
    appendixB:        purpose === 'full_strategy' && includeAppendixB,
  }
}

// ─────────────────────────────────────────────────────────────────────
// PUBLIC API — new evidence report (all 4 purpose modes)
// ─────────────────────────────────────────────────────────────────────
export function generateEvidenceReport({
  purpose          = 'full_strategy',
  selectedDomains  = [],
  selectedGroups   = [],
  provisionView    = 'domain',
  includeAppendixB = false,
  entries          = [],
  domains          = [],
  barriers         = [],
  schoolCtx        = {},
  schoolName       = '',
  userProfile      = null,
}) {
  const doc       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dateStr   = fmt()
  const ay        = academicYear()
  const safeName  = (schoolName || 'School').replace(/[^a-z0-9]/gi, '_')
  const isFullStrategy = purpose === 'full_strategy'

  // Build readiness data with domain UUID
  const readinessData = getReadinessData(entries, domains)

  // Which sections to include per purpose
  const show = getShowSections(purpose, includeAppendixB)

  // Page 1: cover
  drawCoverPage(doc, { schoolName, purpose, selectedDomains, selectedGroups, domainList: domains, userProfile, dateStr, ay })

  // Page 2+: content
  doc.addPage()
  let y = 14

  if (show.schoolContext) {
    y = drawSchoolContext(doc, y, { schoolCtx, readinessData, selectedDomains })
    y += 4
  }

  if (show.barriers) {
    y = drawBarriers(doc, y, { barriers, selectedDomains, selectedGroups })
  }

  if (show.domainReadiness) {
    y = drawDomainReadiness(doc, y, { readinessData, selectedDomains })
  }

  if (show.funding) {
    y = drawFunding(doc, y, { entries, selectedDomains, schoolCtx })
  }

  if (show.provision) {
    y = drawProvisionInPlace(doc, y, { entries, selectedDomains, selectedGroups, provisionView, domainList: domains })
  }

  if (show.reviews) {
    y = drawReviews(doc, y, { entries, selectedDomains })
  }

  if (show.appendixA) {
    y = drawAppendixA(doc, y, { entries, selectedDomains, selectedGroups, domainList: domains })
  }

  if (show.appendixB) {
    drawAppendixB(doc, y, { entries, domainList: domains })
  }

  const docSubtitle = isFullStrategy
    ? `Inclusion Strategy Statement ${ay}`
    : `Inclusion Evidence Report ${ay}`

  applyHeadersFooters(doc, schoolName || 'School', docSubtitle)

  const filePrefix = isFullStrategy ? 'Inclusion_Strategy_Statement' : 'Inclusion_Evidence_Report'
  doc.save(`${filePrefix}_${safeName}_${ay.replace('/', '-')}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────
// generateInclusionStrategyDraft — Create Inclusion Strategy wizard export
// Reads from inclusion_strategy_drafts / inclusion_strategy_priorities.
// DfE order: cover, statement of intent, barriers, activity by principle,
// intended outcomes, further information (if present).
// ─────────────────────────────────────────────────────────────────────
function bodyTextOrPlaceholder(doc, y, text, placeholder = 'Not provided.') {
  if (text && text.trim()) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(text.trim(), CW)
    for (const line of lines) {
      y = checkNewPage(doc, y, 6)
      doc.text(line, ML, y)
      y += 5
    }
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...MID)
    y = checkNewPage(doc, y, 6)
    doc.text(placeholder, ML, y)
    y += 5
  }
  return y
}

function principleBarLite(doc, y, label) {
  doc.setFillColor(...LTGREY)
  doc.rect(ML, y, CW, 6, 'F')
  doc.setTextColor(...NAVY)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text(label, ML + 3, y + 4.5)
  return y + 6
}

export function generateInclusionStrategyDraft({ schoolName = '', draft = {}, barriers = [], priorities = [] }) {
  const doc     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dateStr = fmt()
  const ay      = draft.academic_year_label?.trim() || academicYear()
  const safeName = (schoolName || 'School').replace(/[^a-z0-9]/gi, '_')

  // ── Cover ─────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, 210, 297, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(schoolName || 'School', 105, 90, { align: 'center' })

  doc.setFontSize(15)
  doc.text('Inclusion Strategy', 105, 108, { align: 'center' })
  doc.setFontSize(12)
  doc.text(ay, 105, 120, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(180, 200, 220)
  let coverY = 138
  if (draft.review_date) {
    const reviewStr = new Date(draft.review_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(`Review date: ${reviewStr}`, 105, coverY, { align: 'center' })
    coverY += 10
  }
  if (draft.authorised_by?.trim()) {
    doc.text(`Authorised by: ${draft.authorised_by.trim()}`, 105, coverY, { align: 'center' })
    coverY += 10
  }
  if (barriers.length > 0) {
    doc.setTextColor(...hexToRgb('#F4B860'))
    doc.text(`Barriers identified: ${barriers.length}`, 105, coverY, { align: 'center' })
  }

  doc.setFontSize(8)
  doc.setTextColor(120, 150, 180)
  doc.text(`Generated: ${dateStr}`, 105, 270, { align: 'center' })
  doc.text('Generated by Inclusion Dashboard · inclusiondashboard.co.uk', 105, 285, { align: 'center' })

  // ── Content pages ─────────────────────────────────────────────────
  doc.addPage()
  let y = 14

  // Statement of intent
  y = sectionBar(doc, y, 'Statement of Intent')
  y += 6
  y = bodyTextOrPlaceholder(doc, y, draft.statement_of_intent)
  y += 6

  // Barriers to learning and participation
  y = checkNewPage(doc, y, 14)
  y = sectionBar(doc, y, 'Barriers to Learning and Participation')
  y += 6
  if (barriers.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...MID)
    doc.text('No barriers selected.', ML, y)
    y += 5
  } else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK)
    barriers.forEach((b, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${b.description}`, CW)
      y = checkNewPage(doc, y, lines.length * 5 + 2)
      doc.text(lines, ML, y)
      y += lines.length * 5 + 2
    })
  }
  y += 4

  // Activity in this academic year — grouped by principle
  y = checkNewPage(doc, y, 14)
  y = sectionBar(doc, y, 'Activity in this Academic Year')
  y += 6

  const byPrinciple = DFE_PRINCIPLES
    .map(p => ({ principle: p, items: priorities.filter(pr => pr.principle === p) }))
    .filter(g => g.items.length > 0)

  if (byPrinciple.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...MID)
    doc.text('No priorities added.', ML, y)
    y += 5
  } else {
    for (const group of byPrinciple) {
      y = checkNewPage(doc, y, 12)
      y = principleBarLite(doc, y, group.principle)
      y += 5

      for (const item of group.items) {
        y = checkNewPage(doc, y, 14)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DARK)
        const titleLines = doc.splitTextToSize(item.point_description || 'Untitled priority', CW - 4)
        doc.text(titleLines, ML + 2, y)
        y += titleLines.length * 5

        if (item.activity_description?.trim()) {
          const actLines = doc.splitTextToSize(item.activity_description.trim(), CW - 4)
          y = checkNewPage(doc, y, actLines.length * 4.5)
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MID)
          doc.text(actLines, ML + 2, y)
          y += actLines.length * 4.5
        }

        const metaParts = []
        if (item.source_point_id) metaParts.push('From identified provision gap')
        if (item.budgeted_cost) metaParts.push(`£${Number(item.budgeted_cost).toLocaleString('en-GB')}`)
        if (item.funding_source) metaParts.push(FUNDING_LABELS[item.funding_source] ?? item.funding_source)
        if (metaParts.length > 0) {
          y = checkNewPage(doc, y, 4.5)
          doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...MID)
          doc.text(metaParts.join(' · '), ML + 2, y)
          y += 4.5
        }
        y += 4
      }
      y += 3
    }
  }
  y += 2

  // Intended outcomes
  y = checkNewPage(doc, y, 14)
  y = sectionBar(doc, y, 'Intended Outcomes')
  y += 6
  y = bodyTextOrPlaceholder(doc, y, draft.intended_outcomes)

  // Further information — only if non-empty
  if (draft.further_information?.trim()) {
    y += 6
    y = checkNewPage(doc, y, 14)
    y = sectionBar(doc, y, 'Further Information')
    y += 6
    y = bodyTextOrPlaceholder(doc, y, draft.further_information)
  }

  applyHeadersFooters(doc, schoolName || 'School', `Inclusion Strategy ${ay}`)
  doc.save(`Inclusion_Strategy_${safeName}_${ay.replace('/', '-')}.pdf`)
}
