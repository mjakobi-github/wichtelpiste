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

/**
 * „Mit KI bauen“: Anleitung kopieren → im Chatbot einfügen → Antwort hier einfügen → prüfen.
 * Ist das Level in Ordnung (oder will man es trotzdem), kommt es über onOpen in den Editor.
 */
export function openAiDialog(root: HTMLElement, onOpen: (c: Checked) => void): void {
  document.querySelector('.dialog.ai')?.remove();
  const draft = loadDraft();
  const w = document.createElement('div');
  w.className = 'dialog ai';
  w.innerHTML = `<div class="panel dialog-panel ai-panel">
    <h2>Mit KI bauen</h2>
    <p class="ai-step"><b>1.</b> Was für ein Level wünschst du dir?</p>
    <input class="ai-idea" type="text" maxlength="200" placeholder="z. B. viele Federn und ein Eisdach, eher leicht" value="${esc(draft.idea)}">
    <div class="row ai-row"><button class="primary" data-a="prompt">${icon('copy')} Anleitung kopieren</button></div>
    <p class="ai-hint">Dann in ChatGPT, Claude, Gemini o. ä. einfügen und abschicken.</p>
    <textarea class="ai-copy hidden" rows="4" readonly></textarea>
    <p class="ai-step"><b>2.</b> Antwort des Chatbots hier einfügen:</p>
    <textarea class="ai-reply" rows="5" placeholder="Die ganze Antwort einfügen – das Spiel sucht das Level darin.">${esc(draft.reply)}</textarea>
    <div class="row ai-row"><button class="primary" data-a="check">${icon('check')} Prüfen</button></div>
    <div class="ai-result"></div>
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
  const hint = $<HTMLElement>('.ai-hint');
  let checked: Checked | null = null;
  let feedback = '';
  let busy = false;

  for (const el of [idea, reply]) {
    el.addEventListener('keydown', (e) => e.stopPropagation());
    el.addEventListener('input', () => saveDraft({ idea: idea.value, reply: reply.value }));
  }

  $('[data-a="prompt"]').addEventListener('click', () => {
    void copy(aiInstructions(idea.value), copyEl).then((ok) => {
      hint.textContent = ok ? 'Kopiert! Jetzt im Chatbot einfügen und abschicken.' : 'Markiert – jetzt kopieren und im Chatbot einfügen.';
    });
  });

  $('[data-a="check"]').addEventListener('click', () => {
    if (busy) return;
    copyEl.classList.add('hidden');
    after.classList.add('hidden');
    checked = null;
    let level: LevelData;
    try {
      level = parseAiReply(reply.value);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.innerHTML = `<p class="ai-bad">${icon('warn')} ${esc(msg)}</p>`;
      feedback = feedbackText('(ohne Namen)', { error: msg });
      after.classList.remove('hidden');
      openBtn.classList.add('hidden');
      return;
    }
    busy = true;
    result.innerHTML = busyHtml;
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
        $<HTMLButtonElement>('[data-a="feedback"]').classList.toggle('primary', !c.verdict.playable);
        openBtn.classList.toggle('primary', c.verdict.playable);
      }).catch((e: unknown) => {
        result.innerHTML = `<p class="ai-bad">${icon('warn')} Prüfung fehlgeschlagen: ${esc(e instanceof Error ? e.message : String(e))}</p>`;
      }).finally(() => { busy = false; });
    }, 30);
  });

  $('[data-a="feedback"]').addEventListener('click', () => {
    void copy(feedback, copyEl).then((ok) => {
      hint.textContent = ok ? 'Rückmeldung kopiert! Im Chatbot einfügen, die neue Antwort dann oben einfügen.' : 'Markiert – kopieren und im Chatbot einfügen.';
      hint.scrollIntoView({ block: 'nearest' });
    });
  });
  openBtn.addEventListener('click', () => {
    if (!checked) return;
    w.remove();
    onOpen(checked);
  });
  $('[data-a="close"]').addEventListener('click', () => w.remove());
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
