import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle,
} from 'docx'

import {
  // shared brand/RAG colours + small presentational helpers — same values as the PDF
  NAVY, DARK, MID, GREEN, AMBER, RED, GREY, LTGREY,
  fmt,
} from './generateReport'

// ── Colour helpers ───────────────────────────────────────────────────
// docx wants hex strings with no '#'. The PDF's colours are either [r,g,b]
// arrays or '#rrggbb' strings — normalise both to the same form.
function hex(colour) {
  if (Array.isArray(colour)) {
    return colour.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()
  }
  return String(colour).replace('#', '').toUpperCase()
}

// Pale tints derived from the existing brand/RAG colours (never new hex values): mix the
// base RGB with white by `pct`. Used for cell/section backgrounds so status/identity colour
// reads as a wash, not a solid block, with the base colour reserved at full strength for the
// text/accent sitting on top.
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
const NOT_STARTED_COLOUR = [184, 190, 199]
const NOT_STARTED_TINT = tint(NOT_STARTED_COLOUR, 85)
// Title-block background: 92% white-mix of NAVY (paler still, since it covers a large area).
const NAVY_TINT_TITLE = tint(NAVY, 92)

const BORDER = { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
const NO_BORDERS = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
// Table cell padding — up from the original 60/80 twips for more breathing room.
const CELL_MARGINS = { top: 100, bottom: 100, left: 120, right: 120 }

// Type scale (docx `size` is in half-points). Cambria for headings, Calibri
// for body/table text, per the brand pairing used elsewhere in this project.
const HEADING_FONT = 'Cambria'
const BODY_FONT    = 'Calibri'
const SIZE_H1    = 26 // 13pt — top-level section bars ("INCLUSION TEAM")
const SIZE_BODY  = 18 //  9pt — table headers, table body, notes

// Team chip colours — mirrors TEAM_CHIP_STYLE in App.jsx exactly.
const TEAM_CHIP_LABEL = {
  approved:          'Approved',
  awaiting_approval: 'Awaiting approval',
  in_progress:       'In progress',
  not_in_place:      'Not in place',
  not_started:       'Not started',
}
const TEAM_CHIP_COLOUR = {
  approved:          GREEN,
  awaiting_approval: [124, 88, 237],
  in_progress:       AMBER,
  not_in_place:      RED,
  not_started:       NOT_STARTED_COLOUR,
}
const TEAM_CHIP_TINT = {
  approved:          GREEN_TINT,
  awaiting_approval: tint([124, 88, 237], 85),
  in_progress:       AMBER_TINT,
  not_in_place:      RED_TINT,
  not_started:       NOT_STARTED_TINT,
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
const BARRIER_STATUS_LABEL = { active: 'Active', being_addressed: 'Being addressed', resolved: 'Resolved' }

// ── Small building blocks ────────────────────────────────────────────

// Full-width navy heading bar — the Word equivalent of the PDF's sectionBar().
function bar(text) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(NAVY) },
    spacing: { before: 320, after: 160 },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, color: 'FFFFFF', size: SIZE_H1, font: HEADING_FONT }),
    ],
  })
}

function italicNote(text) {
  return new Paragraph({
    spacing: { before: 120, after: 160 },
    children: [new TextRun({ text, italics: true, color: hex(MID), size: SIZE_BODY, font: BODY_FONT })],
  })
}

