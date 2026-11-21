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
