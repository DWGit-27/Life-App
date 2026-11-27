import { useEffect, useState } from 'react';
import Today from './modules/Today';
import Tasks from './modules/Tasks';
import Bills from './modules/Bills';
import Insurance from './modules/Insurance';
import House from './modules/House';
import Money from './modules/Money';
import Loans from './modules/Loans';
import Settings from './modules/Settings';
import { useAgenda } from './components/Agenda';
import { today } from './lib/dates';

export type Page = 'today' | 'tasks' | 'bills' | 'insurance' | 'house' | 'money' | 'loans' | 'settings';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '☀️' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'bills', label: 'Bills', icon: '🧾' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️' },
  { id: 'house', label: 'House', icon: '🏠' },
  { id: 'money', label: 'Money', icon: '💷' },
  { id: 'loans', label: 'Loans', icon: '🏦' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const fromHash = (): Page => {
  const h = location.hash.replace('#/', '') as Page;
  return NAV.some((n) => n.id === h) ? h : 'today';
};

export default function App() {
  const [page, setPage] = useState<Page>(fromHash);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  useEffect(() => {
    const onHash = () => setPage(fromHash());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    addEventListener('hashchange', onHash);
    addEventListener('beforeinstallprompt', onPrompt);
    return () => {
      removeEventListener('hashchange', onHash);
      removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);
  const go = (p: Page) => {
    location.hash = `#/${p}`;
    scrollTo(0, 0);
  };
  const agenda = useAgenda(0);
  const due = agenda.filter((i) => i.date <= today()).length;

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">Life</div>
        {NAV.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={page === n.id ? 'on' : ''} onClick={() => scrollTo(0, 0)}>
            <span className="ni">{n.icon}</span>
            <span className="nl">{n.label}</span>
            {n.id === 'tasks' && due > 0 && <span className="badge">{due}</span>}
          </a>
        ))}
      </nav>
      <main>
        {page === 'today' && <Today go={go} />}
        {page === 'tasks' && <Tasks />}
        {page === 'bills' && <Bills />}
        {page === 'insurance' && <Insurance />}
        {page === 'house' && <House />}
        {page === 'money' && <Money />}
        {page === 'loans' && <Loans />}
        {page === 'settings' && <Settings installPrompt={installPrompt} />}
      </main>
    </div>
  );
}
