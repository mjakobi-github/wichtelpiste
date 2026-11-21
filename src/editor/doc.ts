import type { LevelData, MotionPath, Rect, Vec2 } from '../sim/types';

/** Bearbeitbare Elementarten des Levelformats v1. */
export type ElementKind =
  | 'platform' | 'spawn' | 'station' | 'dismount' | 'gift' | 'checkpoint' | 'chimney'
  | 'icicle' | 'candy' | 'hazard' | 'mover' | 'spring' | 'noDraw' | 'hint';

export interface ElementRef { kind: ElementKind; index: number }

type ListKind = Exclude<ElementKind, 'spawn' | 'chimney'>;

const LIST_FIELD = {
  platform: 'platforms', station: 'stations', dismount: 'dismounts', gift: 'gifts', checkpoint: 'checkpoints',
  icicle: 'icicles', candy: 'candies', hazard: 'hazards', mover: 'movers', spring: 'springs', noDraw: 'noDraw', hint: 'hints',
} as const satisfies Record<ListKind, keyof LevelData>;

/** Zeichen- und Trefferreihenfolge: Flächen zuerst (unten), Punkte zuletzt (oben). */
export const DRAW_ORDER: readonly ElementKind[] = [
  'hint', 'noDraw', 'platform', 'dismount', 'hazard', 'icicle', 'candy', 'spring', 'mover',
  'station', 'checkpoint', 'chimney', 'gift', 'spawn',
];

const isList = (k: ElementKind): k is ListKind => k !== 'spawn' && k !== 'chimney';

function list(l: LevelData, k: ListKind): unknown[] {
  return l[LIST_FIELD[k]] as unknown[];
}

export function listElements(l: LevelData): ElementRef[] {
  const out: ElementRef[] = [];
  for (const kind of DRAW_ORDER) {
    const n = isList(kind) ? list(l, kind).length : 1;
    for (let index = 0; index < n; index++) out.push({ kind, index });
  }
  return out;
}

export function getElement(l: LevelData, ref: ElementRef): unknown {
  if (ref.kind === 'spawn') return l.spawn;
  if (ref.kind === 'chimney') return l.chimney;
  return list(l, ref.kind)[ref.index];
}

export function setElement(l: LevelData, ref: ElementRef, value: unknown): LevelData {
  if (ref.kind === 'spawn') return { ...l, spawn: value as Vec2 };
  if (ref.kind === 'chimney') return { ...l, chimney: value as Vec2 };
  const arr = [...list(l, ref.kind)];
  arr[ref.index] = value;
  return { ...l, [LIST_FIELD[ref.kind]]: arr };
}

export function snap(v: number, on: boolean, step = 10): number {
  return on ? Math.round(v / step) * step : v;
}

const r = (n: number): number => Math.round(n);

/** Standardwerte eines neuen Elements an Punkt `at` (Rechtecke mittig, Bodenobjekte mit Basis bei at). */
function defaults(kind: ListKind, at: Vec2, variant?: string): unknown {
  const box = (w: number, h: number) => ({ x: r(at.x - w / 2), y: r(at.y - h / 2), w, h });
  switch (kind) {
    // Boden: Haus (ab 50 px Höhe als Haus gezeichnet), Oberkante am angetippten Punkt
    case 'platform': return variant === 'ground'
      ? { x: r(at.x - 200), y: r(at.y), w: 400, h: 120, ice: false }
      : { ...box(200, 40), ice: variant === 'ice' };
    case 'station': return { pos: { x: r(at.x), y: r(at.y) } };
    case 'dismount': return box(240, 150);
    case 'gift':
    case 'checkpoint': return { x: r(at.x), y: r(at.y) };
    case 'icicle': return { x: r(at.x), y: r(at.y), h: 50 };
    case 'candy': return { x: r(at.x), y: r(at.y), h: 60 };
    case 'hazard': return variant === 'tinsel' ? { kind: 'tinsel', rect: box(120, 20) } : { kind: 'icicle-hanging', rect: box(30, 60) };
    case 'mover': {
      if (variant === 'crow') {
        return { kind: 'crow', radius: 18, path: { type: 'line', from: { x: r(at.x - 150), y: r(at.y) }, to: { x: r(at.x + 150), y: r(at.y) }, period: 4 } };
      }
      return { kind: 'bell', radius: 22, path: { type: 'pendulum', pivot: { x: r(at.x), y: r(at.y - 120) }, length: 120, amplitude: 0.6, period: 2.4 } };
    }
    case 'spring': return { pos: { x: r(at.x), y: r(at.y) }, angle: 0, power: 900 };
    case 'noDraw': return box(200, 200);
    case 'hint': return { at: box(300, 300), text: 'Hinweis', icon: 'move' };
  }
}

export function addElement(l: LevelData, kind: ElementKind, at: Vec2, variant?: string): { level: LevelData; ref: ElementRef } {
  if (!isList(kind)) {
    const ref = { kind, index: 0 };
    return { level: setElement(l, ref, { x: r(at.x), y: r(at.y) }), ref };
  }
  const arr = [...list(l, kind), defaults(kind, at, variant)];
  let level: LevelData = { ...l, [LIST_FIELD[kind]]: arr };
  if (kind === 'station') level = { ...level, areas: [...l.areas, { ink: 800, boost: 0 }] };
  return { level, ref: { kind, index: arr.length - 1 } };
}

