import type { LevelData } from '../sim/types';
import { LevelError, validateLevel } from '../levels/schema';
import type { Verdict } from '../levels/verify';
import { jumpStats } from './jumpReach';
import example from '../levels/03-zwei-daecher.json';

/**
 * Bauen mit einem Chatbot (ChatGPT, Claude, …): Anleitung zum Kopieren, Antwort einlesen,
 * Rückmeldung des Spiels als Text zurück an den Chatbot.
 */

const compact = (v: unknown): string => JSON.stringify(v);

/** Präfix in der Adresse für Level, die der Chatbot als Link schickt. */
const KI_HASH = '#ki=';

/** Link, den der Chatbot bauen soll: Seite + #ki= + kompaktes, URL-kodiertes JSON. */
export function aiLink(base: string, level: unknown): string {
  return `${base}${KI_HASH}${encodeURIComponent(JSON.stringify(level))}`;
}

/** #ki=… aus der Adresse lesen; Chatbots kodieren nicht immer sauber, daher nachsichtig. */
export function readAiHash(hash: string): string | null {
  if (!hash.startsWith(KI_HASH)) return null;
  const raw = hash.slice(KI_HASH.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    // Einzelne kaputte %-Folgen: nur gültige ersetzen
    return raw.replace(/%[0-9A-Fa-f]{2}/g, (m) => { try { return decodeURIComponent(m); } catch { return m; } });
  }
}

/**
 * Anleitung, die man dem Chatbot gibt. idea = Wunsch des Kindes/der Familie (optional).
 * linkBase = Adresse des Spiels; dann soll der Chatbot zusätzlich einen Link zum Antippen schicken.
 */
export function aiInstructions(idea: string, linkBase?: string): string {
  const j = jumpStats(false);
  const jumpH = Math.floor(j.height / 10) * 10;
  const jumpW = Math.floor(j.distanceSameLevel / 10) * 10;
  const wish = idea.trim() || 'Denk dir selbst etwas Schönes aus, nicht zu schwer.';
  const answer = linkBase
    ? `Antworte mit genau einem JSON-Codeblock (\`\`\`json … \`\`\`) und darunter EINER Zeile mit einem Link zum Antippen, sonst nichts. Der Link ist ${linkBase}${KI_HASH} gefolgt von demselben JSON, kompakt ohne Leerzeichen und URL-kodiert wie encodeURIComponent (z. B. { → %7B, " → %22, : → %3A, , → %2C). Schreib ihn als Markdown-Link: [Level im Spiel prüfen](${linkBase}${KI_HASH}…)`
    : 'Antworte NUR mit einem einzigen JSON-Codeblock (```json … ```), ohne Text davor oder danach.';
  return `Du baust ein Level für „Wichtelpiste“, ein 2D-Weihnachtsspiel im Browser. ${answer}

## Das Spiel
Eine Elfe läuft und springt (Jump'n'Run), sammelt Geschenke und bringt sie zum Schornstein. Lücken überwindet sie im Schlitten: An einer Station steigt sie automatisch ein, der Spieler zeichnet eine Piste (Linie), der Schlitten rutscht darauf mit Schwerkraft los und muss in der grünen Landezone dieses Abschnitts ankommen. Dort steigt die Elfe aus und läuft weiter. Ohne Landezone fährt der letzte Abschnitt direkt zum Schornstein.

## Koordinaten und Maße
- Weltpixel, x nach rechts, y nach UNTEN (kleineres y = höher). Welt typisch 2400–5000 breit, 700–1300 hoch.
- Plattform {x,y,w,h}: x,y = linke obere Ecke, y = Dachhöhe. Ab h ≥ 50 wird sie als Haus gezeichnet, darunter als schmaler Balken (h 24).
- Elfe: 30 breit, 38 hoch. Sprung (voller Anlauf, gehalten): bis ${jumpH} px hoch, auf gleicher Höhe ${jumpW} px weit. Plane mit Reserve: Lücken zu Fuß höchstens 160 px, Stufen nach oben höchstens 130 px.
- Schlitten: rutscht nur bergab oder mit Schwung, kommt ohne Speedtinte nicht höher als die Station. Die Landezone sollte deshalb tiefer liegen als die Station (100–300 px) und 400–1100 px entfernt sein. Tinte = Länge der Linie in px.

## Felder (alle Pflicht, Listen dürfen leer sein)
- "version": 1, "id": kurzer-name-mit-bindestrichen, "name": Anzeigename (max. 30 Zeichen)
- "worldW", "worldH": Weltgröße
- "spawn": {x,y} Startpunkt der Elfe (linke obere Ecke): y = Dach darunter − 60
- "platforms": [{x,y,w,h,ice?}] Boden, Häuser, Balken. ice: true = rutschig
- "stations": [{pos:{x,y}, dir?}] Station steht auf einem Dach: pos.y = Dach − 60, mindestens 60 px von der Dachkante entfernt (in Fahrtrichtung). dir = Fahrtrichtung beim Losfahren: 1 = rechts, -1 = links; weglassen = zum Ziel hin. Nur angeben, wenn der Schlitten erst vom Ziel weg muss (z. B. zu einer Sprungfeder, die ihn zurückschleudert)
- "areas": [{ink, boost}] genau ein Eintrag je Station, gleiche Reihenfolge. ink = Tinte (z. B. 1000), boost = Speedtinte (0 oder z. B. 300; schiebt bergauf)
- "dismounts": [{x,y,w,h}] Landezone für Station i an Stelle i. Liegt auf einem Dach: y + h = Dachhöhe, w ≈ 240, h = 150. Höchstens so viele wie Stationen; der letzten Station darf sie fehlen (fährt dann zum Schornstein)
- "gifts": [{x,y}] Geschenke (mindestens eins), auf dem Boden: y = Dach − 25. Auch in der Luft über Lücken möglich (Schlitten sammelt mit ein)
- "chimney": {x,y} Schornstein, y = Dachhöhe (steht auf einem Dach)
- "checkpoints": [{x,y}] Laternen (Neustartpunkt), y = Dachhöhe
- "springs": [{pos:{x,y}, angle, power}] Sprungfeder, pos.y = Dachhöhe, angle in Grad (0 = senkrecht, 30 = schräg nach rechts), power 1200–1500
- "icicles", "candies": [{x,y,h}] harmlose feste Hindernisse (x = Mitte, y = Dachhöhe, h = 40–80)
- "hazards": [{kind:"icicle-hanging"|"tinsel", rect:{x,y,w,h}}] tödlich. tinsel z. B. als Boden einer Grube
- "movers": [{kind:"bell"|"crow", radius:18, path}] tödlich und bewegt; path: {type:"pendulum", pivot:{x,y}, length, amplitude (rad, z. B. 0.9), period (s)} oder {type:"line", from:{x,y}, to:{x,y}, period} oder {type:"circle", center:{x,y}, radius, period}
- "noDraw": [{x,y,w,h}] Zeichenverbot (dort keine Piste; der Schlitten muss drüberspringen)
- "theme": {seed: Zahl, auroraHue: 0–360} Landschaft und Farbe des Polarlichts
- "hints": [{at:{x,y,w,h}, text, icon:"move"|"jump"|"station"|"draw"|"launch"|"chimney"}] kurze Hinweise, solange die Elfe in "at" ist (optional)

## Regeln für ein gutes Level
- Weg: Start → zu Fuß zur Station 1 → Schlitten → Landezone 1 → zu Fuß weiter → … → Schornstein.
- Alles zu Fuß Nötige muss mit Sprüngen erreichbar sein; nichts liegt in der Luft, wo man nicht hinkommt.
- Zwischen Station und Landezone eine Lücke, die man zu Fuß NICHT schafft (sonst braucht man keinen Schlitten).
- Gefahren nicht direkt auf den einzigen Weg legen, ohne dass man drüber kann.
- Tinte großzügig: etwa 1,5 × die Entfernung Station → Landezone.

## Beispiel (2 Stationen)
\`\`\`json
${compact(example)}
\`\`\`

## Mein Wunsch
${wish}

Das Spiel prüft dein Level automatisch und schickt dir eventuell eine Rückmeldung. Dann korrigiere das Level und gib es wieder vollständig aus, in derselben Form wie oben.`;
}

