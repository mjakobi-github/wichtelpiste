import { describe, expect, it } from 'vitest';
import { Player, PLAYER_TUNING, type FootInput } from './player';
import type { Rect } from './types';

const DT = 1 / 60;
const GROUND: Rect = { x: -1000, y: 100, w: 3000, h: 50 };
const H = PLAYER_TUNING.size.h;
const idle: FootInput = { move: 0, jumpHeld: false, jumpPressed: false };

/** Spieler steht auf dem Boden (ein Tick zum Aufsetzen). */
function standing(): Player {
  const p = new Player({ x: 0, y: GROUND.y - H });
  p.update(DT, idle, [GROUND]);
  expect(p.grounded).toBe(true);
  return p;
}

/** Führt einen Sprung aus; release = Tick, ab dem losgelassen wird (Infinity = halten). */
function jumpArc(release: number) {
  const p = standing();
  const startY = p.pos.y;
  let minY = startY;
  let apexT = 0;
  for (let i = 0; i < 120; i++) {
    const held = i < release;
    p.update(DT, { move: 0, jumpHeld: held, jumpPressed: i === 0 }, [GROUND]);
    if (p.pos.y < minY) { minY = p.pos.y; apexT = (i + 1) * DT; }
    if (i > 2 && p.grounded) break;
  }
  return { height: startY - minY, apexT };
}

describe('Player Sprung', () => {
  it('voller Sprung: knackig, Scheitel nach 0,34–0,42 s, 180–220 px hoch', () => {
    const { height, apexT } = jumpArc(Infinity);
    expect(apexT).toBeGreaterThanOrEqual(0.34);
    expect(apexT).toBeLessThanOrEqual(0.42);
    expect(height).toBeGreaterThanOrEqual(180);
    expect(height).toBeLessThanOrEqual(220);
  });

  it('kurz tippen ergibt einen kleinen Sprung (< 45 %)', () => {
    const full = jumpArc(Infinity).height;
    const tap = jumpArc(1).height;
    expect(tap).toBeLessThan(full * 0.45);
  });

  it('gehaltene Taste springt nach der Landung nicht erneut', () => {
    const p = standing();
    p.update(DT, { move: 0, jumpHeld: true, jumpPressed: true }, [GROUND]);
    let landedAt = -1;
    for (let i = 0; i < 200; i++) {
      p.update(DT, { move: 0, jumpHeld: true, jumpPressed: false }, [GROUND]);
      if (p.grounded && landedAt < 0) landedAt = i;
      if (landedAt >= 0 && i - landedAt < 30) expect(p.grounded).toBe(true);
    }
    expect(landedAt).toBeGreaterThan(0);
  });

  function fallFrom(height: number) {
    const p = new Player({ x: 0, y: GROUND.y - H - height });
    return p;
  }

  it('Sprungpuffer: 0,1 s vor der Landung gedrückt → springt beim Aufsetzen', () => {
    const p = fallFrom(300);
    // Ticks bis zur Landung ohne Eingabe zählen (Probe)
    const probe = fallFrom(300);
    let ticks = 0;
    while (!probe.grounded && ticks < 300) { probe.update(DT, idle, [GROUND]); ticks++; }
    const pressAt = ticks - 6; // 0,1 s vorher
    let jumped = false;
    for (let i = 0; i < ticks + 2; i++) {
      const ev = p.update(DT, { move: 0, jumpHeld: i >= pressAt, jumpPressed: i === pressAt }, [GROUND]);
      if (ev.jumped) jumped = true;
    }
    expect(jumped).toBe(true);
  });

  it('Sprungpuffer verfällt nach 0,2 s', () => {
    const p = fallFrom(600);
    const probe = fallFrom(600);
    let ticks = 0;
    while (!probe.grounded && ticks < 300) { probe.update(DT, idle, [GROUND]); ticks++; }
    const pressAt = ticks - 12;
    let jumped = false;
    for (let i = 0; i < ticks + 2; i++) {
      const ev = p.update(DT, { move: 0, jumpHeld: false, jumpPressed: i === pressAt }, [GROUND]);
      if (ev.jumped) jumped = true;
    }
    expect(jumped).toBe(false);
  });

  function coyote(afterSec: number): boolean {
    const ledge: Rect = { x: -1000, y: 100, w: 1000, h: 50 };
    const p = new Player({ x: -40, y: ledge.y - H });
    p.update(DT, idle, [ledge]);
    // nach rechts von der Kante laufen
    let t = 0;
    let leftAt = -1;
    for (let i = 0; i < 400; i++) {
      const offFor = leftAt < 0 ? -1 : t - leftAt;
      const press = leftAt >= 0 && offFor >= afterSec;
      const ev = p.update(DT, { move: 1, jumpHeld: press, jumpPressed: press }, [ledge]);
      t += DT;
      if (ev.jumped) return true;
      if (!p.grounded && leftAt < 0) leftAt = t;
      if (press) return false;
    }
    return false;
  }

  it('Coyote-Time: 0,08 s nach der Kante darf man noch springen', () => {
    expect(coyote(0.08)).toBe(true);
  });
  it('nach 0,12 s nicht mehr', () => {
    expect(coyote(0.12)).toBe(false);
  });

  it('Landung meldet das Aufprall-Tempo genau einmal', () => {
    const p = fallFrom(200);
    const landings: number[] = [];
    for (let i = 0; i < 120; i++) {
      const ev = p.update(DT, idle, [GROUND]);
      if (ev.landed !== null) landings.push(ev.landed);
    }
    expect(landings.length).toBe(1);
    expect(landings[0]).toBeGreaterThan(0);
  });

  it('Sprungfeder: launch hebt über 300 px, ohne Sprungabbruch', () => {
    const p = standing();
    const y0 = p.pos.y;
    p.launch(0, -1400);
    let minY = y0;
    for (let i = 0; i < 120; i++) {
      p.update(DT, idle, [GROUND]);
      minY = Math.min(minY, p.pos.y);
    }
    expect(y0 - minY).toBeGreaterThan(300);
  });

  it('prevPos ist die Position vor dem letzten update', () => {
    const p = standing();
    const before = { ...p.pos };
    p.update(DT, { move: 1, jumpHeld: false, jumpPressed: false }, [GROUND]);
    expect(p.prevPos).toEqual(before);
  });
});

