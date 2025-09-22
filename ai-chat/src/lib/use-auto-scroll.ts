"use client";
import { useEffect, useRef } from 'react';

export function useAutoScroll<T extends HTMLElement>(): {
  containerRef: React.RefObject<T | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
} {
  const containerRef = useRef<T | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef<boolean>(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScrollRef.current = distanceFromBottom < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (shouldAutoScrollRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { containerRef, bottomRef };
}