function cell(text, { fill, color, bold, italics, width, align } = {}) {
  return new TableCell({
    width: width != null ? { size: width, type: WidthType.PERCENTAGE } : undefined,
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
// for per-cell styling), optional colWidths (percentages summing to ~100).
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

// ─────────────────────────────────────────────────────────────────────
// SECTION — Inclusion Team
// ─────────────────────────────────────────────────────────────────────
function writeInclusionTeamWord({ team }) {
  const children = [bar('Inclusion Team')]

  if (!team || team.length === 0) {
    children.push(italicNote('None.'))
    return children
  }

  const body = team.map(t => [
    t.role,
    t.name || { text: 'Not recorded', italics: true, color: MID },
    { text: TEAM_CHIP_LABEL[t.chip] ?? t.chip, bold: true, color: TEAM_CHIP_COLOUR[t.chip], fill: TEAM_CHIP_TINT[t.chip] },
  ])
  children.push(table(['Role', 'Name', 'Status'], body, [38, 38, 24]))
  return children
}

// ─────────────────────────────────────────────────────────────────────
// SECTION — Progress by (DfE Principle / Domain / Category)
// ─────────────────────────────────────────────────────────────────────
// Proportional 100%-stacked bar as a one-row table: one cell per non-zero bucket, widths
// as whole-number percentages that always sum to exactly 100 (rounding drift is absorbed
// by the largest non-zero segment, never left to accumulate or overshoot). A total of 0
// draws a single grey "no data" cell spanning the full row instead of four empty ones.
function progressBarRow(counts) {
  const buckets = [
    { count: counts.inPlace,    fill: hex(GREEN) },
    { count: counts.inProgress, fill: hex(AMBER) },
    { count: counts.notInPlace, fill: hex(RED) },
    { count: counts.notStarted, fill: hex(NOT_STARTED_COLOUR) },
  ]

  if (counts.total === 0) {
    return new TableRow({ children: [new TableCell({
      width: { size: 100, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(NOT_STARTED_COLOUR) },
      borders: NO_BORDERS,
      children: [new Paragraph('')],
    })] })
  }

  const present = buckets.filter(b => b.count > 0)
  const raw = present.map(b => (b.count / counts.total) * 100)
  const widths = raw.map(v => Math.round(v))
  const drift = 100 - widths.reduce((s, v) => s + v, 0)
  if (drift !== 0 && widths.length > 0) {
    let biggest = 0
    for (let i = 1; i < widths.length; i++) if (widths[i] > widths[biggest]) biggest = i
    widths[biggest] += drift
  }

  return new TableRow({
    children: present.map((b, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: b.fill },
      borders: NO_BORDERS,
      children: [new Paragraph('')],
    })),
  })
}

function progressBarCell(counts, width) {
  const inner = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [progressBarRow(counts)] })
  return new TableCell({
    width: width != null ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    children: [inner],
  })
}

function writeProgressChartWord(groups) {
  const rows = groups.map(g => new TableRow({
    children: [
      cell(g.name, { width: 30, bold: true }),
      cell(g.counts.total ? `${Math.round((g.counts.inPlace / g.counts.total) * 100)}% in place` : 'No data', { width: 15, color: MID }),
      progressBarCell(g.counts, 55),
    ],
  }))
  const legend = new Paragraph({
    spacing: { before: 80, after: 160 },
    children: [
      new TextRun({ text: '■ ', color: hex(GREEN), size: SIZE_BODY }),
      new TextRun({ text: 'In place   ', color: hex(MID), size: SIZE_BODY, font: BODY_FONT }),
      new TextRun({ text: '■ ', color: hex(AMBER), size: SIZE_BODY }),
      new TextRun({ text: 'In progress   ', color: hex(MID), size: SIZE_BODY, font: BODY_FONT }),
      new TextRun({ text: '■ ', color: hex(RED), size: SIZE_BODY }),
      new TextRun({ text: 'Not in place   ', color: hex(MID), size: SIZE_BODY, font: BODY_FONT }),
      new TextRun({ text: '■ ', color: hex(NOT_STARTED_COLOUR), size: SIZE_BODY }),
      new TextRun({ text: 'Not started', color: hex(MID), size: SIZE_BODY, font: BODY_FONT }),
    ],
  })
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: {
    top: NO_BORDERS.top, bottom: NO_BORDERS.bottom, left: NO_BORDERS.left, right: NO_BORDERS.right,
    insideHorizontal: NO_BORDERS.top, insideVertical: NO_BORDERS.top,
  } }), legend]
}

