import type { LevelData } from '../sim/types';
import type { Solution } from '../levels/solveRunner';
import { checkSolution } from '../levels/solutionCheck';
import { decodeShare, encodeShare, type SharePayload } from './codec';

/**
 * Teilbar? Geprüft wird das Level so, wie es beim Empfänger ankommt (der Link rundet Werte),
 * mit der gemerkten eigenen Lösung.
 */
export async function shareableCheck(level: LevelData, solution: Solution | null, meta: { from: string; challengeInk: number | null }):
  Promise<{ ok: boolean; reason: string | null; payload: SharePayload; code: string }> {
  const code = await encodeShare({ level, ...meta });
  const payload = await decodeShare(code);
  const c = checkSolution(payload.level, solution);
  return { ok: c.ok, reason: c.ok ? null : c.areas.find((a) => !a.ok)?.reason ?? null, payload, code };
}
