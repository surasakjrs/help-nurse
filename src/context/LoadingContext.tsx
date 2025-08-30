'use client';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type StartOptions = {
  /** หน่วงก่อนโชว์ overlay เพื่อกัน “วูบ” จากงานที่เร็วมาก */
  delayMs?: number; // default 120
  /** ให้ overlay ค้างอย่างน้อยกี่ ms เพื่อกันกระพริบ */
  minVisibleMs?: number; // default 300
  /** ระหว่างโหลด บล็อกการスクロールหน้า */
  blockScroll?: boolean; // default true
};

type LoadingCtx = {
  isLoading: boolean;
  label?: string | null;
  start: (label?: string, opts?: StartOptions) => void;
  stop: () => void;
  withLoading: <T>(fn: () => Promise<T>, label?: string, opts?: StartOptions) => Promise<T>;
  setLabel: (label: string | null) => void;
};

const Ctx = createContext<LoadingCtx | null>(null);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  // นับงานที่กำลังโหลดอยู่ (รองรับการซ้อน)
  const counter = useRef(0);

  // ตัวตั้งค่าดีฟอลต์ (แก้ไขได้ถ้าต้องการเปลี่ยนทั่วระบบ)
  const defaults = useRef<Required<StartOptions>>({
    delayMs: 120,
    minVisibleMs: 300,
    blockScroll: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [label, setLabelState] = useState<string | null>(null);

  // จัดการ timer และเวลาแสดงผล
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const shownAt = useRef<number | null>(null);

  // สำหรับ track ว่ามีกี่งานที่ขอบล็อก scroll
  const scrollBlockCount = useRef(0);

  const blockScroll = useCallback((on: boolean) => {
    if (typeof document === 'undefined') return;
    const cls = 'overflow-hidden';
    const root = document.documentElement; // ใช้ html เพื่อครอบ viewport ทั้งหมด
    if (on) root.classList.add(cls);
    else root.classList.remove(cls);
  }, []);

  const clearTimers = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const setLabel = useCallback((v: string | null) => {
    setLabelState(v);
  }, []);

  const start = useCallback(
    (text?: string, opts?: StartOptions) => {
      const { delayMs, blockScroll: block, minVisibleMs } = { ...defaults.current, ...(opts || {}) };
      // เก็บค่าไว้ใช้ตอน stop (โดยไม่ต้องเซ็ตซ้ำทุกครั้ง)
      (defaults.current as Required<StartOptions>) = { delayMs, blockScroll: block, minVisibleMs };

      counter.current += 1;

      if (text) setLabelState(text);

      // ถ้า overlay แสดงอยู่แล้ว ก็ไม่ต้องตั้ง showTimer อีก
      if (isLoading) {
        if (block) {
          scrollBlockCount.current += 1;
          blockScroll(true);
        }
        return;
      }

      // ยังไม่แสดง → ตั้ง timer เพื่อโชว์หลัง delay
      clearTimers();
      if (block) {
        scrollBlockCount.current += 1;
        blockScroll(true);
      }
      showTimer.current = window.setTimeout(() => {
        setIsLoading(true);
        shownAt.current = Date.now();
        showTimer.current = null;
      }, delayMs);
    },
    [blockScroll, clearTimers, isLoading]
  );

  const stop = useCallback(() => {
    if (counter.current > 0) counter.current -= 1;
    if (counter.current > 0) return; // ยังมีงานค้าง → อย่าเพิ่งปิด

    // ไม่มีงานค้างแล้ว → เคลียร์
    counter.current = 0;

    const { minVisibleMs, blockScroll: block } = defaults.current;

    // จัดการ scroll block counter
    if (block && scrollBlockCount.current > 0) {
      scrollBlockCount.current -= 1;
      if (scrollBlockCount.current === 0) blockScroll(false);
    }

    // ถ้ายังไม่เคยโชว์ (ยังอยู่ใน delay) → ยกเลิกการโชว์
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
      setIsLoading(false);
      setLabelState(null);
      shownAt.current = null;
      return;
    }

    // ถ้าแสดงแล้ว → รอให้ครบ minVisibleMs เพื่อกันกระพริบ
    const since = shownAt.current ?? Date.now();
    const wait = Math.max(0, minVisibleMs - (Date.now() - since));

    clearTimers();
    hideTimer.current = window.setTimeout(() => {
      setIsLoading(false);
      setLabelState(null);
      shownAt.current = null;
      hideTimer.current = null;
    }, wait);
  }, [blockScroll, clearTimers]);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, text?: string, opts?: StartOptions) => {
      start(text, opts);
      try {
        return await fn();
      } finally {
        stop();
      }
    },
    [start, stop]
  );

  const value = useMemo<LoadingCtx>(
    () => ({
      isLoading,
      label,
      start,
      stop,
      withLoading,
      setLabel,
    }),
    [isLoading, label, start, stop, withLoading, setLabel]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Overlay */}
      {isLoading && (
        <div
          className='fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center'
          role='dialog'
          aria-modal='true'
          aria-label='กำลังทำงาน'
        >
          <div
            className='rounded-2xl bg-white/90 px-5 py-4 shadow-xl flex items-center gap-3'
            role='status'
            aria-live='polite'
            aria-busy='true'
            tabIndex={-1}
          >
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
