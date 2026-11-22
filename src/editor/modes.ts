import type { Field } from './fields';
import type { Issue } from './checks';
import { PALETTE, type PaletteEntry } from './panels';

export type EditorMode = 'simple' | 'pro';

/** Einfach: große, verständliche Bausteine (Kinder ab 8). */
const SIMPLE: readonly string[] = ['Boden', 'Balken', 'Eis', 'Start', 'Station', 'Landezone', 'Geschenk', 'Laterne', 'Schornstein', 'Eiszapfen', 'Zuckerstange', 'Feder'];

export function paletteFor(mode: EditorMode): readonly PaletteEntry[] {
  return mode === 'pro' ? PALETTE : SIMPLE.map((l) => PALETTE.find((p) => p.label === l)!);
}

/** Einfach: keine Zahlen- oder Textfelder, nur Schalter (z. B. Eis) und die Fahrtrichtung der Station. */
export function fieldsForMode(mode: EditorMode, fields: Field[]): Field[] {
  return mode === 'pro' ? fields : fields.filter((f) => f.type === 'toggle' || f.key === 'dir');
}

/** Fehlertexte für Kinder; Warnungen sind schon einfach. */
export function friendlyIssue(issue: Issue, mode: EditorMode): string {
  if (mode === 'pro' || issue.level === 'warning') return issue.text;
  const t = issue.text;
  if (t.startsWith('gifts')) return 'Es fehlt ein Geschenk';
  if (t.startsWith('dismounts')) return 'Zu viele Landezonen – jede Station hat höchstens eine';
  return 'Da stimmt etwas nicht – frag einen Erwachsenen oder schalte Profi ein';
}

/** Tinte nach geschaffter Probefahrt automatisch anpassen? */
export function autoInkAllowed(mode: EditorMode, inkTouched: boolean): boolean {
  return mode === 'simple' && !inkTouched;
}
