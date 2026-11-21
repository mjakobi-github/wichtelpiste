import { describe, expect, it } from 'vitest';
import { PointerTool, type EditorAction, type PointerDeps } from './pointer';
import { newLevel } from './template';
import { handlesFor } from './handles';
import type { ElementRef } from './doc';
import type { LevelData } from '../sim/types';

function setup(opts: { placing?: { kind: 'gift' } | null; selected?: ElementRef | null } = {}) {
  const state = { level: newLevel() as LevelData, selected: opts.selected ?? null, placing: opts.placing ?? null };
  const deps: PointerDeps = {
    level: () => state.level,
    selected: () => state.selected,
    placing: () => state.placing,
    scale: () => 1,
    snap: () => true,
    toWorld: (x, y) => ({ x, y }),
  };
  const tool = new PointerTool(deps);
  const none = { shift: false, alt: false, pan: false };
  const at = (x: number, y: number) => ({ p: { x, y }, s: { x, y } });
  return { state, tool, none, at };
}

const types = (a: EditorAction[]) => a.map((x) => x.type);

describe('PointerTool', () => {
  it('Antippen mit Baustein → place, gerastert', () => {
    const { tool, none } = setup({ placing: { kind: 'gift' } });
    tool.down({ x: 1003, y: 207 }, none, 1);
    const a = tool.up({ x: 1003, y: 207 }, none, 1);
    expect(a).toEqual([{ type: 'place', kind: 'gift', variant: undefined, at: { x: 1000, y: 210 }, keep: false }]);
  });

  it('Umschalt hält den Baustein', () => {
    const { tool } = setup({ placing: { kind: 'gift' } });
    const m = { shift: true, alt: false, pan: false };
    tool.down({ x: 1000, y: 200 }, m, 1);
    expect(tool.up({ x: 1000, y: 200 }, m, 1)[0]).toMatchObject({ type: 'place', keep: true });
  });

  it('Antippen auf Element → select', () => {
    const { tool, none, state } = setup();
    const g = state.level.gifts[0];
    tool.down(g, none, 1);
    expect(tool.up({ x: g.x + 2, y: g.y + 1 }, none, 1)).toEqual([{ type: 'select', ref: { kind: 'gift', index: 0 } }]);
  });

  it('Antippen ins Leere → Auswahl weg', () => {
    const { tool, none } = setup({ selected: { kind: 'gift', index: 0 } });
    tool.down({ x: 1000, y: 100 }, none, 1);
    expect(tool.up({ x: 1000, y: 100 }, none, 1)).toEqual([{ type: 'select', ref: null }]);
  });

  it('Griff ziehen → previews, genau ein commit', () => {
    const ref: ElementRef = { kind: 'platform', index: 0 };
    const { tool, none, state } = setup({ selected: ref });
    const se = handlesFor(state.level, ref).find((h) => h.id === 'se')!.pos;
    const out: EditorAction[] = [];
    out.push(...tool.down(se, none, 1));
    out.push(...tool.move({ x: se.x + 20, y: se.y }, none, 1));
    out.push(...tool.move({ x: se.x + 43, y: se.y + 7 }, none, 1));
    out.push(...tool.up({ x: se.x + 43, y: se.y + 7 }, none, 1));
    expect(types(out)).toEqual(['preview', 'preview', 'commit']);
    const last = out.at(-1) as Extract<EditorAction, { type: 'commit' }>;
    expect(last.level.platforms[0].w).toBe(state.level.platforms[0].w + 40);
  });

  it('Alt → ohne Raster', () => {
    const ref: ElementRef = { kind: 'platform', index: 0 };
    const { tool, state } = setup({ selected: ref });
    const alt = { shift: false, alt: true, pan: false };
    const se = handlesFor(state.level, ref).find((h) => h.id === 'se')!.pos;
    tool.down(se, alt, 1);
    tool.move({ x: se.x + 43, y: se.y }, alt, 1);
    const c = tool.up({ x: se.x + 43, y: se.y }, alt, 1)[0] as Extract<EditorAction, { type: 'commit' }>;
    expect(c.level.platforms[0].w).toBe(state.level.platforms[0].w + 43);
  });

  it('Element ziehen wählt es aus und verschiebt es', () => {
    const { tool, none, state } = setup();
    const g = state.level.gifts[0];
    const a = [...tool.down(g, none, 1), ...tool.move({ x: g.x + 30, y: g.y }, none, 1), ...tool.up({ x: g.x + 30, y: g.y }, none, 1)];
    expect(types(a)).toEqual(['select', 'preview', 'commit']);
    expect((a[2] as Extract<EditorAction, { type: 'commit' }>).level.gifts[0].x).toBe(g.x + 30);
  });

  it('zweiter Finger bricht Ziehen ab: Ausgangsstand, kein commit', () => {
    const { tool, none, state } = setup();
    const g = state.level.gifts[0];
    tool.down(g, none, 1);
    tool.move({ x: g.x + 30, y: g.y }, none, 1);
    const a = tool.down({ x: g.x + 200, y: g.y }, none, 2);
    expect(a).toContainEqual({ type: 'preview', level: state.level });
    const rest = [...tool.move({ x: g.x + 250, y: g.y }, none, 2), ...tool.up({ x: g.x + 250, y: g.y }, none, 2), ...tool.up({ x: g.x + 30, y: g.y }, none, 1)];
    expect(types(rest)).not.toContain('commit');
    expect(types(rest)).toContain('zoom');
  });

  it('Ziehen im Leeren oder mit Verschieben-Modus → pan', () => {
    const { tool, none } = setup();
    tool.down({ x: 1000, y: 100 }, none, 1);
    expect(tool.move({ x: 1020, y: 110 }, none, 1)).toEqual([{ type: 'pan', dx: 20, dy: 10 }]);
    const { tool: t2, state } = setup();
    const g = state.level.gifts[0];
    const pan = { shift: false, alt: false, pan: true };
    t2.down(g, pan, 1);
    expect(t2.move({ x: g.x + 10, y: g.y }, pan, 1)).toEqual([{ type: 'pan', dx: 10, dy: 0 }]);
  });
});
