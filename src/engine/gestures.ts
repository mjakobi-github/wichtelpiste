import type { Vec2 } from '../sim/types';
import type { Command } from '../sim/events';

export type ToolName = 'draw' | 'boost' | 'eraser' | 'pan';

export interface GestureDeps {
  tool(): ToolName;
  /** Darf gerade gezeichnet/verschoben werden? (nur beim Aufsetzen geprüft) */
  enabled(): boolean;
  toWorld(x: number, y: number): Vec2;
  send(c: Command): void;
  /** Verschieben: Bildschirm-Deltas in CSS-Pixeln */
  pan(dx: number, dy: number): void;
  /** Zoomen um Faktor f mit festem Bildschirmpunkt (x, y) */
  zoom(f: number, x: number, y: number): void;
}

/** Faktor je 100 Einheiten Mausrad */
const WHEEL_STEP = 1.15;

/**
 * Zeiger → Zeichnen/Radieren/Verschieben, zwei Finger → Kneif-Zoom + Verschieben.
 * Kommt ein zweiter Finger dazu, wird ein laufender Strich verworfen; bis alle
 * Finger oben sind, wird danach nicht mehr gezeichnet.
 */
export class Gestures {
  private readonly pts = new Map<number, { x: number; y: number }>();
  private primary: number | null = null;
  private tool: ToolName = 'draw';
  /** Kneifen aktiv bzw. bis zum Loslassen aller Finger gesperrt */
  private pinching = false;
  private last = { x: 0, y: 0 };

  constructor(private readonly el: HTMLElement, private readonly deps: GestureDeps) {
    el.addEventListener('pointerdown', (e) => this.down(e as PointerEvent));
    el.addEventListener('pointermove', (e) => this.move(e as PointerEvent));
    const up = (e: Event) => this.up(e as PointerEvent);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => this.wheel(e as WheelEvent), { passive: false });
  }

  private down(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!this.deps.enabled()) return;
    if (this.pts.size >= 2) return;
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.el.setPointerCapture?.(e.pointerId); } catch { /* jsdom/alte Browser */ }

    if (this.pts.size === 2) {
      if (!this.pinching && this.isStroke()) this.deps.send({ type: 'strokeCancel' });
      this.pinching = true;
      this.primary = null;
      return;
    }
    if (this.pinching) return;
    this.primary = e.pointerId;
    this.tool = this.deps.tool();
    this.last = { x: e.clientX, y: e.clientY };
    const p = this.deps.toWorld(e.clientX, e.clientY);
    if (this.isStroke()) this.deps.send({ type: 'strokeBegin', p, boost: this.tool === 'boost' });
    else if (this.tool === 'eraser') this.deps.send({ type: 'erase', p });
  }

  private move(e: PointerEvent): void {
    const prev = this.pts.get(e.pointerId);
    if (!prev) return;
    if (this.pinching) {
      if (this.pts.size === 2) this.pinchMove(e.pointerId, { x: e.clientX, y: e.clientY });
      else this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerId !== this.primary) return;
    const p = this.deps.toWorld(e.clientX, e.clientY);
    if (this.isStroke()) this.deps.send({ type: 'strokeMove', p });
    else if (this.tool === 'eraser') this.deps.send({ type: 'erase', p });
    else this.deps.pan(e.clientX - this.last.x, e.clientY - this.last.y);
    this.last = { x: e.clientX, y: e.clientY };
  }

  private pinchMove(id: number, now: { x: number; y: number }): void {
    const [a0, b0] = [...this.pts.values()];
    const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
    const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y);
    this.pts.set(id, now);
    const [a1, b1] = [...this.pts.values()];
    const mid1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
    const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
    if (mid1.x !== mid0.x || mid1.y !== mid0.y) this.deps.pan(mid1.x - mid0.x, mid1.y - mid0.y);
    if (d0 > 10 && d1 > 10 && d1 !== d0) this.deps.zoom(d1 / d0, mid1.x, mid1.y);
  }

  private up(e: PointerEvent): void {
    if (!this.pts.delete(e.pointerId)) return;
    if (e.pointerId === this.primary) {
      this.primary = null;
      if (this.isStroke()) this.deps.send({ type: 'strokeEnd' });
    }
    if (this.pts.size === 0) this.pinching = false;
  }

  private wheel(e: WheelEvent): void {
    if (!this.deps.enabled()) return;
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 33 : 1;
    this.deps.zoom(Math.pow(WHEEL_STEP, (-e.deltaY * scale) / 100), e.clientX, e.clientY);
  }

  private isStroke(): boolean {
    return this.tool === 'draw' || this.tool === 'boost';
  }
}
