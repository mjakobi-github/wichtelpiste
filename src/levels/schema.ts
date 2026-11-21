import type {
  Area, Budget, Hazard, Hint, LevelData, MotionPath, Mover, Obstacle, Rect, Spring, Station, Theme, Vec2,
} from '../sim/types';

/** Fehler in einer Level-Datei; die Meldung enthält Datei und Feldpfad. */
export class LevelError extends Error {
  constructor(source: string, path: string, msg: string) {
    super(`${source}: ${path} ${msg}`);
    this.name = 'LevelError';
  }
}

type Obj = Record<string, unknown>;

/** Validiert rohe JSON-Daten und füllt Defaults; wirft LevelError. */
export function validateLevel(raw: unknown, source: string): LevelData {
  const fail = (path: string, msg: string): never => {
    throw new LevelError(source, path, msg);
  };
  const obj = (v: unknown, path: string): Obj =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : fail(path, 'muss ein Objekt sein');
  const num = (v: unknown, path: string): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fail(path, 'muss eine Zahl sein');
  const pos = (v: unknown, path: string): number => {
    const n = num(v, path);
    return n > 0 ? n : fail(path, 'muss > 0 sein');
  };
  const str = (v: unknown, path: string): string =>
    typeof v === 'string' && v.length > 0 ? v : fail(path, 'muss ein nicht-leerer Text sein');
  const arr = (v: unknown, path: string, optional: boolean): unknown[] => {
    if (v === undefined && optional) return [];
    return Array.isArray(v) ? v : fail(path, 'muss eine Liste sein');
  };
  const vec = (v: unknown, path: string): Vec2 => {
    const o = obj(v, path);
    return { x: num(o.x, `${path}.x`), y: num(o.y, `${path}.y`) };
  };
  const rect = (v: unknown, path: string): Rect => {
    const o = obj(v, path);
    return { x: num(o.x, `${path}.x`), y: num(o.y, `${path}.y`), w: pos(o.w, `${path}.w`), h: pos(o.h, `${path}.h`) };
  };
  const budget = (v: unknown, path: string): Budget => {
    if (v === 'unlimited') return v;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
    return fail(path, "muss Zahl ≥ 0 oder 'unlimited' sein");
  };
  const list = <T>(v: unknown, path: string, optional: boolean, f: (e: unknown, p: string) => T): T[] =>
    arr(v, path, optional).map((e, i) => f(e, `${path}[${i}]`));
  const oneOf = <T extends string>(v: unknown, path: string, opts: readonly T[]): T =>
    opts.includes(v as T) ? (v as T) : fail(path, `muss eins von ${opts.join(', ')} sein`);
  const optPhase = (o: Obj, path: string): { phase?: number } =>
    o.phase === undefined ? {} : { phase: num(o.phase, `${path}.phase`) };

  const motion = (v: unknown, path: string): MotionPath => {
    const o = obj(v, path);
    const type = oneOf(o.type, `${path}.type`, ['pendulum', 'circle', 'line'] as const);
    const period = pos(o.period, `${path}.period`);
    if (type === 'pendulum') {
      return { type, pivot: vec(o.pivot, `${path}.pivot`), length: pos(o.length, `${path}.length`),
        amplitude: num(o.amplitude, `${path}.amplitude`), period, ...optPhase(o, path) };
    }
    if (type === 'circle') {
      return { type, center: vec(o.center, `${path}.center`), radius: pos(o.radius, `${path}.radius`), period, ...optPhase(o, path) };
    }
    return { type, from: vec(o.from, `${path}.from`), to: vec(o.to, `${path}.to`), period, ...optPhase(o, path) };
  };

  const r = obj(raw, '(Wurzel)');
  if (r.version !== 1) fail('version', 'muss 1 sein');

  const stations = list<Station>(r.stations, 'stations', false, (e, p) => ({ pos: vec(obj(e, p).pos, `${p}.pos`) }));
  const areas = list<Area>(r.areas, 'areas', false, (e, p) => {
    const o = obj(e, p);
    return { ink: budget(o.ink, `${p}.ink`), boost: budget(o.boost, `${p}.boost`) };
  });
  if (areas.length !== stations.length) fail('areas', `braucht genau einen Eintrag je Station (${stations.length})`);

  const gifts = list(r.gifts, 'gifts', false, vec);
  if (gifts.length === 0) fail('gifts', 'braucht mindestens ein Geschenk');

  const obstacle = (e: unknown, p: string): Obstacle => {
    const o = obj(e, p);
    return { x: num(o.x, `${p}.x`), y: num(o.y, `${p}.y`), h: pos(o.h, `${p}.h`) };
  };

  let theme: Theme = { seed: 1, auroraHue: 150 };
  if (r.theme !== undefined) {
    const t = obj(r.theme, 'theme');
    theme = { seed: num(t.seed, 'theme.seed'), auroraHue: num(t.auroraHue, 'theme.auroraHue') };
  }

  return {
    version: 1,
    id: str(r.id, 'id'),
    name: str(r.name, 'name'),
    worldW: pos(r.worldW, 'worldW'),
    worldH: pos(r.worldH, 'worldH'),
    spawn: vec(r.spawn, 'spawn'),
    platforms: list(r.platforms, 'platforms', false, rect),
    stations,
    dismounts: list(r.dismounts, 'dismounts', true, rect),
    gifts,
    checkpoints: list(r.checkpoints, 'checkpoints', true, vec),
    icicles: list(r.icicles, 'icicles', true, obstacle),
    candies: list(r.candies, 'candies', true, obstacle),
    hazards: list<Hazard>(r.hazards, 'hazards', true, (e, p) => {
      const o = obj(e, p);
      return { kind: oneOf(o.kind, `${p}.kind`, ['icicle-hanging', 'tinsel'] as const), rect: rect(o.rect, `${p}.rect`) };
    }),
    movers: list<Mover>(r.movers, 'movers', true, (e, p) => {
      const o = obj(e, p);
      return { kind: oneOf(o.kind, `${p}.kind`, ['bell', 'crow'] as const), radius: pos(o.radius, `${p}.radius`), path: motion(o.path, `${p}.path`) };
    }),
    springs: list<Spring>(r.springs, 'springs', true, (e, p) => {
      const o = obj(e, p);
      return { pos: vec(o.pos, `${p}.pos`), angle: num(o.angle, `${p}.angle`), power: pos(o.power, `${p}.power`) };
    }),
    noDraw: list(r.noDraw, 'noDraw', true, rect),
    chimney: vec(r.chimney, 'chimney'),
    areas,
    theme,
    hints: list<Hint>(r.hints, 'hints', true, (e, p) => {
      const o = obj(e, p);
      return {
        at: rect(o.at, `${p}.at`),
        text: str(o.text, `${p}.text`),
        icon: oneOf(o.icon, `${p}.icon`, ['move', 'jump', 'station', 'draw', 'launch', 'chimney'] as const),
      };
    }),
  };
}
