import { describe, expect, it } from 'vitest';
import { Simulation } from './simulation';
import { validateLevel } from '../levels/schema';
import type { FootInput } from './player';
import type { SimEvent } from './events';

const DT = 1 / 60;
const IDLE: FootInput = { move: 0, jumpHeld: false, jumpPressed: false };
const RIGHT: FootInput = { move: 1, jumpHeld: false, jumpPressed: false };

/** Boden y=500 von x=0 bis groundEnd; Station bei x=300; Spieler startet bei x=100. */
function level(extra: Record<string, unknown> = {}, groundEnd = 2000) {
  return validateLevel({
    version: 1, id: 'sim', name: 'Sim', worldW: 3000, worldH: 600,
    spawn: { x: 100, y: 462 },
    platforms: [{ x: 0, y: 500, w: groundEnd, h: 100 }],
    stations: [{ pos: { x: 300, y: 440 } }],
    dismounts: [],
    gifts: [{ x: 115, y: 481 }, { x: 345, y: 494 }],
    chimney: { x: 2900, y: 500 },
    areas: [{ ink: 1000, boost: 200 }],
    ...extra,
  }, 'sim.json');
}

function runUntil(sim: Simulation, seconds: number, input: FootInput, stop?: (e: SimEvent) => boolean): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const ev = sim.step(DT, input);
    all.push(...ev);
    if (stop && ev.some(stop)) break;
  }
  return all;
}

function drawLine(sim: Simulation, a: { x: number; y: number }, b: { x: number; y: number }, boost = false) {
  sim.command({ type: 'strokeBegin', p: a, boost });
  const n = 20;
  for (let i = 1; i <= n; i++) sim.command({ type: 'strokeMove', p: { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n } });
  sim.command({ type: 'strokeEnd' });
  sim.step(DT, IDLE);
}

