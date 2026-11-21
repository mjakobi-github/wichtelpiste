import { Loop } from '../engine/loop';
import { Input } from '../engine/input';
import { Camera, clamp } from '../engine/camera';
import { DrawingInput } from '../engine/drawing';
import { Renderer } from '../render/renderer';
import { audio } from '../engine/audio';
import { Player } from './player';
import { Sled, closestPointOnSegment } from './sled';
import { LEVELS, platformSegments } from './levels';
import { stationZone } from './world';
import type { DismountZone, LevelData, Rect, Segment, Vec2 } from './types';

export type Mode = 'foot' | 'sled';
export type SledPhase = 'plan' | 'ride';
export type Tool = 'draw' | 'boost' | 'eraser' | 'pan';
export type State = 'menu' | 'play' | 'won';

const ERASE_RADIUS = 18;
const GIFT_RADIUS = 14;
const CHIMNEY_W = 44;
const CHIMNEY_H = 64;

const ZOOM_FOOT = 1;
const ZOOM_SLED = 0.5;

const STORAGE_KEY = 'schlittenfahrer.stars';

export function chimneyZone(c: Vec2): Rect {
  return { x: c.x - CHIMNEY_W / 2, y: c.y - CHIMNEY_H - 10, w: CHIMNEY_W, h: CHIMNEY_H + 50 };
}

/**
 * Game: verbindet Loop, Input, Physik, Kamera, Renderer, Menü & Sound.
 * Zustände: menu <-> play <-> won.
 */
export class Game {
  private readonly loop: Loop;
  private readonly input = new Input();
  private readonly cam = new Camera();
  private readonly renderer: Renderer;

  private levelIdx = 0;
  private level: LevelData = LEVELS[0];
  private platformSegs: Segment[] = platformSegments(LEVELS[0]);
  /** Solide Hindernis-Boxen (Eiszapfen + Zuckerstangen) – stoppen, setzen nicht zurück */
  private obstacles: Rect[] = [];
  private obstacleSegs: Segment[] = [];
  /** Level-Sicht für den Fuß-Modus: Plattformen + Hindernis-Boxen */
  private footView: LevelData = LEVELS[0];
  private stuckTime = 0;
  private player: Player;
  private readonly sled = new Sled({ x: 0, y: 0 });

  private mode: Mode = 'foot';
  private sledPhase: SledPhase = 'plan';
  private tool: Tool = 'draw';
  private lines: Segment[] = [];
  /** Verbleibende Tinte je Bereich (Index = Stations-Index) */
  private inkByArea: (number | 'unlimited')[] = [];
  private boostByArea: (number | 'unlimited')[] = [];
  /** Der Bereich (Station), der gerade aktiv ist */
  private activeArea = 0;
  /** Respawn-Punkt (Fuß-Modus-Position) – Flags & Schlitten-Ankünfte setzen ihn */
  private respawnPos: Vec2 = { x: 85, y: 362 };
  /** Geschenk-Stand beim LOSfahren – bei erneutem Start Rückwerte */
  private giftSnapshot: boolean[] = [];

  private state: State = 'menu';
  private giftTaken: boolean[] = [];
  private lastCheckpointIdx = -1;
  private chimneyDelivered = false;
  private stars = 0;
  private notice: { text: string; until: number } | null = null;
  /** Sammel-Streak für den Sound */
  private collectStreak = 0;
  private lastCollectAt = -10;

  private boardCooldown = 0;
  private gameTime = 0;
  private zoom = ZOOM_FOOT;
  private zoomTarget = ZOOM_FOOT;

  private panPointer: number | null = null;
  private panLast: { x: number; y: number } | null = null;
  private erasePointer: number | null = null;

  private launchBtn: HTMLButtonElement | null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.player = new Player(this.level.spawn);
    this.cam.x = 0;
    this.cam.y = 0;
    this.resetLevelRuntime();
    this.player.onJump = () => audio.jump();

    audio.mount();

    this.loop = new Loop(
      (dt) => this.update(dt),
      () => this.draw(),
    );

