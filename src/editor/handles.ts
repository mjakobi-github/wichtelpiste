import type { LevelData, Mover, Obstacle, Rect, Spring, Station, Vec2 } from '../sim/types';
import { chimneyZone, moverPosition, obstacleRect, springZone, stationZone } from '../sim/elements';
import { PLAYER_TUNING } from '../sim/player';
import { getElement, listElements, setElement, snap, type ElementRef } from './doc';

export type HandleId =
  | 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  | 'pivot' | 'bob' | 'swing' | 'center' | 'radius' | 'from' | 'to' | 'angle' | 'height';

/** Griff-Trefferradius in Bildschirm-px (≥ 44 px Trefferfläche). */
export const HANDLE_HIT_PX = 22;
/** Mindestmaß von Rechtecken und Höhen. */
const MIN = 10;
/** Abstand des Feder-Richtungsgriffs von der Basis. */
const SPRING_ARM = 60;

const RECT_KINDS = new Set(['platform', 'dismount', 'noDraw', 'hazard', 'hint']);

/** Das bearbeitbare Rechteck eines Flächen-Elements (oder null). */
export function rectOf(l: LevelData, ref: ElementRef): Rect | null {
  if (!RECT_KINDS.has(ref.kind)) return null;
  const e = getElement(l, ref) as Record<string, unknown>;
  if (ref.kind === 'hazard') return e.rect as Rect;
  if (ref.kind === 'hint') return e.at as Rect;
  return e as unknown as Rect;
}

function withRect(l: LevelData, ref: ElementRef, r: Rect): LevelData {
  const e = getElement(l, ref) as Record<string, unknown>;
  if (ref.kind === 'hazard') return setElement(l, ref, { ...e, rect: r });
  if (ref.kind === 'hint') return setElement(l, ref, { ...e, at: r });
  return setElement(l, ref, { ...e, ...r });
}

const around = (p: Vec2, w: number, h: number): Rect => ({ x: p.x - w / 2, y: p.y - h / 2, w, h });

function pathPoints(m: Mover): Vec2[] {
  const p = m.path;
  if (p.type === 'pendulum') {
    const end = (a: number): Vec2 => ({ x: p.pivot.x + p.length * Math.sin(a), y: p.pivot.y + p.length * Math.cos(a) });
    return [p.pivot, end(-p.amplitude), end(0), end(p.amplitude)];
  }
  if (p.type === 'circle') return [{ x: p.center.x - p.radius, y: p.center.y - p.radius }, { x: p.center.x + p.radius, y: p.center.y + p.radius }];
  return [p.from, p.to];
}

/** Umriss eines Elements in Weltkoordinaten. */
export function elementBounds(l: LevelData, ref: ElementRef): Rect {
  const r = rectOf(l, ref);
  if (r) return r;
  const e = getElement(l, ref);
  switch (ref.kind) {
    case 'spawn': { const p = e as Vec2; return { x: p.x, y: p.y, w: PLAYER_TUNING.size.w, h: PLAYER_TUNING.size.h }; }
    case 'station': return stationZone(e as Station);
    case 'gift': return around(e as Vec2, 30, 30);
    case 'checkpoint': { const p = e as Vec2; return { x: p.x - 14, y: p.y - 70, w: 28, h: 70 }; }
    case 'chimney': return chimneyZone(e as Vec2);
    case 'icicle': return obstacleRect(e as Obstacle, 'icicle');
    case 'candy': return obstacleRect(e as Obstacle, 'candy');
    case 'spring': return springZone(e as Spring);
    case 'mover': {
      const m = e as Mover;
      const pts = pathPoints(m);
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const x = Math.min(...xs) - m.radius;
      const y = Math.min(...ys) - m.radius;
      return { x, y, w: Math.max(...xs) + m.radius - x, h: Math.max(...ys) + m.radius - y };
    }
    default: return { x: 0, y: 0, w: 1, h: 1 };
  }
}

export function handlesFor(l: LevelData, ref: ElementRef): { id: HandleId; pos: Vec2 }[] {
  const r = rectOf(l, ref);
  if (r) {
    const { x, y, w, h } = r;
    return [
      { id: 'nw', pos: { x, y } }, { id: 'n', pos: { x: x + w / 2, y } }, { id: 'ne', pos: { x: x + w, y } },
      { id: 'e', pos: { x: x + w, y: y + h / 2 } }, { id: 'se', pos: { x: x + w, y: y + h } },
      { id: 's', pos: { x: x + w / 2, y: y + h } }, { id: 'sw', pos: { x, y: y + h } }, { id: 'w', pos: { x, y: y + h / 2 } },
    ];
  }
  const e = getElement(l, ref);
  if (ref.kind === 'mover') {
    const p = (e as Mover).path;
    if (p.type === 'pendulum') {
      return [
        { id: 'pivot', pos: p.pivot },
        { id: 'bob', pos: { x: p.pivot.x, y: p.pivot.y + p.length } },
        { id: 'swing', pos: { x: p.pivot.x + p.length * Math.sin(p.amplitude), y: p.pivot.y + p.length * Math.cos(p.amplitude) } },
      ];
    }
    if (p.type === 'circle') return [{ id: 'center', pos: p.center }, { id: 'radius', pos: { x: p.center.x + p.radius, y: p.center.y } }];
    return [{ id: 'from', pos: p.from }, { id: 'to', pos: p.to }];
  }
  if (ref.kind === 'spring') {
    const s = e as Spring;
    const a = (s.angle * Math.PI) / 180;
    return [{ id: 'angle', pos: { x: s.pos.x + Math.sin(a) * SPRING_ARM, y: s.pos.y - Math.cos(a) * SPRING_ARM } }];
  }
  if (ref.kind === 'icicle' || ref.kind === 'candy') {
    const o = e as Obstacle;
    return [{ id: 'height', pos: { x: o.x, y: o.y - o.h } }];
  }
  return [];
}

