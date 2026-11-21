import { icon } from '../icons';
import { bindActions } from './common';

export interface PauseHandlers { resume: () => void; restart: () => void; levels: () => void; toggleSound: () => boolean }

/** Pause: Weiter / Neustart / Levelauswahl / Ton an-aus. */
export function renderPause(el: HTMLElement, muted: boolean, h: PauseHandlers, levelsLabel = 'Levelauswahl'): void {
  const sound = (m: boolean): string => `${icon(m ? 'soundOff' : 'soundOn')} Ton ${m ? 'aus' : 'an'}`;
  el.innerHTML = `<div class="panel">
    <h2>Pause</h2>
    <div class="col">
      <button class="primary" data-a="resume">${icon('play')} Weiter</button>
      <button data-a="restart">${icon('restart')} Neu starten</button>
      <button data-a="levels">${icon('levels')} ${levelsLabel}</button>
      <button data-a="sound">${sound(muted)}</button>
    </div>
  </div>`;
  bindActions(el, {
    resume: h.resume,
    restart: h.restart,
    levels: h.levels,
    sound: () => {
      const m = h.toggleSound();
      const b = el.querySelector('[data-a="sound"]');
      if (b) b.innerHTML = sound(m);
    },
  });
}
