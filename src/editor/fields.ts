import type { Hazard, Hint, LevelData, MotionPath, Mover, Obstacle, Platform, Rect, Spring, Station, Vec2 } from '../sim/types';
import { getElement, renumberStation, setElement, type ElementRef } from './doc';
import { rectOf } from './handles';

export interface Field {
  key: string;
  label: string;
  type: 'number' | 'select' | 'toggle' | 'text';
  value: number | string | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  step?: number;
}

type V = Field['value'];
const DEG = 180 / Math.PI;
const num = (key: string, label: string, value: number, min?: number, step = 1): Field => ({ key, label, type: 'number', value, min, step });
const r1 = (n: number): number => Math.round(n * 10) / 10;

const HINT_ICONS = [
  { value: 'move', label: 'Laufen' }, { value: 'jump', label: 'Springen' }, { value: 'station', label: 'Station' },
  { value: 'draw', label: 'Zeichnen' }, { value: 'launch', label: 'LOS' }, { value: 'chimney', label: 'Schornstein' },
];

const STATION_DIRS = [
  { value: 'auto', label: 'Zum Ziel' }, { value: 'right', label: 'Rechts →' }, { value: 'left', label: '← Links' },
];

function pathFields(p: MotionPath): Field[] {
  const common = [num('period', 'Dauer (s)', p.period, 0.1, 0.1), num('phase', 'Versatz (0–1)', p.phase ?? 0, 0, 0.05)];
  if (p.type === 'pendulum') {
    return [num('pivotX', 'Drehpunkt x', p.pivot.x), num('pivotY', 'Drehpunkt y', p.pivot.y), num('length', 'Länge', p.length, 20),
      num('amplitude', 'Ausschlag (°)', r1(p.amplitude * DEG), 0), ...common];
  }
  if (p.type === 'circle') {
    return [num('centerX', 'Mitte x', p.center.x), num('centerY', 'Mitte y', p.center.y), num('pathRadius', 'Bahn-Radius', p.radius, 10), ...common];
  }
  return [num('fromX', 'Start x', p.from.x), num('fromY', 'Start y', p.from.y), num('toX', 'Ende x', p.to.x), num('toY', 'Ende y', p.to.y), ...common];
}

export function fieldsFor(l: LevelData, ref: ElementRef): Field[] {
  const e = getElement(l, ref);
  const rect = rectOf(l, ref);
  const rectF = (r: Rect): Field[] => [num('x', 'x', r.x), num('y', 'y', r.y), num('w', 'Breite', r.w, 10), num('h', 'Höhe', r.h, 10)];
  switch (ref.kind) {
    case 'spawn': case 'gift': case 'checkpoint': case 'chimney': {
      const p = e as Vec2;
      return [num('x', 'x', p.x), num('y', 'y', p.y)];
    }
    case 'station': {
      const s = e as Station;
      return [num('number', 'Nummer', ref.index + 1, 1),
        { key: 'dir', label: 'Fahrtrichtung', type: 'select', value: s.dir === 1 ? 'right' : s.dir === -1 ? 'left' : 'auto', options: STATION_DIRS },
        num('x', 'x', s.pos.x), num('y', 'y', s.pos.y)];
    }
    case 'platform': return [...rectF(rect!), { key: 'ice', label: 'Eis', type: 'toggle', value: (e as Platform).ice === true }];
    case 'dismount': case 'noDraw': return rectF(rect!);
    case 'hazard': return [{ key: 'hazardKind', label: 'Art', type: 'select', value: (e as Hazard).kind,
      options: [{ value: 'icicle-hanging', label: 'Hängender Eiszapfen' }, { value: 'tinsel', label: 'Lametta' }] }, ...rectF(rect!)];
    case 'hint': {
      const h = e as Hint;
      return [{ key: 'text', label: 'Text', type: 'text', value: h.text }, { key: 'icon', label: 'Symbol', type: 'select', value: h.icon, options: HINT_ICONS }, ...rectF(rect!)];
    }
    case 'icicle': case 'candy': {
      const o = e as Obstacle;
      return [num('x', 'x', o.x), num('y', 'y (Boden)', o.y), num('h', 'Höhe', o.h, 10)];
    }
    case 'spring': {
      const s = e as Spring;
      return [num('x', 'x', s.pos.x), num('y', 'y', s.pos.y), num('angle', 'Richtung (°)', r1(s.angle), undefined, 5), num('power', 'Stärke', s.power, 100, 50)];
    }
    case 'mover': {
      const m = e as Mover;
      return [
        { key: 'moverKind', label: 'Art', type: 'select', value: m.kind, options: [{ value: 'bell', label: 'Glocke' }, { value: 'crow', label: 'Krähe' }] },
        num('radius', 'Größe (Radius)', m.radius, 5),
        { key: 'pathType', label: 'Bahn', type: 'select', value: m.path.type,
          options: [{ value: 'pendulum', label: 'Pendel' }, { value: 'circle', label: 'Kreis' }, { value: 'line', label: 'Hin und her' }] },
        ...pathFields(m.path),
      ];
    }
  }
}

