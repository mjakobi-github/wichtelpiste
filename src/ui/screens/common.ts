/** Hängt Klick-Handler an [data-a]-Knöpfe im Element. */
export function bindActions(el: HTMLElement, handlers: Record<string, () => void>): void {
  el.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => {
    const h = handlers[b.dataset.a ?? ''];
    if (h) b.addEventListener('click', h);
  });
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}
