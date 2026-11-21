import { Container, Graphics } from 'pixi.js';
import type { LevelData, Vec2 } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import { chimneyZone, obstacleRect, springZone, stationZone } from '../sim/elements';
import { PLAYER_TUNING } from '../sim/player';

/**
 * Schlichte Formen-Darstellung. full (nur mit ?debug): alles inkl. Plattformen,
 * Linien, Figuren und Kollisionsboxen. Sonst nur Platzhalter für Objekte, die
 * noch keine eigene Grafik haben (bis Task 11).
 */
export class DebugDraw {
  readonly container = new Container();
  private readonly statics = new Graphics();
  private readonly dynamic = new Graphics();

  constructor(private readonly full = false) {
    this.container.addChild(this.statics, this.dynamic);
  }

  load(level: LevelData): void {
    const g = this.statics.clear();
    for (const z of level.noDraw) g.rect(z.x, z.y, z.w, z.h).fill({ color: 0x8090ff, alpha: 0.12 }).stroke({ width: 2, color: 0x8090ff, alpha: 0.6 });
    if (this.full) for (const d of level.dismounts) g.rect(d.x, d.y, d.w, d.h).fill({ color: 0x40ff90, alpha: 0.08 });
    if (this.full) for (const p of level.platforms) g.rect(p.x, p.y, p.w, p.h).stroke({ width: 1.5, color: p.ice ? 0x9fe8ff : 0xff4060 });
    for (const o of level.icicles) { const r = obstacleRect(o, 'icicle'); g.rect(r.x, r.y, r.w, r.h).fill(0x9fe8ff); }
    for (const o of level.candies) { const r = obstacleRect(o, 'candy'); g.rect(r.x, r.y, r.w, r.h).fill(0xffffff).stroke({ width: 3, color: 0xe83350 }); }
    for (const h of level.hazards) g.rect(h.rect.x, h.rect.y, h.rect.w, h.rect.h).fill({ color: 0xff3040, alpha: 0.85 });
    for (const s of level.stations) { const z = stationZone(s); g.rect(z.x, z.y, z.w, z.h).stroke({ width: 2, color: 0xffd27a, alpha: 0.7 }); }
    const c = chimneyZone(level.chimney);
    g.rect(level.chimney.x - 15, level.chimney.y - 56, 30, 56).fill(0x7a2e35);
    g.rect(c.x, c.y, c.w, c.h).stroke({ width: 1, color: 0xffd27a, alpha: 0.4 });
  }

  render(sim: Simulation, alpha: number): void {
    const g = this.dynamic.clear();
    const lv = sim.level;

    // Ziel des aktiven Abschnitts hervorheben
    if (sim.mode === 'sled') {
      const z = sim.targetZone() ?? chimneyZone(lv.chimney);
      const a = 0.55 + 0.35 * Math.sin(performance.now() / 250);
      g.rect(z.x, z.y, z.w, z.h).stroke({ width: 4, color: 0x40ff90, alpha: a });
    }

    if (this.full) for (const s of sim.ink.strokes) {
      if (s.pts.length < 2) continue;
      g.moveTo(s.pts[0].x, s.pts[0].y);
      for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i].x, s.pts[i].y);
      g.stroke({ width: 4, color: s.boost ? 0xff4d5e : 0xf2fcff, cap: 'round', join: 'round' });
    }
    lv.gifts.forEach((p, i) => { if (!sim.giftTaken[i]) g.rect(p.x - 9, p.y - 9, 18, 18).fill(0xffcc3d); });
    lv.checkpoints.forEach((p, i) => g.rect(p.x - 3, p.y - 50, 6, 50).fill(i <= sim.checkpointIdx ? 0x40ff90 : 0x8890b0));
    for (const s of lv.springs) { const z = springZone(s); g.rect(z.x, z.y, z.w, z.h).fill(0x40e0ff); }
    sim.moverPositions().forEach((p, i) => g.circle(p.x, p.y, lv.movers[i].radius).fill({ color: 0xff3040, alpha: 0.9 }));

    if (!this.full) return;
    if (sim.mode === 'foot') {
      const p = lerp(sim.player.prevPos, sim.player.pos, alpha);
      g.rect(p.x, p.y, PLAYER_TUNING.size.w, PLAYER_TUNING.size.h).stroke({ width: 1.5, color: 0xff4060 });
    } else {
      const p = sim.phase === 'ride' ? lerp(sim.sled.prevPos, sim.sled.pos, alpha) : sim.sled.pos;
      const a = sim.sled.angle;
      const dx = Math.cos(a) * 11;
      const dy = Math.sin(a) * 11;
      g.moveTo(p.x - dx, p.y - dy).lineTo(p.x + dx, p.y + dy).stroke({ width: 2, color: 0xff4060, cap: 'round' });
    }
  }
}

export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
