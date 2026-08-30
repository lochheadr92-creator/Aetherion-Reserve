// ---- Staff pixel sprites (art-only; ready for future keeper integration) ----
// Roles distinguishable by silhouette + equipment, not colour alone.
// 10x16 art px grid, facing right, 2 idle frames each.
import { Px, tone } from './pixel';

const SKIN = '#c9a789';
const VISOR = '#2DE2E6';

export const STAFF_ART = {
  // FIELD XENOBIOLOGIST — scanner + sample satchel + tablet, light gear
  xenobiologist: {
    w: 12, h: 16, frames: 2,
    paint(P, f) {
      const suit = '#3d5a52', trim = '#6ef3c5';
      // legs
      P.vl(4, 12, 4, tone(suit, -0.25)); P.vl(6, 12, 4, tone(suit, -0.3));
      // torso (light field jacket)
      P.slab(3, 6, 5, 6, suit);
      P.hl(3, 6, 5, tone(suit, 0.18));
      // sample satchel (hip, left)
      P.r(2, 9, 2, 3, '#5c4a33'); P.p(2, 9, tone('#5c4a33', 0.25));
      // tablet arm raised (frame-animated scan pose)
      const ta = f === 0 ? 0 : 1;
      P.r(8, 7 - ta, 2, 1, '#22303e'); P.p(9, 7 - ta, VISOR);
      // scanner antenna on shoulder
      P.vl(3, 4, 2, tone(trim, -0.2)); P.p(3, 3, trim);
      // head + light visor
      P.blob(5.5, 4, 2, 2, SKIN, { lite: 0.2, dark: 0.2 });
      P.hl(5, 4, 3, tone(VISOR, -0.25));
      // hood collar
      P.hl(3, 6, 5, tone(suit, 0.05));
    },
  },

  // CONTAINMENT WARDEN — heavy armour, broad silhouette, containment tools
  warden: {
    w: 14, h: 16, frames: 2,
    paint(P, f) {
      const armor = '#5a2e3a', plate = '#3a2028', amber = '#f2c14e';
      // legs (armoured, wider)
      P.slab(4, 12, 2, 4, tone(armor, -0.2)); P.slab(7, 12, 2, 4, tone(armor, -0.28));
      // broad reinforced torso
      P.slab(3, 6, 8, 6, armor, { tex: 1 });
      P.hl(3, 6, 8, tone(armor, 0.2));
      // chest plate + status light
      P.r(5, 7, 4, 3, plate);
      P.p(6, 8, f === 0 ? amber : tone(amber, -0.35));
      // shoulder pauldrons (broaden silhouette)
      P.r(2, 6, 2, 2, plate); P.r(10, 6, 2, 2, plate);
      P.p(2, 6, tone(plate, 0.25)); P.p(10, 6, tone(plate, 0.2));
      // containment prod (right hand)
      P.vl(12, 5, 7, '#3a4a60');
      P.p(12, 4, f === 0 ? '#ff5c7a' : tone('#ff5c7a', -0.3));
      // helmet (full, visored)
      P.blob(6.5, 3.6, 2.4, 2.2, plate, { lite: 0.18 });
      P.hl(6, 4, 3, VISOR);
    },
  },

  // BIOMEDICAL OFFICER — diagnostic gear + med pack, clean technical silhouette
  biomedical: {
    w: 12, h: 16, frames: 2,
    paint(P, f) {
      const coat = '#8a97a5', trim = '#4ac0a8';
      // legs
      P.vl(4, 12, 4, '#3a4450'); P.vl(6, 12, 4, tone('#3a4450', -0.15));
      // long clean coat
      P.slab(3, 6, 5, 7, coat);
      P.hl(3, 6, 5, tone(coat, 0.2));
      P.vl(5, 7, 5, tone(coat, -0.18)); // coat seam
      // med pack (back, cross emblem)
      P.r(1, 7, 2, 4, '#b8c4cc');
      P.p(1, 8, trim); P.p(2, 8, trim); P.p(1, 9, trim);
      // diagnostic wand (frame pulse)
      P.vl(9, 8, 3, '#22303e');
      P.p(9, 7, f === 0 ? trim : tone(trim, 0.3));
      // head + medical headset
      P.blob(5.5, 4, 2, 2, SKIN, { lite: 0.2, dark: 0.2 });
      P.p(7, 3, trim); P.hl(4, 2, 3, '#d5dde2'); // cap
    },
  },
};

const cache = new Map();

export function getStaffSprite(role) {
  if (cache.has(role)) return cache.get(role);
  const def = STAFF_ART[role];
  if (!def) return null;
  const frames = [];
  for (let f = 0; f < def.frames; f++) {
    const P = new Px(def.w, def.h);
    def.paint(P, f);
    P.outline();
    frames.push(P.canvas());
  }
  const spr = { frames, w: def.w, h: def.h };
  cache.set(role, spr);
  return spr;
}
