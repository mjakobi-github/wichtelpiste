import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Zwei Build-Varianten aus derselben Codebase:
 *  - `npm run build`       -> dist/       (Ordner, für GitHub Pages / beliebigen Webspace; installierbare PWA, offline)
 *  - `npm run build:file`  -> dist-file/  (alles in EINER HTML-Datei, zum Versenden; ohne PWA)
 * base './' – der Repo-Name (= URL-Pfad) ist damit egal.
 */
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'singlefile'
    ? [viteSingleFile()]
    : [VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'Wichtelpiste',
        short_name: 'Wichtelpiste',
        description: 'Zeichne Pisten, sammle Geschenke, liefere sie durch den Schornstein.',
        lang: 'de',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#070b22',
        theme_color: '#070b22',
        start_url: './',
        scope: './',
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'], clientsClaim: true, skipWaiting: true },
    })],
  build: mode === 'singlefile'
    ? { outDir: 'dist-file', emptyOutDir: true }
    : { outDir: 'dist', emptyOutDir: true },
}));
