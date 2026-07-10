import type { AllotmentRange, Room, RoomPlan, TopSheet } from '../types';
import { splitRoll } from './rollFormat';

export interface Warning {
  level: 'error' | 'warn';
  message: string;
}

export function validateSession(
  sheets: TopSheet[],
  rooms: Room[],
  centreCode: string,
  allotment: AllotmentRange[],
): Warning[] {
  const warnings: Warning[] = [];

  for (const s of sheets) {
    if (s.expectedCount !== null && s.expectedCount !== s.rolls.length) {
      warnings.push({
        level: 'warn',
        message: `${s.subjectCode || s.sourceFile}: top sheet says ${s.expectedCount} candidates but ${s.rolls.length} roll numbers were extracted.`,
      });
    }
    if (centreCode && s.centreCode && s.centreCode !== centreCode) {
      warnings.push({
        level: 'warn',
        message: `${s.subjectCode || s.sourceFile}: centre code ${s.centreCode} does not match this centre (${centreCode}).`,
      });
    }
  }

  // Duplicates across sheets in the same session
  const seen = new Map<string, string>();
  for (const s of sheets) {
    for (const r of s.rolls) {
      const prev = seen.get(r);
      if (prev && prev !== s.id) {
        warnings.push({ level: 'error', message: `Roll ${r} appears in more than one top sheet for this session.` });
      }
      seen.set(r, s.id);
    }
  }

  const totalStudents = sheets.reduce((n, s) => n + s.rolls.length, 0);
  const totalCapacity = rooms.filter((r) => r.active).reduce((n, r) => n + r.capacity, 0);
  if (totalStudents > totalCapacity) {
    warnings.push({
      level: 'error',
      message: `Total students (${totalStudents}) exceed total active room capacity (${totalCapacity}).`,
    });
  }

  if (allotment.length > 0) {
    const outside: string[] = [];
    for (const s of sheets) {
      for (const r of s.rolls) {
        const { prefix, serial } = splitRoll(r);
        const inRange = allotment.some(
          (a) =>
            a.rollCode === prefix &&
            serial.padStart(6, '0') >= a.from.padStart(6, '0') &&
            serial.padStart(6, '0') <= a.to.padStart(6, '0'),
        );
        if (!inRange) outside.push(r);
      }
    }
    if (outside.length > 0) {
      warnings.push({
        level: 'warn',
        message: `${outside.length} roll number(s) fall outside the allotment ranges (e.g. ${outside.slice(0, 3).join(', ')}).`,
      });
    }
  }

  return warnings;
}

export function validatePlans(plans: RoomPlan[], rooms: Room[], sheets: TopSheet[]): Warning[] {
  const warnings: Warning[] = [];
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  for (const p of plans) {
    const room = roomById.get(p.roomId);
    if (!room) continue;
    const seated = p.groups.reduce((n, g) => n + g.rolls.length, 0);
    if (seated > room.capacity) {
      warnings.push({ level: 'error', message: `Room ${room.number} holds ${seated} students but capacity is ${room.capacity}.` });
    }
    if (room.bench && seated > room.bench.benchCount * room.bench.seatsPerBench) {
      warnings.push({
        level: 'warn',
        message: `Room ${room.number}: ${seated} students exceed bench seats (${room.bench.benchCount} benches × ${room.bench.seatsPerBench}).`,
      });
    }
  }

  const total = sheets.reduce((n, s) => n + s.rolls.length, 0);
  const seated = plans.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.rolls.length, 0), 0);
  if (seated < total) {
    warnings.push({ level: 'error', message: `${total - seated} student(s) are not seated in any room.` });
  }

  return warnings;
}
