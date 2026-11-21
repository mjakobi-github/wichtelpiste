import type { WinResult } from '../../sim/events';
import { formatInk } from '../../app/flow';
import { icon } from '../icons';
import { bindActions } from './common';

export interface WinInfo { result: WinResult; newBestInk: boolean; bestInk: number | null; hasNext: boolean }

/** Siegbildschirm: Sterne fliegen nacheinander ein, Geschenke, Tinte, Rekord. */
export function renderWin(el: HTMLElement, w: WinInfo, h: { again: () => void; next: () => void; levels: () => void }): void {
  const r = w.result;
  let starRow = '';
  for (let i = 0; i < 3; i++) {
    starRow += `<span class="fly" style="animation-delay:${300 + i * 350}ms">${icon(i < r.stars ? 'star' : 'starEmpty', i < r.stars ? 'on' : 'off')}</span>`;
  }
  el.innerHTML = `<div class="panel win">
    <h2>Geliefert!</h2>
    <div class="win-stars">${starRow}</div>
    <div class="win-facts">
      <span>${icon('gift')} ${r.gifts} / ${r.giftTotal}</span>
      <span>${icon('ink')} ${formatInk(r.inkUsed)}</span>
      ${w.bestInk !== null ? `<span>${icon('trophy')} ${formatInk(w.bestInk)}</span>` : ''}
    </div>
    ${w.newBestInk ? '<div class="record">Neuer Rekord!</div>' : ''}
    <div class="row">
      <button data-a="again">${icon('restart')} Nochmal</button>
      ${w.hasNext ? `<button class="primary" data-a="next">${icon('play')} Weiter</button>` : ''}
      <button data-a="levels">${icon('levels')} Levelauswahl</button>
    </div>
  </div>`;
  bindActions(el, { again: h.again, next: h.next, levels: h.levels });
}
