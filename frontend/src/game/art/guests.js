// ---- Guest pixel sprites (visual-only) ----
// Replaces rect+circle guests with baked archetype characters:
// distinct silhouette + outfit + accessory per archetype, 2-frame walk.
import { Px, tone } from './pixel';

const SKIN = ['#c9a789', '#a8836a', '#8a6a52', '#d8b89a'];
const HAIR = ['#2c2620', '#4a3a28', '#6a5a48', '#3a3a44'];

// archetype: { coat, accent, accessory painter }
const ARCH = {
  family: {
    coat: '#b09660', accent: '#e0c080',
    extra(P, f) { P.hl(3, 1, 4, '#8a6a3a'); P.p(4, 0, '#8a6a3a'); }, // sun hat brim
  },
  researcher: {
    coat: '#3d5a52', accent: '#6ef3c5',
    extra(P, f) { P.r(7, 6 - (f % 2), 2, 1, '#22303e'); P.p(8, 6 - (f % 2), '#6ef3c5'); }, // tablet
  },
  thrill: {
    coat: '#a04a42', accent: '#ff8a7a',
    extra(P, f) { P.hl(3, 1, 3, '#ff8a7a'); P.p(2, 2, '#ff8a7a'); }, // cap worn back
  },
  nature: {
    coat: '#4a6a4e', accent: '#8fd0b0',
    extra(P, f) { P.r(1, 5, 2, 4, '#5c4a33'); P.p(1, 5, tone('#5c4a33', 0.25)); }, // backpack
  },
};

const cache = new Map();

export function getGuestSprite(archetype, variant, frame) {
  const a = ARCH[archetype] || ARCH.family;
  const v = variant % 4, f = frame % 2;
  const key = `${archetype}:${v}:${f}`;
  if (cache.has(key)) return cache.get(key);
  const P = new Px(10, 13);
  const skin = SKIN[v], hair = HAIR[(v + 1) % 4];
  const coat = v % 2 ? tone(a.coat, -0.08) : a.coat;
  // legs (walk alternation)
  P.vl(4, 10, 3 - f, '#2b3442'); P.p(4, 12, '#1c2430');
  P.vl(6, 10 + f, 3 - f, tone('#2b3442', -0.2)); P.p(6, 12, '#1c2430');
  // torso coat with shading + trim
  P.slab(3, 5, 5, 5, coat);
  P.hl(3, 5, 5, tone(coat, 0.2));
  P.vl(5, 6, 3, tone(coat, -0.22)); // zip seam
  P.p(3, 9, tone(coat, -0.3)); P.p(7, 9, tone(coat, -0.35)); // hem shade
  // arms (swing on walk)
  P.vl(2, 6 + f, 3, tone(coat, -0.12));
  P.vl(8, 7 - f, 3, tone(coat, -0.18));
  // head + hair + accent collar
  P.blob(5.2, 3, 1.9, 1.9, skin, { lite: 0.2, dark: 0.2 });
  P.hl(4, 1, 3, hair); P.p(3, 2, hair);
  P.hl(3, 5, 5, tone(a.accent, -0.2)); // collar accent
  a.extra(P, f);
  P.outline('rgba(5,9,14,0.75)');
  const spr = { cv: P.canvas(), w: 10, h: 13 };
  cache.set(key, spr);
  return spr;
}
