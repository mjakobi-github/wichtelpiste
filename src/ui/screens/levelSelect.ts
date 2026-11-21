import type { LevelData } from '../../sim/types';
import type { LevelProgress } from '../../app/progress';
import { formatInk } from '../../app/flow';
import { icon, stars } from '../icons';
import { esc } from './common';

/** Levelauswahl als Karten: Nummer, Name, Sterne, Tinten-Bestwert. Alle Levels frei. */
export function renderLevelSelect(
  el: HTMLElement,
  levels: readonly LevelData[],
  progress: (lv: LevelData) => LevelProgress,
  onPick: (i: number) => void,
  onBack: () => void,
): void {
  const cards = levels.map((lv, i) => {
    const p = progress(lv);
    return `<button class="card" data-i="${i}">
      <span class="card-num">${i + 1}</span>
      <span class="card-name">${esc(lv.name)}</span>
      <span class="card-stars">${stars(p.stars)}</span>
      <span class="card-best">${icon('trophy')} ${formatInk(p.bestInk)}</span>
    </button>`;
  }).join('');
  el.innerHTML = `<div class="panel wide">
    <div class="panel-head"><button class="iconbtn" data-a="back" aria-label="Zurück">${icon('left')}</button><h2>Level wählen</h2></div>
    <div class="cards">${cards}</div>
  </div>`;
  el.querySelector('[data-a="back"]')?.addEventListener('click', onBack);
  el.querySelectorAll<HTMLElement>('[data-i]').forEach((b) => b.addEventListener('click', () => onPick(Number(b.dataset.i))));
}
