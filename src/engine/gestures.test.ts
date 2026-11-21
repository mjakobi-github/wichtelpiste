// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Gestures, type ToolName } from './gestures';
import type { Command } from '../sim/events';

function ptr(type: string, id: number, x: number, y: number, pointerType = 'touch'): Event {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: id });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  return e;
}

function setup(tool: ToolName = 'draw', enabled = true) {
  const el = document.createElement('div');
  const sent: Command[] = [];
  const pans: [number, number][] = [];
  const zooms: [number, number, number][] = [];
  const state = { tool, enabled };
  new Gestures(el, {
    tool: () => state.tool,
    enabled: () => state.enabled,
    toWorld: (x, y) => ({ x: x * 2, y: y * 2 }),
    send: (c) => sent.push(c),
    pan: (dx, dy) => pans.push([dx, dy]),
    zoom: (f, x, y) => zooms.push([f, x, y]),
  });
  return { el, sent, pans, zooms, state };
}

describe('Gestures', () => {
  it('ein Finger zeichnet: begin, move, end in Weltkoordinaten', () => {
    const { el, sent } = setup();
    el.dispatchEvent(ptr('pointerdown', 1, 10, 10));
    el.dispatchEvent(ptr('pointermove', 1, 20, 10));
    el.dispatchEvent(ptr('pointerup', 1, 20, 10));
    expect(sent).toEqual([
      { type: 'strokeBegin', p: { x: 20, y: 20 }, boost: false },
      { type: 'strokeMove', p: { x: 40, y: 20 } },
      { type: 'strokeEnd' },
    ]);
  });

  it('Speedtinte setzt boost', () => {
    const { el, sent } = setup('boost');
    el.dispatchEvent(ptr('pointerdown', 1, 10, 10));
    expect(sent[0]).toEqual({ type: 'strokeBegin', p: { x: 20, y: 20 }, boost: true });
  });

  it('zweiter Finger: Strich wird verworfen, Kneifen zoomt und verschiebt um die Mitte', () => {
    const { el, sent, zooms, pans } = setup();
    el.dispatchEvent(ptr('pointerdown', 1, 100, 100));
    el.dispatchEvent(ptr('pointerdown', 2, 200, 100));
    expect(sent).toEqual([{ type: 'strokeBegin', p: { x: 200, y: 200 }, boost: false }, { type: 'strokeCancel' }]);
    // Abstand 100 → 200, Mitte bleibt bei x=150
    el.dispatchEvent(ptr('pointermove', 1, 50, 100));
    el.dispatchEvent(ptr('pointermove', 2, 250, 100));
    const f = zooms.reduce((a, z) => a * z[0], 1);
    expect(f).toBeCloseTo(2, 5);
    expect(zooms[zooms.length - 1][1]).toBeCloseTo(150, 5);
    // beide Finger nach rechts: verschieben
    el.dispatchEvent(ptr('pointermove', 1, 60, 100));
    expect(pans[pans.length - 1][0]).toBeCloseTo(5, 5);
    el.dispatchEvent(ptr('pointerup', 1, 60, 100));
    el.dispatchEvent(ptr('pointermove', 2, 270, 100));
    el.dispatchEvent(ptr('pointerup', 2, 270, 100));
    // nach dem Kneifen zeichnet der übrige Finger nicht weiter
    expect(sent.filter((c) => c.type === 'strokeMove')).toEqual([]);
    // neuer Strich danach möglich
    el.dispatchEvent(ptr('pointerdown', 3, 5, 5));
    expect(sent[sent.length - 1]).toEqual({ type: 'strokeBegin', p: { x: 10, y: 10 }, boost: false });
  });

  it('Mausrad zoomt um den Zeiger', () => {
    const { el, zooms } = setup();
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 30, clientY: 40 }));
    expect(zooms.length).toBe(1);
    expect(zooms[0][0]).toBeGreaterThan(1);
    expect(zooms[0].slice(1)).toEqual([30, 40]);
  });

  it('pointercancel beendet den Strich', () => {
    const { el, sent } = setup();
    el.dispatchEvent(ptr('pointerdown', 1, 10, 10));
    el.dispatchEvent(ptr('pointercancel', 1, 10, 10));
    expect(sent[sent.length - 1]).toEqual({ type: 'strokeEnd' });
    // danach kann ein neuer Strich beginnen
    el.dispatchEvent(ptr('pointerdown', 3, 5, 5));
    expect(sent[sent.length - 1]).toEqual({ type: 'strokeBegin', p: { x: 10, y: 10 }, boost: false });
  });

  it('Radierer sendet erase', () => {
    const { el, sent } = setup('eraser');
    el.dispatchEvent(ptr('pointerdown', 1, 10, 10));
    el.dispatchEvent(ptr('pointermove', 1, 12, 10));
    expect(sent).toEqual([{ type: 'erase', p: { x: 20, y: 20 } }, { type: 'erase', p: { x: 24, y: 20 } }]);
  });

  it('Verschieben meldet Bildschirm-Deltas', () => {
    const { el, pans, sent } = setup('pan');
    el.dispatchEvent(ptr('pointerdown', 1, 10, 10));
    el.dispatchEvent(ptr('pointermove', 1, 15, 7));
    expect(pans).toEqual([[5, -3]]);
    expect(sent).toEqual([]);
  });

  it('deaktiviert: keine Befehle', () => {
    const { el, sent } = setup('draw', false);
    el.dispatchEvent(ptr('pointerdown', 1, 10, 10));
    el.dispatchEvent(ptr('pointermove', 1, 20, 10));
    el.dispatchEvent(ptr('pointerup', 1, 20, 10));
    expect(sent).toEqual([]);
  });

  it('rechte Maustaste zeichnet nicht', () => {
    const { el, sent } = setup();
    const e = new MouseEvent('pointerdown', { clientX: 1, clientY: 1, button: 2 });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    Object.defineProperty(e, 'pointerType', { value: 'mouse' });
    el.dispatchEvent(e);
    expect(sent).toEqual([]);
  });
});
