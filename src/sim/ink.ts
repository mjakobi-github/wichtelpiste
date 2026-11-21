import type { Area, Budget, Rect, Segment, Vec2 } from './types';
import { dist, pointInRect, segmentIntersectsRect } from './geometry';

/** Ein gezeichneter Strich (Polylinie). Zeichenrichtung = Reihenfolge der Punkte. */
export interface Stroke { id: number; area: number; boost: boolean; pts: Vec2[] }

export const INK_TUNING = {
  /** Mindestabstand zwischen zwei Punkten eines Strichs */
  minStep: 6,
  /** Ramer-Douglas-Peucker-Toleranz beim Beenden eines Strichs */
  simplifyEpsilon: 1.5,
  eraseRadius: 18,
} as const;

/**
 * Striche und Tintenbudgets je Schlitten-Abschnitt.
 * Invariante je Pool: Länge aller Striche des Abschnitts + Rest = Budget.
 */
export class Ink {
  private list: Stroke[] = [];
  private pools: { ink: Budget; boost: Budget }[];
  private active: Stroke | null = null;
  private nextId = 1;
  private segCache: Segment[] | null = null;

  constructor(areas: Area[], private readonly noDraw: Rect[]) {
    this.pools = areas.map((a) => ({ ink: a.ink, boost: a.boost }));
  }

  get strokes(): readonly Stroke[] {
    return this.list;
  }

  remaining(area: number, boost: boolean): Budget {
    const p = this.pools[area];
    if (!p) return 0;
    return boost ? p.boost : p.ink;
  }

  usedTotal(): number {
    return this.list.reduce((n, s) => n + polyLen(s.pts), 0);
  }

  begin(area: number, boost: boolean, p: Vec2): boolean {
    if (this.active) this.end();
    const rest = this.remaining(area, boost);
    if (rest !== 'unlimited' && rest <= 0) return false;
    if (this.noDraw.some((z) => pointInRect(p, z))) return false;
    this.active = { id: this.nextId++, area, boost, pts: [{ ...p }] };
    this.list.push(this.active);
    this.changed();
    return true;
  }

  extend(p: Vec2): 'ok' | 'empty' | 'blocked' {
    const s = this.active;
    if (!s) return 'blocked';
    const last = s.pts[s.pts.length - 1];
    const len = dist(last, p);
    if (len < INK_TUNING.minStep) return 'ok';
    if (this.noDraw.some((z) => segmentIntersectsRect(last, p, z))) {
      this.end();
      return 'blocked';
    }
    const rest = this.remaining(s.area, s.boost);
    if (rest === 'unlimited') {
      s.pts.push({ ...p });
      this.changed();
      return 'ok';
    }
    if (rest <= 0) return 'empty';
    if (len > rest) {
      const t = rest / len;
      s.pts.push({ x: last.x + (p.x - last.x) * t, y: last.y + (p.y - last.y) * t });
      this.spend(s.area, s.boost, rest);
      this.changed();
      return 'empty';
    }
    s.pts.push({ ...p });
    this.spend(s.area, s.boost, len);
    this.changed();
    return 'ok';
  }

  end(): void {
    const s = this.active;
    if (!s) return;
    this.active = null;
    if (s.pts.length < 2) {
      this.remove(s);
      return;
    }
    const before = polyLen(s.pts);
    const simple = simplify(s.pts, INK_TUNING.simplifyEpsilon);
    // Abkürzungen dürfen keine Zeichenverbot-Zone anschneiden
    const crosses = simple.some((q, i) => i > 0 && this.noDraw.some((z) => segmentIntersectsRect(simple[i - 1], q, z)));
    if (!crosses) {
      s.pts = simple;
      this.refund(s.area, s.boost, before - polyLen(simple));
    }
    this.changed();
  }

