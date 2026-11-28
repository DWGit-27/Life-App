import { useState } from 'react';
import { addDays, parseISO } from '../lib/dates';

/* Small dependency-free SVG charts. Single-series charts use the accent colour;
   the macro donut uses a validated 3-hue categorical set with a labelled legend. */

export interface Bar {
  label: string;
  value: number;
  tip?: string;
}

export function BarChart({ data, target, height = 140, unit = '', ariaLabel }: { data: Bar[]; target?: number; height?: number; unit?: string; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, target ?? 0, ...data.map((d) => d.value)) * 1.1;
  const w = 100 / data.length;
  const fmt = (v: number) => `${Math.round(v).toLocaleString('en-GB')}${unit}`;
  return (
    <figure className="chart" aria-label={ariaLabel}>
      <div className="chart-plot" style={{ height }} onMouseLeave={() => setHover(null)}>
        {target !== undefined && (
          <div className="chart-target" style={{ bottom: `${(target / max) * 100}%` }}>
            <span>target {fmt(target)}</span>
          </div>
        )}
        {data.map((d, i) => (
          <div
            key={i}
            className={`chart-col ${hover === i ? 'on' : ''}`}
            style={{ width: `${w}%` }}
            onMouseEnter={() => setHover(i)}
            onTouchStart={() => setHover(i)}
            role="img"
            aria-label={`${d.label}: ${d.tip ?? fmt(d.value)}`}
          >
            <i style={{ height: `${(d.value / max) * 100}%` }} className={target !== undefined && d.value > target * 1.05 ? 'over' : ''} />
          </div>
        ))}
        {hover !== null && (
          <div className="chart-tip" style={{ left: `${Math.min(80, Math.max(0, (hover + 0.5) * w - 10))}%` }}>
            <b>{data[hover].tip ?? fmt(data[hover].value)}</b>
            <span>{data[hover].label}</span>
          </div>
        )}
      </div>
      <div className="chart-x">
        {data.map((d, i) => (
          <span key={i} style={{ width: `${w}%` }}>
            {data.length <= 8 || i % Math.ceil(data.length / 8) === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function LineChart({ points, unit = '', height = 140, ariaLabel }: { points: { label: string; value: number }[]; unit?: string; height?: number; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="muted small-text">Log this a couple more times to see a trend.</p>;
  const W = 600;
  const H = height;
  const pad = 8;
  const ys = points.map((p) => p.value);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || 1;
  const X = (i: number) => pad + (i / (points.length - 1)) * (W - 2 * pad);
  const Y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join(' ');
  const fmt = (v: number) => `${Math.round(v * 10) / 10}${unit}`;
  return (
    <figure className="chart" aria-label={ariaLabel}>
      <div className="chart-plot" style={{ height: H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="chart-svg"
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGElement).getBoundingClientRect();
            setHover(Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)));
          }}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => {
            const r = (e.currentTarget as SVGElement).getBoundingClientRect();
            setHover(Math.round(((e.touches[0].clientX - r.left) / r.width) * (points.length - 1)));
          }}
        >
          <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {hover !== null && <line x1={X(hover)} x2={X(hover)} y1={0} y2={H} stroke="var(--muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />}
        </svg>
        {points.map((p, i) => (
          <span key={i} className={`chart-dot ${hover === i ? 'on' : ''}`} style={{ left: `${(X(i) / W) * 100}%`, top: `${(Y(p.value) / H) * 100}%` }} />
        ))}
        {hover !== null && points[hover] && (
          <div className="chart-tip" style={{ left: `${Math.min(78, Math.max(0, (X(hover) / W) * 100 - 10))}%` }}>
            <b>{fmt(points[hover].value)}</b>
            <span>{points[hover].label}</span>
          </div>
        )}
      </div>
      <div className="chart-x spread">
        <span>{points[0].label}</span>
        <span>
          {fmt(lo)} – {fmt(hi)}
        </span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </figure>
  );
}

/** Protein / carbs / fat split by calories, with a labelled legend (identity never by colour alone). */
export function MacroDonut({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const parts = [
    { label: 'Protein', kcal: protein * 4, g: protein, cls: 's1' },
    { label: 'Carbs', kcal: carbs * 4, g: carbs, cls: 's2' },
    { label: 'Fat', kcal: fat * 9, g: fat, cls: 's3' },
  ];
  const total = parts.reduce((a, p) => a + p.kcal, 0);
  if (!total) return null;
  const r = 40;
  const C = 2 * Math.PI * r;
  let off = 0;
  return (
    <figure className="donut" aria-label="Where today's calories came from">
      <svg viewBox="0 0 100 100" width="96" height="96">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
        {parts.map((p) => {
          const len = (p.kcal / total) * C;
          const seg = (
            <circle key={p.label} className={`donut-seg ${p.cls}`} cx="50" cy="50" r={r} fill="none" strokeWidth="14" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 50 50)">
              <title>{`${p.label}: ${Math.round((p.kcal / total) * 100)}%`}</title>
            </circle>
          );
          off += len;
          return seg;
        })}
      </svg>
      <ul className="legend">
        {parts.map((p) => (
          <li key={p.label}>
            <i className={p.cls} /> {p.label} <b>{Math.round((p.kcal / total) * 100)}%</b> <span className="muted">{Math.round(p.g)} g</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** GitHub-style activity grid: weeks as columns, Mon–Sun as rows. Sequential: one hue, light→dark. */
export function Heatmap({ end, weeks = 12, values, label }: { end: string; weeks?: number; values: Map<string, number>; label: (d: string, v: number) => string }) {
  const lastMon = addDays(end, -((parseISO(end).getDay() + 6) % 7));
  const start = addDays(lastMon, -7 * (weeks - 1));
  const max = Math.max(1, ...values.values());
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  return (
    <figure className="heatmap" aria-label="Activity over the last weeks">
      <div className="heat-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {cols.map((col, i) => (
          <div key={i} className="heat-col">
            {col.map((d) => {
              const v = values.get(d) ?? 0;
              const lvl = d > end ? 'future' : v === 0 ? 'l0' : `l${Math.min(4, Math.ceil((v / max) * 4))}`;
              return <span key={d} className={`heat ${lvl}`} title={label(d, v)} aria-label={label(d, v)} />;
            })}
          </div>
        ))}
      </div>
      <div className="heat-key muted small-text">
        Less <span className="heat l0" /> <span className="heat l1" /> <span className="heat l2" /> <span className="heat l3" /> <span className="heat l4" /> More
      </div>
    </figure>
  );
}
