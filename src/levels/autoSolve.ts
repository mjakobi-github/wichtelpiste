import type { Area, LevelData, Platform, Rect, Vec2 } from '../sim/types';
import { chimneyZone } from '../sim/elements';
import { segmentIntersectsRect } from '../sim/geometry';
import { runArea, type Solution } from './solveRunner';
import { checkSolution, strokeLength } from './solutionCheck';

type Pts = [number, number][];
type Strokes = Solution['areas'][number]['strokes'];

export interface AreaSolve {
  /** Gefundene Striche oder null */
  strokes: Strokes | null;
  inkUsed: number;
  boostUsed: number;
  /** Häufigster Grund des Scheiterns (für die Rückmeldung) */
  reason: string | null;
  tried: number;
}

export interface SolveOptions {
  /** Höchstens so viele Fahrten je Abschnitt simulieren */
  maxTries?: number;
  /** Budget ignorieren (um herauszufinden, wie viel Tinte nötig wäre) */
  unlimited?: boolean;
  /** Diese Punkte (Geschenke auf der Strecke) möglichst mitnehmen: Pisten durch sie zuerst probieren */
  via?: readonly Vec2[];
}

/** Plattform direkt unter einem Punkt (oberste, deren Dach darunter liegt). */
export function groundBelow(l: LevelData, p: Vec2, maxDrop = 400): Platform | null {
  let best: Platform | null = null;
  for (const q of l.platforms) {
    if (p.x < q.x || p.x > q.x + q.w || q.y < p.y - 2 || q.y > p.y + maxDrop) continue;
    if (!best || q.y < best.y) best = q;
  }
  return best;
}

/** Ziel des Abschnitts: Landezone oder Lieferzone am Schornstein. */
export function targetRect(l: LevelData, area: number): Rect {
  return l.dismounts[area] ?? chimneyZone(l.chimney);
}

const r = (n: number): number => Math.round(n);

/** Quadratische Bézierkurve a → c → b, Punkte ≥ 8 px auseinander. */
function bezier(a: Vec2, c: Vec2, b: Vec2): Pts {
  const len = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y);
  const n = Math.max(2, Math.min(40, Math.ceil(len / 40)));
  const out: Pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
    const y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
    const last = out[out.length - 1];
    if (!last || Math.hypot(x - last[0], y - last[1]) >= 8 || i === n) out.push([r(x), r(y)]);
  }
  return out;
}

/** Schneidet die Linie vor der ersten Zeichenverbot-Zone ab (ergibt eine Schanze). */
function cutAtNoDraw(pts: Pts, zones: readonly Rect[]): Pts {
  if (zones.length === 0) return pts;
  const inside = (p: [number, number]): boolean => zones.some((z) => p[0] >= z.x && p[0] <= z.x + z.w && p[1] >= z.y && p[1] <= z.y + z.h);
  if (inside(pts[0])) return [];
  for (let i = 1; i < pts.length; i++) {
    const a = { x: pts[i - 1][0], y: pts[i - 1][1] };
    const b = { x: pts[i][0], y: pts[i][1] };
    if (zones.some((z) => segmentIntersectsRect(a, b, z))) return pts.slice(0, i);
  }
  return pts;
}

/** Nur das Stück bis zum Anteil f der Länge (Rest fliegt der Schlitten). */
function truncate(pts: Pts, f: number): Pts {
  if (f >= 1) return pts;
  const total = strokeLength(pts);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc >= total * f) return pts.slice(0, i + 1);
  }
  return pts;
}

interface Candidate { strokes: Strokes; ink: number; boost: number; via: boolean }

/**
 * Erzeugt Kandidaten-Pisten von der Station zum Ziel, billigste zuerst:
 * - direkt: Kurven mit verschiedenem Durchhang, auch verkürzt (Schanze), mit und ohne Speedtinte
 * - über eine Sprungfeder: Piste bis zur Feder, den Rest erledigt sie
 * - über ein Zeichenverbot: Schanze davor, Landepiste dahinter
 */
