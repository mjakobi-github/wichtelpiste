import { describe, expect, it } from 'vitest';
import { GUIDE_URL, aiInstructions, aiLink, extractJson, feedbackText, parseAiReply, readAiHash } from './ai';
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

  it('mit Spieladresse: Chatbot soll zusätzlich einen #ki=-Link schicken', () => {
    const t = aiInstructions('', 'https://example.org/wichtelpiste/');
    expect(t).toContain('https://example.org/wichtelpiste/#ki=');
    expect(t).toContain('encodeURIComponent');
    expect(aiInstructions('')).not.toContain('#ki=');
  });

  it('Link aus dem Chatbot: hin und zurück, auch unsauber kodiert', () => {
    const l = newLevel();
    const url = aiLink('https://example.org/', l);
    const hash = url.slice(url.indexOf('#'));
    expect(parseAiReply(readAiHash(hash)!).name).toBe(l.name);
    // Chatbot kodiert nur teilweise, mit einem kaputten %-Rest
    const sloppy = '#ki=' + JSON.stringify(l).replace(/"/g, '%22') + '%';
    expect(parseAiReply(readAiHash(sloppy)!).name).toBe(l.name);
    expect(readAiHash('#l=abc')).toBeNull();
  });

  it('verweist auf die ausführliche Bauanleitung neben dem Spiel', () => {
    expect(aiInstructions('', 'https://example.org/wichtelpiste/')).toContain('https://example.org/wichtelpiste/ki-bauanleitung.md');
    expect(aiInstructions('', 'https://example.org/spiel/index.html')).toContain('https://example.org/spiel/ki-bauanleitung.md');
    // Lokal (Entwicklung, Einzeldatei) kann der Chatbot nichts abrufen: veröffentlichte Fassung
    expect(aiInstructions('', 'http://localhost:5173/')).toContain(`${GUIDE_URL}`);
    expect(aiInstructions('', 'file:///home/x/wichtelpiste.html')).toContain(`${GUIDE_URL}`);
    expect(aiInstructions('')).toContain(`${GUIDE_URL}`);
  });

  it('kennt reine Jump\'n\'Run- und reine Schlitten-Level und das Verhalten der Elemente', () => {
    const t = aiInstructions('');
    expect(t).toContain("Reines Jump'n'Run");
    expect(t).toContain('Reine Schlittenfahrt');
    expect(t).toMatch(/Elfe UND Schlitten/);
  });

  it('reines Jump\'n\'Run: fehlende stations/areas werden leere Listen', () => {
    const l = newLevel() as unknown as Record<string, unknown>;
    delete l.stations;
    delete l.areas;
    l.dismounts = [];
    const out = parseAiReply(reply(l));
    expect(out.stations).toEqual([]);
    expect(out.areas).toEqual([]);
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
