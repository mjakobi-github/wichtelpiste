export type RenderReason = 'level' | 'camera' | 'selection' | 'view' | 'resize';

/**
 * Rendern auf Anforderung: Nach einer Änderung wird gezeichnet und genau ein Bild nachgezogen
 * (damit späte Textur-Uploads sichtbar werden); im Leerlauf nichts.
 */
export class RenderGate {
  private pending = 2;

  invalidate(_reason: RenderReason): void {
    this.pending = 2;
  }

  take(): boolean {
    if (this.pending <= 0) return false;
    this.pending--;
    return true;
  }
}
