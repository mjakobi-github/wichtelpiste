import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { planSave } from './src/editor/savePlan';

/** Nur im Dev-Server: Der Editor speichert Level + Lösung nach src/levels/ (geprüft durch planSave). */
function levelSave(): Plugin {
  return {
    name: 'wichtelpiste-level-save',
    apply: 'serve',
    configureServer(server) {
      const root = resolve(server.config.root, 'src/levels');
      server.middlewares.use('/__editor/save', (req, res) => {
        const reply = (status: number, body: unknown): void => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') { reply(405, { ok: false, error: 'Nur POST' }); return; }
        let size = 0;
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => {
          size += c.length;
          if (size > 1_000_000) { reply(413, { ok: false, error: 'Zu groß' }); req.destroy(); return; }
          chunks.push(c);
        });
        req.on('end', () => {
          if (res.writableEnded) return;
          let body: unknown;
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reply(400, { ok: false, error: 'Kein JSON' }); return; }
          const plan = planSave(body, readdirSync(root));
          if (!plan.ok) { reply(400, plan); return; }
          const targets = plan.writes.map((w) => ({ abs: resolve(server.config.root, w.path), content: w.content }));
          if (targets.some((t) => !t.abs.startsWith(root + sep))) { reply(400, { ok: false, error: 'Pfad außerhalb von src/levels' }); return; }
          for (const t of targets.reverse()) {
            mkdirSync(dirname(t.abs), { recursive: true });
            writeFileSync(t.abs, t.content);
          }
          reply(200, { ok: true, file: plan.file });
        });
      });
    },
  };
}

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
    : [levelSave(), VitePWA({
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
