/**
 * Testhilfe: liest einen QR-Code (Stufe M, Byte-Modus) zurück und prüft dabei unabhängig vom Encoder:
 * Formatinfo per BCH-Abstand, Reed-Solomon-Syndrome (Nullstellen α^0…α^(n-1)) jedes Blocks.
 */
import { BLOCKS_M, ECC_PER_BLOCK_M, dataModuleOrder, formatBits, functionPatterns, gfMul, maskHit, rawDataModules } from './qr';

function gfPow2(e: number): number {
  let r = 1;
  for (let i = 0; i < e; i++) r = gfMul(r, 2);
  return r;
}

export function readQr(m: boolean[][]): Uint8Array {
  const size = m.length;
  const ver = (size - 17) / 4;
  // Formatinfo (erste Kopie) lesen
  let fmt = 0;
  const bitAt = (x: number, y: number): number => (m[y][x] ? 1 : 0);
  const pos: [number, number][] = [];
  for (let i = 0; i <= 5; i++) pos.push([8, i]);
  pos.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) pos.push([14 - i, 8]);
  pos.forEach(([x, y], i) => { fmt |= bitAt(x, y) << i; });
  let mask = -1;
  for (let k = 0; k < 8; k++) if (formatBits(k) === fmt) mask = k;
  if (mask < 0) throw new Error('Formatinfo ungültig');

  const fn = functionPatterns(ver).fn;
  const order = dataModuleOrder(fn);
  const raw = Math.floor(rawDataModules(ver) / 8);
  const words = new Array<number>(raw).fill(0);
  order.slice(0, raw * 8).forEach(([x, y], i) => {
    const b = (m[y][x] !== maskHit(mask, x, y)) ? 1 : 0;
    words[i >>> 3] |= b << (7 - (i & 7));
  });

  // Entschachteln
  const nb = BLOCKS_M[ver];
  const ecc = ECC_PER_BLOCK_M[ver];
  const numShort = nb - (raw % nb);
  const shortLen = Math.floor(raw / nb);
  let k = 0;
  // Datenteil steht vorn, ECC hinten – aber beim Verschachteln stehen die ECC-Bytes aller Blöcke gemeinsam hinten
  const dataLen = (j: number): number => shortLen - ecc + (j < numShort ? 0 : 1);
  const fixed: number[][] = Array.from({ length: nb }, () => []);
  k = 0;
  const maxData = shortLen - ecc + 1;
  for (let i = 0; i < maxData; i++) for (let j = 0; j < nb; j++) if (i < dataLen(j)) fixed[j].push(words[k++]);
  for (let i = 0; i < ecc; i++) for (let j = 0; j < nb; j++) fixed[j].push(words[k++]);

  // Syndrome prüfen
  for (const blk of fixed) {
    for (let r = 0; r < ecc; r++) {
      const a = gfPow2(r);
      let s = 0;
      for (const c of blk) s = gfMul(s, a) ^ c;
      if (s !== 0) throw new Error('Reed-Solomon-Prüfung fehlgeschlagen');
    }
  }

  const data = fixed.flatMap((b, j) => b.slice(0, dataLen(j)));
  let bit = 0;
  const read = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++, bit++) v = (v << 1) | ((data[bit >>> 3] >>> (7 - (bit & 7))) & 1);
    return v;
  };
  if (read(4) !== 0b0100) throw new Error('Kein Byte-Modus');
  const len = read(ver <= 9 ? 8 : 16);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = read(8);
  return out;
}