function candidates(l: LevelData, area: number, budget: Area, via: readonly Vec2[]): Candidate[] {
  const st = l.stations[area].pos;
  const zone = targetRect(l, area);
  const dir = zone.x + zone.w / 2 >= st.x ? 1 : -1;
  const ground = groundBelow(l, st);
  const starts: Vec2[] = [{ x: st.x - dir * 25, y: st.y + 12 }];
  if (ground) {
    // Von der Dachkante aus weiterzeichnen (der Schlitten rollt erst übers Dach)
    const edge = dir > 0 ? ground.x + ground.w : ground.x;
    if (Math.abs(edge - st.x) < 900) starts.push({ x: edge - dir * 2, y: ground.y + 1 });
  }
  const tGround = groundBelow(l, { x: zone.x + zone.w / 2, y: zone.y }, zone.h + 40);
  const floorY = Math.min(zone.y + zone.h - 6, tGround ? tGround.y - 1 : zone.y + zone.h - 6);
  // An der vorderen Kante knapp über bzw. unter der Dachhöhe enden (so gleitet der Schlitten über die Ecke)
  const near = dir > 0 ? zone.x : zone.x + zone.w;
  const ends: Vec2[] = [{ x: near - dir * 2, y: floorY + 3 }, { x: near + dir * 6, y: floorY - 3 }];
  ends.push(...[0.15, 0.5, 0.85].map((f) => ({ x: zone.x + zone.w * f, y: floorY })));
  ends.push({ x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 });
  const useBoost = budget.boost === 'unlimited' || budget.boost > 0;
  const fits = (len: number, b: Area['ink']): boolean => b === 'unlimited' || len <= b;
  const crossesNoDraw = (pts: Pts): boolean => cutAtNoDraw(pts, l.noDraw).length !== pts.length;
  const out: Candidate[] = [];
  const add = (strokes: Strokes, isVia = false): void => {
    if (strokes.some((s) => s.pts.length < 2 || crossesNoDraw(s.pts))) return;
    const ink = strokes.filter((s) => !s.boost).reduce((n, s) => n + strokeLength(s.pts), 0);
    const boost = strokes.filter((s) => s.boost).reduce((n, s) => n + strokeLength(s.pts), 0);
    if (ink + boost < 10 || !fits(ink, budget.ink) || !fits(boost, budget.boost)) return;
    out.push({ strokes, ink, boost, via: isVia });
  };
  const ctrl = (a: Vec2, b: Vec2, sag: number): Vec2 =>
    ({ x: (a.x + b.x) / 2, y: sag >= 0 ? Math.max(a.y, b.y) + sag : (a.y + b.y) / 2 + sag });

  // 1) Direkt zum Ziel
  for (const a of starts) {
    for (const b of ends) {
      if (dir * (b.x - a.x) < 20) continue;
      for (const sag of [0, 60, 140, 260, 420, 640, -80, -180]) {
        for (const f of [1, 0.75, 0.55]) {
          const pts = cutAtNoDraw(truncate(bezier(a, ctrl(a, b, sag), b), f), l.noDraw);
          add([{ boost: false, pts }]);
          if (!useBoost || pts.length < 2) continue;
          add([{ boost: true, pts }]);
          // Nur das letzte Stück mit Speedtinte (bergauf zum Ziel)
          const k = Math.max(1, Math.floor(pts.length * 0.6));
          add([{ boost: false, pts: pts.slice(0, k + 1) }, { boost: true, pts: pts.slice(k) }]);
        }
      }
    }
  }

  // 2) Über eine Sprungfeder
  const tx = zone.x + zone.w / 2;
  for (const s of l.springs) {
    for (const a of starts) {
      if (dir * (s.pos.x - a.x) < 40 || dir * (tx - s.pos.x) < -300) continue;
      for (const b of [{ x: s.pos.x - dir * 28, y: s.pos.y - 1 }, { x: s.pos.x, y: s.pos.y - 6 }]) {
        for (const sag of [0, 60, 140, 260, -80]) add([{ boost: false, pts: bezier(a, ctrl(a, b, sag), b) }]);
      }
    }
  }

  // 3) Über ein Zeichenverbot springen: Schanze davor, Landepiste dahinter
  for (const a of starts) {
    const between = l.noDraw
      .filter((z) => (dir > 0 ? z.x > a.x && z.x < tx : z.x + z.w < a.x && z.x + z.w > tx))
      .sort((p, q) => dir * (p.x - q.x));
    const z = between[0];
    if (!z) continue;
    const kx = dir > 0 ? z.x - 10 : z.x + z.w + 10;
    const lx = dir > 0 ? z.x + z.w + 10 : z.x - 10;
    for (const drop of [100, 200, 320]) {
      for (const dip of [60, 140, 240]) {
        const k = { x: kx, y: a.y + drop };
        const ramp = bezier(a, { x: (a.x + kx) / 2, y: k.y + dip }, k);
        for (const land of [40, 120, 220, 340]) {
          const L = { x: lx, y: k.y + land };
          for (const b of ends.slice(0, 2)) {
            if (dir * (b.x - L.x) < 20) continue;
            for (const sag of [0, 60, 160]) add([{ boost: false, pts: ramp }, { boost: false, pts: bezier(L, ctrl(L, b, sag), b) }]);
          }
        }
      }
    }
  }

  // 4) Durch ein Geschenk auf der Strecke (Kurve geht bei der Hälfte durch den Punkt)
  for (const g of via) {
    for (const a of starts) {
      for (const b of ends.slice(0, 4)) {
        if (dir * (g.x - a.x) < 30 || dir * (b.x - g.x) < 30) continue;
        for (const dy of [0, 12]) {
          const p = { x: g.x, y: g.y + dy };
          const c = { x: 2 * p.x - (a.x + b.x) / 2, y: 2 * p.y - (a.y + b.y) / 2 };
          for (const f of [1, 0.75]) add([{ boost: false, pts: cutAtNoDraw(truncate(bezier(a, c, b), f), l.noDraw) }], true);
        }
      }
    }
  }

  // Durch Geschenke zuerst, sonst billigste zuerst (Speedtinte zählt doppelt, sie ist knapper)
  const cost = (x: Candidate): number => x.ink + 2 * x.boost + (x.via ? 0 : 1e6);
  return out.sort((x, y) => cost(x) - cost(y));
}

