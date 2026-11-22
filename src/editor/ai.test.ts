import { describe, expect, it } from 'vitest';
import { aiInstructions, extractJson, feedbackText, parseAiReply } from './ai';
import { newLevel } from './template';
import { verifyLevel } from '../levels/verify';

const reply = (obj: unknown): string => `Hier ist dein Level!\n\n\`\`\`json\n${JSON.stringify(obj, null, 2)}\n\`\`\`\n\nViel Spaß!`;

describe('Mit KI bauen', () => {
  it('Anleitung enthält Wunsch, Beispiel und Sprungwerte', () => {
    const t = aiInstructions('Viele Federn');
    expect(t).toContain('Viele Federn');
    expect(t).toContain('"zwei-daecher"');
    expect(t).toMatch(/bis \d{3} px hoch/);
  });

  it('ohne Wunsch: Standardtext', () => {
    expect(aiInstructions('  ')).toContain('Denk dir selbst');
  });

  it('JSON aus Codeblock, aus Fließtext, sonst Fehler', () => {
    expect(JSON.parse(extractJson(reply({ a: 1 })))).toEqual({ a: 1 });
    expect(JSON.parse(extractJson('Klar: {"a": {"b": 2}} fertig'))).toEqual({ a: { b: 2 } });
    expect(() => extractJson('Leider nein')).toThrow(/kein JSON/);
  });

  it('ergänzt Kleinigkeiten (version, id, leere Listen, theme)', () => {
    const l = newLevel() as unknown as Record<string, unknown>;
    for (const k of ['version', 'id', 'theme', 'hints', 'movers', 'noDraw', 'checkpoints']) delete l[k];
    l.name = 'Schöne Grüße';
    const out = parseAiReply(reply(l));
    expect(out.version).toBe(1);
    expect(out.id).toBe('schoene-gruesse');
    expect(out.movers).toEqual([]);
  });

  it('nimmt auch eine Export-Datei', () => {
    const l = newLevel();
    expect(parseAiReply(JSON.stringify({ format: 'wichtelpiste-level', version: 1, level: l, solution: null })).name).toBe(l.name);
  });

  it('Formatfehler mit Feldpfad', () => {
    const l = newLevel() as unknown as Record<string, unknown>;
    l.stations = [{ pos: { x: 'links', y: 3 } }];
    expect(() => parseAiReply(reply(l))).toThrow('Formatfehler: stations[0].pos.x muss eine Zahl sein');
  });

  it('kaputtes JSON', () => {
    expect(() => parseAiReply('```json\n{ "a": 1, }\n```')).toThrow(/JSON ist kaputt/);
  });

  it('Rückmeldung: Probleme und Bitte um Korrektur', async () => {
    const l = newLevel();
    l.chimney = { x: 2200, y: 100 };
    const v = await verifyLevel(l, null);
    const t = feedbackText(l.name, { verdict: v, issues: ['Unter dem Startpunkt ist kein Boden'] });
    expect(t).toContain('NICHT spielbar');
    expect(t).toContain('Schornstein');
    expect(t).toContain('Unter dem Startpunkt ist kein Boden');
    expect(t).toContain('JSON-Codeblock');
    expect(feedbackText('X', { error: 'Formatfehler: y' })).toContain('- Formatfehler: y');
  });
});
