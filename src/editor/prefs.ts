export interface EditorPrefs {
  mode: 'simple' | 'pro';
  view: 'pretty' | 'sketch';
  showJumps: boolean;
  senderName: string;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'wichtelpiste.editor.prefs.v1';
const DEFAULTS: EditorPrefs = { mode: 'simple', view: 'pretty', showJumps: true, senderName: '' };

const cleanName = (s: string): string => s.trim().slice(0, 20).trim();

/** Editor-Einstellungen je Gerät (Best-Effort). initialLowQuality: schwaches Gerät → erste Ansicht Skizze. */
export class Prefs {
  private data: EditorPrefs;

  constructor(private readonly store: Store | null, initialLowQuality = false) {
    let raw: Partial<Record<keyof EditorPrefs, unknown>> | null = null;
    try {
      const s = store?.getItem(KEY);
      raw = s ? (JSON.parse(s) as typeof raw) : null;
    } catch {
      raw = null;
    }
    const r: Partial<Record<keyof EditorPrefs, unknown>> = raw ?? {};
    this.data = {
      mode: r.mode === 'pro' || r.mode === 'simple' ? r.mode : DEFAULTS.mode,
      view: r.view === 'pretty' || r.view === 'sketch' ? r.view : raw === null && initialLowQuality ? 'sketch' : DEFAULTS.view,
      showJumps: typeof r.showJumps === 'boolean' ? r.showJumps : DEFAULTS.showJumps,
      senderName: typeof r.senderName === 'string' ? cleanName(r.senderName) : '',
    };
  }

  get(): EditorPrefs {
    return { ...this.data };
  }

  set(p: Partial<EditorPrefs>): EditorPrefs {
    this.data = { ...this.data, ...p, ...(p.senderName !== undefined ? { senderName: cleanName(p.senderName) } : {}) };
    try { this.store?.setItem(KEY, JSON.stringify(this.data)); } catch { /* Best-Effort */ }
    return this.get();
  }
}
