// Elapsed time since order.createdAt. The card shows a live "Ns / Nm Ns"
// counter (design page 4). Pure helpers; the 1Hz tick is in
// useElapsedSeconds so only the time node re-renders.
export function elapsedSeconds(createdAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
}

export function splitElapsed(totalSeconds: number): { m: number; s: number } {
  return { m: Math.floor(totalSeconds / 60), s: totalSeconds % 60 };
}
