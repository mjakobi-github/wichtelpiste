import type { Area, LevelData } from '../sim/types';
import { runArea, type Solution } from './solveRunner';
import { checkSolution } from './solutionCheck';
import { solveArea } from './autoSolve';
import { footReach, type FootReport, type Ride } from './footReach';

export interface AreaVerdict {
  ok: boolean;
  /** Lösung vom Löser gefunden (nicht selbst gefahren) */
  auto: boolean;
  reason: string | null;
  inkUsed: number;
  boostUsed: number;
  /** Nur mit mehr Tinte lösbar: so viel bräuchte die gefundene Piste */
  needs: { ink: number; boost: number } | null;
}

export interface Verdict {
  /** Spielbar: Jeder Abschnitt kommt an und der Schornstein ist mit Geschenk erreichbar */
  playable: boolean;
  /** Alle Geschenke lassen sich einsammeln (jedes einzeln geprüft) */
  allGifts: boolean;
  /** Lösung (vorhandene, wo gültig, sonst die gefundene; mit mehr Tinte, wo nötig) */
  solution: Solution;
  areas: AreaVerdict[];
  foot: FootReport;
  /** Vorschlag mit genug Tinte, falls ein Abschnitt nur mit mehr Tinte geht */
  budgets: Area[] | null;
  problems: string[];
  warnings: string[];
}

/** Liegt das Geschenk auf einem Dach (dann holt man es zu Fuß)? */
const onGround = (l: LevelData, g: { x: number; y: number }): boolean =>
  l.platforms.some((p) => g.x >= p.x && g.x <= p.x + p.w && p.y - g.y >= 0 && p.y - g.y <= 60);

const pause = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const round50 = (n: number): number => Math.ceil(n / 50) * 50;
const at = (p: { x: number; y: number }): string => `(${Math.round(p.x)}, ${Math.round(p.y)})`;

/**
 * Prüft ein Level vollständig: Schlittenfahrten (vorhandene Lösung oder automatisch gesucht)
 * und Fußwege (Start → Stationen → Landezonen → Geschenke → Schornstein).
 */
