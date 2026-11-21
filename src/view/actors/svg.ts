import { Graphics, GraphicsContext } from 'pixi.js';

const cache = new Map<string, GraphicsContext>();

/** SVG-Quelltext → Pixi-Vektorgrafik (Kontext je SVG nur einmal geparst). pivot in SVG-Einheiten. */
export function svgPart(src: string, pivotX: number, pivotY: number): Graphics {
  let ctx = cache.get(src);
  if (!ctx) {
    ctx = new GraphicsContext().svg(src);
    cache.set(src, ctx);
  }
  const g = new Graphics(ctx);
  g.pivot.set(pivotX, pivotY);
  return g;
}

/** Nähert value exponentiell an target an. */
export function damp(value: number, target: number, rate: number, dt: number): number {
  return value + (target - value) * (1 - Math.exp(-rate * dt));
}
