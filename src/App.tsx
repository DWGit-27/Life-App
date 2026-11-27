import { useEffect, useState } from 'react';
import MyDay from './modules/MyDay';
import Tasks from './modules/Tasks';
import Money from './modules/Money';
import House from './modules/House';
import Health from './modules/Health';
import Settings from './modules/Settings';
import Search from './components/Search';
import { useAgenda } from './components/Agenda';
import { GlobalEditor } from './registry';
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
  return NAV.some((n) => n.id === p) ? [p as Page, sub] : ['today', undefined];
};

export default function App() {
  const [[page, sub], setRoute] = useState(fromHash);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const onHash = () => setRoute(fromHash());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,select'))) {
        e.preventDefault();
        setSearching(true);
      }
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
  const setSub = (s: string) => go(page, s);
  const agenda = useAgenda(0);
  const due = agenda.filter((i) => i.date <= today()).length;

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">Life</div>
        <button className="search-btn" onClick={() => setSearching(true)}>
          🔍 <span className="nl">Search</span>
          <kbd>/</kbd>
        </button>
        {NAV.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={page === n.id ? 'on' : ''} onClick={() => scrollTo(0, 0)}>
            <span className="ni">{n.icon}</span>
            <span className="nl">{n.label}</span>
            {n.id === 'today' && due > 0 && <span className="badge">{due}</span>}
          </a>
        ))}
      </nav>
      <button className="search-fab" aria-label="Search everything" onClick={() => setSearching(true)}>
        🔍
      </button>
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
    </div>
  );
}
