/** Vollbild per Fullscreen-API (Android/Desktop/iPad). iPhone kann das nicht – dort hilft „Zum Home-Bildschirm“. */
type FsDoc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

export function fullscreenSupported(): boolean {
  const d = document as FsDoc;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

export async function toggleFullscreen(): Promise<void> {
  const d = document as FsDoc;
  try {
    if (isFullscreen()) {
      await (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.());
      return;
    }
    const el = document.documentElement as FsEl;
    await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.());
    // Querformat festhalten, wo erlaubt (Android im Vollbild)
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o?.lock?.('landscape').catch(() => undefined);
  } catch {
    /* abgelehnt oder nicht unterstützt */
  }
}
