import type { Simulation } from '../sim/simulation';
import type { Budget } from '../sim/types';

/** Anzeige: Tinte, Speedtinte, Geschenke, Levelname, kurze Meldungen. */
export class Hud {
  private readonly el: HTMLElement;
  private readonly inkBar: HTMLElement;
  private readonly boostBar: HTMLElement;
  private readonly inkWrap: HTMLElement;
  private readonly gifts: HTMLElement;
  private readonly label: HTMLElement;
  private readonly toastEl: HTMLElement;
  private toastTimer = 0;

  constructor(root: HTMLElement) {
    this.el = div(root, 'hud');
    this.label = div(this.el, 'hud-label');
    this.gifts = div(this.el, 'hud-gifts');
    this.inkWrap = div(this.el, 'hud-ink');
    this.inkBar = bar(this.inkWrap, 'ink');
    this.boostBar = bar(this.inkWrap, 'boost');
    this.toastEl = div(root, 'toast');
  }

  show(v: boolean): void {
    this.el.classList.toggle('hidden', !v);
  }

  update(sim: Simulation, levelNumber: number): void {
    const lv = sim.level;
    const n = lv.stations.length;
    this.label.textContent = `${levelNumber}. ${lv.name}${n > 1 && sim.mode === 'sled' ? ` · Abschnitt ${sim.activeArea + 1}/${n}` : ''}`;
    this.gifts.textContent = `🎁 ${sim.giftTaken.filter(Boolean).length} / ${lv.gifts.length}`;
    const area = lv.areas[sim.activeArea];
    this.inkWrap.classList.toggle('hidden', sim.mode !== 'sled');
    setBar(this.inkBar, sim.ink.remaining(sim.activeArea, false), area.ink);
    setBar(this.boostBar, sim.ink.remaining(sim.activeArea, true), area.boost);
    this.boostBar.parentElement!.classList.toggle('hidden', area.boost === 0);
  }

  toast(text: string, ms = 1400): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('visible'), ms);
  }
}

function div(parent: HTMLElement, cls: string): HTMLElement {
  const d = document.createElement('div');
  d.className = cls;
  parent.appendChild(d);
  return d;
}

function bar(parent: HTMLElement, kind: string): HTMLElement {
  const wrap = div(parent, `bar bar-${kind}`);
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
