/** Kleine Grund-Typen, die überall im Spiel genutzt werden. */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Plattform im Level (AABB, starr). */
export type Platform = Rect;

/** Gerades Liniensegment (gezeichnete Piste ODER Plattform-Kante).
 *  boost: Beschleunigungs-Tinte – schiebt den Schlitten in Zeichenrichtung (a->b).
 *  area: Index der Station, in deren Bereich die Linie gezeichnet wurde. */
export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  boost?: boolean;
  area?: number;
}

/** Tintenbudget eines Bereichs (einer Station). */
export interface InkBudget {
  /** Weisse Pistentinte: Weltpixel Zeichenlaenge, oder 'unlimited' */
  ink: number | 'unlimited';
  /** Separates, knapperes Budget für 🚀-Speedtinte (gleiche Einheit) */
  boost: number | 'unlimited';
}

/** Punkt, an dem man zu Fuß aufsteigt und in den Schlittenmodus wechselt. */
export interface SledStation {
  pos: Vec2;
}

/** Zone: Faehrt der Schlitten hier hinein, steigt man automatisch aus. */
export type DismountZone = Rect;

/** Eiszapfen in der Schneedecke: Spitze zeigt hoch, y = Basis (Boden). */
export interface Icicle {
  x: number;
  y: number; // Basis (Boden)
  h: number; // Höhe
}

/** Zuckerstange als vertikales Hindernis: x = Mitte, y = Basis, h = Höhe
 *  (inkl. Haken oben). Berührung kostet im Fuß- und Schlittenmodus die Fahrt. */
export interface CandyCane {
  x: number;
  y: number; // Basis (Boden)
  h: number; // Höhe inkl. Haken
}

export interface LevelData {
  id: string;
  name: string;
  /** Weltränder in Weltkoordinaten (unten offen -> Fall = Respawn/Crash) */
  worldW: number;
  worldH: number;
  spawn: Vec2;
  platforms: Platform[];
  stations: SledStation[];
  dismounts: DismountZone[];
  /** Geschenke (Zentrum-Punkte), zum Sammeln zu Fuß & im Flug */
  gifts: Vec2[];
  /** Flaggen-Checkpoints (Fuß-Modus), Respawn nach Fall/Eiszapfen */
  checkpoints: Vec2[];
  icicles: Icicle[];
  candies: CandyCane[];
  /** Ziel-Schornstein (Basis-Mitte auf Plattform) oder null */
  chimney: Vec2 | null;
  /** Tintenbudget je Bereich (Index = Index in stations): Zeichnen, Radieren
   *  und Mülleimer gelten immer nur für den aktuell aktiven Bereich. */
  areas: InkBudget[];
}
