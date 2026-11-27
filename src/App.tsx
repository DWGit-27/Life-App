import { useEffect, useState } from 'react';
import MyDay from './modules/MyDay';
import Tasks from './modules/Tasks';
import Money from './modules/Money';
import House from './modules/House';
import Health from './modules/Health';
import Settings from './modules/Settings';
import Search from './components/Search';
import { useAgenda } from './components/Agenda';
import { GlobalEditor, openEdit } from './registry';
import { ToastHost } from './toast';
import { prefs, useOnline, useUpdate } from './prefs';
import { Modal } from './components/Form';
import { today } from './lib/dates';

export type Page = 'today' | 'tasks' | 'money' | 'house' | 'health' | 'settings';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'today', label: 'My Day', icon: '☀️' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'money', label: 'Money', icon: '💷' },
  { id: 'house', label: 'House', icon: '🏠' },
  { id: 'health', label: 'Health', icon: '💪' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

// Old links (#/bills etc.) map into the new Money / House tabs.
const LEGACY: Record<string, [Page, string]> = { bills: ['money', 'bills'], insurance: ['money', 'insurance'], loans: ['money', 'loans'] };

const fromHash = (): [Page, string | undefined] => {
  const [p, sub] = location.hash.replace('#/', '').split('/');
  if (LEGACY[p]) return LEGACY[p];
  if (!NAV.some((n) => n.id === p)) return ['today', undefined];
  // Re-open the tab you last used in this section.
  return [p as Page, sub || prefs.lastSub(p)];
};

const SHORTCUTS: [string, string][] = [
  ['n', 'New task'],
  ['/', 'Search everything'],
  ['1 – 6', 'Go to My Day, Tasks, Money, House, Health, Settings'],
  ['Esc', 'Close a window'],
  ['Ctrl / ⌘ + Enter', 'Save the form you are editing'],
  ['?', 'Show these shortcuts'],
];

export default function App() {
  const [[page, sub], setRoute] = useState(fromHash);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [help, setHelp] = useState(false);
  const update = useUpdate();
  const online = useOnline();
  useEffect(() => {
    const onHash = () => setRoute(fromHash());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input,textarea,select,[contenteditable]') || document.body.classList.contains('modal-open');
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearching(true);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        setSearching(true);
      } else if (e.key === 'n') {
        e.preventDefault();
        openEdit({ table: 'tasks', initial: { schedule: { freq: 'once', interval: 1, start: today() } } });
      } else if (e.key === '?') setHelp(true);
      else if (/^[1-6]$/.test(e.key)) location.hash = `#/${NAV[Number(e.key) - 1].id}`;
    };
    addEventListener('hashchange', onHash);
    addEventListener('beforeinstallprompt', onPrompt);
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('hashchange', onHash);
      removeEventListener('beforeinstallprompt', onPrompt);
      removeEventListener('keydown', onKey);
    };
  }, []);
  const go = (p: Page, s?: string) => {
    location.hash = `#/${p}${s ? '/' + s : ''}`;
    scrollTo(0, 0);
  };
  const setSub = (s: string) => {
    prefs.setLastSub(page, s);
    go(page, s);
  };
  const agenda = useAgenda(0);
  const due = agenda.filter((i) => i.date <= today()).length;
  useEffect(() => {
    // Number on the installed app's icon (where the phone/OS supports it).
    try {
      if (due) (navigator as any).setAppBadge?.(due);
      else (navigator as any).clearAppBadge?.();
    } catch {
      /* unsupported */
    }
  }, [due]);

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">Life</div>
        <button className="search-btn" onClick={() => setSearching(true)}>
          🔍 <span className="nl">Search</span>
          <kbd>/</kbd>
        </button>
        <button className="new-btn" onClick={() => openEdit({ table: 'tasks', initial: { schedule: { freq: 'once', interval: 1, start: today() } } })}>
          ＋ <span className="nl">New task</span>
          <kbd>n</kbd>
        </button>
        {NAV.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={page === n.id ? 'on' : ''} onClick={() => scrollTo(0, 0)}>
            <span className="ni">{n.icon}</span>
            <span className="nl">{n.label}</span>
            {n.id === 'today' && due > 0 && <span className="badge">{due}</span>}
          </a>
        ))}
        <button className="link help-link" onClick={() => setHelp(true)}>
          Keyboard shortcuts <kbd>?</kbd>
        </button>
      </nav>
      <button className="search-fab" aria-label="Search everything" onClick={() => setSearching(true)}>
        🔍
      </button>
      {(update || !online) && (
        <div className="banner" role="status">
          {update ? (
            <>
              <span className="grow">A new version of Life App is ready.</span>
              <button className="primary small" onClick={update}>
                Update now
              </button>
            </>
          ) : (
            <span className="grow">You're offline. Everything still works and is saved on this device.</span>
          )}
        </div>
      )}
      <main>
        {page === 'today' && <MyDay go={go} />}
        {page === 'tasks' && <Tasks sub={sub} setSub={setSub} />}
        {page === 'money' && <Money sub={sub} setSub={setSub} />}
        {page === 'house' && <House sub={sub} setSub={setSub} />}
        {page === 'health' && <Health sub={sub} setSub={setSub} />}
        {page === 'settings' && <Settings installPrompt={installPrompt} />}
      </main>
      <GlobalEditor />
      {searching && <Search onClose={() => setSearching(false)} />}
      {help && (
        <Modal title="Keyboard shortcuts" onClose={() => setHelp(false)}>
          <table className="plain shortcuts">
            <tbody>
              {SHORTCUTS.map(([k, d]) => (
                <tr key={k}>
                  <td>
                    <kbd>{k}</kbd>
                  </td>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
      <ToastHost />
    </div>
  );
}
