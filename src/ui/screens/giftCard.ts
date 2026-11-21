import { formatInk } from '../../app/flow';
import { icon } from '../icons';
import { esc } from './common';
import type { Gift } from '../../app/library';

/** Vorschaukarte für ein empfangenes Level: Spielen oder Später (gespeichert ist es schon). */
export function showGiftCard(root: HTMLElement, g: Gift, h: { play: () => void; later: () => void }): void {
  document.querySelector('.dialog.gift')?.remove();
  const w = document.createElement('div');
  w.className = 'dialog gift';
  w.innerHTML = `<div class="panel dialog-panel gift-panel">
    <div class="gift-icon">${icon('gift')}</div>
    <p class="gift-from">${g.from ? `Geschenkt von <b>${esc(g.from)}</b>` : 'Ein Level für dich'}</p>
    <h2>${esc(g.level.name)}</h2>
    ${g.challengeInk !== null ? `<p class="gift-challenge">${icon('trophy')} Schlag meine ${formatInk(g.challengeInk)}!</p>` : ''}
    <div class="row"><button data-a="later">Später</button><button class="primary" data-a="play">${icon('play')} Spielen</button></div>
    <p class="gift-note">Du findest es unter „Level wählen“ → „Geschenkt“.</p>
  </div>`;
  root.appendChild(w);
  w.querySelector('[data-a="play"]')!.addEventListener('click', () => { w.remove(); h.play(); });
  w.querySelector('[data-a="later"]')!.addEventListener('click', () => { w.remove(); h.later(); });
}
