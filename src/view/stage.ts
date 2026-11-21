import { Application } from 'pixi.js';

export interface Stage {
  app: Application;
  onResize(cb: (w: number, h: number) => void): void;
}

/** Pixi-Anwendung im Host-Element, Auflösung max. 2× (Akku/Leistung). */
export async function createStage(host: HTMLElement): Promise<Stage> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: '#070b22',
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: 'webgl',
  });
  host.appendChild(app.canvas);
  const listeners: ((w: number, h: number) => void)[] = [];
  const fire = () => listeners.forEach((cb) => cb(app.screen.width, app.screen.height));
  app.renderer.on('resize', fire);
  return {
    app,
    onResize(cb) {
      listeners.push(cb);
      cb(app.screen.width, app.screen.height);
    },
  };
}
