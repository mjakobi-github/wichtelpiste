import { describe, expect, it } from 'vitest';
import { levelIssues, suggestBudgets } from './checks';
import { newLevel } from './template';

describe('levelIssues', () => {
  it('Vorlage ohne Fehler', () => {
    expect(levelIssues(newLevel()).filter((i) => i.level === 'error')).toEqual([]);
  });
  it('kein Geschenk → Fehler aus dem Format', () => {
    const is = levelIssues({ ...newLevel(), gifts: [] });
    expect(is.some((i) => i.level === 'error' && i.text.includes('Geschenk'))).toBe(true);
  });
  it('Element außerhalb der Welt → Warnung mit Ref', () => {
    const l = newLevel();
    const is = levelIssues({ ...l, platforms: [...l.platforms, { x: l.worldW + 10, y: 100, w: 50, h: 20, ice: false }] });
    const w = is.find((i) => i.level === 'warning' && i.ref?.kind === 'platform');
    expect(w?.ref?.index).toBe(2);
  });
  it('zwei Landezonen bei einer Station → Fehler', () => {
    const l = newLevel();
    expect(levelIssues({ ...l, dismounts: [...l.dismounts, { x: 0, y: 0, w: 50, h: 50 }] }).some((i) => i.level === 'error')).toBe(true);
  });
  it('Startpunkt in der Luft → Warnung', () => {
    expect(levelIssues({ ...newLevel(), spawn: { x: 1000, y: 100 } }).some((i) => i.ref?.kind === 'spawn')).toBe(true);
  });
});

describe('suggestBudgets', () => {
  const chk = (inkUsed: number, boostUsed = 0) => ({ ok: true, reason: null, inkUsed, boostUsed });
  it('1,5 × verbraucht, auf 50 aufgerundet', () => {
    const l = newLevel();
    expect(suggestBudgets(l, [chk(701)])[0]).toEqual({ ink: 1100, boost: 0 });
  });
  it('unbegrenzt bleibt unbegrenzt', () => {
    const l = { ...newLevel(), areas: [{ ink: 'unlimited' as const, boost: 'unlimited' as const }] };
    expect(suggestBudgets(l, [chk(500, 100)])[0]).toEqual({ ink: 'unlimited', boost: 'unlimited' });
  });
  it('Speedtinte nur bei Verbrauch', () => {
    const l = { ...newLevel(), areas: [{ ink: 500, boost: 300 }] };
    expect(suggestBudgets(l, [chk(100, 0)])[0].boost).toBe(300);
    expect(suggestBudgets(l, [chk(100, 100)])[0].boost).toBe(150);
  });
  it('fehlende Prüfung → Abschnitt unverändert', () => {
    expect(suggestBudgets(newLevel(), [])[0]).toEqual(newLevel().areas[0]);
  });
});
