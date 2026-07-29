/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { jsPDF } from 'jspdf';
import type { SheetModel } from './exportModel';
import { rollLines } from './rollFormat';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const LABEL_W = 52;
const VALUE_W = PAGE_W - 2 * MARGIN - LABEL_W;
const PAD = 3;

// Base sizing — scaled down automatically when a room's roll list would not
// fit on one A4 page (rooms with many candidates).
const BASE_LINE_H = 7;
const BASE_FONT = 10.5;
const MONO_CHAR_SPACE = 0.25; // mm of extra tracking between roll digits
// Try full size first; shrink in steps. 0.66 still prints clearly on A4.
const FIT_SCALES = [1, 0.9, 0.8, 0.72, 0.66];

interface Line {
  text: string;
  bold?: boolean;
  mono?: boolean;
  size?: number;
}

interface Row {
  label: string;
  lines: Line[];
  lineH: number;
  minHeight?: number;
}

function setFont(doc: jsPDF, line: Line) {
  doc.setFont(line.mono ? 'courier' : 'helvetica', line.bold ? 'bold' : 'normal');
  doc.setFontSize(line.size ?? BASE_FONT);
}

function rowHeight(row: Row): number {
  const contentH = row.lines.length * row.lineH + 2 * PAD;
  return Math.max(row.minHeight ?? 0, contentH, row.lineH + 2 * PAD);
}

function drawRow(doc: jsPDF, y: number, row: Row, height: number): void {
  const x = MARGIN;
  doc.setDrawColor(30);
  doc.setLineWidth(0.3);
  doc.rect(x, y, LABEL_W, height);
  doc.rect(x + LABEL_W, y, VALUE_W, height);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const labelLines = doc.splitTextToSize(row.label, LABEL_W - 2 * PAD) as string[];
  labelLines.forEach((l, i) => doc.text(l, x + PAD, y + PAD + 4 + i * 5));

  row.lines.forEach((line, i) => {
    setFont(doc, line);
    doc.text(line.text, x + LABEL_W + PAD, y + PAD + 0.65 * row.lineH + i * row.lineH, {
      charSpace: line.mono ? MONO_CHAR_SPACE : 0,
    });
  });
}

// Draw a row, splitting its content across pages when necessary.
function placeRow(doc: jsPDF, y: number, row: Row): number {
  let lines = row.lines;
  let first = true;
  for (;;) {
    const available = PAGE_H - MARGIN - y;
    const fitCount = Math.max(0, Math.floor((available - 2 * PAD) / row.lineH));
    const label = first ? row.label : `${row.label} (contd.)`;
    const need = rowHeight({ ...row, lines });
    if (need <= available) {
      drawRow(doc, y, { ...row, lines, label }, need);
      return y + need;
    }
    if (fitCount < 2) {
      doc.addPage();
      y = MARGIN;
      continue;
    }
    drawRow(doc, y, { ...row, lines: lines.slice(0, fitCount), label }, available);
    lines = lines.slice(fitCount);
    first = false;
    doc.addPage();
    y = MARGIN;
  }
}

function centred(doc: jsPDF, y: number, text: string, size: number, bold = false): number {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  const wrapped = doc.splitTextToSize(text, PAGE_W - 2 * MARGIN) as string[];
  wrapped.forEach((l, i) => doc.text(l, PAGE_W / 2, y + i * (size * 0.5), { align: 'center' }));
  return y + wrapped.length * (size * 0.5) + 2;
}

// How many characters of monospaced roll text fit in the value column at
// a given scale (courier glyph width ≈ 0.6 × font size, plus tracking).
function monoCharsPerLine(scale: number): number {
  const charW = BASE_FONT * scale * 0.6 * 0.3528 + MONO_CHAR_SPACE;
  return Math.floor((VALUE_W - 2 * PAD - 2) / charW);
}

// Table rows for the seating sheet at a given scale.
function seatingRows(m: SheetModel, scale: number): Row[] {
  const lineH = BASE_LINE_H * scale;
  const size = BASE_FONT * scale;
  const maxChars = monoCharsPerLine(scale);

  const rolls: Line[] = [];
  for (const block of m.rollBlocks) {
    rolls.push({ text: `${block.subjectCode} (${block.count})`, bold: true, size });
    for (const l of rollLines(block.rolls, m.rollDisplay, maxChars)) {
      rolls.push({ text: l, mono: true, bold: true, size });
    }
  }

  const rows: Row[] = [
    { label: 'Date & Day', lineH, lines: [{ text: m.dateDay, size }] },
    { label: 'Time', lineH, lines: [{ text: m.timeSlot || m.session, size }] },
    { label: 'Room No.', lineH, lines: [{ text: m.roomNoDisplay, bold: true, size: Math.max(size, 11) }] },
    { label: 'Subject(s) & Code(s)', lineH, lines: [{ text: m.subjectsSummary, bold: true, size }] },
    { label: 'Roll Numbers (subject-wise)', lineH, lines: rolls },
    { label: 'Total Number of Students', lineH, lines: [{ text: String(m.total), bold: true, size: Math.max(size, 11) }] },
  ];
  if (m.showAttendance) {
    rows.push(
      { label: 'Total Present', lineH, lines: [], minHeight: 14 },
      { label: 'Total Absent (with roll numbers of absent candidates)', lineH, lines: [], minHeight: 24 },
      { label: 'Signature of Invigilators', lineH, lines: [], minHeight: 24 },
    );
  }
  return rows;
}

function renderSheet(doc: jsPDF, m: SheetModel): void {
  if (m.includeSeating) {
    let y = MARGIN + 4;
    y = centred(doc, y, m.centreName || 'Examination Centre', 15, true);
    if (m.centreAddress) y = centred(doc, y, m.centreAddress, 10);
    y = centred(doc, y, m.examName, 11, true);
    y += 2;

    // Pick the largest scale whose whole table fits on this page; if even the
    // smallest overflows, keep the smallest and continue onto the next page.
    const available = PAGE_H - MARGIN - y;
    let rows = seatingRows(m, FIT_SCALES[0]);
    for (const scale of FIT_SCALES) {
      rows = seatingRows(m, scale);
      const total = rows.reduce((h, r) => h + rowHeight(r), 0);
      if (total <= available) break;
    }

    for (const row of rows) {
      y = placeRow(doc, y, row);
    }
  }

  if (m.benchPlan) {
    if (m.includeSeating) doc.addPage();
    let by = MARGIN + 4;
    by = centred(doc, by, `Bench Plan — Room ${m.roomNumber}`, 14, true);
    by = centred(doc, by, `${m.dateDay}   •   ${m.timeSlot || m.session}`, 10);
    by += 2;
    for (let i = 0; i < m.benchPlan.length; i++) {
      const bench = m.benchPlan[i];
      const lines: Line[] =
        bench.length > 0
          ? bench.map((s) => ({ text: `${s.roll}   (${s.subjectCode})`, mono: true, bold: true }))
          : [{ text: '— empty —' }];
      by = placeRow(doc, by, { label: `Bench ${i + 1}`, lineH: BASE_LINE_H, lines });
    }
  }
}

export function buildPdf(models: SheetModel[]): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  models.forEach((m, i) => {
    if (i > 0) doc.addPage();
    renderSheet(doc, m);
  });
  return doc.output('blob');
}
