import type { LevelData } from '../sim/types';
import type { Solution } from '../levels/solveRunner';
import { levelHash } from '../sim/scoring';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type SaveResult = { ok: true } | { ok: false; error: string };

const FULL = 'Speicher ist voll – lösche ein altes Level';

function read<T>(store: Store | null, key: string): T[] {
  try {
    const raw = store?.getItem(key);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function write(store: Store | null, key: string, v: unknown): SaveResult {
  try {
    store?.setItem(key, JSON.stringify(v));
    return { ok: true };
  } catch {
    return { ok: false, error: FULL };
  }
}

function uid(): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return r.replace(/-/g, '').slice(0, 16);
}

export interface MyLevel {
  uid: string;
  level: LevelData;
  solution: Solution | null;
  updatedAt: number;
  /** Dev: Dateiname in src/levels, wenn von dort geöffnet/dorthin gespeichert */
  file?: string | null;
  camera?: { cx: number; cy: number; zoom: number } | null;
}

const MY = 'wichtelpiste.mylevels.v1';
const DRAFT = 'wichtelpiste.editor.draft.v1';
const MIGRATED = 'wichtelpiste.mylevels.migrated';

/** Eigene Levels im Browser (neueste zuerst). */
export class MyLevels {
  constructor(private readonly store: Store | null) {}

  list(): MyLevel[] {
    return read<MyLevel>(this.store, MY).filter((m) => m && typeof m.uid === 'string' && m.level).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): MyLevel | null {
    return this.list().find((m) => m.uid === id) ?? null;
  }

  save(m: MyLevel): SaveResult {
    const all = this.list().filter((x) => x.uid !== m.uid);
    return write(this.store, MY, [{ ...m, updatedAt: Math.max(m.updatedAt, Date.now()) }, ...all]);
  }

  create(level: LevelData, solution: Solution | null): MyLevel {
    const m: MyLevel = { uid: uid(), level, solution, updatedAt: Date.now() + this.list().length * 0.001 };
    this.save(m);
    return m;
  }

  remove(id: string): void {
    write(this.store, MY, this.list().filter((m) => m.uid !== id));
  }

  /** Übernimmt den einzelnen Entwurf des alten Editors genau einmal. */
  migrateDraft(): MyLevel | null {
    try {
      if (this.store?.getItem(MIGRATED)) return null;
      this.store?.setItem(MIGRATED, '1');
      const raw = this.store?.getItem(DRAFT);
      if (!raw) return null;
      const d = JSON.parse(raw) as { level?: LevelData; solution?: Solution | null };
      if (!d?.level) return null;
      return this.create(d.level, d.solution ?? null);
    } catch {
      return null;
    }
  }
}

export interface Gift { key: string; level: LevelData; from: string; challengeInk: number | null; receivedAt: number }

const GIFTS = 'wichtelpiste.gifts.v1';

/** Empfangene Levels; gleicher Inhalt = ein Eintrag. */
export class Gifts {
  constructor(private readonly store: Store | null) {}

  list(): Gift[] {
    return read<Gift>(this.store, GIFTS).filter((g) => g && typeof g.key === 'string' && g.level).sort((a, b) => b.receivedAt - a.receivedAt);
  }

  get(key: string): Gift | null {
    return this.list().find((g) => g.key === key) ?? null;
  }

  add(level: LevelData, from: string, challengeInk: number | null): Gift {
    const g: Gift = { key: levelHash(level), level, from, challengeInk, receivedAt: Date.now() };
    write(this.store, GIFTS, [g, ...this.list().filter((x) => x.key !== g.key)]);
    return g;
  }

  remove(key: string): void {
    write(this.store, GIFTS, this.list().filter((g) => g.key !== key));
  }
}
