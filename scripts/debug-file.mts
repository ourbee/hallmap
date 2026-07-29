/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildLines, type PageLines, type TextItemLike } from '../src/lib/pdfText';
import { parseTopSheetPages } from '../src/lib/parseTopSheet';

const path = process.argv[2];
const data = new Uint8Array(readFileSync(path));
const doc = await getDocument({ data }).promise;
console.log('pages:', doc.numPages);
const pages: PageLines[] = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  pages.push(buildLines((await page.getTextContent()).items as unknown as TextItemLike[]));
}
const sheets = parseTopSheetPages(pages, 'x.pdf');
console.log('sheets:', sheets.length);
for (const s of sheets) console.log(s.subjectCode, s.paper, s.date, s.session, s.expectedCount, s.rolls.length, s.rolls[0]);
