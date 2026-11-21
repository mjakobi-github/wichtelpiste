import { icon } from '../icons';
import { bindActions } from './common';

/** Titelbild über der animierten Winternacht. */
export function renderTitle(el: HTMLElement, onPlay: () => void): void {
  el.innerHTML = `<div class="title-screen">
    <div class="logo">${icon('sled', 'logo-sled')}<h1>Wichtelpiste</h1></div>
    <p class="tagline">Zeichne Pisten, sammle Geschenke, liefere sie durch den Schornstein.</p>
    <button class="primary hero" data-a="play">${icon('play')} Spielen</button>
  </div>`;
  bindActions(el, { play: onPlay });
}