const inRect = (p: Vec2, r: Rect, pad: number): boolean =>
  p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

/** Was liegt unter p? Zuerst Griffe des gewählten Elements, dann Elemente von oben nach unten. */
export function hitTest(l: LevelData, p: Vec2, scale: number, selected: ElementRef | null): { ref: ElementRef; handle: HandleId } | null {
  const rad = HANDLE_HIT_PX / scale;
  if (selected) {
    let best: { id: HandleId; d: number } | null = null;
    for (const h of handlesFor(l, selected)) {
      const d = Math.hypot(h.pos.x - p.x, h.pos.y - p.y);
      if (d <= rad && (!best || d < best.d)) best = { id: h.id, d };
    }
    if (best) return { ref: selected, handle: best.id };
  }
  const pad = 4 / scale;
  const all = listElements(l).reverse();
  for (const ref of all) {
    if (ref.kind === 'mover') {
      const m = getElement(l, ref) as Mover;
      const at = moverPosition(m.path, 0);
      const anchor = handlesFor(l, ref)[0].pos;
      if (Math.hypot(at.x - p.x, at.y - p.y) <= m.radius + pad || Math.hypot(anchor.x - p.x, anchor.y - p.y) <= rad) return { ref, handle: 'move' };
      continue;
    }
    if (inRect(p, elementBounds(l, ref), pad)) return { ref, handle: 'move' };
  }
  return null;
}

/** Zieht Griff `handle` auf Weltpunkt `to` (Raster optional). 'move' wird von moveElement erledigt. */
export function dragHandle(l: LevelData, ref: ElementRef, handle: HandleId, to: Vec2, opts: { snap: boolean }): LevelData {
  if (handle === 'move') return l;
  const t = { x: snap(to.x, opts.snap), y: snap(to.y, opts.snap) };
  const r = rectOf(l, ref);
  if (r) {
    let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
    if (handle.includes('w')) x0 = Math.min(t.x, x1 - MIN);
    if (handle.includes('e')) x1 = Math.max(t.x, x0 + MIN);
    if (handle.includes('n')) y0 = Math.min(t.y, y1 - MIN);
    if (handle.includes('s')) y1 = Math.max(t.y, y0 + MIN);
    return withRect(l, ref, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  const e = getElement(l, ref) as Record<string, unknown>;
  if (ref.kind === 'mover') {
    const m = e as unknown as Mover;
    const p = m.path;
    let path = p;
    if (p.type === 'pendulum') {
      if (handle === 'pivot') path = { ...p, pivot: t };
      if (handle === 'bob') path = { ...p, length: Math.max(20, Math.round(Math.hypot(t.x - p.pivot.x, t.y - p.pivot.y))) };
      if (handle === 'swing') path = { ...p, amplitude: Math.min(Math.PI * 0.95, Math.abs(Math.atan2(to.x - p.pivot.x, to.y - p.pivot.y))) };
    } else if (p.type === 'circle') {
      if (handle === 'center') path = { ...p, center: t };
      if (handle === 'radius') path = { ...p, radius: Math.max(MIN, Math.round(Math.hypot(t.x - p.center.x, t.y - p.center.y))) };
    } else {
      if (handle === 'from') path = { ...p, from: t };
      if (handle === 'to') path = { ...p, to: t };
    }
    return setElement(l, ref, { ...m, path });
  }
  if (ref.kind === 'spring' && handle === 'angle') {
    const s = e as unknown as Spring;
    let deg = (Math.atan2(to.x - s.pos.x, -(to.y - s.pos.y)) * 180) / Math.PI;
    if (opts.snap) deg = Math.round(deg / 5) * 5;
    return setElement(l, ref, { ...s, angle: deg });
  }
  if ((ref.kind === 'icicle' || ref.kind === 'candy') && handle === 'height') {
    const o = e as unknown as Obstacle;
    return setElement(l, ref, { ...o, h: Math.max(MIN, o.y - t.y) });
  }
  return l;
}

