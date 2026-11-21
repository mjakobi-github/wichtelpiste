import { icon } from '../ui/icons';
import { esc } from '../ui/screens/common';
import type { ElementKind } from './doc';
import type { Field } from './fields';
import type { Issue } from './checks';

export interface PaletteEntry { kind: ElementKind; variant?: string; label: string }

export const PALETTE: readonly PaletteEntry[] = [
  { kind: 'platform', label: 'Dach' },
  { kind: 'platform', variant: 'ice', label: 'Eis' },
  { kind: 'spawn', label: 'Start' },
  { kind: 'station', label: 'Station' },
  { kind: 'dismount', label: 'Landezone' },
  { kind: 'gift', label: 'Geschenk' },
  { kind: 'checkpoint', label: 'Laterne' },
  { kind: 'chimney', label: 'Schornstein' },
  { kind: 'icicle', label: 'Eiszapfen' },
  { kind: 'candy', label: 'Zuckerstange' },
  { kind: 'spring', label: 'Feder' },
  { kind: 'hazard', variant: 'icicle-hanging', label: 'Hängezapfen' },
  { kind: 'hazard', variant: 'tinsel', label: 'Lametta' },
  { kind: 'mover', variant: 'bell', label: 'Glocke' },
  { kind: 'mover', variant: 'crow', label: 'Krähe' },
  { kind: 'noDraw', label: 'Zeichenverbot' },
  { kind: 'hint', label: 'Hinweis' },
];

export type TopAction = 'back' | 'undo' | 'redo' | 'grid' | 'pan' | 'test' | 'save' | 'export' | 'import' | 'level';

export interface UiHandlers {
  top(a: TopAction): void;
  palette(i: number | null): void;
  field(key: string, value: Field['value'], level: boolean): void;
  duplicate(): void;
  remove(): void;
  issue(i: number): void;
  suggest(): void;
  testFrom(v: number | null): void;
}

export interface StartChoice { draft: string | null; levels: { file: string; name: string }[] }
export interface StartHandlers { resume(): void; fresh(): void; open(i: number): void; importFile(): void }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
}

/** HTML-Oberfläche des Editors (Leisten, Eigenschaften, Prüfliste, Startdialog). */
export class EditorUi {
  readonly root: HTMLElement;
  private readonly topBtns = new Map<TopAction, HTMLButtonElement>();
  private readonly palBtns: HTMLButtonElement[] = [];
  private readonly selectBtn: HTMLButtonElement;
  private readonly side: HTMLElement;
  private readonly status: HTMLElement;
  private readonly issues: HTMLElement;
  private readonly fromSel: HTMLSelectElement;
  private readonly start: HTMLElement;
  readonly fileInput: HTMLInputElement;

  constructor(parent: HTMLElement, private readonly h: UiHandlers) {
    this.root = el('div', 'editor hidden', parent);
    const top = el('div', 'ed-top', this.root);
    const tb = (a: TopAction, html: string, title: string, cls = ''): void => {
      const b = el('button', `ed-btn ${cls}`, top);
      b.innerHTML = html;
      b.title = title;
      b.addEventListener('click', () => h.top(a));
      this.topBtns.set(a, b);
    };
    tb('back', icon('back'), 'Zurück zum Menü');
    tb('undo', icon('undo'), 'Rückgängig (Strg+Z)');
    tb('redo', icon('redo'), 'Wiederholen (Strg+Y)');
    tb('grid', icon('grid'), 'Raster an/aus (G)');
    tb('pan', icon('hand'), 'Kamera verschieben (Leertaste halten)');
    el('span', 'ed-gap', top);
    const testWrap = el('span', 'ed-test', top);
    const testBtn = el('button', 'ed-btn primary', testWrap);
    testBtn.innerHTML = `${icon('play')} Probespielen`;
    testBtn.title = 'Probespielen (T)';
    testBtn.addEventListener('click', () => h.top('test'));
    this.topBtns.set('test', testBtn);
    this.fromSel = el('select', 'ed-from', testWrap);
    this.fromSel.title = 'Wo die Probefahrt beginnt';
    this.fromSel.addEventListener('change', () => h.testFrom(this.fromSel.value === '' ? null : Number(this.fromSel.value)));
    tb('save', `${icon('save')} Ins Spiel speichern`, 'Level + Lösung nach src/levels schreiben (Strg+S)');
    tb('export', icon('download'), 'Als Datei exportieren');
    tb('import', icon('upload'), 'Datei importieren');
    tb('level', `${icon('settings')} Level`, 'Profi: Name, Weltgröße, Tinte, Polarlicht');

    const pal = el('div', 'ed-palette', this.root);
    this.selectBtn = el('button', 'ed-pal on', pal);
    this.selectBtn.innerHTML = `${icon('pointer')} Auswählen`;
    this.selectBtn.addEventListener('click', () => h.palette(null));
    PALETTE.forEach((p, i) => {
      const b = el('button', `ed-pal kind-${p.kind}`, pal);
      b.innerHTML = `<i class="sw"></i>${esc(p.label)}`;
      b.title = `${p.label} platzieren (Umschalt: mehrere)`;
      b.addEventListener('click', () => h.palette(i));
      this.palBtns.push(b);
    });

    this.side = el('div', 'ed-side', this.root);
    const bottom = el('div', 'ed-bottom', this.root);
    this.status = el('div', 'ed-status', bottom);
    this.issues = el('div', 'ed-issues', bottom);

    this.start = el('div', 'ed-start hidden', this.root);
    this.fileInput = el('input', 'hidden', this.root);
    this.fileInput.type = 'file';
    this.fileInput.accept = '.json,application/json';
  }

  show(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
  }

