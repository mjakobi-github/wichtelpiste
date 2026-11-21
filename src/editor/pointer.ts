import type { LevelData, Vec2 } from '../sim/types';
import { moveElement, snap, type ElementKind, type ElementRef } from './doc';
import { dragHandle, hitTest, type HandleId } from './handles';

export type EditorAction =
  | { type: 'select'; ref: ElementRef | null }
  | { type: 'preview'; level: LevelData }
  | { type: 'commit'; level: LevelData }
  | { type: 'place'; kind: ElementKind; variant?: string; at: Vec2; keep: boolean }
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'zoom'; f: number; x: number; y: number };

export interface PointerDeps {
  level(): LevelData;
  selected(): ElementRef | null;
  placing(): { kind: ElementKind; variant?: string } | null;
  /** Bildschirm-px je Welt-px */
  scale(): number;
  snap(): boolean;
  toWorld(x: number, y: number): Vec2;
}

/** shift = Baustein behalten, alt = ohne Raster, pan = Kamera schieben (Leertaste, mittlere Taste, Hand-Werkzeug). */
export interface Mods { shift: boolean; alt: boolean; pan: boolean }

/** Unter dieser Strecke (Bildschirm-px) gilt eine Berührung als Antippen. */
const TAP_PX = 4;

type Mode =
  | { kind: 'idle' }
  | { kind: 'pending'; start: Vec2; world: Vec2; hit: { ref: ElementRef; handle: HandleId } | null; pan: boolean }
  | { kind: 'drag'; startWorld: Vec2; base: LevelData; ref: ElementRef; handle: HandleId; last: LevelData }
  | { kind: 'pan'; last: Vec2 }
  | { kind: 'pinch' }
  | { kind: 'blocked' };

/**
 * Zeiger → Editor-Aktionen, ohne DOM (testbar). Ein Ziehen ergibt viele `preview` und genau einen `commit`.
 * Zwei Finger: Ziehen abbrechen, Kneif-Zoom + Verschieben; danach gesperrt, bis alle Finger oben sind.
 */
export class PointerTool {
  private readonly pts = new Map<number, Vec2>();
  private mode: Mode = { kind: 'idle' };

  constructor(private readonly d: PointerDeps) {}

  down(s: Vec2, m: Mods, id: number): EditorAction[] {
    this.pts.set(id, s);
    const out: EditorAction[] = [];
    if (this.pts.size >= 2) {
      if (this.mode.kind === 'drag') out.push({ type: 'preview', level: this.mode.base });
      this.mode = { kind: 'pinch' };
      return out;
    }
    const world = this.d.toWorld(s.x, s.y);
    const hit = m.pan ? null : hitTest(this.d.level(), world, this.d.scale(), this.d.selected());
    this.mode = { kind: 'pending', start: s, world, hit, pan: m.pan };
    return out;
  }

  move(s: Vec2, m: Mods, id: number): EditorAction[] {
    const prev = this.pts.get(id);
    if (!prev) return [];
    if (this.mode.kind === 'pinch') return this.pinch(id, s);
    this.pts.set(id, s);
    const mode = this.mode;
    if (mode.kind === 'pan') {
      const a: EditorAction = { type: 'pan', dx: s.x - mode.last.x, dy: s.y - mode.last.y };
      mode.last = s;
      return [a];
    }
    if (mode.kind === 'pending') {
      if (Math.hypot(s.x - mode.start.x, s.y - mode.start.y) < TAP_PX) return [];
      if (mode.pan || !mode.hit || this.d.placing()) {
        this.mode = { kind: 'pan', last: s };
        return [{ type: 'pan', dx: s.x - mode.start.x, dy: s.y - mode.start.y }];
      }
      const out: EditorAction[] = [];
      const sel = this.d.selected();
      if (!sel || sel.kind !== mode.hit.ref.kind || sel.index !== mode.hit.ref.index) out.push({ type: 'select', ref: mode.hit.ref });
      const base = this.d.level();
      this.mode = { kind: 'drag', startWorld: mode.world, base, ref: mode.hit.ref, handle: mode.hit.handle, last: base };
      return [...out, ...this.dragTo(s, m)];
    }
    if (mode.kind === 'drag') return this.dragTo(s, m);
    return [];
  }

  up(s: Vec2, m: Mods, id: number): EditorAction[] {
    if (!this.pts.has(id)) return [];
    this.pts.delete(id);
    const mode = this.mode;
    if (mode.kind === 'pinch' || mode.kind === 'blocked') {
      this.mode = this.pts.size === 0 ? { kind: 'idle' } : { kind: 'blocked' };
      return [];
    }
    if (mode.kind === 'drag') {
      this.dragTo(s, m);
      this.mode = { kind: 'idle' };
      return mode.last !== mode.base ? [{ type: 'commit', level: mode.last }] : [];
    }
    this.mode = { kind: 'idle' };
    if (mode.kind === 'pending') {
      const placing = this.d.placing();
      if (placing && !mode.pan) {
        const sn = this.d.snap() && !m.alt;
        return [{ type: 'place', kind: placing.kind, variant: placing.variant, at: { x: snap(mode.world.x, sn), y: snap(mode.world.y, sn) }, keep: m.shift }];
      }
      if (!mode.pan) return [{ type: 'select', ref: mode.hit?.ref ?? null }];
    }
    return [];
  }

  cancel(): EditorAction[] {
    const mode = this.mode;
    this.pts.clear();
    this.mode = { kind: 'idle' };
    return mode.kind === 'drag' ? [{ type: 'preview', level: mode.base }] : [];
  }

  private dragTo(s: Vec2, m: Mods): EditorAction[] {
    const mode = this.mode;
    if (mode.kind !== 'drag') return [];
    const w = this.d.toWorld(s.x, s.y);
    const sn = this.d.snap() && !m.alt;
    const level = mode.handle === 'move'
      ? moveElement(mode.base, mode.ref, snap(w.x - mode.startWorld.x, sn), snap(w.y - mode.startWorld.y, sn))
      : dragHandle(mode.base, mode.ref, mode.handle, w, { snap: sn });
    mode.last = level;
    return [{ type: 'preview', level }];
  }

  private pinch(id: number, s: Vec2): EditorAction[] {
    const ids = [...this.pts.keys()];
    const other = this.pts.get(ids.find((k) => k !== id)!)!;
    const before = this.pts.get(id)!;
    this.pts.set(id, s);
    const d0 = Math.hypot(before.x - other.x, before.y - other.y);
    const d1 = Math.hypot(s.x - other.x, s.y - other.y);
    const mid0 = { x: (before.x + other.x) / 2, y: (before.y + other.y) / 2 };
    const mid1 = { x: (s.x + other.x) / 2, y: (s.y + other.y) / 2 };
    const out: EditorAction[] = [{ type: 'pan', dx: mid1.x - mid0.x, dy: mid1.y - mid0.y }];
    if (d0 > 0 && d1 > 0) out.push({ type: 'zoom', f: d1 / d0, x: mid1.x, y: mid1.y });
    return out;
  }
}
