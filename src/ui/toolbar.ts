import type { ToolName } from '../engine/gestures';

export type ToolAction = 'undo' | 'clear' | 'launch' | 'pause';

const TOOLS: { tool: ToolName; label: string; title: string }[] = [
  { tool: 'draw', label: '✏️', title: 'Piste (Z)' },
  { tool: 'boost', label: '🚀', title: 'Speedtinte (B)' },
  { tool: 'eraser', label: '🧽', title: 'Radierer (E)' },
  { tool: 'pan', label: '✋', title: 'Verschieben (P)' },
];

/** Werkzeugleiste (Planungsphase), LOS-Knopf, Pause-Knopf. */
export class Toolbar {
  private readonly bar: HTMLElement;
  private readonly launch: HTMLButtonElement;
  private readonly buttons = new Map<ToolName, HTMLButtonElement>();
  private readonly boostBtn: HTMLButtonElement;

  constructor(root: HTMLElement, onTool: (t: ToolName) => void, onAction: (a: ToolAction) => void) {
    this.bar = document.createElement('div');
    this.bar.className = 'tools hidden';
    root.appendChild(this.bar);
    for (const t of TOOLS) {
      const b = btn(this.bar, 'toolbtn', t.label, t.title, () => onTool(t.tool));
      this.buttons.set(t.tool, b);
    }
    this.boostBtn = this.buttons.get('boost')!;
    btn(this.bar, 'toolbtn', '↶', 'Rückgängig (U)', () => onAction('undo'));
    btn(this.bar, 'toolbtn danger', '🗑️', 'Abschnitt löschen (Backspace)', () => onAction('clear'));
    this.launch = btn(root, 'launch hidden', '🛷 LOS!', 'Losfahren (Leertaste)', () => onAction('launch'));
    btn(root, 'pausebtn', '☰', 'Pause (Esc)', () => onAction('pause'));
  }

  setTool(t: ToolName): void {
    for (const [k, b] of this.buttons) b.classList.toggle('active', k === t);
  }

  setPlanning(planning: boolean, boostAvailable: boolean): void {
    this.bar.classList.toggle('hidden', !planning);
    this.launch.classList.toggle('hidden', !planning);
    this.boostBtn.classList.toggle('hidden', !boostAvailable);
  }
}

function btn(parent: HTMLElement, cls: string, label: string, title: string, on: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = label;
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