function anchorOf(p: MotionPath): Vec2 {
  return p.type === 'pendulum' ? p.pivot : p.type === 'circle' ? p.center : p.from;
}

function pathOfType(p: MotionPath, type: string): MotionPath {
  const a = anchorOf(p);
  const keep = { period: p.period, ...(p.phase !== undefined ? { phase: p.phase } : {}) };
  if (type === 'circle') return { type, center: a, radius: 100, ...keep };
  if (type === 'line') return { type, from: a, to: { x: a.x + 300, y: a.y }, ...keep };
  return { type: 'pendulum', pivot: a, length: 120, amplitude: 0.6, ...keep };
}

function setPath(p: MotionPath, key: string, v: number): MotionPath {
  switch (key) {
    case 'period': return { ...p, period: Math.max(0.1, v) };
    case 'phase': return { ...p, phase: v };
  }
  if (p.type === 'pendulum') {
    if (key === 'pivotX') return { ...p, pivot: { ...p.pivot, x: v } };
    if (key === 'pivotY') return { ...p, pivot: { ...p.pivot, y: v } };
    if (key === 'length') return { ...p, length: Math.max(20, v) };
    if (key === 'amplitude') return { ...p, amplitude: v / DEG };
  } else if (p.type === 'circle') {
    if (key === 'centerX') return { ...p, center: { ...p.center, x: v } };
    if (key === 'centerY') return { ...p, center: { ...p.center, y: v } };
    if (key === 'pathRadius') return { ...p, radius: Math.max(10, v) };
  } else {
    if (key === 'fromX') return { ...p, from: { ...p.from, x: v } };
    if (key === 'fromY') return { ...p, from: { ...p.from, y: v } };
    if (key === 'toX') return { ...p, to: { ...p.to, x: v } };
    if (key === 'toY') return { ...p, to: { ...p.to, y: v } };
  }
  return p;
}

/** Schreibt einen Feldwert zurück; unveränderter Wert → gleiches Level (kein Verlaufsschritt). */
export function applyField(l: LevelData, ref: ElementRef, key: string, value: V): LevelData {
  const cur = fieldsFor(l, ref).find((f) => f.key === key);
  if (!cur || cur.value === value) return l;
  const e = getElement(l, ref) as Record<string, unknown>;
  const n = typeof value === 'number' ? value : Number(value);
  const rect = rectOf(l, ref);
  if (ref.kind === 'station') {
    if (key === 'number') {
      const to = Math.round(n) - 1;
      return to >= 0 && to < l.stations.length ? renumberStation(l, ref.index, to) : l;
    }
    if (key === 'dir') {
      const { dir: _old, ...rest } = e as unknown as Station;
      return setElement(l, ref, value === 'right' ? { ...rest, dir: 1 } : value === 'left' ? { ...rest, dir: -1 } : rest);
    }
    const pos = e.pos as Vec2;
    return setElement(l, ref, { ...e, pos: { ...pos, [key]: n } });
  }
  if (rect && ['x', 'y', 'w', 'h'].includes(key)) {
    const r = { ...rect, [key]: key === 'w' || key === 'h' ? Math.max(10, n) : n };
    if (ref.kind === 'hazard') return setElement(l, ref, { ...e, rect: r });
    if (ref.kind === 'hint') return setElement(l, ref, { ...e, at: r });
    return setElement(l, ref, { ...e, ...r });
  }
  switch (key) {
    case 'ice': return setElement(l, ref, { ...e, ice: value === true });
    case 'hazardKind': return setElement(l, ref, { ...e, kind: value });
    case 'text': return String(value).trim() ? setElement(l, ref, { ...e, text: String(value) }) : l;
    case 'icon': return setElement(l, ref, { ...e, icon: value });
    case 'moverKind': return setElement(l, ref, { ...e, kind: value });
    case 'radius': return setElement(l, ref, { ...e, radius: Math.max(5, n) });
    case 'pathType': return setElement(l, ref, { ...e, path: pathOfType(e.path as MotionPath, String(value)) });
    case 'power': return setElement(l, ref, { ...e, power: Math.max(100, n) });
    case 'angle': return setElement(l, ref, { ...e, angle: n });
  }
  if (ref.kind === 'spring' && (key === 'x' || key === 'y')) return setElement(l, ref, { ...e, pos: { ...(e.pos as Vec2), [key]: n } });
  if (ref.kind === 'mover') return setElement(l, ref, { ...e, path: setPath(e.path as MotionPath, key, n) });
  if (key === 'h') return setElement(l, ref, { ...e, h: Math.max(10, n) });
  if (key === 'x' || key === 'y') return setElement(l, ref, { ...e, [key]: n });
  return l;
}

