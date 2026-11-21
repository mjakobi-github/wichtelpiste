import type { Vec2 } from '../game/types';

/**
 * Zeichnen mit Maus/Finger auf dem Canvas.
 * Liefert fertige WELT-Segmente an einen Callback, der entscheidet,
 * ob gezeichnet werden darf (Modus, Tinte). Mehrfinger-Erkennung: es wird
 * nur der erste Zeiger gezeichnet, der Rest wird ignoriert.
 */
export class DrawingInput {
  private activePointer: number | null = null;
  private last: Vec2 | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    deps: {
      /** Darf gerade gezeichnet werden? */
      canDraw: () => boolean;
      /** Screen -> Welt */
      toWorld: (sx: number, sy: number) => Vec2;
      /** Segment zeichnen (in Weltkoordinaten) */
      onSegment: (a: Vec2, b: Vec2) => void;
    },
  ) {
    const c = canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!deps.canDraw()) return;
      if (this.activePointer !== null) return;
      // Nur linke Maustaste bzw. Touch/Eingabestift
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.activePointer = e.pointerId;
      c.setPointerCapture(e.pointerId);
      this.last = deps.toWorld(e.clientX, e.clientY);
    });

    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointer || !this.last) return;
      const p = deps.toWorld(e.clientX, e.clientY);
      const d = Math.hypot(p.x - this.last.x, p.y - this.last.y);
      if (d >= 3) {
        deps.onSegment(this.last, p);
        this.last = p;
      }
    });

    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointer) return;
      this.activePointer = null;
      this.last = null;
      try { c.releasePointerCapture(e.pointerId); } catch { /* egal */ }
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);

    // Kontextmenue beim langen Fingerdruck unterdruecken
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
