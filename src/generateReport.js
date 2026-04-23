import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Palette (jsPDF uses [r,g,b] arrays) ──────────────────────────────
const NAVY   = [30,  58,  95]
const TEAL   = [0,   105, 105]
const GREEN  = [22,  163, 74]
const AMBER  = [217, 119, 6]
const RED    = [220, 38,  38]
const GREY   = [248, 250, 252]
const INDIGO = [99,  102, 241]
const WHITE  = [255, 255, 255]
const DARK   = [30,  41,  59]
const MID    = [100, 116, 139]
const LTGREY = [229, 231, 235]

const A_GROUPS = [
  { key: 'grp_pp',   label: 'Pupil Premium' },
  { key: 'grp_send', label: 'SEND' },
  { key: 'grp_fsm',  label: 'FSM' },
  { key: 'grp_eal',  label: 'EAL' },
  { key: 'grp_lac',  label: 'LAC' },
  { key: 'grp_wwc',  label: 'White Working Class' },
]

// ── Tiny helpers ──────────────────────────────────────────────────────
function hexRgb(hex) {
  const h = (hex || '#94a3b8').replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function fmt(d = new Date()) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function academicYear() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return m >= 7 ? `${y}/${String(y+1).slice(2)}` : `${y-1}/${String(y).slice(2)}`
}

