import { useState, type ReactNode } from 'react';
import type { Schedule, Freq } from '../lib/schedule';
import type { CheckItem, Exercise } from '../db';
import { today } from '../lib/dates';

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'checkbox' | 'schedule' | 'checklist' | 'exercises';

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly string[] | { value: string; label: string }[];
  /** extra content rendered under the field, given the current values */
  extra?: (v: Record<string, any>) => ReactNode;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** schedule fields: hide the "one-off" choice */
  recurringOnly?: boolean;
  /** schedule fields: allow leaving the date empty */
  optional?: boolean;
  /** show only when predicate on current values is true */
  when?: (v: Record<string, any>) => boolean;
}

export function ScheduleInput({ value, onChange, recurringOnly, optional }: { value?: Schedule; onChange: (s?: Schedule) => void; recurringOnly?: boolean; optional?: boolean }) {
  const s: Schedule = value ?? { freq: recurringOnly ? 'monthly' : 'once', interval: 1, start: optional ? '' : today() };
  const set = (patch: Partial<Schedule>) => {
    const next = { ...s, ...patch };
    onChange(optional && !next.start ? undefined : next);
  };
  return (
    <div className="schedule">
      <label className="sub">
        <span>{s.freq === 'once' ? 'Due' : 'Starts / next due'}</span>
        <input type="date" value={value?.start ?? (optional ? '' : s.start)} onChange={(e) => set({ start: e.target.value })} />
      </label>
      <label className="sub">
        <span>Repeats</span>
        <div className="row">
          {s.freq !== 'once' && (
            <>
              <span className="muted">every</span>
              <input type="number" min={1} className="narrow" value={s.interval} onChange={(e) => set({ interval: Math.max(1, Number(e.target.value) || 1) })} />
            </>
          )}
          <select value={s.freq} onChange={(e) => set({ freq: e.target.value as Freq })}>
            {!recurringOnly && <option value="once">No (one-off)</option>}
            <option value="daily">{s.interval > 1 ? 'days' : 'day'}</option>
            <option value="weekly">{s.interval > 1 ? 'weeks' : 'week'}</option>
            <option value="monthly">{s.interval > 1 ? 'months' : 'month'}</option>
            <option value="yearly">{s.interval > 1 ? 'years' : 'year'}</option>
          </select>
        </div>
      </label>
    </div>
  );
}

export function ChecklistInput({ value, onChange }: { value?: CheckItem[]; onChange: (v: CheckItem[]) => void }) {
  const list = value ?? [];
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    onChange([...list, { text: draft.trim(), done: false }]);
    setDraft('');
  };
  return (
    <div className="checklist">
      {list.map((c, i) => (
        <div key={i} className="row">
          <input type="checkbox" checked={c.done} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
          <input value={c.text} className={c.done ? 'struck' : ''} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          <button type="button" className="icon" aria-label="Remove step" onClick={() => onChange(list.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <div className="row">
        <input
          value={draft}
          placeholder="Add a step…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}

export function ExercisesInput({ value, onChange }: { value?: Exercise[]; onChange: (v: Exercise[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<Exercise>) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const num = (v: string) => (v === '' ? undefined : Number(v));
  return (
    <div className="exercises">
      {list.length > 0 && (
        <div className="ex-head muted">
          <span>Exercise</span>
          <span>Sets</span>
          <span>Reps</span>
          <span>kg</span>
          <span />
        </div>
      )}
      {list.map((x, i) => (
        <div key={i} className="ex-row">
          <input value={x.name} placeholder="e.g. Squat" onChange={(e) => set(i, { name: e.target.value })} />
          <input type="number" inputMode="numeric" value={x.sets ?? ''} onChange={(e) => set(i, { sets: num(e.target.value) })} aria-label="Sets" />
          <input value={x.reps ?? ''} placeholder="8-10" onChange={(e) => set(i, { reps: e.target.value })} aria-label="Reps" />
          <input type="number" inputMode="decimal" step="0.5" value={x.weight ?? ''} onChange={(e) => set(i, { weight: num(e.target.value) })} aria-label="Weight kg" />
          <button type="button" className="icon" aria-label="Remove exercise" onClick={() => onChange(list.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, { name: '', sets: 3, reps: '10' }])}>
        + Add exercise
      </button>
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: FieldSpec; value: any; onChange: (v: any) => void }) {
  switch (f.type) {
    case 'textarea':
      return <textarea rows={3} value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
    case 'money':
      return (
        <input
          type="number"
          inputMode="decimal"
          step={f.type === 'money' ? '0.01' : 'any'}
          value={value ?? ''}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    case 'date':
      return <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
    case 'select': {
      const opts = (f.options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {!f.required && <option value="">—</option>}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case 'checkbox':
      return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    case 'checklist':
      return <ChecklistInput value={value} onChange={onChange} />;
    case 'exercises':
      return <ExercisesInput value={value} onChange={onChange} />;
    case 'schedule':
      return <ScheduleInput value={value} onChange={onChange} recurringOnly={f.recurringOnly} optional={f.optional} />;
    default:
      return <input type="text" value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function EditorModal({
  title,
  fields,
  initial,
  onSave,
  onDelete,
  onClose,
  actions,
}: {
  actions?: (v: Record<string, any>, close: () => void) => ReactNode;
  title: string;
  fields: FieldSpec[];
  initial: Record<string, any>;
  onSave: (v: Record<string, any>) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [v, setV] = useState<Record<string, any>>(initial);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = fields.filter((f) => f.required && (f.when?.(v) ?? true) && (v[f.key] === undefined || v[f.key] === ''));
    if (missing.length) return setErr(`Please fill in: ${missing.map((m) => m.label).join(', ')}`);
    await onSave(v);
    onClose();
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {fields
          .filter((f) => f.when?.(v) ?? true)
          .map((f) => {
            const Wrap = f.type === 'checklist' || f.type === 'exercises' || f.type === 'schedule' ? 'div' : 'label';
            return (
            <Wrap key={f.key} className={`field ${f.type === 'checkbox' ? 'check' : ''}`}>
              <span>
                {f.label}
                {f.required && ' *'}
              </span>
              <FieldInput f={f} value={v[f.key]} onChange={(x) => setV((cur) => ({ ...cur, [f.key]: x }))} />
              {f.hint && <small className="muted">{f.hint}</small>}
              {f.extra?.(v)}
            </Wrap>
            );
          })}
        {err && <p className="error">{err}</p>}
        <footer>
          {onDelete && (
            <button
              type="button"
              className="danger"
              onClick={async () => {
                await onDelete();
                onClose();
              }}
            >
              Delete
            </button>
          )}
          {actions?.(v, onClose)}
          <span className="grow" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </footer>
      </form>
    </Modal>
  );
}
