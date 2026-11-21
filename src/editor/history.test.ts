import { describe, expect, it } from 'vitest';
import { History } from './history';
import { newLevel } from './template';
import type { LevelData } from '../sim/types';

const lv = (name: string): LevelData => ({ ...newLevel(), name });

describe('History', () => {
  it('undo/redo', () => {
    const h = new History<LevelData>(lv('a'));
    h.push(lv('b'));
    h.push(lv('c'));
    expect(h.undo()?.name).toBe('b');
    expect(h.undo()?.name).toBe('a');
    expect(h.undo()).toBeNull();
    expect(h.redo()?.name).toBe('b');
    expect(h.current.name).toBe('b');
  });

  it('push nach undo verwirft den Redo-Zweig', () => {
    const h = new History<LevelData>(lv('a'));
    h.push(lv('b'));
    h.push(lv('c'));
    h.undo();
    h.undo();
    h.push(lv('x'));
    expect(h.canRedo).toBe(false);
    expect(h.undo()?.name).toBe('a');
  });

  it('gleicher Stand wird nicht doppelt gespeichert', () => {
    const h = new History<LevelData>(lv('a'));
    h.push(lv('a'));
    expect(h.canUndo).toBe(false);
  });

  it('Limit', () => {
    const h = new History<LevelData>(lv('0'), 100);
    for (let i = 1; i <= 150; i++) h.push(lv(String(i)));
    let n = 0;
    while (h.undo()) n++;
    expect(n).toBe(100);
    expect(h.current.name).toBe('50');
  });
});
