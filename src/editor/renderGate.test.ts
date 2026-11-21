import { describe, expect, it } from 'vitest';
import { RenderGate } from './renderGate';

describe('RenderGate', () => {
  it('frisch: zeichnen, ein Nachlauf-Bild, dann Ruhe', () => {
    const g = new RenderGate();
    expect([g.take(), g.take(), g.take(), g.take()]).toEqual([true, true, false, false]);
  });
  it('nach invalidate wieder zeichnen', () => {
    const g = new RenderGate();
    g.take(); g.take(); g.take();
    g.invalidate('camera');
    expect([g.take(), g.take(), g.take()]).toEqual([true, true, false]);
  });
  it('mehrere invalidate zwischen zwei Bildern zählen einmal', () => {
    const g = new RenderGate();
    g.take(); g.take(); g.take();
    g.invalidate('level'); g.invalidate('selection'); g.invalidate('view');
    expect([g.take(), g.take(), g.take()]).toEqual([true, true, false]);
  });
  it('invalidate während des Nachlaufs verlängert ihn', () => {
    const g = new RenderGate();
    g.take();
    g.invalidate('camera');
    expect([g.take(), g.take(), g.take()]).toEqual([true, true, false]);
  });
});
