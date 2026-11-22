import type { LevelData, Vec2 } from '../sim/types';
import type { FootInput } from '../sim/player';
import { Simulation } from '../sim/simulation';
import { SOLVE_DT } from './solveRunner';

/** Ergebnis einer Schlittenfahrt für die Wegsuche: Ankunftsort (zu Fuß) oder Sieg, eingesammelte Geschenke. */
export interface Ride { arrive: Vec2 | null; win: boolean; gifts: number[] }

export interface FootReport {
  /** Station i ist (zu Fuß, ggf. nach früheren Fahrten) erreichbar */
  stations: boolean[];
  /** Geschenk i lässt sich einsammeln und danach noch abliefern */
  gifts: boolean[];
  /** Schornstein erreichbar (unabhängig von Geschenken) */
  chimney: boolean;
  /** Mindestens ein Geschenk kommt in den Schornstein: Level gewinnbar */
  winnable: boolean;
  /** Erreichte Standorte (zum Anzeigen/Debuggen) */
  spots: Vec2[];
  /** Suche abgebrochen (zu groß) – Ergebnis dann unvollständig */
  truncated: boolean;
}

const CHIMNEY = -1;
const MAX_NODES = 700;
const SETTLE_SPEED = 5;
const MAX_FRAMES = 360;

type Outcome =
  | { kind: 'spot'; pos: Vec2; gifts: number[] }
  | { kind: 'station'; area: number; gifts: number[] }
  | { kind: 'chimney'; gifts: number[] }
  | { kind: 'dead' };

/** Ein Versuch: Eingaben je Bild (null = Eingabe vorbei), danach still stehen bis die Elfe ruht. */
function trial(level: LevelData, from: Vec2, input: (f: number, grounded: boolean) => FootInput | null): Outcome {
  const sim = new Simulation(level);
  sim.player.respawn(from);
  const gifts: number[] = [];
  let idleSince = -1;
  for (let f = 0; f < MAX_FRAMES; f++) {
    const inp = idleSince < 0 ? input(f, sim.player.grounded) : null;
    if (inp === null && idleSince < 0) idleSince = f;
    for (const e of sim.step(SOLVE_DT, inp ?? { move: 0, jumpHeld: false, jumpPressed: false })) {
      if (e.type === 'gift') gifts.push(e.index);
      if (e.type === 'crash') return { kind: 'dead' };
      if (e.type === 'board') return { kind: 'station', area: e.area, gifts };
      if (e.type === 'refuse' || e.type === 'win') return { kind: 'chimney', gifts };
    }
    const p = sim.player;
    if (idleSince >= 0 && f > idleSince && p.grounded && Math.abs(p.vel.x) < SETTLE_SPEED) {
      return { kind: 'spot', pos: { x: Math.round(p.pos.x), y: Math.round(p.pos.y) }, gifts };
    }
  }
  return { kind: 'dead' };
}

type Plan = (f: number, grounded: boolean) => FootInput | null;

/** Laufen und Springen in alle Richtungen, mit kurzem/langem Anlauf, kurz/lang gehalten, mit/ohne Lenken in der Luft. */
function plans(ice: boolean): Plan[] {
  const out: Plan[] = [];
  for (const d of [-1, 1] as const) {
    for (const n of [5, 14, 30]) out.push((f) => (f < n ? { move: d, jumpHeld: false, jumpPressed: false } : null));
    for (const run of ice ? [0, 12, 45] : [0, 10, 25]) {
      for (const hold of [6, 60]) {
        for (const air of [d, 0] as const) {
          out.push((f, grounded) => {
            if (f < run) return { move: d, jumpHeld: false, jumpPressed: false };
            if (f === run) return { move: d, jumpHeld: true, jumpPressed: true };
            if (f > run + 2 && grounded) return null;
            return { move: air, jumpHeld: f <= run + hold, jumpPressed: false };
          });
        }
      }
    }
  }
  out.push((f, grounded) => (f === 0 ? { move: 0, jumpHeld: true, jumpPressed: true } : f > 2 && grounded ? null : { move: 0, jumpHeld: true, jumpPressed: false }));
  return out;
}

