export function minimalLevel(): Record<string, unknown> {
  return {
    version: 1,
    id: 't',
    name: 'Test',
    worldW: 1000,
    worldH: 600,
    spawn: { x: 10, y: 10 },
    platforms: [{ x: 0, y: 500, w: 1000, h: 100 }],
    stations: [{ pos: { x: 100, y: 440 } }],
    dismounts: [],
    gifts: [{ x: 50, y: 480 }],
    chimney: { x: 900, y: 500 },
    areas: [{ ink: 1000, boost: 'unlimited' }],
  };
}

/**
 * Ziel links, Feder rechts hinter der Station: Der Schlitten muss erst nach rechts zur Feder,
 * die ihn über das Haus zurück in die Landezone schleudert. dir weglassen = alter Stand.
 */
export function springBackLevel(dir?: 1 | -1): Record<string, unknown> {
  return {
    version: 1, id: 'rueck', name: 'Rückwärts', worldW: 2400, worldH: 1000, spawn: { x: 1000, y: 440 },
    platforms: [{ x: 0, y: 650, w: 760, h: 350 }, { x: 900, y: 500, w: 400, h: 500 }, { x: 1500, y: 800, w: 500, h: 200 }],
    stations: [{ pos: { x: 1150, y: 440 }, ...(dir ? { dir } : {}) }],
    dismounts: [{ x: 350, y: 500, w: 240, h: 150 }],
    gifts: [{ x: 950, y: 475 }], chimney: { x: 60, y: 650 },
    springs: [{ pos: { x: 1700, y: 800 }, angle: -35, power: 1500 }],
    areas: [{ ink: 800, boost: 0 }],
  };
}