// ── Section bar: full-width teal band with white label ────────────────
function sectionBar(doc, y, label) {
  doc.setFillColor(...TEAL)
  doc.rect(0, y, 297, 7, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(label.toUpperCase(), 14, y + 4.8)
  return y + 7
}

// ── Per-page headers + footers (call after all pages are built) ───────
function applyHeadersFooters(doc, schoolName, dateStr) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    // header
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, 297, 12, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(schoolName, 14, 8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Inclusion Framework Report | ${dateStr}`, 283, 8, { align: 'right' })
    // footer
    doc.setFillColor(...NAVY)
    doc.rect(0, 200, 297, 10, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(7.5)
    doc.text('Every Child Achieving and Thriving — Inclusion Framework Dashboard', 14, 206)
    doc.text(`Page ${i} of ${n}`, 283, 206, { align: 'right' })
  }
}

// ── Page 1 ────────────────────────────────────────────────────────────
function drawPage1(doc, { schoolCtx, readinessData, upcomingReviews }) {
  const ML = 14
  const CW = 269

  const grandTotal   = readinessData.reduce((s, d) => s + d.total,   0)
  const grandInPlace = readinessData.reduce((s, d) => s + d.inPlace, 0)
  const overallPct   = grandTotal ? Math.round((grandInPlace / grandTotal) * 100) : 0

  let y = 14

  // ── School context ──────────────────────────────────────────────────
  y = sectionBar(doc, y, 'School Context')
  y += 3

  const cards = [
    { label: 'Total Pupils',        value: schoolCtx.totalPupils || '—' },
    { label: 'Pupil Premium',       value: schoolCtx.ppCount     || '—' },
    { label: 'SEND',                value: schoolCtx.sendCount   || '—' },
    { label: 'FSM',                 value: schoolCtx.fsmCount    || '—' },
    { label: 'EAL',                 value: schoolCtx.ealCount    || '—' },
    { label: 'LAC',                 value: schoolCtx.lacCount    || '—' },
    { label: 'White Working Class', value: schoolCtx.wwcCount    || '—' },
    { label: 'Overall Readiness',   value: `${overallPct}%` },
  ]

  const GAP    = 3
  const COLS   = 4
  const cardW  = (CW - GAP * (COLS - 1)) / COLS  // ≈ 65.25
  const cardH  = 18

  for (let i = 0; i < cards.length; i++) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const cx  = ML + col * (cardW + GAP)
    const cy  = y  + row * (cardH + GAP)

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

  // ── Domain readiness ────────────────────────────────────────────────
  y = sectionBar(doc, y, 'Domain Readiness')

  const rdBody = readinessData.map(d => {
    const pct = d.total ? Math.round((d.inPlace / d.total) * 100) : 0
    return [d.fullName, d.inPlace, d.inProgress, d.notInPlace, d.total, `${pct}%`, '']
  })

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: ML, top: 14, bottom: 12 },
    head: [['Domain', 'In Place', 'In Progress', 'Not In Place', 'Total', '% Complete', 'Coverage']],
    body: rdBody,
    styles:            { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles:{ fillColor: GREY },
    columnStyles: {
      0: { cellWidth: 65 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' },
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
      const frac  = d.inPlace / d.total
      const bx    = data.cell.x + 3
      const by    = data.cell.y + (data.cell.height - 4) / 2
      const bw    = data.cell.width - 6
      doc.setFillColor(...LTGREY)
      doc.rect(bx, by, bw, 4, 'F')
      if (frac > 0) {
        doc.setFillColor(...hexRgb(d.colour))
        doc.rect(bx, by, bw * frac, 4, 'F')
      }
    },
  })

  y = doc.lastAutoTable.finalY + 3

  // ── Upcoming reviews ─────────────────────────────────────────────────
  y = sectionBar(doc, y, 'Upcoming Reviews')

  if (upcomingReviews.length === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No reviews due in the next 60 days.', ML, y + 7)
    return
  }

  const rvBody = upcomingReviews.map(ev => [
    ev.provision_name || ev.entryLabel || '—',
    ev.domainName || '—',
    ev.next_review_due
      ? new Date(ev.next_review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    ev.daysLeft <= 0 ? 'Overdue' : `${ev.daysLeft}d`,
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: ML, top: 14, bottom: 12 },
    head: [['Provision / Entry', 'Domain', 'Review Due', 'Days Remaining']],
    body: rvBody,
    styles:            { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5 },
    headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
    alternateRowStyles:{ fillColor: GREY },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 70 },
      2: { cellWidth: 50 },
      3: { cellWidth: 39, halign: 'center' },
    },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index !== 3) return
      const ev = upcomingReviews[data.row.index]
      if (!ev) return
      data.cell.styles.fontStyle = 'bold'
      if      (ev.daysLeft <= 7)  data.cell.styles.textColor = RED
      else if (ev.daysLeft <= 21) data.cell.styles.textColor = AMBER
      else                        data.cell.styles.textColor = GREEN
    },
  })
}

// ── Page 2 ────────────────────────────────────────────────────────────
function drawPage2(doc, { equityData, fundingDomainData, fundingSourceData, totalCost, schoolCtx }) {
  const ML = 14
  const CW = 269

  let y = 14

  // ── Enrichment equity ───────────────────────────────────────────────
  y = sectionBar(doc, y, 'Enrichment Equity')

  const EQ_COLS = ['Pupil Premium', 'SEND', 'FSM', 'White Working Class', 'EAL', 'LAC']

  if (equityData.length === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No enrichment provision data recorded.', ML, y + 7)
    y += 12
  } else {
    const eqBody = equityData.map(sd => {
      const row = [sd.subDomain]
      for (const gl of EQ_COLS) {
        const grp = sd.groups.find(g => g.label === gl)
        row.push(grp ? `${grp.pct}%` : '—')
      }
      return row
    })

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML, top: 14, bottom: 12 },
      head: [['Sub-domain', ...EQ_COLS]],
      body: eqBody,
      styles:            { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5 },
      headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles:{ fillColor: GREY },
      columnStyles: {
        0: { cellWidth: 63 },
        1: { cellWidth: 34, halign: 'center' },
        2: { cellWidth: 34, halign: 'center' },
        3: { cellWidth: 34, halign: 'center' },
        4: { cellWidth: 34, halign: 'center' },
        5: { cellWidth: 34, halign: 'center' },
        6: { cellWidth: 36, halign: 'center' },
      },
      didParseCell(data) {
        if (data.section !== 'body' || data.column.index === 0) return
        const val = parseInt(data.cell.raw)
        if (isNaN(val)) return
        data.cell.styles.fontStyle = 'bold'
        if      (val >= 80) data.cell.styles.textColor = GREEN
        else if (val >= 50) data.cell.styles.textColor = AMBER
        else                data.cell.styles.textColor = RED
      },
    })

    y = doc.lastAutoTable.finalY + 2
    doc.setTextColor(...MID)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.text(
      'Coverage legend:  ≥ 80% = good (green)   |   50–79% = partial (amber)   |   < 50% = low (red)',
      ML, y + 4
    )
    y += 9
  }

  // ── Funding & cost ───────────────────────────────────────────────────
  y = sectionBar(doc, y, 'Funding & Cost')
  y += 3

  if (totalCost === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No cost data recorded yet.', ML, y + 6)
    return
  }

  const equitySpend = fundingDomainData.find(d => d.fullName?.includes('Equity'))?.value ?? 0
  const sendSpend   = fundingDomainData.find(d => d.fullName?.includes('SEND'))?.value   ?? 0
  const perPupil    = schoolCtx.totalPupils ? Math.round(totalCost    / schoolCtx.totalPupils) : null
  const perPP       = schoolCtx.ppCount     ? Math.round(equitySpend  / schoolCtx.ppCount)     : null
  const perSEND     = schoolCtx.sendCount   ? Math.round(sendSpend    / schoolCtx.sendCount)   : null

  // 4 stat cards
  const fCards = [
    { label: 'Total Spend',    value: `£${totalCost.toLocaleString()}` },
    { label: 'Per Pupil',      value: perPupil ? `£${perPupil.toLocaleString()}`  : '—' },
    { label: 'Per PP Pupil',   value: perPP    ? `£${perPP.toLocaleString()}`     : '—' },
    { label: 'Per SEND Pupil', value: perSEND  ? `£${perSEND.toLocaleString()}`   : '—' },
  ]

  const GAP   = 3
  const COLS  = 4
  const cardW = (CW - GAP * (COLS - 1)) / COLS
  const cardH = 16

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

  // Side-by-side: Spend by domain | Funding streams
  const halfW = (CW - 8) / 2  // ~130.5 mm each

  // ── Left: Spend by domain (horizontal bars) ─────────────────────────
  doc.setTextColor(...DARK)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('Spend by Domain', ML, y + 4)
  let ly = y + 8

  const labelW  = 38
  const barAreaW = halfW - labelW - 38  // leave ~38mm right of bar for £ label
  const maxDomVal = Math.max(...fundingDomainData.map(d => d.value), 1)
  const barH  = 5
  const barGap = 3.5

  for (const d of fundingDomainData) {
    const frac = d.value / maxDomVal
    const bx   = ML + labelW
    const [r,g,b] = hexRgb(d.colour)
    doc.setTextColor(...MID)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    const label = d.name || d.fullName || ''
    doc.text(label.length > 14 ? label.slice(0, 13) + '…' : label, ML, ly + barH - 0.5)
    doc.setFillColor(...LTGREY)
    doc.rect(bx, ly, barAreaW, barH, 'F')
    if (frac > 0) {
      doc.setFillColor(r, g, b)
      doc.rect(bx, ly, barAreaW * frac, barH, 'F')
    }
    doc.setTextColor(...DARK)
    doc.setFontSize(6.5)
    doc.text(`£${d.value.toLocaleString()}`, bx + barAreaW + 2, ly + barH - 0.5)
    ly += barH + barGap
  }

  // ── Right: Funding streams (proportional bars) ───────────────────────
  const rx      = ML + halfW + 8
  const barAreaW2 = halfW - 48 - 2
  doc.setTextColor(...DARK)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('Funding Streams', rx, y + 4)
  let ry = y + 8

  for (const fs of fundingSourceData) {
    const frac = totalCost ? fs.value / totalCost : 0
    const pct  = Math.round(frac * 100)
    doc.setTextColor(...MID)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    const lbl = fs.name.length > 14 ? fs.name.slice(0, 13) + '…' : fs.name
    doc.text(lbl, rx, ry + barH - 0.5)
    doc.setFillColor(...LTGREY)
    doc.rect(rx + 42, ry, barAreaW2, barH, 'F')
    if (frac > 0) {
      doc.setFillColor(...INDIGO)
      doc.rect(rx + 42, ry, barAreaW2 * frac, barH, 'F')
    }
    doc.setTextColor(...DARK)
    doc.setFontSize(6.5)
    doc.text(`£${fs.value.toLocaleString()} (${pct}%)`, rx + 42 + barAreaW2 + 2, ry + barH - 0.5)
    ry += barH + barGap
  }
}

// ── Page 3 ────────────────────────────────────────────────────────────
function drawPage3(doc, { allEvidence, domains, filterMode, activeFilter, groupFilters }) {
  const ML = 14
  const CW = 269

  // Normalise mode: 'subdomain' → 'all' for PDF purposes
  const mode = filterMode === 'group' ? 'group' : filterMode === 'domain' ? 'domain' : 'all'

  const allItems = allEvidence
    .filter(ev => ev.intended_outcomes || ev.impact_on_outcomes || ev.evidence_notes)
    .map(ev => ({
      name:     ev.provision_name || ev.entryLabel || '—',
      domain:   ev.domainName     || 'Other',
      groups:   A_GROUPS.filter(g => ev[g.key]).map(g => g.label),
      intended: ev.intended_outcomes  || '',
      impact:   ev.impact_on_outcomes || '',
    }))

  // Apply filter
  let filtered
  if (mode === 'domain' && activeFilter) {
    filtered = allItems.filter(i => i.domain === activeFilter)
  } else if (mode === 'group' && groupFilters?.length > 0) {
    filtered = allItems.filter(i => i.groups.some(g => groupFilters.includes(g)))
  } else {
    filtered = allItems
  }

  const titleSuffix = mode === 'domain' && activeFilter
    ? ` — ${activeFilter}`
    : mode === 'group' && groupFilters?.length > 0
    ? ` — ${groupFilters.join(', ')}`
    : ' — All'

  let y = 14
  y = sectionBar(doc, y, `Outcomes & Impact${titleSuffix}`)

  if (filtered.length === 0) {
    doc.setTextColor(...MID)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No outcomes match the current filter.', ML, y + 7)
    return
  }

  if (mode === 'group') {
    // Flat table — domain shown as extra column
    const body = filtered.map(item => [
      item.name + (item.groups.length ? `\n[${item.groups.join(', ')}]` : ''),
      item.domain,
      item.intended || '—',
      item.impact   || '—',
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML, top: 14, bottom: 12 },
      head: [['Entry / Provision', 'Domain', 'Intended Outcome', 'Evidence of Impact']],
      body,
      styles:            { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles:{ fillColor: GREY },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 40 },
        2: { cellWidth: 87 },
        3: { cellWidth: 87 },
      },
    })
  } else {
    // Domain/all mode — teal sub-header rows per domain
    const domainOrder = domains.map(d => d.name)
    const byDomain = {}
    for (const item of filtered) {
      ;(byDomain[item.domain] = byDomain[item.domain] ?? []).push(item)
    }
    const orderedKeys = [
      ...domainOrder.filter(n => byDomain[n]),
      ...Object.keys(byDomain).filter(n => !domainOrder.includes(n)),
    ]

    const body = []
    for (const domainName of orderedKeys) {
      const items = byDomain[domainName]
      // Teal sub-header spanning all 3 cols
      body.push([{
        content:  domainName,
        colSpan:  3,
        styles: { fillColor: TEAL, textColor: WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
      }])
      for (const item of items) {
        const groupTag = item.groups.length ? `\n[${item.groups.join(', ')}]` : ''
        body.push([
          { content: item.name + groupTag, styles: { fontSize: 7.5 } },
          { content: item.intended || '—', styles: { fontSize: 7.5 } },
          { content: item.impact   || '—', styles: { fontSize: 7.5 } },
        ])
      }
    }

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML, top: 14, bottom: 12 },
      head: [['Entry / Provision', 'Intended Outcome', 'Evidence of Impact']],
      body,
      styles:            { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles:        { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles:{ fillColor: GREY },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 99.5 },
        2: { cellWidth: 99.5 },
      },
    })
  }
}

// ── Public API ────────────────────────────────────────────────────────
export function generateReport({
  schoolCtx,
  readinessData,
  upcomingReviews,
  equityData,
  fundingSourceData,
  fundingDomainData,
  totalCost,
  allEvidence,
  domains,
  filterMode,
  activeFilter,
  groupFilters,
  schoolName = '',
}) {
  const doc     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const dateStr = fmt()
  const ay      = academicYear()
  const safeName = (schoolName || 'School').replace(/[^a-z0-9]/gi, '_')

  drawPage1(doc, { schoolCtx, readinessData, upcomingReviews })

  doc.addPage()
  drawPage2(doc, { equityData, fundingDomainData, fundingSourceData, totalCost, schoolCtx })

  doc.addPage()
  drawPage3(doc, { allEvidence, domains, filterMode, activeFilter, groupFilters })

  applyHeadersFooters(doc, schoolName || 'School', dateStr)

  doc.save(`Inclusion_Report_${safeName}_${ay.replace('/', '-')}.pdf`)
}
