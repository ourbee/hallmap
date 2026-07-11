import { useState } from 'react';
import { saveAs } from 'file-saver';
import { useStore } from '../../state/store';
import type { Room } from '../../types';
import { makeId } from '../../lib/id';
import { parseRoomsCsv, roomsTemplateCsv, roomsToCsv } from '../../lib/roomsCsv';
import { FileDrop } from '../FileDrop';

export function RoomsStep() {
  const { state, update } = useStore();
  const [replaceOnUpload, setReplaceOnUpload] = useState(true);
  const [uploadMsg, setUploadMsg] = useState<string[]>([]);

  const setRoom = (id: string, patch: Partial<Room>) =>
    update({ rooms: state.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const addRoom = () =>
    update({
      rooms: [
        ...state.rooms,
        { id: makeId('room-'), number: '', capacity: 0, building: '', active: true, bench: null },
      ],
    });

  const removeRoom = (id: string) => update({ rooms: state.rooms.filter((r) => r.id !== id) });

  const setBench = (room: Room, benchCount: number | null, seatsPerBench: number | null) => {
    if (!benchCount && !seatsPerBench) {
      setRoom(room.id, { bench: null });
      return;
    }
    setRoom(room.id, {
      bench: {
        benchCount: benchCount ?? room.bench?.benchCount ?? 0,
        seatsPerBench: seatsPerBench ?? room.bench?.seatsPerBench ?? 0,
      },
    });
  };

  const onUpload = async (file: File) => {
    const text = await file.text();
    const { rooms, errors } = parseRoomsCsv(text);
    const msgs = [...errors];
    if (rooms.length > 0) {
      update({ rooms: replaceOnUpload ? rooms : [...state.rooms, ...rooms] });
      msgs.unshift(`Imported ${rooms.length} room(s) from ${file.name}.`);
    } else {
      msgs.unshift(`No valid rooms found in ${file.name}.`);
    }
    setUploadMsg(msgs);
  };

  const totalCapacity = state.rooms.filter((r) => r.active).reduce((n, r) => n + r.capacity, 0);
  const benchSeatMismatch = state.rooms.filter(
    (r) => r.active && r.bench && r.bench.benchCount * r.bench.seatsPerBench < r.capacity,
  );

  return (
    <div className="card">
      <h2>Room Master</h2>
      <p className="hint">
        Enter each usable room with its maximum seating capacity. Bench details are <strong>optional</strong> — fill
        them only if you know how many benches a room has and how many candidates sit per bench; the app will then
        also produce a bench-level plan for that room.
      </p>

      <div className="stat-row">
        <div className="stat">
          <div className="v">{state.rooms.filter((r) => r.active).length}</div>
          <div className="k">Available rooms</div>
        </div>
        <div className="stat">
          <div className="v">{totalCapacity}</div>
          <div className="k">Total capacity</div>
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={() => saveAs(new Blob([roomsTemplateCsv()], { type: 'text/csv' }), 'room-master-template.csv')}>
          ⬇ Blank CSV template
        </button>
        <button
          className="btn"
          disabled={state.rooms.length === 0}
          onClick={() => saveAs(new Blob([roomsToCsv(state.rooms)], { type: 'text/csv' }), 'room-master.csv')}
        >
          ⬇ Export current rooms
        </button>
        <label className="checkbox-line">
          <input type="checkbox" checked={replaceOnUpload} onChange={(e) => setReplaceOnUpload(e.target.checked)} />
          Replace existing rooms on upload
        </label>
      </div>

      <div style={{ marginBottom: 14 }}>
        <FileDrop accept=".csv,text/csv" onFiles={(files) => void onUpload(files[0])}>
          <strong>Drop the filled CSV here</strong> or click to browse
        </FileDrop>
      </div>

      {uploadMsg.map((m, i) => (
        <div key={i} className={`alert ${/^Imported/.test(m) ? 'ok' : 'warn'}`}>
          {m}
        </div>
      ))}

      {benchSeatMismatch.map((r) => (
        <div key={r.id} className="alert warn">
          Room {r.number}: bench seats ({r.bench!.benchCount} × {r.bench!.seatsPerBench} ={' '}
          {r.bench!.benchCount * r.bench!.seatsPerBench}) are fewer than the room capacity ({r.capacity}).
        </div>
      ))}

      <table className="data">
        <thead>
          <tr>
            <th>Room No.</th>
            <th>Capacity</th>
            <th>Building / Floor</th>
            <th>Benches (opt.)</th>
            <th>Seats per bench (opt.)</th>
            <th>Available</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {state.rooms.map((r) => (
            <tr key={r.id}>
              <td style={{ width: 110 }}>
                <input type="text" value={r.number} onChange={(e) => setRoom(r.id, { number: e.target.value })} />
              </td>
              <td style={{ width: 100 }}>
                <input
                  type="number"
                  min={0}
                  value={r.capacity || ''}
                  onChange={(e) => setRoom(r.id, { capacity: parseInt(e.target.value, 10) || 0 })}
                />
              </td>
              <td>
                <input type="text" value={r.building} onChange={(e) => setRoom(r.id, { building: e.target.value })} />
              </td>
              <td style={{ width: 110 }}>
                <input
                  type="number"
                  min={0}
                  value={r.bench?.benchCount || ''}
                  placeholder="—"
                  onChange={(e) => setBench(r, parseInt(e.target.value, 10) || null, null)}
                />
              </td>
              <td style={{ width: 120 }}>
                <input
                  type="number"
                  min={0}
                  value={r.bench?.seatsPerBench || ''}
                  placeholder="—"
                  onChange={(e) => setBench(r, null, parseInt(e.target.value, 10) || null)}
                />
              </td>
              <td style={{ width: 70, textAlign: 'center' }}>
                <input type="checkbox" checked={r.active} onChange={(e) => setRoom(r.id, { active: e.target.checked })} />
              </td>
              <td style={{ width: 60 }}>
                <button className="btn small danger" onClick={() => removeRoom(r.id)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={addRoom}>
          + Add room
        </button>
      </div>
    </div>
  );
}
