import type { AppState, Arrangement, BenchPlan, CopyType, ExportContent, RollDisplay, Room, RoomPlan } from '../types';
import { buildBenchPlan } from './allocate';
import { rollLines } from './rollFormat';

export interface RollBlock {
  subjectCode: string;
  count: number;
  lines: string[];
  // Raw rolls kept so a renderer can re-pack lines at a different width
  // (the PDF shrinks the font when a room has many roll numbers).
  rolls: string[];
}

export interface SheetModel {
  centreName: string;
  centreAddress: string;
  examName: string;
  dateDay: string;
  timeSlot: string; // session + entered time, e.g. "MORNING, 10:00 A.M. – 12:00 Noon"
  session: string;
  roomNumber: string;
  // What the "Room No." row prints — notice copies add the building/floor,
  // e.g. "101 (Ground Floor)", for students new to the centre.
  roomNoDisplay: string;
  subjectsSummary: string; // e.g. "MPLS (18); MSOC (4);"
  rollDisplay: RollDisplay;
  rollBlocks: RollBlock[];
  total: number;
  benchPlan: BenchPlan | null;
  includeSeating: boolean;
  // Invigilator copies carry the blank Present/Absent/Signature rows;
  // notice copies (posted outside rooms for students) omit them.
  showAttendance: boolean;
}

export interface SheetOptions {
  display: RollDisplay;
  copyType: CopyType;
  content: ExportContent;
}

const MAX_LINE_CHARS = 48; // character budget per printed roll line — deliberately airy
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayOfDate(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  return Number.isNaN(d.getTime()) ? '' : WEEKDAYS[d.getDay()];
}

export function buildSheetModel(
  state: AppState,
  arrangement: Arrangement,
  plan: RoomPlan,
  room: Room,
  opts: SheetOptions,
): SheetModel {
  const day = dayOfDate(arrangement.date);
  const subjectsSummary = plan.groups.map((g) => `${g.subjectCode} (${g.rolls.length})`).join(';  ') + (plan.groups.length ? ';' : '');
  const rollBlocks: RollBlock[] = plan.groups.map((g) => ({
    subjectCode: g.subjectCode,
    count: g.rolls.length,
    lines: rollLines(g.rolls, opts.display, MAX_LINE_CHARS),
    rolls: g.rolls,
  }));
  const total = plan.groups.reduce((n, g) => n + g.rolls.length, 0);
  const examName = state.exam.name + (state.exam.scheme ? ` (${state.exam.scheme})` : '');
  const timeSlot = [arrangement.session, arrangement.timeSlot].filter(Boolean).join(', ');

  return {
    centreName: state.centre.name,
    centreAddress: state.centre.address,
    examName,
    dateDay: day ? `${arrangement.date} (${day})` : arrangement.date,
    timeSlot,
    session: arrangement.session,
    roomNumber: room.number,
    roomNoDisplay:
      opts.copyType === 'notice' && room.building.trim() ? `${room.number} (${room.building.trim()})` : room.number,
    subjectsSummary,
    rollDisplay: opts.display,
    rollBlocks,
    total,
    benchPlan: opts.content === 'seating' ? null : buildBenchPlan(plan, room, arrangement.benchMode),
    includeSeating: opts.content !== 'bench',
    showAttendance: opts.copyType === 'invigilator',
  };
}

export function buildAllSheetModels(state: AppState, arrangement: Arrangement, opts: SheetOptions): SheetModel[] {
  const roomById = new Map(state.rooms.map((r) => [r.id, r]));
  return arrangement.roomPlans
    .filter((p) => p.groups.length > 0 && roomById.has(p.roomId))
    .map((p) => buildSheetModel(state, arrangement, p, roomById.get(p.roomId)!, opts))
    .filter((m) => m.includeSeating || m.benchPlan !== null);
}
