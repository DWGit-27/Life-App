import { useEffect, useSyncExternalStore } from 'react';

interface Toast {
  id: number;
  text: string;
  undo?: () => unknown;
}
let current: Toast | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Show a short message at the bottom, optionally with Undo. */
export function showToast(text: string, undo?: Toast['undo']) {
  current = { id: Date.now(), text, undo };
  emit();
}

export function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

export function ToastHost() {
  const t = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  useEffect(() => {
    if (!t) return;
    const id = t.id;
    const timer = setTimeout(() => {
      if (current?.id === id) {
        current = null;
        emit();
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [t]);
  if (!t) return null;
  return (
    <div className="toast" role="status">
      <span>{t.text}</span>
      {t.undo && (
        <button
          onClick={async () => {
            await t.undo!();
            current = null;
            emit();
          }}
        >
          Undo
        </button>
      )}
      <button
        className="icon"
        aria-label="Dismiss"
        onClick={() => {
          current = null;
          emit();
        }}
      >
        ✕
      </button>
    </div>
  );
}
