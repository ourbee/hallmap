import type { AppState, Arrangement, BenchPlan, RollDisplay, Room, RoomPlan } from '../types';
import { buildBenchPlan } from './allocate';
import { rollLines } from './rollFormat';

export interface RollBlock {
  subjectCode: string;
  count: number;
  lines: string[];
}

export interface SheetModel {
  centreName: string;
  centreAddress: string;
  examName: string;
  dateDay: string;
  timeSlot: string;
  session: string;
  roomNumber: string;
  subjectsSummary: string; // e.g. "MPLS (18); MSOC (4);"
  rollBlocks: RollBlock[];
  total: number;
  benchPlan: BenchPlan | null;
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
  display: RollDisplay,
): SheetModel {
  const day = dayOfDate(arrangement.date);
  const subjectsSummary = plan.groups.map((g) => `${g.subjectCode} (${g.rolls.length})`).join(';  ') + (plan.groups.length ? ';' : '');
  const rollBlocks: RollBlock[] = plan.groups.map((g) => ({
    subjectCode: g.subjectCode,
    count: g.rolls.length,
    lines: rollLines(g.rolls, display, MAX_LINE_CHARS),
  }));
  const total = plan.groups.reduce((n, g) => n + g.rolls.length, 0);
  const examName = state.exam.name + (state.exam.scheme ? ` (${state.exam.scheme})` : '');

  return {
    centreName: state.centre.name,
    centreAddress: state.centre.address,
    examName,
    dateDay: day ? `${arrangement.date} (${day})` : arrangement.date,
    timeSlot: arrangement.timeSlot,
    session: arrangement.session,
    roomNumber: room.number,
    subjectsSummary,
    rollBlocks,
    total,
    benchPlan: buildBenchPlan(plan, room, arrangement.benchMode),
  };
}

export function buildAllSheetModels(state: AppState, arrangement: Arrangement, display: RollDisplay): SheetModel[] {
  const roomById = new Map(state.rooms.map((r) => [r.id, r]));
  return arrangement.roomPlans
    .filter((p) => p.groups.length > 0)
    .map((p) => buildSheetModel(state, arrangement, p, roomById.get(p.roomId)!, display))
    .filter((m) => m.roomNumber !== undefined);
}
