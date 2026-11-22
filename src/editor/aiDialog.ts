import type { LevelData } from '../sim/types';
import type { Solution } from '../levels/solveRunner';
import { playableWithBudgets, verifyLevel, type Verdict } from '../levels/verify';
import { aiInstructions, feedbackText, parseAiReply } from './ai';
import { levelIssues } from './checks';
import { icon } from '../ui/icons';
import { esc } from '../ui/screens/common';

const STORE = 'wichtelpiste.ai.v1';

/** Idee und letzte Antwort überleben das Wechseln in die Chatbot-App (Handy lädt die Seite oft neu). */
function loadDraft(): { idea: string; reply: string } {
  try {
    const v = JSON.parse(window.localStorage.getItem(STORE) ?? '{}') as { idea?: unknown; reply?: unknown };
    return { idea: typeof v.idea === 'string' ? v.idea : '', reply: typeof v.reply === 'string' ? v.reply : '' };
  } catch {
    return { idea: '', reply: '' };
  }
}
function saveDraft(d: { idea: string; reply: string }): void {
  try { window.localStorage.setItem(STORE, JSON.stringify(d)); } catch { /* egal */ }
}

/** In die Zwischenablage; sonst das Textfeld markieren, damit man selbst kopiert. */
async function copy(text: string, fallbackEl: HTMLTextAreaElement): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Rückfall unten */ }
  fallbackEl.value = text;
  fallbackEl.classList.remove('hidden');
  fallbackEl.scrollIntoView({ block: 'nearest' });
  fallbackEl.focus();
  fallbackEl.select();
  return false;
}

/** Ergebnis einer Prüfung, mit dem der Editor weiterarbeitet. */
export interface Checked { level: LevelData; solution: Solution; verdict: Verdict; inkRaised: boolean }

/** Prüft ein Level; reicht die Tinte nicht, wird sie gleich erhöht (wenn es dann spielbar ist). */
export async function checkLevel(level: LevelData, keep: Solution | null): Promise<Checked> {
  const verdict = await verifyLevel(level, keep);
  if (!verdict.playable && verdict.budgets && playableWithBudgets(verdict)) {
    const raised = { ...level, areas: verdict.budgets };
    const again = await verifyLevel(raised, verdict.solution);
    return { level: raised, solution: again.solution, verdict: again, inkRaised: true };
  }
  return { level, solution: verdict.solution, verdict, inkRaised: false };
}

