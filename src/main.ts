import './styles.css';
import { Game } from './game/game';

function boot(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#game Canvas nicht gefunden');
  const game = new Game(canvas);
  game.start();
  // Dev-Hilfe: per Konsole zugreifbar
  (window as unknown as { __game?: Game }).__game = game;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
