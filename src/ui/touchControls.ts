import type { Input } from '../engine/input';
import { icon } from './icons';

/** Links/Rechts + Sprung für Touch-Geräte (per CSS nur bei grobem Zeiger sichtbar). */
export class TouchControls {
  private readonly el: HTMLElement;

  constructor(root: HTMLElement, input: Input) {
    this.el = document.createElement('div');
    this.el.className = 'touch';
    this.el.innerHTML = `
      <div class="cluster left">
        <button class="tbtn" data-k="left" aria-label="Nach links">${icon('left')}</button>
        <button class="tbtn" data-k="right" aria-label="Nach rechts">${icon('right')}</button>
      </div>
      <div class="cluster right">
        <button class="tbtn big" data-k="jump" aria-label="Springen">${icon('jump')}</button>
      </div>`;
    root.appendChild(this.el);
    this.el.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => input.bindButton(b, b.dataset.k as 'left' | 'right' | 'jump'));
  }

  show(v: boolean): void {
    this.el.classList.toggle('hidden', !v);
  }
}