export async function verifyLevel(l: LevelData, keep: Solution | null): Promise<Verdict> {
  const problems: string[] = [];
  const warnings: string[] = [];
  const existing = keep ? checkSolution(l, keep) : null;
  const areas: AreaVerdict[] = [];
  const strokes: Solution['areas'] = [];
  let needMore = false;
  for (let i = 0; i < l.areas.length; i++) {
    await pause();
    if (existing?.areas[i]?.ok && keep) {
      const a = existing.areas[i];
      areas.push({ ok: true, auto: false, reason: null, inkUsed: a.inkUsed, boostUsed: a.boostUsed, needs: null });
      strokes.push(keep.areas[i]);
      continue;
    }
    // Geschenke zwischen Station und Ziel möglichst mit der Piste einsammeln
    const st = l.stations[i].pos;
    const goal = l.dismounts[i] ?? { x: l.chimney.x, y: l.chimney.y, w: 0, h: 0 };
    const lo = Math.min(st.x, goal.x + goal.w / 2);
    const hi = Math.max(st.x, goal.x + goal.w / 2);
    const via = l.gifts.filter((g) => g.x > lo + 40 && g.x < hi - 40 && !onGround(l, g));
    const s = solveArea(l, i, { via });
    if (s.strokes) {
      areas.push({ ok: true, auto: true, reason: null, inkUsed: s.inkUsed, boostUsed: s.boostUsed, needs: null });
      strokes.push({ strokes: s.strokes });
      continue;
    }
    await pause();
    const u = solveArea(l, i, { unlimited: true });
    const target = l.dismounts[i] ? `Landezone ${i + 1}` : 'Schornstein';
    if (u.strokes) {
      needMore = true;
      const needs = { ink: Math.round(u.inkUsed), boost: Math.round(u.boostUsed) };
      const a = l.areas[i];
      const have = `${a.ink === 'unlimited' ? 'unbegrenzt' : a.ink} Tinte, ${a.boost === 'unlimited' ? 'unbegrenzt' : a.boost} Speedtinte`;
      problems.push(`Abschnitt ${i + 1} (Station ${i + 1} ${at(l.stations[i].pos)} → ${target}): Die Tinte reicht nicht. Eine Piste bräuchte etwa ${needs.ink} Tinte und ${needs.boost} Speedtinte, erlaubt sind ${have}.`);
      areas.push({ ok: false, auto: true, reason: 'zu wenig Tinte', inkUsed: u.inkUsed, boostUsed: u.boostUsed, needs });
      strokes.push({ strokes: u.strokes });
      continue;
    }
    problems.push(`Abschnitt ${i + 1} (Station ${i + 1} ${at(l.stations[i].pos)} → ${target}): Keine Piste gefunden, der ${s.reason ?? 'Schlitten kommt nicht an'}. Ziel näher, tiefer oder ohne Hindernisse dazwischen legen.`);
    areas.push({ ok: false, auto: true, reason: s.reason, inkUsed: 0, boostUsed: 0, needs: null });
    strokes.push({ strokes: [] });
  }
  const solution: Solution = { areas: strokes };

  // Fahrten mit der gefundenen Lösung (auch mit mehr Tinte), damit die Wegsuche weiterkommt
  const generous: LevelData = { ...l, areas: l.areas.map((a, i) => (areas[i].needs ? { ink: 'unlimited', boost: 'unlimited' } : a)) };
  const rides: (Ride | null)[] = l.areas.map((_, i) => {
    if (solution.areas[i].strokes.length === 0) return null;
    const r = runArea(generous, solution, i);
    const o = r.outcome;
    if (o?.type === 'arrive') return { arrive: o.pos, win: false, gifts: r.gifts };
    if (o?.type === 'win') return { arrive: null, win: true, gifts: r.gifts };
    return null;
  });
  await pause();
  const foot = footReach(l, rides);

  l.stations.forEach((s, i) => {
    if (!foot.stations[i]) problems.push(`Station ${i + 1} ${at(s.pos)} ist zu Fuß nicht erreichbar (zu hoch, zu weit oder hinter einer Gefahr).`);
  });
  if (!foot.chimney) problems.push(`Der Schornstein ${at(l.chimney)} ist nicht erreichbar.`);
  else if (!foot.winnable) problems.push('Man kann kein Geschenk einsammeln und danach noch zum Schornstein bringen.');
  l.gifts.forEach((g, i) => {
    if (foot.winnable && !foot.gifts[i]) warnings.push(`Geschenk ${i + 1} ${at(g)} kann man nicht einsammeln und danach noch abliefern – drei Sterne gehen so nicht.`);
  });
  if (foot.truncated) warnings.push('Das Level ist sehr groß, die Prüfung der Wege war nicht vollständig.');

  const budgets = needMore
    ? l.areas.map((a, i) => {
      const n = areas[i].needs;
      if (!n) return a;
      return {
        ink: a.ink === 'unlimited' ? a.ink : Math.max(a.ink, round50(1.3 * n.ink)),
        boost: a.boost === 'unlimited' ? a.boost : n.boost > 0 ? Math.max(a.boost, round50(1.3 * n.boost)) : a.boost,
      };
    })
    : null;

  const playable = areas.every((a) => a.ok) && foot.stations.every(Boolean) && foot.winnable;
  return { playable, allGifts: foot.gifts.every(Boolean), solution, areas, foot, budgets, problems, warnings };
}

/** Spielbar, sobald die vorgeschlagene Tinte übernommen wird? */
export function playableWithBudgets(v: Verdict): boolean {
  return !!v.budgets && v.areas.every((a) => a.ok || a.needs !== null) && v.foot.stations.every(Boolean) && v.foot.winnable;
}
