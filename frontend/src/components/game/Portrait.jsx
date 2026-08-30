import { useEffect, useRef } from 'react';
import { renderPortrait } from '@/game/renderer';

export const Portrait = ({ speciesId, size = 64, className = '' }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) renderPortrait(ref.current, speciesId);
  }, [speciesId]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={`rounded-md border border-[var(--line)] ${className}`}
      data-testid={`portrait-${speciesId}`}
    />
  );
};

export default Portrait;
