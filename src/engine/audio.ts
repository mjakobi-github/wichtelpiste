/**
 * Kleine WebAudio-Synth-Sounds ohne Asset-Dateien.
 * Alles wird per Oszillator + Envelope erzeugt; unlock() muss nach der
 * ersten Nutzer-Geste laufen (Browser-Autoplay-Policy).
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private mounted = false;

  /** Einmalig binden (Game ruft es im Konstruktor). */
  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    // Erste Geste entriegelt die Audio-Kontext-Erzeugung
    document.addEventListener('pointerdown', () => this.unlock());
    document.addEventListener('keydown', () => this.unlock());
  }

  unlock(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol = 0.14,
    slideTo?: number,
    delay = 0,
  ): void {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t0 = this.ctx.currentTime + delay;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo && slideTo > 0) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** Geschenk: aufsteigender Doppel-Ding, Tonhoehe rotiert mit Sammel-Streak */
  gift(streak: number): void {
    const f = 760 + (streak % 4) * 120;
    this.blip(f, 0.11, 'triangle', 0.16);
    this.blip(f * 1.5, 0.13, 'triangle', 0.11, undefined, 0.055);
  }

  checkpoint(): void {
    this.blip(523, 0.11, 'square', 0.09);
    this.blip(784, 0.15, 'square', 0.09, undefined, 0.09);
  }

  crash(): void {
    this.blip(150, 0.26, 'sawtooth', 0.18, 55);
  }

  jump(): void {
    this.blip(280, 0.11, 'triangle', 0.09, 470);
  }

  launch(): void {
    this.blip(130, 0.42, 'sawtooth', 0.13, 520);
  }

  /** Schornstein verlangt erst Geschenke: kurzes "nope" */
  refuse(): void {
    this.blip(220, 0.09, 'square', 0.1, 150);
  }

  /** Liefer-Fanfare */
  win(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.blip(f, 0.17, 'triangle', 0.15, undefined, i * 0.11));
    this.blip(784, 0.5, 'triangle', 0.11, undefined, 0.48);
  }
}

export const audio = new AudioEngine();
