import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle,
} from 'docx'

import {
  // shared data layer (Session 56/57) — same filtering/aggregation as the PDF
  getReadinessData,
  getShowSections,
  getSchoolContextSectionData,
  getBarriersSectionData,
  getDomainReadinessSectionData,
  getFundingSectionData,
  getProvisionSectionData,
  getProvisionByDomainData,
  getProvisionByPrincipleData,
  getEnrichmentEquityData,
  provisionRowData,
  getReviewsSectionData,
  getAppendixASectionData,
  getAppendixBSectionData,
  // shared brand/RAG colours + small presentational helpers — same values as the PDF
  NAVY, DARK, MID, GREEN, AMBER, RED, GREY, LTGREY,
  domainColour,
  statusLabel,
  fmt,
  academicYear,
  DFE_PRINCIPLES,
} from './generateReport'

// ── Colour helpers ───────────────────────────────────────────────────
// docx wants hex strings with no '#'. The PDF's colours are either [r,g,b]
// arrays or '#rrggbb' strings (domainColour) — normalise both to the same form.
function hex(colour) {
  if (Array.isArray(colour)) {
    return colour.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()
  }
  return String(colour).replace('#', '').toUpperCase()
}

const BORDER = { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }

function statusColourHex(status) {
  if (status === 'in_place')    return hex(GREEN)
  if (status === 'in_progress') return hex(AMBER)
  return hex(RED)
}

// Barrier status colour — matches drawBarriers' didParseCell exactly:
// active=red, being_addressed=amber, resolved=green.
function barrierStatusColourHex(rawStatus) {
  if (rawStatus === 'active')          return hex(RED)
  if (rawStatus === 'being_addressed') return hex(AMBER)
  if (rawStatus === 'resolved')        return hex(GREEN)
  return undefined
}

// ── Small building blocks ────────────────────────────────────────────

// Full-width navy (or domain-coloured) heading bar — the Word equivalent of
// the PDF's sectionBar()/domainBar() jsPDF-drawn rectangles.
function bar(text, fill = hex(NAVY), size = 20) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill },
    spacing: { before: 200, after: 120 },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, color: 'FFFFFF', size }),
    ],
  })
}

function italicNote(text) {
  return new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text, italics: true, color: hex(MID) })] })
}

function boldNote(text, colour = DARK) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, bold: true, color: hex(colour) })] })
}

function bullet(text, colour = DARK) {
  return new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text, color: hex(colour) })] })
}

function cell(text, { fill, color, bold, width, align } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    borders: CELL_BORDERS,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text: String(text ?? ''), bold, color: color ? hex(color) : undefined })],
    })],
  })
}

// Generic table: headerLabels (strings), bodyRows (array of row-cell-spec arrays,
// each cell either a plain string or { text, color, bold, align } for per-cell
// styling), optional colWidths (percentages summing to ~100).
function table(headerLabels, bodyRows, colWidths) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headerLabels.map((label, i) => cell(label, {
      fill: hex(NAVY), color: [255, 255, 255], bold: true, width: colWidths?.[i],
    })),
  })

  const rows = bodyRows.map((row, ri) => new TableRow({
    children: row.map((c, ci) => {
      const spec = typeof c === 'object' && c !== null ? c : { text: c }
      return cell(spec.text, {
        fill: ri % 2 === 1 ? hex(GREY) : undefined,
        color: spec.color, bold: spec.bold, align: spec.align,
        width: colWidths?.[ci],
      })
    }),
  }))

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] })
}

