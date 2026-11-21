import { LEVELS } from '../levels';
import { Simulation } from '../sim/simulation';
import type { Command, SimEvent, WinResult } from '../sim/events';
import { Loop } from '../engine/loop';
import { Input } from '../engine/input';
import { Gestures, type ToolName } from '../engine/gestures';
import { audio } from '../engine/audio';
import { createStage } from '../view/stage';
import { GameView } from '../view/gameView';
import { Hud } from '../ui/hud';
import { Toolbar, type ToolAction } from '../ui/toolbar';
import { TouchControls } from '../ui/touchControls';
import { Progress } from './progress';

type Screen = 'menu' | 'play' | 'won';

/** Verdrahtet Simulation, Darstellung, Oberfläche und Audio. */
export class App {
  private screen: Screen = 'menu';
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
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay hidden';
    this.uiRoot.appendChild(this.overlay);

    this.input.attach();
    this.input.onKey = (code, e) => this.key(code, e);
    audio.mount();

    new Gestures(this.stageHost, {
      tool: () => this.tool,
      enabled: () => this.screen === 'play' && this.sim?.mode === 'sled' && this.sim.phase === 'plan',
      toWorld: (x, y) => this.view.screenToWorld(x, y),
      send: (c) => this.send(c),
      pan: (dx, dy) => this.view.panBy(dx, dy),
    });

    new Loop((dt) => this.update(dt), (alpha) => this.render(alpha)).start();
    this.openMenu();
  }

  // ------------------------------------------------------------ Ablauf

  private openMenu(): void {
    this.screen = 'menu';
    this.sim = null;
    this.hud.show(false);
    this.touch.show(false);
    this.toolbar.setPlanning(false, false);
    const items = LEVELS.map((lv, i) => {
      const p = this.progress.get(lv);
      const stars = '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars);
      const best = p.bestInk === null ? '' : ` · 🏆 ${p.bestInk}`;
      return `<button data-i="${i}">${i + 1}. ${lv.name}<br><small>${stars}${best}</small></button>`;
    }).join('');
    this.showOverlay(`<div class="panel"><h1>🛷 Schlittenfahrer</h1><div class="levels">${items}</div></div>`);
    this.overlay.querySelectorAll<HTMLElement>('[data-i]').forEach((b) =>
      b.addEventListener('click', () => void this.startLevel(Number(b.dataset.i))));
  }

  private async startLevel(idx: number): Promise<void> {
    this.levelIdx = idx;
    const level = LEVELS[idx];
    this.sim = new Simulation(level);
    await this.view.load(level);
    this.input.reset();
    this.hideOverlay();
    this.hud.show(true);
    this.setTool('draw');
    this.screen = 'play';
  }

  private showWin(r: WinResult): void {
    this.screen = 'won';
    const lv = LEVELS[this.levelIdx];
    const rec = this.progress.record(lv, r);
    const best = this.progress.get(lv).bestInk;
    const next = this.levelIdx + 1 < LEVELS.length;
    this.toolbar.setPlanning(false, false);
    this.touch.show(false);
    this.showOverlay(`<div class="panel"><h2>Level geschafft!</h2>
      <div style="font-size:40px">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</div>
      <p>${r.gifts} / ${r.giftTotal} Geschenke · Tinte ${r.inkUsed}${rec.newBestInk ? ' · <b>Neuer Rekord!</b>' : ''}${best !== null ? ` · 🏆 ${best}` : ''}</p>
      <div class="row"><button data-a="again">Nochmal</button>${next ? '<button data-a="next">Weiter</button>' : ''}<button data-a="menu">Levelauswahl</button></div></div>`);
    this.overlay.querySelector('[data-a="again"]')?.addEventListener('click', () => void this.startLevel(this.levelIdx));
    this.overlay.querySelector('[data-a="next"]')?.addEventListener('click', () => void this.startLevel(this.levelIdx + 1));
    this.overlay.querySelector('[data-a="menu"]')?.addEventListener('click', () => this.openMenu());
  }

  private showOverlay(html: string): void {
    this.overlay.innerHTML = html;
    this.overlay.classList.remove('hidden');
  }

  private hideOverlay(): void {
    this.overlay.classList.add('hidden');
    this.overlay.innerHTML = '';
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
    if (a === 'pause') { this.openMenu(); return; }
    if (a === 'undo') this.send({ type: 'undo' });
    if (a === 'clear') this.send({ type: 'clear' });
    if (a === 'launch') this.send({ type: 'launch' });
  }

  private key(code: string, e: KeyboardEvent): void {
    if (code === 'Escape') { if (this.screen === 'play') this.openMenu(); return; }
    if (this.screen !== 'play' || !this.sim) return;
    const planning = this.sim.mode === 'sled' && this.sim.phase === 'plan';
    if (code === 'KeyR') this.send({ type: 'retry' });
    if (!planning) return;
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
    this.events.push(...ev);
    for (const e of ev) this.react(e);
  }

  private react(e: SimEvent): void {
    switch (e.type) {
      case 'jump': audio.jump(); break;
      case 'gift': audio.gift(e.streak); break;
      case 'checkpoint': audio.checkpoint(); this.hud.toast('Checkpoint!'); break;
      case 'board': this.setTool('draw'); break;
      case 'launch': audio.launch(); break;
      case 'arrive': this.hud.toast(e.stuck ? 'Doch zu Fuß weiter …' : 'Angekommen – Checkpoint!'); break;
      case 'crash': audio.crash(); if (e.cause === 'stall') this.hud.toast('Der Schlitten kommt nicht weiter – nochmal planen'); break;
      case 'inkEmpty': this.hud.toast(e.boost ? 'Speedtinte aufgebraucht!' : 'Tinte aufgebraucht!'); break;
      case 'blocked': this.hud.toast('Hier kann man nicht zeichnen'); break;
      case 'refuse': audio.refuse(); this.hud.toast('Erst Geschenke sammeln!', 1800); break;
      case 'win': audio.win(); this.showWin(e.result); break;
      default: break;
    }
  }

  private render(alpha: number): void {
    const sim = this.sim;
    if (!sim) return;
    this.view.render(sim, alpha, this.events);
    this.events = [];
    if (this.screen !== 'play') return;
    const planning = sim.mode === 'sled' && sim.phase === 'plan';
    this.toolbar.setPlanning(planning, sim.level.areas[sim.activeArea].boost !== 0);
    this.touch.show(sim.mode === 'foot');
    this.hud.update(sim, this.levelIdx + 1);
  }
}
