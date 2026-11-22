import { Container, Graphics, Text } from 'pixi.js';
import type { LevelData, Mover, Rect, Spring, Vec2 } from '../sim/types';
import { moverPosition, stationDir } from '../sim/elements';
import { getElement, listElements, type ElementKind, type ElementRef } from './doc';
import { elementBounds, handlesFor } from './handles';

const COLOR: Record<ElementKind, number> = {
  platform: 0xffffff, spawn: 0x7dffb0, station: 0xffd27a, dismount: 0x40ff90, gift: 0xffffff, checkpoint: 0xffc060,
  chimney: 0xffd27a, icicle: 0xbfefff, candy: 0xffffff, hazard: 0xff4060, mover: 0xff4060, spring: 0x40e0ff,
  noDraw: 0x8090ff, hint: 0xffd27a,
};
const SELECT = 0xffd27a;

export interface OverlayOpts {
  grid: boolean;
  warned: readonly ElementRef[];
  sketch: boolean;
  /** Sprungbögen (Weltkoordinaten) für die aktuelle Auswahl */
  jumps: readonly { origin: Vec2; arc: Vec2[] }[];
}
const GRID = 50;

/** Editor-Ebene in Weltkoordinaten: Umrisse, Auswahl, Griffe, Raster, Nummern. Linienbreiten in Bildschirm-px. */
export class EditorOverlay {
  readonly container = new Container();
  private readonly g = new Graphics();
  private readonly labels = new Container();
  private pool: Text[] = [];

  constructor() {
    this.container.addChild(this.g, this.labels);
  }

