import type { LevelData } from './types';

/** ⭐ geschafft · ⭐⭐ ≥ 60 % · ⭐⭐⭐ alles. 0 nur ohne Geschenk. */
export function computeStars(collected: number, total: number): 0 | 1 | 2 | 3 {
  if (collected <= 0) return 0;
  if (collected >= total) return 3;
  return collected / total >= 0.6 ? 2 : 1;
}

/** Inhalts-Fingerabdruck (FNV-1a 32 Bit) ohne Hinweise – ändert sich das Level, beginnen Rekorde neu. */
export function levelHash(level: LevelData): string {
  const { hints: _hints, ...rest } = level;
  const text = JSON.stringify(rest);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
