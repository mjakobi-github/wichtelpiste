import { describe, expect, it } from 'vitest';
import { Input } from './input';

function keydown(code: string, tagName?: string): Event {
  const e = new Event('keydown', { cancelable: true });
  Object.defineProperty(e, 'code', { value: code });
  Object.defineProperty(e, 'repeat', { value: false });
  if (tagName) Object.defineProperty(e, 'target', { value: { tagName } });
  return e;
}

describe('Input-Tastensperre', () => {
  it('blockiert Backspace im Spiel (Seite soll nicht zurückspringen)', () => {
    const t = new EventTarget();
    new Input().attach(t);
    const e = keydown('Backspace');
    t.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('lässt Backspace, Leertaste und Pfeile in Eingabefeldern durch', () => {
    const t = new EventTarget();
    const input = new Input();
    const seen: string[] = [];
    input.onKey = (code) => seen.push(code);
    input.attach(t);
    for (const code of ['Backspace', 'Space', 'ArrowLeft']) {
      const e = keydown(code, 'INPUT');
      t.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
    }
    expect(seen).toEqual([]);
    expect(input.read().jumpPressed).toBe(false);
  });
});
