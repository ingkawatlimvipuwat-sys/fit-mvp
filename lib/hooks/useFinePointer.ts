'use client';
import { useEffect, useState } from 'react';

/**
 * True when the main pointer is a mouse or trackpad (drag-and-drop is offered).
 * False during server rendering, on the first paint, and on touch screens
 * (phones and tablets keep Move to…).
 */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: fine)');
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return fine;
}
