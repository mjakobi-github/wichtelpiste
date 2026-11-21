import type { LevelData, Icicle, CandyCane, Segment, Vec2 } from '../game/types';
import type { Camera } from '../engine/camera';
import type { Player } from '../game/player';
import type { Sled } from '../game/sled';
import type { Mode, SledPhase } from '../game/game';

export interface HudState {
  mode: Mode;
  phase: SledPhase;
  ink: number | 'unlimited';
  inkMax: number | 'unlimited';
  time: number;
  giftCount: number;
  giftTotal: number;
  /** Speedtinten-Pool für 🚀-Linien */
  boost: number | 'unlimited';
  boostMax: number | 'unlimited';
  levelLabel: string;
}

export interface Scene {
  level: LevelData;
  player: Player | null;
  sled: Sled | null;
  lines: Segment[];
  giftTaken: boolean[];
  checkpointIdx: number;
  chimneyDelivered: boolean;
  notice: string | null;
  hud: HudState;
}

const GIFT_COLORS = ['#e6394b', '#2f9e63', '#f6c542', '#4f86e0'];

/**
 * Canvas2D-Renderer. Reine Zeichenarbeit, keine Spiel-Logik.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  scale = 1;
  zoom = 1;
  viewW = 0;
  viewH = 0;
  private baseScale = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D nicht verfügbar');
    this.ctx = ctx;
  }

  resize(dpr: number): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.baseScale = Math.max(this.canvas.height / 560, this.canvas.width / 1100);
    this.updateView();
  }

  private updateView(): void {
    this.scale = this.baseScale * this.zoom;
    this.viewW = this.canvas.width / this.scale;
    this.viewH = this.canvas.height / this.scale;
  }

  render(scene: Scene, cam: Camera): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawSky(ctx, scene.hud.time);

    // ---- Welt ----
    ctx.save();
    const s = this.scale;
    ctx.scale(s, s);
    ctx.translate(-cam.x, -cam.y);

    for (const p of scene.level.platforms) this.drawPlatform(ctx, p);
    if (scene.level.chimney) this.drawChimney(ctx, scene.level.chimney, scene.chimneyDelivered, scene.hud.time);
    for (const cp of scene.level.checkpoints) {
      this.drawCheckpoint(ctx, cp, scene.level.checkpoints.indexOf(cp) <= scene.checkpointIdx);
    }
    for (const ic of scene.level.icicles) this.drawIcicle(ctx, ic);
    for (const cc of scene.level.candies) this.drawCandyCane(ctx, cc);
    this.drawGifts(ctx, scene);
    for (const d of scene.level.dismounts) this.drawDismountZone(ctx, d);
    for (const st of scene.level.stations) this.drawStation(ctx, st.pos);
    this.drawLines(ctx, scene.lines);
    if (scene.sled) this.drawSled(ctx, scene.sled);
    if (scene.player) this.drawPlayer(ctx, scene.player, scene.hud.time);

    ctx.restore();

    // ---- HUD (Screen-Space) ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawHud(ctx, scene);
    if (scene.hud.mode === 'sled') {
      this.drawMinimap(ctx, scene);
      this.drawOffscreenMarkers(ctx, scene, cam);
    }
    if (scene.notice) this.drawNotice(ctx, scene.notice, scene.hud.time);
  }

  // ------------------------------------------------------------- Welt

  private drawSky(ctx: CanvasRenderingContext2D, time: number): void {
    const { width: w, height: h } = this.canvas;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#091428');
    grad.addColorStop(0.55, '#0b1d3a');
    grad.addColorStop(1, '#14294f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 70; i++) {
      const sx = frac(Math.sin(i * 12.9898) * 43758.5453) * w;
      const sy = frac(Math.sin(i * 78.233) * 12345.6789) * h * 0.6;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.8 + i));
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    const mx = w * 0.78;
    const my = h * 0.16;
    ctx.fillStyle = '#fdf6d8';
    ctx.beginPath();
    ctx.arc(mx, my, Math.min(w, h) * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(253,246,216,0.15)';
    ctx.beginPath();
    ctx.arc(mx, my, Math.min(w, h) * 0.075, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, p: { x: number; y: number; w: number; h: number }): void {
    ctx.fillStyle = '#232b45';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#eef4ff';
    ctx.fillRect(p.x, p.y, p.w, 10);
    ctx.fillRect(p.x - 3, p.y, p.w + 6, 4);
  }

  private drawGifts(ctx: CanvasRenderingContext2D, scene: Scene): void {
    scene.level.gifts.forEach((g, i) => {
      if (scene.giftTaken[i]) return;
      const color = GIFT_COLORS[i % GIFT_COLORS.length];
      const gy = g.y + Math.sin(scene.hud.time * 2.5 + i * 1.3) * 2.5;

      // weicher Schimmer
      ctx.fillStyle = 'rgba(246,197,66,0.12)';
      ctx.beginPath();
      ctx.arc(g.x, gy - 6, 16, 0, Math.PI * 2);
      ctx.fill();

      // Paket
      ctx.fillStyle = color;
      roundRect(ctx, g.x - 7, gy - 8, 14, 14, 2.5);
      ctx.fill();
      // Band
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(g.x - 1.5, gy - 8, 3, 14);
      ctx.fillRect(g.x - 7, gy - 3, 14, 3);
      // simpler Glanzpunkt
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(g.x - 5.5, gy - 6.5, 3, 2);
    });
  }

  private drawCheckpoint(ctx: CanvasRenderingContext2D, cp: Vec2, active: boolean): void {
    // Mast
    ctx.fillStyle = '#cfd8ea';
    ctx.fillRect(cp.x - 2, cp.y - 42, 4, 42);
    // Basis
    ctx.fillStyle = 'rgba(238,244,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(cp.x, cp.y, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fahne
    ctx.fillStyle = active ? '#6ee7a0' : 'rgba(207,216,234,0.55)';
    const wave = active ? Math.sin(performance.now() / 240) * 2 : 0;
    ctx.beginPath();
    ctx.moveTo(cp.x + 2, cp.y - 42);
    ctx.lineTo(cp.x + 18 + wave, cp.y - 35);
    ctx.lineTo(cp.x + 2, cp.y - 27);
    ctx.closePath();
    ctx.fill();
  }

  private drawIcicle(ctx: CanvasRenderingContext2D, ic: Icicle): void {
    const grad = ctx.createLinearGradient(0, ic.y - ic.h, 0, ic.y);
    grad.addColorStop(0, '#dff0ff');
    grad.addColorStop(1, '#7fb2e8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ic.x - 9, ic.y + 2);
    ctx.lineTo(ic.x - 3, ic.y + 2);
    ctx.lineTo(ic.x, ic.y - ic.h);
    ctx.lineTo(ic.x + 4, ic.y + 2);
    ctx.lineTo(ic.x + 10, ic.y + 2);
    ctx.lineTo(ic.x + 5, ic.y - ic.h * 0.55);
    ctx.closePath();
    ctx.fill();
    // Basis-Schneekante
    ctx.fillStyle = '#eef4ff';
    ctx.fillRect(ic.x - 12, ic.y, 24, 4);
  }

  private drawCandyCane(ctx: CanvasRenderingContext2D, cc: CandyCane): void {
    const x = cc.x;
    const top = cc.y - (cc.h - 24);   // Haken beginnt hier (24px hoch)
    const baseY = cc.y;

    // Haken oben (Halbkreis nach rechts)
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fdfdf6';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(x, top + 12);
    ctx.lineTo(x, baseY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 11, top + 12, 11, Math.PI, 2 * Math.PI);
    ctx.stroke();

    // Rote Streifen im Mast (geclippt auf die Stange)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 5.5, top + 12, 11, baseY - (top + 12));
    ctx.clip();
    ctx.strokeStyle = '#e6394b';
    ctx.lineWidth = 5.5;
    for (let sy = top + 24; sy < baseY + 12; sy += 18) {
      ctx.beginPath();
      ctx.moveTo(x - 8, sy);
      ctx.lineTo(x + 8, sy - 10);
      ctx.stroke();
    }
    ctx.restore();

    // Streifen im Haken (geclippt auf den Bogen)
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.rect(x + 11, top + 6.5, 5.5, 6);
    ctx.rect(x + 14, top - 5.5 - 5, 11, 11);
    ctx.clip();
    ctx.strokeStyle = '#e6394b';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(x + 11, top + 12);
    ctx.lineTo(x + 22, top + 6);
    ctx.stroke();
    ctx.restore();

    // Basis-Schneekante
    ctx.fillStyle = '#eef4ff';
    ctx.fillRect(x - 12, baseY, 24, 4);
  }

  private drawChimney(ctx: CanvasRenderingContext2D, c: Vec2, done: boolean, time: number): void {
    const w = 44;
    const h = 58;
    // Ziegelkörper
    ctx.fillStyle = done ? '#a8564f' : '#8c4a42';
    ctx.fillRect(c.x - w / 2, c.y - h, w, h);
    // Ziegelfugen
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 5; i++) {
      const y = c.y - h + (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(c.x - w / 2, y);
      ctx.lineTo(c.x + w / 2, y);
      ctx.stroke();
    }
    // Öffnung (dunkel)
    ctx.fillStyle = '#1c1220';
    ctx.fillRect(c.x - w / 2 + 6, c.y - h, w - 12, 9);
    ctx.fillStyle = done ? '#6ee7a0' : '#f6c542';
    ctx.fillRect(c.x - w / 2 - 3, c.y - h - 4, w + 6, 5);

    // Rauch nach Lieferung
    if (done) {
      for (let i = 0; i < 5; i++) {
        const t = ((time * 26 + i * 17) % 95);
        const a = Math.max(0, 0.55 - t / 130);
        ctx.fillStyle = `rgba(240,240,250,${a})`;
        ctx.beginPath();
        ctx.arc(c.x + Math.sin((time + i) * 2) * 7, c.y - h - 12 - t, 4 + t * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawLines(ctx: CanvasRenderingContext2D, lines: Segment[]): void {
    if (lines.length === 0) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const normal = lines.filter((l) => !l.boost);
    const boost = lines.filter((l) => l.boost);

    if (normal.length > 0) {
      ctx.strokeStyle = 'rgba(190,215,255,0.25)';
      ctx.lineWidth = 9;
      this.strokeLines(ctx, normal);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4.5;
      this.strokeLines(ctx, normal);
    }

    if (boost.length > 0) {
      ctx.strokeStyle = 'rgba(255,90,60,0.35)';
      ctx.lineWidth = 12;
      this.strokeLines(ctx, boost);
      ctx.strokeStyle = '#ff5a3c';
      ctx.lineWidth = 4.5;
      this.strokeLines(ctx, boost);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2.5;
      for (const l of boost) this.drawDirectionChevrons(ctx, l);
    }
  }

  /** Alle Segmente in einem Zug mit dem aktuellen Stroke-Stil zeichnen. */
  private strokeLines(ctx: CanvasRenderingContext2D, lines: Segment[]): void {
    ctx.beginPath();
    for (const l of lines) {
      ctx.moveTo(l.ax, l.ay);
      ctx.lineTo(l.bx, l.by);
    }
    ctx.stroke();
  }

  private drawDirectionChevrons(ctx: CanvasRenderingContext2D, l: Segment): void {
    const ex = l.bx - l.ax;
    const ey = l.by - l.ay;
    const len = Math.hypot(ex, ey);
    if (len < 14) return;
    const dx = ex / len;
    const dy = ey / len;

    for (const t of [0.35, 0.6, 0.85]) {
      if (len * t < 8 || len * (1 - t) < 4) continue;
      const px = l.ax + ex * t;
      const py = l.ay + ey * t;
      ctx.beginPath();
      ctx.moveTo(px - dx * 5 - dy * 4.5, py - dy * 5 + dx * 4.5);
      ctx.lineTo(px + dx * 3.5, py + dy * 3.5);
      ctx.lineTo(px - dx * 5 + dy * 4.5, py - dy * 5 - dx * 4.5);
      ctx.stroke();
    }
  }

  private drawStation(ctx: CanvasRenderingContext2D, pos: Vec2): void {
    const kp = performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(kp * 2.5);
    ctx.strokeStyle = `rgba(246,197,66,${0.35 + 0.3 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.ellipse(pos.x + 17, pos.y + 24, 52, 34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    this.drawSleighShape(ctx, pos.x, pos.y, 1, -Math.PI / 14);
  }

  private drawDismountZone(ctx: CanvasRenderingContext2D, d: { x: number; y: number; w: number; h: number }): void {
    ctx.strokeStyle = 'rgba(246,197,66,0.65)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(d.x + 6, d.y + 6, d.w - 12, d.h - 12);
    ctx.setLineDash([]);

    ctx.fillStyle = '#f6c542';
    ctx.fillRect(d.x + 14, d.y - 34, 3, 34);
    ctx.beginPath();
    ctx.moveTo(d.x + 17, d.y - 34);
    ctx.lineTo(d.x + 41, d.y - 27);
    ctx.lineTo(d.x + 17, d.y - 20);
    ctx.closePath();
    ctx.fill();
  }

  private drawSled(ctx: CanvasRenderingContext2D, sled: Sled): void {
    this.drawSleighShape(ctx, sled.pos.x - 17, sled.pos.y - 6, 1, -sled.angle);
  }

  private drawSleighShape(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    dir: 1 | -1,
    tilt: number,
  ): void {
    ctx.save();
    ctx.translate(x + 17, y + 6);
    ctx.rotate(-tilt * dir);
    ctx.scale(dir, 1);
    ctx.translate(-17, -6);

    ctx.strokeStyle = '#d8b64a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(1, 12);
    ctx.lineTo(30, 12);
    ctx.quadraticCurveTo(35, 12, 35, 7);
    ctx.stroke();

    ctx.fillStyle = '#c62f2f';
    roundRect(ctx, 2, -2, 30, 14, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(ctx, 2, 4, 30, 8, 3);
    ctx.fill();

    ctx.fillStyle = '#f2c9a4';
    ctx.beginPath();
    ctx.arc(11, -8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fdfdf6';
    ctx.beginPath();
    ctx.moveTo(5, -9);
    ctx.quadraticCurveTo(11, 2, 17, -9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c62f2f';
    ctx.beginPath();
    ctx.arc(11, -10, 6, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fdfdf6';
    ctx.beginPath();
    ctx.arc(20, -13, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, player: Player, time: number): void {
    const a = player.aabb;
    const onGround = player.grounded;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(a.x + a.w / 2, a.y + a.h + 3, a.w * 0.6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e2a3a';
    const legH = onGround ? 10 : 6;
    const kp = onGround && Math.abs(player.vel.x) > 20 ? Math.sin(time * 14) * 3 : 0;
    ctx.fillRect(a.x + 4 + kp, a.y + a.h - legH, 8, legH);
    ctx.fillRect(a.x + a.w - 12 - kp, a.y + a.h - legH, 8, legH);

    ctx.fillStyle = '#c62f2f';
    roundRect(ctx, a.x, a.y + 10, a.w, a.h - 16, 5);
    ctx.fill();

    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(a.x, a.y + a.h * 0.55, a.w, 4);
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(a.x + a.w / 2 - 3, a.y + a.h * 0.55 - 3, 6, 9);

    ctx.fillStyle = '#f2c9a4';
    ctx.beginPath();
    ctx.arc(a.x + a.w / 2, a.y + 9, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fdfdf6';
    ctx.beginPath();
    ctx.moveTo(a.x + a.w / 2 - 8, a.y + 8);
    ctx.quadraticCurveTo(a.x + a.w / 2, a.y + 22, a.x + a.w / 2 + 8, a.y + 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#c62f2f';
    ctx.beginPath();
    ctx.arc(a.x + a.w / 2, a.y + 6, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fdfdf6';
    ctx.fillRect(a.x + a.w / 2 - 9, a.y + 4, 18, 3);
    ctx.beginPath();
    ctx.arc(a.x + a.w / 2 + player.facing * 4, a.y - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ------------------------------------------------------------- HUD

  private drawHud(ctx: CanvasRenderingContext2D, scene: Scene): void {
    const kp = 16;
    const h = 18;
    const { ink, inkMax, boost, boostMax } = scene.hud;

    // Weisse Pistentinte
    const inkW = 180;
    ctx.fillStyle = 'rgba(10,20,40,0.55)';
    roundRect(ctx, kp, kp, inkW, h, 9);
    ctx.fill();

    if (typeof inkMax === 'number' && typeof ink === 'number') {
      const fracNow = inkMax > 0 ? Math.max(0, ink) / inkMax : 0;
      const low = fracNow < 0.2;
      ctx.fillStyle = low ? (Math.sin(scene.hud.time * 10) > 0 ? '#ff8080' : '#e6394b') : '#e6394b';
      ctx.globalAlpha = 0.55;
      roundRect(ctx, kp + 2, kp + 2, (inkW - 4) * fracNow, h - 4, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`Tinte ${Math.ceil(Math.max(0, ink))}`, kp + 10, kp + 13);
    } else {
      ctx.fillStyle = '#fdfdf6';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('Tinte: ∞', kp + 10, kp + 14);
    }

    // Rote Speedtinte (🚀) – eigener, knapper Pool
    const bW = 130;
    ctx.fillStyle = 'rgba(10,20,40,0.55)';
    roundRect(ctx, kp, kp + 24, bW, h, 9);
    ctx.fill();

    if (typeof boostMax === 'number' && typeof boost === 'number') {
      const fracB = boostMax > 0 ? Math.max(0, boost) / boostMax : 0;
      const lowB = fracB < 0.2;
      ctx.fillStyle = lowB ? (Math.sin(scene.hud.time * 10) > 0 ? '#ffb3a0' : '#ff6e50') : '#ff6e50';
      roundRect(ctx, kp + 2, kp + 26, (bW - 4) * fracB, h - 4, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`🚀 ${Math.ceil(Math.max(0, boost))}`, kp + 10, kp + 37);
    } else {
      ctx.fillStyle = '#fdfdf6';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('🚀 ∞', kp + 10, kp + 38);
    }

    // Geschenke
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(10,20,40,0.55)';
    roundRect(ctx, kp, kp + 48, 86, h + 6, 9);
    ctx.fill();
    ctx.fillStyle = '#fdfdf6';
    ctx.fillText(`🎁 ${scene.hud.giftCount}/${scene.hud.giftTotal}`, kp + 9, kp + 65);

    // Level-Label
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(10,20,40,0.55)';
    const lw = ctx.measureText(scene.hud.levelLabel).width + 18;
    roundRect(ctx, kp, kp + 74, lw, h, 9);
    ctx.fill();
    ctx.fillStyle = '#fdfdf6';
    ctx.fillText(scene.hud.levelLabel, kp + 9, kp + 87);

    // Modus-Hinweis
    const hint =
      scene.hud.mode === 'foot'
        ? '🚶 Laufe/springe zur Station…  |  R = retour (Zeichnung bleibt)'
        : scene.hud.phase === 'plan'
          ? '🛷 ✏️Weg (Z) · 🚀Schub (B) · 🧽Radieren (E) · ✋Verschieben (P)'
          : '🛷 Zeichnen – der Schlitten steuert dich!';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(hint, this.canvas.width - ctx.measureText(hint).width - kp, kp + 14);
  }

  private drawNotice(ctx: CanvasRenderingContext2D, text: string, time: number): void {
    ctx.font = 'bold 18px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 34;
    const x = (this.canvas.width - w) / 2;
    const y = 84 + Math.sin(time * 5) * 2;
    ctx.fillStyle = 'rgba(10,20,40,0.75)';
    roundRect(ctx, x, y - 22, w, 32, 10);
    ctx.fill();
    ctx.fillStyle = '#fdf6d8';
    ctx.textAlign = 'center';
    ctx.fillText(text, this.canvas.width / 2, y);
    ctx.textAlign = 'left';
  }

  // ------------------------------------------------------------- Minimap

  private drawMinimap(ctx: CanvasRenderingContext2D, scene: Scene): void {
    const m = 12;
    const mapW = this.canvas.width - m * 2;
    const mapH = Math.max(30, Math.min(44, this.canvas.height * 0.07));
    const y0 = 116; // unter Ink-/Geschenk-HUD
    const kx = mapW / this.levelWorldW(scene);
    const ky = mapH / this.levelWorldH(scene);
    const sx = (x: number) => m + x * kx;
    const sy = (y: number) => y0 + y * ky;

    ctx.fillStyle = 'rgba(10,20,40,0.6)';
    roundRect(ctx, m - 5, y0 - 5, mapW + 10, mapH + 10, 7);
    ctx.fill();

    ctx.fillStyle = '#414c73';
    for (const p of scene.level.platforms) {
      ctx.fillRect(sx(p.x), sy(p.y), Math.max(2, p.w * kx), Math.max(2, p.h * ky));
    }
    ctx.fillStyle = 'rgba(238,244,255,0.5)';
    for (const p of scene.level.platforms) {
      ctx.fillRect(sx(p.x), sy(p.y), Math.max(2, p.w * kx), 2);
    }

    if (scene.lines.length > 0) {
      ctx.lineWidth = 2;
      for (const l of scene.lines) {
        ctx.strokeStyle = l.boost ? 'rgba(255,110,80,0.95)' : 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(sx(l.ax), sy(l.ay));
        ctx.lineTo(sx(l.bx), sy(l.by));
        ctx.stroke();
      }
    }

    // Dismount-Zonen (Gold)
    ctx.fillStyle = 'rgba(246,197,66,0.85)';
    for (const d of scene.level.dismounts) {
      ctx.fillRect(sx(d.x), sy(d.y), Math.max(3, d.w * kx), Math.max(3, d.h * ky));
    }
    // Stationen
    ctx.fillStyle = '#f6c542';
    for (const s of scene.level.stations) {
      ctx.beginPath();
      ctx.arc(sx(s.pos.x), sy(s.pos.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Checkpoints (grün)
    ctx.fillStyle = scene.checkpointIdx >= 0 ? '#6ee7a0' : 'rgba(110,231,160,0.5)';
    for (const cp of scene.level.checkpoints) {
      ctx.beginPath();
      ctx.arc(sx(cp.x), sy(cp.y), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Eiszapfen (eisblau)
    ctx.fillStyle = '#9fd0ff';
    for (const ic of scene.level.icicles) {
      ctx.fillRect(sx(ic.x) - 1.5, sy(ic.y - ic.h), 3, Math.max(2, ic.h * ky));
    }
    // Zuckerstangen (rot-weiß als Punkt)
    ctx.fillStyle = '#ff6e50';
    for (const cc of scene.level.candies) {
      ctx.beginPath();
      ctx.arc(sx(cc.x), sy(cc.y - cc.h * 0.5), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Schornstein (ziegel)
    if (scene.level.chimney) {
      ctx.fillStyle = scene.chimneyDelivered ? '#6ee7a0' : '#c25b50';
      ctx.fillRect(sx(scene.level.chimney.x) - 3, sy(scene.level.chimney.y - 44), 6, 8);
    }
    // Geschenke
    for (let i = 0; i < scene.level.gifts.length; i++) {
      ctx.fillStyle = scene.giftTaken[i] ? 'rgba(255,255,255,0.18)' : '#7be3a0';
      const g = scene.level.gifts[i];
      ctx.fillRect(sx(g.x) - 1.5, sy(g.y) - 1.5, 3, 3);
    }

    // Akteur
    ctx.fillStyle = '#ff5b5b';
    const actor = scene.sled
      ? scene.sled.pos
      : (scene.player ? { x: scene.player.pos.x + 15, y: scene.player.pos.y + 19 } : null);
    if (actor) {
      ctx.beginPath();
      ctx.arc(sx(actor.x), sy(actor.y), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private levelWorldW(scene: Scene): number {
    return scene.level.worldW;
  }

  private levelWorldH(scene: Scene): number {
    return scene.level.worldH;
  }

  // ------------------------------------------------------------- Randpfeile

  private drawOffscreenMarkers(ctx: CanvasRenderingContext2D, scene: Scene, cam: Camera): void {
    const w = this.canvas.width;
    const h = this.canvas.height;

    const targets: { world: { x: number; y: number; w: number; h: number }[] } = { world: scene.level.dismounts };

    for (const d of targets.world) {
      const wx = d.x + d.w / 2;
      const wy = d.y + d.h / 2;
      const sx = (wx - cam.x) * this.scale;
      const sy = (wy - cam.y) * this.scale;

      const zx0 = (d.x - cam.x) * this.scale;
      const zx1 = (d.x + d.w - cam.x) * this.scale;
      const zy0 = (d.y - cam.y) * this.scale;
      const zy1 = (d.y + d.h - cam.y) * this.scale;
      const margin = 20;
      const inside =
        zx1 > margin && zx0 < w - margin && zy1 > margin && zy0 < h - margin;
      if (inside) continue;

      const cx = w / 2;
      const cy = h / 2;
      const ang = Math.atan2(sy - cy, sx - cx);

      const ex = Math.max(margin, Math.min(w - margin, sx));
      const ey = Math.max(margin, Math.min(h - margin, sy));

      const dist = Math.round(
        Math.hypot(wx - (cam.x + cx / this.scale), wy - (cam.y + cy / this.scale)) / 10,
      );

      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(246,197,66,0.95)';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-6, -10);
      ctx.lineTo(-6, 10);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-ang);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Ziel ~${dist}m`, 0, Math.sign(cy - ey) * -22 || -22);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }
}

// ---------- Helfer ----------

function frac(v: number): number {
  return v - Math.floor(v);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
