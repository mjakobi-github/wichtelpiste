import type { LevelData, Rect, Segment, Vec2 } from './types';
import type { Command, SimEvent } from './events';
import { Player, PLAYER_TUNING, type FootInput } from './player';
import { Sled } from './sled';
import { Ink } from './ink';
import {
  buildStatics, chimneyZone, hitsHazard, moverPosition, springImpulse, springZone, stationZone,
} from './elements';
import { clamp, dist, overlap, pointInRect } from './geometry';
import { computeStars } from './scoring';

const GIFT_PICKUP = 26;
const CHECKPOINT_RADIUS = 50;
const PLAYER_HAZARD_RADIUS = 14;
const SLED_HAZARD_RADIUS = 10;
const BOARD_COOLDOWN = 0.7;
const SPRING_COOLDOWN = 0.3;
const STUCK_SPEED = 30;
const STUCK_TIME = 1.2;
const REFUSE_COOLDOWN = 1.8;
const LAUNCH_SPEED = 120;
const FALL_MARGIN = 240;
const SIDE_MARGIN = 300;
const STREAK_WINDOW = 2;
/** Kommt der Schlitten so lange nicht weiter vom Start weg, startet die Fahrt neu (Schaukeln im Tal). */
const STALL_TIME = 2.5;
const STALL_PROGRESS = 10;
/** So weit (px) darf der Schlitten über die Landezone hinaus, bevor die Fahrt als verfehlt gilt. */
const MISS_MARGIN = 150;

/**
 * Spielregeln und Zustand eines Levels, ohne DOM.
 * Eingabe: FootInput je Tick + Befehle; Ausgabe: Ereignisse je Tick.
 */
export class Simulation {
  readonly player: Player;
  readonly sled = new Sled();
  readonly ink: Ink;

  mode: 'foot' | 'sled' = 'foot';
  phase: 'plan' | 'ride' = 'plan';
  activeArea = 0;
  giftTaken: boolean[];
  checkpointIdx = -1;
  respawnPos: Vec2;
  time = 0;
  moverClock = 0;
  won = false;

  private readonly solids: Rect[];
  private readonly staticSegs: Segment[];
  private queue: Command[] = [];
  private giftSnapshot: boolean[];
  /** Stand beim letzten LOS – für „zurück zum Zeichnen“ nach der Ankunft. */
  private rideSnapshot: { area: number; checkpointIdx: number; respawnPos: Vec2 } | null = null;
  private lastRideArea: number | null = null;
  private boardCooldown = 0;
  private stuckTime = 0;
  private bestReach = 0;
  private stallTime = 0;
  private refuseUntil = -1;
  private springCooldown: number[];
  private streak = 0;
  private lastGiftAt = -10;

  constructor(readonly level: LevelData) {
    const st = buildStatics(level);
    this.solids = st.solids;
    this.staticSegs = st.sledSegments;
    this.ink = new Ink(level.areas, level.noDraw);
    this.player = new Player(level.spawn);
    this.respawnPos = { ...level.spawn };
    this.giftTaken = level.gifts.map(() => false);
    this.giftSnapshot = [...this.giftTaken];
    this.springCooldown = level.springs.map(() => 0);
  }

  /** Ziel des Abschnitts: eigene Landezone (dismounts[i]) oder – ohne Eintrag – der Schornstein. */
  targetZone(area = this.activeArea): Rect | null {
    return this.level.dismounts[area] ?? null;
  }

  /** Darf man nach der Ankunft zurück an die letzte Station und neu planen? */
  get canReplan(): boolean {
    return this.mode === 'foot' && this.lastRideArea !== null && !this.won;
  }

  command(c: Command): void {
    this.queue.push(c);
  }

  moverPositions(): Vec2[] {
    return this.level.movers.map((m) => moverPosition(m.path, this.moverClock));
  }

  /** Nur für Tests/Lösbarkeit: direkt an einer Station einsteigen. */
  boardForTest(area: number): void {
    this.board(area, []);
  }

  step(dt: number, input: FootInput): SimEvent[] {
    const ev: SimEvent[] = [];
    if (this.won) {
      this.queue = [];
      return ev;
    }
    this.time += dt;
    this.moverClock += dt;
    this.boardCooldown = Math.max(0, this.boardCooldown - dt);
    this.springCooldown = this.springCooldown.map((c) => Math.max(0, c - dt));
    if (this.time - this.lastGiftAt > STREAK_WINDOW) this.streak = 0;

    const cmds = this.queue;
    this.queue = [];
    for (const c of cmds) this.apply(c, ev);

    if (this.mode === 'foot') this.stepFoot(dt, input, ev);
    else if (this.phase === 'ride') this.stepRide(dt, ev);
    return ev;
  }

  // ---------------------------------------------------------------- Befehle

  private canDraw(): boolean {
    return this.mode === 'sled' && this.phase === 'plan';
  }

