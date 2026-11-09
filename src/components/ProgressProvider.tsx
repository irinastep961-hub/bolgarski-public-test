'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Progress } from '@/types';
import { progressRepository } from '@/storage';
import { createEmptyProgress } from '@/lib/progress';

interface ProgressContextValue {
  progress: Progress;
  update: (fn: (p: Progress) => Progress) => void;
  reset: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const latest = useRef<Progress | null>(null);

  useEffect(() => {
    let alive = true;
    progressRepository.load().then((p) => {
      if (!alive) return;
      latest.current = p;
      setProgress(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => {
    const current = latest.current;
    if (!current) return;
    const next = fn(current);
    latest.current = next;
    setProgress(next);
    void progressRepository.save(next);
  }, []);

  const reset = useCallback(async () => {
    await progressRepository.reset();
    const fresh = createEmptyProgress();
    latest.current = fresh;
    setProgress(fresh);
  }, []);

  if (!progress) return <div className="splash">Български</div>;
  return <ProgressContext.Provider value={{ progress, update, reset }}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress нужно вызывать внутри ProgressProvider');
  return ctx;
}
