import type { LevelData } from '../sim/types';
import type { Solution } from '../levels/solveRunner';

/** Speichern ins Projekt geht nur im Dev-Server (Vite-Plugin `wichtelpiste-level-save`). */
export const canSaveToProject: boolean = import.meta.env.DEV;

export async function saveToProject(level: LevelData, solution: Solution | null, file: string | null):
  Promise<{ ok: true; file: string } | { ok: false; error: string }> {
  try {
    const res = await fetch('/__editor/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, solution, ...(file ? { file } : {}) }),
    });
    const body = (await res.json()) as { ok: boolean; file?: string; error?: string };
    return body.ok && body.file ? { ok: true, file: body.file } : { ok: false, error: body.error ?? `Fehler ${res.status}` };
  } catch {
    return { ok: false, error: 'Dev-Server nicht erreichbar' };
  }
}
