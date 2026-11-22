import { icon } from '../ui/icons';
import { esc } from '../ui/screens/common';
import type { ElementKind } from './doc';
import type { Field } from './fields';
import type { Issue } from './checks';

export interface PaletteEntry { kind: ElementKind; variant?: string; label: string; title?: string }

export const PALETTE: readonly PaletteEntry[] = [
  { kind: 'platform', variant: 'ground', label: 'Boden', title: 'Boden/Haus: Oberkante am angetippten Punkt' },
  { kind: 'platform', label: 'Balken', title: 'Schmaler Balken (unter 50 px Höhe), wird ab 50 px zum Haus' },
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

/** Kleine Bildchen der Bausteine (24×24). */
const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const GLYPH: Record<string, string> = {
  Boden: `<path d="M3 10h18v11H3z" fill="#3a4678" stroke="#fff" stroke-width="1.5"/><path d="M3 10h18" stroke="#fff" stroke-width="3"/><rect x="7" y="13" width="3" height="3" fill="#ffd27a"/><rect x="14" y="13" width="3" height="3" fill="#ffd27a"/>`,
  Balken: `<rect x="3" y="10" width="18" height="5" rx="1" fill="#6a7bb8" stroke="#fff" stroke-width="1.5"/>`,
  Eis: `<rect x="3" y="12" width="18" height="7" rx="1.5" fill="#9fe8ff"/><path d="M6 15h4M13 16h5" stroke="#fff" stroke-width="1.5"/>`,
  Start: `<path ${S} d="M6 21V4"/><path d="M6 4h11l-3 4 3 4H6z" fill="#7dffb0"/>`,
  Station: `<path d="M4 8h16" stroke="#ffd27a" stroke-width="3"/><path ${S} d="M6 8v12M18 8v12"/><rect x="8" y="14" width="8" height="4" rx="1.5" fill="#ff5a70"/>`,
  Landezone: `<rect x="3" y="5" width="18" height="15" rx="2" fill="none" stroke="#40ff90" stroke-width="2" stroke-dasharray="3 2"/><path d="M8 13l3 3 5-6" stroke="#40ff90" stroke-width="2" fill="none"/>`,
  Geschenk: `<rect x="4" y="10" width="16" height="10" rx="1.5" fill="#e83350"/><rect x="3" y="8" width="18" height="4" rx="1" fill="#ff5a70"/><rect x="10.5" y="8" width="3" height="12" fill="#ffd27a"/>`,
  Laterne: `<path ${S} d="M12 3v3"/><rect x="8" y="6" width="8" height="10" rx="2" fill="#ffc060"/><path ${S} d="M12 16v5M9 21h6"/>`,
  Schornstein: `<rect x="7" y="7" width="10" height="14" fill="#a0523d"/><rect x="5" y="5" width="14" height="3" fill="#c8705a"/><path d="M10 4c0-2 3-2 3-4" stroke="#ccc" fill="none"/>`,
  Eiszapfen: `<path d="M8 21L12 5l4 16z" fill="#bfefff"/>`,
  Zuckerstange: `<path d="M9 21V8a4 4 0 0 1 8 0" stroke="#fff" stroke-width="4" fill="none"/><path d="M9 21V8a4 4 0 0 1 8 0" stroke="#e83350" stroke-width="4" stroke-dasharray="2 3" fill="none"/>`,
  Feder: `<path d="M6 20h12" stroke="#40e0ff" stroke-width="3"/><path d="M8 17l8-2-8-3 8-2-8-3" stroke="#40e0ff" stroke-width="2" fill="none"/>`,
  Hängezapfen: `<path d="M4 4h16" stroke="#ff4060" stroke-width="2"/><path d="M8 4l4 16 4-16z" fill="#ff4060"/>`,
  Lametta: `<path d="M3 8c3 4 6-4 9 0s6-4 9 0" stroke="#ff4060" stroke-width="2.5" fill="none"/><path d="M5 12v6M10 11v7M15 12v6M19 11v6" stroke="#ff4060" stroke-width="1.5"/>`,
  Glocke: `<path ${S} d="M12 2v3"/><path d="M6 17c0-6 2-11 6-11s6 5 6 11z" fill="#ff4060"/><circle cx="12" cy="19" r="2" fill="#ff4060"/>`,
  Krähe: `<path d="M3 13c4-4 7-4 9-1 2-3 5-3 9 1-4-1-6 0-9 3-3-3-5-4-9-3z" fill="#ff4060"/>`,
  Zeichenverbot: `<circle cx="12" cy="12" r="8" fill="none" stroke="#8090ff" stroke-width="2.5"/><path d="M6.5 17.5l11-11" stroke="#8090ff" stroke-width="2.5"/>`,
  Hinweis: `<circle cx="12" cy="12" r="9" fill="none" stroke="#ffd27a" stroke-width="2"/><path d="M12 11v6M12 7v1" stroke="#ffd27a" stroke-width="2.5" stroke-linecap="round"/>`,
};

export function glyph(label: string): string {
  return `<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">${GLYPH[label] ?? ''}</svg>`;
}

export type TopAction =
  | 'mode' | 'back' | 'undo' | 'redo' | 'grid' | 'pan' | 'sketch' | 'jumps' | 'test' | 'save' | 'export' | 'import' | 'level'
  | 'share' | 'menu' | 'delete' | 'issues' | 'verify';

export interface UiHandlers {
  top(a: TopAction): void;
  palette(i: number | null): void;
  field(key: string, value: Field['value'], level: boolean): void;
  duplicate(): void;
  remove(): void;
  issue(i: number): void;
  suggest(): void;
  testFrom(v: number | null): void;
  closeSide(): void;
}

export interface MyLevelCard { uid: string; name: string; stars: number; current: boolean }
export interface StartChoice { mine: MyLevelCard[]; menuLevels: { file: string; name: string }[] | null }
export interface StartHandlers { open(uid: string): void; fresh(): void; openMenuLevel(i: number): void; importFile(): void; ai(): void; close(): void }

export interface TopState {
  canUndo: boolean; canRedo: boolean; grid: boolean; pan: boolean; canSave: boolean; levelOpen: boolean;
  testable: boolean; sketch: boolean; jumps: boolean; pro: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
}

/**
 * HTML-Oberfläche des Editors. Zwei Layouts (Klasse `phone` am Wurzelelement):
 * PC – Leisten links/rechts/unten; Handy – Bausteine unten wischbar, Eigenschaften als Blatt, Selteneres im ⋯-Menü.
 */
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
  private readonly menu: HTMLElement;
  private lastTop: TopState | null = null;
  private issuesOpen = false;
  readonly fileInput: HTMLInputElement;

  constructor(parent: HTMLElement, private readonly h: UiHandlers) {
    this.root = el('div', 'editor hidden', parent);
    const top = el('div', 'ed-top', this.root);
    const tb = (a: TopAction, html: string, title: string, cls = ''): void => {
      const b = el('button', `ed-btn ${cls}`, top);
      b.innerHTML = html;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', () => h.top(a));
      this.topBtns.set(a, b);
    };
    tb('back', icon('back'), 'Zurück zum Menü');
    tb('undo', icon('undo'), 'Rückgängig (Strg+Z)');
    tb('redo', icon('redo'), 'Wiederholen (Strg+Y)', 'ed-desk');
    tb('grid', icon('grid'), 'Raster an/aus (G)', 'ed-desk');
    tb('pan', icon('hand'), 'Kamera verschieben (Leertaste halten)', 'ed-desk');
    tb('sketch', icon('sketch'), 'Skizze: schlichte Ansicht, schont Akku und Rechner', 'ed-desk');
    tb('jumps', icon('jumpArc'), 'Sprungweite am gewählten Boden zeigen', 'ed-desk');
    el('span', 'ed-gap', top);
    const testWrap = el('span', 'ed-test', top);
    const testBtn = el('button', 'ed-btn primary', testWrap);
    testBtn.innerHTML = `${icon('play')}<span class="ed-lbl-txt"> Probespielen</span>`;
    testBtn.title = 'Probespielen (T)';
    testBtn.addEventListener('click', () => h.top('test'));
    this.topBtns.set('test', testBtn);
    this.fromSel = el('select', 'ed-from', testWrap);
    this.fromSel.title = 'Wo die Probefahrt beginnt';
    this.fromSel.addEventListener('change', () => h.testFrom(this.fromSel.value === '' ? null : Number(this.fromSel.value)));
    tb('share', `${icon('shareIcon')}<span class="ed-lbl-txt"> Teilen</span>`, 'Level teilen (Link/QR-Code)', 'ed-share');
    tb('save', `${icon('save')} Ins Spiel speichern`, 'Level + Lösung nach src/levels schreiben (Strg+S)', 'ed-desk');
    tb('mode', 'Einfach', 'Einfach/Profi umschalten', 'ed-desk');
    tb('level', `${icon('settings')} Level`, 'Profi: Name, Weltgröße, Tinte, Polarlicht', 'ed-desk');
    tb('menu', icon('more'), 'Mehr');

    this.menu = el('div', 'ed-menu hidden', this.root);

    const pal = el('div', 'ed-palette', this.root);
    this.selectBtn = el('button', 'ed-pal on', pal);
    this.selectBtn.innerHTML = `<svg class="glyph" viewBox="0 0 24 24">${'<path d="M6 3l12 9-5.5 1 3 6-2.5 1.2-3-6L6 18z" fill="currentColor"/>'}</svg><span>Auswählen</span>`;
    this.selectBtn.addEventListener('click', () => h.palette(null));
    PALETTE.forEach((p, i) => {
      const b = el('button', `ed-pal kind-${p.kind}`, pal);
      b.innerHTML = `${glyph(p.label)}<span>${esc(p.label)}</span>`;
      b.title = `${p.title ?? `${p.label} platzieren`} (Umschalt: mehrere)`;
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
    if (!v) this.closeMenu();
  }

  setLayout(layout: 'phone' | 'desktop'): void {
    this.root.classList.toggle('phone', layout === 'phone');
  }

  get phone(): boolean {
    return this.root.classList.contains('phone');
  }

  setTop(state: TopState): void {
    this.lastTop = state;
    const m = this.topBtns.get('mode')!;
    m.textContent = state.pro ? 'Profi' : 'Einfach';
    m.classList.toggle('on', state.pro);
    this.topBtns.get('level')!.classList.toggle('hidden', !state.pro);
    this.topBtns.get('sketch')!.classList.toggle('on', state.sketch);
    this.topBtns.get('jumps')!.classList.toggle('on', state.jumps);
    this.topBtns.get('undo')!.disabled = !state.canUndo;
    this.topBtns.get('redo')!.disabled = !state.canRedo;
    this.topBtns.get('grid')!.classList.toggle('on', state.grid);
    this.topBtns.get('pan')!.classList.toggle('on', state.pan);
    this.topBtns.get('save')!.classList.toggle('hidden', !state.canSave);
    this.topBtns.get('level')!.classList.toggle('on', state.levelOpen);
    this.topBtns.get('test')!.disabled = !state.testable;
    if (!this.menu.classList.contains('hidden')) this.renderMenu();
  }

  // ------------------------------------------------------------ ⋯-Menü

  toggleMenu(): void {
    if (this.menu.classList.contains('hidden')) this.renderMenu();
    else this.closeMenu();
  }

  closeMenu(): void {
    this.menu.classList.add('hidden');
  }

  private renderMenu(): void {
    const s = this.lastTop;
    if (!s) return;
    const item = (a: TopAction, label: string, on?: boolean, cls = ''): string =>
      `<button class="ed-mi ${cls}${on ? ' on' : ''}" data-mi="${a}">${on === undefined ? '' : `<i class="tick">${on ? icon('check') : ''}</i>`}${label}</button>`;
    this.menu.innerHTML = [
      item('mode', 'Profi-Modus', s.pro),
      item('sketch', 'Skizze (schont Akku)', s.sketch),
      item('jumps', 'Sprungweite zeigen', s.jumps),
      item('grid', 'Raster', s.grid),
      item('redo', 'Wiederholen'),
      s.pro ? item('level', 'Level-Einstellungen') : '',
      item('verify', 'Spielbarkeit prüfen'),
      item('export', 'Als Datei exportieren'),
      item('import', 'Datei importieren'),
      s.canSave ? item('save', 'Ins Spiel speichern') : '',
      item('delete', 'Level löschen', undefined, 'danger'),
    ].join('');
    this.menu.classList.remove('hidden');
    this.menu.querySelectorAll<HTMLElement>('[data-mi]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.mi as TopAction;
      const keepOpen = a === 'mode' || a === 'sketch' || a === 'jumps' || a === 'grid' || a === 'redo';
      if (!keepOpen) this.closeMenu();
      this.h.top(a);
    }));
  }

  // ------------------------------------------------------------ Bausteine, Eigenschaften

  setStations(n: number, from: number | null): void {
    const opts = [`<option value="">ab Start</option>`];
    for (let i = 0; i < n; i++) opts.push(`<option value="${i}">ab Station ${i + 1}</option>`);
    const html = opts.join('');
    if (this.fromSel.innerHTML !== html) this.fromSel.innerHTML = html;
    this.fromSel.value = from === null ? '' : String(from);
    this.fromSel.classList.toggle('hidden', n < 1);
  }

  setPalette(active: number | null, visible: ReadonlySet<number>): void {
    this.selectBtn.classList.toggle('on', active === null);
    this.palBtns.forEach((b, i) => {
      b.classList.toggle('on', i === active);
      b.classList.toggle('hidden', !visible.has(i));
    });
  }

  /** Eigenschaften (PC rechts, Handy als Blatt von unten). title null = nichts gewählt. */
  setSide(title: string | null, fields: Field[], level: boolean, actions: boolean): void {
    this.side.classList.toggle('empty', title === null);
    if (title === null) {
      this.side.innerHTML = `<p class="ed-empty">Element antippen zum Bearbeiten.<br>Baustein wählen und in die Welt tippen.</p>`;
      return;
    }
    this.side.innerHTML = '';
    const head = el('div', 'ed-side-head', this.side);
    el('h3', '', head).textContent = title;
    const close = el('button', 'ed-btn small ed-close', head);
    close.innerHTML = '✕';
    close.title = 'Schließen';
    close.addEventListener('click', () => this.h.closeSide());
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
        if (f.type === 'number') i.inputMode = 'decimal';
        i.addEventListener('change', () => {
          // Leer gelassen = unverändert (sonst würde aus „“ eine 0).
          if (f.type === 'number' && (i.value.trim() === '' || !Number.isFinite(Number(i.value)))) { i.value = String(f.value); return; }
          this.h.field(f.key, f.type === 'number' ? Number(i.value) : i.value, level);
        });
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

  /** Lösungsstand + Prüfliste (Handy: kompakter Chip, Liste aufklappbar). */
  setStatus(areas: { solved: boolean; reason: string | null }[], canSuggest: boolean, issues: Issue[]): void {
    const allOk = areas.length > 0 && areas.every((a) => a.solved);
    const chips = areas.map((a, i) => `<span class="ed-chip ${a.solved ? 'ok' : 'open'}" title="${esc(a.reason ?? 'Lösung kommt an')}">${icon(a.solved ? 'check' : 'warn')} ${i + 1}</span>`).join('');
    const summary = allOk ? `<span class="ed-chip ok">${icon('check')} geschafft</span>` : `<span class="ed-chip open">Noch nicht geschafft</span>`;
    this.status.innerHTML = `<span class="ed-lbl ed-desk-inline">Lösung:</span><span class="ed-desk-inline">${chips}</span><span class="ed-phone-inline">${summary}</span>`;
    if (issues.length) {
      const b = el('button', 'ed-btn small ed-issue-count ed-phone-inline', this.status);
      b.innerHTML = `${icon('warn')} ${issues.length}`;
      b.addEventListener('click', () => { this.issuesOpen = !this.issuesOpen; this.issues.classList.toggle('open', this.issuesOpen); });
    } else {
      this.issuesOpen = false;
    }
    if (canSuggest) {
      const b = el('button', 'ed-btn small', this.status);
      b.innerHTML = `${icon('ink')} Tinte vorschlagen`;
      b.title = 'Tinte je Abschnitt = 1,5 × deine Lösung';
      b.addEventListener('click', () => this.h.suggest());
    }
    this.issues.classList.toggle('open', this.issuesOpen);
    this.issues.innerHTML = '';
    issues.forEach((is, i) => {
      const b = el('button', `ed-issue ${is.level}`, this.issues);
      b.innerHTML = `${icon('warn')} ${esc(is.text)}`;
      b.addEventListener('click', () => this.h.issue(i));
    });
  }

  // ------------------------------------------------------------ Start: Meine Levels

  showStart(c: StartChoice, h: StartHandlers): void {
    const cards = c.mine.map((m) => `<button class="ed-card${m.current ? ' current' : ''}" data-uid="${esc(m.uid)}">
      <span class="ed-card-name">${esc(m.name)}</span>
      <span class="ed-card-stars">${'★'.repeat(m.stars)}${'☆'.repeat(3 - m.stars)}</span>
    </button>`).join('');
    const menu = c.menuLevels
      ? `<h3>Menü-Level öffnen (Entwicklung)</h3><div class="ed-open">${c.menuLevels.map((l, i) => `<button class="ed-btn" data-menu="${i}">${esc(l.file.replace(/\.json$/, ''))} · ${esc(l.name)}</button>`).join('')}</div>`
      : '';
    this.start.innerHTML = `<div class="panel ed-start-panel">
      <div class="panel-head"><button class="iconbtn" data-a="close" aria-label="Zurück">${icon('left')}</button><h2>Meine Levels</h2></div>
      <div class="ed-cards">
        <button class="ed-card ed-new" data-a="fresh">${icon('plus')}<span>Neues Level</span></button>
        ${cards}
      </div>
      <div class="row ed-start-row"><button class="ed-ai" data-a="ai">${icon('magic')} Mit KI bauen</button><button data-a="import">${icon('upload')} Datei importieren</button></div>
      ${menu}
    </div>`;
    this.start.classList.remove('hidden');
    const on = (sel: string, f: () => void): void => this.start.querySelector(sel)?.addEventListener('click', f);
    on('[data-a="fresh"]', h.fresh);
    on('[data-a="import"]', h.importFile);
    on('[data-a="ai"]', h.ai);
    on('[data-a="close"]', h.close);
    this.start.querySelectorAll<HTMLElement>('[data-uid]').forEach((b) => b.addEventListener('click', () => h.open(b.dataset.uid!)));
    this.start.querySelectorAll<HTMLElement>('[data-menu]').forEach((b) => b.addEventListener('click', () => h.openMenuLevel(Number(b.dataset.menu))));
  }

  hideStart(): void {
    this.start.classList.add('hidden');
  }

  get startOpen(): boolean {
    return !this.start.classList.contains('hidden');
  }
}
