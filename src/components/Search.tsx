import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DataTable } from '../db';
import { NOUN, openEdit } from '../registry';
import { Modal } from './Form';

const SEARCHABLE: [DataTable, string, string][] = [
  ['tasks', 'title', '✅'],
  ['objectives', 'title', '🎯'],
  ['bills', 'name', '🧾'],
  ['policies', 'name', '🛡️'],
  ['loans', 'name', '🏦'],
  ['investments', 'name', '📈'],
  ['budget', 'name', '💷'],
  ['house', 'title', '🏠'],
  ['inventory', 'name', '📦'],
  ['plans', 'name', '💪'],
  ['workouts', 'name', '🏋️'],
];

export default function Search({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const all = useLiveQuery(async () => {
    const out: { table: DataTable; id: string; title: string; icon: string; text: string }[] = [];
    for (const [table, key, icon] of SEARCHABLE) {
      for (const r of (await (db[table] as any).toArray()) as any[]) {
        if (r.deleted) continue;
        const text = Object.values(r)
          .filter((v) => typeof v === 'string' || typeof v === 'number')
          .join(' ')
          .toLowerCase();
        out.push({ table, id: r.id, title: r[key] || '(untitled)', icon, text });
      }
    }
    return out;
  }, []);
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || !all) return [];
    return all.filter((r) => words.every((w) => r.text.includes(w))).slice(0, 40);
  }, [q, all]);
  return (
    <Modal title="Search everything" onClose={onClose}>
      <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill, policy number, serial, task…" aria-label="Search" />
      <ul className="search-results">
        {results.map((r) => (
          <li key={r.table + r.id}>
            <button
              onClick={() => {
                onClose();
                openEdit({ table: r.table, id: r.id });
              }}
            >
              <span>{r.icon}</span>
              <span className="grow">{r.title}</span>
              <span className="muted">{NOUN[r.table]}</span>
            </button>
          </li>
        ))}
        {q && results.length === 0 && <li className="muted">No matches.</li>}
      </ul>
    </Modal>
  );
}
