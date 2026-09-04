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

// Session 59 — pale tints derived from the existing brand/RAG colours (never new
// hex values): mix the base RGB with white by `pct`. Used for cell/section
// backgrounds so status/identity colour reads as a wash, not a solid block, with
// the base colour reserved at full strength for the text/accent sitting on top.
function tint(colour, pct) {
  const rgb = Array.isArray(colour) ? colour : [
    parseInt(String(colour).replace('#', '').slice(0, 2), 16),
    parseInt(String(colour).replace('#', '').slice(2, 4), 16),
    parseInt(String(colour).replace('#', '').slice(4, 6), 16),
  ]
  return hex(rgb.map(c => Math.round(c + (255 - c) * pct / 100)))
}

// Status-cell backgrounds: 85% white-mix of the RAG colour (e.g. GREEN [37,122,59] -> DEEBE2).
const GREEN_TINT = tint(GREEN, 85)
const AMBER_TINT = tint(AMBER, 85)
const RED_TINT   = tint(RED, 85)
// Title-block background: 92% white-mix of NAVY (paler still, since it covers a large area).
const NAVY_TINT_TITLE = tint(NAVY, 92)

const BORDER = { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
// Table cell padding — up from the original 60/80 twips for more breathing room.
const CELL_MARGINS = { top: 100, bottom: 100, left: 120, right: 120 }

// Type scale (docx `size` is in half-points). Cambria for headings, Calibri
// for body/table text, per the brand pairing used elsewhere in this project.
const HEADING_FONT = 'Cambria'
const BODY_FONT    = 'Calibri'
const SIZE_H1    = 26 // 13pt — top-level section bars ("1 — SCHOOL CONTEXT")
const SIZE_H2    = 22 // 11pt — domain/principle bars within a section
const SIZE_H3    = 20 // 10pt — sub-domain / mini-section headings
const SIZE_BODY  = 18 //  9pt — table headers, table body, notes, bullets

function statusColourHex(status) {
  if (status === 'in_place')    return hex(GREEN)
  if (status === 'in_progress') return hex(AMBER)
  return hex(RED)
}
function statusFillHex(status) {
  if (status === 'in_place')    return GREEN_TINT
  if (status === 'in_progress') return AMBER_TINT
  return RED_TINT
}

// Barrier status colour — matches drawBarriers' didParseCell exactly:
// active=red, being_addressed=amber, resolved=green.
function barrierStatusColourHex(rawStatus) {
  if (rawStatus === 'active')          return hex(RED)
  if (rawStatus === 'being_addressed') return hex(AMBER)
  if (rawStatus === 'resolved')        return hex(GREEN)
  return undefined
}
function barrierStatusFillHex(rawStatus) {
  if (rawStatus === 'active')          return RED_TINT
  if (rawStatus === 'being_addressed') return AMBER_TINT
  if (rawStatus === 'resolved')        return GREEN_TINT
  return undefined
}

// ── Small building blocks ────────────────────────────────────────────

// Full-width navy (or domain-coloured) heading bar — the Word equivalent of
// the PDF's sectionBar()/domainBar() jsPDF-drawn rectangles. This is the one
// shared helper behind every top-level/domain-level heading in the document.
// `level: 1` = section headings ("1 — SCHOOL CONTEXT"); `level: 2` = the
// domain/principle bars nested within a section (Provision, Appendix A/B).
//
// `font` is pinned explicitly here because Word resolves an unset font per
// Unicode script range (ASCII/High-ANSI/East-Asian/Complex-Script each have
// their own slot), and punctuation like "&" can fall into a different slot
// than the surrounding letters — Word then silently substitutes a fallback
// typeface for just that glyph, which reads as inconsistent bold/weight
// around the "&" even though the XML itself is a single run (verified: every
// heading here is emitted as exactly one <w:r>, never split). Setting `font`
// forces Word to use the same face for every character in the run.
function bar(text, { fill = hex(NAVY), level = 1 } = {}) {
  const size           = level === 1 ? SIZE_H1 : SIZE_H2
  const spacingBefore  = level === 1 ? 320 : 260
  const spacingAfter   = level === 1 ? 160 : 140
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill },
    spacing: { before: spacingBefore, after: spacingAfter },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, color: 'FFFFFF', size, font: HEADING_FONT }),
    ],
  })
}

