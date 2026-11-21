import type { LevelData } from '../sim/types';

/** Vorlage „Neues Level“: Boden, Lücke, Station mit Landezone, Schornstein, ein Geschenk. */
export function newLevel(): LevelData {
  return {
    version: 1,
    id: 'neues-level',
    name: 'Neues Level',
    worldW: 2400,
    worldH: 720,
    spawn: { x: 80, y: 560 },
    platforms: [
      { x: 0, y: 620, w: 800, h: 100, ice: false },
      { x: 1300, y: 620, w: 1100, h: 100, ice: false },
    ],
    stations: [{ pos: { x: 700, y: 560 } }],
    dismounts: [{ x: 1300, y: 470, w: 240, h: 150 }],
    gifts: [{ x: 400, y: 595 }],
    checkpoints: [],
    icicles: [],
    candies: [],
    hazards: [],
    movers: [],
    springs: [],
    noDraw: [],
    chimney: { x: 2250, y: 620 },
    areas: [{ ink: 1200, boost: 0 }],
    theme: { seed: 7, auroraHue: 150 },
    hints: [],
  };
}
