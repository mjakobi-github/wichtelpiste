import type { LevelData, Segment, Vec2 } from './types';

/**
 * Plattform-Kanten als Segmente (für die Schlitten-Physik):
 * top/left/right/bottom jeder Plattform. So kann der Schlitten auf
 * Plattformen gleiten und an Seiten anstoßen, ohne eigene AABB-Logik.
 */
export function platformSegments(level: LevelData): Segment[] {
  const out: Segment[] = [];
  const push = (a: Vec2, b: Vec2) =>
    out.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
  for (const p of level.platforms) {
    push({ x: p.x, y: p.y }, { x: p.x + p.w, y: p.y });                // top
    push({ x: p.x, y: p.y + p.h }, { x: p.x + p.w, y: p.y + p.h });    // bottom
    push({ x: p.x, y: p.y }, { x: p.x, y: p.y + p.h });                // left
    push({ x: p.x + p.w, y: p.y }, { x: p.x + p.w, y: p.y + p.h });    // right
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Level 1 – die Lehrerin: Fuß → erste Schlucht → Lieferung            */
/* ------------------------------------------------------------------ */

const LEVEL_1: LevelData = {
  id: 'l1',
  name: 'Erste Schlucht',
  worldW: 2600,
  worldH: 720,
  spawn: { x: 100, y: 400 },
  platforms: [
    { x: 0,    y: 620, w: 700,  h: 100 },
    { x: 420,  y: 490, w: 160,  h: 24 },
    { x: 1500, y: 590, w: 430,  h: 130 },
    { x: 1930, y: 640, w: 670,  h: 80 },
    { x: 2100, y: 500, w: 160,  h: 24 },
    { x: 2330, y: 400, w: 160,  h: 24 },
  ],
  stations: [{ pos: { x: 640, y: 560 } }],
  dismounts: [{ x: 1500, y: 450, w: 160, h: 140 }],
  gifts: [
    { x: 160,  y: 604 },
    { x: 320,  y: 604 },
    { x: 500,  y: 474 },
    { x: 900,  y: 520 },
    { x: 1060, y: 470 },
    { x: 1220, y: 400 },
    { x: 1570, y: 574 },
    { x: 2000, y: 624 },
    { x: 2180, y: 484 },
    { x: 2410, y: 384 },
    { x: 2480, y: 624 },
  ],
  checkpoints: [
    { x: 1560, y: 590 },
    { x: 1960, y: 640 },
  ],
  icicles: [
    { x: 350,  y: 620, h: 46 },
    { x: 2060, y: 640, h: 42 },
    { x: 2240, y: 500, h: 36 },
    { x: 2370, y: 400, h: 34 },
  ],
  candies: [
    { x: 1730, y: 590, h: 85 },   // Landedamm: Sprung über die Stange
    { x: 2440, y: 640, h: 75 },   // Wächter vor der Schornstein-Zufahrt
  ],
  chimney: { x: 2540, y: 640 },
  areas: [{ ink: 1500, boost: 350 }],
};

/* ------------------------------------------------------------------ */
/* Level 2 – Wellen-Parcours: mehr Schlucklocher, fliegende Ketten      */
/* ------------------------------------------------------------------ */

const LEVEL_2: LevelData = {
  id: 'l2',
  name: 'Wellen-Parcours',
  worldW: 3400,
  worldH: 760,
  spawn: { x: 100, y: 420 },
  platforms: [
    { x: 0,    y: 660, w: 800,  h: 100 },
    { x: 1100, y: 600, w: 220,  h: 160 },   // Mittelplattform in der Kluft
    { x: 1400, y: 500, w: 220,  h: 24 },
    { x: 1780, y: 420, w: 220,  h: 24 },
    { x: 2160, y: 500, w: 220,  h: 24 },
    { x: 2500, y: 560, w: 320,  h: 200 },   // Landeplatte
    { x: 2560, y: 660, w: 840,  h: 100 },   // Endbereich
  ],
  stations: [
    { pos: { x: 720, y: 600 } },
    { pos: { x: 2900, y: 600 } },           // Bonus-Schlitten hinter der Landung
  ],
  dismounts: [
    { x: 2500, y: 420, w: 150, h: 140 },
  ],
  gifts: [
    { x: 220,  y: 644 },
    { x: 420,  y: 644 },
    { x: 600,  y: 644 },
    { x: 960,  y: 520 },   // Flug 1
    { x: 1210, y: 584 },
    { x: 1510, y: 470 },
    { x: 1890, y: 390 },
    { x: 2270, y: 470 },
    { x: 2620, y: 545 },
    { x: 2840, y: 645 },
    { x: 3130, y: 645 },
  ],
  checkpoints: [
    { x: 1210, y: 600 },
    { x: 2620, y: 560 },
  ],
  icicles: [
    { x: 1060, y: 600, h: 38 },
    { x: 1450, y: 500, h: 34 },
    { x: 1840, y: 420, h: 34 },
    { x: 2700, y: 660, h: 42 },
    { x: 2840, y: 660, h: 42 },
  ],
  candies: [
    { x: 560,  y: 660, h: 85 },   // vor der Station: erst springen, dann aufsitzen
    { x: 2740, y: 560, h: 75 },   // Landedamm: Sprung über die Stange
  ],
  chimney: { x: 3260, y: 660 },
  areas: [
    { ink: 1400, boost: 250 },   // Bereich 1: grosse Kluft
    { ink: 1000, boost: 200 },   // Bereich 2: Bonus-Schlitten hinter der Landung
  ],
};

/* ------------------------------------------------------------------ */
/* Level 3 – Nachtexpress: zwei Fahrten, mehr Eiszapfen, Weitwurf       */
/* ------------------------------------------------------------------ */

const LEVEL_3: LevelData = {
  id: 'l3',
  name: 'Nachtexpress',
  worldW: 3800,
  worldH: 760,
  spawn: { x: 100, y: 420 },
  platforms: [
    { x: 0,    y: 640, w: 500,  h: 120 },
    { x: 1400, y: 560, w: 500,  h: 200 },   // Torre (Landung 1 + Schritt)
    { x: 1980, y: 470, w: 160,  h: 24 },
    { x: 2400, y: 640, w: 500,  h: 120 },   // Station 2 Plateau
    { x: 3300, y: 600, w: 500,  h: 160 },   // Endplateau
  ],
  stations: [
    { pos: { x: 450, y: 580 } },
    { pos: { x: 2500, y: 580 } },
  ],
  dismounts: [
    { x: 1400, y: 420, w: 150, h: 140 },
    { x: 3300, y: 460, w: 150, h: 140 },
  ],
  gifts: [
    { x: 240,  y: 624 },
    { x: 700,  y: 480 },   // Flug 1
    { x: 940,  y: 420 },
    { x: 1160, y: 470 },
    { x: 1470, y: 545 },
    { x: 2050, y: 454 },   // Bonus-Stufe (unter Eiszapfen!)
    { x: 2250, y: 624 },
    { x: 2810, y: 624 },
    { x: 3010, y: 500 },   // Flug 2
    { x: 3160, y: 430 },
    { x: 3450, y: 585 },
    { x: 3620, y: 585 },
  ],
  checkpoints: [
    { x: 1470, y: 560 },
    { x: 2450, y: 640 },
  ],
  icicles: [
    { x: 300,  y: 640, h: 46 },
    { x: 2060, y: 470, h: 42 },
    { x: 2870, y: 640, h: 42 },
    { x: 3350, y: 600, h: 40 },
  ],
  candies: [
    { x: 1700, y: 560, h: 85 },   // Torre: Sprung über die Stange
    { x: 2700, y: 640, h: 80 },   // Plateau Station 2: Hindernis neben der Zone
    { x: 3560, y: 600, h: 70 },   // Endplateau: letzter Hopser vorm Schornstein
  ],
  chimney: { x: 3700, y: 600 },
  areas: [
    { ink: 1800, boost: 300 },   // Bereich 1: bis zum Torre
    { ink: 1300, boost: 250 },   // Bereich 2: Torre bis zum Ziel
  ],
};

export const LEVELS: LevelData[] = [LEVEL_1, LEVEL_2, LEVEL_3];
