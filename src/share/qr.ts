/**
 * QR-Code-Encoder (ISO/IEC 18004), ohne Abhängigkeiten: Byte-Modus, Fehlerkorrektur M, Versionen 1–40,
 * beste der 8 Masken nach Strafpunkten. Aufbau angelehnt an das bekannte Referenzverfahren (Nayuki).
 */

export interface QrCode { size: number; modules: boolean[][] }

/** Fehlerkorrektur-Codewörter je Block und Blockanzahl für Stufe M, Index = Version. */
export const ECC_PER_BLOCK_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
export const BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
/** Formatbits-Kennung der Stufe M. */
const ECL_M_BITS = 0;

export function rawDataModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

export function dataCodewords(ver: number): number {
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK_M[ver] * BLOCKS_M[ver];
}

export function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 17 - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

// ------------------------------------------------------------ Reed-Solomon über GF(256), Polynom 0x11D

export function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const r = new Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const r = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (r.shift() as number);
    r.push(0);
    divisor.forEach((c, i) => { r[i] ^= gfMul(c, factor); });
  }
  return r;
}

// ------------------------------------------------------------ Kodierung

function dataBits(bytes: Uint8Array, ver: number): number[] {
  const bits: number[] = [];
  const push = (v: number, n: number): void => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  return bits;
}

function interleave(data: number[], ver: number): number[] {
  const numBlocks = BLOCKS_M[ver];
  const ecc = ECC_PER_BLOCK_M[ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const div = rsDivisor(ecc);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - ecc + (i < numShort ? 0 : 1));
    k += dat.length;
    const blk = [...dat, ...rsRemainder(dat, div)];
    if (i < numShort) blk.splice(shortLen - ecc, 0, -1);
    blocks.push(blk);
  }
  const out: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b, j) => { if (i !== shortLen - ecc || j >= numShort) out.push(b[i]); });
  }
  return out;
}

class Grid {
  readonly m: boolean[][];
  readonly fn: boolean[][];
  constructor(readonly size: number) {
    this.m = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  set(x: number, y: number, dark: boolean): void {
    this.m[y][x] = dark;
    this.fn[y][x] = true;
  }
}

/** Funktionsmuster einer Version (Finder, Timing, Ausrichtung, Platz für Format/Version). */
export function functionPatterns(ver: number): Grid {
  const size = ver * 4 + 17;
  const g = new Grid(size);
  for (let i = 0; i < size; i++) { g.set(6, i, i % 2 === 0); g.set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        g.set(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const al = alignmentPositions(ver);
  const n = al.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) g.set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  drawFormat(g, 0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      g.set(a, b, bit);
      g.set(b, a, bit);
    }
  }
  return g;
}

export function formatBits(mask: number): number {
  const data = (ECL_M_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormat(g: Grid, mask: number): void {
  const bits = formatBits(mask);
  const bit = (i: number): boolean => ((bits >>> i) & 1) !== 0;
  const s = g.size;
  for (let i = 0; i <= 5; i++) g.set(8, i, bit(i));
  g.set(8, 7, bit(6));
  g.set(8, 8, bit(7));
  g.set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) g.set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) g.set(s - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) g.set(8, s - 15 + i, bit(i));
  g.set(8, s - 8, true);
}

export function maskHit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** Reihenfolge der Datenmodule (Zickzack von rechts unten, Spalte 6 ausgelassen). */
export function dataModuleOrder(fn: boolean[][]): [number, number][] {
  const size = fn.length;
  const out: [number, number][] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fn[y][x]) out.push([x, y]);
      }
    }
  }
  return out;
}

function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  const line = (get: (i: number) => boolean): void => {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) { run++; continue; }
      if (run >= 5) score += 3 + (run - 5);
      run = 1;
    }
    // Finder-ähnliche Muster 1011101 mit 4 hellen Modulen davor oder danach (Ränder zählen als hell)
    const at = (i: number): boolean => (i >= 0 && i < n ? get(i) : false);
    for (let i = -4; i < n; i++) {
      if (at(i) && !at(i + 1) && at(i + 2) && at(i + 3) && at(i + 4) && !at(i + 5) && at(i + 6)) {
        const before = !at(i - 1) && !at(i - 2) && !at(i - 3) && !at(i - 4);
        const after = !at(i + 7) && !at(i + 8) && !at(i + 9) && !at(i + 10);
        if (before || after) score += 40;
      }
    }
  };
  for (let y = 0; y < n; y++) line((x) => m[y][x]);
  for (let x = 0; x < n; x++) line((y) => m[y][x]);
  let dark = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) dark++;
      if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    }
  }
  const total = n * n;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

export function encodeQr(data: Uint8Array | string): QrCode {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let ver = 1;
  for (; ver <= 40; ver++) if (dataBits(bytes, ver).length <= dataCodewords(ver) * 8) break;
  if (ver > 40) throw new Error('Zu viele Daten für einen QR-Code');
  const capacity = dataCodewords(ver) * 8;
  const bits = dataBits(bytes, ver);
  for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; words.length < capacity / 8; pad ^= 0xec ^ 0x11) words.push(pad);

  const g = functionPatterns(ver);
  const all = interleave(words, ver);
  const order = dataModuleOrder(g.fn);
  order.forEach(([x, y], i) => {
    g.m[y][x] = i < all.length * 8 ? ((all[i >>> 3] >>> (7 - (i & 7))) & 1) === 1 : false;
  });

  let best: { mask: number; score: number; m: boolean[][] } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const t = new Grid(g.size);
    for (let y = 0; y < g.size; y++) {
      for (let x = 0; x < g.size; x++) {
        t.m[y][x] = g.m[y][x] !== (!g.fn[y][x] && maskHit(mask, x, y));
        t.fn[y][x] = g.fn[y][x];
      }
    }
    drawFormat(t, mask);
    const score = penalty(t.m);
    if (!best || score < best.score) best = { mask, score, m: t.m };
  }
  return { size: g.size, modules: best!.m };
}

/** SVG mit Ruhezone (Standard 4 Module). */
export function qrToSvg(q: QrCode, opts: { quiet?: number } = {}): string {
  const b = opts.quiet ?? 4;
  const dim = q.size + 2 * b;
  let d = '';
  q.modules.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + b} ${y + b}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
