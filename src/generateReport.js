import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Palette ───────────────────────────────────────────────────────────
const NAVY   = [27,  54,  93]
const WHITE  = [255, 255, 255]
const DARK   = [30,  41,  59]
const MID    = [100, 116, 139]
const GREEN  = [37,  122, 59]
const AMBER  = [212, 117, 26]
const RED    = [220, 38,  38]
const GREY   = [248, 250, 252]
const LTGREY = [226, 232, 240]

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
function domainColour(name = '') {
  for (const [key, col] of Object.entries(DOMAIN_COLOUR_KEYS)) {
    if (name.includes(key)) return col
  }
  return '#64748b'
}
function hexToRgb(hex) {
  const h = (hex || '#94a3b8').replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// ── Student group boolean keys ────────────────────────────────────────
const GROUP_TO_BOOL = {
  'Pupil Premium':      'grp_pp',
  'SEND':               'grp_send',
  'FSM':                'grp_fsm',
  'EAL':                'grp_eal',
  'LAC':                'grp_lac',
  'White Working Class':'grp_wwc',
}
const ALL_GROUP_KEYS = [
  { key: 'grp_pp',   label: 'Pupil Premium' },
  { key: 'grp_send', label: 'SEND' },
  { key: 'grp_fsm',  label: 'FSM' },
  { key: 'grp_eal',  label: 'EAL' },
  { key: 'grp_lac',  label: 'LAC' },
  { key: 'grp_wwc',  label: 'White Working Class' },
]

const DFE_PRINCIPLES = [
  'Leadership & Governance',
  'Early & Evidence-Based Support',
  'High Quality Adaptive Teaching',
  'Enriching Provision',
  'Safe & Respectful Culture',
  'Family & Wider Partnerships',
  'Accessible & Inclusive Environments',
]

// ── Helpers ───────────────────────────────────────────────────────────
function fmt() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function academicYear() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth() // 0-indexed, Sep = 8
  return m >= 8 ? `${y}/${String(y + 1).slice(2)}` : `${y - 1}/${String(y).slice(2)}`
}
function statusLabel(s) {
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

// ─────────────────────────────────────────────────────────────────────
// SECTION 1 — School Context
// ─────────────────────────────────────────────────────────────────────
function drawSchoolContext(doc, y, { schoolCtx, readinessData, selectedDomains }) {
  y = sectionBar(doc, y, '1 — School Context')
  y += 4

  const ay = academicYear()
  doc.setTextColor(...MID)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text(`Cohort Profile ${ay}`, ML, y)
  y += 5

  const cards = [
    { label: 'Total Pupils',        value: schoolCtx.totalPupils || '—' },
    { label: 'Pupil Premium',       value: schoolCtx.ppCount     || '—' },
    { label: 'SEND',                value: schoolCtx.sendCount   || '—' },
    { label: 'FSM',                 value: schoolCtx.fsmCount    || '—' },
    { label: 'EAL',                 value: schoolCtx.ealCount    || '—' },
    { label: 'LAC',                 value: schoolCtx.lacCount    || '—' },
    { label: 'White Working Class', value: schoolCtx.wwcCount    || '—' },
  ]

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

  // Readiness headline
  const relevant = selectedDomains.length === 0
    ? readinessData
    : readinessData.filter(d => selectedDomains.includes(d.id))
  const total   = relevant.reduce((s, d) => s + d.total, 0)
  const inPlace = relevant.reduce((s, d) => s + d.inPlace, 0)
  const pct     = total ? Math.round((inPlace / total) * 100) : 0
  const label   = selectedDomains.length === 0
    ? `Overall readiness: ${pct}%`
    : `Domain readiness (selected domains): ${pct}%`

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(label, ML, y)
  y += 6

  return y
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 2 — Identified Barriers
// ─────────────────────────────────────────────────────────────────────
function drawBarriers(doc, y, { barriers, selectedDomains, selectedGroups }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, '2 — Identified Barriers')
  y += 4

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

  if (filtered.length === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No barriers currently recorded.', ML, y + 5)
    return y + 14
  }

  const scaleMap = { individual: 'Individual', group: 'Group', whole_school: 'Whole school' }
  const statusMap = { active: 'Active', being_addressed: 'Being addressed', resolved: 'Resolved' }

  const body = filtered.map(b => {
    const domLabel = b.sub_domains?.name
      ? `${b.domains?.name ?? ''} — ${b.sub_domains.name}`
      : (b.domains?.name ?? '—')
    const sg = b.student_groups
    const groups = Array.isArray(sg)
      ? sg.join(', ')
      : (sg && typeof sg === 'object'
          ? Object.keys(sg).filter(k => sg[k]).join(', ')
          : '—')
    return [
      b.description ?? '—',
      domLabel,
      groups || '—',
      scaleMap[b.scale] ?? (b.scale ?? '—'),
      (b.source ?? '').replace(/_/g, ' ') || '—',
      statusMap[b.status] ?? (b.status ?? '—'),
      b.actions ?? '—',
      b.next_review_due
        ? new Date(b.next_review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—',
    ]
  })

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
function drawDomainReadiness(doc, y, { readinessData, selectedDomains }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, '3 — Domain Readiness Summary')

  const relevant = selectedDomains.length === 0
    ? readinessData
    : readinessData.filter(d => selectedDomains.includes(d.id))

  const body = relevant.map(d => {
    const pct = d.total ? Math.round((d.inPlace / d.total) * 100) : 0
    return [d.name, d.inPlace, d.inProgress, d.notInPlace, d.total, `${pct}%`, '']
  })

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
  const gaps = relevant.filter(d => d.notInPlace > 0)
  const inDev = relevant.filter(d => d.inProgress > 0 && d.notInPlace === 0)

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
const FUNDING_LABELS = {
  pupil_premium:             'Pupil Premium',
  send_budget:               'SEND Budget',
  inclusive_mainstream_fund: 'Inclusive Mainstream Fund',
  sport_premium:             'Sport Premium',
  school_general_budget:     'General Budget',
}

function drawFunding(doc, y, { entries, selectedDomains, schoolCtx }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, '4 — Funding & Cost')
  y += 4

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

  if (totalCost === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No cost data recorded yet.', ML, y + 6)
    return y + 14
  }

  // Summary cards
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
  const streamBody = Object.entries(bySource).map(([name, value]) => [
    name, `£${value.toLocaleString()}`, `${totalCost ? Math.round(value / totalCost * 100) : 0}%`,
  ])
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
  const domainBody = Object.entries(byDomain)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => [name, `£${value.toLocaleString()}`])

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
function drawProvisionInPlace(doc, y, { entries, selectedDomains, selectedGroups, provisionView, domainList }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, '5 — Provision in Place')
  y += 4

  let filtered = (entries ?? []).filter(e => e.provision_points?.active !== false)
  filtered = filterByDomain(filtered, selectedDomains)
  filtered = filterByGroup(filtered, selectedGroups)

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

function provisionRowData(e) {
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

function drawProvisionByDomain(doc, y, filtered, domainList) {
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

  for (const domId of [...orderedIds, ...extraIds]) {
    const dom = byDomain[domId]
    y = checkNewPage(doc, y, 16)
    y = domainBar(doc, y, dom.name)
    y += 3

    // Enrichment: insert equity supplementary table
    if (dom.name.includes('Enrichment')) {
      const enrichAll = Object.values(dom.bySD).flat()
      y = drawEnrichmentEquityCompact(doc, y, enrichAll)
    }

    for (const [sdName, sdEntries] of Object.entries(dom.bySD)) {
      y = checkNewPage(doc, y, 10)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...MID)
      doc.text(sdName, ML + 3, y)
      y += 5

      const sorted = sdEntries.sort((a, b) => (a.provision_points?.display_order ?? 0) - (b.provision_points?.display_order ?? 0))

      autoTable(doc, {
        startY: y,
        margin: { left: ML + 3, right: ML, top: 14, bottom: 12 },
        head: [['Provision', 'Status', 'Type', 'Student Groups', 'Intended Outcome']],
        body: sorted.map(provisionRowData),
        ...PROVISION_TABLE_OPTS,
        didParseCell: provisionDidParseCell(sorted),
      })
      y = doc.lastAutoTable.finalY + 4
    }
  }
  return y
}

function drawProvisionByPrinciple(doc, y, filtered) {
  for (const principle of DFE_PRINCIPLES) {
    const pEntries = filtered
      .filter(e => e.provision_points?.principle === principle)
      .sort((a, b) => (a.provision_points?.display_order ?? 0) - (b.provision_points?.display_order ?? 0))

    if (pEntries.length === 0) continue

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
function drawEnrichmentEquityCompact(doc, y, entries) {
  const bySD = {}
  for (const e of entries) {
    const sd = e.provision_points?.sub_domains?.name ?? 'Other'
    if (!bySD[sd]) bySD[sd] = []
    bySD[sd].push(e)
  }
  const groups = ['Pupil Premium', 'SEND', 'FSM', 'EAL', 'LAC', 'White Working Class']
  const keys   = ['grp_pp', 'grp_send', 'grp_fsm', 'grp_eal', 'grp_lac', 'grp_wwc']

  const body = Object.entries(bySD).map(([sdName, es]) => {
    const row = [sdName]
    for (const key of keys) {
      const count = es.filter(e => (e.evidence_entries ?? []).some(ev => ev[key])).length
      row.push(`${es.length ? Math.round(count / es.length * 100) : 0}%`)
    }
    return row
  })

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
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
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
function drawReviews(doc, y, { entries, selectedDomains }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, '6 — Evaluate & Sustain Reviews')
  y += 4

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
function drawAppendixA(doc, y, { entries, selectedDomains, selectedGroups, domainList }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, 'Appendix A — Full Outcomes & Impact')
  y += 4

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

  if (orderedIds.length === 0 && extraIds.length === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No outcomes or impact evidence recorded.', ML, y + 5)
    return y + 14
  }

  for (const domId of [...orderedIds, ...extraIds]) {
    const dom = byDomain[domId]
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
function drawAppendixB(doc, y, { entries, domainList }) {
  y = checkNewPage(doc, y, 30)
  y = sectionBar(doc, y, 'Appendix B — Full Provision Checklist')
  y += 4

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

  for (const domId of orderedIds) {
    const dom = byDomain[domId]
    y = checkNewPage(doc, y, 14)
    y = domainBar(doc, y, dom.name)
    y += 3

    for (const [sdName, sdEntries] of Object.entries(dom.bySD)) {
      const sorted = sdEntries.sort((a, b) => (a.provision_points?.display_order ?? 0) - (b.provision_points?.display_order ?? 0))
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
  const readinessData = domains.map(d => {
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

  // Which sections to include per purpose
  const show = {
    schoolContext:    purpose !== 'outcomes_summary',
    barriers:         purpose === 'full_strategy' || purpose === 'domain_focus' || purpose === 'outcomes_summary',
    domainReadiness:  purpose !== 'outcomes_summary',
    funding:          purpose === 'full_strategy' || purpose === 'domain_focus',
    provision:        purpose === 'full_strategy' || purpose === 'domain_focus',
    reviews:          purpose !== 'outcomes_summary',
    appendixA:        purpose === 'full_strategy' || purpose === 'domain_focus' || purpose === 'outcomes_summary',
    appendixB:        purpose === 'full_strategy' && includeAppendixB,
  }

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
// LEGACY — generateReport (old working report, kept for compatibility)
// ─────────────────────────────────────────────────────────────────────
const LEGACY_ML  = 14
const LEGACY_CW  = 269
const LEGACY_MAX = 197
const LEGACY_TEAL   = [0, 105, 105]
const LEGACY_INDIGO = [99, 102, 241]
const LEGACY_LTGREY = [229, 231, 235]

function legacyHex(hex) {
  const h = (hex || '#94a3b8').replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}
function legacyDomainColour(name = '', idx = 0) {
  const map = [
    { k: 'SEND', c: '#4338CA' }, { k: 'Equity', c: '#7A5C13' },
    { k: 'Attendance', c: '#0E6251' }, { k: 'Enrichment', c: '#6B21A8' },
    { k: 'Belonging', c: '#334E68' }, { k: 'Wellbeing', c: '#5B3A9C' },
  ]
  const fb = ['#4338CA','#7A5C13','#0E6251','#6B21A8','#334E68','#5B3A9C']
  const m = map.find(d => name.includes(d.k))
  return m ? m.c : fb[idx % fb.length]
}
function legacyCheckPage(doc, y, needed = 20) {
  if (y + needed > LEGACY_MAX) { doc.addPage(); return 14 }
  return y
}
function legacySectionBar(doc, y, label) {
  doc.setFillColor(...LEGACY_TEAL)
  doc.rect(0, y, 297, 7, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(label.toUpperCase(), LEGACY_ML, y + 4.8)
  return y + 7
}
function legacyApplyHF(doc, schoolName, dateStr) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, 297, 12, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(schoolName, LEGACY_ML, 8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Inclusion Evidence Report | ${dateStr}`, 283, 8, { align: 'right' })
    doc.setFillColor(...NAVY)
    doc.rect(0, 200, 297, 10, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(7.5)
    doc.text('Inclusion Dashboard · inclusiondashboard.co.uk', LEGACY_ML, 206)
    doc.text(`Page ${i} of ${n}`, 283, 206, { align: 'right' })
  }
}

export function generateReport({
  schoolCtx = {}, readinessData = [], upcomingReviews = [],
  equityData = [], fundingSourceData = [], fundingDomainData = [],
  totalCost = 0, allEvidence = [], domains = [],
  schoolName = '', options = {},
}) {
  const {
    includeEquity   = true,
    equityChart     = 'table',
    includeFunding  = true,
    fundingChart    = 'bar',
    includeOutcomes = true,
    outcomeMode     = 'all',
    outcomeSelected = [],
  } = options

  const doc     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const dateStr = fmt()
  const ay      = academicYear()
  const safeName = (schoolName || 'School').replace(/[^a-z0-9]/gi, '_')

  let y = 14

  // School context
  y = legacySectionBar(doc, y, 'School Context')
  y += 3

  const cards = [
    { label: 'Total Pupils',        value: schoolCtx.totalPupils || '—' },
    { label: 'Pupil Premium',       value: schoolCtx.ppCount     || '—' },
    { label: 'SEND',                value: schoolCtx.sendCount   || '—' },
    { label: 'FSM',                 value: schoolCtx.fsmCount    || '—' },
    { label: 'EAL',                 value: schoolCtx.ealCount    || '—' },
    { label: 'LAC',                 value: schoolCtx.lacCount    || '—' },
    { label: 'White Working Class', value: schoolCtx.wwcCount    || '—' },
    { label: 'Overall Readiness',   value: `${readinessData.reduce((s,d)=>s+d.total,0) ? Math.round(readinessData.reduce((s,d)=>s+d.inPlace,0)/readinessData.reduce((s,d)=>s+d.total,0)*100) : 0}%` },
  ]
  const GAP = 3, COLS = 4
  const cardW = (LEGACY_CW - GAP * (COLS - 1)) / COLS, cardH = 18
  for (let i = 0; i < cards.length; i++) {
    const col = i % COLS, row = Math.floor(i / COLS)
    const cx = LEGACY_ML + col * (cardW + GAP), cy = y + row * (cardH + GAP)
    doc.setFillColor(241, 245, 249)
    doc.rect(cx, cy, cardW, cardH, 'F')
    doc.setTextColor(...DARK)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(String(cards[i].value), cx + cardW / 2, cy + 9, { align: 'center' })
    doc.setTextColor(...MID)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.text(cards[i].label, cx + cardW / 2, cy + 15, { align: 'center' })
  }
  y += 2 * (cardH + GAP) + 2

  // Domain readiness table
  y = legacyCheckPage(doc, y, 30)
  y = legacySectionBar(doc, y, 'Domain Readiness')
  const rdBody = readinessData.map(d => {
    const pct = d.total ? Math.round((d.inPlace / d.total) * 100) : 0
    return [d.fullName ?? d.name, d.inPlace, d.inProgress, d.notInPlace, d.total, `${pct}%`, '']
  })
  autoTable(doc, {
    startY: y,
    margin: { left: LEGACY_ML, right: LEGACY_ML, top: 14, bottom: 12 },
    head: [['Domain', 'In Place', 'In Progress', 'Not In Place', 'Total', '% Complete', 'Coverage']],
    body: rdBody,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248,250,252] },
    columnStyles: {
      0: { cellWidth: 65 }, 1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 24, halign: 'center' }, 3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' }, 5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 94 },
    },
    didParseCell(data) {
      if (data.section !== 'body') return
      if (data.column.index === 1) { data.cell.styles.textColor = GREEN; data.cell.styles.fontStyle = 'bold' }
      if (data.column.index === 2) { data.cell.styles.textColor = AMBER; data.cell.styles.fontStyle = 'bold' }
      if (data.column.index === 3) { data.cell.styles.textColor = RED;   data.cell.styles.fontStyle = 'bold' }
    },
    didDrawCell(data) {
      if (data.section !== 'body' || data.column.index !== 6) return
      const d = readinessData[data.row.index]
      if (!d || !d.total) return
      const frac = d.inPlace / d.total
      const bx = data.cell.x + 3, by = data.cell.y + (data.cell.height - 4) / 2, bw = data.cell.width - 6
      doc.setFillColor(...LEGACY_LTGREY)
      doc.rect(bx, by, bw, 4, 'F')
      if (frac > 0) {
        doc.setFillColor(...legacyHex(legacyDomainColour(d.fullName ?? d.name)))
        doc.rect(bx, by, bw * frac, 4, 'F')
      }
    },
  })
  y = doc.lastAutoTable.finalY + 3

  // Reviews (overdue + 28 days only)
  y = legacyCheckPage(doc, y, 20)
  y = legacySectionBar(doc, y, 'Upcoming Reviews')
  const today = new Date()
  const filteredReviews = upcomingReviews.filter(ev => {
    const d = Math.ceil((new Date(ev.next_review_due) - today) / 86400000)
    return d < 0 || d <= 28
  })
  if (filteredReviews.length === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No reviews overdue or due in the next 28 days.', LEGACY_ML, y + 7)
    y += 14
  } else {
    const rvBody = filteredReviews.map(ev => [
      ev.provision_name || ev.entryLabel || '—',
      ev.domainName || '—',
      ev.next_review_due ? new Date(ev.next_review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
      ev.daysLeft < 0 ? 'Overdue' : `${ev.daysLeft}d`,
    ])
    autoTable(doc, {
      startY: y,
      margin: { left: LEGACY_ML, right: LEGACY_ML, top: 14, bottom: 12 },
      head: [['Provision / Entry', 'Domain', 'Review Due', 'Days Remaining']],
      body: rvBody,
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,250,252] },
      columnStyles: {
        0: { cellWidth: 110 }, 1: { cellWidth: 70 }, 2: { cellWidth: 50 }, 3: { cellWidth: 39, halign: 'center' },
      },
      didParseCell(data) {
        if (data.section !== 'body' || data.column.index !== 3) return
        const ev = filteredReviews[data.row.index]
        if (!ev) return
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = ev.daysLeft < 0 ? RED : AMBER
      },
    })
    y = doc.lastAutoTable.finalY + 3
  }

  // Funding
  if (includeFunding && totalCost > 0) {
    y = legacyCheckPage(doc, y, 30)
    y = legacySectionBar(doc, y, 'Funding & Cost')
    y += 3
    const equitySpend = fundingDomainData.find(d => d.fullName?.includes('Equity'))?.value ?? 0
    const sendSpend   = fundingDomainData.find(d => d.fullName?.includes('SEND'))?.value   ?? 0
    const perPupil    = schoolCtx.totalPupils ? Math.round(totalCost   / schoolCtx.totalPupils) : null
    const perPP       = schoolCtx.ppCount     ? Math.round(equitySpend / schoolCtx.ppCount)     : null
    const perSEND     = schoolCtx.sendCount   ? Math.round(sendSpend   / schoolCtx.sendCount)   : null
    const fCards = [
      { label: 'Total Spend',    value: `£${totalCost.toLocaleString()}` },
      { label: 'Per Pupil',      value: perPupil ? `£${perPupil.toLocaleString()}`  : '—' },
      { label: 'Per PP Pupil',   value: perPP    ? `£${perPP.toLocaleString()}`     : '—' },
      { label: 'Per SEND Pupil', value: perSEND  ? `£${perSEND.toLocaleString()}`   : '—' },
    ]
    const fcardW = (LEGACY_CW - GAP * (COLS - 1)) / COLS, fcardH = 16
    for (let i = 0; i < fCards.length; i++) {
      const cx = LEGACY_ML + i * (fcardW + GAP)
      doc.setFillColor(241, 245, 249)
      doc.rect(cx, y, fcardW, fcardH, 'F')
      doc.setTextColor(...DARK)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(fCards[i].value, cx + fcardW / 2, y + 8, { align: 'center' })
      doc.setTextColor(...MID)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(fCards[i].label, cx + fcardW / 2, y + 13.5, { align: 'center' })
    }
    y += fcardH + 5
    const fsBody = fundingSourceData.map(fs => [fs.name, `£${fs.value.toLocaleString()}`, `${totalCost ? Math.round(fs.value/totalCost*100) : 0}%`])
    autoTable(doc, {
      startY: y, margin: { left: LEGACY_ML, right: LEGACY_ML, top: 14, bottom: 12 },
      head: [['Funding Stream', 'Total Spend', '% of Total']], body: fsBody,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,250,252] },
      columnStyles: { 0: { cellWidth: 180 }, 1: { cellWidth: 55, halign: 'right' }, 2: { cellWidth: 34, halign: 'center' } },
    })
    y = doc.lastAutoTable.finalY + 3
  }

  // Outcomes
  if (includeOutcomes) {
    const rawItems = allEvidence
      .filter(ev => ev.intended_outcomes || ev.impact_on_outcomes)
      .map(ev => ({
        name:     ev.provision_name || ev.entryLabel || '—',
        domain:   ev.domainName    || 'Other',
        intended: ev.intended_outcomes  || '',
        impact:   ev.impact_on_outcomes || '',
      }))
    let filtered2 = rawItems
    if (outcomeMode === 'domain' && outcomeSelected.length > 0)
      filtered2 = rawItems.filter(i => outcomeSelected.includes(i.domain))
    y = legacyCheckPage(doc, y, 30)
    y = legacySectionBar(doc, y, 'Outcomes & Impact')
    if (filtered2.length === 0) {
      doc.setTextColor(...MID); doc.setFontSize(8); doc.setFont('helvetica', 'italic')
      doc.text('No outcomes match the current filter.', LEGACY_ML, y + 7)
      y += 14
    } else {
      const body = filtered2.map(item => [item.name, item.domain, item.intended || '—', item.impact || '—'])
      autoTable(doc, {
        startY: y, margin: { left: LEGACY_ML, right: LEGACY_ML, top: 14, bottom: 12 },
        head: [['Entry / Provision', 'Domain', 'Intended Outcome', 'Evidence of Impact']], body,
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248,250,252] },
        columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 40 }, 2: { cellWidth: 87 }, 3: { cellWidth: 87 } },
      })
      y = doc.lastAutoTable.finalY + 3
    }
  }

  legacyApplyHF(doc, schoolName || 'School', dateStr)
  doc.save(`Inclusion_Evidence_Report_${safeName}_${ay.replace('/', '-')}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────
// LEGACY — generateInclusionStrategy (DfE-principle based, with fixes)
// ─────────────────────────────────────────────────────────────────────
const IS_GREEN = [37, 122, 59]
const IS_AMBER = [212, 117, 26]

function isStatusColour(s) {
  if (s === 'in_place')    return IS_GREEN
  if (s === 'in_progress') return IS_AMBER
  return RED
}
function isStatusLabel(s) {
  if (s === 'in_place')    return 'In Place'
  if (s === 'in_progress') return 'In Progress'
  return 'Not In Place'
}

const BARRIER_GROUP_KEYS = [
  { key: 'send', label: 'SEND' },
  { key: 'pp',   label: 'Pupil Premium' },
  { key: 'eal',  label: 'EAL' },
  { key: 'fsm',  label: 'FSM' },
  { key: 'lac',  label: 'LAC' },
  { key: 'wwc',  label: 'White Working Class' },
]

function applyStrategyHeadersFooters(doc, schoolName, ay) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    if (i === 1) continue
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, 210, 10, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(schoolName, 14, 6.5)
    doc.setFont('helvetica', 'normal')
    doc.text(`Inclusion Strategy Statement ${ay}`, 196, 6.5, { align: 'right' })
    doc.setFillColor(...NAVY)
    doc.rect(0, 287, 210, 10, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(7)
    doc.text('Inclusion Dashboard · inclusiondashboard.co.uk', 14, 293)
    doc.text(`Page ${i} of ${n}`, 196, 293, { align: 'right' })
  }
}

export function generateInclusionStrategy({ schoolName = '', allEntries = [], activePPs = [], barriers = [] }) {
  const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dateStr  = fmt()
  const ay       = academicYear()
  const safeName = (schoolName || 'School').replace(/[^a-z0-9]/gi, '_')
  const ML_P = 14, MAX_YP = 275, CW_P = 182

  const totalBarriers = barriers.length

  // Cover page
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text('Inclusion Strategy Statement', 105, 110, { align: 'center' })
  doc.setFontSize(20)
  doc.text(ay, 105, 125, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.text(schoolName || 'School', 105, 150, { align: 'center' })
  doc.setFontSize(10)
  doc.setTextColor(180, 200, 220)
  doc.text(`Generated ${dateStr}`, 105, 165, { align: 'center' })
  if (totalBarriers > 0) {
    doc.setFontSize(9)
    doc.setTextColor(254, 243, 199)
    doc.text(`Barriers identified: ${totalBarriers}`, 105, 178, { align: 'center' })
  }
  doc.setFontSize(8)
  doc.setTextColor(180, 200, 220)
  doc.text('Based on the DfE 7 Principles of Inclusion', 105, 280, { align: 'center' })

  const entryMap = {}
  for (const e of allEntries) entryMap[e.provision_point_id] = e

  const domainToPrinciples = {}
  for (const pp of activePPs) {
    const domName = pp.sub_domains?.domains?.name
    if (!domName || !pp.principle) continue
    if (!domainToPrinciples[domName]) domainToPrinciples[domName] = new Set()
    domainToPrinciples[domName].add(pp.principle)
  }

  const principleBarriers = {}
  for (const b of barriers) {
    const domName = b.domains?.name
    if (!domName) continue
    const principles = domainToPrinciples[domName]
    if (!principles) continue
    for (const p of principles) {
      if (!principleBarriers[p]) principleBarriers[p] = []
      principleBarriers[p].push(b)
    }
  }

  for (const principle of DFE_PRINCIPLES) {
    const pps = activePPs
      .filter(pp => pp.principle === principle)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))

    const included = pps.filter(pp => {
      const e = entryMap[pp.id]
      return e && (e.status === 'in_place' || e.status === 'in_progress')
    })

    const inPlaceCount  = pps.filter(pp => entryMap[pp.id]?.status === 'in_place').length
    const prinBarriers  = principleBarriers[principle] ?? []

    doc.addPage()
    let y = 14

    doc.setFillColor(...NAVY)
    doc.rect(0, y, 210, 12, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(principle, ML_P, y + 8)
    y += 12

    const subText = prinBarriers.length > 0
      ? `${inPlaceCount} of ${pps.length} provision points in place · ${prinBarriers.length} barrier${prinBarriers.length === 1 ? '' : 's'} identified`
      : `${inPlaceCount} of ${pps.length} provision points in place`
    doc.setFillColor(240, 244, 248)
    doc.rect(0, y, 210, 9, 'F')
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(subText, ML_P, y + 6)
    y += 9 + 6

    if (prinBarriers.length > 0) {
      doc.setFillColor(254, 243, 199)
      doc.rect(ML_P, y, CW_P, 8, 'F')
      doc.setFillColor(212, 117, 26)
      doc.rect(ML_P, y, 4, 8, 'F')
      doc.setTextColor(122, 74, 10)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('IDENTIFIED BARRIERS', ML_P + 7, y + 5.5)
      y += 8 + 3

      for (let bi = 0; bi < prinBarriers.length; bi++) {
        const b = prinBarriers[bi]
        const descLines  = doc.splitTextToSize(b.description ?? '', CW_P - 4).length
        const hasActions = b.actions && b.actions.trim()
        const actLines   = hasActions ? doc.splitTextToSize(`Actions: ${b.actions}`, CW_P - 4).length : 0
        const rowH = descLines * 4.5 + 5 + 5 + (hasActions ? actLines * 4 + 3 : 0) + 4

        if (y + rowH > MAX_YP) {
          doc.addPage(); y = 14
          doc.setFillColor(...NAVY); doc.rect(0, 0, 210, 10, 'F')
          doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
          doc.text(`${principle} (continued)`, ML_P, 6.5); y = 14
        }

        const descWrapped = doc.splitTextToSize(b.description ?? '', CW_P - 4)
        doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
        doc.text(descWrapped, ML_P + 2, y + 4.5)
        y += descWrapped.length * 4.5 + 2

        const domLabel = b.sub_domains?.name
          ? `${b.domains?.name ?? ''} — ${b.sub_domains.name}`
          : (b.domains?.name ?? '')
        doc.setTextColor(107, 114, 128); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
        doc.text(domLabel, ML_P + 2, y + 4); y += 5

        let tagX = ML_P + 2
        const isActive = b.status === 'active'
        const statusBg  = isActive ? [254, 226, 226] : [254, 243, 199]
        const statusFg  = isActive ? [153, 27, 27]   : [146, 64, 14]
        const statusTxt = isActive ? 'Active' : 'Being addressed'
        const statusW   = doc.getTextWidth(statusTxt) + 4
        doc.setFillColor(...statusBg); doc.roundedRect(tagX, y, statusW, 5, 1, 1, 'F')
        doc.setTextColor(...statusFg); doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
        doc.text(statusTxt, tagX + 2, y + 3.5); tagX += statusW + 2

        if (b.scale) {
          const scaleLabels = { individual: 'Individual', group: 'Group', whole_school: 'Whole school' }
          const scaleTxt = scaleLabels[b.scale] ?? b.scale
          const scaleW = doc.getTextWidth(scaleTxt) + 4
          doc.setFillColor(243, 244, 246); doc.roundedRect(tagX, y, scaleW, 5, 1, 1, 'F')
          doc.setTextColor(55, 65, 81); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
          doc.text(scaleTxt, tagX + 2, y + 3.5); tagX += scaleW + 2
        }

        const activeGroups = BARRIER_GROUP_KEYS.filter(g => b.student_groups?.[g.key])
        for (const grp of activeGroups) {
          const grpW = doc.getTextWidth(grp.label) + 4
          if (tagX + grpW > ML_P + CW_P - 2) break
          doc.setFillColor(219, 234, 254); doc.roundedRect(tagX, y, grpW, 5, 1, 1, 'F')
          doc.setTextColor(30, 64, 175); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
          doc.text(grp.label, tagX + 2, y + 3.5); tagX += grpW + 2
        }
        y += 6

        if (hasActions) {
          const actionLines = doc.splitTextToSize(`Actions: ${b.actions}`, CW_P - 4)
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(55, 65, 81)
          doc.text('Actions:', ML_P + 2, y + 3.5)
          const prefixW = doc.getTextWidth('Actions: ')
          doc.setFont('helvetica', 'normal')
          doc.text(actionLines[0].replace(/^Actions:\s*/, ''), ML_P + 2 + prefixW, y + 3.5)
          if (actionLines.length > 1) {
            doc.text(actionLines.slice(1), ML_P + 2, y + 3.5 + 4); y += (actionLines.length - 1) * 4
          }
          y += 5
        }

        if (bi < prinBarriers.length - 1) {
          doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.5)
          doc.line(ML_P, y, ML_P + CW_P, y); y += 3
        }
      }
      y += 5
    }

    if (included.length === 0) {
      doc.setTextColor(...MID); doc.setFontSize(9)
      doc.text('No provision points currently in place or in progress for this principle.', ML_P, y)
      continue
    }

    for (const pp of included) {
      const entry  = entryMap[pp.id]
      const status = entry?.status ?? 'not_in_place'
      const what   = entry?.what ?? ''
      const notes  = entry?.evidence_notes ?? ''
      const label  = pp.label ?? ''

      const whatLines  = what  ? doc.splitTextToSize(what,  CW_P - 30).length : 0
      const notesLines = notes ? doc.splitTextToSize(notes, CW_P - 30).length : 0
      const rowH = 8 + (whatLines + notesLines) * 4.5 + (notes ? 5 : 0) + 6

      if (y + rowH > MAX_YP) {
        doc.addPage(); y = 14
        doc.setFillColor(...NAVY); doc.rect(0, 0, 210, 10, 'F')
        doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
        doc.text(`${principle} (continued)`, ML_P, 6.5); y = 14
      }

      doc.setFillColor(248, 250, 252)
      doc.rect(ML_P, y, CW_P, rowH - 2, 'F')

      const col = isStatusColour(status)
      doc.setFillColor(...col)
      doc.roundedRect(ML_P, y + 1.5, 22, 5.5, 1.5, 1.5, 'F')
      doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
      doc.text(isStatusLabel(status), ML_P + 11, y + 5, { align: 'center' })

      doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
      doc.text(label, ML_P + 26, y + 5.5)
      y += 9

      if (what) {
        const lines = doc.splitTextToSize(what, CW_P - 30)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK)
        doc.text(lines, ML_P + 26, y); y += lines.length * 4.5
      }
      if (notes) {
        y += 3
        const noteLines = doc.splitTextToSize(`Evidence: ${notes}`, CW_P - 30)
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...MID)
        doc.text(noteLines, ML_P + 26, y); y += noteLines.length * 4.5
      }
      y += 4
    }
  }

  applyStrategyHeadersFooters(doc, schoolName || 'School', ay)
  doc.save(`Inclusion_Strategy_Statement_${safeName}_${ay.replace('/', '-')}.pdf`)
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
