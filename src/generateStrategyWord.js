import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle, TableLayoutType,
} from 'docx'

// Read-only shared consts — same pattern generateReportWord.js already uses. Nothing is
// imported from generateReportWord.js itself: it exports only generateEvidenceReportWord,
// so there is nothing else to import from it without editing that file, which is off-limits
// this session.
import { NAVY, DARK, MID, GREY, academicYear } from './generateReport'

function hex(colour) {
  if (Array.isArray(colour)) {
    return colour.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()
  }
  return String(colour).replace('#', '').toUpperCase()
}

const HEADING_FONT = 'Cambria'
const BODY_FONT    = 'Calibri'
const SIZE_H1   = 26 // 13pt
const SIZE_BODY = 18 //  9pt

// A4 page, 1" margins each side (docx default margin), fixed-layout tables throughout —
// LibreOffice renders percentage-width cells on a default (auto) grid as equal columns
// regardless of the requested split, so every table here gets an explicit tblGrid
// (columnWidths, in DXA) plus DXA cell widths that sum to it, with layout: FIXED.
const PAGE_WIDTH_DXA  = 11906
const PAGE_MARGIN_DXA = 1440
const CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA - PAGE_MARGIN_DXA * 2 // 9026

const BORDER = { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
const CELL_MARGINS = { top: 100, bottom: 100, left: 120, right: 120 }

function bar(text) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(NAVY) },
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: 'FFFFFF', size: SIZE_H1, font: HEADING_FONT })],
  })
}
function bodyParagraph(text, { italic = false } = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, italics: italic, color: hex(DARK), size: SIZE_BODY, font: BODY_FONT })],
  })
}
// The one placeholder prompt style used everywhere a required field is empty — a real Word
// highlight (not just a tinted cell), so it reads as "type over this" at a glance.
function placeholder(text) {
  return new TextRun({ text, italics: true, color: hex(DARK), size: SIZE_BODY, font: BODY_FONT, highlight: 'yellow' })
}
function textRun(text) {
  return new TextRun({ text, color: hex(DARK), size: SIZE_BODY, font: BODY_FONT })
}

function cell(children, { width, fill, verticalAlign } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    verticalAlign,
    children: Array.isArray(children) ? children : [children],
  })
}
function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(NAVY) },
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: SIZE_BODY, font: BODY_FONT })] })],
  })
}

// Every table in this document is fixed-layout with an explicit column grid — see the
// file-level note on why (LibreOffice + percentage widths on a default grid).
function fixedTable(columnWidthsDxa, headerLabels, bodyRowCells) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headerLabels.map((label, i) => headerCell(label, columnWidthsDxa[i])),
  })
  const rows = bodyRowCells.map((rowCells, ri) => new TableRow({
    children: rowCells.map((children, ci) => cell(children, {
      width: columnWidthsDxa[ci],
      fill: ri % 2 === 1 ? hex(GREY) : undefined,
    })),
  }))
  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: columnWidthsDxa,
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...rows],
  })
}

