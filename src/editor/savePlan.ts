import type { LevelData } from '../sim/types';
import type { Solution } from '../levels/solveRunner';
import { LevelError, validateLevel } from '../levels/schema';
import { checkSolution } from '../levels/solutionCheck';

export type SavePlan =
  | { ok: true; file: string; writes: { path: string; content: string }[] }
  | { ok: false; error: string };

const ID = /^[a-z0-9-]+$/;

/** ID aus einem Dateinamen `NN-<id>.json`. */
export function idOfFile(file: string): string {
  return file.replace(/^\d+-/, '').replace(/\.json$/, '');
}

const isPt = (p: unknown): boolean => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n));

/** Lösung strukturell prüfen und auf die bekannten Felder reduzieren. */
function readSolution(v: unknown): Solution | null {
  if (!v || typeof v !== 'object' || !Array.isArray((v as { areas?: unknown }).areas)) return null;
  const areas: Solution['areas'] = [];
  for (const a of (v as { areas: unknown[] }).areas) {
    const strokes = (a as { strokes?: unknown } | null)?.strokes;
    if (!Array.isArray(strokes)) return null;
    const out: Solution['areas'][number]['strokes'] = [];
    for (const st of strokes) {
      const o = st as { boost?: unknown; pts?: unknown } | null;
      if (!o || !Array.isArray(o.pts) || o.pts.length < 2 || !o.pts.every(isPt)) return null;
      out.push({ boost: o.boost === true, pts: o.pts as [number, number][] });
    }
    areas.push({ strokes: out });
  }
  return { areas };
}
const FILE = /^\d{2,}-[a-z0-9-]+\.json$/;
const json = (v: unknown): string => JSON.stringify(v, null, 2) + '\n';

/**
 * Prüft eine Speicher-Anfrage des Editors und sagt, welche Dateien (relativ zum Projekt) geschrieben werden.
 * Ohne Node-Abhängigkeit, damit testbar; das Vite-Plugin schreibt nur, was hier herauskommt.
 */
export function planSave(body: unknown, existingFiles: readonly string[]): SavePlan {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Ungültige Anfrage' };
  const b = body as { level?: unknown; solution?: unknown; file?: unknown };
  let level: LevelData;
  try {
    level = validateLevel(b.level, 'Level');
  } catch (e) {
    return { ok: false, error: e instanceof LevelError ? e.message : 'Level ungültig' };
  }
  if (!ID.test(level.id)) return { ok: false, error: 'ID darf nur a–z, 0–9 und - enthalten' };
  const sol = readSolution(b.solution);
  if (!sol) return { ok: false, error: 'Lösung fehlt oder ist beschädigt – probespielen und schaffen' };
  const check = checkSolution(level, sol);
  if (!check.ok) return { ok: false, error: check.reason ?? check.areas.find((a) => !a.ok)?.reason ?? 'Lösung kommt nicht an' };

  const levelFiles = existingFiles.filter((f) => FILE.test(f));
  let file: string;
  if (b.file !== undefined && b.file !== null) {
    if (typeof b.file !== 'string' || !levelFiles.includes(b.file)) return { ok: false, error: 'Unbekannte Level-Datei' };
    if (idOfFile(b.file) !== level.id) return { ok: false, error: 'Datei passt nicht zur ID – ID geändert? Dann als neues Level speichern' };
    file = b.file;
  } else {
    if (levelFiles.some((f) => idOfFile(f) === level.id)) return { ok: false, error: `ID schon vergeben: ${level.id}` };
    const max = levelFiles.reduce((m, f) => Math.max(m, parseInt(f, 10)), 0);
    file = `${String(max + 1).padStart(2, '0')}-${level.id}.json`;
  }
  return {
    ok: true,
    file,
    writes: [
      { path: `src/levels/${file}`, content: json(level) },
      { path: `src/levels/solutions/${level.id}.json`, content: json(sol) },
    ],
  };
}
