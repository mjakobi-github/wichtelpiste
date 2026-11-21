import type { SharePayload } from './codec';
import { formatInk } from '../app/flow';

/** Begleittext beim Teilen (Messenger). */
export function shareText(p: SharePayload): string {
  const base = `Ich hab ein Wichtelpiste-Level für dich gebaut: ${p.level.name}.`;
  return p.challengeInk !== null ? `${base} Schlag meine ${formatInk(p.challengeInk)}!` : base;
}
