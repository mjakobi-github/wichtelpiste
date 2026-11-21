import './editor.css';
import type { GameView } from '../view/gameView';
import type { LevelData, Vec2 } from '../sim/types';
import { Simulation } from '../sim/simulation';
import { LEVEL_FILES } from '../levels';
import type { Solution } from '../levels/solveRunner';
import { checkSolution, type SolutionCheck } from '../levels/solutionCheck';
import type { Recording } from './recorder';
import { Draft, type DraftData } from './draft';
import { EditorState } from './state';
import { newLevel } from './template';
import { addElement, duplicateElement, getElement, moveElement, repairLevel, type ElementRef } from './doc';
import { elementBounds } from './handles';
import { applyField, applyLevelField, fieldsFor, levelFields, type Field } from './fields';
import { elementName, levelIssues, suggestBudgets, type Issue } from './checks';
import { exportFile, importFile } from './exchange';
import { canSaveToProject, saveToProject } from './saveClient';
import { idOfFile } from './savePlan';
import { PointerTool, type EditorAction, type Mods } from './pointer';
import { EditorOverlay } from './overlay';
import { EditorUi, PALETTE, type TopAction } from './panels';
import { RenderGate } from './renderGate';
import { Prefs } from './prefs';
import { reachFrom } from './jumpReach';
import { autoInkAllowed, fieldsForMode, friendlyIssue, paletteFor } from './modes';

export interface EditorHost {
  view: GameView;
  uiRoot: HTMLElement;
  stageHost: HTMLElement;
  startTest(level: LevelData, fromArea: number | null, onBack: (rec: Recording) => void): void;
  close(): void;
  toast(text: string, ms?: number): void;
}

const SOLUTIONS = import.meta.glob<Solution>('../levels/solutions/*.json', { eager: true, import: 'default' });
const solutionFor = (id: string): Solution | null => SOLUTIONS[`../levels/solutions/${id}.json`] ?? null;

/** Nach dem Speichern lädt Vite die Seite neu; dieses Merkzeichen öffnet den Editor danach wieder. */
export const REOPEN_KEY = 'wichtelpiste.editor.reopen';

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

const backdropKey = (l: LevelData): string => `${l.theme.seed}/${l.theme.auroraHue}`;

/** Level-Editor: Dokument + Verlauf, Zeiger/Tastatur, Darstellung über GameView, HTML-Leisten. */
export class Editor {
  private readonly draft = new Draft(store());
  private doc: DraftData;
  /** Level + Lösung mit gemeinsamem Verlauf; doc.level/doc.solution spiegeln den Stand (doc.level auch Vorschau). */
  private state: EditorState;
  private still: Simulation;
  private visible = false;
  private started = false;
  private selected: ElementRef | null = null;
  private placing: number | null = null;
  private grid = true;
  private panTool = false;
  private spaceHeld = false;
  private levelPanel = false;
  private fromArea: number | null = null;
  private dirtyView = true;
  /** Zeichnen nur bei Änderungen (Leerlauf: keine Bilder). */
  private readonly gate = new RenderGate();
  private readonly prefs: Prefs;
  /** Tinte von Hand gesetzt (Profi) → keine automatische Anpassung mehr. */
  private inkTouched = false;
  private lastBackdrop = '';
  private checks: SolutionCheck | null = null;
  private checkTimer = 0;
  private issues: Issue[] = [];
  private readonly ui: EditorUi;
  private readonly overlay = new EditorOverlay();
  private readonly pointer: PointerTool;

