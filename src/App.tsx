import { useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { SetupStep } from './components/steps/SetupStep';
import { RoomsStep } from './components/steps/RoomsStep';
import { ImportStep } from './components/steps/ImportStep';
import { ArrangeStep } from './components/steps/ArrangeStep';
import { ExportStep } from './components/steps/ExportStep';

const STEPS = [
  { key: 'setup', label: 'Setup', sub: 'Centre & exam' },
  { key: 'rooms', label: 'Rooms', sub: 'Capacities & benches' },
  { key: 'import', label: 'Import', sub: 'Top sheets & allotment' },
  { key: 'arrange', label: 'Arrange', sub: 'Allocate to rooms' },
  { key: 'export', label: 'Export', sub: 'Word & PDF sheets' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

function Shell() {
  const { state, reset } = useStore();
  const [step, setStep] = useState<StepKey>('setup');

  const done: Record<StepKey, boolean> = {
    setup: Boolean(state.centre.name && state.exam.name),
    rooms: state.rooms.filter((r) => r.active).length > 0,
    import: state.topSheets.length > 0,
    arrange: state.arrangements.length > 0,
    export: false,
  };

  return (
    <>
      <header className="app-header">
        <span className="logo">HallMap</span>
        <span className="tagline">Exam seating arrangements, from top sheets to printable room sheets</span>
        <span className="spacer" />
        <button
          className="btn small danger"
          onClick={() => {
            if (window.confirm('Clear all data (centre, rooms, imported sheets, arrangements)? This cannot be undone.')) {
              reset();
              setStep('setup');
            }
          }}
        >
          Reset all data
        </button>
      </header>

      <nav className="stepper">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            className={`step-btn ${step === s.key ? 'current' : ''} ${done[s.key] ? 'done' : ''}`}
            onClick={() => setStep(s.key)}
          >
            <span className="num">{done[s.key] && step !== s.key ? '✓' : i + 1}</span>
            <span className="lbl">
              {s.label}
              <span className="sub">{s.sub}</span>
            </span>
          </button>
        ))}
      </nav>

      {step === 'setup' && <SetupStep />}
      {step === 'rooms' && <RoomsStep />}
      {step === 'import' && <ImportStep />}
      {step === 'arrange' && <ArrangeStep />}
      {step === 'export' && <ExportStep />}

      <p className="footer-note">
        Everything runs locally in your browser — no data is uploaded anywhere. Work is saved automatically on this
        device.
        <br />
        Created by{' '}
        <a href="https://github.com/ourbee" target="_blank" rel="noopener noreferrer">
          Ritwik Balo
        </a>
      </p>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
