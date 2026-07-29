/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

export interface CentreProfile {
  name: string;
  code: string;
  address: string;
  phone: string;
  zone: string;
}

export interface ExamProfile {
  name: string;
  scheme: string;
  year: string;
}

export interface BenchConfig {
  benchCount: number;
  seatsPerBench: number;
}

export interface Room {
  id: string;
  number: string;
  capacity: number;
  building: string;
  active: boolean;
  bench: BenchConfig | null;
}

export interface TopSheet {
  id: string;
  subjectCode: string;
  paper: string;
  course: string;
  examName: string;
  date: string; // dd/mm/yyyy
  session: string; // MORNING / AFTERNOON
  centreCode: string;
  packetNo: string;
  expectedCount: number | null;
  rolls: string[];
  sourceFile: string;
  sourcePage: number;
}

export interface AllotmentRange {
  id: string;
  collegeCode: string;
  collegeName: string;
  category: string;
  rollCode: string;
  from: string;
  to: string;
  count: number | null;
}

export interface SubjectGroup {
  topSheetId: string;
  subjectCode: string;
  rolls: string[];
}

export interface RoomPlan {
  roomId: string;
  groups: SubjectGroup[];
  locked: boolean;
}

export type BenchMode = 'sequential' | 'interleave';
export type RollDisplay = 'full' | 'grouped';

export interface Arrangement {
  id: string; // `${date}|${session}`
  date: string;
  session: string;
  timeSlot: string;
  roomPlans: RoomPlan[];
  benchMode: BenchMode;
  generatedAt: number;
}

export type CopyType = 'invigilator' | 'notice';
export type ExportContent = 'both' | 'seating' | 'bench';

export interface ExportPrefs {
  rollDisplay: RollDisplay;
  copyType: CopyType;
  content: ExportContent;
}

export interface ImportPrefs {
  // An example roll number typed by the user (e.g. "232035-11-0026").
  // When set, a matching pattern is derived from it and used to recognise
  // roll numbers that the built-in patterns miss.
  rollExample: string;
}

export interface AppState {
  centre: CentreProfile;
  exam: ExamProfile;
  rooms: Room[];
  topSheets: TopSheet[];
  allotment: AllotmentRange[];
  arrangements: Arrangement[];
  exportPrefs: ExportPrefs;
  importPrefs: ImportPrefs;
  // Session last worked on in Arrange; Export follows it automatically.
  activeSessionId: string;
}

export interface BenchSeat {
  roll: string;
  subjectCode: string;
}

export type BenchPlan = BenchSeat[][]; // bench index -> seats

export const emptyState = (): AppState => ({
  centre: { name: '', code: '', address: '', phone: '', zone: '' },
  exam: { name: '', scheme: '', year: '' },
  rooms: [],
  topSheets: [],
  allotment: [],
  arrangements: [],
  exportPrefs: { rollDisplay: 'full', copyType: 'invigilator', content: 'both' },
  importPrefs: { rollExample: '' },
  activeSessionId: '',
});
