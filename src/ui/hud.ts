import type { Simulation } from '../sim/simulation';
import type { Budget } from '../sim/types';
import { icon } from './icons';

/** Anzeige: Tinte, Speedtinte, Geschenke, Levelname, kurze Meldungen. */
export class Hud {
  private readonly el: HTMLElement;
  private readonly inkBar: HTMLElement;
  private readonly boostBar: HTMLElement;
  private readonly inkWrap: HTMLElement;
  private readonly gifts: HTMLElement;
  private readonly label: HTMLElement;
  private readonly giftCount: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private toastTimer = 0;
  private bannerTimer = 0;

  constructor(root: HTMLElement) {
    this.el = div(root, 'hud');
    this.label = div(this.el, 'hud-label');
    this.gifts = div(this.el, 'hud-gifts');
    this.gifts.innerHTML = icon('gift');
    this.giftCount = div(this.gifts, 'hud-count');
    this.inkWrap = div(this.el, 'hud-ink');
    this.inkBar = bar(this.inkWrap, 'ink', icon('pencil'));
    this.boostBar = bar(this.inkWrap, 'boost', icon('rocket'));
    this.toastEl = div(root, 'toast');
    this.bannerEl = div(root, 'banner');
  }

  show(v: boolean): void {
    this.el.classList.toggle('hidden', !v);
  }

  update(sim: Simulation, levelNumber: number): void {
    const lv = sim.level;
    const n = lv.stations.length;
    this.label.textContent = `${levelNumber > 0 ? `${levelNumber}.` : 'Probe:'} ${lv.name}${n > 1 && sim.mode === 'sled' ? ` · Abschnitt ${sim.activeArea + 1}/${n}` : ''}`;
    const count = `${sim.giftTaken.filter(Boolean).length} / ${lv.gifts.length}`;
    if (this.giftCount.textContent !== count) {
      if (this.giftCount.textContent) {
        // Animation neu starten: Klasse entfernen, Reflow erzwingen, wieder setzen
        this.gifts.classList.remove('bump');
        void this.gifts.offsetWidth;
        this.gifts.classList.add('bump');
      }
      this.giftCount.textContent = count;
    }
    const area = lv.areas[sim.activeArea];
    this.inkWrap.classList.toggle('hidden', sim.mode !== 'sled');
    setBar(this.inkBar, sim.ink.remaining(sim.activeArea, false), area.ink);
    setBar(this.boostBar, sim.ink.remaining(sim.activeArea, true), area.boost);
    this.boostBar.parentElement!.parentElement!.classList.toggle('hidden', area.boost === 0);
  }

  toast(text: string, ms = 1400): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('visible'), ms);
  }

  /** Level-Einblendung: Name + Ziel, blendet nach ms aus. */
  banner(title: string, sub: string, ms = 2200): void {
    this.bannerEl.innerHTML = `<h2></h2><p></p>`;
    this.bannerEl.querySelector('h2')!.textContent = title;
    this.bannerEl.querySelector('p')!.textContent = sub;
    this.bannerEl.classList.add('visible');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove('visible'), ms);
  }

  hideBanner(): void {
    window.clearTimeout(this.bannerTimer);
    this.bannerEl.classList.remove('visible');
  }
}

function div(parent: HTMLElement, cls: string): HTMLElement {
  const d = document.createElement('div');
  d.className = cls;
  parent.appendChild(d);
  return d;
}

function bar(parent: HTMLElement, kind: string, iconSvg: string): HTMLElement {
  const row = div(parent, `bar-row bar-row-${kind}`);
  row.innerHTML = iconSvg;
  const wrap = div(row, `bar bar-${kind}`);
  return div(wrap, 'bar-fill');
}

function setBar(fill: HTMLElement, rest: Budget, max: Budget): void {
  if (rest === 'unlimited' || max === 'unlimited' || max <= 0) {
    fill.style.width = '100%';
    fill.parentElement!.classList.remove('low');
    return;
  }
  const f = Math.max(0, Math.min(1, rest / max));
  fill.style.width = `${f * 100}%`;
  fill.parentElement!.classList.toggle('low', f < 0.2);
}