// Third-level heading — sub-domain names, and mini-section titles like
// "Funding Streams" — plain text (no shaded bar), Cambria, one step down from
// the domain-level bar, with generous spacing so it doesn't crowd the table
// above or below it.
function subheading(text, colour = MID) {
  return new Paragraph({
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text, bold: true, color: hex(colour), size: SIZE_H3, font: HEADING_FONT })],
  })
}

function italicNote(text) {
  return new Paragraph({
    spacing: { before: 120, after: 160 },
    children: [new TextRun({ text, italics: true, color: hex(MID), size: SIZE_BODY, font: BODY_FONT })],
  })
}

function boldNote(text, colour = DARK) {
  return new Paragraph({
    spacing: { before: 180, after: 120 },
    children: [new TextRun({ text, bold: true, color: hex(colour), size: SIZE_BODY, font: BODY_FONT })],
  })
}

function bullet(text, colour = DARK) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, color: hex(colour), size: SIZE_BODY, font: BODY_FONT })],
  })
}

function cell(text, { fill, color, bold, italics, width, align } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({
        text: String(text ?? ''), bold, italics, size: SIZE_BODY, font: BODY_FONT,
        color: color ? hex(color) : undefined,
      })],
    })],
  })
}

// Generic table: headerLabels (strings), bodyRows (array of row-cell-spec arrays,
// each cell either a plain string or { text, color, bold, italics, align, fill }
// for per-cell styling — `fill` overrides the default alternating-row shading,
// used for status/RAG cells that need a tint background regardless of row
// stripe), optional colWidths (percentages summing to ~100).
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
        fill: spec.fill ?? (ri % 2 === 1 ? hex(GREY) : undefined),
        color: spec.color, bold: spec.bold, italics: spec.italics, align: spec.align,
        width: colWidths?.[ci],
      })
    }),
  }))

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] })
}

// Proportional readiness "bar" — a 2-cell nested table (filled/unfilled) approximating
// the PDF's coloured-rectangle progress bar, per the brief's "shaded cells" guidance.
// This stays a full-strength fill (not tinted): it's a data-viz progress indicator,
// not a status/RAG label, and the point of a progress bar is the solid-vs-empty
// contrast — a tint would just make it harder to read at a glance.
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
    margins: CELL_MARGINS,
    children: [inner],
  })
}

// ─────────────────────────────────────────────────────────────────────
// SECTION 1 — School Context
// ─────────────────────────────────────────────────────────────────────
function writeSchoolContextWord({ schoolCtx, readinessData, selectedDomains }) {
  const { ay, cards, readinessLabel } = getSchoolContextSectionData({ schoolCtx, readinessData, selectedDomains })

  const children = [bar('1 — School Context')]
  children.push(subheading(`Cohort Profile ${ay}`))

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
    { text: r.status, bold: true, color: barrierStatusColourHex(r.barrier.status), fill: barrierStatusFillHex(r.barrier.status) },
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
      cell(d.inPlace, { fill: GREEN_TINT, color: GREEN, bold: true, width: 10, align: AlignmentType.CENTER }),
      cell(d.inProgress, { fill: AMBER_TINT, color: AMBER, bold: true, width: 10, align: AlignmentType.CENTER }),
      cell(d.notInPlace, { fill: RED_TINT, color: RED, bold: true, width: 12, align: AlignmentType.CENTER }),
      cell(d.total, { fill: i % 2 === 1 ? hex(GREY) : undefined, width: 8, align: AlignmentType.CENTER }),
      d.pct === null
        ? cell('No data', { fill: i % 2 === 1 ? hex(GREY) : undefined, color: MID, italics: true, width: 10, align: AlignmentType.CENTER })
        : cell(`${d.pct}%`, { fill: i % 2 === 1 ? hex(GREY) : undefined, width: 10, align: AlignmentType.CENTER }),
      readinessBarCell(d.pct ?? 0, hex(domainColour(d.name)), 22),
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

  children.push(subheading('Funding Streams', DARK))
  children.push(table(
    ['Funding Stream', 'Total Spend', '% of Total'],
    streamRows.map(r => [r.name, `£${r.value.toLocaleString()}`, `${r.pctOfTotal}%`]),
    [55, 25, 20],
  ))

  if (domainRows.length > 0) {
    children.push(subheading(selectedDomains.length > 0 ? 'Spend (selected domains)' : 'Spend by Domain', DARK))
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
      { text: status, bold: true, color: statusColourHex(e.status), fill: statusFillHex(e.status) },
      type, groups, intended,
    ]
  })
}

