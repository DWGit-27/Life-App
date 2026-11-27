import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, live, remove, save, type Base, type DataTable } from '../db';
import { EditorModal, type FieldSpec } from './Form';

export function useRows<T extends Base>(table: DataTable): T[] {
  return live(useLiveQuery(() => (db[table] as any).toArray() as Promise<T[]>, [table]));
}

/** Generic list + add/edit modal for a table. */
export function CrudList<T extends Base>({
  table,
  rows,
  noun,
  fields,
  defaults,
  renderRow,
  empty,
  header,
  sort,
}: {
  table: DataTable;
  rows: T[];
  noun: string;
  fields: FieldSpec[];
  defaults?: () => Partial<T>;
  renderRow: (r: T) => ReactNode;
  empty?: ReactNode;
  header?: ReactNode;
  sort?: (a: T, b: T) => number;
}) {
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const list = sort ? [...rows].sort(sort) : rows;
  return (
    <section>
      <div className="toolbar">
        {header}
        <span className="grow" />
        <button className="primary" onClick={() => setEditing(defaults?.() ?? {})}>
          + Add {noun}
        </button>
      </div>
      {list.length === 0 ? (
        <div className="empty">{empty ?? `No ${noun}s yet.`}</div>
      ) : (
        <ul className="cards">
          {list.map((r) => (
            <li key={r.id} className="card clickable" onClick={() => setEditing(r)}>
              {renderRow(r)}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <EditorModal
          title={editing.id ? `Edit ${noun}` : `New ${noun}`}
          fields={fields}
          initial={editing as Record<string, any>}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            await save(table, v as any);
          }}
          onDelete={editing.id ? () => remove(table, editing.id!) : undefined}
        />
      )}
    </section>
  );
}