describe('Simulation', () => {
  it('Fahrt-Neustart stellt die Geschenke der Fahrt wieder her, Zeichnung und Tinte bleiben', () => {
    const sim = new Simulation(level({}, 400));
    runUntil(sim, 0.1, IDLE);
    expect(sim.giftTaken).toEqual([true, false]);
    sim.boardForTest(0);
    drawLine(sim, { x: 1000, y: 100 }, { x: 1100, y: 100 });
    const ink = sim.ink.remaining(0, false);
    sim.command({ type: 'launch' });
    const ev = runUntil(sim, 4, IDLE, (e) => e.type === 'crash');
    expect(ev.some((e) => e.type === 'gift' && e.index === 1)).toBe(true);
    expect(ev.some((e) => e.type === 'crash' && e.cause === 'fall')).toBe(true);
    expect(sim.giftTaken).toEqual([true, false]);
    expect(sim.ink.strokes.length).toBe(1);
    expect(sim.ink.remaining(0, false)).toBe(ink);
    expect(sim.mode).toBe('sled');
    expect(sim.phase).toBe('plan');
  });

  it('Gefahr zu Fuß: Crash und Respawn am Respawn-Punkt', () => {
    const sim = new Simulation(level({ hazards: [{ kind: 'tinsel', rect: { x: 200, y: 470, w: 20, h: 30 } }] }));
    const ev = runUntil(sim, 3, RIGHT, (e) => e.type === 'crash');
    expect(ev.some((e) => e.type === 'crash' && e.cause === 'hazard')).toBe(true);
    expect(sim.player.pos).toEqual(sim.respawnPos);
  });

  it('Gefahr im Schlitten: Fahrt startet neu an der Station', () => {
    const sim = new Simulation(level({
      movers: [{ kind: 'bell', radius: 12, path: { type: 'circle', center: { x: 360, y: 490 }, radius: 0.01, period: 1 } }],
    }));
    sim.boardForTest(0);
    sim.command({ type: 'launch' });
    const ev = runUntil(sim, 3, IDLE, (e) => e.type === 'crash');
    expect(ev.some((e) => e.type === 'crash' && e.cause === 'hazard')).toBe(true);
    expect(sim.mode).toBe('sled');
    expect(sim.phase).toBe('plan');
    expect(sim.sled.pos.x).toBeCloseTo(300, 0);
  });

  it('Beweger-Uhr startet bei jedem LOS neu', () => {
    const sim = new Simulation(level({
      movers: [{ kind: 'crow', radius: 10, path: { type: 'circle', center: { x: 1500, y: 100 }, radius: 80, period: 3 } }],
    }));
    sim.boardForTest(0);
    runUntil(sim, 0.7, IDLE);
    sim.command({ type: 'launch' });
    sim.step(DT, IDLE);
    const first = sim.moverPositions();
    runUntil(sim, 1.3, IDLE);
    sim.command({ type: 'retry' });
    sim.step(DT, IDLE);
    sim.command({ type: 'launch' });
    sim.step(DT, IDLE);
    expect(sim.moverPositions()).toEqual(first);
  });

  it('keine Striche während der Fahrt', () => {
    const sim = new Simulation(level());
    sim.boardForTest(0);
    sim.command({ type: 'launch' });
    sim.step(DT, IDLE);
    drawLine(sim, { x: 1000, y: 100 }, { x: 1100, y: 100 });
    expect(sim.ink.strokes.length).toBe(0);
  });

  it('Werkzeuge wirken nur im aktiven Abschnitt', () => {
    const sim = new Simulation(level({
      stations: [{ pos: { x: 300, y: 440 } }, { pos: { x: 1500, y: 440 } }],
      areas: [{ ink: 1000, boost: 0 }, { ink: 1000, boost: 0 }],
    }));
    sim.boardForTest(0);
    drawLine(sim, { x: 1000, y: 100 }, { x: 1100, y: 100 });
    sim.boardForTest(1);
    sim.command({ type: 'clear' });
    sim.command({ type: 'undo' });
    sim.step(DT, IDLE);
    expect(sim.ink.strokes.length).toBe(1);
    expect(sim.ink.strokes[0].area).toBe(0);
  });

  it('Sieg meldet Sterne und verbrauchte Tinte', () => {
    const sim = new Simulation(level({ gifts: [{ x: 330, y: 494 }], chimney: { x: 400, y: 500 } }));
    sim.boardForTest(0);
    drawLine(sim, { x: 1000, y: 100 }, { x: 1100, y: 100 });
    drawLine(sim, { x: 1000, y: 200 }, { x: 1100, y: 200 });
    sim.command({ type: 'launch' });
    const ev = runUntil(sim, 5, IDLE, (e) => e.type === 'win');
    const win = ev.find((e) => e.type === 'win');
    expect(win).toEqual({ type: 'win', result: { stars: 3, gifts: 1, giftTotal: 1, inkUsed: 200 } });
    expect(sim.won).toBe(true);
  });

  it('Schornstein ohne Geschenk: Ablehnung, kein Sieg', () => {
    const sim = new Simulation(level({ gifts: [{ x: 1500, y: 300 }], chimney: { x: 160, y: 500 } }));
    const ev = runUntil(sim, 1, RIGHT);
    expect(ev.some((e) => e.type === 'refuse')).toBe(true);
    expect(ev.some((e) => e.type === 'win')).toBe(false);
  });

  it('Sprungfeder zu Fuß', () => {
    const sim = new Simulation(level({ springs: [{ pos: { x: 115, y: 500 }, angle: 0, power: 1200 }], spawn: { x: 100, y: 300 } }));
    let launched = false;
    for (let i = 0; i < 120 && !launched; i++) {
      const ev = sim.step(DT, IDLE);
      if (ev.some((e) => e.type === 'spring')) {
        launched = true;
        expect(sim.player.vel.y).toBeLessThan(-1000);
      }
    }
    expect(launched).toBe(true);
  });

  it('Sprungfeder im Schlitten', () => {
    const sim = new Simulation(level({ springs: [{ pos: { x: 330, y: 500 }, angle: 0, power: 1400 }] }));
    sim.boardForTest(0);
    sim.command({ type: 'launch' });
    let launched = false;
    for (let i = 0; i < 240 && !launched; i++) {
      const ev = sim.step(DT, IDLE);
      if (ev.some((e) => e.type === 'spring')) {
        launched = true;
        expect(sim.sled.vel.y).toBeLessThan(-1000);
      }
    }
    expect(launched).toBe(true);
  });

  it('Festgefahren: automatisches Aussteigen', () => {
    const sim = new Simulation(level({ candies: [{ x: 340, y: 500, h: 60 }] }));
    sim.boardForTest(0);
    sim.command({ type: 'launch' });
    const ev = runUntil(sim, 3, IDLE, (e) => e.type === 'arrive');
    expect(ev.some((e) => e.type === 'arrive' && e.stuck)).toBe(true);
    expect(sim.mode).toBe('foot');
  });
});
