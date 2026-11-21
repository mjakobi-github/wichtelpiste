import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { LevelData, Rect, Vec2 } from '../../sim/types';
import type { Simulation } from '../../sim/simulation';
import { chimneyZone, obstacleRect, stationZone } from '../../sim/elements';
import { canvasTexture, softDot } from '../backdrop/util';
import { svgPart } from '../actors/svg';
import giftSvg from '../../assets/svg/gift.svg?raw';
import chimneySvg from '../../assets/svg/chimney.svg?raw';
import stationSvg from '../../assets/svg/station.svg?raw';
import flagSvg from '../../assets/svg/flag.svg?raw';
import springSvg from '../../assets/svg/spring.svg?raw';
import icicleSvg from '../../assets/svg/icicle.svg?raw';
import candySvg from '../../assets/svg/candy.svg?raw';

const SPRING_ANIM = 0.45;
const BLOCK_PULSE = 0.6;
const FLARE = 0.8;

interface GiftView { body: Graphics; halo: Sprite; at: Vec2; phase: number }
interface Lantern { glass: Graphics; halo: Sprite; at: Vec2; lit: boolean; flare: number }
interface SpringView { g: Graphics; at: Vec2; anim: number }
interface StationView { halo: Sprite; bulbs: Sprite[] }
interface NoDrawView { rect: Rect; alarm: Graphics; pulse: number }

function glowSprite(tint: number, size: number): Sprite {
  const s = new Sprite(softDot());
  s.anchor.set(0.5);
  s.tint = tint;
  s.blendMode = 'add';
  s.width = s.height = size;
  return s;
}

/** Oberkante des Bodens unter (x, y) – für Bauten, die auf dem Boden stehen. */
function groundBelow(level: LevelData, x: number, y: number): number {
  let best = Infinity;
  for (const p of level.platforms) if (x >= p.x && x <= p.x + p.w && p.y >= y - 1 && p.y < best) best = p.y;
  return best === Infinity ? y + 60 : best;
}

/**
 * Harmlose Spielobjekte: Geschenke, Schornstein, Stationen, Laternen (Checkpoints),
 * Sprungfedern, stehende Eiszapfen, Zuckerstangen, Zeichenverbot-Zonen, Zielzone.
 * container liegt hinter den Figuren, glow auf der Leuchtebene.
 */
export class WorldObjects {
  readonly container = new Container();
  readonly glow = new Container();
  private gifts: GiftView[] = [];
  private lanterns: Lantern[] = [];
  private springs: SpringView[] = [];
  private stations: StationView[] = [];
  private noDraw: NoDrawView[] = [];
  private readonly target = new Graphics();
  private readonly chimneyHalo: Sprite;
  private readonly beam: Sprite;
  private readonly beamTex: Texture;
  private beamOn = -1;