// ─────────────────────────────────────────────────────────────────────
// 1 — Strategy overview
// ─────────────────────────────────────────────────────────────────────
function writeOverview({ academicYearLabel, reviewDate, authorisedBy }) {
  const w = [Math.round(CONTENT_WIDTH_DXA * 0.35), CONTENT_WIDTH_DXA - Math.round(CONTENT_WIDTH_DXA * 0.35)]
  const rows = [
    [[new Paragraph({ children: [textRun('Academic year(s)')] })], [new Paragraph({ children: [academicYearLabel ? textRun(academicYearLabel) : placeholder('[To complete]')] })]],
    [[new Paragraph({ children: [textRun('Date published')] })], [new Paragraph({ children: [placeholder('[To complete]')] })]],
    [[new Paragraph({ children: [textRun('Date of review')] })], [new Paragraph({ children: [reviewDate ? textRun(new Date(reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) : placeholder('[To complete]')] })]],
    [[new Paragraph({ children: [textRun('Authorised by')] })], [new Paragraph({ children: [authorisedBy?.trim() ? textRun(authorisedBy.trim()) : placeholder('[To complete]')] })]],
  ]
  return [bar('Strategy Overview'), fixedTable(w, ['Detail', 'Date'], rows)]
}

// ─────────────────────────────────────────────────────────────────────
// 2 — Statement of intent
// ─────────────────────────────────────────────────────────────────────
function writeStatementOfIntent(statementOfIntent) {
  const children = [bar('Statement of Intent')]
  if (statementOfIntent?.trim()) {
    children.push(bodyParagraph(statementOfIntent.trim()))
  } else {
    children.push(new Paragraph({ spacing: { after: 120 }, children: [placeholder('[To complete — 500 words or fewer, written for parents and pupils]')] }))
  }
  return children
}

// ─────────────────────────────────────────────────────────────────────
// 3 — Barriers to learning and participation
// ─────────────────────────────────────────────────────────────────────
function writeBarriers(barrierRows) {
  const children = [bar('Barriers to Learning and Participation')]
  if (barrierRows.length === 0) {
    children.push(bodyParagraph('None recorded.', { italic: true }))
    return children
  }
  const w = [Math.round(CONTENT_WIDTH_DXA * 0.08), CONTENT_WIDTH_DXA - Math.round(CONTENT_WIDTH_DXA * 0.08)]
  const rows = barrierRows.map(b => {
    const cellChildren = [new Paragraph({ children: [textRun(b.description)] })]
    if (b.trendNote?.trim()) {
      cellChildren.push(new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: `Trend/theme: ${b.trendNote.trim()}`, italics: true, color: hex(MID), size: SIZE_BODY, font: BODY_FONT })] }))
    }
    return [[new Paragraph({ children: [textRun(String(b.number))] })], cellChildren]
  })
  children.push(fixedTable(w, ['#', 'Barrier'], rows))
  return children
}

// ─────────────────────────────────────────────────────────────────────
// 4 — Activity in this academic year
// ─────────────────────────────────────────────────────────────────────
function writeActivity({ activityRows, emptyBarrierRows }) {
  const children = [bar('Activity in this Academic Year')]
  if (activityRows.length === 0 && emptyBarrierRows.length === 0) {
    children.push(bodyParagraph('None recorded.', { italic: true }))
    return children
  }
  const w = [
    Math.round(CONTENT_WIDTH_DXA * 0.58),
    Math.round(CONTENT_WIDTH_DXA * 0.17),
    CONTENT_WIDTH_DXA - Math.round(CONTENT_WIDTH_DXA * 0.58) - Math.round(CONTENT_WIDTH_DXA * 0.17),
  ]
  const activityBody = activityRows.map(r => [
    [new Paragraph({ children: [textRun(r.description)] }), new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: `Addresses barrier${r.barrierNumbers.length !== 1 ? 's' : ''} ${r.barrierNumbers.join(', ')}`, italics: true, color: hex(MID), size: SIZE_BODY, font: BODY_FONT })] })],
    [new Paragraph({ children: [r.universalOrTargeted === 'universal' ? textRun('Universal') : r.universalOrTargeted === 'targeted' ? textRun('Targeted') : placeholder('[To complete]')] })],
    [new Paragraph({ children: [placeholder('[To complete]')] })],
  ])
  const emptyBody = emptyBarrierRows.map(n => [
    [new Paragraph({ children: [placeholder(`[Barrier ${n} has no activity yet — add it here]`)] })],
    [new Paragraph({ children: [textRun('—')] })],
    [new Paragraph({ children: [placeholder('[To complete]')] })],
  ])
  children.push(fixedTable(w, ['Description', 'Universal / Targeted', 'Total budgeted cost'], [...activityBody, ...emptyBody]))
  return children
}

