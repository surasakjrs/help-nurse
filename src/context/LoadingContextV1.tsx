'use client';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type LoadingCtx = {
  isLoading: boolean;
  label?: string | null;
  start: (label?: string) => void;
  stop: () => void;
  withLoading: <T>(fn: () => Promise<T>, label?: string) => Promise<T>;
};

const Ctx = createContext<LoadingCtx | null>(null);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const counter = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  const start = useCallback((text?: string) => {
    counter.current += 1;
    if (text) setLabel(text);
    setIsLoading(true);
  }, []);

  const stop = useCallback(() => {
    counter.current = Math.max(0, counter.current - 1);
    if (counter.current === 0) {
      setIsLoading(false);
      setLabel(null);
    }
  }, []);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, text?: string) => {
      start(text);
      try {
        return await fn();
      } finally {
        stop();
      }
    },
    [start, stop]
  );

  const value = useMemo(
    () => ({ isLoading, label, start, stop, withLoading }),
    [isLoading, label, start, stop, withLoading]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Overlay */}
      {isLoading && (
        <div className='fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center'>
          <div className='rounded-2xl bg-white/90 px-5 py-4 shadow-xl flex items-center gap-3'>
            <div className='w-5 h-5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin' />
            <div className='text-sm text-zinc-800'>
              กำลังทำงาน…{label ? <span className='ml-1 text-zinc-600'>({label})</span> : null}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLoading must be used within <LoadingProvider>');
  return ctx;
}
