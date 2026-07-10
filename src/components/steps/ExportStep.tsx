import { useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { useStore } from '../../state/store';
import type { RollDisplay } from '../../types';
import { buildAllSheetModels } from '../../lib/exportModel';
import type { SheetModel } from '../../lib/exportModel';

export function ExportStep() {
  const { state, update } = useStore();
  const [selectedId, setSelectedId] = useState<string>(state.arrangements[0]?.id ?? '');
  const [busy, setBusy] = useState('');
  const arrangement = state.arrangements.find((a) => a.id === selectedId) ?? state.arrangements[0];
  const display = state.exportPrefs.rollDisplay;

  const models = useMemo(
    () => (arrangement ? buildAllSheetModels(state, arrangement, display) : []),
    [state, arrangement, display],
  );

  const [previewIndex, setPreviewIndex] = useState(0);
  const preview = models[Math.min(previewIndex, models.length - 1)];

  if (state.arrangements.length === 0) {
    return (
      <div className="card">
        <h2>Export</h2>
        <div className="alert warn">No arrangement generated yet. Go to the Arrange step first.</div>
      </div>
    );
  }

  const fileBase = arrangement ? `seating-${arrangement.date.replace(/\//g, '-')}-${arrangement.session.toLowerCase()}` : 'seating';

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

  return (
    <>
      <div className="card">
        <h2>Export</h2>
        <p className="hint">
          Word output is fully editable; the PDF is print-ready. Rooms with bench details get an extra Bench Plan
          page after their seating sheet.
        </p>
        <div className="btn-row" style={{ marginBottom: 14 }}>
          <select value={arrangement?.id ?? ''} onChange={(e) => { setSelectedId(e.target.value); setPreviewIndex(0); }} style={{ maxWidth: 320 }}>
            {state.arrangements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.date} — {a.session}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Roll numbers:</span>
          <div className="radio-group">
            {(['full', 'grouped'] as RollDisplay[]).map((d) => (
              <button
                key={d}
                className={display === d ? 'on' : ''}
                onClick={() => update({ exportPrefs: { rollDisplay: d } })}
                title={d === 'full' ? 'Print every roll number in full' : 'Group by roll-code prefix and print short serials'}
              >
                {d === 'full' ? 'Full numbers' : 'Grouped by prefix'}
              </button>
            ))}
          </div>
        </div>

        <div className="btn-row">
          <button className="btn primary" onClick={() => void exportPdf()} disabled={models.length === 0 || !!busy}>
            ⬇ Combined PDF
          </button>
          <button className="btn primary" onClick={() => void exportDocx()} disabled={models.length === 0 || !!busy}>
            ⬇ Combined Word (.docx)
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
      <div className="c" style={{ fontWeight: 700, fontSize: '1.2rem' }}>{m.centreName || 'Examination Centre'}</div>
      <div className="c">{m.centreAddress}</div>
      <div className="c" style={{ fontWeight: 700 }}>{m.examName}</div>
      <div className="c" style={{ fontWeight: 700, textDecoration: 'underline', marginTop: 4 }}>SEATING ARRANGEMENT</div>
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
            <td style={{ fontWeight: 700 }}>{m.roomNumber}</td>
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
        </tbody>
      </table>
      {m.benchPlan && (
        <>
          <div style={{ fontWeight: 700, marginTop: 18 }}>Bench Plan — Room {m.roomNumber}</div>
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