  setTop(state: { canUndo: boolean; canRedo: boolean; grid: boolean; pan: boolean; canSave: boolean; levelOpen: boolean; testable: boolean }): void {
    this.topBtns.get('undo')!.disabled = !state.canUndo;
    this.topBtns.get('redo')!.disabled = !state.canRedo;
    this.topBtns.get('grid')!.classList.toggle('on', state.grid);
    this.topBtns.get('pan')!.classList.toggle('on', state.pan);
    this.topBtns.get('save')!.classList.toggle('hidden', !state.canSave);
    this.topBtns.get('level')!.classList.toggle('on', state.levelOpen);
    this.topBtns.get('test')!.disabled = !state.testable;
  }

  setStations(n: number, from: number | null): void {
    const opts = [`<option value="">ab Start</option>`];
    for (let i = 0; i < n; i++) opts.push(`<option value="${i}">ab Station ${i + 1}</option>`);
    const html = opts.join('');
    if (this.fromSel.innerHTML !== html) this.fromSel.innerHTML = html;
    this.fromSel.value = from === null ? '' : String(from);
  }

  setPalette(active: number | null): void {
    this.selectBtn.classList.toggle('on', active === null);
    this.palBtns.forEach((b, i) => b.classList.toggle('on', i === active));
  }

  /** Eigenschaften oder Profi-Felder rechts. */
  setSide(title: string | null, fields: Field[], level: boolean, actions: boolean): void {
    if (title === null) {
      this.side.innerHTML = `<p class="ed-empty">Element antippen zum Bearbeiten.<br>Baustein links wählen und in die Welt tippen.</p>`;
      return;
    }
    this.side.innerHTML = `<h3>${esc(title)}</h3>`;
    const form = el('div', 'ed-fields', this.side);
    for (const f of fields) {
      const row = el('label', `ed-field ed-${f.type}`, form);
      el('span', '', row).textContent = f.label;
      if (f.type === 'select') {
        const s = el('select', '', row);
        s.innerHTML = (f.options ?? []).map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
        s.value = String(f.value);
        s.addEventListener('change', () => this.h.field(f.key, s.value, level));
      } else if (f.type === 'toggle') {
        const c = el('input', '', row);
        c.type = 'checkbox';
        c.checked = f.value === true;
        c.addEventListener('change', () => this.h.field(f.key, c.checked, level));
      } else {
        const i = el('input', '', row);
        i.type = f.type === 'number' ? 'number' : 'text';
        if (f.step !== undefined) i.step = String(f.step);
        if (f.min !== undefined) i.min = String(f.min);
        i.value = String(f.value);
        i.addEventListener('change', () => this.h.field(f.key, f.type === 'number' ? Number(i.value) : i.value, level));
        i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur(); });
      }
    }
    if (actions) {
      const row = el('div', 'ed-actions', this.side);
      const d = el('button', 'ed-btn', row);
      d.innerHTML = `${icon('copy')} Duplizieren`;
      d.title = 'Duplizieren (Strg+D)';
      d.addEventListener('click', () => this.h.duplicate());
      const x = el('button', 'ed-btn danger', row);
      x.innerHTML = `${icon('trash')} Löschen`;
      x.title = 'Löschen (Entf)';
      x.addEventListener('click', () => this.h.remove());
    }
  }

  /** Lösungsstand je Abschnitt + Prüfliste. */
  setStatus(areas: { solved: boolean; reason: string | null }[], canSuggest: boolean, issues: Issue[]): void {
    const chips = areas.map((a, i) => `<span class="ed-chip ${a.solved ? 'ok' : 'open'}" title="${esc(a.reason ?? 'Lösung kommt an')}">${icon(a.solved ? 'check' : 'warn')} ${i + 1}</span>`).join('');
    this.status.innerHTML = `<span class="ed-lbl">Lösung:</span>${chips}`;
    if (canSuggest) {
      const b = el('button', 'ed-btn small', this.status);
      b.innerHTML = `${icon('ink')} Tinte vorschlagen`;
      b.title = 'Tinte je Abschnitt = 1,5 × deine Lösung';
      b.addEventListener('click', () => this.h.suggest());
    }
    this.issues.innerHTML = '';
    issues.forEach((is, i) => {
      const b = el('button', `ed-issue ${is.level}`, this.issues);
      b.innerHTML = `${icon('warn')} ${esc(is.text)}`;
      b.addEventListener('click', () => this.h.issue(i));
    });
  }

  showStart(c: StartChoice, h: StartHandlers): void {
    const list = c.levels.map((l, i) => `<button class="ed-btn" data-open="${i}">${esc(l.file.replace(/\.json$/, ''))} · ${esc(l.name)}</button>`).join('');
    this.start.innerHTML = `<div class="panel ed-start-panel">
      <h2>Level-Editor</h2>
      <div class="row">
        ${c.draft ? `<button class="primary" data-a="resume">${icon('play')} Weiter: ${esc(c.draft)}</button>` : ''}
        <button data-a="fresh">${icon('plus')} Neues Level</button>
        <button data-a="import">${icon('upload')} Datei importieren</button>
      </div>
      <h3>Level öffnen</h3>
      <div class="ed-open">${list}</div>
    </div>`;
    this.start.classList.remove('hidden');
    const on = (sel: string, f: () => void): void => this.start.querySelector(sel)?.addEventListener('click', f);
    on('[data-a="resume"]', h.resume);
    on('[data-a="fresh"]', h.fresh);
    on('[data-a="import"]', h.importFile);
    this.start.querySelectorAll<HTMLElement>('[data-open]').forEach((b) => b.addEventListener('click', () => h.open(Number(b.dataset.open))));
  }

  hideStart(): void {
    this.start.classList.add('hidden');
  }

  get startOpen(): boolean {
    return !this.start.classList.contains('hidden');
  }
}