  constructor(private readonly level: LevelData) {
    for (const z of level.noDraw) this.buildNoDraw(z);
    for (const o of level.icicles) {
      const r = obstacleRect(o, 'icicle');
      const g = svgPart(icicleSvg, 0, 0);
      g.scale.set(r.w / 12, r.h / 40);
      g.position.set(r.x, r.y);
      this.container.addChild(g);
    }
    for (const o of level.candies) this.buildCandy(obstacleRect(o, 'candy'));
    for (const s of level.stations) this.buildStation(s.pos);

    const c = level.chimney;
    const ch = svgPart(chimneySvg, 26, 74);
    ch.position.set(c.x, c.y);
    this.container.addChild(ch);
    this.chimneyHalo = glowSprite(0xffb347, 120);
    this.chimneyHalo.position.set(c.x, c.y - 70);
    this.beamTex = canvasTexture(64, 256, (g) => {
      const v = g.createLinearGradient(0, 256, 0, 0);
      v.addColorStop(0, 'rgba(255,235,160,1)');
      v.addColorStop(0.4, 'rgba(255,210,110,0.6)');
      v.addColorStop(1, 'rgba(255,200,90,0)');
      const hz = g.createLinearGradient(0, 0, 64, 0);
      hz.addColorStop(0, 'rgba(0,0,0,1)');
      hz.addColorStop(0.35, 'rgba(0,0,0,0)');
      hz.addColorStop(0.65, 'rgba(0,0,0,0)');
      hz.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = v;
      g.fillRect(0, 0, 64, 256);
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = hz;
      g.fillRect(0, 0, 64, 256);
    });
    this.beam = new Sprite(this.beamTex);
    this.beam.anchor.set(0.5, 1);
    this.beam.blendMode = 'add';
    this.beam.position.set(c.x, c.y - 66);
    this.beam.width = 70;
    this.beam.height = 900;
    this.beam.visible = false;
    this.glow.addChild(this.chimneyHalo, this.beam, this.target);

    level.checkpoints.forEach((p) => this.buildLantern(p));
    for (const s of level.springs) {
      const g = svgPart(springSvg, 20, 24);
      g.position.set(s.pos.x, s.pos.y);
      g.rotation = (s.angle * Math.PI) / 180;
      this.container.addChild(g);
      this.springs.push({ g, at: s.pos, anim: 0 });
    }
    level.gifts.forEach((p, i) => {
      const halo = glowSprite(0xffd27a, 70);
      halo.position.set(p.x, p.y);
      const body = svgPart(giftSvg, 14, 16);
      body.position.set(p.x, p.y);
      this.glow.addChild(halo);
      this.container.addChild(body);
      this.gifts.push({ body, halo, at: p, phase: i * 1.3 });
    });
  }

  private buildNoDraw(z: Rect): void {
    const g = new Graphics();
    g.rect(z.x, z.y, z.w, z.h).fill({ color: 0x6070c0, alpha: 0.1 });
    for (let k = 12; k < z.w + z.h; k += 16) {
      let x0 = z.x + k, y0 = z.y, x1 = z.x + k - z.h, y1 = z.y + z.h;
      if (x0 > z.x + z.w) { y0 += x0 - (z.x + z.w); x0 = z.x + z.w; }
      if (x1 < z.x) { y1 -= z.x - x1; x1 = z.x; }
      g.moveTo(x0, y0).lineTo(x1, y1);
    }
    g.stroke({ width: 2, color: 0x8090ff, alpha: 0.22 });
    const dash = (ax: number, ay: number, bx: number, by: number): void => {
      const len = Math.hypot(bx - ax, by - ay);
      for (let d = 0; d < len; d += 14) {
        const e = Math.min(len, d + 8);
        g.moveTo(ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len).lineTo(ax + ((bx - ax) * e) / len, ay + ((by - ay) * e) / len);
      }
    };
    dash(z.x, z.y, z.x + z.w, z.y);
    dash(z.x + z.w, z.y, z.x + z.w, z.y + z.h);
    dash(z.x + z.w, z.y + z.h, z.x, z.y + z.h);
    dash(z.x, z.y + z.h, z.x, z.y);
    g.stroke({ width: 2.5, color: 0xa8b4ff, alpha: 0.6 });
    // Verbotsschild in der Mitte
    const cx = z.x + z.w / 2, cy = z.y + Math.min(z.h / 2, 60);
    g.circle(cx, cy, 15).fill({ color: 0x1a2040, alpha: 0.7 }).stroke({ width: 3, color: 0xa8b4ff, alpha: 0.8 });
    g.moveTo(cx - 6, cy + 6).lineTo(cx + 5, cy - 5).stroke({ width: 2.5, color: 0xf2fcff, cap: 'round' });
    g.moveTo(cx - 10, cy - 10).lineTo(cx + 10, cy + 10).stroke({ width: 3, color: 0xa8b4ff, alpha: 0.8 });
    this.container.addChild(g);
    const alarm = new Graphics().rect(z.x, z.y, z.w, z.h).fill({ color: 0xff3040, alpha: 0.35 }).stroke({ width: 4, color: 0xff4d5e });
    alarm.alpha = 0;
    this.glow.addChild(alarm);
    this.noDraw.push({ rect: z, alarm, pulse: 0 });
  }

