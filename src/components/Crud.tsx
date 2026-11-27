import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, live, type Base, type DataTable } from '../db';
import { NOUN, openEdit } from '../registry';

export function useRows<T extends Base>(table: DataTable): T[] {
  return live(useLiveQuery(() => (db[table] as any).toArray() as Promise<T[]>, [table]));
}

/** Generic list for a table; tap a row to edit it, "+ Add" for a new one. */
export function CrudList<T extends Base>({
  table,
  rows,
  noun,
  defaults,
  renderRow,
  empty,
  header,
  sort,
  groupBy,
  groupExtra,
}: {
  groupBy?: (r: T) => string;
  groupExtra?: (rows: T[]) => ReactNode;
  table: DataTable;
  rows: T[];
  noun?: string;
  defaults?: () => Record<string, any>;
  renderRow: (r: T) => ReactNode;
  empty?: ReactNode;
  header?: ReactNode;
  sort?: (a: T, b: T) => number;
}) {
  const [q, setQ] = useState('');
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const match = (r: T) => {
    if (!words.length) return true;
    const text = Object.values(r as Record<string, unknown>)
      .filter((v) => typeof v === 'string' || typeof v === 'number')
      .join(' ')
      .toLowerCase();
    return words.every((w) => text.includes(w));
  };
  const list = (sort ? [...rows].sort(sort) : rows).filter(match);
  const n = noun ?? NOUN[table] ?? 'item';
  return (
    <section>
      <div className="toolbar">
        {header}
        {rows.length > 5 && <input className="filter" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${rows.length}…`} aria-label={`Filter ${n}s`} />}
        <span className="grow" />
        <button className="primary" onClick={() => openEdit({ table, initial: defaults?.() })}>
          + Add {n}
        </button>
      </div>
      {list.length === 0 ? (
        <div className="empty">{words.length ? 'Nothing matches that filter.' : (empty ?? `No ${n}s yet.`)}</div>
      ) : (
        (groupBy ? [...new Set(list.map(groupBy))] : [null]).map((g) => {
          const rowsIn = g === null ? list : list.filter((r) => groupBy!(r) === g);
          return (
            <div key={g ?? 'all'} className="group">
              {g !== null && (
                <h3 className="group-head">
                  <span className="grow">{g}</span>
                  {groupExtra?.(rowsIn)}
                </h3>
              )}
              <ul className="cards">
                {rowsIn.map((r) => (
                  <li key={r.id} className="card clickable" onClick={() => openEdit({ table, id: r.id })}>
                    {renderRow(r)}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
