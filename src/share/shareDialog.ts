import { encodeShare, SHARE_MAX_CODE, shareUrl, type SharePayload } from './codec';
import { shareText } from './shareText';
import { icon } from '../ui/icons';
import { esc } from '../ui/screens/common';

/**
 * Teilen-Dialog: QR-Code (zum Scannen nebenan), „Teilen“ (Messenger über das Teilen-Menü des Handys)
 * und „Link kopieren“. Der Name des Absenders ist editierbar und wird über onName gemerkt.
 */
export async function openShareDialog(root: HTMLElement, p: SharePayload, onName: (name: string) => void): Promise<void> {
  document.querySelector('.dialog.share')?.remove();
  const w = document.createElement('div');
  w.className = 'dialog share';
  w.innerHTML = `<div class="panel dialog-panel share-panel">
    <h2>„${esc(p.level.name)}“ teilen</h2>
    <label class="share-name"><span>Dein Name</span><input type="text" maxlength="20" placeholder="z. B. Lena" value="${esc(p.from)}"></label>
    <div class="share-body">
      <div class="share-qr" aria-label="QR-Code"></div>
      <div class="share-actions">
        ${typeof navigator.share === 'function' ? `<button class="primary" data-a="share">${icon('shareIcon')} Teilen</button>` : ''}
        <button data-a="copy">${icon('copy')} Link kopieren</button>
        <input class="share-link hidden" type="text" readonly>
        <p class="share-hint">Nebeneinander? Einfach den QR-Code mit der Handy-Kamera scannen.</p>
        <button data-a="close">Fertig</button>
      </div>
    </div>
  </div>`;
  root.appendChild(w);
  const qrEl = w.querySelector<HTMLElement>('.share-qr')!;
  const nameEl = w.querySelector<HTMLInputElement>('.share-name input')!;
  const linkEl = w.querySelector<HTMLInputElement>('.share-link')!;
  let url = '';
  let payload = p;

  const render = async (): Promise<void> => {
    const code = await encodeShare(payload);
    if (code.length > SHARE_MAX_CODE) {
      qrEl.innerHTML = `<p class="share-error">Das Level ist zu groß zum Teilen – nimm ein paar Teile weg.</p>`;
      w.querySelectorAll<HTMLButtonElement>('[data-a="share"], [data-a="copy"]').forEach((b) => { b.disabled = true; });
      return;
    }
    url = shareUrl(code);
    linkEl.value = url;
    try {
      const { encodeQr, qrToSvg } = await import('./qr');
      qrEl.innerHTML = qrToSvg(encodeQr(url));
    } catch {
      qrEl.innerHTML = `<p class="share-error">QR-Code geht nicht – nimm „Link kopieren“.</p>`;
    }
  };
  await render();

  nameEl.addEventListener('keydown', (e) => e.stopPropagation());
  nameEl.addEventListener('change', () => {
    const from = nameEl.value.trim().slice(0, 20);
    onName(from);
    payload = { ...payload, from };
    void render();
  });
  const toast = (msg: string): void => {
    const h = w.querySelector<HTMLElement>('.share-hint')!;
    h.textContent = msg;
  };
  w.querySelector('[data-a="share"]')?.addEventListener('click', () => {
    void navigator.share({ title: 'Wichtelpiste', text: shareText(payload), url }).catch(() => undefined);
  });
  w.querySelector('[data-a="copy"]')!.addEventListener('click', () => {
    const text = `${shareText(payload)} ${url}`;
    const fallback = (): void => {
      linkEl.classList.remove('hidden');
      linkEl.focus();
      linkEl.select();
      toast('Link markiert – jetzt kopieren und verschicken.');
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast('Link kopiert! Jetzt im Messenger einfügen.'), fallback);
    else fallback();
  });
  w.querySelector('[data-a="close"]')!.addEventListener('click', () => w.remove());
  w.addEventListener('click', (e) => { if (e.target === w) w.remove(); });
}
