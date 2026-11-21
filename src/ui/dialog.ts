import { esc } from './screens/common';

/** Eigene Dialoge (keine Browser-confirm/prompt): blockieren nichts und sehen aus wie das Spiel. */
function open(root: HTMLElement, html: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'dialog';
  wrap.innerHTML = `<div class="panel dialog-panel">${html}</div>`;
  root.appendChild(wrap);
  return wrap;
}

export function confirmDialog(root: HTMLElement, o: { title: string; text: string; ok: string; cancel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const w = open(root, `<h2>${esc(o.title)}</h2><p>${esc(o.text)}</p>
      <div class="row"><button data-a="cancel">${esc(o.cancel ?? 'Abbrechen')}</button><button class="${o.danger ? 'danger-btn' : 'primary'}" data-a="ok">${esc(o.ok)}</button></div>`);
    const done = (v: boolean): void => { w.remove(); resolve(v); };
    w.querySelector('[data-a="ok"]')!.addEventListener('click', () => done(true));
    w.querySelector('[data-a="cancel"]')!.addEventListener('click', () => done(false));
    w.addEventListener('click', (e) => { if (e.target === w) done(false); });
  });
}

export function textDialog(root: HTMLElement, o: { title: string; text?: string; value: string; max: number; ok?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    const w = open(root, `<h2>${esc(o.title)}</h2>${o.text ? `<p>${esc(o.text)}</p>` : ''}
      <input class="dialog-input" type="text" maxlength="${o.max}" value="${esc(o.value)}">
      <div class="row"><button data-a="cancel">Abbrechen</button><button class="primary" data-a="ok">${esc(o.ok ?? 'OK')}</button></div>`);
    const input = w.querySelector('input')!;
    const done = (v: string | null): void => { w.remove(); resolve(v); };
    const ok = (): void => { const v = input.value.trim(); if (v) done(v); else input.focus(); };
    w.querySelector('[data-a="ok"]')!.addEventListener('click', ok);
    w.querySelector('[data-a="cancel"]')!.addEventListener('click', () => done(null));
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') done(null); });
    window.setTimeout(() => { input.focus(); input.select(); }, 50);
  });
}