const CRASH: Record<string, string> = {
  fall: 'stürzt ab', hazard: 'trifft eine Gefahr', stall: 'kommt nicht weiter', stuck: 'bleibt stecken', missed: 'fliegt an der Landezone vorbei',
};

/** Sucht für einen Abschnitt eine Piste, die mit dem Budget ankommt. */
export function solveArea(l: LevelData, area: number, opts: SolveOptions = {}): AreaSolve {
  const maxTries = opts.maxTries ?? 700;
  const level: LevelData = opts.unlimited
    ? { ...l, areas: l.areas.map((a, i) => (i === area ? { ink: 'unlimited', boost: 'unlimited' } : a)) }
    : l;
  const budget = level.areas[area];
  const want = l.dismounts[area] ? 'arrive' : 'win';
  const reasons = new Map<string, number>();
  let tried = 0;
  for (const c of candidates(level, area, budget, opts.via ?? [])) {
    if (tried >= maxTries) break;
    tried++;
    const sol: Solution = { areas: level.areas.map((_, i) => ({ strokes: i === area ? c.strokes : [] })) };
    const run = runArea(level, sol, area);
    if (run.drawProblems.length > 0) { reasons.set('Zeichenverbot', (reasons.get('Zeichenverbot') ?? 0) + 1); continue; }
    const o = run.outcome;
    if (o && o.type === want) {
      return { strokes: c.strokes, inkUsed: c.ink, boostUsed: c.boost, reason: null, tried };
    }
    const why = !o ? 'Fahrt endet nicht' : o.type === 'crash' ? CRASH[o.cause] ?? 'Unfall' : 'verfehlt das Ziel';
    reasons.set(why, (reasons.get(why) ?? 0) + 1);
  }
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0];
  return { strokes: null, inkUsed: 0, boostUsed: 0, reason: tried === 0 ? 'keine Piste passt ins Tintenbudget' : `Schlitten ${top?.[0] ?? 'kommt nicht an'}`, tried };
}

/** Löst alle Abschnitte, die `keep` noch nicht schafft; gültige vorhandene Lösungen bleiben. */
export function autoSolve(l: LevelData, keep: Solution | null, opts: SolveOptions = {}): { solution: Solution; areas: AreaSolve[] } {
  const existing = keep ? checkSolution(l, keep) : null;
  const areas = l.areas.map((_, i): AreaSolve => {
    if (existing?.areas[i]?.ok && keep) {
      const a = existing.areas[i];
      return { strokes: keep.areas[i].strokes, inkUsed: a.inkUsed, boostUsed: a.boostUsed, reason: null, tried: 0 };
    }
    return solveArea(l, i, opts);
  });
  return { solution: { areas: areas.map((a) => ({ strokes: a.strokes ?? [] })) }, areas };
}