/** Holt das JSON aus einer Chatbot-Antwort (Codeblock oder erstes {…}). */
export function extractJson(text: string): string {
  const fence = /```(?:json|JSON)?\s*\n?([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let best = '';
  while ((m = fence.exec(text))) if (m[1].includes('{') && m[1].length > best.length) best = m[1];
  if (best) return best.trim();
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('In der Antwort steht kein Level (kein JSON gefunden)');
  return text.slice(a, b + 1);
}

const slug = (s: string): string =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'ki-level';

/**
 * Liest die Antwort des Chatbots. Kleinigkeiten werden ergänzt (version, id, theme, leere Listen);
 * echte Fehler werfen eine Meldung, die man dem Chatbot zurückgeben kann.
 */
export function parseAiReply(text: string): LevelData {
  let raw: unknown;
  const json = extractJson(text);
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`Das JSON ist kaputt: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (raw && typeof raw === 'object' && 'level' in raw && (raw as { format?: unknown }).format === 'wichtelpiste-level') raw = (raw as { level: unknown }).level;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Das JSON ist kein Level-Objekt');
  const o = { ...(raw as Record<string, unknown>) };
  o.version ??= 1;
  if (typeof o.name !== 'string' || !o.name.trim()) o.name = 'KI-Level';
  o.name = String(o.name).slice(0, 30);
  if (typeof o.id !== 'string' || !o.id.trim()) o.id = slug(String(o.name));
  o.theme ??= { seed: Math.floor(Math.random() * 1000), auroraHue: 150 };
  for (const k of ['dismounts', 'checkpoints', 'icicles', 'candies', 'hazards', 'movers', 'springs', 'noDraw', 'hints']) o[k] ??= [];
  try {
    return validateLevel(o, 'Level');
  } catch (e) {
    if (e instanceof LevelError) throw new Error(`Formatfehler: ${e.message.replace(/^Level: /, '')}`);
    throw e;
  }
}

/** Rückmeldung für den Chatbot. */
export function feedbackText(name: string, r: { error: string } | { verdict: Verdict; issues: string[] }): string {
  const head = `Rückmeldung vom Spiel Wichtelpiste zu deinem Level „${name}“:`;
  const tail = 'Bitte korrigiere das Level und gib es wieder vollständig aus (JSON-Codeblock, und falls du ihn schon geschickt hast, wieder mit Link).';
  if ('error' in r) return `${head}\nDas Level lässt sich nicht einlesen.\n- ${r.error}\n\n${tail}`;
  const v = r.verdict;
  const lines = [head];
  lines.push(v.playable ? (v.allGifts ? 'Spielbar, alle Geschenke erreichbar.' : 'Spielbar, aber nicht alle Geschenke erreichbar.') : 'NICHT spielbar.');
  if (v.problems.length) lines.push('', 'Probleme:', ...v.problems.map((p) => `- ${p}`));
  const notes = [...v.warnings, ...r.issues];
  if (notes.length) lines.push('', 'Hinweise:', ...notes.map((p) => `- ${p}`));
  lines.push('', v.playable && notes.length === 0 ? 'Alles in Ordnung, keine Änderung nötig.' : tail);
  return lines.join('\n');
}
