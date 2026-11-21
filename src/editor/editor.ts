import type { GameView } from '../view/gameView';
import type { LevelData } from '../sim/types';
import { Simulation } from '../sim/simulation';
import type { Recording } from './recorder';
import { mergeSolution } from './recorder';
import { Draft, type DraftData } from './draft';
import { History } from './history';
import { newLevel } from './template';

export interface EditorHost {
  view: GameView;
  uiRoot: HTMLElement;
  stageHost: HTMLElement;
  startTest(level: LevelData, fromArea: number | null, onBack: (rec: Recording) => void): void;
  close(): void;
  toast(text: string, ms?: number): void;
}

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** Level-Editor (Gerüst): hält Dokument, Entwurf und Probefahrt-Rückkehr. */
export class Editor {
  private readonly draft = new Draft(store());
  private doc: DraftData;
  private history: History;
  private still: Simulation;
  private visible = false;

  constructor(private readonly host: EditorHost) {
    this.doc = this.draft.load() ?? { level: newLevel(), solution: null, file: null, camera: null };
    this.history = new History(this.doc.level);
    this.still = new Simulation(this.doc.level);
  }

  show(): void {
    this.visible = true;
    const v = this.host.view;
    v.editMode = true;
    v.showLevel(this.doc.level, { keepBackdrop: false });
    if (this.doc.camera) v.setCameraState(this.doc.camera);
  }

  hide(): void {
    if (this.visible) this.doc = { ...this.doc, camera: this.host.view.cameraState() };
    this.save();
    this.visible = false;
  }

  render(): void {
    if (this.visible) this.host.view.renderStill(this.still);
  }

  testPlay(fromArea: number | null): void {
    this.hide();
    this.host.startTest(this.doc.level, fromArea, (rec) => this.returnFromTest(rec));
  }

  private returnFromTest(rec: Recording): void {
    if (JSON.stringify(rec.level) === JSON.stringify(this.doc.level) && rec.solvedAreas.some(Boolean)) {
      this.doc = { ...this.doc, solution: mergeSolution(this.doc.solution, rec) };
      this.save();
    }
  }

  private save(): void {
    this.draft.save(this.doc);
  }

  /** Für die nächste Ausbaustufe: aktueller Stand. */
  get level(): LevelData { return this.history.current; }
}
