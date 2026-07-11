import { useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { useStore } from '../../state/store';
import type { CopyType, ExportContent, RollDisplay } from '../../types';
import { buildAllSheetModels } from '../../lib/exportModel';
import type { SheetModel, SheetOptions } from '../../lib/exportModel';

export function ExportStep() {
  const { state, update } = useStore();
  const [busy, setBusy] = useState('');

  // Follows the session last worked on in Arrange automatically.
  const arrangement =
    state.arrangements.find((a) => a.id === state.activeSessionId) ?? state.arrangements[0];

  const opts: SheetOptions = {
    display: state.exportPrefs.rollDisplay,
    copyType: state.exportPrefs.copyType,
    content: state.exportPrefs.content,
  };

  const models = useMemo(
    () => (arrangement ? buildAllSheetModels(state, arrangement, opts) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, arrangement, opts.display, opts.copyType, opts.content],
  );

  const [previewIndex, setPreviewIndex] = useState(0);
  const preview = models[Math.min(previewIndex, Math.max(models.length - 1, 0))];

  if (state.arrangements.length === 0) {
    return (
      <div className="card">
        <h2>Export</h2>
        <div className="alert warn">No arrangement generated yet. Go to the Arrange step first.</div>
      </div>
    );
  }

  const setPrefs = (patch: Partial<typeof state.exportPrefs>) =>
    update({ exportPrefs: { ...state.exportPrefs, ...patch } });

  const contentSuffix = opts.content === 'both' ? '' : opts.content === 'seating' ? '-seating' : '-bench-plans';
  const fileBase = arrangement
    ? `seating-${arrangement.date.replace(/\//g, '-')}-${arrangement.session.toLowerCase()}-${opts.copyType}${contentSuffix}`
    : 'seating';

  const exportPdf = async () => {
    setBusy('Building PDF…');
    const { buildPdf } = await import('../../lib/exportPdf');
    saveAs(buildPdf(models), `${fileBase}.pdf`);
    setBusy('');
  };

  const exportDocx = async () => {
    setBusy('Building Word document…');
    const { buildDocx } = await import('../../lib/exportDocx');
    saveAs(await buildDocx(models), `${fileBase}.docx`);
    setBusy('');
  };

  const exportZip = async () => {
    setBusy('Building per-room files…');
    const [{ buildPdf }, { buildDocx }, { default: JSZip }] = await Promise.all([
      import('../../lib/exportPdf'),
      import('../../lib/exportDocx'),
      import('jszip'),
    ]);
    const zip = new JSZip();
    for (const m of models) {
      const safe = m.roomNumber.replace(/[^\w-]+/g, '_');
      zip.file(`Room-${safe}.pdf`, buildPdf([m]));
      zip.file(`Room-${safe}.docx`, await buildDocx([m]));
    }
    saveAs(await zip.generateAsync({ type: 'blob' }), `${fileBase}-per-room.zip`);
    setBusy('');
  };

  const hasBenchData = arrangement
    ? arrangement.roomPlans.some((p) => {
        const room = state.rooms.find((r) => r.id === p.roomId);
        return room?.bench && p.groups.length > 0;
      })
    : false;

  return (
    <>
      <div className="card">
        <h2>Export</h2>
        <p className="hint">
          Word output is fully editable; the PDF is print-ready. The <strong>invigilator copy</strong> carries the
          blank Total Present / Total Absent / Signature rows for use inside the exam room; the{' '}
          <strong>notice copy</strong> omits them, for posting outside the centre and outside each room.
        </p>

        <div className="btn-row" style={{ marginBottom: 10 }}>
          <span className="badge blue">
            Session: {arrangement.date} — {arrangement.session}
          </span>
          {state.arrangements.length > 1 && (
            <select
              value={arrangement.id}
              onChange={(e) => {
                update({ activeSessionId: e.target.value });
                setPreviewIndex(0);
              }}
              style={{ maxWidth: 300 }}
            >
              {state.arrangements.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.date} — {a.session}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="btn-row" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Copy for:</span>
          <div className="radio-group">
            {(['invigilator', 'notice'] as CopyType[]).map((c) => (
              <button
                key={c}
                className={opts.copyType === c ? 'on' : ''}
                onClick={() => setPrefs({ copyType: c })}
                title={
                  c === 'invigilator'
                    ? 'With blank Present / Absent / Signature rows — goes into each exam room'
                    : 'Without those rows — posted outside the centre and each room for students'
                }
              >
                {c === 'invigilator' ? 'Invigilators (with attendance)' : 'Notice board (students)'}
              </button>
            ))}
          </div>
        </div>

        <div className="btn-row" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Include:</span>
          <div className="radio-group">
            {(['both', 'seating', 'bench'] as ExportContent[]).map((c) => (
              <button
                key={c}
                className={opts.content === c ? 'on' : ''}
                onClick={() => setPrefs({ content: c })}
                disabled={c !== 'seating' && !hasBenchData}
                title={c !== 'seating' && !hasBenchData ? 'No room in this arrangement has bench data' : undefined}
              >
                {c === 'both' ? 'Seating + bench plans' : c === 'seating' ? 'Seating only' : 'Bench plans only'}
              </button>
            ))}
          </div>
        </div>

        <div className="btn-row" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Roll numbers:</span>
          <div className="radio-group">
            {(['full', 'grouped'] as RollDisplay[]).map((d) => (
              <button
                key={d}
                className={opts.display === d ? 'on' : ''}
                onClick={() => setPrefs({ rollDisplay: d })}
                title={d === 'full' ? 'Print every roll number in full' : 'Roll-code prefix on one line, short serials below'}
              >
                {d === 'full' ? 'Full numbers' : 'Grouped by prefix'}
              </button>
            ))}
          </div>
        </div>

        <div className="btn-row">
          <button className="btn primary" onClick={() => void exportDocx()} disabled={models.length === 0 || !!busy}>
            ⬇ Combined Word (.docx)
          </button>
          <button className="btn primary" onClick={() => void exportPdf()} disabled={models.length === 0 || !!busy}>
            ⬇ Combined PDF
          </button>
          <button className="btn" onClick={() => void exportZip()} disabled={models.length === 0 || !!busy}>
            ⬇ Per-room files (.zip)
          </button>
          {busy && <span className="progress-note">{busy}</span>}
        </div>
      </div>

      {preview && (
        <div className="card">
          <div className="room-head" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Preview</h2>
            <div className="spacer" style={{ flex: 1 }} />
            <button className="btn small" disabled={previewIndex <= 0} onClick={() => setPreviewIndex((i) => i - 1)}>
              ← Prev
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Room {preview.roomNumber} ({previewIndex + 1} of {models.length})
            </span>
            <button className="btn small" disabled={previewIndex >= models.length - 1} onClick={() => setPreviewIndex((i) => i + 1)}>
              Next →
            </button>
          </div>
          <SheetPreview model={preview} />
        </div>
      )}
    </>
  );
}

function SheetPreview({ model: m }: { model: SheetModel }) {
  return (
    <div className="sheet-preview">
      {m.includeSeating && (
        <>
          <div className="c" style={{ fontWeight: 700, fontSize: '1.2rem' }}>{m.centreName || 'Examination Centre'}</div>
          <div className="c">{m.centreAddress}</div>
          <div className="c" style={{ fontWeight: 700 }}>{m.examName}</div>
          <table>
            <tbody>
              <tr>
                <td className="lbl">Date &amp; Day</td>
                <td>{m.dateDay}</td>
              </tr>
              <tr>
                <td className="lbl">Time</td>
                <td>{m.timeSlot || m.session}</td>
              </tr>
              <tr>
                <td className="lbl">Room No.</td>
                <td style={{ fontWeight: 700 }}>{m.roomNoDisplay}</td>
              </tr>
              <tr>
                <td className="lbl">Subject(s) &amp; Code(s)</td>
                <td style={{ fontWeight: 700 }}>{m.subjectsSummary}</td>
              </tr>
              <tr>
                <td className="lbl">Roll Numbers (subject-wise)</td>
                <td>
                  {m.rollBlocks.map((b, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 700 }}>
                        {b.subjectCode} ({b.count})
                      </div>
                      {b.lines.map((l, j) => (
                        <div key={j} className="roll-line">
                          {l}
                        </div>
                      ))}
                    </div>
                  ))}
                </td>
              </tr>
              <tr>
                <td className="lbl">Total Number of Students</td>
                <td style={{ fontWeight: 700 }}>{m.total}</td>
              </tr>
              {m.showAttendance && (
                <>
                  <tr>
                    <td className="lbl">Total Present</td>
                    <td style={{ height: 34 }} />
                  </tr>
                  <tr>
                    <td className="lbl">Total Absent (with roll numbers of absent candidates)</td>
                    <td style={{ height: 56 }} />
                  </tr>
                  <tr>
                    <td className="lbl">Signature of Invigilators</td>
                    <td style={{ height: 56 }} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </>
      )}
      {m.benchPlan && (
        <>
          <div style={{ fontWeight: 700, marginTop: m.includeSeating ? 18 : 0 }} className={m.includeSeating ? '' : 'c'}>
            Bench Plan — Room {m.roomNumber}
          </div>
          {!m.includeSeating && (
            <div className="c" style={{ marginBottom: 6 }}>
              {m.dateDay} &nbsp;•&nbsp; {m.timeSlot || m.session}
            </div>
          )}
          <table>
            <tbody>
              {m.benchPlan.map((bench, i) =>
                bench.length > 0 ? (
                  <tr key={i}>
                    <td className="lbl" style={{ width: '18%' }}>
                      Bench {i + 1}
                    </td>
                    <td className="roll-line">{bench.map((s) => `${s.roll} (${s.subjectCode})`).join('    ')}</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
