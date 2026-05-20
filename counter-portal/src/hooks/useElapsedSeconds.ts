import { useEffect, useState } from 'react';
import { elapsedSeconds } from '../lib/orderTime';

// 1Hz ticking elapsed-seconds for a single order. Kept tiny so only the
// <ElapsedTime> node re-renders, not the whole card/list.
export function useElapsedSeconds(createdAt: string): number {
  const [seconds, setSeconds] = useState(() => elapsedSeconds(createdAt));

  useEffect(() => {
    setSeconds(elapsedSeconds(createdAt));
    const id = window.setInterval(() => {
      setSeconds(elapsedSeconds(createdAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [createdAt]);

  return seconds;
}
