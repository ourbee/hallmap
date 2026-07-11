import type { BenchMode, BenchPlan, Room, RoomPlan, SubjectGroup, TopSheet } from '../types';

export function roomCapacity(room: Room): number {
  return room.capacity;
}

const byRoomNumber = (a: Room, b: Room) => a.number.localeCompare(b.number, undefined, { numeric: true });

// Allocation goals, in order:
//  1. use as few rooms as possible (largest available rooms are chosen first);
//  2. keep all students of a subject in one room — a subject is split across
//     rooms only when no chosen room can hold it whole (eases script collection);
//  3. locked plans are preserved; their rolls are removed from the pool first.
export function allocateRooms(rooms: Room[], sheets: TopSheet[], lockedPlans: RoomPlan[] = []): RoomPlan[] {
  const activeRooms = rooms.filter((r) => r.active).sort(byRoomNumber);

  const lockedByRoom = new Map(lockedPlans.filter((p) => p.locked).map((p) => [p.roomId, p]));
  const lockedRolls = new Set<string>();
  for (const plan of lockedByRoom.values()) {
    for (const g of plan.groups) for (const r of g.rolls) lockedRolls.add(r);
  }

  // Remaining pool, in sheet order, minus rolls already seated in locked rooms
  const pool: SubjectGroup[] = sheets
    .map((s) => ({
      topSheetId: s.id,
      subjectCode: s.subjectCode || s.paper || 'SUBJECT',
      rolls: s.rolls.filter((r) => !lockedRolls.has(r)),
    }))
    .filter((g) => g.rolls.length > 0);
  const totalStudents = pool.reduce((n, g) => n + g.rolls.length, 0);

  // Fewest rooms: take the largest unlocked rooms until capacity covers everyone.
  const candidates = activeRooms.filter((r) => !lockedByRoom.has(r.id));
  const byCapacityDesc = [...candidates].sort((a, b) => b.capacity - a.capacity || byRoomNumber(a, b));
  const chosen: Room[] = [];
  let chosenCapacity = 0;
  for (const room of byCapacityDesc) {
    if (chosenCapacity >= totalStudents) break;
    chosen.push(room);
    chosenCapacity += roomCapacity(room);
  }
  chosen.sort(byRoomNumber);

  const free = new Map(chosen.map((r) => [r.id, roomCapacity(r)]));
  const groupsByRoom = new Map<string, SubjectGroup[]>(chosen.map((r) => [r.id, []]));

  // Whole-subject placement: biggest subjects first, each into the room whose
  // remaining space fits it most tightly (leaves big gaps for big subjects).
  const bySizeDesc = [...pool].sort((a, b) => b.rolls.length - a.rolls.length);
  const unplaced: SubjectGroup[] = [];
  for (const g of bySizeDesc) {
    let best: Room | null = null;
    for (const room of chosen) {
      const f = free.get(room.id)!;
      if (f >= g.rolls.length && (best === null || f < free.get(best.id)!)) best = room;
    }
    if (best) {
      groupsByRoom.get(best.id)!.push(g);
      free.set(best.id, free.get(best.id)! - g.rolls.length);
    } else {
      unplaced.push(g);
    }
  }

  // Whatever could not fit whole is split across the largest remaining gaps.
  for (const g of unplaced) {
    let offset = 0;
    const gaps = [...chosen].sort((a, b) => free.get(b.id)! - free.get(a.id)! || byRoomNumber(a, b));
    for (const room of gaps) {
      if (offset >= g.rolls.length) break;
      const take = Math.min(free.get(room.id)!, g.rolls.length - offset);
      if (take <= 0) continue;
      groupsByRoom.get(room.id)!.push({ ...g, rolls: g.rolls.slice(offset, offset + take) });
      free.set(room.id, free.get(room.id)! - take);
      offset += take;
    }
    // Anything still left over is unseated (session larger than total capacity);
    // the validation warnings surface that.
  }

  // Emit plans for every active room in number order, listing each room's
  // subjects in top-sheet order.
  const sheetOrder = new Map(sheets.map((s, i) => [s.id, i]));
  return activeRooms.map((room) => {
    const locked = lockedByRoom.get(room.id);
    if (locked) return locked;
    const groups = (groupsByRoom.get(room.id) ?? []).sort(
      (a, b) => (sheetOrder.get(a.topSheetId) ?? 0) - (sheetOrder.get(b.topSheetId) ?? 0),
    );
    return { roomId: room.id, groups, locked: false };
  });
}

export function unassignedCount(sheets: TopSheet[], plans: RoomPlan[]): number {
  const total = sheets.reduce((n, s) => n + s.rolls.length, 0);
  const seated = plans.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.rolls.length, 0), 0);
  return total - seated;
}

// --- Bench plans ---------------------------------------------------------

// sequential: keep subject blocks together, fill bench by bench.
// interleave: bench-mates get different subjects wherever possible (anti-copying).
export function buildBenchPlan(plan: RoomPlan, room: Room, mode: BenchMode): BenchPlan | null {
  if (!room.bench || room.bench.benchCount <= 0 || room.bench.seatsPerBench <= 0) return null;
  const { benchCount, seatsPerBench } = room.bench;

  if (mode === 'sequential') {
    const flat = plan.groups.flatMap((g) => g.rolls.map((roll) => ({ roll, subjectCode: g.subjectCode })));
    const benches: BenchPlan = [];
    for (let b = 0; b < benchCount; b++) {
      benches.push(flat.slice(b * seatsPerBench, (b + 1) * seatsPerBench));
    }
    return benches;
  }

  // Interleave: greedy — for each seat on a bench, take the next student from the
  // largest remaining subject queue whose subject isn't already on this bench.
  const queues = plan.groups.map((g) => ({
    subjectCode: g.subjectCode,
    rolls: [...g.rolls],
  }));
  const benches: BenchPlan = [];
  for (let b = 0; b < benchCount; b++) {
    const bench: { roll: string; subjectCode: string }[] = [];
    const onBench = new Set<string>();
    for (let s = 0; s < seatsPerBench; s++) {
      const candidates = queues.filter((q) => q.rolls.length > 0);
      if (candidates.length === 0) break;
      const fresh = candidates.filter((q) => !onBench.has(q.subjectCode));
      const pool = fresh.length > 0 ? fresh : candidates;
      pool.sort((a, b2) => b2.rolls.length - a.rolls.length);
      const pick = pool[0];
      bench.push({ roll: pick.rolls.shift()!, subjectCode: pick.subjectCode });
      onBench.add(pick.subjectCode);
    }
    benches.push(bench);
  }
  return benches;
}

// Move a whole subject group from one room plan to another (manual adjustment).
export function moveGroup(plans: RoomPlan[], fromRoomId: string, groupIndex: number, toRoomId: string): RoomPlan[] {
  return plans.map((p) => {
    if (p.roomId === fromRoomId) {
      return { ...p, groups: p.groups.filter((_, i) => i !== groupIndex) };
    }
    if (p.roomId === toRoomId) {
      const source = plans.find((x) => x.roomId === fromRoomId);
      const group = source?.groups[groupIndex];
      if (!group) return p;
      // Merge with an existing block of the same sheet if present
      const existing = p.groups.findIndex((g) => g.topSheetId === group.topSheetId);
      if (existing >= 0) {
        const merged = [...p.groups];
        merged[existing] = { ...merged[existing], rolls: [...merged[existing].rolls, ...group.rolls] };
        return { ...p, groups: merged };
      }
      return { ...p, groups: [...p.groups, group] };
    }
    return p;
  });
}
