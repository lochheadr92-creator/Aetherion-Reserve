import { useEffect, useRef } from 'react';
import { renderPortrait } from '@/game/renderer';

// Species portrait. The backing store is rendered at 2x the CSS size so the
// crisp Phase G sprites keep whole pixels in small list thumbnails.
export const Portrait = ({ speciesId, size = 64, className = '' }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) renderPortrait(ref.current, speciesId);
  }, [speciesId, size]);
  return (
    <canvas
      ref={ref}
      width={size * 2}
      height={size * 2}
      style={{ width: size, height: size }}
      className={`rounded-md border border-[var(--line)] ${className}`}
      data-testid={`portrait-${speciesId}`}
    />
  );
};

export default Portrait;
