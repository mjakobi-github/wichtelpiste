import { Container, Graphics, Sprite } from 'pixi.js';
import type { LevelData, Mover, Vec2 } from '../../sim/types';
import type { Simulation } from '../../sim/simulation';
import { moverPosition } from '../../sim/elements';
import { softDot } from '../backdrop/util';
import { svgPart } from '../actors/svg';
import icicleHangingSvg from '../../assets/svg/icicle-hanging.svg?raw';
import tinselSvg from '../../assets/svg/tinsel.svg?raw';
import bellSvg from '../../assets/svg/bell.svg?raw';
import crowSvg from '../../assets/svg/crow.svg?raw';

const WARN = 0xff3040;

interface Glitter { s: Sprite; phase: number; speed: number }
interface MoverView { m: Mover; body: Container; wing: Graphics | null; rope: Graphics | null; halo: Sprite; path: Graphics; lastX: number; facing: number }

/**
 * Tödliche Gefahren: hängende Eiszapfen, Lametta, Glocken und Krähen.
 * Alle tragen einen rötlichen Warnschimmer (Leuchtebene) – harmlose Hindernisse nie.
 */
export class Hazards {
  readonly container = new Container();
  readonly glow = new Container();
  private warn: { s: Sprite; phase: number; base: number }[] = [];
  private glitter: Glitter[] = [];
  private movers: MoverView[] = [];

  constructor(level: LevelData) {
    level.hazards.forEach((h, i) => {
      const r = h.rect;
      if (h.kind === 'icicle-hanging') {
        const n = Math.max(1, Math.round(r.w / 16));
        for (let k = 0; k < n; k++) {
          const g = svgPart(icicleHangingSvg, 0, 0);
          const len = 0.75 + 0.25 * (((k * 7 + i * 3) % 4) / 3);
          g.scale.set(r.w / n / 16, (r.h / 40) * (k % 2 === 0 ? 1 : len));
          g.position.set(r.x + (k * r.w) / n, r.y);
          this.container.addChild(g);
        }
      } else {
        const n = Math.max(1, Math.round(r.w / 20));
        for (let k = 0; k < n; k++) {
          const g = svgPart(tinselSvg, 0, 0);
          g.scale.set(r.w / n / 20, r.h / 20);
          g.position.set(r.x + (k * r.w) / n, r.y);
          this.container.addChild(g);
        }
        const count = Math.max(3, Math.round((r.w * r.h) / 120));
        for (let k = 0; k < count; k++) {
          const s = new Sprite(softDot());
          s.anchor.set(0.5);
          s.tint = k % 3 === 0 ? 0xffffff : k % 3 === 1 ? 0xffd27a : 0xff6070;
          s.position.set(r.x + Math.random() * r.w, r.y + Math.random() * r.h * 0.9);
          s.blendMode = 'add';
          this.glow.addChild(s);
          this.glitter.push({ s, phase: Math.random() * 6.28, speed: 3 + Math.random() * 5 });
        }
      }
      const halo = new Sprite(softDot());
      halo.anchor.set(0.5);
      halo.tint = WARN;
      halo.blendMode = 'add';
      halo.position.set(r.x + r.w / 2, r.y + r.h / 2);
      halo.width = r.w + 40;
      halo.height = r.h + 40;
      this.glow.addChildAt(halo, 0);
      this.warn.push({ s: halo, phase: i * 1.7, base: 0.35 });
    });

    for (const m of level.movers) this.movers.push(this.buildMover(m));
  }

  private buildMover(m: Mover): MoverView {
    const path = new Graphics();
    const N = 56;
    for (let k = 0; k < N; k++) {
      const p = moverPosition(m.path, (k / N) * m.path.period);
      path.circle(p.x, p.y, 2.6);
    }
    path.fill({ color: 0xff8090, alpha: 0.55 });
    path.visible = false;

    const rope = m.path.type === 'pendulum' ? new Graphics() : null;
    const body = new Container();
    let wing: Graphics | null = null;
    if (m.kind === 'bell') {
      const g = svgPart(bellSvg, 20, 20);
      g.scale.set((m.radius * 2.2) / 40);
      body.addChild(g);
    } else {
      const g = svgPart(crowSvg, 22, 18);
      g.scale.set((m.radius * 3) / 44);
      wing = new Graphics().poly([0, 0, -14, -12, -20, -4, -8, 3]).fill(0x343a60).stroke({ width: 1.5, color: 0x8a93c8 });
      wing.position.set(-1 * g.scale.x, -6 * g.scale.y);
      wing.scale.set(g.scale.x * 1.2);
      body.addChild(g, wing);
    }
    const halo = new Sprite(softDot());
    halo.anchor.set(0.5);
    halo.tint = WARN;
    halo.blendMode = 'add';
    halo.width = halo.height = m.radius * 6;

    if (rope) this.container.addChild(rope);
    this.container.addChild(path, body);
    this.glow.addChild(halo);
    return { m, body, wing, rope, halo, path, lastX: 0, facing: 1 };
  }

  update(sim: Simulation, t: number, planning: boolean): void {
    for (const w of this.warn) w.s.alpha = w.base + 0.15 * Math.sin(t * 3 + w.phase);
    for (const g of this.glitter) {
      const v = Math.max(0, Math.sin(t * g.speed + g.phase));
      g.s.alpha = v * v;
      g.s.scale.set(0.05 + 0.12 * v);
    }
    const pos = sim.moverPositions();
    this.movers.forEach((v, i) => this.place(v, pos[i], t, planning));
  }

  private place(v: MoverView, p: Vec2, t: number, planning: boolean): void {
    v.path.visible = planning;
    v.body.position.set(p.x, p.y);
    v.halo.position.set(p.x, p.y);
    v.halo.alpha = 0.55 + 0.2 * Math.sin(t * 5);
    const path = v.m.path;
    if (v.rope && path.type === 'pendulum') {
      v.rope.clear().moveTo(path.pivot.x, path.pivot.y).lineTo(p.x, p.y).stroke({ width: 2.5, color: 0x8a6a4a });
      v.rope.circle(path.pivot.x, path.pivot.y, 4).fill(0x5a4a3a);
      v.body.rotation = -Math.atan2(p.x - path.pivot.x, p.y - path.pivot.y);
    }
    if (v.wing) {
      const dx = p.x - v.lastX;
      if (Math.abs(dx) > 0.3) v.facing = dx > 0 ? 1 : -1;
      v.body.scale.x = v.facing;
      v.wing.rotation = Math.sin(t * 16) * 0.6;
      v.body.y += Math.sin(t * 16 + 1) * 1.5;
    }
    v.lastX = p.x;
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
