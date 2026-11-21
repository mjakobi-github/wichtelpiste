import { describe, expect, it } from 'vitest';
import { encodeQr, qrToSvg } from './qr';
import { readQr } from './qrRead.testutil';
import { encodeShare } from './codec';
import { LEVELS } from '../levels';

const text = (n: number): string => Array.from({ length: n }, (_, k) => 'abcdefghijklmnopqrstuvwxyz0123456789-_'[(k * 7) % 38]).join('');
const bytes = (s: string) => new TextEncoder().encode(s);

describe('QR-Encoder', () => {
  it('kurzer Text: Version 1, Finder-Muster, Timing', () => {
    const q = encodeQr('HELLO');
    expect(q.size).toBe(21);
    for (const [x, y] of [[0, 0], [14, 0], [0, 14]]) {
      expect(q.modules[y][x]).toBe(true);
      expect(q.modules[y + 1][x + 1]).toBe(false);
      expect(q.modules[y + 3][x + 3]).toBe(true);
    }
    for (let k = 8; k < 13; k++) {
      expect(q.modules[6][k]).toBe(k % 2 === 0);
      expect(q.modules[k][6]).toBe(k % 2 === 0);
    }
  });

  it.each([1, 17, 100, 500, 1000, 1500])('%i Zeichen: unabhängiger Leser liest dieselben Bytes zurück', (n) => {
    const s = text(n);
    const q = encodeQr(s);
    expect(Array.from(readQr(q.modules))).toEqual(Array.from(bytes(s)));
  });

  it('Link eines Menü-Levels', async () => {
    const url = `https://example.github.io/wichtelpiste/#l=${await encodeShare({ level: LEVELS[7], from: 'Oma', challengeInk: 412 })}`;
    const q = encodeQr(url);
    expect(new TextDecoder().decode(readQr(q.modules))).toBe(url);
    expect(q.size).toBeLessThanOrEqual(4 * 30 + 17);
  });

  it('zu lang → wirft', () => {
    expect(() => encodeQr(text(2400))).toThrow();
  });

  it('SVG mit Ruhezone', () => {
    const svg = qrToSvg(encodeQr('HELLO'));
    expect(svg).toContain('viewBox="0 0 29 29"');
    expect(svg).toContain('<path');
  });
});
