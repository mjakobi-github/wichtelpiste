# Technik – Wichtelpiste v1

Stack: **TypeScript (strict) · Vite 6 · PixiJS 8 · pixi-filters (Bloom) · Vitest ·
vite-plugin-pwa**. Keine Server, keine Assets außer Inline-SVG und einer
selbst gehosteten Schrift (Fredoka).

## 1. Architektur

```
src/
  sim/      Spielregeln ohne DOM: Simulation, Spieler, Schlitten, Tinte, Elemente, Wertung
  engine/   Takt (fester Schritt 60 Hz, höchstens 6 Schritte je Bild), Eingabe, Gesten, WebAudio-Synth
  view/     Darstellung mit Pixi: Kamera, Hintergrund, Welt, Figuren, Effekte, Qualität
  ui/       HTML/CSS über dem Canvas: HUD, Werkzeugleiste, Bildschirme, Hinweise, Icons
  app/      Verdrahtung (App), Bildschirm-Fluss, Fortschritt (localStorage)
  levels/   Level-JSON (Format v1), Schema-Prüfung, Lösungen + Lösbarkeitstest
  assets/   SVG-Teile (Elfe, Schlitten, Objekte)
```

**Grundsatz:** `sim/` kennt weder DOM noch Pixi. Eingaben kommen als
`FootInput` je Tick und als `Command`s (zeichnen, LOS, …). Heraus kommen
`SimEvent`s je Tick (Sprung, Geschenk, Crash, Sieg …), auf die Darstellung,
HUD und Audio reagieren. Dadurch lassen sich ganze Level-Durchläufe in Vitest
simulieren.

### Ablauf eines Bildes

`Loop` ruft `App.update(dt)` mit festem Schritt auf
(`Simulation.step` → Ereignisse → Toasts/Sounds) und danach `App.render(alpha)`
(`GameView.render` interpoliert zwischen Schritten, HUD, Hinweise).

## 2. Simulation (`src/sim`)

| Datei | Inhalt |
|---|---|
| `simulation.ts` | Zustand eines Levels: Modus Fuß/Schlitten, Phase plan/ride, Abschnitte, Geschenke, Checkpoints, Crash-Regeln (fall, hazard, stuck, stall, missed), Lieferung, Wertung |
| `player.ts` | Plattformer: Beschleunigung, Coyote-Time, Sprungpuffer, Sprungabbruch, Schwebe am Scheitel, Eis (träge, Schwung bleibt beim Absprung) |
| `sled.ts` | Zwei-Punkt-Körper mit positionsbasierter Physik, Unterschritte gegen Tunneln, Speedtinte schiebt in Zeichenrichtung |
| `ink.ts` | Striche je Abschnitt, Budget (Piste/Speedtinte), Vereinfachung, Radieren, Verbotszonen |
| `elements.ts` | Kollisionsformen der Elemente, Beweger-Bahnen (Pendel, Kreis, Linie), Feder-Impuls |
| `scoring.ts` | Sterne und Level-Fingerabdruck (Hash ohne Hinweise) für Rekorde |

Regeln, die man kennen sollte:

- Abschnitt *i* muss in `dismounts[i]` landen. Ohne Eintrag ist der
  Schornstein das Ziel. Wer mehr als 150 px über die Landezone hinausfährt,
  verfehlt sie (`missed`).
- Crash während der Fahrt: Der Schlitten startet neu an der Station. Linien und
  Tinte bleiben, die Geschenke dieser Fahrt erscheinen wieder.
- Bewegte Gefahren laufen auf einer eigenen Uhr, die bei LOS auf 0 springt.
  Timing ist dadurch planbar und deterministisch.
- Der Schornstein nimmt erst ab einem Geschenk an.

## 3. Levelformat v1 (`src/levels/*.json`)

Typen in `src/sim/types.ts`, Prüfung in `src/levels/schema.ts` (mit
verständlichen Fehlermeldungen). Koordinaten sind Weltpixel, y zeigt nach unten.

| Feld | Bedeutung |
|---|---|
| `worldW`, `worldH`, `spawn` | Weltgröße, Startpunkt |
| `platforms[]` | Rechtecke; `ice: true` = rutschig. Ab 50 px Höhe als Haus gezeichnet, sonst als Balken |
| `stations[]`, `areas[]` | Je Station ein Abschnitt mit `{ ink, boost }` (Zahl oder `"unlimited"`) |
| `dismounts[]` | Landezone je Abschnitt (höchstens so viele wie Abschnitte) |
| `gifts[]`, `checkpoints[]`, `chimney` | Punkte (Checkpoint/Schornstein: Basis am Boden) |
| `icicles[]`, `candies[]` | Harmlose, feste Hindernisse `{ x, y, h }` |
| `hazards[]` | `{ kind: 'icicle-hanging' \| 'tinsel', rect }`, tödlich |
| `movers[]` | `{ kind: 'bell' \| 'crow', radius, path }`, Bahn `pendulum`/`circle`/`line` |
| `springs[]` | `{ pos, angle (Grad, 0 = hoch), power }` |
| `noDraw[]` | Zeichenverbot-Zonen |
| `theme` | `{ seed, auroraHue }`: Landschaft und Polarlicht-Farbe |
| `hints[]` | `{ at, text, icon }`: Einführungs-Hinweise (move, jump, station, draw, launch, chimney) |