  private apply(c: Command, ev: SimEvent[]): void {
    switch (c.type) {
      case 'strokeBegin': {
        if (!this.canDraw()) return;
        if (!this.ink.begin(this.activeArea, c.boost, c.p)) {
          const rest = this.ink.remaining(this.activeArea, c.boost);
          if (rest !== 'unlimited' && rest <= 0) ev.push({ type: 'inkEmpty', boost: c.boost });
          else ev.push({ type: 'blocked', pos: c.p });
        }
        return;
      }
      case 'strokeMove': {
        if (!this.canDraw()) return;
        const r = this.ink.extend(c.p);
        if (r === 'blocked') ev.push({ type: 'blocked', pos: c.p });
        if (r === 'empty') {
          const boost = this.ink.strokes[this.ink.strokes.length - 1]?.boost ?? false;
          ev.push({ type: 'inkEmpty', boost });
        }
        return;
      }
      case 'strokeEnd':
        this.ink.end();
        return;
      case 'strokeCancel':
        this.ink.cancel();
        return;
      case 'erase':
        if (this.canDraw()) this.ink.eraseAt(this.activeArea, c.p);
        return;
      case 'undo':
        if (this.canDraw()) this.ink.undo(this.activeArea);
        return;
      case 'clear':
        if (this.canDraw()) this.ink.clear(this.activeArea);
        return;
      case 'launch':
        if (!this.canDraw()) return;
        this.ink.end();
        this.phase = 'ride';
        this.giftSnapshot = [...this.giftTaken];
        this.rideSnapshot = { area: this.activeArea, checkpointIdx: this.checkpointIdx, respawnPos: { ...this.respawnPos } };
        this.moverClock = 0;
        this.stuckTime = 0;
        this.bestReach = 0;
        this.stallTime = 0;
        this.sled.reset(this.level.stations[this.activeArea].pos, { x: LAUNCH_SPEED * this.player.facing, y: 0 }, this.player.facing);
        ev.push({ type: 'launch' });
        return;
      case 'retry':
        if (this.mode === 'foot') this.respawnFoot();
        else if (this.phase === 'ride') this.restartRide();
        return;
      case 'replan': {
        const snap = this.rideSnapshot;
        if (!this.canReplan || !snap) return;
        this.giftTaken = [...this.giftSnapshot];
        this.checkpointIdx = snap.checkpointIdx;
        this.respawnPos = { ...snap.respawnPos };
        this.board(snap.area, ev);
        return;
      }
    }
  }

  // ---------------------------------------------------------------- Fuß

  private stepFoot(dt: number, input: FootInput, ev: SimEvent[]): void {
    const p = this.player;
    const fe = p.update(dt, input, this.solids);
    if (fe.jumped) ev.push({ type: 'jump' });
    if (fe.landed !== null) ev.push({ type: 'land', speed: fe.landed, pos: { x: p.center.x, y: p.pos.y + PLAYER_TUNING.size.h } });

    if (p.pos.y > this.level.worldH + FALL_MARGIN) {
      ev.push({ type: 'crash', pos: p.center, cause: 'fall' });
      this.respawnFoot();
      return;
    }
    if (hitsHazard(p.center, PLAYER_HAZARD_RADIUS, this.level, this.moverClock)) {
      ev.push({ type: 'crash', pos: p.center, cause: 'hazard' });
      this.respawnFoot();
      return;
    }

    this.level.springs.forEach((s, i) => {
      if (this.springCooldown[i] > 0 || p.vel.y < 0 || !overlap(p.aabb, springZone(s))) return;
      const imp = springImpulse(s);
      p.launch(p.vel.x + imp.x, Math.min(imp.y, -PLAYER_TUNING.springJump));
      this.springCooldown[i] = SPRING_COOLDOWN;
      ev.push({ type: 'spring', pos: { ...s.pos } });
    });

    this.collectGifts(p.center, ev);

    this.level.checkpoints.forEach((cp, i) => {
      if (i <= this.checkpointIdx || dist(cp, p.center) >= CHECKPOINT_RADIUS) return;
      this.checkpointIdx = i;
      this.respawnPos = { x: cp.x - PLAYER_TUNING.size.w / 2, y: cp.y - PLAYER_TUNING.size.h };
      ev.push({ type: 'checkpoint', pos: { ...cp } });
    });

    if (this.checkDelivery(p.center, ev)) return;

    if (this.boardCooldown <= 0 && p.grounded) {
      const i = this.level.stations.findIndex((s) => overlap(p.aabb, stationZone(s)));
      if (i >= 0) this.board(i, ev);
    }
  }

  private respawnFoot(): void {
    this.mode = 'foot';
    this.phase = 'plan';
    this.player.respawn(this.respawnPos);
    this.moverClock = 0;
  }

  // ---------------------------------------------------------------- Schlitten

  private board(area: number, ev: SimEvent[]): void {
    this.ink.end();
    this.lastRideArea = null;
    this.mode = 'sled';
    this.phase = 'plan';
    this.activeArea = area;
    this.moverClock = 0;
    this.sled.reset(this.level.stations[area].pos, { x: 0, y: 0 }, this.player.facing);
    ev.push({ type: 'board', area });
  }

