import type { BenchMode, BenchPlan, Room, RoomPlan, SubjectGroup, TopSheet } from '../types';

export function roomCapacity(room: Room): number {
  return room.capacity;
}

// Sequential fill: sort rooms by number, walk subject groups in top-sheet order,
// fill each room to capacity, splitting a group across rooms when needed.
// Locked plans are preserved; their rolls are removed from the pool first.
export function allocateRooms(rooms: Room[], sheets: TopSheet[], lockedPlans: RoomPlan[] = []): RoomPlan[] {
  const activeRooms = rooms
    .filter((r) => r.active)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  const lockedByRoom = new Map(lockedPlans.filter((p) => p.locked).map((p) => [p.roomId, p]));
  const lockedRolls = new Set<string>();
  for (const plan of lockedByRoom.values()) {
    for (const g of plan.groups) for (const r of g.rolls) lockedRolls.add(r);
  }

  // Remaining pool, in sheet order, minus rolls already seated in locked rooms
  const queue: SubjectGroup[] = sheets
    .map((s) => ({
      topSheetId: s.id,
      subjectCode: s.subjectCode || s.paper || 'SUBJECT',
      rolls: s.rolls.filter((r) => !lockedRolls.has(r)),
    }))
    .filter((g) => g.rolls.length > 0);

  const plans: RoomPlan[] = [];
  let qi = 0;
  let offset = 0; // position within current group

  for (const room of activeRooms) {
    const locked = lockedByRoom.get(room.id);
    if (locked) {
      plans.push(locked);
      continue;
    }
    let remaining = roomCapacity(room);
    const groups: SubjectGroup[] = [];
    while (remaining > 0 && qi < queue.length) {
      const g = queue[qi];
      const take = Math.min(remaining, g.rolls.length - offset);
      if (take > 0) {
        groups.push({ topSheetId: g.topSheetId, subjectCode: g.subjectCode, rolls: g.rolls.slice(offset, offset + take) });
        remaining -= take;
        offset += take;
      }
      if (offset >= g.rolls.length) {
        qi += 1;
        offset = 0;
      }
    }
    plans.push({ roomId: room.id, groups, locked: false });
  }

  return plans;
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