// Proportional readiness "bar" — a 2-cell nested table (filled/unfilled) approximating
// the PDF's coloured-rectangle progress bar, per the brief's "shaded cells" guidance.
function readinessBarCell(pct, fillHex, width) {
  const filled = Math.max(0, Math.min(100, pct))
  const inner = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: filled, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: fillHex },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          children: [new Paragraph('')],
        }),
        new TableCell({
          width: { size: 100 - filled, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(LTGREY) },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          children: [new Paragraph('')],
        }),
      ],
    })],
  })
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    borders: CELL_BORDERS,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [inner],
  })
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 1 — School Context
// ─────────────────────────────────────────────────────────────────────
function writeSchoolContextWord({ schoolCtx, readinessData, selectedDomains }) {
  const { ay, cards, readinessLabel } = getSchoolContextSectionData({ schoolCtx, readinessData, selectedDomains })

  const children = [bar('1 — School Context')]
  children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `Cohort Profile ${ay}`, bold: true, color: hex(MID), size: 16 })] }))

  // Cohort cards as a 2-column label/value table (Word equivalent of the PDF's card grid)
  const cardRows = []
  for (let i = 0; i < cards.length; i += 2) {
    const a = cards[i], b = cards[i + 1]
    cardRows.push([
      { text: a.label, bold: true }, { text: String(a.value) },
      b ? { text: b.label, bold: true } : '', b ? { text: String(b.value) } : '',
    ])
  }
  children.push(table(['Group', 'Count', 'Group', 'Count'], cardRows, [25, 25, 25, 25]))
  children.push(boldNote(readinessLabel))

  return children
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 2 — Identified Barriers
// ─────────────────────────────────────────────────────────────────────
function writeBarriersWord({ barriers, selectedDomains, selectedGroups }) {
  const { filtered, rows } = getBarriersSectionData({ barriers, selectedDomains, selectedGroups })
  const children = [bar('2 — Identified Barriers')]

  if (filtered.length === 0) {
    children.push(italicNote('No barriers currently recorded.'))
    return children
  }

  const body = rows.map(r => [
    r.description, r.domLabel, r.groups, r.scale, r.source,
    { text: r.status, bold: true, color: barrierStatusColourHex(r.barrier.status) },
    r.actions, r.nextReviewDue,
  ])
  children.push(table(
    ['Description', 'Domain', 'Groups', 'Scale', 'Source', 'Status', 'Actions', 'Next Review'],
    body,
    [17, 13, 10, 8, 9, 9, 22, 12],
  ))
  return children
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 3 — Domain Readiness Summary
// ─────────────────────────────────────────────────────────────────────
function writeDomainReadinessWord({ readinessData, selectedDomains }) {
  const { rows, gaps, inDev } = getDomainReadinessSectionData({ readinessData, selectedDomains })
  const children = [bar('3 — Domain Readiness Summary')]

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell('Domain', { fill: hex(NAVY), color: [255, 255, 255], bold: true, width: 28 }),
      cell('In Place', { fill: hex(NAVY), color: [255, 255, 255], bold: true, width: 10 }),
      cell('In Progress', { fill: hex(NAVY), color: [255, 255, 255], bold: true, width: 10 }),
      cell('Not In Place', { fill: hex(NAVY), color: [255, 255, 255], bold: true, width: 12 }),
      cell('Total', { fill: hex(NAVY), color: [255, 255, 255], bold: true, width: 8 }),
      cell('% Ready', { fill: hex(NAVY), color: [255, 255, 255], bold: true, width: 10 }),
      cell('Bar', { fill: hex(NAVY), color: [255, 255, 255], bold: true, width: 22 }),
    ],
  })
  const bodyRows = rows.map((d, i) => new TableRow({
    children: [
      cell(d.name, { fill: i % 2 === 1 ? hex(GREY) : undefined, width: 28 }),
      cell(d.inPlace, { fill: i % 2 === 1 ? hex(GREY) : undefined, color: GREEN, bold: true, width: 10, align: AlignmentType.CENTER }),
      cell(d.inProgress, { fill: i % 2 === 1 ? hex(GREY) : undefined, color: AMBER, bold: true, width: 10, align: AlignmentType.CENTER }),
      cell(d.notInPlace, { fill: i % 2 === 1 ? hex(GREY) : undefined, color: RED, bold: true, width: 12, align: AlignmentType.CENTER }),
      cell(d.total, { fill: i % 2 === 1 ? hex(GREY) : undefined, width: 8, align: AlignmentType.CENTER }),
      cell(`${d.pct}%`, { fill: i % 2 === 1 ? hex(GREY) : undefined, width: 10, align: AlignmentType.CENTER }),
      readinessBarCell(d.pct, hex(domainColour(d.name)), 22),
    ],
  }))
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }))

  if (gaps.length > 0) {
    children.push(boldNote('Compliance Gaps — Not In Place:', RED))
    for (const d of gaps) {
      children.push(bullet(`${d.name}: ${d.notInPlace} provision point${d.notInPlace !== 1 ? 's' : ''} not in place`))
    }
  }
  if (inDev.length > 0) {
    children.push(boldNote('In Development:', AMBER))
    for (const d of inDev) {
      children.push(bullet(`${d.name}: ${d.inProgress} provision point${d.inProgress !== 1 ? 's' : ''} in progress`))
    }
  }

  return children
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 4 — Funding & Cost
// ─────────────────────────────────────────────────────────────────────
function writeFundingWord({ entries, selectedDomains, schoolCtx }) {
  const { totalCost, fCards, streamRows, domainRows } = getFundingSectionData({ entries, selectedDomains, schoolCtx })
  const children = [bar('4 — Funding & Cost')]

  if (totalCost === 0) {
    children.push(italicNote('No cost data recorded yet.'))
    return children
  }

  children.push(table(
    fCards.map(c => c.label),
    [fCards.map(c => ({ text: c.value, bold: true }))],
    fCards.map(() => Math.floor(100 / fCards.length)),
  ))

  children.push(new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: 'Funding Streams', bold: true, size: 18 })] }))
  children.push(table(
    ['Funding Stream', 'Total Spend', '% of Total'],
    streamRows.map(r => [r.name, `£${r.value.toLocaleString()}`, `${r.pctOfTotal}%`]),
    [55, 25, 20],
  ))

  if (domainRows.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 160, after: 60 },
      children: [new TextRun({ text: selectedDomains.length > 0 ? 'Spend (selected domains)' : 'Spend by Domain', bold: true, size: 18 })],
    }))
    children.push(table(['Domain', 'Spend'], domainRows.map(r => [r.name, `£${r.value.toLocaleString()}`]), [65, 35]))
  }

  return children
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 5 — Provision in Place
// ─────────────────────────────────────────────────────────────────────
function provisionTableRows(entriesSlice) {
  return entriesSlice.map(e => {
    const [label, status, type, groups, intended] = provisionRowData(e)
    return [
      label,
      { text: status, bold: true, color: statusColourHex(e.status) },
      type, groups, intended,
    ]
  })
}

