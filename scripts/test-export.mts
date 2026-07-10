import { readFileSync, writeFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildLines, type PageLines, type TextItemLike } from '../src/lib/pdfText';
import { parseTopSheetPages } from '../src/lib/parseTopSheet';
import { allocateRooms } from '../src/lib/allocate';
import { buildAllSheetModels } from '../src/lib/exportModel';
import { buildPdf } from '../src/lib/exportPdf';
import { buildDocx } from '../src/lib/exportDocx';
import { emptyState, type Arrangement, type Room } from '../src/types';

const OUT = '/private/tmp/claude-501/-Users-ritwikbalo-Desktop-My-Apps/f9b0b1c5-7642-4594-8d57-3a9ea8035840/scratchpad';

async function extractPages(path: string): Promise<PageLines[]> {
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data }).promise;
  const pages: PageLines[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    pages.push(buildLines((await page.getTextContent()).items as unknown as TextItemLike[]));
  }
  return pages;
}

const sheets = parseTopSheetPages(
  await extractPages('/Users/ritwikbalo/MEGAsync/RBGC/EXAMS/OIC Work Sem 2 July 2024/Top Sheets before attendance/CCF/Top Sheet Example_CCF_13-09-24_1st_TOP_SHEET_033_B.A._Four Year_06-09-2024_11-12.pdf'),
  'topsheet.pdf',
);

const rooms: Room[] = [
  { id: 'r1', number: '101', capacity: 10, building: '', active: true, bench: { benchCount: 5, seatsPerBench: 2 } },
  { id: 'r2', number: '201', capacity: 12, building: '', active: true, bench: { benchCount: 6, seatsPerBench: 2 } },
];

const state = {
  ...emptyState(),
  centre: { name: "RANI BIRLA GIRLS' COLLEGE", code: '033', address: '38, Shakespeare Sarani, Kolkata - 700 017', phone: '', zone: '' },
  exam: { name: 'Four Year B.A. Semester - II Examination, 2024', scheme: 'Under CCF, 2022', year: '2024' },
  rooms,
  topSheets: sheets,
};

const arrangement: Arrangement = {
  id: '13/09/2024|MORNING',
  date: '13/09/2024',
  session: 'MORNING',
  timeSlot: '10:00 A.M. – 12:00 Noon',
  benchMode: 'interleave',
  roomPlans: allocateRooms(rooms, sheets),
  generatedAt: Date.now(),
};

for (const display of ['full', 'grouped'] as const) {
  const models = buildAllSheetModels(state, arrangement, display);
  const pdfBlob = buildPdf(models);
  writeFileSync(`${OUT}/test-${display}.pdf`, Buffer.from(await pdfBlob.arrayBuffer()));
  const docxBlob = await buildDocx(models);
  writeFileSync(`${OUT}/test-${display}.docx`, Buffer.from(await docxBlob.arrayBuffer()));
}
console.log('files written');

// Read the generated PDF back and dump its text to prove layout content
const pages = await extractPages(`${OUT}/test-full.pdf`);
pages.forEach((p, i) => {
  console.log(`--- generated PDF page ${i + 1} ---`);
  console.log(p.raw.slice(0, 900));
});
