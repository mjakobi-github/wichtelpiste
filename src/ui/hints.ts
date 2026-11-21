import type { Hint, Vec2 } from '../sim/types';
import { icon } from './icons';

const FOOT_ONLY: ReadonlySet<Hint['icon']> = new Set(['move', 'jump', 'station']);

/**
 * Aktiver Einführungs-Hinweis: der erste, dessen `at` den Spieler (zu Fuß) bzw.
 * die aktive Station (Schlitten) enthält. draw nur beim Planen ohne Linie,
 * launch nur beim Planen mit Linie; während der Fahrt nie ein Hinweis.
 */
export function activeHint(hints: Hint[], playerCenter: Vec2, mode: 'foot' | 'sled', phase: 'plan' | 'ride', strokes: number): Hint | null {
  if (mode === 'sled' && phase === 'ride') return null;
  for (const h of hints) {
    const a = h.at;
    if (playerCenter.x < a.x || playerCenter.x > a.x + a.w || playerCenter.y < a.y || playerCenter.y > a.y + a.h) continue;
    if (FOOT_ONLY.has(h.icon) && mode !== 'foot') continue;
    if (h.icon === 'draw' && (mode !== 'sled' || strokes !== 0)) continue;
    if (h.icon === 'launch' && (mode !== 'sled' || strokes === 0)) continue;
    return h;
  }
  return null;
}

/** Hand-Animation je Hinweis: wo sie tippt/wischt (CSS-Klasse). */
const GESTURE: Record<Hint['icon'], string> = {
  move: 'g-move', jump: 'g-jump', station: 'g-bounce', draw: 'g-swipe', launch: 'g-launch', chimney: 'g-bounce',
};

/** Kurzer Hinweis-Text oben + animierte Hand am passenden Bedienelement. */
export class HintView {
  private readonly bubble: HTMLElement;
  private readonly hand: HTMLElement;
  private current: Hint | null = null;

  constructor(root: HTMLElement) {
    this.bubble = document.createElement('div');
    this.bubble.className = 'hint';
    this.hand = document.createElement('div');
    this.hand.className = 'hint-hand';
    this.hand.innerHTML = icon('finger');
    root.append(this.bubble, this.hand);
  }

  show(h: Hint | null): void {
    if (h === this.current) return;
    this.current = h;
    this.bubble.classList.toggle('visible', h !== null);
    this.hand.className = 'hint-hand';
    if (!h) return;
    this.bubble.textContent = h.text;
    void this.hand.offsetWidth; // Animation neu starten
    this.hand.classList.add('visible', GESTURE[h.icon]);
  }
}
