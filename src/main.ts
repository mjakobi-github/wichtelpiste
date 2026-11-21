import './ui/ui.css';
import { App } from './app/app';

function boot(): void {
  const stage = document.getElementById('stage');
  const ui = document.getElementById('ui');
  if (!stage || !ui) throw new Error('#stage/#ui fehlen');
  const app = new App(stage, ui);
  void app.start();
  (window as unknown as { __app?: App }).__app = app;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