  /** resume: direkt mit dem Entwurf weitermachen (z. B. nach dem Neuladen durch Speichern), ohne Startdialog. */
  constructor(private readonly host: EditorHost, resume = false) {
    this.prefs = new Prefs(store(), host.view.quality === 'low');
    this.doc = this.draft.load() ?? { level: newLevel(), solution: null, file: null, camera: null };
    this.doc = { ...this.doc, level: repairLevel(this.doc.level) };
    if (!this.doc.file) {
      // Seite wurde nach dem Speichern neu geladen, bevor die Antwort ankam: Datei am Inhalt wiederfinden.
      const same = LEVEL_FILES.find((f) => f.level.id === this.doc.level.id && JSON.stringify(f.level) === JSON.stringify(this.doc.level));
      if (same) this.doc = { ...this.doc, file: same.file };
    }
    this.started = resume;
    this.state = new EditorState(this.doc.level, this.doc.solution);
    this.still = new Simulation(this.doc.level);
    host.view.editorLayer.addChild(this.overlay.container);
    this.ui = new EditorUi(host.uiRoot, {
      top: (a) => this.top(a),
      palette: (i) => { this.placing = i; this.refreshUi(); },
      field: (k, v, level) => this.field(k, v, level),
      duplicate: () => this.duplicate(),
      remove: () => this.remove(),
      issue: (i) => this.focusIssue(i),
      suggest: () => this.suggest(),
      testFrom: (v) => { this.fromArea = v; },
    });
    this.ui.fileInput.addEventListener('change', () => void this.readImport());
    this.pointer = new PointerTool({
      level: () => this.doc.level,
      selected: () => this.selected,
      placing: () => (this.placing === null ? null : PALETTE[this.placing]),
      scale: () => host.view.camera.scale,
      snap: () => this.grid,
      toWorld: (x, y) => host.view.screenToWorld(x, y),
    });
    this.bindInput();
  }

  // ------------------------------------------------------------ Sichtbarkeit

  show(): void {
    this.visible = true;
    const v = this.host.view;
    v.editMode = true;
    v.setManualRender(true);
    v.setSketch(this.prefs.get().view === 'sketch');
    this.gate.invalidate('view');
    this.lastBackdrop = '';
    this.dirtyView = true;
    this.overlay.container.visible = true;
    this.ui.show(true);
    this.rebuildView();
    if (this.doc.camera) v.setCameraState(this.doc.camera);
    else this.focusSpawn();
    this.refreshUi();
    this.scheduleCheck();
    if (!this.started) {
      this.started = true;
      this.showStart();
    }
  }

  hide(): void {
    if (this.visible) this.doc = { ...this.doc, camera: this.host.view.cameraState() };
    this.save();
    this.visible = false;
    this.host.view.setManualRender(false);
    this.host.view.setSketch(false);
    this.pointer.cancel();
    this.overlay.clear();
    this.overlay.container.visible = false;
    this.ui.show(false);
    this.ui.hideStart();
  }

  /** Vom App-Takt jedes Bild aufgerufen; zeichnet nur, wenn sich etwas geändert hat. */
  render(): void {
    if (!this.visible || !this.gate.take()) return;
    if (this.dirtyView) this.rebuildView();
    const v = this.host.view;
    v.renderStill(this.still, false);
    const cam = v.camera;
    const warned = this.issues.filter((i) => i.ref).map((i) => i.ref!);
    const p = this.prefs.get();
    let jumps: ReturnType<typeof reachFrom> = [];
    try { jumps = p.showJumps && this.selected ? reachFrom(this.doc.level, this.selected) : []; } catch { jumps = []; }
    this.overlay.draw(this.doc.level, this.selected, cam.scale, { x: cam.left, y: cam.top, w: cam.viewW, h: cam.viewH },
      { grid: this.grid, warned, sketch: p.view === 'sketch', jumps });
    v.renderNow();
  }

  private invalidate(): void {
    this.gate.invalidate('view');
  }

  private rebuildView(): void {
    this.dirtyView = false;
    const l = this.doc.level;
    try {
      const key = backdropKey(l);
      this.host.view.showLevel(l, { keepBackdrop: key === this.lastBackdrop });
      this.lastBackdrop = key;
      this.still = new Simulation(l);
    } catch {
      // Unfertiger Zwischenstand (z. B. Format-Fehler): alte Darstellung bleibt, Prüfliste zeigt den Fehler.
    }
  }

