import { icon } from './icons';

const QUERY = '(orientation: portrait) and (pointer: coarse)';

/** „Bitte Handy drehen“ im Hochformat (nur Touch-Geräte); meldet den Wechsel. */
export class RotateHint {
  private readonly el: HTMLElement;
  private readonly mq: MediaQueryList | null;

  constructor(root: HTMLElement, onPortrait: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'rotate-hint';
    this.el.innerHTML = `<div>${icon('rotate', 'rotate-phone')}<p>Bitte Handy drehen</p></div>`;
    root.appendChild(this.el);
    this.mq = typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
    const apply = (): void => {
      const p = this.portrait;
      this.el.classList.toggle('visible', p);
      if (p) onPortrait();
    };
    this.mq?.addEventListener('change', apply);
    apply();
  }

  get portrait(): boolean { return this.mq?.matches ?? false; }
}
