import { Texture } from 'pixi.js';

/** Virtuelle Höhe des Hintergrunds; alles wird auf die Bildschirmhöhe skaliert. */
export const VH = 540;

/** Deterministischer Zufall (mulberry32) – gleicher Seed, gleiche Landschaft. */
export function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Verschiebung einer gekachelten Ebene: camX · factor, gewickelt in [0, period). */
export function parallaxOffset(camX: number, factor: number, period: number): number {
  const o = (camX * factor) % period;
  return o < 0 ? o + period : o;
}

export const MOUNTAIN_STEP = 20;

/**
 * Höhenprofil (y in virtuellen px, kleiner = höher) eines nahtlos kachelbaren
 * Gebirgszugs: Summe ganzzahliger Harmonischer über die Periode, mit Graten.
 */
export function mountainProfile(seed: number, period: number, base = 300, amp = 90): number[] {
  const r = rng(seed);
  const harmonics = [1, 2, 3, 5, 7, 11, 17].map((k, i) => ({ k, a: (0.4 + r() * 0.6) / (1 + i * 0.7), ph: r() * Math.PI * 2 }));
  const n = Math.round(period / MOUNTAIN_STEP);
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = (i % n) / n;
    let v = 0;
    let norm = 0;
    for (const h of harmonics) {
      // Grat: 1 - |sin| macht spitze Gipfel
      const s = Math.sin(u * Math.PI * 2 * h.k + h.ph);
      v += h.a * (h.k > 2 ? 1 - Math.abs(s) * 2 : s);
      norm += h.a;
    }
    out.push(base - (v / norm) * amp);
  }
  return out;
}

/** Zeichnet einmalig in ein Canvas und macht daraus eine Textur. */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const g = c.getContext('2d');
  if (g) draw(g);
  return Texture.from(c);
}

let dotTex: Texture | null = null;
/** Weicher runder Punkt (weiß), für Sterne, Glühen, Partikel. */
export function softDot(): Texture {
  if (!dotTex) {
    dotTex = canvasTexture(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    });
  }
  return dotTex;
}

let hardTex: Texture | null = null;
/** Scharfer runder Punkt (weiß). */
export function hardDot(): Texture {
  if (!hardTex) {
    hardTex = canvasTexture(32, 32, (g) => {
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(16, 16, 15, 0, Math.PI * 2);
      g.fill();
    });
  }
  return hardTex;
}

export function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
}

/** HSL → 0xRRGGBB */
export function hslHex(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

/** Gemeinsame Schnittstelle der Ebenen. vw = virtuelle Breite. */
export interface Layer {
  readonly container: import('pixi.js').Container;
  resize(vw: number): void;
  update(camX: number, dy: number, t: number): void;
  destroy(): void;
}