function verdictHtml(c: Checked): string {
  const v = c.verdict;
  const head = v.playable
    ? `<p class="ai-ok">${icon('check')} Spielbar!${v.allGifts ? ' Alle Geschenke sind erreichbar.' : ''}</p>`
    : `<p class="ai-bad">${icon('warn')} Noch nicht spielbar</p>`;
  const list = (items: string[], cls: string): string =>
    items.length ? `<ul class="ai-list ${cls}">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  const ink = c.inkRaised ? '<p class="ai-note">Die Tinte war zu knapp, das Spiel hat sie erhöht.</p>' : '';
  const auto = v.playable && v.areas.some((a) => a.auto) ? '<p class="ai-note">Das Spiel hat für jede Fahrt selbst eine Piste gefunden.</p>' : '';
  return head + ink + auto + list(v.problems, 'bad') + list(v.warnings, 'warn');
}

const busyHtml = '<p class="ai-busy">Prüfe … der Schlitten fährt probe, die Elfe hüpft alle Wege ab.</p>';

/** Still kopieren (ohne Rückfall): klappt nach einer Wartezeit nicht in jedem Browser. */
async function tryCopy(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Adresse des Spiels für den Link, den der Chatbot schicken soll. */
const gameBase = (): string => `${window.location.origin}${window.location.pathname}`;

/** Muss der Chatbot noch etwas tun? Dann lohnt die Rückmeldung. */
const needsFeedback = (c: Checked, issues: string[]): boolean =>
  !c.verdict.playable || c.verdict.warnings.length > 0 || issues.length > 0;

export interface AiDialogOptions {
  /** Antwort vorbelegen und gleich prüfen (Link #ki=… aus dem Chatbot). */
  reply?: string;
}

/**
 * „Mit KI bauen“: Anleitung kopieren → im Chatbot einfügen → Antwort hier einfügen → prüfen.
 * Ist das Level in Ordnung (oder will man es trotzdem), kommt es über onOpen in den Editor.
 */
export function openAiDialog(root: HTMLElement, onOpen: (c: Checked) => void, opts: AiDialogOptions = {}): void {
  document.querySelector('.dialog.ai')?.remove();
  const draft = loadDraft();
  if (opts.reply !== undefined) {
    draft.reply = opts.reply;
    saveDraft(draft);
  }
  const canRead = typeof navigator.clipboard?.readText === 'function';
  const w = document.createElement('div');
  w.className = 'dialog ai';
  w.innerHTML = `<div class="panel dialog-panel ai-panel">
    <h2>Mit KI bauen</h2>
    <p class="ai-step"><b>1.</b> Was für ein Level wünschst du dir?</p>
    <input class="ai-idea" type="text" maxlength="200" placeholder="z. B. viele Federn und ein Eisdach, eher leicht" value="${esc(draft.idea)}">
    <div class="row ai-row"><button class="primary" data-a="prompt">${icon('copy')} Anleitung kopieren</button></div>
    <p class="ai-hint">Dann in ChatGPT, Claude, Gemini o. ä. einfügen und abschicken. Schickt der Chatbot einen Link, einfach antippen.</p>
    <textarea class="ai-copy hidden" rows="4" readonly></textarea>
    <p class="ai-step"><b>2.</b> Antwort des Chatbots kopieren und hier einfügen:</p>
    <div class="row ai-row">
      ${canRead ? `<button class="primary" data-a="paste">${icon('check')} Einfügen und prüfen</button>` : ''}
      <button data-a="clear">${icon('trash')} Leeren</button>
    </div>
    <textarea class="ai-reply" rows="5" placeholder="Die ganze Antwort einfügen – das Spiel sucht das Level darin und prüft sofort.">${esc(draft.reply)}</textarea>
    <div class="row ai-row"><button data-a="check">${icon('check')} Prüfen</button></div>
    <div class="ai-result"></div>
    <p class="ai-hint ai-status"></p>
    <div class="row ai-row ai-after hidden">
      <button data-a="feedback">${icon('copy')} Rückmeldung kopieren</button>
      <button class="primary" data-a="open">${icon('pencil')} Im Editor öffnen</button>
    </div>
    <div class="row"><button data-a="close">Schließen</button></div>
  </div>`;
  root.appendChild(w);
  const $ = <T extends HTMLElement>(s: string): T => w.querySelector<T>(s)!;
  const idea = $<HTMLInputElement>('.ai-idea');
  const reply = $<HTMLTextAreaElement>('.ai-reply');
  const result = $<HTMLElement>('.ai-result');
  const copyEl = $<HTMLTextAreaElement>('.ai-copy');
  const after = $<HTMLElement>('.ai-after');
  const openBtn = $<HTMLButtonElement>('[data-a="open"]');
  const feedbackBtn = $<HTMLButtonElement>('[data-a="feedback"]');
  const hint = $<HTMLElement>('.ai-hint');
  const status = $<HTMLElement>('.ai-status');
  let checked: Checked | null = null;
  let feedback = '';
  let busy = false;

  const save = (): void => saveDraft({ idea: idea.value, reply: reply.value });
  for (const el of [idea, reply]) {
    el.addEventListener('keydown', (e) => e.stopPropagation());
    el.addEventListener('input', save);
  }

  const reset = (): void => {
    copyEl.classList.add('hidden');
    after.classList.add('hidden');
    result.innerHTML = '';
    status.textContent = '';
    checked = null;
  };

  /** Rückmeldung gleich mitkopieren, wenn der Chatbot noch etwas tun muss. */
  const offerFeedback = async (needed: boolean): Promise<void> => {
    feedbackBtn.classList.toggle('primary', needed);
    if (!needed) return;
    status.textContent = (await tryCopy(feedback))
      ? 'Rückmeldung ist schon kopiert – im Chatbot einfügen, die neue Antwort dann wieder hier.'
      : 'Rückmeldung kopieren und im Chatbot einfügen.';
  };

  const check = (): void => {
    if (busy) return;
    reset();
    let level: LevelData;
    try {
      level = parseAiReply(reply.value);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.innerHTML = `<p class="ai-bad">${icon('warn')} ${esc(msg)}</p>`;
      feedback = feedbackText('(ohne Namen)', { error: msg });
      after.classList.remove('hidden');
      openBtn.classList.add('hidden');
      void offerFeedback(reply.value.trim() !== '');
      return;
    }
    busy = true;
    result.innerHTML = busyHtml;
    result.scrollIntoView({ block: 'nearest' });
    // Erst die Meldung zeichnen lassen, dann rechnen
    window.setTimeout(() => {
      void checkLevel(level, null).then((c) => {
        checked = c;
        const issues = levelIssues(c.level).map((i) => i.text);
        feedback = feedbackText(c.level.name, { verdict: c.verdict, issues });
        result.innerHTML = verdictHtml(c);
        after.classList.remove('hidden');
        openBtn.classList.remove('hidden');
        openBtn.innerHTML = `${icon('pencil')} ${c.verdict.playable ? 'Im Editor öffnen' : 'Trotzdem öffnen'}`;
        openBtn.classList.toggle('primary', c.verdict.playable);
        after.scrollIntoView({ block: 'nearest' });
        void offerFeedback(needsFeedback(c, issues));
      }).catch((e: unknown) => {
        result.innerHTML = `<p class="ai-bad">${icon('warn')} Prüfung fehlgeschlagen: ${esc(e instanceof Error ? e.message : String(e))}</p>`;
      }).finally(() => { busy = false; });
    }, 30);
  };

  /** Neue Antwort ersetzt immer die alte – nichts mehr markieren und löschen. */
  const replaceReply = (text: string): void => {
    reply.value = text;
    save();
    check();
  };

  $('[data-a="prompt"]').addEventListener('click', () => {
    void copy(aiInstructions(idea.value, gameBase()), copyEl).then((ok) => {
      hint.textContent = ok ? 'Kopiert! Jetzt im Chatbot einfügen und abschicken.' : 'Markiert – jetzt kopieren und im Chatbot einfügen.';
    });
  });
  w.querySelector('[data-a="paste"]')?.addEventListener('click', () => {
    void navigator.clipboard.readText().then((text) => {
      if (text.trim()) replaceReply(text);
      else { status.textContent = 'Die Zwischenablage ist leer – erst die Antwort im Chatbot kopieren.'; }
    }).catch(() => {
      status.textContent = 'Einfügen nicht erlaubt – bitte selbst ins Feld einfügen.';
      reply.focus();
    });
  });
  // Einfügen ins Feld (Strg+V, lange drücken): ersetzt den alten Text und prüft gleich
  reply.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text.includes('{')) return;
    e.preventDefault();
    replaceReply(text);
  });
  $('[data-a="clear"]').addEventListener('click', () => {
    reply.value = '';
    save();
    reset();
    reply.focus();
  });
  $('[data-a="check"]').addEventListener('click', check);

  feedbackBtn.addEventListener('click', () => {
    void copy(feedback, copyEl).then((ok) => {
      status.textContent = ok ? 'Rückmeldung kopiert! Im Chatbot einfügen, die neue Antwort dann wieder hier.' : 'Markiert – kopieren und im Chatbot einfügen.';
      status.scrollIntoView({ block: 'nearest' });
    });
  });
  openBtn.addEventListener('click', () => {
    if (!checked) return;
    w.remove();
    onOpen(checked);
  });
  $('[data-a="close"]').addEventListener('click', () => w.remove());
  if (opts.reply !== undefined) check();
}

/** „Spielbarkeit prüfen“ für das Level im Editor: Ergebnis zeigen, Rückmeldung zum Kopieren. */
export function showCheckResult(root: HTMLElement, c: Checked, issues: string[]): void {
  document.querySelector('.dialog.ai')?.remove();
  const w = document.createElement('div');
  w.className = 'dialog ai';
  w.innerHTML = `<div class="panel dialog-panel ai-panel">
    <h2>Spielbarkeit</h2>
    <div class="ai-result">${verdictHtml(c)}</div>
    <p class="ai-hint"></p>
    <textarea class="ai-copy hidden" rows="4" readonly></textarea>
    <div class="row ai-row">
      <button data-a="feedback">${icon('copy')} Rückmeldung für KI kopieren</button>
      <button class="primary" data-a="close">OK</button>
    </div>
  </div>`;
  root.appendChild(w);
  const feedback = feedbackText(c.level.name, { verdict: c.verdict, issues });
  const hint = w.querySelector<HTMLElement>('.ai-hint')!;
  w.querySelector('[data-a="feedback"]')!.addEventListener('click', () => {
    void copy(feedback, w.querySelector<HTMLTextAreaElement>('.ai-copy')!).then((ok) => { hint.textContent = ok ? 'Kopiert!' : 'Markiert – jetzt kopieren.'; });
  });
  w.querySelector('[data-a="close"]')!.addEventListener('click', () => w.remove());
  w.addEventListener('click', (e) => { if (e.target === w) w.remove(); });
}

/** Kurze Warte-Anzeige während der Prüfung im Editor. */
export function showBusy(root: HTMLElement): () => void {
  const w = document.createElement('div');
  w.className = 'dialog ai';
  w.innerHTML = `<div class="panel dialog-panel ai-panel">${busyHtml}</div>`;
  root.appendChild(w);
  return () => w.remove();
}
