import { useEffect, useState } from 'react';
import { on } from '@/game/controller';

// Module-level subscription helper: returns a single unsubscribe for both channels.
function subscribeTicks(bump) {
  const offRefresh = on('uiRefresh', bump);
  const offAlert = on('alert', bump);
  return () => {
    offRefresh();
    offAlert();
  };
}

// Module-level state updater (keeps hook closures free of locals).
const increment = (v) => v + 1;

// Re-render subscription to the sim's UI refresh pulse.
// Returns a monotonically increasing counter usable as a useMemo dependency.
export function useGameTick() {
  const [n, setN] = useState(0);
  useEffect(() => subscribeTicks(() => setN(increment)), [setN]);
  return n;
}
