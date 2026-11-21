import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Zwei Build-Varianten aus derselben Codebase:
 *  - `npm run build`       -> dist/       (Ordner, fuer GitHub Pages / beliebigen Webspace)
 *  - `npm run build:file`  -> dist-file/  (alles in EINER HTML-Datei, zum Versenden)
 */
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'singlefile' ? [viteSingleFile()] : [],
  build: mode === 'singlefile'
    ? { outDir: 'dist-file', emptyOutDir: true }
    : { outDir: 'dist', emptyOutDir: true },
}));
