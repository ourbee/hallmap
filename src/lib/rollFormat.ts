import type { RollDisplay } from '../types';

export interface RollGroup {
  prefix: string; // e.g. "232035-11" — empty when rolls have no shared structure
  serials: string[]; // e.g. ["0003", "0024"]
}

// Split a roll like 232035-11-0003 into prefix (232035-11) and serial (0003).
export function splitRoll(roll: string): { prefix: string; serial: string } {
  const idx = roll.lastIndexOf('-');
  if (idx <= 0) return { prefix: '', serial: roll };
  return { prefix: roll.slice(0, idx), serial: roll.slice(idx + 1) };
}

export function groupByPrefix(rolls: string[]): RollGroup[] {
  const map = new Map<string, string[]>();
  for (const roll of rolls) {
    const { prefix, serial } = splitRoll(roll);
    const list = map.get(prefix) ?? [];
    list.push(serial);
    map.set(prefix, list);
  }
  return [...map.entries()].map(([prefix, serials]) => ({ prefix, serials }));
}

const SEP = '   '; // triple space between numbers so lines never look crowded

// Pack tokens onto lines without exceeding a character budget (keeps the text
// inside the value column of both the PDF and the Word table).
function packLines(tokens: string[], maxChars: number, firstPrefix = ''): string[] {
  const lines: string[] = [];
  let current = firstPrefix;
  let used = firstPrefix.length;
  let empty = firstPrefix === '';
  for (const t of tokens) {
    const addition = (empty ? 0 : SEP.length) + t.length;
    if (used + addition > maxChars && !empty) {
      lines.push(current);
      current = t;
      used = t.length;
    } else {
      current = empty ? current + t : current + SEP + t;
      used += addition;
      empty = false;
    }
  }
  if (current.trim().length > 0) lines.push(current);
  return lines;
}

// Lines of text for a subject's roll block, honouring the display preference.
export function rollLines(rolls: string[], display: RollDisplay, maxChars: number): string[] {
  if (display === 'full') {
    return packLines(rolls, maxChars);
  }
  const lines: string[] = [];
  for (const group of groupByPrefix(rolls)) {
    const label = group.prefix ? `${group.prefix} — ` : '';
    lines.push(...packLines(group.serials, maxChars, label));
  }
  return lines;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
