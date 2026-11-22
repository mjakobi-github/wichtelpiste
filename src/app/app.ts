import { LEVELS } from '../levels';
import { Simulation } from '../sim/simulation';
import type { Command, SimEvent, WinResult } from '../sim/events';
import type { Theme } from '../sim/types';
import { Loop } from '../engine/loop';
import { Input } from '../engine/input';
import { Gestures, type ToolName } from '../engine/gestures';
import { audio } from '../engine/audio';
import { createStage } from '../view/stage';
import { GameView } from '../view/gameView';
import { Hud } from '../ui/hud';
import { Toolbar, type ToolAction } from '../ui/toolbar';
import { TouchControls } from '../ui/touchControls';
import { RotateHint } from '../ui/rotateHint';
import { HintView, activeHint } from '../ui/hints';
import { renderTitle } from '../ui/screens/title';
import { renderLevelSelect, type LevelTab } from '../ui/screens/levelSelect';
import { showGiftCard } from '../ui/screens/giftCard';
import { confirmDialog } from '../ui/dialog';
import { Gifts, migrateStationDirs, MyLevels } from './library';
import { receiveFromHash } from './receive';
import { playableError } from './playable';
import { progressKey } from './progress';
import { renderPause } from '../ui/screens/pause';
import { renderWin } from '../ui/screens/win';
import { Progress } from './progress';
import { canPause, nextScreen, type Screen, type ScreenAction } from './flow';
import { fullscreenSupported, toggleFullscreen } from '../ui/fullscreen';
import { claimReload } from './staleChunk';
import type { LevelData } from '../sim/types';
import type { Recorder, Recording } from '../editor/recorder';
import type { Editor, EditorHost } from '../editor/editor';

export { nextScreen, formatInk, type Screen } from './flow';

/** Kulisse für Titel und Levelauswahl. */
const MENU_THEME: Theme = { seed: 24, auroraHue: 150 };

/** Editor im Dev-Server immer, auf der Seite nur mit ?editor. */
function editorAllowed(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('editor');
}

/** Editor nach dem Neuladen (durch Speichern) wieder öffnen? Schlüssel wie REOPEN_KEY in editor.ts. */
function consumeReopen(): boolean {
  try {
    const v = window.sessionStorage.getItem('wichtelpiste.editor.reopen');
    window.sessionStorage.removeItem('wichtelpiste.editor.reopen');
    return v === '1';
  } catch {
    return false;
  }
}

type PlayTarget = { kind: 'menu'; idx: number } | { kind: 'mine'; uid: string } | { kind: 'gift'; key: string };

/** Laufende Probefahrt aus dem Editor. */
interface TestRun { level: LevelData; fromArea: number | null; recorder: Recorder; onBack: (rec: Recording) => void; progressKey?: string }

/** Verdrahtet Simulation, Darstellung, Oberfläche und Audio. */
export class App {
  private screen: Screen = 'title';
  private hudPrefix = '';
  /** Was gerade gespielt wird: Menü-Level, eigenes oder geschenktes. */
  private target: PlayTarget = { kind: 'menu', idx: 0 };
  private levelTab: LevelTab = 'menu';
  private readonly myLevels: MyLevels;
  private readonly gifts: Gifts;
  private sim: Simulation | null = null;
  private tool: ToolName = 'draw';
  private events: SimEvent[] = [];
  private readonly input = new Input();
  private readonly progress: Progress;
  private view!: GameView;
  private hud!: Hud;
  private toolbar!: Toolbar;
  private touch!: TouchControls;
  private overlay!: HTMLElement;
  private hints!: HintView;
  private editor: Editor | null = null;
  private editorModule: Promise<typeof import('../editor/editor')> | null = null;
  /** Editor-Code wird gerade geladen (gegen doppeltes Antippen). */
  private openingEditor = false;
  private reloading = false;
  private testRun: TestRun | null = null;

  constructor(private readonly stageHost: HTMLElement, private readonly uiRoot: HTMLElement) {
    let store: Storage | null = null;
    try { store = window.localStorage; } catch { store = null; }
    this.progress = new Progress(store);
    this.myLevels = new MyLevels(store);
    this.gifts = new Gifts(store);
    migrateStationDirs(store, this.progress);
  }