  // ------------------------------------------------------------ Startdialog

  private showStart(): void {
    const d = this.draft.load();
    this.ui.showStart({
      draft: d ? d.level.name : null,
      levels: LEVEL_FILES.map((f) => ({ file: f.file, name: f.level.name })),
    }, {
      resume: () => this.ui.hideStart(),
      fresh: () => this.load({ level: newLevel(), solution: null, file: null, camera: null }),
      open: (i) => {
        const f = LEVEL_FILES[i];
        this.load({ level: structuredClone(f.level), solution: solutionFor(f.level.id), file: f.file, camera: null });
      },
      importFile: () => this.ui.fileInput.click(),
    });
  }

  private load(d: DraftData): void {
    this.ui.hideStart();
    this.doc = d;
    this.state = new EditorState(d.level, d.solution);
    this.selected = null;
    this.placing = null;
    this.levelPanel = false;
    this.fromArea = null;
    this.checks = null;
    this.dirtyView = true;
    this.lastBackdrop = '';
    this.rebuildView();
    if (d.camera) this.host.view.setCameraState(d.camera);
    else this.focusSpawn();
    this.save();
    this.refreshUi();
    this.scheduleCheck();
  }

  private focusSpawn(): void {
    const s = this.doc.level.spawn;
    this.host.view.setCameraState({ cx: s.x + 400, cy: s.y - 100, zoom: 0.6 });
  }

  // ------------------------------------------------------------ Änderungen

  /** Neuer Stand: commit = Verlaufsschritt + Entwurf speichern. */
  private setLevel(l: LevelData, commit: boolean): void {
    if (l === this.doc.level && !commit) return;
    this.doc = { ...this.doc, level: l };
    this.invalidate();
    // Vorschau beim Ziehen: nur die Editor-Ebene folgt; die Welt wird erst beim Loslassen neu gebaut.
    if (!commit) return;
    this.dirtyView = true;
    if (commit) {
      this.state.commit(l);
      this.save();
      this.scheduleCheck();
    }
    if (this.selected && getElement(l, this.selected) === undefined) this.selected = null;
    this.refreshUi();
  }

  private apply(actions: EditorAction[]): void {
    for (const a of actions) {
      switch (a.type) {
        case 'select': this.selected = a.ref; this.levelPanel = false; this.refreshUi(); break;
        case 'preview': this.setLevel(a.level, false); break;
        case 'commit': this.setLevel(a.level, true); break;
        case 'pan': this.host.view.panBy(a.dx, a.dy); this.invalidate(); break;
        case 'zoom': this.host.view.zoomAt(a.f, a.x, a.y); this.invalidate(); break;
        case 'place': {
          const r = addElement(this.doc.level, a.kind, a.at, a.variant);
          this.selected = r.ref;
          this.levelPanel = false;
          if (!a.keep) this.placing = null;
          this.setLevel(r.level, true);
          break;
        }
      }
    }
  }

  private undo(): void {
    if (this.state.undo()) this.syncFromState();
  }

  private redo(): void {
    if (this.state.redo()) this.syncFromState();
  }

  /** Nach Verlaufs-Schritten, die auch die Lösung betreffen: Spiegel, Ansicht, Entwurf, Prüfung aktualisieren. */
  private syncFromState(): void {
    const l = this.state.level;
    this.doc = { ...this.doc, level: l, solution: this.state.solution };
    this.dirtyView = true;
    if (this.selected && getElement(l, this.selected) === undefined) this.selected = null;
    this.save();
    this.scheduleCheck();
    this.refreshUi();
  }

  private duplicate(): void {
    if (!this.selected) return;
    const r = duplicateElement(this.doc.level, this.selected);
    this.selected = r.ref;
    this.setLevel(r.level, true);
  }

  private remove(): void {
    const ref = this.selected;
    if (!ref) return;
    if (ref.kind === 'spawn' || ref.kind === 'chimney') { this.host.toast(`${elementName(ref)} kann man nur verschieben`); return; }
    this.selected = null;
    this.state.remove(ref);
    this.syncFromState();
  }