  draw(l: LevelData, selected: ElementRef | null, scale: number, view: Rect, opts: OverlayOpts): void {
    const { grid, warned, sketch, jumps } = opts;
    const g = this.g.clear();
    const px = (n: number): number => n / scale;
    let used = 0;
    const label = (text: string, x: number, y: number, color: number): void => {
      let t = this.pool[used];
      if (!t) {
        t = new Text({ text, style: { fontFamily: 'Fredoka Variable, Fredoka, sans-serif', fontSize: 16, fontWeight: '600', fill: color, stroke: { color: 0x000000, width: 4 } } });
        this.pool.push(t);
        this.labels.addChild(t);
      }
      t.text = text;
      t.style.fill = color;
      t.visible = true;
      t.scale.set(1 / scale);
      t.position.set(x, y);
      used++;
    };

    if (grid && scale >= 0.4) {
      const x0 = Math.floor(view.x / GRID) * GRID;
      const y0 = Math.floor(view.y / GRID) * GRID;
      for (let x = x0; x <= view.x + view.w; x += GRID) g.moveTo(x, view.y).lineTo(x, view.y + view.h);
      for (let y = y0; y <= view.y + view.h; y += GRID) g.moveTo(view.x, y).lineTo(view.x + view.w, y);
      g.stroke({ width: px(1), color: 0xffffff, alpha: 0.07 });
    }
    g.rect(0, 0, l.worldW, l.worldH).stroke({ width: px(2), color: 0x9fe8ff, alpha: 0.5 });

    if (sketch) this.sketchFill(l);
    for (const j of jumps) {
      const last = j.arc[j.arc.length - 1];
      g.poly([j.origin, ...j.arc, { x: last.x, y: j.origin.y }].flatMap((p) => [p.x, p.y])).fill({ color: 0x7dffb0, alpha: 0.08 });
      g.moveTo(j.arc[0].x, j.arc[0].y);
      for (const p of j.arc) g.lineTo(p.x, p.y);
      g.stroke({ width: px(2), color: 0x7dffb0, alpha: 0.8 });
    }

    const warnedSet = new Set(warned.map((r) => `${r.kind}:${r.index}`));
    for (const ref of listElements(l)) {
      const b = elementBounds(l, ref);
      const warn = warnedSet.has(`${ref.kind}:${ref.index}`);
      const alpha = ref.kind === 'platform' || ref.kind === 'hint' ? 0.35 : 0.75;
      const color = ref.kind === 'platform' && (getElement(l, ref) as { ice?: boolean }).ice ? 0x9fe8ff : COLOR[ref.kind];
      if (ref.kind === 'mover') {
        const m = getElement(l, ref) as Mover;
        const p = moverPosition(m.path, 0);
        g.circle(p.x, p.y, m.radius).stroke({ width: px(2), color, alpha });
      } else {
        g.rect(b.x, b.y, b.w, b.h).stroke({ width: px(ref.kind === 'dismount' || ref.kind === 'noDraw' ? 2 : 1.5), color, alpha });
      }
      if (warn) g.rect(b.x - px(4), b.y - px(4), b.w + px(8), b.h + px(8)).stroke({ width: px(2), color: 0xffa040 });
      if (ref.kind === 'station') {
        // Pfeil: In diese Richtung fährt der Schlitten los
        const d = stationDir(l, ref.index);
        label(d > 0 ? `Station ${ref.index + 1} →` : `← Station ${ref.index + 1}`, b.x, b.y - px(22), COLOR.station);
        const y = b.y + b.h / 2;
        const x0 = b.x + b.w / 2;
        const x1 = x0 + d * (b.w / 2 + px(28));
        g.moveTo(x0, y).lineTo(x1, y).moveTo(x1 - d * px(9), y - px(7)).lineTo(x1, y).lineTo(x1 - d * px(9), y + px(7))
          .stroke({ width: px(3), color: COLOR.station, alpha: 0.9 });
      }
      if (ref.kind === 'dismount') label(`Landezone ${ref.index + 1}`, b.x + px(4), b.y + px(4), COLOR.dismount);
      if (ref.kind === 'spawn') label('Start', b.x, b.y - px(22), COLOR.spawn);
      if (ref.kind === 'hint') label((getElement(l, ref) as { text: string }).text, b.x + px(4), b.y + px(4), COLOR.hint);
      if (ref.kind === 'spring') {
        const s = getElement(l, ref) as Spring;
        const h = handlesFor(l, ref)[0].pos;
        g.moveTo(s.pos.x, s.pos.y).lineTo(h.x, h.y).stroke({ width: px(2), color, alpha });
      }
    }

    if (selected) {
      const b = elementBounds(l, selected);
      g.rect(b.x, b.y, b.w, b.h).fill({ color: SELECT, alpha: 0.12 }).stroke({ width: px(3), color: SELECT });
      for (const h of handlesFor(l, selected)) {
        g.circle(h.pos.x, h.pos.y, px(8)).fill({ color: 0xffffff }).stroke({ width: px(2.5), color: 0x1a2350 });
      }
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  /** Skizze: Flächen und Objekte als einfache gefüllte Formen (ohne Spielgrafik). */
  private sketchFill(l: LevelData): void {
    const g = this.g;
    for (const ref of listElements(l)) {
      const b = elementBounds(l, ref);
      const e = getElement(l, ref) as { ice?: boolean };
      switch (ref.kind) {
        case 'platform': g.rect(b.x, b.y, b.w, b.h).fill({ color: e.ice ? 0x9fe8ff : 0x3a4678, alpha: e.ice ? 0.55 : 0.9 }); break;
        case 'gift': g.roundRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6, 4).fill({ color: 0xe83350 }); break;
        case 'chimney': g.rect(b.x, b.y + 10, b.w, b.h - 50).fill({ color: 0xa0523d }); break;
        case 'station': g.rect(b.x + 10, b.y + 40, b.w - 20, b.h - 60).fill({ color: 0xffd27a, alpha: 0.35 }); break;
        case 'checkpoint': g.rect(b.x + 10, b.y, 8, b.h).fill({ color: 0xffc060 }); break;
        case 'icicle': case 'candy': g.rect(b.x, b.y, b.w, b.h).fill({ color: ref.kind === 'icicle' ? 0xbfefff : 0xff9db0 }); break;
        case 'spring': g.rect(b.x, b.y, b.w, b.h).fill({ color: 0x40e0ff, alpha: 0.7 }); break;
        case 'hazard': g.rect(b.x, b.y, b.w, b.h).fill({ color: 0xff4060, alpha: 0.6 }); break;
        case 'mover': {
          const m = getElement(l, ref) as Mover;
          const p = moverPosition(m.path, 0);
          g.circle(p.x, p.y, m.radius).fill({ color: 0xff4060, alpha: 0.6 });
          break;
        }
        case 'noDraw': g.rect(b.x, b.y, b.w, b.h).fill({ color: 0x8090ff, alpha: 0.15 }); break;
        case 'dismount': g.rect(b.x, b.y, b.w, b.h).fill({ color: 0x40ff90, alpha: 0.08 }); break;
        default: break;
      }
    }
  }

  clear(): void {
    this.g.clear();
    for (const t of this.pool) t.visible = false;
  }
}
