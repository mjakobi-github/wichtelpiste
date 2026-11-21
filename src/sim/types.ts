/** Datenmodell des Spiels (Levelformat v1). Alle Koordinaten in Weltpixeln, y zeigt nach unten. */

export interface Vec2 { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** Tintenbudget: Weltpixel Linienlänge oder unbegrenzt. */
export type Budget = number | 'unlimited';

/** Ein Schlitten-Abschnitt (= eine Station) mit eigenem Budget. */
export interface Area { ink: Budget; boost: Budget }

export interface Station { pos: Vec2 }

/** Eiszapfen/Zuckerstange: harmlos, solide. x = Mitte, y = Basis (Boden), h = Höhe. */
export interface Obstacle { x: number; y: number; h: number }

/** Tödliches, statisches Hindernis. */
export interface Hazard { kind: 'icicle-hanging' | 'tinsel'; rect: Rect }

/** Bahn eines bewegten Hindernisses. phase in Anteilen der Periode (0–1), amplitude in rad. */
export type MotionPath =
  | { type: 'pendulum'; pivot: Vec2; length: number; amplitude: number; period: number; phase?: number }
  | { type: 'circle'; center: Vec2; radius: number; period: number; phase?: number }
  | { type: 'line'; from: Vec2; to: Vec2; period: number; phase?: number };

/** Tödliches, bewegtes Hindernis. */
export interface Mover { kind: 'bell' | 'crow'; radius: number; path: MotionPath }

/** Sprungfeder. pos = Basis-Mitte, angle in Grad (0 = nach oben, + = im Uhrzeigersinn), power in px/s. */
export interface Spring { pos: Vec2; angle: number; power: number }

/** Einführungs-Hinweis, aktiv solange der Spieler in `at` ist. */
export interface Hint {
  at: Rect;
  text: string;
  icon: 'move' | 'jump' | 'station' | 'draw' | 'launch' | 'chimney';
}

/** Optik je Level: Seed für prozedurale Landschaft, Farbton des Polarlichts (0–360). */
export interface Theme { seed: number; auroraHue: number }

export interface LevelData {
  version: 1;
  id: string;
  name: string;
  worldW: number;
  worldH: number;
  spawn: Vec2;
  platforms: Rect[];
  stations: Station[];
  dismounts: Rect[];
  gifts: Vec2[];
  checkpoints: Vec2[];
  icicles: Obstacle[];
  candies: Obstacle[];
  hazards: Hazard[];
  movers: Mover[];
  springs: Spring[];
  noDraw: Rect[];
  chimney: Vec2;
  /** Index = Stations-Index */
  areas: Area[];
  theme: Theme;
  hints: Hint[];
}

/** Gerades Liniensegment (Kollision). boost: schiebt in Richtung a → b. */
export interface Segment { ax: number; ay: number; bx: number; by: number; boost?: boolean }
