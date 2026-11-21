import type { ToolName } from '../engine/gestures';
import { icon, type IconName } from './icons';

export type ToolAction = 'undo' | 'clear' | 'launch' | 'pause' | 'zoomIn' | 'zoomOut' | 'fullscreen' | 'replan';

const TOOLS: { tool: ToolName; label: IconName; title: string }[] = [
  { tool: 'draw', label: 'pencil', title: 'Piste (Z)' },
  { tool: 'boost', label: 'rocket', title: 'Speedtinte (B)' },
  { tool: 'eraser', label: 'eraser', title: 'Radierer (E)' },
  { tool: 'pan', label: 'hand', title: 'Verschieben (P)' },
];

/** Werkzeugleiste (Planungsphase), Zoom, LOS-Knopf, Pause/Vollbild, „Zurück zum Zeichnen“. */
export class Toolbar {
  private readonly bar: HTMLElement;
  private readonly launch: HTMLButtonElement;
  private readonly buttons = new Map<ToolName, HTMLButtonElement>();
  private readonly boostBtn: HTMLButtonElement;
  private readonly zoomBar: HTMLElement;
  private readonly replan: HTMLButtonElement;
  readonly fullscreenBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;

  constructor(root: HTMLElement, onTool: (t: ToolName) => void, onAction: (a: ToolAction) => void) {
    this.bar = document.createElement('div');
    this.bar.className = 'tools hidden';
    root.appendChild(this.bar);
    for (const t of TOOLS) {
      const b = btn(this.bar, `toolbtn tool-${t.tool}`, icon(t.label), t.title, () => onTool(t.tool));
      this.buttons.set(t.tool, b);
    }
    this.boostBtn = this.buttons.get('boost')!;
    btn(this.bar, 'toolbtn', icon('undo'), 'Rückgängig (U)', () => onAction('undo'));
    btn(this.bar, 'toolbtn danger', icon('trash'), 'Abschnitt löschen (Backspace)', () => onAction('clear'));
    this.zoomBar = document.createElement('div');
    this.zoomBar.className = 'zoombar hidden';
    root.appendChild(this.zoomBar);
    btn(this.zoomBar, 'toolbtn', icon('plus'), 'Hineinzoomen (+)', () => onAction('zoomIn'));
    btn(this.zoomBar, 'toolbtn', icon('minus'), 'Herauszoomen (-)', () => onAction('zoomOut'));
    this.launch = btn(root, 'launch hidden', `${icon('sled')} LOS!`, 'Losfahren (Leertaste)', () => onAction('launch'));
    this.replan = btn(root, 'replan hidden', `${icon('pencil')} Zurück zum Zeichnen`, 'Zurück zum Zeichnen (Q)', () => onAction('replan'));
    const corner = document.createElement('div');
    corner.className = 'corner';
    root.appendChild(corner);
    this.fullscreenBtn = btn(corner, 'toolbtn', icon('fullscreen'), 'Vollbild (F)', () => onAction('fullscreen'));
    this.pauseBtn = btn(corner, 'toolbtn', icon('pause'), 'Pause (Esc)', () => onAction('pause'));
  }

  setTool(t: ToolName): void {
    for (const [k, b] of this.buttons) b.classList.toggle('active', k === t);
  }

  setPlanning(planning: boolean, boostAvailable: boolean): void {
    this.bar.classList.toggle('hidden', !planning);
    this.launch.classList.toggle('hidden', !planning);
    this.zoomBar.classList.toggle('hidden', !planning);
    this.boostBtn.classList.toggle('hidden', !boostAvailable);
  }

  setPauseVisible(visible: boolean): void {
    this.pauseBtn.classList.toggle('hidden', !visible);
  }

  setReplan(visible: boolean): void {
    this.replan.classList.toggle('hidden', !visible);
  }
}

function btn(parent: HTMLElement, cls: string, label: string, title: string, on: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = cls;
  b.innerHTML = label;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    on();
  });
  parent.appendChild(b);
  return b;
}
