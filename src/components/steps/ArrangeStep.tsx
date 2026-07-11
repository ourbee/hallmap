import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { Arrangement, BenchMode, RoomPlan, TopSheet } from '../../types';
import { allocateRooms, buildBenchPlan, moveGroup } from '../../lib/allocate';
import { validatePlans, validateSession } from '../../lib/validate';

interface SessionKey {
  id: string;
  date: string;
  session: string;
  sheets: TopSheet[];
}

export function ArrangeStep() {
  const { state, update } = useStore();

  const sessions = useMemo<SessionKey[]>(() => {
    const map = new Map<string, SessionKey>();
    for (const s of state.topSheets) {
      const id = `${s.date}|${s.session}`;
      const entry = map.get(id) ?? { id, date: s.date, session: s.session, sheets: [] };
      entry.sheets.push(s);
      map.set(id, entry);
    }
    return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [state.topSheets]);

  const [selectedId, setSelectedId] = useState<string>(state.activeSessionId || (sessions[0]?.id ?? ''));
  const selected = sessions.find((s) => s.id === selectedId) ?? sessions[0];

  const selectSession = (id: string) => {
    setSelectedId(id);
    update({ activeSessionId: id });
  };
  const arrangement = state.arrangements.find((a) => a.id === selected?.id);

  const saveArrangement = (a: Arrangement) =>
    update({
      arrangements: [...state.arrangements.filter((x) => x.id !== a.id), a],
      activeSessionId: a.id,
    });

  const generate = () => {
    if (!selected) return;
    const lockedPlans = arrangement?.roomPlans.filter((p) => p.locked) ?? [];
    const roomPlans = allocateRooms(state.rooms, selected.sheets, lockedPlans);
    saveArrangement({
      id: selected.id,
      date: selected.date,
      session: selected.session,
      timeSlot: arrangement?.timeSlot ?? '',
      benchMode: arrangement?.benchMode ?? 'sequential',
      roomPlans,
      generatedAt: Date.now(),
    });
  };

  if (sessions.length === 0) {
    return (
      <div className="card">
        <h2>Build Arrangement</h2>
        <div className="alert warn">No top sheets imported yet. Go to the Import step first.</div>
      </div>
    );
  }

  const sessionWarnings = selected
    ? validateSession(selected.sheets, state.rooms, state.centre.code, state.allotment)
    : [];
  const planWarnings =
    arrangement && selected ? validatePlans(arrangement.roomPlans, state.rooms, selected.sheets) : [];

  const totalStudents = selected?.sheets.reduce((n, s) => n + s.rolls.length, 0) ?? 0;
  const totalCapacity = state.rooms.filter((r) => r.active).reduce((n, r) => n + r.capacity, 0);
  const seated = arrangement?.roomPlans.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.rolls.length, 0), 0) ?? 0;

  return (
    <>
      <div className="card">
        <h2>Session</h2>
        <p className="hint">
          Sessions are grouped automatically from the imported top sheets (one arrangement per date + session).
        </p>
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <select value={selected?.id ?? ''} onChange={(e) => selectSession(e.target.value)} style={{ maxWidth: 340 }}>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.date || 'undated'} — {s.session || 'no session'} ({s.sheets.length} subject{s.sheets.length === 1 ? '' : 's'})
              </option>
            ))}
          </select>
          <div className="field" style={{ marginBottom: 0, minWidth: 240 }}>
            <input
              type="text"
              placeholder="Time slot, e.g. 10:00 A.M. – 12:00 Noon"
              value={arrangement?.timeSlot ?? ''}
              onChange={(e) => arrangement && saveArrangement({ ...arrangement, timeSlot: e.target.value })}
              disabled={!arrangement}
            />
          </div>
        </div>

        <div className="stat-row">
          <div className="stat">
            <div className="v">{totalStudents}</div>
            <div className="k">Students</div>
          </div>
          <div className="stat">
            <div className="v">{totalCapacity}</div>
            <div className="k">Capacity</div>
          </div>
          <div className="stat">
            <div className="v">{arrangement ? seated : '—'}</div>
            <div className="k">Seated</div>
          </div>
          <div className="stat">
            <div className="v">{arrangement ? totalStudents - seated : '—'}</div>
            <div className="k">Unseated</div>
          </div>
        </div>

        <div className="btn-row">
          <button className="btn primary" onClick={generate} disabled={!selected || state.rooms.filter((r) => r.active).length === 0}>
            {arrangement ? '↻ Regenerate (locked rooms kept)' : '⚙ Generate arrangement'}
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Bench-mates:</span>
          <div className="radio-group">
            {(['sequential', 'interleave'] as BenchMode[]).map((m) => (
              <button
                key={m}
                className={arrangement?.benchMode === m || (!arrangement && m === 'sequential') ? 'on' : ''}
                onClick={() => arrangement && saveArrangement({ ...arrangement, benchMode: m })}
                title={
                  m === 'sequential'
                    ? 'Fill benches in roll order, keeping subjects together'
                    : 'Mix subjects on each bench so neighbours sit for different papers'
                }
              >
                {m === 'sequential' ? 'Keep subjects together' : 'Mix subjects per bench'}
              </button>
            ))}
          </div>
        </div>

        {[...sessionWarnings, ...planWarnings].map((w, i) => (
          <div key={i} className={`alert ${w.level === 'error' ? 'error' : 'warn'}`} style={{ marginTop: i === 0 ? 12 : 0 }}>
            {w.message}
          </div>
        ))}
        {arrangement && planWarnings.length === 0 && sessionWarnings.length === 0 && (
          <div className="alert ok" style={{ marginTop: 12 }}>
            All {seated} students seated. Room totals match the session pool.
          </div>
        )}
      </div>

      {arrangement && selected && (
        <div className="card">
          <h2>Room-wise Assignment</h2>
          <p className="hint">
            The generator uses as few rooms as possible and keeps each subject in a single room, splitting a subject
            only when a room's capacity forces it. Move a subject block to another room with the dropdown beside it.
            Lock a room to keep it unchanged when regenerating.
          </p>
          {arrangement.roomPlans.map((plan) => (
            <RoomCard
              key={plan.roomId}
              plan={plan}
              arrangement={arrangement}
              onMove={(gi, to) => saveArrangement({ ...arrangement, roomPlans: moveGroup(arrangement.roomPlans, plan.roomId, gi, to) })}
              onLock={(locked) =>
                saveArrangement({
                  ...arrangement,
                  roomPlans: arrangement.roomPlans.map((p) => (p.roomId === plan.roomId ? { ...p, locked } : p)),
                })
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

function RoomCard({
  plan,
  arrangement,
  onMove,
  onLock,
}: {
  plan: RoomPlan;
  arrangement: Arrangement;
  onMove: (groupIndex: number, toRoomId: string) => void;
  onLock: (locked: boolean) => void;
}) {
  const { state } = useStore();
  const room = state.rooms.find((r) => r.id === plan.roomId);
  if (!room) return null;
  const seatedHere = plan.groups.reduce((n, g) => n + g.rolls.length, 0);
  const over = seatedHere > room.capacity;
  const benchPlan = buildBenchPlan(plan, room, arrangement.benchMode);
  const otherRooms = state.rooms.filter((r) => r.active && r.id !== room.id);

  // Seats still free in every other room, from the current plans.
  const seatedIn = new Map(
    arrangement.roomPlans.map((p) => [p.roomId, p.groups.reduce((n, g) => n + g.rolls.length, 0)]),
  );
  const freeSeats = (r: { id: string; capacity: number }) => r.capacity - (seatedIn.get(r.id) ?? 0);

  // Whole-room merge suggestion: another occupied room that can absorb everyone
  // seated here (tightest fit preferred) — using it frees this room entirely.
  const mergeTarget =
    seatedHere > 0 && !plan.locked
      ? otherRooms
          .filter((r) => (seatedIn.get(r.id) ?? 0) > 0 && freeSeats(r) >= seatedHere)
          .sort((a, b) => freeSeats(a) - freeSeats(b))[0]
      : undefined;

  return (
    <div className={`room-card ${over ? 'over' : ''}`}>
      <div className="room-head">
        <h3>Room {room.number}</h3>
        <span className={`badge ${over ? 'red' : seatedHere > 0 ? 'green' : 'blue'}`}>
          {seatedHere} / {room.capacity}
        </span>
        {mergeTarget && (
          <span className="badge amber" title="Move each subject block there with its Move to… dropdown to free this room.">
            💡 All {seatedHere} student{seatedHere === 1 ? '' : 's'} in this room can be shifted to Room{' '}
            {mergeTarget.number} ({freeSeats(mergeTarget)} seats free)
          </span>
        )}
        {room.bench && (
          <span className="badge blue">
            {room.bench.benchCount} benches × {room.bench.seatsPerBench}
          </span>
        )}
        <div className="spacer" />
        <label className="checkbox-line">
          <input type="checkbox" checked={plan.locked} onChange={(e) => onLock(e.target.checked)} />
          Lock
        </label>
      </div>
      {plan.groups.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>Empty</p>}
      {plan.groups.map((g, gi) => (
        <div key={gi} className="group-line">
          <strong>
            {g.subjectCode} ({g.rolls.length})
          </strong>
          <span className="rolls">
            {g.rolls.slice(0, 4).join(' ')}
            {g.rolls.length > 4 ? ` … ${g.rolls[g.rolls.length - 1]}` : ''}
          </span>
          {otherRooms.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && onMove(gi, e.target.value)}
              style={{ width: 'auto', marginLeft: 'auto', fontSize: '0.82rem', padding: '4px 8px' }}
            >
              <option value="">Move to…</option>
              {otherRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.number} — {freeSeats(r) > 0 ? `${freeSeats(r)} seat${freeSeats(r) === 1 ? '' : 's'} available` : 'full'}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
      {benchPlan && seatedHere > 0 && (
        <details className="bench-details" style={{ marginTop: 8 }}>
          <summary>Bench plan preview</summary>
          {benchPlan.map((bench, i) =>
            bench.length > 0 ? (
              <div key={i} className="bench-row">
                <span className="bn">Bench {i + 1}</span>
                <span className="seats">{bench.map((s) => `${s.roll} (${s.subjectCode})`).join('   ')}</span>
              </div>
            ) : null,
          )}
        </details>
      )}
    </div>
  );
}
