import { Container, Graphics } from 'pixi.js';
import type { LevelData, Vec2 } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import { chimneyZone, obstacleRect, springZone, stationZone } from '../sim/elements';
import { PLAYER_TUNING } from '../sim/player';

/** Nur mit ?debug: Kollisionsrahmen aller Elemente, Linien und Figuren als Umrisse. */
export class DebugDraw {
  readonly container = new Container();
  private readonly statics = new Graphics();
  private readonly dynamic = new Graphics();

  constructor() {
    this.container.addChild(this.statics, this.dynamic);
  }

  load(level: LevelData): void {
    const g = this.statics.clear();
    const box = (x: number, y: number, w: number, h: number, color: number): void => {
      g.rect(x, y, w, h).stroke({ width: 1.5, color });
    };
    for (const z of level.noDraw) box(z.x, z.y, z.w, z.h, 0x8090ff);
    for (const d of level.dismounts) box(d.x, d.y, d.w, d.h, 0x40ff90);
    for (const p of level.platforms) box(p.x, p.y, p.w, p.h, p.ice ? 0x9fe8ff : 0xff4060);
    for (const o of level.icicles) { const r = obstacleRect(o, 'icicle'); box(r.x, r.y, r.w, r.h, 0xff4060); }
    for (const o of level.candies) { const r = obstacleRect(o, 'candy'); box(r.x, r.y, r.w, r.h, 0xff4060); }
    for (const h of level.hazards) box(h.rect.x, h.rect.y, h.rect.w, h.rect.h, 0xffff00);
    for (const s of level.stations) { const z = stationZone(s); box(z.x, z.y, z.w, z.h, 0xffd27a); }
    for (const s of level.springs) { const z = springZone(s); box(z.x, z.y, z.w, z.h, 0x40e0ff); }
    const c = chimneyZone(level.chimney);
    box(c.x, c.y, c.w, c.h, 0xffd27a);
  }

  render(sim: Simulation, alpha: number): void {
    const g = this.dynamic.clear();
    for (const s of sim.ink.strokes) {
      if (s.pts.length < 2) continue;
      g.moveTo(s.pts[0].x, s.pts[0].y);
      for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i].x, s.pts[i].y);
      g.stroke({ width: 1, color: s.boost ? 0xff4d5e : 0x00ffff });
    }
    sim.moverPositions().forEach((p, i) => g.circle(p.x, p.y, sim.level.movers[i].radius).stroke({ width: 1.5, color: 0xffff00 }));
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
