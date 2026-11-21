import type { Hint, LevelData, MotionPath, Rect } from '../sim/types';
import { LevelError, validateLevel } from '../levels/schema';

/** Was ein geteilter Link enthält (die Lösung bleibt geheim). */
export interface SharePayload { level: LevelData; from: string; challengeInk: number | null }

/** Längster Code, der als QR-Code (Byte-Modus, Fehlerkorrektur M) noch gut scanbar ist. */
export const SHARE_MAX_CODE = 1500;

export class ShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShareError';
  }
}

const BROKEN = 'Dieser Link ist kaputt oder unvollständig';
const NEWER = 'Dieser Link braucht eine neuere Version – lade die Seite neu';
const HINT_ICONS: Hint['icon'][] = ['move', 'jump', 'station', 'draw', 'launch', 'chimney'];

const i = (n: number): number => Math.round(n);
const f3 = (n: number): number => Math.round(n * 1000) / 1000;
const R = (r: Rect): number[] => [i(r.x), i(r.y), i(r.w), i(r.h)];
const budget = (b: number | 'unlimited'): number => (b === 'unlimited' ? -1 : i(b));

function pathOut(p: MotionPath): unknown[] {
  const tail = [f3(p.period), f3(p.phase ?? 0)];
  if (p.type === 'pendulum') return [0, i(p.pivot.x), i(p.pivot.y), i(p.length), f3(p.amplitude), ...tail];
  if (p.type === 'circle') return [1, i(p.center.x), i(p.center.y), i(p.radius), ...tail];
  return [2, i(p.from.x), i(p.from.y), i(p.to.x), i(p.to.y), ...tail];
}

/** Kompaktes Objekt mit Kurzschlüsseln; leere Listen fallen weg. */
function compact(p: SharePayload): Record<string, unknown> {
  const l = p.level;
  const o: Record<string, unknown> = {
    n: l.name, i: l.id, W: i(l.worldW), H: i(l.worldH), s: [i(l.spawn.x), i(l.spawn.y)], c: [i(l.chimney.x), i(l.chimney.y)],
    t: [i(l.theme.seed), i(l.theme.auroraHue)], a: l.areas.map((a) => [budget(a.ink), budget(a.boost)]),
    p: l.platforms.map((x) => [...R(x), x.ice ? 1 : 0]),
    st: l.stations.map((x) => [i(x.pos.x), i(x.pos.y)]),
    g: l.gifts.map((x) => [i(x.x), i(x.y)]),
  };
  const opt = (k: string, v: unknown[]): void => { if (v.length) o[k] = v; };
  opt('d', l.dismounts.map(R));
  opt('k', l.checkpoints.map((x) => [i(x.x), i(x.y)]));
  opt('ic', l.icicles.map((x) => [i(x.x), i(x.y), i(x.h)]));
  opt('ca', l.candies.map((x) => [i(x.x), i(x.y), i(x.h)]));
  opt('hz', l.hazards.map((h) => [h.kind === 'tinsel' ? 1 : 0, ...R(h.rect)]));
  opt('mv', l.movers.map((m) => [m.kind === 'crow' ? 1 : 0, i(m.radius), ...pathOut(m.path)]));
  opt('sp', l.springs.map((s) => [i(s.pos.x), i(s.pos.y), Math.round(s.angle * 10) / 10, i(s.power)]));
  opt('nd', l.noDraw.map(R));
  opt('h', l.hints.map((h) => [...R(h.at), h.text, Math.max(0, HINT_ICONS.indexOf(h.icon))]));
  if (p.from) o.f = p.from;
  if (p.challengeInk !== null) o.r = i(p.challengeInk);
  return o;
}

type A = number[];
const rect = (a: A): Rect => ({ x: a[0], y: a[1], w: a[2], h: a[3] });
const arr = (v: unknown): A[] => (Array.isArray(v) ? (v as A[]) : []);

function pathIn(a: A): MotionPath {
  const [t, ...r] = a;
  if (t === 0) return { type: 'pendulum', pivot: { x: r[0], y: r[1] }, length: r[2], amplitude: r[3], period: r[4], phase: r[5] };
  if (t === 1) return { type: 'circle', center: { x: r[0], y: r[1] }, radius: r[2], period: r[3], phase: r[4] };
  return { type: 'line', from: { x: r[0], y: r[1] }, to: { x: r[2], y: r[3] }, period: r[4], phase: r[5] };
}