function writeEnrichmentEquityWord(entriesSlice) {
  const { groups, rows } = getEnrichmentEquityData(entriesSlice)
  if (rows.length === 0) return []
  const children = [
    new Paragraph({ spacing: { before: 80, after: 60 }, children: [new TextRun({ text: 'Group coverage by enrichment sub-domain (% of provision points):', italics: true, color: hex(MID), size: 16 })] }),
  ]
  const body = rows.map(r => r.values.map(v => ({
    text: `${v}%`,
    bold: true,
    color: v >= 80 ? GREEN : v >= 50 ? AMBER : RED,
  })))
  const withNames = rows.map((r, i) => [r.sdName, ...body[i]])
  children.push(table(['Sub-domain', ...groups], withNames, [20, ...groups.map(() => Math.floor(80 / groups.length))]))
  return children
}

function writeProvisionInPlaceWord({ entries, selectedDomains, selectedGroups, provisionView, domainList }) {
  const children = [bar('5 — Provision in Place')]
  const filtered = getProvisionSectionData({ entries, selectedDomains, selectedGroups })

  if (filtered.length === 0) {
    children.push(italicNote('No provision points match the current filter.'))
    return children
  }

  const colWidths = [26, 12, 10, 20, 32]
  const headers = ['Provision', 'Status', 'Type', 'Student Groups', 'Intended Outcome']

  if (provisionView === 'principle') {
    const groups = getProvisionByPrincipleData(filtered)
    for (const { principle, entries: pEntries } of groups) {
      children.push(bar(principle, hex(NAVY), 18))
      children.push(table(headers, provisionTableRows(pEntries), colWidths))
    }
    return children
  }

  const domains = getProvisionByDomainData(filtered, domainList)
  for (const dom of domains) {
    children.push(bar(dom.name, hex(domainColour(dom.name)), 18))

    if (dom.name.includes('Enrichment')) {
      const enrichAll = dom.subDomains.flatMap(sd => sd.entries)
      children.push(...writeEnrichmentEquityWord(enrichAll))
    }

    for (const { sdName, entries: sdEntries } of dom.subDomains) {
      children.push(new Paragraph({ spacing: { before: 100, after: 60 }, children: [new TextRun({ text: sdName, bold: true, color: hex(MID), size: 16 })] }))
      children.push(table(headers, provisionTableRows(sdEntries), colWidths))
    }
  }
  return children
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 6 — Reviews (overdue + next 28 days only)
// ─────────────────────────────────────────────────────────────────────
function writeReviewsWord({ entries, selectedDomains }) {
  const reviews = getReviewsSectionData({ entries, selectedDomains })
  const children = [bar('6 — Evaluate & Sustain Reviews')]

  if (reviews.length === 0) {
    children.push(italicNote('No reviews overdue or due in the next 28 days.'))
    return children
  }

  const body = reviews.map(ev => [
    ev.provision,
    ev.domainName,
    new Date(ev.next_review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    {
      text: ev.days_remaining < 0 ? 'Overdue' : `Due in ${ev.days_remaining}d`,
      bold: true,
      color: ev.days_remaining < 0 ? RED : AMBER,
    },
  ])
  children.push(table(['Provision', 'Domain', 'Due Date', 'Status'], body, [40, 30, 18, 12]))
  return children
}

// ─────────────────────────────────────────────────────────────────────
// APPENDIX A — Full Outcomes & Impact
// ─────────────────────────────────────────────────────────────────────
function writeAppendixAWord({ entries, selectedDomains, selectedGroups, domainList }) {
  const { domains } = getAppendixASectionData({ entries, selectedDomains, selectedGroups, domainList })
  const children = [bar('Appendix A — Full Outcomes & Impact')]

  if (domains.length === 0) {
    children.push(italicNote('No outcomes or impact evidence recorded.'))
    return children
  }

  for (const dom of domains) {
    children.push(bar(dom.name, hex(domainColour(dom.name)), 18))
    children.push(table(
      ['Provision', 'Intended Outcome', 'Evidence of Impact'],
      dom.rows.map(r => [r.provision, r.intended, r.impact]),
      [30, 35, 35],
    ))
  }
  return children
}

// ─────────────────────────────────────────────────────────────────────
// APPENDIX B — Full Provision Checklist
// ─────────────────────────────────────────────────────────────────────
function writeAppendixBWord({ entries, domainList }) {
  const { domains } = getAppendixBSectionData({ entries, domainList })
  const children = [bar('Appendix B — Full Provision Checklist')]

  for (const dom of domains) {
    children.push(bar(dom.name, hex(domainColour(dom.name)), 18))
    for (const { sdName, entries: sorted } of dom.subDomains) {
      children.push(new Paragraph({ spacing: { before: 100, after: 60 }, children: [new TextRun({ text: sdName, bold: true, color: hex(MID), size: 16 })] }))
      children.push(table(
        ['Provision', 'Status', 'Type'],
        sorted.map(e => [
          e.provision_points?.label ?? '—',
          { text: statusLabel(e.status), bold: true, color: statusColourHex(e.status) },
          e.provision_points?.universal_or_targeted ?? '—',
        ]),
        [60, 20, 20],
      ))
    }
  }
  return children
}

// ─────────────────────────────────────────────────────────────────────
// Title block — Word equivalent of the PDF's navy cover page. Word has no
// clean way (via the docx library) to give one specific page a full-bleed
// background colour different from the rest of the document, so this is a
// shaded title block at the top of the document rather than a literal
// full-page navy cover — the closest match the format allows.
// ─────────────────────────────────────────────────────────────────────
function writeTitleBlock({ schoolName, purpose, selectedDomains, selectedGroups, domainList, userProfile, dateStr, ay }) {
  const isFullStrategy = purpose === 'full_strategy'
  const titleLine1 = isFullStrategy ? 'Inclusion Strategy Statement' : 'Inclusion Evidence Report'

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

  const children = [
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(NAVY) },
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 40 },
      children: [new TextRun({ text: schoolName || 'School', bold: true, color: 'FFFFFF', size: 40 })],
    }),
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(NAVY) },
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: titleLine1, bold: true, color: 'FFFFFF', size: 26 })],
    }),
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(NAVY) },
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: ay, color: 'FFFFFF', size: 22 })],
    }),
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(NAVY) },
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: `Generated: ${dateStr}`, color: 'D4E0EC', size: 16 })],
    }),
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(NAVY) },
      alignment: AlignmentType.CENTER,
      spacing: { after: userProfile?.first_name ? 20 : 200 },
      children: [new TextRun({ text: summaryText, color: 'C8D7EB', size: 15 })],
    }),
  ]

  if (userProfile?.first_name) {
    const name = [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ')
    const prepLine = userProfile.job_title ? `${name}, ${userProfile.job_title}` : name
    children.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(NAVY) },
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Prepared by: ${prepLine}`, color: 'D4E0EC', size: 15 })],
    }))
  }

  return children
}

// ─────────────────────────────────────────────────────────────────────
// PUBLIC API — Word equivalent of generateEvidenceReport(). Same inputs,
// same section order, same "which sections for which purpose" decision
// (getShowSections) — a drop-in alternative export format.
// ─────────────────────────────────────────────────────────────────────
export async function generateEvidenceReportWord({
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
  const dateStr  = fmt()
  const ay       = academicYear()
  const safeName = (schoolName || 'School').replace(/[^a-z0-9]/gi, '_')
  const isFullStrategy = purpose === 'full_strategy'

  const readinessData = getReadinessData(entries, domains)
  const show = getShowSections(purpose, includeAppendixB)

  const children = writeTitleBlock({ schoolName, purpose, selectedDomains, selectedGroups, domainList: domains, userProfile, dateStr, ay })

  if (show.schoolContext) children.push(...writeSchoolContextWord({ schoolCtx, readinessData, selectedDomains }))
  if (show.barriers)      children.push(...writeBarriersWord({ barriers, selectedDomains, selectedGroups }))
  if (show.domainReadiness) children.push(...writeDomainReadinessWord({ readinessData, selectedDomains }))
  if (show.funding)       children.push(...writeFundingWord({ entries, selectedDomains, schoolCtx }))
  if (show.provision)     children.push(...writeProvisionInPlaceWord({ entries, selectedDomains, selectedGroups, provisionView, domainList: domains }))
  if (show.reviews)       children.push(...writeReviewsWord({ entries, selectedDomains }))
  if (show.appendixA)     children.push(...writeAppendixAWord({ entries, selectedDomains, selectedGroups, domainList: domains }))
  if (show.appendixB)     children.push(...writeAppendixBWord({ entries, domainList: domains }))

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })

  const blob = await Packer.toBlob(doc)
  const filePrefix = isFullStrategy ? 'Inclusion_Strategy_Statement' : 'Inclusion_Evidence_Report'
  const filename = `${filePrefix}_${safeName}_${ay.replace('/', '-')}.docx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
