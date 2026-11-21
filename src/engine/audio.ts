/**
 * Kleine WebAudio-Synth-Sounds ohne Asset-Dateien.
 * Oszillatoren + weiche Hüllkurven, Glöckchen aus unharmonischen Teiltönen.
 * unlock() muss nach der ersten Nutzer-Geste laufen (Browser-Autoplay-Policy).
 */
const MUTE_KEY = 'schlittenfahrer.muted';
/** Teiltöne einer kleinen Glocke (Verhältnis, relative Lautstärke, Abklingfaktor) */
const BELL: readonly [number, number, number][] = [[1, 1, 1], [2.76, 0.45, 0.6], [5.4, 0.22, 0.35], [8.93, 0.1, 0.2]];

function readMuted(): boolean {
  try { return window.localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private mounted = false;
  private mutedFlag = readMuted();
  private lastBlocked = -1;

  get muted(): boolean { return this.mutedFlag; }

  /** Stummschalten wirkt sofort (auch auf klingende Töne) und wird gemerkt. */
  setMuted(m: boolean): void {
    this.mutedFlag = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    try { window.localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* Best-Effort */ }
  }

  /** Einmalig binden: erste Geste entriegelt Audio; im Hintergrund pausieren. */
  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    document.addEventListener('pointerdown', () => this.unlock());
    document.addEventListener('keydown', () => this.unlock());
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.mutedFlag ? 0 : 1;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
  }

  /** Bereit zum Spielen? (entriegelt, nicht stumm) */
  private out(): { ctx: AudioContext; dest: GainNode } | null {
    if (!this.ctx || !this.master || this.mutedFlag) return null;
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
    return { ctx: this.ctx, dest: this.master };
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol = 0.14, slideTo?: number, delay = 0): void {
    const o = this.out();
    if (!o) return;
    const t0 = o.ctx.currentTime + delay;
    const osc = o.ctx.createOscillator();
    const g = o.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo && slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(o.dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Glöckchen: Sinus-Teiltöne mit schnellem Anschlag und langem Ausklingen. */
  private bell(freq: number, vol = 0.12, dur = 0.9, delay = 0): void {
    const o = this.out();
    if (!o) return;
    const t0 = o.ctx.currentTime + delay;
    for (const [ratio, amp, decay] of BELL) {
      const osc = o.ctx.createOscillator();
      const g = o.ctx.createGain();
      const d = dur * decay;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * ratio, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol * amp, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      osc.connect(g).connect(o.dest);
      osc.start(t0);
      osc.stop(t0 + d + 0.05);
    }
  }

  /** Geschenk: Glöckchen-Doppelschlag, Tonhöhe steigt mit der Sammel-Serie */
  gift(streak: number): void {
    const f = 1046 * Math.pow(2, ((streak % 5) * 2) / 12);
    this.bell(f, 0.13, 0.7);
    this.bell(f * 1.5, 0.09, 0.8, 0.07);
  }

  checkpoint(): void {
    this.bell(784, 0.1, 0.9);
    this.bell(1175, 0.08, 1.1, 0.1);
  }

  crash(): void {
    this.blip(170, 0.3, 'triangle', 0.2, 50);
    this.blip(90, 0.35, 'sine', 0.2, 40, 0.02);
  }

  jump(): void {
    this.blip(300, 0.12, 'sine', 0.1, 520);
  }

  /** Landung: weicher Plumps, lauter je schneller */
  land(speed: number): void {
    if (speed < 300) return;
    const v = Math.min(0.18, 0.05 + speed / 8000);
    this.blip(140, 0.12, 'sine', v, 70);
  }

  spring(): void {
    this.blip(180, 0.32, 'triangle', 0.14, 760);
    this.blip(360, 0.25, 'sine', 0.06, 1100, 0.03);
  }

  /** Zeichnen verboten: kurzes, leises Brummen */
  blocked(): void {
    const now = this.ctx?.currentTime ?? 0;
    if (now - this.lastBlocked < 0.3) return;
    this.lastBlocked = now;
    this.blip(140, 0.12, 'square', 0.05, 120);
  }

  launch(): void {
    this.blip(130, 0.45, 'triangle', 0.14, 520);
    this.bell(1568, 0.05, 0.5, 0.1);
  }

  /** Schornstein verlangt erst Geschenke: kurzes "nope" */
  refuse(): void {
    this.blip(260, 0.1, 'triangle', 0.12, 180);
    this.blip(200, 0.12, 'triangle', 0.12, 140, 0.11);
  }

  /** Liefer-Fanfare in Glöckchen */
  win(): void {
    [1046, 1318, 1568, 2093].forEach((f, i) => this.bell(f, 0.12, 1, i * 0.12));
    this.bell(1568, 0.1, 1.6, 0.55);
    this.bell(2093, 0.08, 1.8, 0.6);
  }

  /** Neuer Rekord: schneller Glöckchen-Lauf aufwärts */
  record(): void {
    [1318, 1568, 1760, 2093, 2637].forEach((f, i) => this.bell(f, 0.1, 0.8, i * 0.07));
  }
}

export const audio = new AudioEngine();