function writeProgressTableWord(groups) {
  const body = groups.map(g => [
    g.name,
    { text: String(g.counts.inPlace), color: GREEN, bold: true },
    { text: String(g.counts.inProgress), color: AMBER, bold: true },
    { text: String(g.counts.notInPlace), color: RED, bold: true },
    String(g.counts.notStarted),
    String(g.counts.total),
  ])
  return [table(['', 'In Place', 'In Progress', 'Not In Place', 'Not Started', 'Total'], body, [30, 14, 14, 14, 14, 14])]
}

function writeProgressSectionWord(section) {
  const { title, groups, showAs } = section
  const children = [bar(title)]

  if (!groups || groups.length === 0) {
    children.push(italicNote('None.'))
    return children
  }

  if (showAs === 'chart' || showAs === 'both') children.push(...writeProgressChartWord(groups))
  if (showAs === 'table' || showAs === 'both') children.push(...writeProgressTableWord(groups))
  return children
}

// ─────────────────────────────────────────────────────────────────────
// SECTION — Barriers
// ─────────────────────────────────────────────────────────────────────
function writeBarriersWord({ barrierRows }) {
  const children = [bar('Barriers')]

  if (!barrierRows || barrierRows.length === 0) {
    children.push(italicNote('None.'))
    return children
  }

  const body = barrierRows.map(r => [
    r.description,
    r.whereItSits,
    { text: BARRIER_STATUS_LABEL[r.status] ?? (r.status ?? '—'), bold: true, color: barrierStatusColourHex(r.status), fill: barrierStatusFillHex(r.status) },
    r.actions || '—',
  ])
  children.push(table(['Barrier', 'Where it sits', 'Status', 'Actions so far'], body, [24, 24, 14, 38]))
  return children
}

// ─────────────────────────────────────────────────────────────────────
// SECTION — Due for review
// ─────────────────────────────────────────────────────────────────────
function writeDueForReviewWord({ reviewRows }) {
  const children = [bar('Due for Review')]

  if (!reviewRows || reviewRows.length === 0) {
    children.push(italicNote('None.'))
    return children
  }

  const body = reviewRows.map(r => [
    r.point,
    r.whereItSits,
    r.statusText,
    r.isOverdue ? { text: r.dueLabel, bold: true, color: RED } : r.dueLabel,
  ])
  children.push(table(['Point', 'Where it sits', 'Status', 'Due'], body, [30, 28, 15, 27]))
  return children
}

// ─────────────────────────────────────────────────────────────────────
// Title block — Word equivalent of the PDF's navy cover page. Word has no clean way (via
// the docx library) to give one specific page a full-bleed background colour different
// from the rest of the document, so this is a shaded title block at the top of the
// document rather than a literal full-page navy cover — the closest match the format
// allows. Simplified per the Report Builder rebuild: school name and date only.
// ─────────────────────────────────────────────────────────────────────
function writeTitleBlock({ schoolName, userProfile, dateStr }) {
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
      spacing: { after: userProfile?.first_name ? 30 : 240 },
      children: [new TextRun({ text: dateStr, color: hex(DARK), size: 22, font: BODY_FONT })],
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
// PUBLIC API — Word equivalent of generateEvidenceReport(). Same inputs, same section
// order — team, progress sections, barriers, due for review — pre-built by ReportBuilder
// (see App.jsx) so this file stays a pure drawing layer, matching the PDF generator.
// ─────────────────────────────────────────────────────────────────────
export async function generateEvidenceReportWord({
  schoolName       = '',
  userProfile      = null,
  team             = [],
  progressSections = [],
  barrierRows      = [],
  reviewRows       = [],
}) {
  const dateStr  = fmt()
  const safeName = (schoolName || 'School').replace(/[^a-z0-9]/gi, '_')

  const children = writeTitleBlock({ schoolName, userProfile, dateStr })

  children.push(...writeInclusionTeamWord({ team }))
  for (const section of progressSections) {
    children.push(...writeProgressSectionWord(section))
  }
  children.push(...writeBarriersWord({ barrierRows }))
  children.push(...writeDueForReviewWord({ reviewRows }))

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `Inclusion_Report_${safeName}_${dateStr.replace(/ /g, '_')}.docx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
