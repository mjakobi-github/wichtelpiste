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

/** Veröffentlichte Bauanleitung (GitHub Pages) – für Spiele, die lokal oder als Einzeldatei laufen. */
export const GUIDE_URL = 'https://mjakobi-github.github.io/wichtelpiste/ki-bauanleitung.md';

/** Adresse der ausführlichen Bauanleitung (public/ki-bauanleitung.md) neben dem laufenden Spiel. */
export function guideUrl(linkBase?: string): string {
  if (!linkBase) return GUIDE_URL;
  try {
    const u = new URL('ki-bauanleitung.md', linkBase);
    const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u.hostname) || u.hostname.endsWith('.local');
    return (u.protocol === 'https:' || u.protocol === 'http:') && !local ? u.href : GUIDE_URL;
  } catch {
    return GUIDE_URL;
  }
}

/**
 * Anleitung, die man dem Chatbot gibt. idea = Wunsch des Kindes/der Familie (optional).
 * linkBase = Adresse des Spiels; dann soll der Chatbot zusätzlich einen Link zum Antippen schicken.
 * Die ausführliche Fassung mit Bausteinen und Beispielen liegt in public/ki-bauanleitung.md.
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

Ausführliche Bauanleitung mit Bausteinen, Tipps für gutes Leveldesign und geprüften Beispielen: ${guideUrl(linkBase)}
Wenn du Webseiten lesen kannst, lies sie zuerst. Das Wichtigste steht auch hier.

## Das Spiel
Eine Elfe läuft und springt (Jump'n'Run), sammelt Geschenke und bringt sie zum Schornstein. Lücken überwindet sie im Schlitten: An einer Station steigt sie automatisch ein, der Spieler zeichnet eine Piste (Linie), der Schlitten rutscht darauf mit Schwerkraft los und muss in der grünen Landezone dieses Abschnitts ankommen. Dort steigt die Elfe aus und läuft weiter. Ohne Landezone fährt der letzte Abschnitt direkt zum Schornstein.

## Arten von Leveln
- Reines Jump'n'Run: nur laufen und springen. "stations": [], "areas": [], "dismounts": []
- Reine Schlittenfahrt: kurzes Stück zu Fuß zur Station, dann eine lange Fahrt direkt zum Schornstein. 1 Station, "dismounts": []
- Gemischt (Standard, wenn der Wunsch nichts sagt): abwechselnd laufen und fahren, 1–3 Stationen

## Koordinaten und Maße
- Weltpixel, x nach rechts, y nach UNTEN (kleineres y = höher). Welt typisch 2400–5000 breit, 700–1300 hoch. Wer unten aus der Welt fällt, verliert einen Versuch.
- Plattform {x,y,w,h}: x,y = linke obere Ecke, y = Dachhöhe. Ab h ≥ 50 wird sie als Haus gezeichnet, darunter als schmaler Balken (h 24). Alles Feste ist von allen Seiten fest (Kopf stößt an Balken).
- Elfe: 30 breit, 38 hoch. Sprung (voller Anlauf, gehalten): bis ${jumpH} px hoch, auf gleicher Höhe ${jumpW} px weit. Plane mit Reserve: Lücken zu Fuß höchstens 160 px, Stufen nach oben höchstens 130 px. Herunterfallen ist beliebig tief erlaubt.
- Schlitten: keine Steuerung, nur die gezeichnete Piste. Kommt ohne Speedtinte nicht höher als die Station. Die Landezone sollte deshalb tiefer liegen als die Station (100–300 px) und 400–1100 px entfernt sein. Er prallt an Plattformen, Eiszapfen und Zuckerstangen ab. Eine Fahrt startet neu an der Station, wenn er eine Gefahr berührt, aus der Welt fällt, stecken bleibt oder über 150 px über die Landezone hinausfährt. Tinte = Länge der Linie in px.

## Felder (alle Pflicht, Listen dürfen leer sein)
- "version": 1, "id": kurzer-name-mit-bindestrichen, "name": Anzeigename (max. 30 Zeichen)
- "worldW", "worldH": Weltgröße
- "spawn": {x,y} Startpunkt der Elfe (linke obere Ecke): y = Dach darunter − 60
- "platforms": [{x,y,w,h,ice?}] Boden, Häuser, Balken. ice: true = rutschig zu Fuß (träge, rutscht nach; für den Schlitten ohne Wirkung)
- "stations": [{pos:{x,y}, dir?}] Station steht auf einem Dach: pos.y = Dach − 60, mindestens 60 px von der Dachkante entfernt (in Fahrtrichtung). dir = Fahrtrichtung beim Losfahren: 1 = rechts, -1 = links; weglassen = zum Ziel hin. Nur angeben, wenn der Schlitten erst vom Ziel weg muss (z. B. zu einer Sprungfeder, die ihn zurückschleudert)
- "areas": [{ink, boost}] genau ein Eintrag je Station, gleiche Reihenfolge. ink = Tinte (etwa 1,5 × Entfernung Station → Ziel), boost = Speedtinte (0 oder z. B. 300; schiebt in Zeichenrichtung, auch bergauf). Zahl oder "unlimited"
- "dismounts": [{x,y,w,h}] Landezone für Station i an Stelle i. Liegt auf einem Dach: y + h = Dachhöhe, w ≈ 240, h = 150. Höchstens so viele wie Stationen; der letzten Station darf sie fehlen (fährt dann zum Schornstein)
- "gifts": [{x,y}] Geschenke (mindestens eins), auf dem Boden: y = Dach − 25. Auch in der Luft möglich (Schlitten sammelt beim Durchfahren mit ein)
- "chimney": {x,y} Schornstein, y = Dachhöhe (steht auf einem Dach). Nimmt erst ab einem Geschenk an; drei Sterne nur mit allen Geschenken
- "checkpoints": [{x,y}] Laternen (Neustartpunkt zu Fuß), y = Dachhöhe. In Wegreihenfolge auflisten: nach einer späteren Laterne zählen frühere nicht mehr
- "springs": [{pos:{x,y}, angle, power}] Sprungfeder für Elfe UND Schlitten, pos.y = Dachhöhe, angle in Grad (0 = senkrecht, positiv = nach rechts, negativ = nach links), power 1200–1500. Hebt die Elfe ca. 345 px (power 1500: 400 px). Darüber Platz lassen
- "icicles", "candies": [{x,y,h}] harmlose, aber feste Hindernisse für Elfe UND Schlitten (x = Mitte, y = Dachhöhe, h = 40–80; Zuckerstange ragt 24 px höher). Nicht auf die Schlittenstrecke stellen
- "hazards": [{kind:"icicle-hanging"|"tinsel", rect:{x,y,w,h}}] tödlich für Elfe UND Schlitten. tinsel z. B. als Boden einer Grube, icicle-hanging unter einer Decke
- "movers": [{kind:"bell"|"crow", radius:18, path}] tödlich für Elfe UND Schlitten, bewegt; path: {type:"pendulum", pivot:{x,y}, length, amplitude (rad, z. B. 0.9), period (s)} (hängt unter pivot) oder {type:"line", from:{x,y}, to:{x,y}, period} (hin und zurück) oder {type:"circle", center:{x,y}, radius, period}; optional phase 0–1 zum Versetzen. Sie laufen beim LOS weiter: Der Spieler passt den Moment ab
- "noDraw": [{x,y,w,h}] Zeichenverbot (dort keine Piste; der Schlitten fährt durch, braucht davor aber Schwung, um drüberzufliegen)
- "theme": {seed: Zahl, auroraHue: 0–360} Landschaft und Farbe des Polarlichts
- "hints": [{at:{x,y,w,h}, text, icon:"move"|"jump"|"station"|"draw"|"launch"|"chimney"}] kurze Hinweise, solange die Elfe in "at" ist (optional)

## Regeln für ein gutes Level
- Weg: Start → zu Fuß zur Station 1 → Schlitten → Landezone 1 → zu Fuß weiter → … → Schornstein.
- Alles zu Fuß Nötige muss mit Sprüngen oder Federn erreichbar sein; nichts liegt in der Luft, wo man nicht hinkommt.
- Zwischen Station und Landezone eine Lücke, die man zu Fuß NICHT schafft (sonst braucht man keinen Schlitten).
- Gefahren nicht direkt auf den einzigen Weg legen, ohne dass man drüber kann. Laterne vor schweren Stellen.
- Eine Idee pro Abschnitt, Schwierigkeit steigt zum Ende hin, 3–6 Geschenke (eins davon schwer erreichbar).

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
  for (const k of ['stations', 'areas', 'dismounts', 'checkpoints', 'icicles', 'candies', 'hazards', 'movers', 'springs', 'noDraw', 'hints']) o[k] ??= [];
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