  private nudge(dx: number, dy: number): void {
    if (this.selected) this.setLevel(moveElement(this.doc.level, this.selected, dx, dy), true);
  }

  private field(key: string, value: Field['value'], level: boolean): void {
    if (level) {
      if (/^(ink|boost)/.test(key)) this.inkTouched = true;
      this.setLevel(applyLevelField(this.doc.level, key, value), true);
      if (key === 'id' && this.doc.level.id !== value) this.host.toast('ID: nur a–z, 0–9 und -');
      return;
    }
    const ref = this.selected;
    if (!ref) return;
    if (ref.kind === 'station' && key === 'number') {
      const to = Number(value) - 1;
      if (to >= 0 && to < this.doc.level.stations.length) {
        this.state.renumber(ref.index, to);
        this.selected = { kind: 'station', index: to };
        this.syncFromState();
        return;
      }
    }
    this.setLevel(applyField(this.doc.level, ref, key, value), true);
  }

  private focusIssue(i: number): void {
    const is = this.issues[i];
    if (!is?.ref) { this.levelPanel = true; this.selected = null; this.refreshUi(); return; }
    this.selected = is.ref;
    this.levelPanel = false;
    const b = elementBounds(this.doc.level, is.ref);
    const c = this.host.view.cameraState();
    this.host.view.setCameraState({ ...c, cx: b.x + b.w / 2, cy: b.y + b.h / 2 });
    this.refreshUi();
  }

  // ------------------------------------------------------------ Lösung, Tinte, Probespielen, Speichern

  private scheduleCheck(): void {
    window.clearTimeout(this.checkTimer);
    this.checkTimer = window.setTimeout(() => {
      try {
        this.checks = checkSolution(this.doc.level, this.doc.solution);
      } catch {
        this.checks = null;
      }
      this.refreshStatus();
    }, 250);
  }

  private suggest(): void {
    const c = this.checks;
    if (!c) return;
    const next = suggestBudgets(this.doc.level, c.areas);
    const areas = this.doc.level.areas.map((a, i) => (c.areas[i]?.ok ? next[i] : a));
    this.setLevel({ ...this.doc.level, areas }, true);
    this.host.toast('Tinte = 1,5 × deine Lösung');
  }

  private test(): void {
    if (this.issues.some((i) => i.level === 'error')) { this.host.toast('Erst die Fehler in der Liste beheben', 2200); return; }
    this.hide();
    const level = this.doc.level;
    this.host.startTest(level, this.fromArea, (rec) => this.returnFromTest(rec));
  }

  private returnFromTest(rec: Recording): void {
    const n = this.state.mergeRecording(rec);
    if (n > 0) {
      this.syncFromState();
      if (autoInkAllowed(this.prefs.get().mode, this.inkTouched)) {
        // Einfach-Modus: Tinte passt sich der geschafften Fahrt an (die Lösung bleibt gültig).
        const c = checkSolution(this.doc.level, this.doc.solution);
        const next = suggestBudgets(this.doc.level, c.areas);
        const areas = this.doc.level.areas.map((a, i) => (c.areas[i]?.ok ? next[i] : a));
        this.setLevel({ ...this.doc.level, areas }, true);
        this.host.toast('Geschafft! Tinte angepasst', 2000);
      } else {
        this.host.toast(n === 1 ? 'Lösung für einen Abschnitt gemerkt' : `Lösung für ${n} Abschnitte gemerkt`, 2000);
      }
    }
    this.scheduleCheck();
  }