function writeEnrichmentEquityWord(entriesSlice) {
  const { groups, rows } = getEnrichmentEquityData(entriesSlice)
  if (rows.length === 0) return []
  const children = [italicNote('Group coverage by enrichment sub-domain (% of provision points):')]
  const body = rows.map(r => r.values.map(v => ({
    text: `${v}%`,
    bold: true,
    color: v >= 80 ? GREEN : v >= 50 ? AMBER : RED,
    fill: v >= 80 ? GREEN_TINT : v >= 50 ? AMBER_TINT : RED_TINT,
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
      children.push(bar(principle, { level: 2 }))
      children.push(table(headers, provisionTableRows(pEntries), colWidths))
    }
    return children
  }

  const domains = getProvisionByDomainData(filtered, domainList)
  for (const dom of domains) {
    children.push(bar(dom.name, { fill: hex(domainColour(dom.name)), level: 2 }))

    if (dom.name.includes('Enrichment')) {
      const enrichAll = dom.subDomains.flatMap(sd => sd.entries)
      children.push(...writeEnrichmentEquityWord(enrichAll))
    }

    for (const { sdName, entries: sdEntries } of dom.subDomains) {
      children.push(subheading(sdName))
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
      fill: ev.days_remaining < 0 ? RED_TINT : AMBER_TINT,
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
    children.push(bar(dom.name, { fill: hex(domainColour(dom.name)), level: 2 }))
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
    children.push(bar(dom.name, { fill: hex(domainColour(dom.name)), level: 2 }))
    for (const { sdName, entries: sorted } of dom.subDomains) {
      children.push(subheading(sdName))
      children.push(table(
        ['Provision', 'Status', 'Type'],
        sorted.map(e => [
          e.provision_points?.label ?? '—',
          { text: statusLabel(e.status), bold: true, color: statusColourHex(e.status), fill: statusFillHex(e.status) },
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

  // Session 59: a solid navy block reads heavy at this size in Word, so the
  // background is a pale navy tint (NAVY_TINT_TITLE, 92% white-mix) with the
  // text carrying the colour instead — full-strength NAVY for the school name
  // and report title, DARK/MID for the supporting lines beneath.
  const titleShading = { type: ShadingType.CLEAR, color: 'auto', fill: NAVY_TINT_TITLE }

  const children = [
    new Paragraph({
      shading: titleShading,
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 60 },
      children: [new TextRun({ text: schoolName || 'School', bold: true, color: hex(NAVY), size: 40, font: HEADING_FONT })],
    }),
    new Paragraph({
      shading: titleShading,
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: titleLine1, bold: true, color: hex(NAVY), size: 26, font: HEADING_FONT })],
    }),
    new Paragraph({
      shading: titleShading,
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: ay, color: hex(DARK), size: 22, font: BODY_FONT })],
    }),
    new Paragraph({
      shading: titleShading,
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [new TextRun({ text: `Generated: ${dateStr}`, color: hex(MID), size: SIZE_BODY, font: BODY_FONT })],
    }),
    new Paragraph({
      shading: titleShading,
      alignment: AlignmentType.CENTER,
      spacing: { after: userProfile?.first_name ? 30 : 240 },
      children: [new TextRun({ text: summaryText, color: hex(MID), size: SIZE_BODY, font: BODY_FONT })],
    }),
  ]

  if (userProfile?.first_name) {
    const name = [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ')
    const prepLine = userProfile.job_title ? `${name}, ${userProfile.job_title}` : name
    children.push(new Paragraph({
      shading: titleShading,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: `Prepared by: ${prepLine}`, color: hex(MID), size: SIZE_BODY, font: BODY_FONT })],
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
