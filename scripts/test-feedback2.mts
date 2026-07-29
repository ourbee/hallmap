/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Harness for feedback round 2: allocation (fewest rooms, whole subjects)
// and PDF pagination/auto-shrink. Writes PDFs to the scratch dir for review.
import { writeFileSync } from 'node:fs';
import { allocateRooms } from '../src/lib/allocate.ts';
import { buildPdf } from '../src/lib/exportPdf.ts';
import type { SheetModel } from '../src/lib/exportModel.ts';
import { rollLines } from '../src/lib/rollFormat.ts';
import type { Room, TopSheet } from '../src/types.ts';

const OUT = process.argv[2] ?? '.';

const mkRolls = (prefix: string, from: number, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}-${String(from + i).padStart(4, '0')}`);

const sheet = (id: string, code: string, rolls: string[]): TopSheet => ({
  id, subjectCode: code, paper: '', course: '', examName: '', date: '05/09/2024',
  session: 'MORNING', centreCode: '', packetNo: '', expectedCount: rolls.length,
  rolls, sourceFile: 'test', sourcePage: 1,
});

const room = (id: string, number: string, capacity: number): Room => ({
  id, number, capacity, building: '', active: true, bench: null,
});

// --- allocation tests -----------------------------------------------------
const rooms = [room('a', '102', 24), room('b', '201', 40), room('c', '307', 45), room('d', '311', 60)];
const sheets = [
  sheet('s1', 'EGNM', mkRolls('232035-11', 10, 40)),
  sheet('s2', 'EDCM', mkRolls('232036-11', 2, 9)),
  sheet('s3', 'HISM', mkRolls('232037-11', 49, 14)),
  sheet('s4', 'JORM', mkRolls('232038-11', 57, 22)),
  sheet('s5', 'PLSM', mkRolls('232039-11', 79, 15)),
  sheet('s6', 'ZOOM', mkRolls('233040-11', 9, 10)),
];
const total = sheets.reduce((n, s) => n + s.rolls.length, 0); // 110

const plans = allocateRooms(rooms, sheets);
const used = plans.filter((p) => p.groups.length > 0);
const seated = plans.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.rolls.length, 0), 0);
const splitSubjects = sheets.filter((s) => plans.filter((p) => p.groups.some((g) => g.topSheetId === s.id)).length > 1);

console.log(`students=${total} seated=${seated} roomsUsed=${used.length} (capacities: 60+45+40 = 145, 60+45 = 105 < 110 so 3 rooms is minimal)`);
for (const p of plans) {
  const r = rooms.find((x) => x.id === p.roomId)!;
  console.log(`  Room ${r.number} (${r.capacity}):`, p.groups.map((g) => `${g.subjectCode}(${g.rolls.length})`).join(' ') || 'empty');
}
console.log('split subjects:', splitSubjects.map((s) => s.subjectCode).join(', ') || 'none');
if (seated !== total) throw new Error('not everyone seated');
if (used.length !== 3) throw new Error('expected 3 rooms used');

// No duplicate/lost rolls
const all = plans.flatMap((p) => p.groups.flatMap((g) => g.rolls));
if (new Set(all).size !== all.length) throw new Error('duplicate rolls across rooms');

// Overfull check
for (const p of plans) {
  const r = rooms.find((x) => x.id === p.roomId)!;
  const n = p.groups.reduce((m, g) => m + g.rolls.length, 0);
  if (n > r.capacity) throw new Error(`room ${r.number} overfull: ${n}/${r.capacity}`);
}
console.log('allocation OK\n');

// --- PDF tests ------------------------------------------------------------
const model = (roomNo: string, blocks: [string, string[]][], showAttendance: boolean): SheetModel => ({
  centreName: 'ABC College',
  centreAddress: '',
  examName: 'Four/Three Year B.A./B.Sc. and Four Year B.A./B.Sc. (Voc.) SEMESTER - II Examination, 2024 (Under CCF, 2022)',
  dateDay: '05/09/2024 (Thursday)',
  timeSlot: 'MORNING, 10 AM to 1 PM',
  session: 'MORNING',
  roomNumber: roomNo,
  roomNoDisplay: `${roomNo} (Third Floor)`,
  subjectsSummary: blocks.map(([c, r]) => `${c} (${r.length})`).join(';  ') + ';',
  rollDisplay: 'full',
  rollBlocks: blocks.map(([c, r]) => ({ subjectCode: c, count: r.length, rolls: r, lines: rollLines(r, 'full', 48) })),
  total: blocks.reduce((n, [, r]) => n + r.length, 0),
  benchPlan: null,
  includeSeating: true,
  showAttendance,
});

// Case 1: the exact shape that broke — room 311, 56 students, 6 subjects, notice copy.
const room311 = model('311', [
  ['ZOOM', mkRolls('233035-11', 23, 1)],
  ['GEOM', mkRolls('233042-11', 41, 1)],
  ['EGNM', mkRolls('232042-11', 7, 25)],
  ['GEOM', mkRolls('232035-11', 35, 23)],
  ['BGNM', mkRolls('232042-11', 1, 3)],
  ['BOTM', mkRolls('233035-11', 1, 3)],
], false);

// Case 2: extreme — 150 students in one room, invigilator copy (must paginate cleanly).
const big = model('HALL-1', [
  ['AAAM', mkRolls('232042-11', 1, 60)],
  ['BBBM', mkRolls('232043-11', 1, 50)],
  ['CCCM', mkRolls('232044-11', 1, 40)],
], true);

// Case 3: small room, invigilator copy — must stay at full size.
const small = model('102', [['EGNM', mkRolls('232035-11', 10, 15)], ['EDCM', mkRolls('232035-11', 2, 9)]], true);

for (const [name, models] of [['room311-notice', [room311]], ['big-150', [big]], ['small-24', [small]]] as const) {
  const blob = buildPdf(models as SheetModel[]);
  const buf = Buffer.from(await blob.arrayBuffer());
  writeFileSync(`${OUT}/test-${name}.pdf`, buf);
  console.log(`wrote ${OUT}/test-${name}.pdf (${(buf.length / 1024).toFixed(1)} kB)`);
}