  private async saveProject(): Promise<void> {
    const c = checkSolution(this.doc.level, this.doc.solution);
    if (!c.ok) {
      this.host.toast(`${c.areas.find((a) => !a.ok)?.reason ?? 'Lösung fehlt'}`, 3000);
      return;
    }
    // ID geändert → als neues Level speichern (die alte Datei bleibt unberührt)
    const file = this.doc.file && idOfFile(this.doc.file) === this.doc.level.id ? this.doc.file : null;
    try { window.sessionStorage.setItem(REOPEN_KEY, '1'); } catch { /* egal */ }
    const r = await saveToProject(this.doc.level, this.doc.solution, file);
    if (!r.ok) {
      try { window.sessionStorage.removeItem(REOPEN_KEY); } catch { /* egal */ }
      this.host.toast(r.error, 3500);
      return;
    }
    this.doc = { ...this.doc, file: r.file };
    this.save();
    this.host.toast(`Gespeichert: ${r.file}`, 2500);
  }

  private exportDownload(): void {
    const blob = new Blob([exportFile(this.doc.level, this.doc.solution)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.doc.level.id}.wichtelpiste.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  private async readImport(): Promise<void> {
    const f = this.ui.fileInput.files?.[0];
    this.ui.fileInput.value = '';
    if (!f) return;
    try {
      const r = importFile(await f.text());
      this.load({ level: r.level, solution: r.solution, file: null, camera: null });
      this.host.toast(`Importiert: ${r.level.name}`);
    } catch (e) {
      this.host.toast(e instanceof Error ? e.message : 'Import fehlgeschlagen', 3500);
    }
  }

  private save(): void {
    this.draft.save(this.doc);
  }

  // ------------------------------------------------------------ Oberfläche

  private top(a: TopAction): void {
    switch (a) {
      case 'back': this.host.close(); break;
      case 'undo': this.undo(); break;
      case 'redo': this.redo(); break;
      case 'grid': this.grid = !this.grid; this.refreshUi(); break;
      case 'pan': this.panTool = !this.panTool; this.refreshUi(); break;
      case 'test': this.test(); break;
      case 'save': void this.saveProject(); break;
      case 'export': this.exportDownload(); break;
      case 'import': this.ui.fileInput.click(); break;
      case 'sketch': {
        const sketch = this.prefs.get().view !== 'sketch';
        this.prefs.set({ view: sketch ? 'sketch' : 'pretty' });
        this.host.view.setSketch(sketch);
        this.lastBackdrop = '';
        this.dirtyView = true;
        this.refreshUi();
        break;
      }
      case 'mode': {
        const mode = this.prefs.get().mode === 'pro' ? 'simple' : 'pro';
        this.prefs.set({ mode });
        if (mode === 'simple') this.levelPanel = false;
        if (this.placing !== null && !paletteFor(mode).includes(PALETTE[this.placing])) this.placing = null;
        this.host.toast(mode === 'pro' ? 'Profi: alle Bausteine und Werte' : 'Einfach: die wichtigsten Bausteine');
        this.refreshUi();
        break;
      }
      case 'jumps': this.prefs.set({ showJumps: !this.prefs.get().showJumps }); this.refreshUi(); break;
      case 'level': this.levelPanel = !this.levelPanel; if (this.levelPanel) this.selected = null; this.refreshUi(); break;
    }
  }

  private refreshUi(): void {
    this.invalidate();
    const l = this.doc.level;
    this.issues = levelIssues(l);
    this.ui.setTop({
      canUndo: this.state.canUndo, canRedo: this.state.canRedo, grid: this.grid, pan: this.panTool,
      canSave: canSaveToProject, levelOpen: this.levelPanel, pro: this.prefs.get().mode === 'pro', sketch: this.prefs.get().view === 'sketch', jumps: this.prefs.get().showJumps, testable: !this.issues.some((i) => i.level === 'error'),
    });
    if (this.fromArea !== null && this.fromArea >= l.stations.length) this.fromArea = null;
    this.ui.setStations(l.stations.length, this.fromArea);
    const mode = this.prefs.get().mode;
    this.ui.setPalette(this.placing, new Set(paletteFor(mode).map((p) => PALETTE.indexOf(p))));
    if (this.levelPanel && mode === 'pro') this.ui.setSide(`Level: ${l.name}`, levelFields(l), true, false);
    else if (this.selected) {
      const sel = this.selected;
      const n = sel.kind === 'station' || sel.kind === 'dismount' ? ` ${sel.index + 1}` : '';
      const name = sel.kind === 'mover' ? ((getElement(l, sel) as { kind: string }).kind === 'crow' ? 'Krähe' : 'Glocke') : elementName(sel);
      this.ui.setSide(`${name}${n}`, fieldsForMode(mode, fieldsFor(l, sel)), false, true);
    } else this.ui.setSide(null, [], false, false);
    this.refreshStatus();
  }

  private refreshStatus(): void {
    const c = this.checks;
    const areas = this.doc.level.areas.map((_, i) => ({ solved: c?.areas[i]?.ok ?? false, reason: c?.areas[i]?.reason ?? 'Noch nicht geprüft' }));
    const mode = this.prefs.get().mode;
    this.ui.setStatus(areas, mode === 'pro' && !!c && c.areas.some((a) => a.ok), this.issues.map((i) => ({ ...i, text: friendlyIssue(i, mode) })));
  }

  // ------------------------------------------------------------ Eingabe

  private mods(e: PointerEvent | KeyboardEvent): Mods {
    const middle = 'buttons' in e && (e.buttons & 4) !== 0;
    return { shift: e.shiftKey, alt: e.altKey, pan: this.panTool || this.spaceHeld || middle };
  }

  private bindInput(): void {
    const el = this.host.stageHost;
    const rel = (e: PointerEvent): Vec2 => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const active = (): boolean => this.visible && !this.ui.startOpen;
    el.addEventListener('pointerdown', (e) => {
      if (!active()) return;
      el.setPointerCapture?.(e.pointerId);
      this.apply(this.pointer.down(rel(e), this.mods(e), e.pointerId));
    });
    el.addEventListener('pointermove', (e) => {
      if (!active()) return;
      this.apply(this.pointer.move(rel(e), this.mods(e), e.pointerId));
    });
    const up = (e: PointerEvent): void => {
      if (!this.visible) return;
      this.apply(this.pointer.up(rel(e), this.mods(e), e.pointerId));
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => { if (this.visible) this.apply(this.pointer.cancel()); void e; });
    el.addEventListener('wheel', (e) => {
      if (!active()) return;
      e.preventDefault();
      const p = rel(e as unknown as PointerEvent);
      this.host.view.zoomAt(Math.pow(1.15, -e.deltaY / 100), p.x, p.y);
      this.invalidate();
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => { if (this.visible) e.preventDefault(); });
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('resize', () => this.invalidate());
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.spaceHeld = false; });
  }

  private keyDown(e: KeyboardEvent): void {
    if (!this.visible) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.code;
    let handled = true;
    if (k === 'Space') this.spaceHeld = true;
    else if (ctrl && k === 'KeyZ' && e.shiftKey) this.redo();
    else if (ctrl && k === 'KeyZ') this.undo();
    else if (ctrl && k === 'KeyY') this.redo();
    else if (ctrl && k === 'KeyD') this.duplicate();
    else if (ctrl && k === 'KeyS') void this.saveProject();
    else if (k === 'Delete' || k === 'Backspace') this.remove();
    else if (k === 'Escape') { this.selected = null; this.placing = null; this.levelPanel = false; this.refreshUi(); }
    else if (k === 'KeyG') this.top('grid');
    else if (k === 'KeyT') this.test();
    else if (k.startsWith('Arrow')) {
      const s = e.shiftKey ? 1 : 10;
      this.nudge(k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0);
    } else if (k === 'Equal' || k === 'NumpadAdd') this.zoomStep(1.25);
    else if (k === 'Minus' || k === 'NumpadSubtract') this.zoomStep(0.8);
    else handled = false;
    if (handled) e.preventDefault();
  }

  private zoomStep(f: number): void {
    const c = this.host.view.camera;
    this.host.view.zoomAt(f, c.screenW / 2, c.screenH / 2);
    this.invalidate();
  }
}