  private stepRide(dt: number, ev: SimEvent[]): void {
    const s = this.sled;
    s.update(dt, this.staticSegs.concat(this.ink.segments()));
    const pos = s.pos;

    if (pos.y > this.level.worldH + FALL_MARGIN || pos.x < -SIDE_MARGIN || pos.x > this.level.worldW + SIDE_MARGIN) {
      ev.push({ type: 'crash', pos, cause: 'fall' });
      this.restartRide();
      return;
    }
    if (hitsHazard(pos, SLED_HAZARD_RADIUS, this.level, this.moverClock)) {
      ev.push({ type: 'crash', pos, cause: 'hazard' });
      this.restartRide();
      return;
    }

    this.level.springs.forEach((sp, i) => {
      if (this.springCooldown[i] > 0 || !pointInRect(pos, springZone(sp))) return;
      const imp = springImpulse(sp);
      s.launch(imp.x + s.vel.x * 0.3, imp.y);
      this.springCooldown[i] = SPRING_COOLDOWN;
      ev.push({ type: 'spring', pos: { ...sp.pos } });
    });

    this.collectGifts(pos, ev);
    const zone = this.targetZone();
    if (!zone) {
      if (this.checkDelivery(pos, ev)) return;
    } else {
      if (pointInRect(pos, zone)) {
        this.dismountAt({ x: pos.x, y: Math.min(pos.y - 42, zone.y + zone.h - 38) }, ev);
        return;
      }
      const st = this.level.stations[this.activeArea].pos;
      const dir = zone.x + zone.w / 2 >= st.x ? 1 : -1;
      const past = dir > 0 ? pos.x > zone.x + zone.w + MISS_MARGIN : pos.x < zone.x - MISS_MARGIN;
      if (past) {
        ev.push({ type: 'crash', pos, cause: 'missed' });
        this.restartRide();
        return;
      }
    }

    const reach = dist(pos, this.level.stations[this.activeArea].pos);
    if (reach > this.bestReach + STALL_PROGRESS) {
      this.bestReach = reach;
      this.stallTime = 0;
    } else {
      this.stallTime += dt;
    }

    if (s.speed < STUCK_SPEED) {
      this.stuckTime += dt;
      if (this.stuckTime > STUCK_TIME) {
        ev.push({ type: 'crash', pos, cause: 'stuck' });
        this.restartRide();
      }
      return;
    }
    this.stuckTime = 0;
    if (this.stallTime > STALL_TIME) {
      ev.push({ type: 'crash', pos, cause: 'stall' });
      this.restartRide();
    }
  }

  private restartRide(): void {
    this.giftTaken = [...this.giftSnapshot];
    this.phase = 'plan';
    this.moverClock = 0;
    this.stuckTime = 0;
    this.stallTime = 0;
    this.bestReach = 0;
    this.sled.reset(this.level.stations[this.activeArea].pos, { x: 0, y: 0 }, this.player.facing);
  }

  private dismountAt(pos: Vec2, ev: SimEvent[]): void {
    const v = this.sled.vel;
    this.mode = 'foot';
    this.phase = 'plan';
    this.player.respawn({ x: pos.x - PLAYER_TUNING.size.w / 2, y: pos.y });
    this.player.vel = { x: clamp(v.x * 0.3, -300, 300), y: 0 };
    if (Math.abs(v.x) > 5) this.player.facing = v.x > 0 ? 1 : -1;
    this.boardCooldown = BOARD_COOLDOWN;
    this.respawnPos = { ...this.player.pos };
    this.moverClock = 0;
    this.lastRideArea = this.activeArea;
    ev.push({ type: 'arrive', pos: { ...this.player.pos } });
  }

  // ---------------------------------------------------------------- Gemeinsam

  private collectGifts(p: Vec2, ev: SimEvent[]): void {
    this.level.gifts.forEach((g, i) => {
      if (this.giftTaken[i] || dist(g, p) >= GIFT_PICKUP) return;
      this.giftTaken[i] = true;
      ev.push({ type: 'gift', index: i, pos: { ...g }, streak: this.streak });
      this.streak++;
      this.lastGiftAt = this.time;
    });
  }

  private checkDelivery(p: Vec2, ev: SimEvent[]): boolean {
    if (!pointInRect(p, chimneyZone(this.level.chimney))) return false;
    const gifts = this.giftTaken.filter(Boolean).length;
    if (gifts === 0) {
      if (this.time > this.refuseUntil) {
        ev.push({ type: 'refuse' });
        this.refuseUntil = this.time + REFUSE_COOLDOWN;
      }
      return false;
    }
    const stars = computeStars(gifts, this.level.gifts.length);
    this.won = true;
    ev.push({
      type: 'win',
      result: { stars: stars as 1 | 2 | 3, gifts, giftTotal: this.level.gifts.length, inkUsed: Math.round(this.ink.usedTotal()) },
    });
    return true;
  }
}