const keyOf = (p: Vec2): string => `${Math.round(p.x / 24)},${Math.round(p.y / 12)}`;

/**
 * Sucht mit der echten Spielphysik, wohin die Elfe zu Fuß kommt (Laufen, Springen, Federn),
 * und verknüpft Stationen über die Schlittenfahrten `rides[i]` mit der Landezone.
 * Bewegte Gefahren werden ignoriert (auf die kann man warten).
 */
export function footReach(l: LevelData, rides: readonly (Ride | null)[]): FootReport {
  const level: LevelData = { ...l, movers: [] };
  const spots: Vec2[] = [];
  const index = new Map<string, number>();
  const edges: { from: number; to: number; gifts: number[] }[] = [];
  const stationNode = new Map<number, number>();
  const stations = l.stations.map(() => false);
  let chimney = false;
  let truncated = false;
  const queue: number[] = [];
  const iceAt = (p: Vec2): boolean => l.platforms.some((q) => q.ice && p.x + 15 >= q.x && p.x + 15 <= q.x + q.w && Math.abs(q.y - (p.y + 38)) < 4);

  // Knoten: Standorte (≥ 0); Stationen bekommen eigene Knoten (Index ab spots.length…, siehe nodeForStation)
  const nodeForSpot = (pos: Vec2): number => {
    const k = keyOf(pos);
    const have = index.get(k);
    if (have !== undefined) return have;
    if (spots.length >= MAX_NODES) { truncated = true; return -2; }
    spots.push(pos);
    const id = spots.length - 1;
    index.set(k, id);
    queue.push(id);
    return id;
  };
  const rideEdges: { area: number; node: number }[] = [];
  const nodeForStation = (area: number): number => {
    const have = stationNode.get(area);
    if (have !== undefined) return have;
    const id = 100000 + area;
    stationNode.set(area, id);
    stations[area] = true;
    rideEdges.push({ area, node: id });
    return id;
  };
  const link = (from: number, o: Outcome): void => {
    if (o.kind === 'dead') return;
    if (o.kind === 'chimney') { chimney = true; edges.push({ from, to: CHIMNEY, gifts: o.gifts }); return; }
    const to = o.kind === 'station' ? nodeForStation(o.area) : nodeForSpot(o.pos);
    if (to !== -2) edges.push({ from, to, gifts: o.gifts });
  };

  // Start: aus dem Spawn fallen lassen
  const START = 200000;
  link(START, trial(level, l.spawn, () => null));

  const run = (): void => {
    while (queue.length > 0) {
      const id = queue.shift()!;
      const pos = spots[id];
      for (const plan of plans(iceAt(pos))) link(id, trial(level, pos, plan));
    }
  };
  run();
  // Fahrten erschließen neue Gebiete; so lange, bis nichts Neues dazukommt
  for (let done = 0; done < rideEdges.length; done++) {
    const { area, node } = rideEdges[done];
    const r = rides[area];
    if (r?.win) link(node, { kind: 'chimney', gifts: r.gifts });
    else if (r?.arrive) {
      // Geschenke der Fahrt hängen an der Kante Station → Ankunft
      const o = trial(level, r.arrive, () => null);
      link(node, o.kind === 'dead' ? o : { ...o, gifts: [...r.gifts, ...o.gifts] });
    }
    run();
  }

  // Rückwärts: Von welchen Knoten kommt man noch zum Schornstein?
  const canDeliver = new Set<number>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of edges) {
      if (canDeliver.has(e.from)) continue;
      if (e.to === CHIMNEY || canDeliver.has(e.to)) { canDeliver.add(e.from); grew = true; }
    }
  }
  const gifts = l.gifts.map(() => false);
  for (const e of edges) {
    if (e.to !== CHIMNEY && !canDeliver.has(e.to)) continue;
    for (const g of e.gifts) gifts[g] = true;
  }
  return { stations, gifts, chimney, winnable: gifts.some(Boolean), spots, truncated };
}