// ------------------------------------------------------------ Level (Profi)

export function levelFields(l: LevelData): Field[] {
  const out: Field[] = [
    { key: 'name', label: 'Name', type: 'text', value: l.name },
    { key: 'id', label: 'ID (Dateiname)', type: 'text', value: l.id },
    num('worldW', 'Weltbreite', l.worldW, 400, 50),
    num('worldH', 'Welthöhe', l.worldH, 400, 50),
    num('seed', 'Landschaft (Seed)', l.theme.seed),
    num('auroraHue', 'Polarlicht-Farbe (0–360)', l.theme.auroraHue, 0, 10),
  ];
  l.areas.forEach((a, i) => {
    const n = i + 1;
    out.push(
      { key: `inkUnlimited.${i}`, label: `Abschnitt ${n}: Tinte unbegrenzt`, type: 'toggle', value: a.ink === 'unlimited' },
      ...(a.ink === 'unlimited' ? [] : [num(`ink.${i}`, `Abschnitt ${n}: Tinte`, a.ink, 0, 50)]),
      { key: `boostUnlimited.${i}`, label: `Abschnitt ${n}: Speedtinte unbegrenzt`, type: 'toggle', value: a.boost === 'unlimited' },
      ...(a.boost === 'unlimited' ? [] : [num(`boost.${i}`, `Abschnitt ${n}: Speedtinte`, a.boost, 0, 50)]),
    );
  });
  return out;
}

export function applyLevelField(l: LevelData, key: string, value: V): LevelData {
  const cur = levelFields(l).find((f) => f.key === key);
  if (!cur || cur.value === value) return l;
  const n = Number(value);
  const [k, idx] = key.split('.');
  if (idx !== undefined) {
    const i = Number(idx);
    const areas = l.areas.map((a, j) => {
      if (j !== i) return a;
      if (k === 'ink') return { ...a, ink: Math.max(0, n) };
      if (k === 'boost') return { ...a, boost: Math.max(0, n) };
      if (k === 'inkUnlimited') return { ...a, ink: value === true ? 'unlimited' as const : 1000 };
      if (k === 'boostUnlimited') return { ...a, boost: value === true ? 'unlimited' as const : 0 };
      return a;
    });
    return { ...l, areas };
  }
  switch (key) {
    case 'name': return String(value).trim() ? { ...l, name: String(value).trim() } : l;
    case 'id': return /^[a-z0-9-]+$/.test(String(value)) ? { ...l, id: String(value) } : l;
    case 'worldW': return { ...l, worldW: Math.max(400, n) };
    case 'worldH': return { ...l, worldH: Math.max(400, n) };
    case 'seed': return { ...l, theme: { ...l.theme, seed: Math.round(n) } };
    case 'auroraHue': return { ...l, theme: { ...l.theme, auroraHue: ((n % 360) + 360) % 360 } };
  }
  return l;
}