// ─────────────────────────────────────────────────────────────────────
// 5 — Intended outcomes
// ─────────────────────────────────────────────────────────────────────
function writeOutcomes(outcomeRows) {
  const children = [bar('Intended Outcomes')]
  const w = [Math.round(CONTENT_WIDTH_DXA * 0.5), CONTENT_WIDTH_DXA - Math.round(CONTENT_WIDTH_DXA * 0.5)]
  if (outcomeRows.length === 0) {
    const rows = [[
      [new Paragraph({ children: [placeholder('[To complete]')] })],
      [new Paragraph({ children: [placeholder('[To complete]')] })],
    ]]
    children.push(fixedTable(w, ['Outcome', 'Success criteria'], rows))
    return children
  }
  const rows = outcomeRows.map(o => [
    [new Paragraph({ children: [o.outcome?.trim() ? textRun(o.outcome.trim()) : placeholder('[To complete]')] })],
    [new Paragraph({ children: [o.successCriteria?.trim() ? textRun(o.successCriteria.trim()) : placeholder('[To complete]')] })],
  ])
  children.push(fixedTable(w, ['Outcome', 'Success criteria'], rows))
  return children
}

// ─────────────────────────────────────────────────────────────────────
// 6 — Review of the previous academic year (optional, year one omits it entirely)
// ─────────────────────────────────────────────────────────────────────
function writePreviousYearReview(previousYearReview) {
  if (!previousYearReview?.trim()) return []
  return [bar('Review of the Previous Academic Year'), bodyParagraph(previousYearReview.trim())]
}

// ─────────────────────────────────────────────────────────────────────
// 7 — Further information (optional)
// ─────────────────────────────────────────────────────────────────────
function writeFurtherInformation(furtherInformation) {
  if (!furtherInformation?.trim()) return []
  return [bar('Further Information'), bodyParagraph(furtherInformation.trim())]
}

function writeTitleBlock({ schoolName, ay }) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      children: [new TextRun({ text: schoolName || 'School', bold: true, color: hex(NAVY), size: 40, font: HEADING_FONT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Inclusion Strategy ${ay}`, color: hex(DARK), size: 24, font: BODY_FONT })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [textRun("This statement details our school's approach to delivering inclusive practice for all children, including those with SEND, funded by our core school budget (including the notional SEN budget) and the inclusive mainstream fund (IMF).")],
    }),
  ]
}

function writeFooter() {
  return [new Paragraph({
    spacing: { before: 320 },
    children: [new TextRun({ text: 'Highlighted prompts are for your school to complete or delete before publishing.', italics: true, color: hex(MID), size: SIZE_BODY, font: BODY_FONT })],
  })]
}

// ─────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────
// barrierRows: [{ number, description, trendNote }]
// activityRows: [{ description, universalOrTargeted, barrierNumbers: [1,2] }]
// emptyBarrierRows: [number, ...] — selected barriers with neither existing nor planned activity
// outcomeRows: [{ outcome, successCriteria }]
export async function generateStrategyWord({
  schoolName        = '',
  academicYearLabel = '',
  reviewDate        = null,
  authorisedBy      = '',
  statementOfIntent = '',
  barrierRows       = [],
  activityRows      = [],
  emptyBarrierRows  = [],
  outcomeRows       = [],
  previousYearReview = '',
  furtherInformation  = '',
}) {
  const ay = academicYearLabel?.trim() || academicYear()
  // Keep the human-readable "School Name" spacing the filename spec asks for — only strip
  // characters that are illegal in a Windows filename, don't collapse to underscores.
  const safeName = (schoolName || 'School').replace(/[\\/:*?"<>|]/g, '')

  const children = [
    ...writeTitleBlock({ schoolName, ay }),
    ...writeOverview({ academicYearLabel, reviewDate, authorisedBy }),
    ...writeStatementOfIntent(statementOfIntent),
    ...writeBarriers(barrierRows),
    ...writeActivity({ activityRows, emptyBarrierRows }),
    ...writeOutcomes(outcomeRows),
    ...writePreviousYearReview(previousYearReview),
    ...writeFurtherInformation(furtherInformation),
    ...writeFooter(),
  ]

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH_DXA, height: 16838 },
          margin: { top: PAGE_MARGIN_DXA, bottom: PAGE_MARGIN_DXA, left: PAGE_MARGIN_DXA, right: PAGE_MARGIN_DXA },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `Inclusion Strategy - ${safeName} - ${ay}.docx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

}
