/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { SheetModel } from './exportModel';

const LABEL_WIDTH = 28; // percent
const FONT = 'Times New Roman';

function labelCell(text: string): TableCell {
  return new TableCell({
    width: { size: LABEL_WIDTH, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, font: FONT, size: 22 })] })],
  });
}

function valueCell(paragraphs: Paragraph[]): TableCell {
  return new TableCell({
    width: { size: 100 - LABEL_WIDTH, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 120, bottom: 120, left: 160, right: 120 },
    children: paragraphs.length > 0 ? paragraphs : [new Paragraph('')],
  });
}

function textPara(text: string, opts: { bold?: boolean; size?: number; spacing?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.spacing ?? 60, line: 300 },
    children: [new TextRun({ text, bold: opts.bold ?? false, font: FONT, size: opts.size ?? 22 })],
  });
}

function rollPara(text: string): Paragraph {
  // Generous line spacing and letter spacing so roll numbers never look crowded
  return new Paragraph({
    spacing: { after: 100, line: 380 },
    children: [new TextRun({ text, font: 'Courier New', size: 22, bold: true })],
  });
}

function simpleRow(label: string, value: string): TableRow {
  return new TableRow({ children: [labelCell(label), valueCell(value ? [textPara(value)] : [])] });
}

function blankRow(label: string, height = 500): TableRow {
  return new TableRow({
    height: { value: height, rule: 'atLeast' },
    children: [labelCell(label), valueCell([])],
  });
}

function sheetChildren(m: SheetModel): (Paragraph | Table)[] {
  const heading = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: m.centreName || 'Examination Centre', bold: true, font: FONT, size: 30 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: m.centreAddress, font: FONT, size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: m.examName, bold: true, font: FONT, size: 24 })],
    }),
  ];

  const rollParagraphs: Paragraph[] = [];
  for (const block of m.rollBlocks) {
    rollParagraphs.push(textPara(`${block.subjectCode} (${block.count})`, { bold: true, spacing: 40 }));
    for (const line of block.lines) rollParagraphs.push(rollPara(line));
  }

  const tableRows = [
    simpleRow('Date & Day', m.dateDay),
    simpleRow('Time', m.timeSlot || m.session),
    simpleRow('Room No.', m.roomNoDisplay),
    simpleRow('Subject(s) & Code(s)', m.subjectsSummary),
    new TableRow({ children: [labelCell('Roll Numbers (subject-wise)'), valueCell(rollParagraphs)] }),
    simpleRow('Total Number of Students', String(m.total)),
  ];
  if (m.showAttendance) {
    tableRows.push(
      blankRow('Total Present'),
      blankRow('Total Absent (with roll numbers of absent candidates)', 900),
      blankRow('Signature of Invigilators', 900),
    );
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6 },
      bottom: { style: BorderStyle.SINGLE, size: 6 },
      left: { style: BorderStyle.SINGLE, size: 6 },
      right: { style: BorderStyle.SINGLE, size: 6 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 6 },
      insideVertical: { style: BorderStyle.SINGLE, size: 6 },
    },
    rows: tableRows,
  });

  const children: (Paragraph | Table)[] = m.includeSeating ? [...heading, table] : [];

  if (m.benchPlan) {
    children.push(
      new Paragraph({
        spacing: { before: 300, after: 120 },
        children: [new TextRun({ text: `Bench Plan — Room ${m.roomNumber}`, bold: true, font: FONT, size: 26 })],
        heading: HeadingLevel.HEADING_2,
        pageBreakBefore: m.includeSeating,
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: `${m.dateDay}   •   ${m.timeSlot || m.session}   •   ${m.examName}`,
            font: FONT,
            size: 20,
          }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4 },
          bottom: { style: BorderStyle.SINGLE, size: 4 },
          left: { style: BorderStyle.SINGLE, size: 4 },
          right: { style: BorderStyle.SINGLE, size: 4 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4 },
          insideVertical: { style: BorderStyle.SINGLE, size: 4 },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 16, type: WidthType.PERCENTAGE },
                children: [textPara('Bench', { bold: true })],
              }),
              new TableCell({
                width: { size: 84, type: WidthType.PERCENTAGE },
                children: [textPara('Seats (roll — subject)', { bold: true })],
              }),
            ],
          }),
          ...m.benchPlan.map(
            (bench, i) =>
              new TableRow({
                children: [
                  new TableCell({ children: [textPara(String(i + 1))] }),
                  new TableCell({
                    children: [
                      bench.length > 0
                        ? rollPara(bench.map((s) => `${s.roll} (${s.subjectCode})`).join('    '))
                        : textPara('— empty —'),
                    ],
                  }),
                ],
              }),
          ),
        ],
      }),
    );
  }

  return children;
}

export async function buildDocx(models: SheetModel[]): Promise<Blob> {
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: models.map((m) => ({
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } },
      },
      children: sheetChildren(m),
    })),
  });
  return Packer.toBlob(doc);
}
