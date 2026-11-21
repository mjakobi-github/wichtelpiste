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
}

/**
 * Zeiger → Zeichnen/Radieren/Verschieben. Nur der erste Zeiger zählt;
 * weitere Finger werden ignoriert, Abbruch beendet den Strich sauber.
 */
export class Gestures {
  private pointer: number | null = null;
  private tool: ToolName = 'draw';
  private last = { x: 0, y: 0 };

  constructor(private readonly el: HTMLElement, private readonly deps: GestureDeps) {
    el.addEventListener('pointerdown', (e) => this.down(e as PointerEvent));
    el.addEventListener('pointermove', (e) => this.move(e as PointerEvent));
    const up = (e: Event) => this.up(e as PointerEvent);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private down(e: PointerEvent): void {
    if (this.pointer !== null || !this.deps.enabled()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointer = e.pointerId;
    this.tool = this.deps.tool();
    this.last = { x: e.clientX, y: e.clientY };
    try { this.el.setPointerCapture?.(e.pointerId); } catch { /* jsdom/alte Browser */ }
    const p = this.deps.toWorld(e.clientX, e.clientY);
    if (this.tool === 'draw' || this.tool === 'boost') this.deps.send({ type: 'strokeBegin', p, boost: this.tool === 'boost' });
    else if (this.tool === 'eraser') this.deps.send({ type: 'erase', p });
  }

  private move(e: PointerEvent): void {
    if (e.pointerId !== this.pointer) return;
    const p = this.deps.toWorld(e.clientX, e.clientY);
    if (this.tool === 'draw' || this.tool === 'boost') this.deps.send({ type: 'strokeMove', p });
    else if (this.tool === 'eraser') this.deps.send({ type: 'erase', p });
    else this.deps.pan(e.clientX - this.last.x, e.clientY - this.last.y);
    this.last = { x: e.clientX, y: e.clientY };
  }

  private up(e: PointerEvent): void {
    if (e.pointerId !== this.pointer) return;
    this.pointer = null;
    if (this.tool === 'draw' || this.tool === 'boost') this.deps.send({ type: 'strokeEnd' });
  }
}