describe('Player auf Eis', () => {
  const ICE = { ...GROUND, ice: true };

  function slide(ground: Rect) {
    const p = new Player({ x: 0, y: ground.y - H });
    p.update(DT, idle, [ground]);
    let tMax = 0;
    for (let i = 0; i < 120; i++) {
      p.update(DT, { move: 1, jumpHeld: false, jumpPressed: false }, [ground]);
      if (!tMax && p.vel.x >= PLAYER_TUNING.maxRunSpeed) tMax = (i + 1) * DT;
    }
    const x0 = p.pos.x;
    for (let i = 0; i < 300 && p.vel.x > 0; i++) p.update(DT, idle, [ground]);
    return { tMax, slide: p.pos.x - x0, onIce: p.onIce };
  }

  it('rutscht nach dem Loslassen deutlich weiter als auf Schnee', () => {
    const snow = slide(GROUND);
    const ice = slide(ICE);
    expect(snow.onIce).toBe(false);
    expect(ice.onIce).toBe(true);
    expect(ice.slide).toBeGreaterThan(snow.slide * 4);
    expect(ice.slide).toBeGreaterThan(120);
  });

  it('kommt langsamer auf Tempo', () => {
    expect(slide(ICE).tMax).toBeGreaterThan(slide(GROUND).tMax * 2.5);
  });

  it('Springen auf Eis geht normal', () => {
    const p = new Player({ x: 0, y: ICE.y - H });
    p.update(DT, idle, [ICE]);
    const ev = p.update(DT, { move: 0, jumpHeld: true, jumpPressed: true }, [ICE]);
    expect(ev.jumped).toBe(true);
    expect(p.onIce).toBe(false);
  });
});
