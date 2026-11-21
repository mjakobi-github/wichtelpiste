import type { Vec2 } from './types';

/** Befehle an die Simulation (aus Eingabe/UI); werden im nächsten step angewendet. */
export type Command =
  | { type: 'strokeBegin'; p: Vec2; boost: boolean }
  | { type: 'strokeMove'; p: Vec2 }
  | { type: 'strokeEnd' }
  | { type: 'strokeCancel' }
  | { type: 'erase'; p: Vec2 }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'launch' }
  | { type: 'retry' }
  /** Nach der Ankunft zu Fuß: zurück an die letzte Station, Stand vor der Fahrt. */
  | { type: 'replan' };

export interface WinResult { stars: 1 | 2 | 3; gifts: number; giftTotal: number; inkUsed: number }

/** Ereignisse eines Ticks – Darstellung und Audio reagieren darauf. */
export type SimEvent =
  | { type: 'jump' }
  | { type: 'land'; speed: number; pos: Vec2 }
  | { type: 'gift'; index: number; pos: Vec2; streak: number }
  | { type: 'checkpoint'; pos: Vec2 }
  | { type: 'board'; area: number }
  | { type: 'launch' }
  | { type: 'arrive'; pos: Vec2 }
  /** missed = über die Landezone hinaus, stuck = festgefahren, stall = Schaukeln ohne Fortschritt */
  | { type: 'crash'; pos: Vec2; cause: 'fall' | 'hazard' | 'stall' | 'stuck' | 'missed' }
  | { type: 'spring'; pos: Vec2 }
  | { type: 'inkEmpty'; boost: boolean }
  | { type: 'blocked'; pos: Vec2 }
  | { type: 'refuse' }
  | { type: 'win'; result: WinResult };
