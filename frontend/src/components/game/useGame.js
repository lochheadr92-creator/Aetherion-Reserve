import { useEffect, useState } from 'react';
import { on } from '@/game/controller';

// re-render subscription to the sim's UI refresh pulse
export function useGameTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const off1 = on('uiRefresh', () => setN((n) => n + 1));
    const off2 = on('alert', () => setN((n) => n + 1));
    return () => { off1(); off2(); };
  }, []);
}
