// Node harness: runs the app's real parsers against sample PDFs.
// Usage: npx tsx scripts/test-parse.mts
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildLines, type PageLines, type TextItemLike } from '../src/lib/pdfText';
import { parseTopSheetPages } from '../src/lib/parseTopSheet';
import { parseAllotment } from '../src/lib/parseAllotment';
import { allocateRooms, buildBenchPlan } from '../src/lib/allocate';
import { rollLines } from '../src/lib/rollFormat';
import type { Room } from '../src/types';

async function extractPages(path: string): Promise<PageLines[]> {
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data }).promise;
  const pages: PageLines[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(buildLines(content.items as unknown as TextItemLike[]));
  }
  return pages;
}

const TOP_SHEET =
  '/Users/ritwikbalo/MEGAsync/RBGC/EXAMS/OIC Work Sem 2 July 2024/Top Sheets before attendance/CCF/Top Sheet Example_CCF_13-09-24_1st_TOP_SHEET_033_B.A._Four Year_06-09-2024_11-12.pdf';
const ALLOTMENT =
  '/Users/ritwikbalo/MEGAsync/RBGC/EXAMS/OIC Work Sem 2 July 2024/Downloads/Allotment/Allotment_of_Seats_Theoretical_033_31-08-2024_10-45.pdf';

console.log('=== TOP SHEET PARSE ===');
const tsPages = await extractPages(TOP_SHEET);
console.log(`PDF has ${tsPages.length} pages`);
const sheets = parseTopSheetPages(tsPages, 'topsheet.pdf');
for (const s of sheets) {
  console.log({
    subjectCode: s.subjectCode,
    paper: s.paper,
    course: s.course,
    examName: s.examName,
    date: s.date,
    session: s.session,
    centreCode: s.centreCode,
    packetNo: s.packetNo,
    expectedCount: s.expectedCount,
    rollCount: s.rolls.length,
    firstRolls: s.rolls.slice(0, 3),
    lastRoll: s.rolls[s.rolls.length - 1],
    page: s.sourcePage,
  });
}

console.log('\n=== ALLOTMENT PARSE ===');
const alPages = await extractPages(ALLOTMENT);
const allot = parseAllotment(alPages, 'allotment.pdf');
console.log('centre:', allot.centre);
console.log('examName:', allot.examName);
for (const r of allot.ranges) {
  console.log(`${r.collegeCode} ${r.collegeName} | ${r.category} | ${r.rollCode} ${r.from}-${r.to} (${r.count})`);
}

console.log('\n=== ALLOCATION + BENCH PLAN ===');
const rooms: Room[] = [
  { id: 'r1', number: '101', capacity: 12, building: '', active: true, bench: { benchCount: 6, seatsPerBench: 2 } },
  { id: 'r2', number: '102', capacity: 20, building: '', active: true, bench: null },
];
const plans = allocateRooms(rooms, sheets);
for (const p of plans) {
  const room = rooms.find((r) => r.id === p.roomId)!;
  const seated = p.groups.reduce((n, g) => n + g.rolls.length, 0);
  console.log(`Room ${room.number}: ${seated}/${room.capacity}`, p.groups.map((g) => `${g.subjectCode}(${g.rolls.length})`).join(' + '));
}
const seq = buildBenchPlan(plans[0], rooms[0], 'sequential');
const inter = buildBenchPlan(plans[0], rooms[0], 'interleave');
console.log('sequential benches:', seq?.map((b) => b.map((s) => s.subjectCode).join(',')));
console.log('interleave benches:', inter?.map((b) => b.map((s) => s.subjectCode).join(',')));

console.log('\n=== ROLL DISPLAY MODES ===');
console.log('full:', rollLines(sheets[0].rolls.slice(0, 8), 'full', 4));
console.log('grouped:', rollLines(sheets[0].rolls.slice(0, 8), 'grouped', 4));
