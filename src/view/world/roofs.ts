import { Container, Graphics, Sprite } from 'pixi.js';
import type { LevelData, Platform } from '../../sim/types';
import { hardDot, rng, softDot } from '../backdrop/util';

/** Ab dieser Dicke wird eine Plattform als Haus gezeichnet, sonst als Balken. */
const BUILDING_MIN_H = 50;
const BULB_COLORS = [0xff4d5e, 0xffd27a, 0x4dff9a, 0x5ec8ff, 0xff8a3d];

interface Twinkle { s: Sprite; base: number; amp: number; speed: number; phase: number }

/**
 * Plattformen als Dächer/Gebäude (Spec §6.2): Ziegel angedeutet, Schneekante mit
 * Überhang und Tropfen, Eiszapfen, Lichterketten, Fenster mit flackerndem Schein.
 * Eis-Plattformen bekommen eine glänzende Eisschicht statt Schnee.
 */
export class Roofs {
  readonly container = new Container();
  /** Leuchtende Teile (Fensterschein, Lichterketten) – liegen auf der Bloom-Ebene. */
  readonly lights = new Container();
  private readonly body = new Graphics();
  private readonly tops = new Graphics();
  private readonly glow = new Container();
  private readonly bulbs = new Container();
  private readonly twinkles: Twinkle[] = [];

  constructor(level: LevelData) {
    this.glow.blendMode = 'add';
    this.bulbs.blendMode = 'add';
    this.container.addChild(this.body, this.tops);
    this.lights.addChild(this.glow, this.bulbs);
    const r = rng(level.theme.seed * 101 + 7);
    const bottom = level.worldH + 260;
    for (const group of groupBuildings(level.platforms)) this.building(group, bottom, r);
    for (const p of level.platforms) {
      if (p.h < BUILDING_MIN_H) this.beam(p, r);
      if (p.ice) this.iceTop(p, r);
      else this.snowTop(p, r);
    }
  }

  private building(group: Platform[], bottom: number, r: () => number): void {
    const x0 = group[0].x;
    const x1 = group[group.length - 1].x + group[group.length - 1].w;
    const top = group[0].y;
    const w = x1 - x0;
    const g = this.body;
    g.rect(x0, top, w, bottom - top).fill(0x11153d);
    // Fassade: leichte Kanten links/rechts, Ziegel-Andeutung in Flecken
    g.rect(x0, top, 5, bottom - top).fill(0x0b0e2c);
    g.rect(x1 - 5, top, 5, bottom - top).fill(0x0b0e2c);
    const patches = Math.max(1, Math.round(w / 90));
    for (let i = 0; i < patches; i++) {
      const px = x0 + 10 + r() * (w - 60);
      const py = top + 18 + r() * 140;
      for (let row = 0; row < 3 + r() * 3; row++) {
        const off = row % 2 ? 9 : 0;
        for (let col = 0; col < 2 + r() * 2; col++) {
          g.rect(px + off + col * 20, py + row * 9, 17, 6).fill({ color: 0x1b2158, alpha: 0.7 });
        }
      }
    }

    // Fenster
    const spacing = 74;
    const cols = Math.max(1, Math.floor((w - 40) / spacing));
    const margin = (w - (cols - 1) * spacing) / 2;
    for (let row = 0; row < 4; row++) {
      const wy = top + 34 + row * 66;
      if (wy > bottom - 40) break;
      for (let c = 0; c < cols; c++) {
        const wx = x0 + margin + c * spacing - 11;
        const lit = r() < 0.62;
        this.window(wx, wy, lit, r);
      }
    }

    // Lichterkette unter der Schneekante
    if (r() < 0.8) this.stringLights(x0 + 4, x1 - 4, top + 13, r);
  }

