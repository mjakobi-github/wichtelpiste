import type { FootInput } from '../sim/player';

const JUMP_KEYS = ['Space', 'KeyW', 'ArrowUp'];
const BLOCK_KEYS = ['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'Backspace'];

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];
const isTyping = (t: EventTarget | null): boolean => TYPING_TAGS.includes((t as { tagName?: string } | null)?.tagName ?? '');

/**
 * Tastatur + virtuelle Touch-Knöpfe → FootInput.
 * jumpPressed ist eine Flanke: true genau beim ersten read() nach dem Drücken.
 */
export class Input {
  /** Einmal pro Tastendruck (ohne Auto-Repeat), für Werkzeuge/Menü. */
  onKey: ((code: string, e: KeyboardEvent) => void) | null = null;

  private keys = new Set<string>();
  private virt = { left: false, right: false, jump: false };
  private pressed = false;

  read(): FootInput {
    const left = this.virt.left || this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const right = this.virt.right || this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const jumpHeld = this.virt.jump || JUMP_KEYS.some((k) => this.keys.has(k));
    const jumpPressed = this.pressed;
    this.pressed = false;
    const move = (right ? 1 : 0) - (left ? 1 : 0);
    return { move: move as -1 | 0 | 1, jumpHeld, jumpPressed };
  }

  attach(target: EventTarget = window): void {
    target.addEventListener('keydown', (ev) => {
      const e = ev as KeyboardEvent;
      // Tippen in Eingabefeldern (z. B. Editor-Zahlen) gehört nicht dem Spiel.
      if (isTyping(e.target)) return;
      if (BLOCK_KEYS.includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (JUMP_KEYS.includes(e.code)) this.pressed = true;
      this.keys.add(e.code);
      this.onKey?.(e.code, e);
    });
    target.addEventListener('keyup', (e) => this.keys.delete((e as KeyboardEvent).code));
    target.addEventListener('blur', () => this.keys.clear());
  }

  /** Virtuellen Knopf binden (Touch-Steuerung). */
  bindButton(el: HTMLElement, which: 'left' | 'right' | 'jump'): void {
    const set = (v: boolean) => {
      if (which === 'jump' && v && !this.virt.jump) this.pressed = true;
      this.virt[which] = v;
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* egal */ }
      set(true);
    });
    const release = () => set(false);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  reset(): void {
    this.keys.clear();
    this.virt = { left: false, right: false, jump: false };
    this.pressed = false;
  }
}
