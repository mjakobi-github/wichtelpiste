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
import { renderLevelSelect } from '../ui/screens/levelSelect';
import { renderPause } from '../ui/screens/pause';
import { renderWin } from '../ui/screens/win';
import { Progress } from './progress';
import { canPause, nextScreen, type Screen, type ScreenAction } from './flow';
import { fullscreenSupported, toggleFullscreen } from '../ui/fullscreen';
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

/** Laufende Probefahrt aus dem Editor. */
interface TestRun { level: LevelData; fromArea: number | null; recorder: Recorder; onBack: (rec: Recording) => void }

/** Verdrahtet Simulation, Darstellung, Oberfläche und Audio. */
export class App {
  private screen: Screen = 'title';
  private levelIdx = 0;
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
  private testRun: TestRun | null = null;

  constructor(private readonly stageHost: HTMLElement, private readonly uiRoot: HTMLElement) {
    let store: Storage | null = null;
    try { store = window.localStorage; } catch { store = null; }
    this.progress = new Progress(store);
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
    this.hideGameUi();
    this.view.showScenery(MENU_THEME);
  }

  private openTitle(): void {
    this.screen = 'title';
    this.toMenu();
    this.showOverlay((el) => renderTitle(el, () => this.openLevels('start'), editorAllowed() ? () => void this.openEditor() : null));
  }

  private openLevels(a: ScreenAction): void {
    this.go(a);
    this.toMenu();
    this.showOverlay((el) => renderLevelSelect(el, LEVELS, (lv) => this.progress.get(lv), (i) => void this.startLevel(i, 'pickLevel'), () => this.openTitle()));
  }

  // ------------------------------------------------------------ Editor

  private async openEditor(): Promise<void> {
    if (!this.editor) {
      const { Editor } = await import('../editor/editor');
      const host: EditorHost = {
        view: this.view,
        uiRoot: this.uiRoot,
        stageHost: this.stageHost,
        startTest: (level, fromArea, onBack) => void this.startTest(level, fromArea, onBack),
        close: () => { this.editor?.hide(); this.openLevels('toLevels'); },
        toast: (t, ms) => this.hud.toast(t, ms),
      };
      this.editor = new Editor(host);
    }
    this.go('openEditor');
    this.sim = null;
    this.hideGameUi();
    this.hideOverlay();
    this.editor.show();
  }

  private async startTest(level: LevelData, fromArea: number | null, onBack: (rec: Recording) => void): Promise<void> {
    const { Recorder } = await import('../editor/recorder');
    this.testRun = { level, fromArea, recorder: new Recorder(level), onBack };
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
    if (run) void this.startTest(run.level, run.fromArea, run.onBack);
    else void this.startLevel(this.levelIdx, a);
  }

  private async startLevel(idx: number, a: ScreenAction): Promise<void> {
    this.testRun = null;
    this.view.editMode = false;
    this.levelIdx = idx;
    const level = LEVELS[idx];
    this.sim = new Simulation(level);
    await this.view.load(level);
    this.input.reset();
    this.hideOverlay();
    this.hud.show(true);
    this.toolbar.setPauseVisible(true);
    this.setTool('draw');
    this.go(a);
    this.hud.banner(`${idx + 1}. ${level.name}`, 'Sammle die Geschenke und bring sie zum Schornstein');
  }

  private showWin(r: WinResult): void {
    this.go('win');
    this.hideGameUi();
    this.hud.show(true);
    if (this.testRun) {
      this.showOverlay((el) => renderWin(el, { result: r, newBestInk: false, bestInk: null, hasNext: false, backLabel: 'Zurück zum Editor' }, {
        again: () => this.restartCurrent('again'),
        next: () => undefined,
        levels: () => this.backToEditor(),
      }));
      return;
    }
    const lv = LEVELS[this.levelIdx];
    const rec = this.progress.record(lv, r);
    if (rec.newBestInk) window.setTimeout(() => { if (this.screen === 'won') audio.record(); }, 1500);
    this.showOverlay((el) => renderWin(el, {
      result: r,
      newBestInk: rec.newBestInk,
      bestInk: this.progress.get(lv).bestInk,
      hasNext: this.levelIdx + 1 < LEVELS.length,
    }, {
      again: () => void this.startLevel(this.levelIdx, 'again'),
      next: () => void this.startLevel(this.levelIdx + 1, 'next'),
      levels: () => this.openLevels('toLevels'),
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
    this.toolbar.setPlanning(planning, sim.level.areas[sim.activeArea].boost !== 0);
    this.touch.show(sim.mode === 'foot');
    this.toolbar.setReplan(sim.canReplan);
    this.hud.update(sim, this.testRun ? 0 : this.levelIdx + 1);
    const foot = sim.mode === 'foot';
    const at = foot ? sim.player.center : sim.level.stations[sim.activeArea].pos;
    const strokes = sim.ink.strokes.filter((s) => s.area === sim.activeArea).length;
    this.hints.show(activeHint(sim.level.hints, at, sim.mode, sim.phase, strokes));
  }
}