  private window(x: number, y: number, lit: boolean, r: () => number): void {
    const g = this.body;
    const W = 22;
    const H = 28;
    g.roundRect(x - 3, y - 3, W + 6, H + 6, 3).fill(0x2a2052);
    g.rect(x, y, W, H).fill(lit ? 0xffcf78 : 0x1d2560);
    if (lit) {
      g.rect(x, y + H - 9, W, 9).fill({ color: 0xffa94d, alpha: 0.6 });
      const deco = r();
      if (deco < 0.18) {
        // Kranz
        g.circle(x + W / 2, y + 11, 6.5).stroke({ width: 3.5, color: 0x1f7a3e });
        g.circle(x + W / 2, y + 17, 1.8).fill(0xe83350);
      } else if (deco < 0.3) {
        // Stern
        star(g, x + W / 2, y + 11, 6, 2.6);
        g.fill(0xfff0a8);
      }
      const glow = new Sprite(softDot());
      glow.anchor.set(0.5);
      glow.tint = 0xffa94d;
      glow.width = 92;
      glow.height = 92;
      glow.position.set(x + W / 2, y + H / 2);
      this.glow.addChild(glow);
      this.twinkles.push({ s: glow, base: 0.42, amp: 0.1, speed: 2.5 + r() * 3, phase: r() * 6.28 });
    } else {
      g.rect(x + 3, y + 3, 5, H - 6).fill({ color: 0x5060a8, alpha: 0.35 });
    }
    // Sprossen
    g.rect(x + W / 2 - 1, y, 2, H).fill(0x2a2052);
    g.rect(x, y + H / 2 - 1, W, 2).fill(0x2a2052);
    // Schnee auf dem Fensterbrett
    g.roundRect(x - 4, y + H + 1, W + 8, 4, 2).fill(0xe6eeff);
  }

  private beam(p: Platform, r: () => number): void {
    const g = this.body;
    g.roundRect(p.x, p.y, p.w, p.h, 3).fill(0x3b2733);
    for (let y = p.y + 7; y < p.y + p.h - 2; y += 8) g.rect(p.x + 2, y, p.w - 4, 1.2).fill({ color: 0x24171f, alpha: 0.8 });
    for (let x = p.x + 20 + r() * 20; x < p.x + p.w - 10; x += 40 + r() * 30) g.circle(x, p.y + p.h / 2, 1.4).fill(0x8a7060);
    // Stützen
    g.poly([p.x + 10, p.y + p.h, p.x + 22, p.y + p.h, p.x + 14, p.y + p.h + 18]).fill(0x2b1c26);
    g.poly([p.x + p.w - 10, p.y + p.h, p.x + p.w - 22, p.y + p.h, p.x + p.w - 14, p.y + p.h + 18]).fill(0x2b1c26);
    if (p.w > 100 && r() < 0.6) this.stringLights(p.x + 6, p.x + p.w - 6, p.y + p.h + 2, r);
    this.icicles(p.x + 6, p.x + p.w - 6, p.y + p.h, r, 0.5);
  }

  private snowTop(p: Platform, r: () => number): void {
    const g = this.tops;
    g.roundRect(p.x - 6, p.y - 8, p.w + 12, 14, 7).fill(0xeef4ff);
    // Hügelchen oben
    for (let x = p.x + 8; x < p.x + p.w - 8; x += 30 + r() * 40) g.ellipse(x, p.y - 7, 10 + r() * 14, 3 + r() * 3).fill(0xf6f9ff);
    // Tropfen-Überhang an der Kante
    for (let x = p.x - 2; x < p.x + p.w; x += 18 + r() * 12) g.ellipse(x + 6, p.y + 5, 4 + r() * 3, 3 + r() * 4).fill(0xeef4ff);
    g.rect(p.x - 4, p.y + 3, p.w + 8, 2).fill({ color: 0xb8c9ee, alpha: 0.7 });
    this.icicles(p.x, p.x + p.w, p.y + 7, r, 0.35);
  }

