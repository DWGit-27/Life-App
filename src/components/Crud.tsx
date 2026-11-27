import type { ReactNode } from 'react';
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
}: {
  table: DataTable;
  rows: T[];
  noun?: string;
  defaults?: () => Record<string, any>;
  renderRow: (r: T) => ReactNode;
  empty?: ReactNode;
  header?: ReactNode;
  sort?: (a: T, b: T) => number;
}) {
  const list = sort ? [...rows].sort(sort) : rows;
  const n = noun ?? NOUN[table] ?? 'item';
  return (
    <section>
      <div className="toolbar">
        {header}
        <span className="grow" />
        <button className="primary" onClick={() => openEdit({ table, initial: defaults?.() })}>
          + Add {n}
        </button>
      </div>
      {list.length === 0 ? (
        <div className="empty">{empty ?? `No ${n}s yet.`}</div>
      ) : (
        <ul className="cards">
          {list.map((r) => (
            <li key={r.id} className="card clickable" onClick={() => openEdit({ table, id: r.id })}>
              {renderRow(r)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
