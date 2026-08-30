import { useEffect, useState } from 'react';
import { on } from '@/game/controller';

// Re-render subscription to the sim's UI refresh pulse.
// Returns a monotonically increasing counter usable as a useMemo dependency.
export function useGameTick() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const off1 = on('uiRefresh', () => setN((v) => v + 1));
    const off2 = on('alert', () => setN((v) => v + 1));
    return () => { off1(); off2(); };
  }, []);
  return n;
}
