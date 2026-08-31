// ---- Staff pixel sprites (redesigned production pass) ----
// Roles readable by silhouette + equipment. 14x18 art px, facing right,
// 2 frames (pose shift + equipment pulse). Baked + cached.
import { Px, tone, mixc } from './pixel';

const SKIN = '#c9a789';
const VISOR = '#2DE2E6';
const BOOT = '#1c2430';

export const STAFF_ART = {
  // FIELD XENOBIOLOGIST — light field gear: scanner mast, satchel, raised tablet
  xenobiologist: {
    w: 14, h: 18, frames: 2,
    paint(P, f) {
      const suit = '#3d5a52', trim = '#6ef3c5', strap = '#5c4a33';
      // legs + boots
      P.vl(5, 13, 4, tone(suit, -0.25)); P.r(5, 16, 2, 1, BOOT);
      P.vl(7, 13 + (f % 2), 4 - (f % 2), tone(suit, -0.3)); P.r(7, 16, 2, 1, tone(BOOT, -0.1));
      // field jacket with stitched seams
      P.slab(4, 7, 6, 6, suit);
      P.hl(4, 7, 6, tone(suit, 0.2));
      P.vl(7, 8, 4, tone(suit, -0.2)); // zip
      P.hl(4, 10, 6, tone(suit, -0.15)); // waist seam
      // cross strap + hip satchel
      P.p(5, 8, strap); P.p(6, 9, strap); P.p(7, 10, strap);
      P.r(3, 10, 2, 3, strap); P.hl(3, 10, 2, tone(strap, 0.3)); P.p(3, 11, tone(trim, -0.2));
      // raised tablet arm (scan pose alternates)
      const ta = f === 0 ? 0 : 1;
      P.r(10, 8 - ta, 3, 2, '#22303e');
      P.p(11, 8 - ta, VISOR); P.p(12, 8 - ta, tone(VISOR, 0.3));
      P.vl(9, 8, 2, tone(suit, -0.15)); // arm
      // shoulder scanner mast
      P.vl(4, 4, 3, tone(trim, -0.25)); P.p(4, 3, trim);
      if (f === 1) P.p(4, 2, tone(trim, 0.3)); // ping
      // head + visor band + hood collar
      P.blob(6.8, 4.6, 2.2, 2.2, SKIN, { lite: 0.2, dark: 0.2 });
      P.hl(6, 4, 4, tone(VISOR, -0.2));
      P.hl(5, 3, 3, '#31473a'); // hood line
      P.hl(4, 7, 6, tone(suit, 0.08)); // collar
    },
  },

  // CONTAINMENT WARDEN — heavy armour: pauldrons, chest rig, containment prod
  warden: {
    w: 16, h: 18, frames: 2,
    paint(P, f) {
      const armor = '#5a2e3a', plate = '#3a2028', amber = '#f2c14e';
      // armoured legs + heavy boots
      P.slab(5, 13, 2, 4, tone(armor, -0.2)); P.r(4, 16, 3, 1, BOOT);
      P.slab(8, 13 + (f % 2), 2, 4 - (f % 2), tone(armor, -0.28)); P.r(8, 16, 3, 1, tone(BOOT, -0.1));
      // broad reinforced torso with plate rows
      P.slab(4, 7, 8, 6, armor, { tex: 1 });
      P.hl(4, 7, 8, tone(armor, 0.22));
      P.hl(4, 10, 8, tone(plate, 0.05)); // belt plate
      // chest rig + status core
      P.r(6, 8, 4, 3, plate);
      P.hl(6, 8, 4, tone(plate, 0.25));
      P.p(7, 9, f === 0 ? amber : tone(amber, -0.35));
      // massive pauldrons (silhouette breakers)
      P.r(3, 6, 3, 3, plate); P.hl(3, 6, 3, tone(plate, 0.3));
      P.r(11, 6, 3, 3, plate); P.hl(11, 6, 3, tone(plate, 0.22));
      P.p(3, 8, tone(amber, -0.4)); // pauldron stud
      // containment prod (two-segment with emitter)
      P.vl(14, 5, 9, '#3a4a60'); P.p(14, 13, tone('#3a4a60', -0.3));
      P.r(13, 4, 3, 1, '#22303e');
      P.p(14, 3, f === 0 ? '#ff5c7a' : tone('#ff5c7a', -0.3));
      if (f === 0) P.p(15, 2, tone('#ff5c7a', -0.45)); // arc flicker
      // full helmet with visor slit
      P.blob(7.6, 4.2, 2.6, 2.5, plate, { lite: 0.2 });
      P.hl(7, 4, 4, VISOR);
      P.p(9, 3, tone(plate, 0.3)); // crest ridge
    },
  },

  // BIOMEDICAL OFFICER — clean long coat, med pack, diagnostic wand
  biomedical: {
    w: 14, h: 18, frames: 2,
    paint(P, f) {
      const coat = '#8a97a5', trim = '#4ac0a8', under = '#3a4450';
      // legs
      P.vl(5, 13, 4, under); P.r(5, 16, 2, 1, BOOT);
      P.vl(7, 13 + (f % 2), 4 - (f % 2), tone(under, -0.15)); P.r(7, 16, 2, 1, tone(BOOT, -0.1));
      // long coat with split hem
      P.slab(4, 7, 6, 7, coat);
      P.hl(4, 7, 6, tone(coat, 0.22));
      P.vl(7, 8, 6, tone(coat, -0.2)); // front seam
      P.p(4, 13, tone(coat, -0.12)); P.p(9, 13, tone(coat, -0.18)); // hem flare
      P.hl(4, 9, 2, trim); // med badge
      // back med pack with cross emblem
      P.r(2, 8, 2, 4, '#b8c4cc'); P.hl(2, 8, 2, tone('#b8c4cc', 0.2));
      P.p(2, 9, trim); P.p(3, 9, trim); P.p(2, 10, trim);
      // diagnostic wand (pulse tip)
      P.vl(11, 9, 4, '#22303e');
      P.p(11, 8, f === 0 ? trim : tone(trim, 0.35));
      if (f === 1) P.p(12, 7, tone(trim, -0.2)); // scan tick
      // head + medical cap + headset
      P.blob(6.8, 4.6, 2.2, 2.2, SKIN, { lite: 0.2, dark: 0.2 });
      P.hl(5, 2.6, 4, '#d5dde2'); P.p(5, 3.6, '#d5dde2'); // cap
      P.p(9, 4, trim); P.p(9, 5, tone(trim, -0.3)); // headset
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