  async start(): Promise<void> {
    const stage = await createStage(this.stageHost);
    this.view = new GameView(stage.app);
    stage.onResize((w, h) => this.view.resize(w, h));

    this.hud = new Hud(this.uiRoot);
    this.toolbar = new Toolbar(this.uiRoot, (t) => this.setTool(t), (a) => this.action(a));
    this.touch = new TouchControls(this.uiRoot, this.input);
    this.hints = new HintView(this.uiRoot);
    this.toolbar.fullscreenBtn.classList.toggle('hidden', !fullscreenSupported());
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    this.uiRoot.appendChild(this.overlay);
    new RotateHint(this.uiRoot, () => { if (this.screen === 'play') this.openPause(); });

    this.input.attach();
    this.input.onKey = (code, e) => this.key(code, e);
    audio.mount();

    new Gestures(this.stageHost, {
      tool: () => this.tool,
      enabled: () => this.screen === 'play' && this.sim?.mode === 'sled' && this.sim.phase === 'plan',
      toWorld: (x, y) => this.view.screenToWorld(x, y),
      send: (c) => this.send(c),
      pan: (dx, dy) => this.view.panBy(dx, dy),
      zoom: (f, x, y) => this.view.zoomAt(f, x, y),
    });

    new Loop((dt) => this.update(dt), (alpha) => this.render(alpha)).start();
    this.openTitle();
    if (editorAllowed() && consumeReopen()) void this.openEditor(true);
    void this.checkHash();
    window.addEventListener('hashchange', () => void this.checkHash());
    window.addEventListener('vite:preloadError', () => this.onChunkError());
    if (new URLSearchParams(window.location.search).has('debug')) {
      // Lösungen für src/levels/solutions/<id>.json: in der Konsole copy(__exportStrokes())
      (window as unknown as { __exportStrokes: () => string }).__exportStrokes = () => this.exportStrokes();
    }
  }

  // ------------------------------------------------------------ Ablauf

  private go(a: ScreenAction): void {
    this.screen = nextScreen(this.screen, a);
  }

  /** Alles Spiel-UI aus (Menüs). */
  private hideGameUi(): void {
    this.hud.show(false);
    this.hud.hideBanner();
    this.hints.show(null);
    this.touch.show(false);
    this.toolbar.setPlanning(false, false);
    this.toolbar.setReplan(false);
    this.toolbar.setPauseVisible(false);
  }

  private toMenu(): void {
    this.sim = null;
    this.testRun = null;
    this.view.editMode = false;
    this.hideGameUi();
    this.view.showScenery(MENU_THEME);
  }

  private openTitle(): void {
    this.screen = 'title';
    this.toMenu();
    this.showOverlay((el) => renderTitle(el, () => this.openLevels('start'), () => void this.openEditor()));
    this.prefetchEditor();
  }

  private openLevels(a: ScreenAction, tab: LevelTab = this.levelTab): void {
    this.go(a);
    this.screen = 'levels';
    this.toMenu();
    this.levelTab = tab;
    const p = this.progress;
    this.showOverlay((el) => renderLevelSelect(el, {
      tab,
      menu: LEVELS.map((level) => ({ level, progress: p.get(level) })),
      mine: this.myLevels.list().map((m) => ({ uid: m.uid, level: m.level, progress: p.get(m.level, progressKey.mine(m.uid)) })),
      gifts: this.gifts.list().map((g) => ({ ...g, progress: p.get(g.level, progressKey.gift(g.key)) })),
    }, {
      pickMenu: (i) => void this.startTarget({ kind: 'menu', idx: i }),
      pickMine: (uid) => void this.startTarget({ kind: 'mine', uid }),
      pickGift: (key) => void this.startTarget({ kind: 'gift', key }),
      deleteGift: (key) => void this.deleteGift(key),
      tab: (t) => this.openLevels('toLevels', t),
      back: () => this.openTitle(),
    }));
  }

  private async deleteGift(key: string): Promise<void> {
    const g = this.gifts.get(key);
    if (!g) return;
    const ok = await confirmDialog(this.uiRoot, { title: 'Geschenk löschen?', text: `„${g.level.name}“ verschwindet aus „Geschenkt“.`, ok: 'Löschen', danger: true });
    if (!ok) return;
    this.gifts.remove(key);
    this.openLevels('toLevels', 'gift');
  }

