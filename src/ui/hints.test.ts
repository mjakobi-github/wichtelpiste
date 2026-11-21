import { describe, expect, it } from 'vitest';
import type { Hint } from '../sim/types';
import { activeHint } from './hints';

const at = { x: 0, y: 0, w: 100, h: 100 };
const inside = { x: 50, y: 50 };
const outside = { x: 500, y: 50 };
const h = (icon: Hint['icon']): Hint => ({ at, text: icon, icon });

describe('activeHint', () => {
  it('move/jump/station: zu Fuß innerhalb von at', () => {
    for (const icon of ['move', 'jump', 'station'] as const) {
      expect(activeHint([h(icon)], inside, 'foot', 'plan', 0)?.icon).toBe(icon);
      expect(activeHint([h(icon)], inside, 'sled', 'plan', 0)).toBeNull();
    }
  });

  it('außerhalb von at → null', () => {
    expect(activeHint([h('move')], outside, 'foot', 'plan', 0)).toBeNull();
    expect(activeHint([h('draw')], outside, 'sled', 'plan', 0)).toBeNull();
  });

  it('draw: nur beim Planen und solange nichts gezeichnet ist', () => {
    expect(activeHint([h('draw')], inside, 'sled', 'plan', 0)?.icon).toBe('draw');
    expect(activeHint([h('draw')], inside, 'sled', 'plan', 1)).toBeNull();
    expect(activeHint([h('draw')], inside, 'sled', 'ride', 0)).toBeNull();
    expect(activeHint([h('draw')], inside, 'foot', 'plan', 0)).toBeNull();
  });

  it('launch: nur beim Planen mit mindestens einer Linie', () => {
    expect(activeHint([h('launch')], inside, 'sled', 'plan', 2)?.icon).toBe('launch');
    expect(activeHint([h('launch')], inside, 'sled', 'plan', 0)).toBeNull();
    expect(activeHint([h('launch')], inside, 'sled', 'ride', 2)).toBeNull();
  });

  it('chimney: zu Fuß und beim Planen, nie während der Fahrt', () => {
    expect(activeHint([h('chimney')], inside, 'foot', 'plan', 0)?.icon).toBe('chimney');
    expect(activeHint([h('chimney')], inside, 'sled', 'plan', 0)?.icon).toBe('chimney');
    expect(activeHint([h('chimney')], inside, 'sled', 'ride', 0)).toBeNull();
  });

  it('nimmt den ersten passenden Hinweis', () => {
    const list = [h('draw'), h('launch')];
    expect(activeHint(list, inside, 'sled', 'plan', 0)?.icon).toBe('draw');
    expect(activeHint(list, inside, 'sled', 'plan', 1)?.icon).toBe('launch');
  });
});