/** Verschiebt die Position und behält alle übrigen Felder (Breite, Höhe, Eis …). */
const shift = <T extends Vec2>(p: T, dx: number, dy: number): T => ({ ...p, x: p.x + dx, y: p.y + dy });

function shiftPath(p: MotionPath, dx: number, dy: number): MotionPath {
  if (p.type === 'pendulum') return { ...p, pivot: shift(p.pivot, dx, dy) };
  if (p.type === 'circle') return { ...p, center: shift(p.center, dx, dy) };
  return { ...p, from: shift(p.from, dx, dy), to: shift(p.to, dx, dy) };
}

export function moveElement(l: LevelData, ref: ElementRef, dx: number, dy: number): LevelData {
  const e = getElement(l, ref) as Record<string, unknown>;
  let v: unknown;
  switch (ref.kind) {
    case 'station':
    case 'spring': v = { ...e, pos: shift(e.pos as Vec2, dx, dy) }; break;
    case 'hazard': v = { ...e, rect: shift(e.rect as Vec2, dx, dy) }; break;
    case 'hint': v = { ...e, at: shift(e.at as Vec2, dx, dy) }; break;
    case 'mover': v = { ...e, path: shiftPath(e.path as MotionPath, dx, dy) }; break;
    default: v = shift(e as unknown as Vec2 & Record<string, unknown>, dx, dy);
  }
  return setElement(l, ref, v);
}

export function removeElement(l: LevelData, ref: ElementRef): LevelData {
  if (!isList(ref.kind)) return l;
  const without = <T>(a: readonly T[], i: number): T[] => a.filter((_, j) => j !== i);
  const level = { ...l, [LIST_FIELD[ref.kind]]: without(list(l, ref.kind), ref.index) };
  if (ref.kind !== 'station') return level;
  return { ...level, areas: without(l.areas, ref.index), dismounts: without(l.dismounts, ref.index) };
}

export function duplicateElement(l: LevelData, ref: ElementRef): { level: LevelData; ref: ElementRef } {
  if (!isList(ref.kind)) return { level: l, ref };
  const copy = structuredClone(getElement(l, ref));
  const arr = [...list(l, ref.kind), copy];
  let level: LevelData = { ...l, [LIST_FIELD[ref.kind]]: arr };
  if (ref.kind === 'station') level = { ...level, areas: [...l.areas, { ...l.areas[ref.index] }] };
  const nref = { kind: ref.kind, index: arr.length - 1 };
  return { level: moveElement(level, nref, 40, 0), ref: nref };
}

/** Tauscht Station `from` mit `to` samt Abschnitt und Landezone (fehlende Landezonen bleiben fehlend). */
export function renumberStation(l: LevelData, from: number, to: number): LevelData {
  const swap = <T>(a: readonly T[]): T[] => {
    const c = [...a];
    if (from >= c.length || to >= c.length) return c;
    [c[from], c[to]] = [c[to], c[from]];
    return c;
  };
  return { ...l, stations: swap(l.stations), areas: swap(l.areas), dismounts: swap(l.dismounts) };
}

const fin = (n: unknown, d: number): number => (typeof n === 'number' && Number.isFinite(n) ? n : d);
const fixRect = <T extends Partial<Rect>>(r: T, w: number, h: number): T & Rect =>
  ({ ...r, x: fin(r.x, 0), y: fin(r.y, 0), w: fin(r.w, w) > 0 ? fin(r.w, w) : w, h: fin(r.h, h) > 0 ? fin(r.h, h) : h });

/** Ergänzt fehlende/ungültige Maße (z. B. aus Entwürfen eines älteren Editor-Fehlers). Gültige Level bleiben gleich. */
export function repairLevel(l: LevelData): LevelData {
  const out: LevelData = {
    ...l,
    platforms: l.platforms.map((p) => fixRect(p, 200, 40)),
    dismounts: l.dismounts.map((r) => fixRect(r, 240, 150)),
    noDraw: l.noDraw.map((r) => fixRect(r, 200, 200)),
    hazards: l.hazards.map((h) => ({ ...h, rect: fixRect(h.rect ?? {}, h.kind === 'tinsel' ? 120 : 30, h.kind === 'tinsel' ? 20 : 60) })),
    hints: l.hints.map((h) => ({ ...h, at: fixRect(h.at ?? {}, 300, 300) })),
    icicles: l.icicles.map((o) => ({ ...o, x: fin(o.x, 0), y: fin(o.y, 0), h: fin(o.h, 50) > 0 ? fin(o.h, 50) : 50 })),
    candies: l.candies.map((o) => ({ ...o, x: fin(o.x, 0), y: fin(o.y, 0), h: fin(o.h, 60) > 0 ? fin(o.h, 60) : 60 })),
  };
  return JSON.stringify(out) === JSON.stringify(l) ? l : out;
}