  // ------------------------------------------------------------ Geteilte Links

  /** Geschenktes Level mit eigenem Rekord zurückschicken. */
  private async sendBack(level: LevelData, inkUsed: number): Promise<void> {
    const { Prefs } = await import('../editor/prefs');
    let store: Storage | null = null;
    try { store = window.localStorage; } catch { store = null; }
    const prefs = new Prefs(store);
    const { openShareDialog } = await import('../share/shareDialog');
    await openShareDialog(this.uiRoot, { level, from: prefs.get().senderName, challengeInk: inkUsed }, (n) => prefs.set({ senderName: n }));
  }

  /** #l=… in der Adresse: Level als Geschenk speichern, Karte zeigen, Adresse aufräumen. */
  private async checkHash(): Promise<void> {
    if (await this.checkAiHash()) return;
    const r = await receiveFromHash(window.location.hash, this.gifts);
    if (r.kind === 'none') return;
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* egal */ }
    if (r.kind === 'error') { this.hud.toast(r.message, 4000); return; }
    if (this.screen === 'play' && this.sim && !this.sim.won) this.openPause();
    showGiftCard(this.uiRoot, r.gift, {
      play: () => {
        if (this.screen === 'editor') this.editor?.hide();
        void this.startTarget({ kind: 'gift', key: r.gift.key });
      },
      later: () => { if (this.screen === 'levels') this.openLevels('toLevels', 'gift'); },
    });
  }

  /** #ki=… : Level-Link aus dem Chatbot („Mit KI bauen“) – Editor öffnen und gleich prüfen. */
  private async checkAiHash(): Promise<boolean> {
    if (!window.location.hash.startsWith('#ki=')) return false;
    const { readAiHash } = await import('../editor/ai');
    const reply = readAiHash(window.location.hash);
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* egal */ }
    if (reply === null) return true;
    if (this.testRun && this.screen !== 'editor') { this.hud.toast('Erst das Probespielen beenden, dann den Link nochmal antippen', 3500); return true; }
    if (this.screen !== 'editor') {
      if (this.screen !== 'title') this.openTitle();
      await this.openEditor();
    }
    await this.editor?.buildWithAi(reply);
    return true;
  }

  /** Level, Fortschritts-Schlüssel und HUD-Präfix zum Spielziel. */
  private resolve(t: PlayTarget): { level: LevelData; key: string; prefix: string } | null {
    if (t.kind === 'menu') { const level = LEVELS[t.idx]; return level ? { level, key: level.id, prefix: `${t.idx + 1}.` } : null; }
    if (t.kind === 'mine') { const m = this.myLevels.get(t.uid); return m ? { level: m.level, key: progressKey.mine(m.uid), prefix: 'Eigenes:' } : null; }
    const g = this.gifts.get(t.key);
    return g ? { level: g.level, key: progressKey.gift(g.key), prefix: 'Geschenk:' } : null;
  }

  // ------------------------------------------------------------ Editor

  /** Editor-Code nur einmal anfordern; schlägt es fehl, beim nächsten Versuch neu. */
  private loadEditor(): Promise<typeof import('../editor/editor')> {
    this.editorModule ??= import('../editor/editor').catch((err: unknown) => {
      this.editorModule = null;
      throw err;
    });
    return this.editorModule;
  }

  /** Editor-Code im Hintergrund vorladen, damit „Bauen“ gleich reagiert (Fehler meldet staleChunk). */
  private prefetchEditor(): void {
    if (this.editor || this.editorModule) return;
    window.setTimeout(() => { if (!this.editor) void this.loadEditor().catch(() => undefined); }, 1500);
  }

  /** „Bauen“-Knopf zeigt, dass geladen wird. */
  private setEditorBusy(busy: boolean): void {
    const b = this.overlay.querySelector<HTMLButtonElement>('button[data-a="editor"]');
    if (b) b.setAttribute('aria-busy', String(busy));
  }

  /** Nachgeladener Programmteil fehlt (meist: neue Version veröffentlicht, alte Seite noch offen). */
  private onChunkError(): void {
    if (this.reloading) return;
    const inMenu = this.screen === 'title' || this.screen === 'levels';
    let store: Storage | null = null;
    try { store = window.sessionStorage; } catch { store = null; }
    if (inMenu && claimReload(store, Date.now())) {
      this.reloading = true;
      this.hud.toast('Neue Version – lädt neu …', 3000);
      window.location.reload();
      return;
    }
    this.hud.toast('Neue Version da – bitte die Seite neu laden', 4000);
  }

  private async openEditor(resume = false): Promise<void> {
    if (this.openingEditor) return;
    if (!this.editor) {
      this.openingEditor = true;
      this.setEditorBusy(true);
      let mod: typeof import('../editor/editor');
      try {
        mod = await this.loadEditor();
      } catch {
        // Meist schon über vite:preloadError gemeldet – doppelt schadet nicht (reloading sperrt)
        this.onChunkError();
        return;
      } finally {
        this.openingEditor = false;
        this.setEditorBusy(false);
      }
      // Inzwischen „Spielen“ getippt? Dann nicht dazwischenfunken.
      if (this.screen !== 'title') return;
      const { Editor } = mod;
      const host: EditorHost = {
        view: this.view,
        uiRoot: this.uiRoot,
        stageHost: this.stageHost,
        startTest: (level, fromArea, onBack, key) => void this.startTest(level, fromArea, onBack, undefined, key),
        close: () => { this.editor?.hide(); this.openTitle(); },
        toast: (t, ms) => this.hud.toast(t, ms),
      };
      this.editor = new Editor(host, resume);
    }
    this.go('openEditor');
    this.sim = null;
    this.hideGameUi();
    this.hideOverlay();
    this.editor.show(!resume);
  }

  /** recorder: beim Neustart weiterverwenden, damit schon geschaffte Abschnitte nicht verloren gehen. */
  private async startTest(level: LevelData, fromArea: number | null, onBack: (rec: Recording) => void, recorder?: Recorder, progressKey?: string): Promise<void> {
    const { Recorder } = await import('../editor/recorder');
    this.testRun = { level, fromArea, recorder: recorder ?? new Recorder(level), onBack, progressKey };
    this.editor?.hide();
    this.view.editMode = false;
    this.sim = new Simulation(level);
    if (fromArea !== null) this.sim.boardForTest(fromArea);
    await this.view.load(level);
    this.input.reset();
    this.hideOverlay();
    this.hud.show(true);
    this.toolbar.setPauseVisible(true);
    this.setTool('draw');
    this.screen = 'play';
    this.hud.banner(`Probe: ${level.name}`, fromArea !== null ? `Ab Station ${fromArea + 1}` : 'Sammle die Geschenke und bring sie zum Schornstein');
  }

  /** Probefahrt beenden, zurück in den Editor (mit aufgezeichneter Lösung). */
  private backToEditor(): void {
    const run = this.testRun;
    if (!run || !this.editor) return;
    this.testRun = null;
    this.go('toEditor');
    this.sim = null;
    this.hideGameUi();
    this.hideOverlay();
    this.editor.show();
    run.onBack(run.recorder.recording());
  }

  private restartCurrent(a: ScreenAction): void {
    const run = this.testRun;
    if (run) void this.startTest(run.level, run.fromArea, run.onBack, run.recorder, run.progressKey);
    else void this.startTarget(this.target, a);
  }

  private async startTarget(t: PlayTarget, _a: ScreenAction = 'pickLevel'): Promise<void> {
    const r = this.resolve(t);
    if (!r) { this.hud.toast('Level nicht gefunden'); return; }
    const bad = playableError(r.level);
    if (bad) { this.hud.toast(bad, 3000); return; }
    this.testRun = null;
    this.view.editMode = false;
    this.target = t;
    this.hudPrefix = r.prefix;
    const level = r.level;
    this.sim = new Simulation(level);
    await this.view.load(level);
    this.input.reset();
    this.hideOverlay();
    this.hud.show(true);
    this.toolbar.setPauseVisible(true);
    this.setTool('draw');
    this.screen = 'play';
    this.hud.banner(`${r.prefix} ${level.name}`, 'Sammle die Geschenke und bring sie zum Schornstein');
  }

  private showWin(r: WinResult): void {
    this.go('win');
    this.hideGameUi();
    this.hud.show(true);
    if (this.testRun) {
      // Ganze Probefahrt ab Start: zählt als eigener Rekord (Herausforderung beim Teilen)
      const key = this.testRun.fromArea === null ? this.testRun.progressKey : undefined;
      const rec = key ? this.progress.record(this.testRun.level, r, key) : null;
      const best = key ? this.progress.get(this.testRun.level, key).bestInk : null;
      this.showOverlay((el) => renderWin(el, { result: r, newBestInk: rec?.newBestInk ?? false, bestInk: best, hasNext: false, backLabel: 'Zurück zum Editor' }, {
        again: () => this.restartCurrent('again'),
        next: () => undefined,
        levels: () => this.backToEditor(),
      }));
      return;
    }
    const t = this.target;
    const res = this.resolve(t);
    if (!res) { this.openLevels('toLevels'); return; }
    const rec = this.progress.record(res.level, r, res.key);
    if (rec.newBestInk) window.setTimeout(() => { if (this.screen === 'won') audio.record(); }, 1500);
    const tab: LevelTab = t.kind === 'menu' ? 'menu' : t.kind === 'mine' ? 'mine' : 'gift';
    this.showOverlay((el) => renderWin(el, {
      result: r,
      newBestInk: rec.newBestInk,
      bestInk: this.progress.get(res.level, res.key).bestInk,
      hasNext: t.kind === 'menu' && t.idx + 1 < LEVELS.length,
      extra: t.kind === 'gift' && r.stars === 3 ? `${'Zurückschicken'}` : undefined,
    }, {
      extra: () => void this.sendBack(res.level, r.inkUsed),
      again: () => void this.startTarget(t, 'again'),
      next: () => { if (t.kind === 'menu') void this.startTarget({ kind: 'menu', idx: t.idx + 1 }, 'next'); },
      levels: () => this.openLevels('toLevels', tab),
    }));
  }

  private openPause(): void {
    if (!canPause(this.screen, this.sim?.won ?? false)) return;
    this.go('pause');
    this.send({ type: 'strokeEnd' });
    this.hud.hideBanner();
    this.hints.show(null);
    const test = this.testRun !== null;
    this.showOverlay((el) => renderPause(el, audio.muted, {
      resume: () => this.resume(),
      restart: () => this.restartCurrent('restart'),
      levels: () => (test ? this.backToEditor() : this.openLevels('toLevels')),
      toggleSound: () => { audio.setMuted(!audio.muted); return audio.muted; },
    }, test ? 'Zurück zum Editor' : undefined));
  }

  private resume(): void {
    if (this.screen !== 'pause') return;
    this.input.reset();
    this.hideOverlay();
    this.go('resume');
  }

  private showOverlay(fill: (el: HTMLElement) => void): void {
    fill(this.overlay);
    this.overlay.classList.add('visible');
  }

  private hideOverlay(): void {
    this.overlay.classList.remove('visible');
  }

  /** Gezeichnete Linien des aktuellen Levels im Lösungsformat (nur ?debug). */
  private exportStrokes(): string {
    const sim = this.sim;
    if (!sim) return '';
    const areas = sim.level.areas.map((_, i) => ({
      strokes: sim.ink.strokes.filter((s) => s.area === i).map((s) => ({ boost: s.boost, pts: s.pts.map((p) => [Math.round(p.x), Math.round(p.y)]) })),
    }));
    return JSON.stringify({ areas });
  }

  // ------------------------------------------------------------ Eingabe

  private send(c: Command): void {
    this.sim?.command(c);
  }

  private setTool(t: ToolName): void {
    this.tool = t;
    this.toolbar.setTool(t);
  }

  private action(a: ToolAction): void {
    if (a === 'fullscreen') { void toggleFullscreen(); return; }
    if (a === 'pause') { if (this.screen === 'pause') this.resume(); else this.openPause(); return; }
    if (a === 'zoomIn') this.view.zoomStep(1.25);
    if (a === 'zoomOut') this.view.zoomStep(0.8);
    if (a === 'replan') this.send({ type: 'replan' });
    if (a === 'undo') this.send({ type: 'undo' });
    if (a === 'clear') this.send({ type: 'clear' });
    if (a === 'launch') this.send({ type: 'launch' });
  }

  private key(code: string, e: KeyboardEvent): void {
    if (this.screen === 'editor') return;
    if (code === 'Escape') {
      if (this.screen === 'play') this.openPause();
      else if (this.screen === 'pause') this.resume();
      return;
    }
    if (this.screen === 'title' && (code === 'Enter' || code === 'Space')) { this.openLevels('start'); return; }
    if (this.screen !== 'play' || !this.sim) return;
    const planning = this.sim.mode === 'sled' && this.sim.phase === 'plan';
    if (code === 'KeyF') { void toggleFullscreen(); return; }
    if (code === 'KeyR') this.send({ type: 'retry' });
    if (code === 'KeyQ') this.send({ type: 'replan' });
    if (!planning) return;
    if (code === 'Equal' || code === 'NumpadAdd' || code === 'BracketRight') this.view.zoomStep(1.25);
    if (code === 'Minus' || code === 'NumpadSubtract' || code === 'Slash') this.view.zoomStep(0.8);
    if (code === 'Space') this.send({ type: 'launch' });
    if (code === 'Backspace') this.send({ type: 'clear' });
    if (code === 'KeyU' || (code === 'KeyZ' && (e.ctrlKey || e.metaKey))) { this.send({ type: 'undo' }); return; }
    if (code === 'KeyZ') this.setTool('draw');
    if (code === 'KeyB') this.setTool('boost');
    if (code === 'KeyE') this.setTool('eraser');
    if (code === 'KeyP') this.setTool('pan');
  }

  // ------------------------------------------------------------ Takt

  private update(dt: number): void {
    if (this.screen !== 'play' || !this.sim) return;
    const ev = this.sim.step(dt, this.input.read());
    this.testRun?.recorder.onEvents(this.sim, ev);
    this.events.push(...ev);
    for (const e of ev) this.react(e);
  }

  private react(e: SimEvent): void {
    switch (e.type) {
      case 'jump': audio.jump(); break;
      case 'land': audio.land(e.speed); break;
      case 'spring': audio.spring(); break;
      case 'gift': audio.gift(e.streak); break;
      case 'checkpoint': audio.checkpoint(); this.hud.toast('Checkpoint!'); break;
      case 'board': this.setTool('draw'); break;
      case 'launch': audio.launch(); break;
      case 'arrive': this.hud.toast('Angekommen – Checkpoint!'); break;
      case 'crash': {
        audio.crash();
        const msg = { stall: 'Der Schlitten kommt nicht weiter – nochmal planen', stuck: 'Festgefahren – nochmal planen', missed: 'Landezone verfehlt – nochmal planen' } as const;
        if (e.cause in msg) this.hud.toast(msg[e.cause as keyof typeof msg], 2200);
        break;
      }
      case 'inkEmpty': this.hud.toast(e.boost ? 'Speedtinte aufgebraucht!' : 'Tinte aufgebraucht!'); break;
      case 'blocked': audio.blocked(); this.hud.toast('Hier kann man nicht zeichnen'); break;
      case 'refuse': audio.refuse(); this.hud.toast('Erst Geschenke sammeln!', 1800); break;
      case 'win': {
        audio.win();
        this.toolbar.setPlanning(false, false);
        this.toolbar.setPauseVisible(false);
        this.touch.show(false);
        const sim = this.sim;
        window.setTimeout(() => { if (this.sim === sim && this.screen === 'play') this.showWin(e.result); }, 1300);
        break;
      }
      default: break;
    }
  }

  private render(alpha: number): void {
    if (this.screen === 'editor') { this.editor?.render(); return; }
    const sim = this.sim;
    if (!sim) { this.view.renderScenery(); return; }
    this.view.render(sim, alpha, this.events);
    this.events = [];
    if (this.screen !== 'play') return;
    const planning = sim.mode === 'sled' && sim.phase === 'plan';
    this.toolbar.setPlanning(planning, (sim.level.areas[sim.activeArea]?.boost ?? 0) !== 0);
    this.touch.show(sim.mode === 'foot');
    this.toolbar.setReplan(sim.canReplan);
    this.hud.update(sim, this.testRun ? 'Probe:' : this.hudPrefix);
    const foot = sim.mode === 'foot';
    const at = foot || !sim.level.stations[sim.activeArea] ? sim.player.center : sim.level.stations[sim.activeArea].pos;
    const strokes = sim.ink.strokes.filter((s) => s.area === sim.activeArea).length;
    this.hints.show(activeHint(sim.level.hints, at, sim.mode, sim.phase, strokes));
  }
}