  private buildCandy(r: Rect): void {
    const g = new Graphics();
    const cx = r.x + 12, top = r.y + 12, bottom = r.y + r.h;
    g.roundRect(cx - 3.5, top, 7, bottom - top, 2).fill(0xf6f6fa);
    for (let y = top + 4; y + 9 < bottom; y += 11) g.poly([cx - 3.5, y + 5, cx + 3.5, y, cx + 3.5, y + 4, cx - 3.5, y + 9]).fill(0xe83350);
    g.rect(cx + 1.5, top, 1.5, bottom - top).fill({ color: 0xffffff, alpha: 0.5 });
    const hook = svgPart(candySvg, 0, 0);
    hook.position.set(r.x, r.y);
    this.container.addChild(g, hook);
  }

  private buildStation(pos: Vec2): void {
    const z = stationZone({ pos });
    const ground = groundBelow(this.level, pos.x, pos.y);
    const g = svgPart(stationSvg, 55, 100);
    g.position.set(z.x + z.w / 2, ground);
    const sc = Math.min(1, (ground - z.y + 20) / 100);
    g.scale.set(sc);
    this.container.addChild(g);
    const halo = glowSprite(0xffd27a, 200);
    halo.position.set(g.x, ground - 50 * sc);
    this.glow.addChild(halo);
    const bulbs: Sprite[] = [];
    for (let k = 0; k < 7; k++) {
      const f = k / 6;
      const b = glowSprite([0xff4d5e, 0xffd27a, 0x4dff9a, 0x5ec8ff][k % 4], 16);
      const lx = -55 + 110 * f;
      b.position.set(g.x + lx * sc, ground - (100 - 18 + 12 * (1 - Math.abs(f - 0.5) * 2)) * sc);
      this.glow.addChild(b);
      bulbs.push(b);
    }
    this.stations.push({ halo, bulbs });
  }

  private buildLantern(p: Vec2): void {
    const post = svgPart(flagSvg, 11, 64);
    post.position.set(p.x, p.y);
    const glass = new Graphics().rect(-5.5, -57.5, 11, 11).fill(0xffd27a);
    glass.position.set(p.x, p.y);
    glass.alpha = 0;
    const halo = glowSprite(0xffc060, 110);
    halo.position.set(p.x, p.y - 52);
    halo.alpha = 0;
    this.container.addChild(post, glass);
    this.glow.addChild(halo);
    this.lanterns.push({ glass, halo, at: p, lit: false, flare: 0 });
  }

  // ------------------------------------------------------------ Ereignisse

