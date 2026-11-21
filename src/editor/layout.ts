/** Handy-Layout bei niedrigen oder schmalen Bildschirmen (Querformat-Handys, kleine Tablets). */
export function layoutFor(w: number, h: number): 'phone' | 'desktop' {
  return h < 500 || w < 1000 ? 'phone' : 'desktop';
}
