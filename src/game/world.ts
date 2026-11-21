import type { Rect, SledStation } from './types';

/** Aufstiegs-Zone um eine Station herum (wo der Spieler an Bord geht).
 *  Muss von der Plattform-Oberkante hochreichen: Spieler steht AUF der
 *  Plattform (Körper von der Oberfläche nach oben), die Zone muss diesen
 *  Körperschnitt schneiden. pos.y = Kufenhöhe ≈ Plattform-Oberfläche - 60. */
export function stationZone(s: SledStation): Rect {
  return { x: s.pos.x - 40, y: s.pos.y - 70, w: 90, h: 120 };
}
