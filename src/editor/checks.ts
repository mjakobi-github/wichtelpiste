import type { Area, LevelData, Rect } from '../sim/types';
import { LevelError, validateLevel } from '../levels/schema';
import type { AreaCheck } from '../levels/solutionCheck';
import { PLAYER_TUNING } from '../sim/player';
import { listElements, type ElementRef } from './doc';
import { elementBounds } from './handles';

export interface Issue { level: 'error' | 'warning'; text: string; ref: ElementRef | null }

const NAMES: Record<ElementRef['kind'], string> = {
  platform: 'Plattform', spawn: 'Startpunkt', station: 'Station', dismount: 'Landezone', gift: 'Geschenk',
  checkpoint: 'Laterne', chimney: 'Schornstein', icicle: 'Eiszapfen', candy: 'Zuckerstange', hazard: 'Gefahr',
  mover: 'Beweger', spring: 'Feder', noDraw: 'Zeichenverbot', hint: 'Hinweis',
};

export function elementName(ref: ElementRef): string {
  return NAMES[ref.kind];
}

const outside = (r: Rect, l: LevelData): boolean => r.x < 0 || r.y < -400 || r.x + r.w > l.worldW || r.y + r.h > l.worldH;

/** Fehler (Format) sperren Probespielen und Speichern, Warnungen nur zur Info. */
export function levelIssues(l: LevelData): Issue[] {
  const out: Issue[] = [];
  try {
    validateLevel(JSON.parse(JSON.stringify(l)), 'Level');
  } catch (e) {
    const text = e instanceof LevelError ? e.message.replace(/^Level: /, '') : String(e);
    out.push({ level: 'error', text, ref: null });
  }
  for (const ref of listElements(l)) {
    if (ref.kind === 'hint') continue;
    if (outside(elementBounds(l, ref), l)) out.push({ level: 'warning', text: `${elementName(ref)} liegt außerhalb der Welt`, ref });
  }
  const s = l.spawn;
  const cx = s.x + PLAYER_TUNING.size.w / 2;
  const feet = s.y + PLAYER_TUNING.size.h;
  const ground = l.platforms.some((p) => cx >= p.x && cx <= p.x + p.w && p.y >= feet - 5 && p.y <= feet + 400);
  if (!ground) out.push({ level: 'warning', text: 'Unter dem Startpunkt ist kein Boden', ref: { kind: 'spawn', index: 0 } });
  for (let i = 0; i < l.stations.length - 1; i++) {
    if (!l.dismounts[i]) out.push({ level: 'warning', text: `Station ${i + 1} hat keine Landezone (fährt direkt zum Schornstein)`, ref: { kind: 'station', index: i } });
  }
  return out;
}

const round50 = (n: number): number => Math.ceil(n / 50) * 50;

/** Tinte je Abschnitt = 1,5 × Lösung (auf 50 aufgerundet); Speedtinte nur, wenn welche benutzt wurde. */
export function suggestBudgets(l: LevelData, checks: readonly AreaCheck[]): Area[] {
  return l.areas.map((a, i) => {
    const c = checks[i];
    if (!c) return a;
    return {
      ink: a.ink === 'unlimited' ? a.ink : round50(1.5 * c.inkUsed),
      boost: a.boost === 'unlimited' || c.boostUsed <= 0 ? a.boost : round50(1.5 * c.boostUsed),
    };
  });
}