Levels werden über `import.meta.glob` geladen und nach Dateinamen sortiert.

### Lösbarkeit

Zu jedem Level gehört `src/levels/solutions/<id>.json`
(`{ areas: [{ strokes: [{ boost, pts: [[x, y], …] }] }] }`).
`solvable.test.ts` steigt mit `boardForTest` an jeder Station ein, zeichnet
die Lösung, fährt los und verlangt: Ankunft in der Landezone (bzw. Sieg am
Schornstein), Budget eingehalten, keine Verbotszone. Der Test simuliert mit
demselben Takt wie das Spiel (`Loop.STEP`). **Jedes neue Level braucht eine
Lösungsdatei**, sonst schlägt der Test fehl und GitHub Pages wird nicht aktualisiert. Lösungen lassen sich im
Spiel mit `?debug` zeichnen und mit `copy(__exportStrokes())` exportieren.

## 4. Darstellung (`src/view`)

Ebenen von hinten nach vorn:

```
Hintergrund (Backdrop, Parallaxe in virtuellen Einheiten, Höhe 540)
  Himmel · Sterne + Sternschnuppe · Polarlicht · Mond · 2 Bergketten · Wald mit Häusern
Welt (Kamera)            Dächer/Häuser, Objekte, Gefahren
Leuchtebene (Kamera)     Fensterschein, Lichterketten, Piste, Glanz, Partikel  ← nur hier Bloom
Figuren (Kamera)         Schlitten, Elfe, ?debug-Rahmen
Vordergrund-Schnee, Vignette, Geschenk-Flug zum HUD
```

- **SVG-Teile** werden einmal mit `GraphicsContext().svg()` geparst und geteilt
  (`actors/svg.ts`). Elfe und Schlitten bestehen aus einzelnen Teilen und sind
  animiert (Laufen, Mütze, Stauchen, Neigen).
- **Prozedurales:** Berge, Wald, Häuser, Fenster und Lichterketten entstehen aus
  dem Level-Seed. Texturen werden auf Canvas vorgerendert und in `TilingSprite`s
  verwendet.
- **Partikel:** ein Pool von 700 in einem `ParticleContainer` (Funken,
  Schneestaub, Funkenregen, Konfetti).
- **Kamera:** über den Mittelpunkt, weiches Folgen, Zoom 1 zu Fuß, 0,55 bei
  der Fahrt, beim Planen 0,35–2,5 frei wählbar. Erschütterung (`fx/shake.ts`)
  bei Crash und Feder.
- **Qualität:** `FpsMonitor` misst in 3-s-Fenstern und stuft unter 50 fps
  ab (high → medium → low: Auflösung, Bloom, Partikelmenge), nie wieder hoch.
  `?q=` erzwingt eine Stufe.

## 5. Oberfläche (`src/ui`, `src/app`)

- HTML/CSS über dem Canvas, dunkles Glas, Schrift Fredoka, eigene Inline-SVG-Icons
  (`ui/icons.ts`). Touch-Ziele ≥ 48 px, Abstände mit `safe-area-inset`.
- Bildschirm-Fluss als reine Funktion `nextScreen(screen, action)` in
  `app/flow.ts`: title → levels → play ⇄ pause → won.
- Titel und Levelauswahl zeigen nur die Kulisse (`GameView.showScenery`).
- Hochformat auf Touch-Geräten: Hinweis „Bitte Handy drehen“, das Spiel pausiert.
- Hinweise: `activeHint()` wählt nach Ort und Zustand (zeichnen erst, wenn noch
  nichts gezeichnet ist; LOS erst mit Linie; während der Fahrt nie).

## 6. Audio (`src/engine/audio.ts`)

WebAudio-Synth ohne Dateien. Glöckchen entstehen aus unharmonischen
Sinus-Teiltönen. Alles läuft über einen Master-Gain, so wirkt Stummschalten
sofort. Die Einstellung liegt in `localStorage['schlittenfahrer.muted']`.
Ist die Seite unsichtbar, wird der AudioContext angehalten.

## 7. Build, PWA, Deployment

- `npm run build` → `dist/`: PWA über `vite-plugin-pwa` (`autoUpdate`,
  `clientsClaim`, Workbox legt alles vorab in den Cache, damit es nach dem
  ersten Besuch offline läuft). Icons erzeugt `@vite-pwa/assets-generator` aus
  `public/icon.svg` (`pwa-assets.config.ts`). Größe < 1 MB.
- `npm run build:file` → `dist-file/index.html`: alles in einer Datei, ohne PWA,
  startet per `file://`.
- `.github/workflows/deploy.yml`: Push auf `main` → `npm ci`, `npm test`,
  `npm run build` → GitHub Pages.

## 8. Tests

`npm test` (Vitest, jsdom). Abgedeckt sind Geometrie, Spieler, Schlitten,
Tinte, Elemente, Simulation (Ereignisse, Crash-Regeln, Ersatzplanung),
Wertung, Fortschritt, Takt, Gesten, Qualitätsstufen, Parallaxe, Erschütterung,
Bildschirm-Fluss, Hinweise, Level-Schema und die Lösbarkeit aller Levels.