    this.input.attach();
    this.input.onKeyPress = (code) => {
      if (code === 'Escape') { this.openMenu(); return; }
      if (this.state === 'menu') return;
      if (code === 'KeyR') this.retry();
      if (code === 'Space' && this.mode === 'sled' && this.sledPhase === 'plan') {
        this.launch();
      }
      if (code === 'Backspace') this.trash();
      // Werkzeuge: Z = Zeichnen (weiß), B = Schub (rot), E = Radierer, P = Verschieben
      if (code === 'KeyZ') this.setTool('draw');
      if (code === 'KeyB') this.setTool('boost');
      if (code === 'KeyE') this.setTool('eraser');
      if (code === 'KeyP') this.setTool('pan');
    };

    // Zeichnen
    new DrawingInput(canvas, {
      canDraw: () => this.state === 'play' && this.mode === 'sled' && (this.tool === 'draw' || this.tool === 'boost'),
      toWorld: (sx, sy) => this.toWorld(sx, sy),
      onSegment: (a, b) => this.addLine(a, b),
    });

    // Radierer
    canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'play' || this.mode !== 'sled' || this.tool !== 'eraser') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.erasePointer = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
      this.eraseAt(this.toWorld(e.clientX, e.clientY));
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.erasePointer) return;
      this.eraseAt(this.toWorld(e.clientX, e.clientY));
    });
    const endErase = (e: PointerEvent) => {
      if (e.pointerId !== this.erasePointer) return;
      this.erasePointer = null;
    };
    canvas.addEventListener('pointerup', endErase);
    canvas.addEventListener('pointercancel', endErase);

    // Pan
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.canPan()) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.panPointer = e.pointerId;
      this.panLast = { x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.panPointer || !this.panLast) return;
      const s = this.renderer.scale;
      const dx = (e.clientX - this.panLast.x) / s;
      const dy = (e.clientY - this.panLast.y) / s;
      this.panLast = { x: e.clientX, y: e.clientY };
      this.cam.x -= dx;
      this.cam.y -= dy;
      this.clampCamera();
    });
    const endPan = (e: PointerEvent) => {
      if (e.pointerId !== this.panPointer) return;
      this.panPointer = null;
      this.panLast = null;
    };
    canvas.addEventListener('pointerup', endPan);
    canvas.addEventListener('pointercancel', endPan);

    // Werkzeug-Buttons
    this.bindToolButton('tool-draw', 'draw');
    this.bindToolButton('tool-boost', 'boost');
    this.bindToolButton('tool-eraser', 'eraser');
    this.bindToolButton('tool-pan', 'pan');
    document.getElementById('tool-trash')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.trash();
    });

    // LOS / Overlay / Menü
    this.launchBtn = document.getElementById('btn-launch') as HTMLButtonElement | null;
    this.launchBtn?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.launch();
    });
    document.getElementById('btn-again')?.addEventListener('click', () => {
      this.hideOverlay();
      this.startLevel(this.levelIdx);
    });
    document.getElementById('btn-next')?.addEventListener('click', () => {
      this.hideOverlay();
      const next = Math.min(this.levelIdx + 1, LEVELS.length - 1);
      this.startLevel(next);
    });
    document.getElementById('btn-menu')?.addEventListener('click', () => {
      this.hideOverlay();
      this.openMenu();
    });
    document.getElementById('btn-menu-top')?.addEventListener('click', () => {
      this.hideOverlay();
      this.openMenu();
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const onResize = () => this.renderer.resize(dpr);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();

    this.openMenu();
  }

  start(): void {
    this.loop.start();
  }

  // ------------------------------------------------------------- Menü

  private loadStars(): number[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(arr) ? arr.map((v) => Math.max(0, Math.min(3, Number(v) || 0))) : [];
    } catch {
      return [];
    }
  }

  private saveStars(): void {
    try {
      const arr = this.loadStars();
      arr[this.levelIdx] = Math.max(arr[this.levelIdx] ?? 0, this.stars);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch { /* Speichern ist Best-Effort (Privatmodus etc.) */ }
  }

  private openMenu(): void {
    this.state = 'menu';
    const menu = document.getElementById('menu');
    const list = document.getElementById('menu-levels');
    if (!menu || !list) return;

    const saved = this.loadStars();
    list.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const btn = document.createElement('button');
      btn.className = 'levelbtn';
      const stars = saved[i] ?? 0;
      btn.innerHTML =
        `<span class="lv-idx">${i + 1}</span>` +
        `<span class="lv-name">${lv.name}</span>` +
        `<span class="lv-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
      btn.addEventListener('click', () => {
        menu.classList.add('hidden');
        this.startLevel(i);
      });
      list.appendChild(btn);
    });
    menu.classList.remove('hidden');
  }

  // ------------------------------------------------------------- Level

  private hideOverlay(): void {
    document.getElementById('overlay')?.classList.add('hidden');
    this.launchBtn?.classList.remove('hidden');
  }

  private startLevel(idx: number): void {
    this.levelIdx = idx;
    this.level = LEVELS[idx];
    this.platformSegs = platformSegments(this.level);

    // Hindernisse als solide Boxen (Fuß) bzw. Kanten-Segmente (Schlitten)
    this.obstacles = [
      ...this.level.icicles.map((ic) => icicleRect(ic)),
      ...this.level.candies.map((cc) => candyRect(cc)),
    ];
    this.obstacleSegs = [];
    for (const r of this.obstacles) {
      this.obstacleSegs.push({ ax: r.x, ay: r.y, bx: r.x + r.w, by: r.y });
      this.obstacleSegs.push({ ax: r.x, ay: r.y + r.h, bx: r.x + r.w, by: r.y + r.h });
      this.obstacleSegs.push({ ax: r.x, ay: r.y, bx: r.x, by: r.y + r.h });
      this.obstacleSegs.push({ ax: r.x + r.w, ay: r.y, bx: r.x + r.w, by: r.y + r.h });
    }
    this.footView = { ...this.level, platforms: [...this.level.platforms, ...this.obstacles] };
    this.stuckTime = 0;
    this.respawnPos = { ...this.level.spawn };
    this.giftSnapshot = [];

    this.state = 'play';
    this.mode = 'foot';
    this.sledPhase = 'plan';
    this.lastCheckpointIdx = -1;
    this.chimneyDelivered = false;
    this.zoomTarget = ZOOM_FOOT;
    this.resetLevelRuntime();
    this.player.respawn(this.level.spawn);
  }

  private resetLevelRuntime(): void {
    this.giftTaken = this.level.gifts.map(() => false);
    this.lines = [];
    this.inkByArea = this.level.areas.map((a) => a.ink);
    this.boostByArea = this.level.areas.map((a) => a.boost);
    this.activeArea = 0;
    this.notice = null;
    this.collectStreak = 0;
  }

  // ------------------------------------------------------------- Update

  private update(dt: number): void {
    if (this.state !== 'play') return;

    this.gameTime += dt;
    this.input.tick(this.gameTime);
    this.boardCooldown = Math.max(0, this.boardCooldown - dt);
    if (this.notice && this.gameTime > this.notice.until) this.notice = null;
    if (this.gameTime - this.lastCollectAt > 2) this.collectStreak = 0;

    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-4 * dt));

    if (this.mode === 'foot') {
      this.updateFoot(dt);
      this.checkStations();
    } else {
      this.updateSled(dt);
    }
  }

  private updateFoot(dt: number): void {
    const kp = this.input.read();
    // Hindernisse (Eiszapfen, Zuckerstangen) sind solide – kein Reset
    this.player.update(dt, kp, this.footView);

    const fallLimit = this.level.worldH + 240;
    if (this.player.pos.y > fallLimit) {
      this.retry();
      return;
    }

    this.collectGiftsNear(this.player.center);

    this.level.checkpoints.forEach((cp, i) => {
      if (i <= this.lastCheckpointIdx) return;
      if (Math.hypot(cp.x - this.player.center.x, cp.y - this.player.center.y) < 50) {
        this.lastCheckpointIdx = i;
        this.respawnPos = { x: cp.x - 15, y: cp.y - 38 };
        this.flash('Checkpoint! 🚩');
        audio.checkpoint();
      }
    });

    this.checkChimneyDelivery(this.player.center);
  }

  private updateSled(dt: number): void {
    if (this.sledPhase === 'plan') {
      this.stuckTime = 0;
      return;
    }

    const world = { w: this.level.worldW, h: this.level.worldH };
    const state = this.sled.update(dt, [...this.platformSegs, ...this.obstacleSegs, ...this.lines], world);

    if (state === 'fell') {
      this.retry();
      return;
    }

    // Anti-Softlock: sitzt der Schlitten fest (z. B. an einer Zuckerstange),
    // steigt der Fahrer nach kurzer Zeit aus
    if (this.sled.speed < 30) {
      this.stuckTime += dt;
      if (this.stuckTime > 1.2) {
        this.flash('Doch zu Fuß? 🚶');
        this.dismountAt({ x: this.sled.pos.x, y: this.sled.pos.y });
        return;
      }
    } else {
      this.stuckTime = 0;
    }

    this.collectGiftsNear(this.sled.pos);

    if (this.checkDismounts()) return;
    this.checkChimneyDelivery(this.sled.pos);
  }

  private collectGiftsNear(p: Vec2): void {
    this.level.gifts.forEach((g, i) => {
      if (this.giftTaken[i]) return;
      if (Math.hypot(g.x - p.x, g.y - p.y) < GIFT_RADIUS + 12) {
        this.giftTaken[i] = true;
        this.flash('🎁');
        audio.gift(this.collectStreak);
        this.collectStreak++;
        this.lastCollectAt = this.gameTime;
      }
    });
  }

  private checkChimneyDelivery(p: Vec2): void {
    if (!this.level.chimney || this.chimneyDelivered) return;
    if (!overlapRectPoint(chimneyZone(this.level.chimney), p)) return;

    const collected = this.collectedCount();
    if (collected === 0) {
      this.notice = { text: 'Erst Geschenke sammeln! 🎁', until: this.gameTime + 1.8 };
      audio.refuse();
      return;
    }
    this.deliverAndWin(collected);
  }

  private deliverAndWin(collected: number): void {
    const kp = this.level.gifts.length;
    this.stars = 1 + (collected / kp >= 0.6 ? 1 : 0) + (collected === kp ? 1 : 0);
    this.chimneyDelivered = true;
    this.state = 'won';
    this.saveStars();
    audio.win();

    document.getElementById('overlay-stars')!.textContent =
      '⭐'.repeat(this.stars) + '☆'.repeat(3 - this.stars);
    document.getElementById('overlay-sub')!.textContent =
      `${collected} / ${kp} Geschenke ausgeliefert`;
    const hasNext = this.levelIdx + 1 < LEVELS.length;
    document.getElementById('btn-next')?.classList.toggle('hidden', !hasNext);
    document.getElementById('overlay')?.classList.remove('hidden');
  }

  // ------------------------------------------------------------- Modi

  private checkStations(): void {
    if (this.boardCooldown > 0) return;
    if (!this.player.grounded) return;
    for (let i = 0; i < this.level.stations.length; i++) {
      if (overlap(this.player.aabb, stationZone(this.level.stations[i]))) {
        this.board(i);
        return;
      }
    }
  }

  private board(areaIdx: number): void {
    this.mode = 'sled';
    this.sledPhase = 'plan';
    this.activeArea = areaIdx;
    this.sled.reset(this.level.stations[areaIdx].pos, { x: 0, y: 0 });
    this.setTool('draw');
    this.zoomTarget = ZOOM_SLED;
  }

  private launch(): void {
    if (this.mode !== 'sled' || this.sledPhase !== 'plan' || this.state !== 'play') return;
    this.sledPhase = 'ride';
    this.giftSnapshot = [...this.giftTaken];
    this.stuckTime = 0;
    this.sled.vel = { x: 120 * this.player.facing, y: 0 };
    audio.launch();
  }

  private checkDismounts(): boolean {
    for (const d of this.level.dismounts) {
      if (pointInRect(this.sled.pos, d)) {
        this.dismount(d);
        return true;
      }
    }
    return false;
  }

  private dismount(zone: DismountZone): void {
    this.dismountAt({
      x: this.sled.pos.x,
      y: Math.min(this.sled.pos.y - 42, zone.y + zone.h - 38),
    });
  }

  private dismountAt(pos: Vec2): void {
    this.mode = 'foot';
    this.sledPhase = 'plan';
    this.zoomTarget = ZOOM_FOOT;
    this.player.pos = { x: pos.x - 15, y: pos.y };
    this.player.vel = { x: clamp(this.sled.vel.x * 0.3, -300, 300), y: 0 };
    if (Math.abs(this.sled.vel.x) > 5) this.player.facing = this.sled.vel.x > 0 ? 1 : -1;
    this.boardCooldown = 0.7;
    // Ankunft mit dem Schlitten = Checkpoint: nie weit zurückgeworfen werden
    this.respawnPos = { ...this.player.pos };
    this.flash('Angekommen – Checkpoint! 🚩');
  }

  private retry(): void {
    // Erneuter Start einer Fahrt: Geschenke der laufenden Fahrt zurücksetzen
    if (this.mode === 'sled') this.giftTaken = [...this.giftSnapshot];
    this.mode = 'foot';
    this.sledPhase = 'plan';
    this.zoomTarget = ZOOM_FOOT;
    this.stuckTime = 0;
    this.player.respawn({ ...this.respawnPos });
  }

  // ------------------------------------------------------------- Werkzeuge

  private canPan(): boolean {
    return this.mode === 'sled' && this.sledPhase === 'plan' && this.tool === 'pan';
  }

  private clampCamera(): void {
    const v = this.cameraView();
    this.cam.x = clamp(this.cam.x, 0, Math.max(0, this.level.worldW - v.w));
    this.cam.y = clamp(this.cam.y, -200, Math.max(0, this.level.worldH - v.h));
  }

  private bindToolButton(id: string, tool: Tool): void {
    const el = document.getElementById(id);
    el?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.setTool(tool);
    });
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    document.getElementById('tool-draw')?.classList.toggle('active', tool === 'draw');
    document.getElementById('tool-boost')?.classList.toggle('active', tool === 'boost');
    document.getElementById('tool-eraser')?.classList.toggle('active', tool === 'eraser');
    document.getElementById('tool-pan')?.classList.toggle('active', tool === 'pan');
  }

  private refundInk(len: number, boost: boolean): void {
    const kp = this.activeArea;
    const pools = boost ? this.boostByArea : this.inkByArea;
    const max = boost ? this.level.areas[kp]?.boost : this.level.areas[kp]?.ink;
    const pool = pools[kp];
    if (pool === undefined || pool === 'unlimited' || typeof max !== 'number') return;
    pools[kp] = Math.min(max, pool + len);
  }

  private eraseAt(p: Vec2): void {
    const kp = ERASE_RADIUS * ERASE_RADIUS;
    const kept: Segment[] = [];
    for (const seg of this.lines) {
      // Werkzeuge wirken nur auf Linien des aktiven Bereichs
      if (seg.area !== this.activeArea) {
        kept.push(seg);
        continue;
      }
      const cp = closestPointOnSegment(seg, p);
      const dx = cp.x - p.x;
      const dy = cp.y - p.y;
      if (dx * dx + dy * dy < kp) {
        this.refundInk(Math.hypot(seg.bx - seg.ax, seg.by - seg.ay), !!seg.boost);
      } else {
        kept.push(seg);
      }
    }
    this.lines = kept;
  }

  private trash(): void {
    const kept: Segment[] = [];
    for (const seg of this.lines) {
      // Nur die Zeichnung des aktiven Bereichs löschen (mit Tinte-Erstattung)
      if (seg.area === this.activeArea) {
        this.refundInk(Math.hypot(seg.bx - seg.ax, seg.by - seg.ay), !!seg.boost);
      } else {
        kept.push(seg);
      }
    }
    this.lines = kept;
  }

  private addLine(a: Vec2, b: Vec2): void {
    if (this.mode !== 'sled') return;
    if (this.tool !== 'draw' && this.tool !== 'boost') return;
    const boost = this.tool === 'boost';
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) return;

    const area = this.activeArea;
    const push = (a2: Vec2, b2: Vec2) =>
      this.lines.push({ ax: a2.x, ay: a2.y, bx: b2.x, by: b2.y, boost, area });

    const pool = (boost ? this.boostByArea : this.inkByArea)[area];
    if (pool === undefined) return;
    if (pool === 'unlimited') {
      push(a, b);
      return;
    }
    if (pool <= 0) {
      this.flash(boost ? 'Speedtinte aufgebraucht! 🚀' : 'Tinte aufgebraucht!');
      return;
    }
    if (len > pool) {
      const t = pool / len;
      b = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      (boost ? this.boostByArea : this.inkByArea)[area] = 0;
    } else {
      (boost ? this.boostByArea : this.inkByArea)[area] = pool - len;
    }
    push(a, b);
  }

  private toWorld(sx: number, sy: number): Vec2 {
    const r = this.renderer;
    return { x: this.cam.x + sx / r.scale, y: this.cam.y + sy / r.scale };
  }

  private flash(text: string): void {
    this.notice = { text, until: this.gameTime + 1.4 };
  }

  private levelLabel(): string {
    const n = this.level.stations.length;
    const area = n > 1 ? ` · Bereich ${this.activeArea + 1}/${n}` : '';
    return `${this.levelIdx + 1}. ${this.level.name}${area}`;
  }

  private collectedCount(): number {
    return this.giftTaken.reduce((n, t) => n + (t ? 1 : 0), 0);
  }

  // ------------------------------------------------------------- Render

  private cameraView(): { w: number; h: number } {
    return { w: this.renderer.viewW, h: this.renderer.viewH };
  }

  private draw(): void {
    const kp = this.mode === 'sled';
    if (!kp || this.sledPhase === 'ride') {
      const target: Vec2 = kp ? this.sled.pos : this.player.center;
      const lookahead = kp ? clamp(this.sled.vel.x * 0.35, -260, 260) : 70 * this.player.facing;
      this.cam.update(target, lookahead, 1 / 60, this.cameraView(), {
        w: this.level.worldW,
        h: this.level.worldH,
      });
    }

    this.renderer.zoom = this.zoom;
    this.renderer.render({
      level: this.level,
      player: this.mode === 'foot' ? this.player : null,
      sled: this.mode === 'sled' ? this.sled : null,
      lines: this.lines,
      giftTaken: this.giftTaken,
      checkpointIdx: this.lastCheckpointIdx,
      chimneyDelivered: this.chimneyDelivered,
      notice: this.notice?.text ?? null,
      hud: {
        mode: this.mode,
        phase: this.sledPhase,
        ink: this.inkByArea[this.activeArea] ?? 0,
        inkMax: this.level.areas[this.activeArea]?.ink ?? 0,
        boost: this.boostByArea[this.activeArea] ?? 0,
        boostMax: this.level.areas[this.activeArea]?.boost ?? 0,
        time: this.gameTime,
        giftCount: this.collectedCount(),
        giftTotal: this.level.gifts.length,
        levelLabel: this.levelLabel(),
      },
    }, this.cam);

    this.launchBtn?.classList.toggle(
      'visible',
      this.state === 'play' && this.mode === 'sled' && this.sledPhase === 'plan',
    );
  }
}

// ---------- kleine Math-/Hilfsfunktionen ----------

export function overlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function pointInRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function overlapRectPoint(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function icicleRect(ic: { x: number; y: number; h: number }): Rect {
  return { x: ic.x - 6, y: ic.y - ic.h, w: 12, h: ic.h };
}

/** Kollisionsbox einer Zuckerstange inkl. Haken oben */
function candyRect(cc: { x: number; y: number; h: number }): Rect {
  return { x: cc.x - 9, y: cc.y - cc.h - 24, w: 18, h: cc.h + 24 };
}
