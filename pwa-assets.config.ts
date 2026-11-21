import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/** Erzeugt beim Build Favicon, Apple-Touch-Icon und PWA-Icons (192/512/maskable) aus public/icon.svg. */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#070b22' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#070b22' } },
  },
  images: ['public/icon.svg'],
});