  private iceTop(p: Platform, r: () => number): void {
    const g = this.tops;
    g.roundRect(p.x - 2, p.y - 6, p.w + 4, 12, 4).fill({ color: 0x9fe8ff, alpha: 0.95 });
    g.rect(p.x + 2, p.y - 5, p.w - 4, 2).fill({ color: 0xffffff, alpha: 0.85 });
    // Glanzstreifen
    for (let x = p.x + 20 + r() * 30; x < p.x + p.w - 20; x += 50 + r() * 60) {
      g.poly([x, p.y - 4, x + 10, p.y - 4, x + 4, p.y + 4, x - 6, p.y + 4]).fill({ color: 0xffffff, alpha: 0.5 });
    }
    g.rect(p.x, p.y + 4, p.w, 2).fill({ color: 0x5ec8ff, alpha: 0.6 });
    // Eiszapfen dichter als beim Schnee
    this.icicles(p.x, p.x + p.w, p.y + 6, r, 0.8);
  }

  private icicles(x0: number, x1: number, y: number, r: () => number, density: number): void {
    const g = this.tops;
    for (let x = x0 + 6; x < x1 - 6; x += 9 + r() * 14) {
      if (r() > density) continue;
      const len = 4 + r() * 9;
      const w = 2 + r() * 2;
      g.poly([x - w, y, x + w, y, x, y + len]).fill({ color: 0xc8f1ff, alpha: 0.85 });
    }
  }

  private stringLights(x0: number, x1: number, y: number, r: () => number): void {
    const g = this.body;
    const span = 64;
    const n = Math.max(1, Math.round((x1 - x0) / span));
    const seg = (x1 - x0) / n;
    let ci = Math.floor(r() * BULB_COLORS.length);
    for (let i = 0; i < n; i++) {
      const a = x0 + i * seg;
      const sag = 7 + r() * 4;
      g.moveTo(a, y).quadraticCurveTo(a + seg / 2, y + sag * 2, a + seg, y).stroke({ width: 1.4, color: 0x1a1a2a });
      for (let k = 1; k < 4; k++) {
        const u = k / 4;
        const bx = a + seg * u;
        const by = y + sag * 4 * u * (1 - u);
        const color = BULB_COLORS[ci++ % BULB_COLORS.length];
        const glow = new Sprite(softDot());
        glow.anchor.set(0.5);
        glow.tint = color;
        glow.width = glow.height = 22;
        glow.position.set(bx, by + 3);
        const bulb = new Sprite(hardDot());
        bulb.anchor.set(0.5);
        bulb.tint = color;
        bulb.width = 4.5;
        bulb.height = 6;
        bulb.position.set(bx, by + 3);
        this.bulbs.addChild(glow, bulb);
        this.twinkles.push({ s: glow, base: 0.55, amp: 0.4, speed: 1.5 + r() * 2.5, phase: r() * 6.28 });
      }
    }
  }

  update(t: number): void {
    for (const tw of this.twinkles) tw.s.alpha = tw.base + tw.amp * Math.sin(t * tw.speed + tw.phase) * (0.6 + 0.4 * Math.sin(t * 7.3 + tw.phase * 3));
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.lights.destroy({ children: true });
  }
}

/** Fasst nebeneinanderliegende dicke Plattformen gleicher Höhe zu einem Gebäude zusammen. */
export function groupBuildings(platforms: Platform[]): Platform[][] {
  const thick = platforms.filter((p) => p.h >= BUILDING_MIN_H).sort((a, b) => a.x - b.x);
  const out: Platform[][] = [];
  for (const p of thick) {
    const last = out.find((g) => {
      const q = g[g.length - 1];
      return Math.abs(q.y - p.y) < 1 && Math.abs(q.x + q.w - p.x) < 2;
    });
    if (last) last.push(p);
    else out.push([p]);
  }
  return out;
}

function star(g: Graphics, cx: number, cy: number, R: number, r: number): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.poly(pts);
}
