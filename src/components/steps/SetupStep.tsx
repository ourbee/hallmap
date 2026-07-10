import { useStore } from '../../state/store';
import type { CentreProfile, ExamProfile } from '../../types';

export function SetupStep() {
  const { state, update } = useStore();

  const setCentre = (patch: Partial<CentreProfile>) => update({ centre: { ...state.centre, ...patch } });
  const setExam = (patch: Partial<ExamProfile>) => update({ exam: { ...state.exam, ...patch } });

  return (
    <div className="grid-2">
      <div className="card">
        <h2>Exam Centre</h2>
        <p className="hint">
          Details of your examination centre. These appear at the top of every seating sheet. Uploading an
          allotment letter in the Import step can fill these automatically.
        </p>
        <div className="field">
          <label>Centre name</label>
          <input
            type="text"
            value={state.centre.name}
            placeholder="Name of your examination centre"
            onChange={(e) => setCentre({ name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Centre code</label>
          <input
            type="text"
            value={state.centre.code}
            placeholder="Code assigned by the exam authority"
            onChange={(e) => setCentre({ code: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Address (optional)</label>
          <input
            type="text"
            value={state.centre.address}
            placeholder="Printed under the centre name on each sheet"
            onChange={(e) => setCentre({ address: e.target.value })}
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Phone (optional)</label>
            <input type="text" value={state.centre.phone} onChange={(e) => setCentre({ phone: e.target.value })} />
          </div>
          <div className="field">
            <label>Zone (optional)</label>
            <input type="text" value={state.centre.zone} onChange={(e) => setCentre({ zone: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Examination</h2>
        <p className="hint">The examination this seating plan is for.</p>
        <div className="field">
          <label>Name of examination</label>
          <input
            type="text"
            value={state.exam.name}
            placeholder="e.g. Four Year B.A. Semester - II Examination, 2024"
            onChange={(e) => setExam({ name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Scheme (optional)</label>
          <input
            type="text"
            value={state.exam.scheme}
            placeholder="e.g. Under CCF, 2022"
            onChange={(e) => setExam({ scheme: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Year (optional)</label>
          <input type="text" value={state.exam.year} placeholder="e.g. 2026" onChange={(e) => setExam({ year: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
