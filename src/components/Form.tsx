import { useState, type ReactNode } from 'react';
import type { Schedule, Freq } from '../lib/schedule';
import { today } from '../lib/dates';

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'checkbox' | 'schedule';

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly string[] | { value: string; label: string }[];
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
}: {
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
          .map((f) => (
            <label key={f.key} className={f.type === 'checkbox' ? 'check' : ''}>
              <span>
                {f.label}
                {f.required && ' *'}
              </span>
              <FieldInput f={f} value={v[f.key]} onChange={(x) => setV((cur) => ({ ...cur, [f.key]: x }))} />
              {f.hint && <small className="muted">{f.hint}</small>}
            </label>
          ))}
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
