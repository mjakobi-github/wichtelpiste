import type { LevelData } from '../../sim/types';
import type { LevelProgress } from '../../app/progress';
import { formatInk } from '../../app/flow';
import { icon, stars } from '../icons';
import { esc } from './common';

export type LevelTab = 'menu' | 'mine' | 'gift';

export interface LevelSelectData {
  tab: LevelTab;
  menu: { level: LevelData; progress: LevelProgress }[];
  mine: { uid: string; level: LevelData; progress: LevelProgress }[];
  gifts: { key: string; level: LevelData; from: string; challengeInk: number | null; progress: LevelProgress }[];
}

export interface LevelSelectHandlers {
  pickMenu(i: number): void;
  pickMine(uid: string): void;
  pickGift(key: string): void;
  deleteGift(key: string): void;
  tab(t: LevelTab): void;
  back(): void;
}

/** Levelauswahl mit Reitern: Levels · Meine · Geschenkt (die letzten beiden nur, wenn nicht leer). */
export function renderLevelSelect(el: HTMLElement, d: LevelSelectData, h: LevelSelectHandlers): void {
  const tab: LevelTab = (d.tab === 'mine' && !d.mine.length) || (d.tab === 'gift' && !d.gifts.length) ? 'menu' : d.tab;
  const best = (p: LevelProgress): string => `<span class="card-best">${icon('trophy')} ${formatInk(p.bestInk)}</span>`;
  let cards = '';
  if (tab === 'menu') {
    cards = d.menu.map((m, i) => `<button class="card" data-menu="${i}">
      <span class="card-num">${i + 1}</span>
      <span class="card-name">${esc(m.level.name)}</span>
      <span class="card-stars">${stars(m.progress.stars)}</span>${best(m.progress)}
    </button>`).join('');
  } else if (tab === 'mine') {
    cards = d.mine.map((m) => `<button class="card" data-mine="${esc(m.uid)}">
      <span class="card-num">${icon('pencil')}</span>
      <span class="card-name">${esc(m.level.name)}</span>
      <span class="card-stars">${stars(m.progress.stars)}</span>${best(m.progress)}
    </button>`).join('');
  } else {
    cards = d.gifts.map((g) => `<div class="card gift-card">
      <button class="card-hit" data-gift="${esc(g.key)}" aria-label="${esc(g.level.name)} spielen"></button>
      <span class="card-num">${icon('gift')}</span>
      <span class="card-name">${esc(g.level.name)}</span>
      <span class="card-from">${g.from ? `von ${esc(g.from)}` : 'geschenkt'}${g.challengeInk !== null ? ` · schlag ${formatInk(g.challengeInk)}` : ''}</span>
      <span class="card-stars">${stars(g.progress.stars)}</span>
      <button class="card-del" data-del="${esc(g.key)}" aria-label="Löschen">${icon('trash')}</button>
    </div>`).join('');
  }
  const tabs = d.mine.length || d.gifts.length
    ? `<div class="tabs">
        <button class="tab${tab === 'menu' ? ' on' : ''}" data-tab="menu">Levels</button>
        ${d.mine.length ? `<button class="tab${tab === 'mine' ? ' on' : ''}" data-tab="mine">Meine</button>` : ''}
        ${d.gifts.length ? `<button class="tab${tab === 'gift' ? ' on' : ''}" data-tab="gift">Geschenkt</button>` : ''}
      </div>`
    : '';
  el.innerHTML = `<div class="panel wide">
    <div class="panel-head"><button class="iconbtn" data-a="back" aria-label="Zurück">${icon('left')}</button><h2>Level wählen</h2>${tabs}</div>
    <div class="cards">${cards}</div>
  </div>`;
  el.querySelector('[data-a="back"]')?.addEventListener('click', h.back);
  el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => h.tab(b.dataset.tab as LevelTab)));
  el.querySelectorAll<HTMLElement>('[data-menu]').forEach((b) => b.addEventListener('click', () => h.pickMenu(Number(b.dataset.menu))));
  el.querySelectorAll<HTMLElement>('[data-mine]').forEach((b) => b.addEventListener('click', () => h.pickMine(b.dataset.mine!)));
  el.querySelectorAll<HTMLElement>('[data-gift]').forEach((b) => b.addEventListener('click', () => h.pickGift(b.dataset.gift!)));
  el.querySelectorAll<HTMLElement>('[data-del]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); h.deleteGift(b.dataset.del!); }));
}
