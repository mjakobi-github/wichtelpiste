/**
 * Nachgeladene Programmteile (Editor, Teilen, KI-Dialog, …) haben Hash-Namen. Nach einem Update
 * räumt der Service Worker die alten weg – eine noch offene alte Seite findet sie dann nicht mehr
 * („Failed to fetch dynamically imported module“). Abhilfe: einmal neu laden, aber nie in Schleife.
 */
const KEY = 'wichtelpiste.chunkReloadAt';
/** Innerhalb dieser Zeit nach einem solchen Neuladen nicht nochmal neu laden. */
export const RELOAD_COOLDOWN_MS = 30_000;

export function mayReload(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt === null || !(now - lastReloadAt < RELOAD_COOLDOWN_MS && now >= lastReloadAt);
}

/** true = Neuladen ist erlaubt und vorgemerkt (Zeitpunkt gespeichert). Ohne Speicher: lieber nicht. */
export function claimReload(storage: Storage | null, now: number): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(KEY);
    const last = raw === null ? null : Number(raw);
    if (!mayReload(last !== null && Number.isFinite(last) ? last : null, now)) return false;
    storage.setItem(KEY, String(now));
    return true;
  } catch {
    return false;
  }
}
