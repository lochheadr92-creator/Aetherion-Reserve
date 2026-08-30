// ---- Creature sprite sheet registry (lazy-baked, cached) ----
import { Px } from './pixel';
import { CREATURES_A } from './creatures_a';
import { CREATURES_B } from './creatures_b';

export const CREATURE_ART = { ...CREATURES_A, ...CREATURES_B };

const cache = new Map();

export function getCreatureSheet(id) {
  if (cache.has(id)) return cache.get(id);
  const def = CREATURE_ART[id];
  if (!def) return null;
  const bake = (mode, n) => {
    const frames = [];
    for (let f = 0; f < n; f++) {
      const P = new Px(def.w, def.h);
      def.paint(P, f, mode);
      P.outline();
      frames.push(P.canvas());
    }
    return frames;
  };
  const sheet = {
    idle: bake('idle', def.idleFrames || 3),
    walk: def.walkFrames ? bake('walk', def.walkFrames) : null,
    w: def.w, h: def.h,
    shadow: def.shadow || { rx: 8, ry: 3, alpha: 0.3 },
    bob: !!def.bob,
    hover: def.hover || 0,
  };
  cache.set(id, sheet);
  return sheet;
}