  springFired(pos: Vec2): void {
    let best: SpringView | null = null;
    let bd = Infinity;
    for (const s of this.springs) {
      const d = Math.hypot(s.at.x - pos.x, s.at.y - pos.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) best.anim = SPRING_ANIM;
  }

  blocked(pos: Vec2): void {
    for (const z of this.noDraw) {
      const r = z.rect;
      if (pos.x >= r.x - 30 && pos.x <= r.x + r.w + 30 && pos.y >= r.y - 30 && pos.y <= r.y + r.h + 30) z.pulse = BLOCK_PULSE;
    }
  }

  win(): void {
    this.beamOn = 0;
    this.beam.visible = true;
  }

  // ------------------------------------------------------------ Takt

  update(sim: Simulation, t: number, dt: number): void {
    this.gifts.forEach((g, i) => {
      const show = !sim.giftTaken[i];
      g.body.visible = g.halo.visible = show;
      if (!show) return;
      const bob = Math.sin(t * 2.4 + g.phase) * 3;
      g.body.y = g.at.y + bob;
      g.body.rotation = Math.sin(t * 1.7 + g.phase) * 0.08;
      g.halo.y = g.at.y + bob;
      g.halo.alpha = 0.45 + 0.15 * Math.sin(t * 3 + g.phase);
    });

    this.lanterns.forEach((l, i) => {
      const lit = i <= sim.checkpointIdx;
      if (lit && !l.lit) l.flare = FLARE;
      l.lit = lit;
      l.flare = Math.max(0, l.flare - dt);
      const flick = 0.9 + 0.1 * Math.sin(t * 13 + i) * Math.sin(t * 7.3);
      const f = l.flare / FLARE;
      l.glass.alpha = lit ? flick : 0;
      l.halo.alpha = lit ? 0.6 * flick + f * 0.3 : 0;
      l.halo.width = l.halo.height = 110 * (1 + f * 0.6);
    });

    for (const s of this.springs) {
      s.anim = Math.max(0, s.anim - dt);
      const p = 1 - s.anim / SPRING_ANIM;
      s.g.scale.y = s.anim > 0 ? 1 + 0.7 * Math.sin(p * Math.PI * 3) * (1 - p) : 1;
    }

    const foot = sim.mode === 'foot';
    this.stations.forEach((s, i) => {
      const pulse = foot ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
      s.halo.alpha = foot ? 0.15 + 0.3 * pulse : 0.12;
      s.bulbs.forEach((b, k) => { b.alpha = 0.55 + 0.45 * Math.max(0, Math.sin(t * 3 + k * 0.9 + i)); });
    });

    for (const z of this.noDraw) {
      z.pulse = Math.max(0, z.pulse - dt);
      const p = z.pulse / BLOCK_PULSE;
      z.alarm.alpha = p * (0.6 + 0.4 * Math.sin(t * 30));
    }

    this.chimneyHalo.alpha = 0.35 + 0.1 * Math.sin(t * 2);
    if (this.beamOn >= 0) {
      this.beamOn += dt;
      const k = Math.min(1, this.beamOn / 0.6);
      this.beam.alpha = k * (0.85 + 0.15 * Math.sin(t * 9));
      this.beam.width = 110 + 25 * Math.sin(t * 4);
      this.chimneyHalo.alpha = 0.6 + 0.4 * k;
      this.chimneyHalo.width = this.chimneyHalo.height = 120 + 180 * k;
    }

    this.drawTarget(sim, t);
  }

  /** Landezone des aktiven Abschnitts beim Planen: leuchtender Rahmen + Pfeil. */
  private drawTarget(sim: Simulation, t: number): void {
    const g = this.target.clear();
    if (sim.mode !== 'sled' || sim.phase !== 'plan') return;
    const z = sim.targetZone() ?? chimneyZone(this.level.chimney);
    const a = 0.55 + 0.35 * Math.sin(t * 4);
    g.roundRect(z.x, z.y, z.w, z.h, 12).fill({ color: 0x40ff90, alpha: 0.07 }).stroke({ width: 4, color: 0x40ff90, alpha: a });
    const cx = z.x + z.w / 2;
    const ay = z.y - 26 + Math.sin(t * 4) * 6;
    g.poly([cx - 16, ay - 12, cx + 16, ay - 12, cx, ay + 8]).fill({ color: 0x40ff90, alpha: a });
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.glow.destroy({ children: true });
    this.beamTex.destroy(true);
  }
}

/** Gesammeltes Geschenk fliegt in Bildschirmkoordinaten zum HUD-Zähler. */
export class GiftFlights {
  readonly container = new Container();
  private flights: { g: Graphics; from: Vec2; to: Vec2; t: number; s0: number }[] = [];

  launch(from: Vec2, to: Vec2, scale: number): void {
    const g = svgPart(giftSvg, 14, 16);
    g.scale.set(scale);
    g.position.set(from.x, from.y);
    this.container.addChild(g);
    this.flights.push({ g, from, to, t: 0, s0: scale });
  }

  update(dt: number): void {
    const DUR = 0.65;
    this.flights = this.flights.filter((f) => {
      f.t += dt;
      const p = Math.min(1, f.t / DUR);
      const e = p * p * (3 - 2 * p);
      const arc = Math.sin(p * Math.PI) * 80;
      f.g.position.set(f.from.x + (f.to.x - f.from.x) * e, f.from.y + (f.to.y - f.from.y) * e - arc);
      f.g.rotation = p * 6.28;
      f.g.scale.set(f.s0 * (1 - p * 0.5));
      if (p >= 1) { f.g.destroy(); return false; }
      return true;
    });
  }

  clear(): void {
    for (const f of this.flights) f.g.destroy();
    this.flights = [];
  }
}
