import { jsPDF } from 'jspdf';
import type { SheetModel } from './exportModel';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const LABEL_W = 52;
const VALUE_W = PAGE_W - 2 * MARGIN - LABEL_W;
const LINE_H = 7; // generous line height so numbers never look crowded
const PAD = 3;

interface Line {
  text: string;
  bold?: boolean;
  mono?: boolean;
  size?: number;
}

interface Row {
  label: string;
  lines: Line[];
  minHeight?: number;
}

function setFont(doc: jsPDF, line: Line) {
  doc.setFont(line.mono ? 'courier' : 'helvetica', line.bold ? 'bold' : 'normal');
  doc.setFontSize(line.size ?? 10.5);
}

function rowHeight(row: Row): number {
  const contentH = row.lines.length * LINE_H + 2 * PAD;
  return Math.max(row.minHeight ?? 0, contentH, LINE_H + 2 * PAD);
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
    doc.text(line.text, x + LABEL_W + PAD, y + PAD + 4.5 + i * LINE_H, {
      charSpace: line.mono ? 0.25 : 0,
    });
  });
}

// Draw a row, splitting its content across pages when necessary.
function placeRow(doc: jsPDF, y: number, row: Row): number {
  let lines = row.lines;
  let first = true;
  for (;;) {
    const available = PAGE_H - MARGIN - y;
    const fitCount = Math.max(0, Math.floor((available - 2 * PAD) / LINE_H));
    const need = rowHeight({ ...row, lines });
    if (need <= available) {
      drawRow(doc, y, { ...row, label: first ? row.label : `${row.label} (contd.)` }, need);
      return y + need;
    }
    if (fitCount < 2) {
      doc.addPage();
      y = MARGIN;
      continue;
    }
    const head = lines.slice(0, fitCount);
    drawRow(doc, y, { label: first ? row.label : `${row.label} (contd.)`, lines: head }, available);
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

function renderSheet(doc: jsPDF, m: SheetModel): void {
  if (m.includeSeating) {
    let y = MARGIN + 4;
    y = centred(doc, y, m.centreName || 'Examination Centre', 15, true);
    if (m.centreAddress) y = centred(doc, y, m.centreAddress, 10);
    y = centred(doc, y, m.examName, 11, true);
    y = centred(doc, y, 'SEATING ARRANGEMENT', 11, true);
    doc.setLineWidth(0.4);
    doc.line(PAGE_W / 2 - 24, y - 3.5, PAGE_W / 2 + 24, y - 3.5);
    y += 2;

    const rollLines: Line[] = [];
    for (const block of m.rollBlocks) {
      rollLines.push({ text: `${block.subjectCode} (${block.count})`, bold: true, size: 10.5 });
      for (const l of block.lines) rollLines.push({ text: l, mono: true, bold: true, size: 10.5 });
    }

    const rows: Row[] = [
      { label: 'Date & Day', lines: [{ text: m.dateDay }] },
      { label: 'Time', lines: [{ text: m.timeSlot || m.session }] },
      { label: 'Room No.', lines: [{ text: m.roomNumber, bold: true, size: 12 }] },
      { label: 'Subject(s) & Code(s)', lines: [{ text: m.subjectsSummary, bold: true }] },
      { label: 'Roll Numbers (subject-wise)', lines: rollLines },
      { label: 'Total Number of Students', lines: [{ text: String(m.total), bold: true, size: 12 }] },
    ];
    if (m.showAttendance) {
      rows.push(
        { label: 'Total Present', lines: [], minHeight: 14 },
        { label: 'Total Absent (with roll numbers of absent candidates)', lines: [], minHeight: 24 },
        { label: 'Signature of Invigilators', lines: [], minHeight: 24 },
      );
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
      by = placeRow(doc, by, { label: `Bench ${i + 1}`, lines });
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
