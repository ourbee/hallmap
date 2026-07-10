import type { Room } from '../types';
import { makeId } from './id';

export const ROOMS_CSV_HEADER =
  'Room Number,Capacity,Building/Floor,Benches (optional),Seats per Bench (optional),Active (yes/no)';

export function roomsTemplateCsv(): string {
  return [
    ROOMS_CSV_HEADER,
    '101,30,Ground Floor,15,2,yes',
    '102,24,Ground Floor,,,yes',
    '201,40,First Floor,20,2,yes',
  ].join('\n');
}

export function roomsToCsv(rooms: Room[]): string {
  const lines = rooms.map((r) =>
    [
      csvEscape(r.number),
      r.capacity,
      csvEscape(r.building),
      r.bench?.benchCount ?? '',
      r.bench?.seatsPerBench ?? '',
      r.active ? 'yes' : 'no',
    ].join(','),
  );
  return [ROOMS_CSV_HEADER, ...lines].join('\n');
}

export function parseRoomsCsv(text: string): { rooms: Room[]; errors: string[] } {
  const rooms: Room[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const start = /room number/i.test(lines[0] ?? '') ? 1 : 0;

  for (let i = start; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const [number, capacity, building = '', benches = '', seats = '', active = 'yes'] = cols;
    if (!number?.trim()) continue;
    const cap = parseInt(capacity, 10);
    if (!Number.isFinite(cap) || cap <= 0) {
      errors.push(`Row ${i + 1}: capacity "${capacity}" is not a valid number.`);
      continue;
    }
    const benchCount = parseInt(benches, 10);
    const seatsPerBench = parseInt(seats, 10);
    const bench =
      Number.isFinite(benchCount) && benchCount > 0 && Number.isFinite(seatsPerBench) && seatsPerBench > 0
        ? { benchCount, seatsPerBench }
        : null;
    rooms.push({
      id: makeId('room-'),
      number: number.trim(),
      capacity: cap,
      building: building.trim(),
      active: !/^(no|n|false|0|inactive)$/i.test(active.trim()),
      bench,
    });
  }
  return { rooms, errors };
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
