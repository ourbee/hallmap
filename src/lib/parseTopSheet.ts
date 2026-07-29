/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import type { TopSheet } from '../types';
import type { PageLines } from './pdfText';
import { makeId } from './id';

// Primary roll-number pattern seen in University of Calcutta documents: 232035-11-0003
const ROLL_HYPHEN = /\b(\d{4,8}-\d{1,3}-\d{3,6})\b/g;
// Fallback for boards that use plain long numeric rolls
const ROLL_PLAIN = /\b(\d{8,14})\b/g;
const DATE_RE = /\b(\d{2}\/\d{2}\/\d{4})\b/;
const SESSION_RE = /\b(MORNING|AFTERNOON|EVENING|1ST HALF|2ND HALF)\b/i;
// e.g. 033/MPLS2/M/1  → centre 033, subject MPLS
const PACKET_RE = /\b(\d{2,4})\/([A-Z]+)\d*\/[A-Z]+\/\d+\b/;

// Build a matching pattern from an example roll number the user typed.
// Digit runs become \d{n}, letter runs [A-Za-z]{n}, everything else is
// matched literally: "232035-11-0026" → /\d{6}-\d{2}-\d{4}/g
export function patternFromExample(example: string): RegExp | null {
  const trimmed = example.trim();
  if (!trimmed) return null;
  let src = '';
  for (const run of trimmed.match(/\d+|[A-Za-z]+|./gs) ?? []) {
    if (/^\d+$/.test(run)) src += `\\d{${run.length}}`;
    else if (/^[A-Za-z]+$/.test(run)) src += `[A-Za-z]{${run.length}}`;
    else src += run.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  try {
    return new RegExp(`\\b${src}\\b`, 'g');
  } catch {
    return null;
  }
}

export function extractRolls(text: string, rollExample = ''): string[] {
  const custom = patternFromExample(rollExample);
  if (custom) {
    const found = [...text.matchAll(custom)].map((m) => m[0]);
    if (found.length > 0) return dedupe(found);
  }
  const hyphenated = [...text.matchAll(ROLL_HYPHEN)].map((m) => m[1]);
  if (hyphenated.length > 0) return dedupe(hyphenated);
  const dates = new Set([...text.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)].map((m) => m[0].replace(/\//g, '')));
  const plain = [...text.matchAll(ROLL_PLAIN)].map((m) => m[1]).filter((r) => !dates.has(r));
  return dedupe(plain);
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

function firstCapture(lines: string[], re: RegExp): string {
  for (const line of lines) {
    const m = line.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return '';
}

// The printed candidate total floats inside the roll-number block (right edge),
// so look for a small standalone number within that region, ignoring the rolls
// themselves.
function findExpectedCount(lines: string[], rolls: Set<string>): number | null {
  let start = lines.findIndex((l) => /Enrolled for the examination|Total Number/i.test(l));
  if (start < 0) start = 0;
  for (let i = start; i < lines.length; i++) {
    if (/Signature|Enclosures|^Date\s*-/i.test(lines[i])) break;
    let cleaned = lines[i];
    for (const r of rolls) cleaned = cleaned.split(r).join(' ');
    if (/Enrolled|Total Number/i.test(cleaned) && !/:\s*\d/.test(cleaned)) continue;
    const m = cleaned.match(/(?:^|\s)(\d{1,4})(?:\s|$)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

// Parse a single page of a top-sheet PDF into a TopSheet (or null if the page
// clearly isn't a top sheet — e.g. no roll numbers at all).
export function parseTopSheetPage(page: PageLines, sourceFile: string, pageNo: number, rollExample = ''): TopSheet | null {
  const { lines, raw } = page;
  const rolls = extractRolls(raw, rollExample);
  if (rolls.length === 0) return null;

  const packetMatch = raw.match(PACKET_RE);

  let subjectCode = firstCapture(lines, /Subject\/?\s*Group\s*[-:]\s*([A-Z0-9&.]{2,12})\b/i) || (packetMatch?.[2] ?? '');
  if (!subjectCode) {
    const stop = new Set(['THE', 'AND', 'FOR', 'PDF', 'TOP', 'ROLL', 'DATE', 'YEAR', 'EXAM']);
    for (const line of lines) {
      const m = line.match(/^([A-Z]{3,8})$/);
      if (m && !stop.has(m[1])) {
        subjectCode = m[1];
        break;
      }
    }
  }

  // On University of Calcutta sheets the "Course" field carries the paper code (e.g. MN-2)
  const paper = firstCapture(lines, /Course\s*[-:]\s*([A-Z0-9/-]{1,12})\b/) || (raw.match(/\b([A-Z]{1,4}-\d{1,2})\b/)?.[1] ?? '');

  let examName = firstCapture(lines, /^Examination\s*[-:]\s*(.+)$/i);
  if (!examName) {
    for (const line of lines) {
      if (/Examinations?,?\s*\d{4}/i.test(line) && !/to be pasted|hereunder|stated/i.test(line)) {
        examName = line.trim();
        break;
      }
    }
  }
  const course = examName.match(/^(.*?)\s+Semester/i)?.[1]?.trim() ?? '';

  const date = firstCapture(lines, /Date of Examination\s*[-:]\s*(\d{2}\/\d{2}\/\d{4})/i) || (raw.match(DATE_RE)?.[1] ?? '');
  const session = (firstCapture(lines, /Session[^-:]*[-:]\s*(MORNING|AFTERNOON|EVENING)/i) || (raw.match(SESSION_RE)?.[1] ?? '')).toUpperCase();
  const centreCode = firstCapture(lines, /Centre Code\s*[-:]\s*(\d{2,5})\b/i) || (packetMatch?.[1] ?? '');

  return {
    id: makeId('ts-'),
    subjectCode,
    paper,
    course,
    examName,
    date,
    session,
    centreCode,
    packetNo: packetMatch?.[0] ?? '',
    expectedCount: findExpectedCount(lines, new Set(rolls)),
    rolls,
    sourceFile,
    sourcePage: pageNo,
  };
}

// Parse all pages of a PDF and de-duplicate repeated sheets (packets are often
// printed twice in the same file).
export function parseTopSheetPages(pages: PageLines[], sourceFile: string, rollExample = ''): TopSheet[] {
  const sheets: TopSheet[] = [];
  const seen = new Set<string>();
  pages.forEach((page, i) => {
    const sheet = parseTopSheetPage(page, sourceFile, i + 1, rollExample);
    if (!sheet) return;
    const key = [sheet.subjectCode, sheet.packetNo, sheet.date, sheet.session, sheet.rolls.join(',')].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    sheets.push(sheet);
  });
  return sheets;
}

// Parse manually pasted text (OCR output or hand-typed) into rolls.
export function parsePastedRolls(text: string, rollExample = ''): string[] {
  return extractRolls(text, rollExample);
}
