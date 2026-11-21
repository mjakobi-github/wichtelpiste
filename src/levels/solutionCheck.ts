import type { LevelData } from '../sim/types';
import { runArea, type Solution } from './solveRunner';

export interface AreaCheck { ok: boolean; reason: string | null; inkUsed: number; boostUsed: number }
export interface SolutionCheck { ok: boolean; areas: AreaCheck[] }

const CRASH: Record<string, string> = {
  fall: 'Schlitten stürzt ab',
  hazard: 'Gefahr getroffen',
  stall: 'Schlitten kommt nicht weiter',
  stuck: 'festgefahren',
  missed: 'Landezone verfehlt',
};

/** Länge einer Polylinie in Weltpixeln. */
export function strokeLength(pts: readonly (readonly [number, number])[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

/**
 * Fährt die Lösung jedes Abschnitts ab (wie der Lösbarkeitstest): ok heißt keine Zeichenprobleme,
 * Budget eingehalten, Ankunft in der Landezone bzw. Sieg am Schornstein.
 */
export function checkSolution(level: LevelData, sol: Solution | null): SolutionCheck {
  const areas = level.areas.map((_, area): AreaCheck => {
    const strokes = sol?.areas[area]?.strokes ?? [];
    const inkUsed = strokes.filter((s) => !s.boost).reduce((a, s) => a + strokeLength(s.pts), 0);
    const boostUsed = strokes.filter((s) => s.boost).reduce((a, s) => a + strokeLength(s.pts), 0);
    const fail = (why: string): AreaCheck => ({ ok: false, reason: `Abschnitt ${area + 1}: ${why}`, inkUsed, boostUsed });
    if (!sol || strokes.length === 0) return fail('keine Lösung – probespielen und schaffen');
    const r = runArea(level, sol, area);
    if (r.drawProblems.some((e) => e.type === 'inkEmpty')) return fail('zu wenig Tinte');
    if (r.drawProblems.length > 0) return fail('Linie in einer Zeichenverbot-Zone');
    for (const rest of [r.remaining.ink, r.remaining.boost]) if (rest !== 'unlimited' && rest < 0) return fail('zu wenig Tinte');
    const want = level.dismounts[area] ? 'arrive' : 'win';
    const o = r.outcome;
    if (!o) return fail('Fahrt endet nicht');
    if (o.type === 'crash') return fail(CRASH[o.cause] ?? 'Unfall');
    if (o.type !== want) return fail(want === 'win' ? 'erreicht den Schornstein nicht' : 'kommt nicht in der Landezone an');
    return { ok: true, reason: null, inkUsed, boostUsed };
  });
  return { ok: areas.length > 0 && areas.every((a) => a.ok), areas };
}
