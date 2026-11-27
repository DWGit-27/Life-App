import { useState } from 'react';
import { DATA_TABLES, db, exportAll, importAll } from '../db';
import { loadSample } from '../sample';

export default function Settings({ installPrompt }: { installPrompt: any }) {
  const [msg, setMsg] = useState('');
  const download = async () => {
    const blob = new Blob([await exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `life-app-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Backup downloaded.');
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = await importAll(await f.text());
      setMsg(`Imported ${n} records. Newer copies were kept where both had the same item.`);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };
  const [confirmWipe, setConfirmWipe] = useState(false);
  return (
    <div className="page">
      <h1>Settings</h1>
      {msg && <div className="card notice">{msg}</div>}
      <section className="card">
        <h2>Install on your phone or computer</h2>
        {installPrompt ? (
          <button className="primary" onClick={() => installPrompt.prompt()}>
            Install Life App
          </button>
        ) : (
          <p>
            <b>Android (Chrome):</b> menu ⋮ → <i>Add to Home screen</i> or <i>Install app</i>.<br />
            <b>Desktop (Chrome / Edge):</b> the install icon at the right of the address bar.
          </p>
        )}
        <p className="muted">It works offline once installed.</p>
      </section>
      <section className="card">
        <h2>Backup</h2>
        <p className="muted">Your data is stored on this device only, until sync is added. Download a backup now and then, and use it to move data to another device.</p>
        <div className="row wrap">
          <button onClick={download}>Download backup</button>
          <label className="button">
            Import backup
            <input type="file" accept="application/json,.json" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        </div>
      </section>
      <section className="card">
        <h2>Try it out</h2>
        <p className="muted">Adds example bills, insurance, house jobs, a mortgage, a budget and tasks. Every example is marked "example" in its notes.</p>
        <div className="row wrap">
          <button
            onClick={async () => {
              await loadSample();
              setMsg('Example data added.');
            }}
          >
            Load example data
          </button>
          <button
            className="danger"
            onClick={async () => {
              if (!confirmWipe) return setConfirmWipe(true);
              await db.transaction('rw', DATA_TABLES.map((t) => db[t]), async () => {
                for (const t of DATA_TABLES) await db[t].clear();
              });
              setConfirmWipe(false);
              setMsg('All data deleted from this device.');
            }}
          >
            {confirmWipe ? 'Tap again to delete everything' : 'Delete all data'}
          </button>
        </div>
      </section>
      <section className="card">
        <h2>Coming next</h2>
        <ul>
          <li>Sync between your phone and computer, with separate accounts and optional sharing</li>
          <li>Workouts, work projects, house inventory and investments</li>
          <li>Android app (APK) built automatically on GitHub</li>
        </ul>
      </section>
    </div>
  );
}