  eraseAt(area: number, p: Vec2): boolean {
    const r = INK_TUNING.eraseRadius;
    let any = false;
    const out: Stroke[] = [];
    for (const s of this.list) {
      if (s.area !== area || s === this.active) {
        out.push(s);
        continue;
      }
      const pieces: Vec2[][] = [];
      let cur: Vec2[] = [s.pts[0]];
      let removed = 0;
      for (let i = 1; i < s.pts.length; i++) {
        const a = s.pts[i - 1];
        const b = s.pts[i];
        const cut = circleInterval(a, b, p, r);
        if (!cut) {
          cur.push(b);
          continue;
        }
        const [t0, t1] = cut;
        const segLen = dist(a, b);
        removed += segLen * (t1 - t0);
        if (t0 > 0) cur.push(lerp(a, b, t0));
        if (cur.length >= 2) pieces.push(cur);
        cur = t1 < 1 ? [lerp(a, b, t1), b] : [b];
      }
      if (cur.length >= 2) pieces.push(cur);
      if (removed === 0) {
        out.push(s);
        continue;
      }
      any = true;
      // Splitter ohne Länge erstatten
      for (const pc of pieces) {
        if (polyLen(pc) < 0.5) {
          removed += polyLen(pc);
          continue;
        }
        out.push({ id: this.nextId++, area: s.area, boost: s.boost, pts: pc });
      }
      this.refund(s.area, s.boost, removed);
    }
    if (any) {
      this.list = out;
      this.changed();
    }
    return any;
  }

  undo(area: number): boolean {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      if (s.area !== area || s === this.active) continue;
      this.remove(s);
      this.refund(s.area, s.boost, polyLen(s.pts));
      return true;
    }
    return false;
  }

  clear(area: number): void {
    if (this.active?.area === area) this.end();
    for (const s of this.list.filter((x) => x.area === area)) {
      this.remove(s);
      this.refund(s.area, s.boost, polyLen(s.pts));
    }
  }

  segments(): Segment[] {
    if (!this.segCache) {
      const out: Segment[] = [];
      for (const s of this.list) {
        for (let i = 1; i < s.pts.length; i++) {
          const a = s.pts[i - 1];
          const b = s.pts[i];
          out.push(s.boost ? { ax: a.x, ay: a.y, bx: b.x, by: b.y, boost: true } : { ax: a.x, ay: a.y, bx: b.x, by: b.y });
        }
      }
      this.segCache = out;
    }
    return this.segCache;
  }

  private remove(s: Stroke): void {
    this.list = this.list.filter((x) => x !== s);
    this.changed();
  }

  private spend(area: number, boost: boolean, len: number): void {
    const p = this.pools[area];
    const key = boost ? 'boost' : 'ink';
    const v = p[key];
    if (v !== 'unlimited') p[key] = Math.max(0, v - len);
  }

  private refund(area: number, boost: boolean, len: number): void {
    const p = this.pools[area];
    const key = boost ? 'boost' : 'ink';
    const v = p[key];
    if (v !== 'unlimited') p[key] = v + len;
  }

  private changed(): void {
    this.segCache = null;
  }
}

function polyLen(pts: Vec2[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Parameterintervall [t0, t1] ⊂ [0, 1], in dem die Strecke a–b im Kreis liegt, oder null. */
function circleInterval(a: Vec2, b: Vec2, c: Vec2, r: number): [number, number] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - c.x;
  const fy = a.y - c.y;
  const A = dx * dx + dy * dy;
  if (A === 0) return null;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return null;
  const sq = Math.sqrt(disc);
  const t0 = Math.max(0, (-B - sq) / (2 * A));
  const t1 = Math.min(1, (-B + sq) / (2 * A));
  return t1 > t0 ? [t0, t1] : null;
}

/** Ramer-Douglas-Peucker. */
function simplify(pts: Vec2[], eps: number): Vec2[] {
  if (pts.length < 3) return pts.map((p) => ({ ...p }));
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop()!;
    const a = pts[i0];
    const b = pts[i1];
    let maxD = 0;
    let idx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = pointLineDist(pts[i], a, b);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = true;
      stack.push([i0, idx], [idx, i1]);
    }
  }
  return pts.filter((_, i) => keep[i]).map((p) => ({ ...p }));
}

function pointLineDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return dist(p, a);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}
