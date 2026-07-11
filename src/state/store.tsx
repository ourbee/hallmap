import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppState } from '../types';
import { emptyState } from '../types';

const STORAGE_KEY = 'hallmap-v1';
// Data saved under the app's previous name (Seating Studio) is still loaded.
const LEGACY_STORAGE_KEY = 'seating-studio-v1';

interface Store {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  reset: () => void;
}

const StoreContext = createContext<Store | null>(null);

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const empty = emptyState();
    return {
      ...empty,
      ...parsed,
      exportPrefs: { ...empty.exportPrefs, ...parsed.exportPrefs },
      importPrefs: { ...empty.importPrefs, ...parsed.importPrefs },
    };
  } catch {
    return emptyState();
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // storage full or unavailable; keep working in memory
      }
    }, 300);
    return () => clearTimeout(t);
  }, [state]);

  const store = useMemo<Store>(
    () => ({
      state,
      update: (patch) => setState((s) => ({ ...s, ...patch })),
      reset: () => setState(emptyState()),
    }),
    [state],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
