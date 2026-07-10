import type { AllotmentRange, CentreProfile } from '../types';
import type { PageLines } from './pdfText';
import { makeId } from './id';

export interface AllotmentParseResult {
  centre: Partial<CentreProfile>;
  examName: string;
  ranges: AllotmentRange[];
}

const COLLEGE_RE = /\[(\d{2,5})\]\s*(.+)/;
const ROLL_CODE_RE = /\b(\d{4,8}-\d{1,3})\b/;

export function parseAllotment(pages: PageLines[], _sourceFile: string): AllotmentParseResult {
  const result: AllotmentParseResult = { centre: {}, examName: '', ranges: [] };
  let currentCollege: { code: string; name: string } | null = null;

  for (const page of pages) {
    const { lines } = page;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!result.examName) {
        const m = line.match(/^(.*Examinations?,?\s*\d{4}.*)$/i);
        if (m && !/allotment/i.test(line)) result.examName = m[1].trim();
      }

      if (/^Zone\s*:/.test(line) || (/Zone\s*:/.test(line) && !result.centre.zone)) {
        const m = (line + ' ' + (lines[i + 1] ?? '')).match(/Zone\s*:\s*\[?(\d*)\]?\s*([A-Za-z ].*?)(?:Centre|$)/);
        if (m) result.centre.zone = m[2].trim();
      }
      if (/Centre\s*:/.test(line) && !result.centre.code) {
        const scope = line + ' ' + (lines[i + 1] ?? '');
        const m = scope.match(/\[(\d{2,5})\]\s*([A-Z' .&()-]+)/);
        if (m) {
          result.centre.code = m[1];
          result.centre.name = m[2].trim();
        }
      }
      if (/Phone No/i.test(line)) {
        const m = (lines[i - 1] + ' ' + line + ' ' + (lines[i + 1] ?? '')).match(/([\d/-]{6,}(?:\/[\d-]+)*)/);
        if (m) result.centre.phone = m[1];
      }

      if (/Allotted College/i.test(line)) {
        const scope = line + ' ' + (lines[i + 1] ?? '');
        const m = scope.match(COLLEGE_RE);
        if (m) currentCollege = { code: m[1], name: m[2].replace(/Roll Code.*/i, '').trim() };
        continue;
      }

      // Data row: category text, roll code, from, to, count — may be split across
      // positioned fragments but buildLines keeps them on one visual line.
      const rc = line.match(ROLL_CODE_RE);
      if (rc && currentCollege) {
        const after = line.slice(line.indexOf(rc[1]) + rc[1].length);
        const nums = [...after.matchAll(/\b(\d{1,6})\b/g)].map((m) => m[1]);
        const category = line.slice(0, line.indexOf(rc[1])).trim();
        if (nums.length >= 2) {
          result.ranges.push({
            id: makeId('al-'),
            collegeCode: currentCollege.code,
            collegeName: currentCollege.name,
            category,
            rollCode: rc[1],
            from: nums[0],
            to: nums[1],
            count: nums.length >= 3 ? parseInt(nums[2], 10) : null,
          });
        }
      }
    }
  }

  return result;
}
