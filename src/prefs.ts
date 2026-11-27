import { useSyncExternalStore } from 'react';

/** Per-device display preferences (kept in localStorage, not synced). */
export type Theme = 'auto' | 'light' | 'dark';
export type TextSize = 'small' | 'normal' | 'large' | 'xl';

const get = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};
const set = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

export const prefs = {
  theme: () => get('pref:theme', 'auto') as Theme,
  textSize: () => get('pref:text', 'normal') as TextSize,
  setTheme(t: Theme) {
    set('pref:theme', t);
    applyPrefs();
  },
  setTextSize(t: TextSize) {
    set('pref:text', t);
    applyPrefs();
  },
  lastSub: (page: string) => get(`pref:sub:${page}`, '') || undefined,
  setLastSub: (page: string, sub: string) => set(`pref:sub:${page}`, sub),
};

export function applyPrefs() {
  const root = document.documentElement;
  const theme = prefs.theme();
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  root.setAttribute('data-text', prefs.textSize());
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121514' : '#2f6f5e');
}

/* ---- "new version available" signal from the service worker ---- */
let update: (() => void) | null = null;
const listeners = new Set<() => void>();
export function setUpdate(fn: () => void) {
  update = fn;
  listeners.forEach((l) => l());
}
export function useUpdate() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => update,
  );
}

export function useOnline() {
  return useSyncExternalStore(
    (l) => {
      addEventListener('online', l);
      addEventListener('offline', l);
      return () => {
        removeEventListener('online', l);
        removeEventListener('offline', l);
      };
    },
    () => navigator.onLine,
  );
}
