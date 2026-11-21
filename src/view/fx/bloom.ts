import type { Container, Filter } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';

/** Bloom/Glühen auf hellen Bildteilen (Linien, Lichter, Funken); abschaltbar je Qualitätsstufe. */
export class Bloom {
  private readonly filter: Filter;
  private on = false;

  constructor(private readonly target: Container) {
    this.filter = new AdvancedBloomFilter({ threshold: 0.3, bloomScale: 1.1, brightness: 1, blur: 6, quality: 4 });
  }

  set enabled(v: boolean) {
    if (v === this.on) return;
    this.on = v;
    this.target.filters = v ? [this.filter] : [];
  }

  get enabled(): boolean { return this.on; }
}