function expand(o: Record<string, unknown>): { raw: unknown; from: string; challengeInk: number | null } {
  const v = (k: string): A => (Array.isArray(o[k]) ? (o[k] as A) : []);
  const raw = {
    version: 1, id: o.i, name: o.n, worldW: o.W, worldH: o.H,
    spawn: { x: v('s')[0], y: v('s')[1] }, chimney: { x: v('c')[0], y: v('c')[1] },
    theme: { seed: v('t')[0], auroraHue: v('t')[1] },
    areas: arr(o.a).map((a) => ({ ink: a[0] === -1 ? 'unlimited' : a[0], boost: a[1] === -1 ? 'unlimited' : a[1] })),
    platforms: arr(o.p).map((a) => ({ ...rect(a), ice: a[4] === 1 })),
    stations: arr(o.st).map((a) => ({ pos: { x: a[0], y: a[1] } })),
    gifts: arr(o.g).map((a) => ({ x: a[0], y: a[1] })),
    dismounts: arr(o.d).map(rect),
    checkpoints: arr(o.k).map((a) => ({ x: a[0], y: a[1] })),
    icicles: arr(o.ic).map((a) => ({ x: a[0], y: a[1], h: a[2] })),
    candies: arr(o.ca).map((a) => ({ x: a[0], y: a[1], h: a[2] })),
    hazards: arr(o.hz).map((a) => ({ kind: a[0] === 1 ? 'tinsel' : 'icicle-hanging', rect: rect(a.slice(1)) })),
    movers: arr(o.mv).map((a) => ({ kind: a[0] === 1 ? 'crow' : 'bell', radius: a[1], path: pathIn(a.slice(2)) })),
    springs: arr(o.sp).map((a) => ({ pos: { x: a[0], y: a[1] }, angle: a[2], power: a[3] })),
    noDraw: arr(o.nd).map(rect),
    hints: arr(o.h).map((a) => ({ at: rect(a), text: (a as unknown[])[4], icon: HINT_ICONS[a[5]] ?? 'move' })),
  };
  return { raw, from: typeof o.f === 'string' ? o.f.slice(0, 20) : '', challengeInk: typeof o.r === 'number' && Number.isFinite(o.r) ? o.r : null };
}

// ------------------------------------------------------------ Bytes ↔ Text

function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (let k = 0; k < bytes.length; k++) s += String.fromCharCode(bytes[k]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new ShareError(BROKEN);
  const b = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let k = 0; k < b.length; k++) out[k] = b.charCodeAt(k);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

// ------------------------------------------------------------ Öffentlich

export async function encodeShare(p: SharePayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(compact(p)));
  if (typeof CompressionStream === 'function') {
    try {
      return '1' + toB64url(await pipe(bytes, new CompressionStream('deflate-raw')));
    } catch { /* Rückfall unten */ }
  }
  return '0' + toB64url(bytes);
}

export async function decodeShare(code: string): Promise<SharePayload> {
  const kind = code[0];
  if (kind === undefined) throw new ShareError(BROKEN);
  if (/[2-9]/.test(kind)) throw new ShareError(NEWER);
  if (kind !== '0' && kind !== '1') throw new ShareError(BROKEN);
  let obj: unknown;
  try {
    let bytes = fromB64url(code.slice(1));
    if (kind === '1') {
      if (typeof DecompressionStream !== 'function') throw new ShareError(NEWER);
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    }
    obj = JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    throw e instanceof ShareError ? e : new ShareError(BROKEN);
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new ShareError(BROKEN);
  const { raw, from, challengeInk } = expand(obj as Record<string, unknown>);
  try {
    return { level: validateLevel(raw, 'Link'), from, challengeInk };
  } catch (e) {
    throw new ShareError(e instanceof LevelError ? `${BROKEN} (${e.message})` : BROKEN);
  }
}

export function shareUrl(code: string, base = `${location.origin}${location.pathname}`): string {
  return `${base}#l=${code}`;
}

export function readShareHash(hash: string): string | null {
  const m = /^#l=(.+)$/.exec(hash);
  return m ? m[1] : null;
}
