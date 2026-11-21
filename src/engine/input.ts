/**
 * Eingabeabstraktion: Tastatur (PC) + virtuelle Buttons (Smartphone)
 * muenden in demselben Zustand: move (-1/0/+1), jumpHeld und
 * einem Sprung-Puffer, damit kurz-vor-Boden gedrueckte Spruenge nicht verloren
 * gehen ("Jump Buffer").
 */
export interface PlayerInput {
  /** -1 = links, 0 = still, +1 = rechts */
  move: number;
  jumpHeld: boolean;
}

export class Input {
  /** Optionaler Hook: einmalig pro Tastendruck (kein Auto-Repeat). */
  onKeyPress: ((code: string) => void) | null = null;

  private keys = new Set<string>();
  private virtLeft = false;
  private virtRight = false;
  private virtJump = false;

  /** Sprungpuffer: bis zu_buffer Sekunden gueltig, wird durch consume verbraucht. */
  private static readonly BUFFER_SEC = 0.12;
  private bufferUntil = -1;
  private now = 0;

  // Muss jede Game-Iteration mit der aktuellen Zeit versorgt werden.
  tick(nowSeconds: number): void {
    this.now = nowSeconds;
  }

  /** Wurde Sprung gedrueckt (innerhalb des Puffers) und wurde noch nicht verbraucht? */
  consumeJump(): boolean {
    if (this.bufferUntil > this.now) {
      this.bufferUntil = -1;
      return true;
    }
    return false;
  }

  read(): PlayerInput {
    const left =
      this.virtLeft ||
      this.keys.has('ArrowLeft') ||
      this.keys.has('KeyA');
    const right =
      this.virtRight ||
      this.keys.has('ArrowRight') ||
      this.keys.has('KeyD');
    const jump =
      this.virtJump ||
      this.keys.has('Space') ||
      this.keys.has('KeyW') ||
      this.keys.has('ArrowUp');

    let move = 0;
    if (left) move -= 1;
    if (right) move += 1;
    return { move, jumpHeld: jump };
  }

  /** Wird vom Game (eindeutige Setup-Stelle) an canvas/document gebunden. */
  attach(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
      }
      if (this.isJumpKey(e.code)) this.pressJump();
      this.keys.add(e.code);
      this.onKeyPress?.(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    // Fokus-Verlust: alle Tasten loslassen, sonst "Klemmtaste"
    window.addEventListener('blur', () => this.keys.clear());

    this.bindButton('btn-left', (v) => (this.virtLeft = v));
    this.bindButton('btn-right', (v) => (this.virtRight = v));
    this.bindButton('btn-jump', (v) => {
      this.virtJump = v;
      if (v) this.pressJump();
    });
  }

  private isJumpKey(code: string): boolean {
    return code === 'Space' || code === 'KeyW' || code === 'ArrowUp';
  }

  private pressJump(): void {
    this.bufferUntil = this.now + Input.BUFFER_SEC;
  }

  private bindButton(id: string, set: (pressed: boolean) => void): void {
    const el = document.getElementById(id);
    if (!el) return;
    // pointerdown/up deckt Maus + Touch ab; pointercapture halten,
    // damit Finger über den Button hinausziehen nicht haengen bleibt.
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      set(true);
    });
    const release = () => set(false);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }
}
