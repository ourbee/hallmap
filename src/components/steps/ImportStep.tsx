import { useRef, useState } from 'react';
import { useStore } from '../../state/store';
import type { TopSheet } from '../../types';
import { makeId } from '../../lib/id';
import { extractPdfPages } from '../../lib/pdfText';
import { parseTopSheetPages, parsePastedRolls } from '../../lib/parseTopSheet';
import { parseAllotment } from '../../lib/parseAllotment';

export function ImportStep() {
  const { state, update } = useStore();
  const topRef = useRef<HTMLInputElement>(null);
  const allotRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [ocrCandidate, setOcrCandidate] = useState<File | null>(null);

  const setSheet = (id: string, patch: Partial<TopSheet>) =>
    update({ topSheets: state.topSheets.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const removeSheet = (id: string) => update({ topSheets: state.topSheets.filter((s) => s.id !== id) });

  const importTopSheets = async (files: FileList) => {
    setNotice(null);
    setOcrCandidate(null);
    const added: TopSheet[] = [];
    let emptyFile: File | null = null;
    for (const file of Array.from(files)) {
      setBusy(`Reading ${file.name}…`);
      try {
        const pages = await extractPdfPages(await file.arrayBuffer());
        const sheets = parseTopSheetPages(pages, file.name);
        if (sheets.length === 0) emptyFile = file;
        added.push(...sheets);
      } catch (err) {
        setNotice({ kind: 'error', text: `Could not read ${file.name}: ${err instanceof Error ? err.message : String(err)}` });
      }
    }
    setBusy('');
    if (added.length > 0) {
      update({ topSheets: [...state.topSheets, ...added] });
      setNotice({
        kind: 'ok',
        text: `Extracted ${added.length} top sheet(s), ${added.reduce((n, s) => n + s.rolls.length, 0)} roll numbers. Review below and correct anything the parser got wrong.`,
      });
    }
    if (emptyFile) {
      setOcrCandidate(emptyFile);
      setNotice({
        kind: 'warn',
        text: `${emptyFile.name}: no roll numbers found in the text layer — it may be a scanned copy. Try OCR below, or add a sheet manually.`,
      });
    }
  };

  const runOcr = async (file: File) => {
    try {
      const { ocrPdfPages } = await import('../../lib/ocr');
      const texts = await ocrPdfPages(await file.arrayBuffer(), setBusy);
      const pages = texts.map((t) => {
        const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        return { lines, raw: lines.join('\n') };
      });
      const sheets = parseTopSheetPages(pages, `${file.name} (OCR)`);
      setBusy('');
      if (sheets.length > 0) {
        update({ topSheets: [...state.topSheets, ...sheets] });
        setNotice({ kind: 'ok', text: `OCR extracted ${sheets.length} sheet(s) from ${file.name}. OCR output needs careful review — check every field and roll number.` });
        setOcrCandidate(null);
      } else {
        setNotice({ kind: 'error', text: `OCR could not find roll numbers in ${file.name}. Add the sheet manually below.` });
      }
    } catch (err) {
      setBusy('');
      setNotice({ kind: 'error', text: `OCR failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  const addManualSheet = () =>
    update({
      topSheets: [
        ...state.topSheets,
        {
          id: makeId('ts-'),
          subjectCode: '',
          paper: '',
          course: '',
          examName: state.exam.name,
          date: '',
          session: 'MORNING',
          centreCode: state.centre.code,
          packetNo: '',
          expectedCount: null,
          rolls: [],
          sourceFile: 'manual entry',
          sourcePage: 1,
        },
      ],
    });

  const importAllotment = async (file: File) => {
    setBusy(`Reading ${file.name}…`);
    try {
      const pages = await extractPdfPages(await file.arrayBuffer());
      const result = parseAllotment(pages, file.name);
      setBusy('');
      if (result.ranges.length === 0) {
        setNotice({ kind: 'warn', text: `No allotment ranges found in ${file.name}.` });
        return;
      }
      const centre = { ...state.centre };
      let centreFilled = false;
      if (result.centre.name && !centre.name) { centre.name = result.centre.name; centreFilled = true; }
      if (result.centre.code && !centre.code) { centre.code = result.centre.code; centreFilled = true; }
      if (result.centre.phone && !centre.phone) { centre.phone = result.centre.phone; centreFilled = true; }
      if (result.centre.zone && !centre.zone) { centre.zone = result.centre.zone; centreFilled = true; }
      const exam = { ...state.exam };
      if (result.examName && !exam.name) exam.name = result.examName;
      update({ allotment: result.ranges, centre, exam });
      setNotice({
        kind: 'ok',
        text: `Loaded ${result.ranges.length} allotment range(s)${centreFilled ? ' and filled in centre details from the letter' : ''}. Roll numbers will now be validated against these ranges.`,
      });
    } catch (err) {
      setBusy('');
      setNotice({ kind: 'error', text: `Could not read ${file.name}: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  return (
    <>
      <div className="card">
        <h2>Top Sheets</h2>
        <p className="hint">
          Upload the top-sheet PDFs for the papers being held on an exam day. One PDF may contain several subject
          sheets — each is detected separately, and duplicate copies are ignored. Everything extracted is editable
          below before you build the arrangement.
        </p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => topRef.current?.click()}>
            ⬆ Upload top sheet PDF(s)
          </button>
          <button className="btn" onClick={addManualSheet}>
            + Add a sheet manually
          </button>
          {ocrCandidate && (
            <button className="btn" onClick={() => void runOcr(ocrCandidate)}>
              🔍 Run OCR on {ocrCandidate.name}
            </button>
          )}
        </div>
        <input
          ref={topRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.length) void importTopSheets(e.target.files);
            e.target.value = '';
          }}
        />
        {busy && <p className="progress-note" style={{ marginTop: 10 }}>{busy}</p>}
        {notice && <div className={`alert ${notice.kind === 'ok' ? 'ok' : notice.kind}`} style={{ marginTop: 10 }}>{notice.text}</div>}

        {state.topSheets.map((s) => (
          <SheetEditor key={s.id} sheet={s} onChange={(p) => setSheet(s.id, p)} onRemove={() => removeSheet(s.id)} />
        ))}
      </div>

      <div className="card">
        <h2>
          Allotment Letter <span className="badge blue">optional</span>
        </h2>
        <p className="hint">
          The centre-level allotment letter is used for reference and validation only: it fills in centre details and
          lets the app warn you when an imported roll number falls outside your centre's allotted ranges.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => allotRef.current?.click()}>
            ⬆ Upload allotment PDF
          </button>
          {state.allotment.length > 0 && (
            <>
              <span className="badge green">{state.allotment.length} ranges loaded</span>
              <button className="btn small danger" onClick={() => update({ allotment: [] })}>
                Clear
              </button>
            </>
          )}
        </div>
        <input
          ref={allotRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importAllotment(f);
            e.target.value = '';
          }}
        />
        {state.allotment.length > 0 && (
          <table className="data" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>College</th>
                <th>Category</th>
                <th>Roll code</th>
                <th>From</th>
                <th>To</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {state.allotment.map((a) => (
                <tr key={a.id}>
                  <td>
                    [{a.collegeCode}] {a.collegeName}
                  </td>
                  <td>{a.category}</td>
                  <td>{a.rollCode}</td>
                  <td>{a.from}</td>
                  <td>{a.to}</td>
                  <td>{a.count ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function SheetEditor({
  sheet,
  onChange,
  onRemove,
}: {
  sheet: TopSheet;
  onChange: (patch: Partial<TopSheet>) => void;
  onRemove: () => void;
}) {
  const [rollText, setRollText] = useState<string | null>(null);
  const countMismatch = sheet.expectedCount !== null && sheet.expectedCount !== sheet.rolls.length;

  const commitRolls = (text: string) => {
    const rolls = parsePastedRolls(text);
    // If the pasted text has no recognisable pattern, fall back to whitespace tokens
    const tokens = rolls.length > 0 ? rolls : text.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
    onChange({ rolls: [...new Set(tokens)] });
    setRollText(null);
  };

  return (
    <div className="room-card" style={{ marginTop: 14 }}>
      <div className="room-head">
        <h3>{sheet.subjectCode || 'Untitled sheet'}</h3>
        <span className={`badge ${countMismatch ? 'amber' : 'green'}`}>
          {sheet.rolls.length} rolls
          {sheet.expectedCount !== null ? ` / sheet says ${sheet.expectedCount}` : ''}
        </span>
        <span className="badge blue">
          {sheet.sourceFile}
          {sheet.sourcePage ? ` · p.${sheet.sourcePage}` : ''}
        </span>
        <div className="spacer" />
        <button className="btn small danger" onClick={onRemove}>
          Remove
        </button>
      </div>
      {countMismatch && (
        <div className="alert warn">
          The sheet states {sheet.expectedCount} candidates but {sheet.rolls.length} roll numbers are listed. Check the
          roll list below.
        </div>
      )}
      <div className="grid-2">
        <div>
          <div className="grid-2">
            <div className="field">
              <label>Subject / group code</label>
              <input type="text" value={sheet.subjectCode} onChange={(e) => onChange({ subjectCode: e.target.value.toUpperCase() })} />
            </div>
            <div className="field">
              <label>Paper</label>
              <input type="text" value={sheet.paper} onChange={(e) => onChange({ paper: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Date (dd/mm/yyyy)</label>
              <input type="text" value={sheet.date} placeholder="13/09/2024" onChange={(e) => onChange({ date: e.target.value })} />
            </div>
            <div className="field">
              <label>Session</label>
              <select value={sheet.session} onChange={(e) => onChange({ session: e.target.value })}>
                <option value="MORNING">MORNING</option>
                <option value="AFTERNOON">AFTERNOON</option>
                <option value="EVENING">EVENING</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Course</label>
              <input type="text" value={sheet.course} onChange={(e) => onChange({ course: e.target.value })} />
            </div>
            <div className="field">
              <label>Expected count</label>
              <input
                type="number"
                value={sheet.expectedCount ?? ''}
                placeholder="—"
                onChange={(e) => onChange({ expectedCount: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>
        </div>
        <div className="field">
          <label>Roll numbers ({sheet.rolls.length}) — edit freely, separated by spaces or new lines</label>
          <textarea
            rows={8}
            value={rollText ?? sheet.rolls.join('\n')}
            onChange={(e) => setRollText(e.target.value)}
            onBlur={(e) => commitRolls(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
