import { decodeShare, readShareHash, ShareError } from '../share/codec';
import type { Gift, Gifts } from './library';

export type Received = { kind: 'none' } | { kind: 'gift'; gift: Gift } | { kind: 'error'; message: string };

/** Liest einen geteilten Level-Link aus der Adresse (#l=…) und legt ihn unter „Geschenkt“ ab. */
export async function receiveFromHash(hash: string, gifts: Gifts): Promise<Received> {
  const code = readShareHash(hash);
  if (!code) return { kind: 'none' };
  try {
    const p = await decodeShare(code);
    return { kind: 'gift', gift: gifts.add(p.level, p.from, p.challengeInk) };
  } catch (e) {
    return { kind: 'error', message: e instanceof ShareError ? e.message : 'Dieser Link ist kaputt oder unvollständig' };
  }
}
