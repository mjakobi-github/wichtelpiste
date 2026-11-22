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
  editor/   Level-Editor (per import() nachgeladen): Dokument, Griffe, Prüfungen, UI
  share/    Teilen: Level-Codec für Links, QR-Encoder, Teilen-Dialog
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
- Bewegte Gefahren laufen auf einer eigenen Uhr. Sie springt beim Einsteigen,
  beim Neustart einer Fahrt und bei jedem Respawn auf 0, läuft bei LOS aber
  weiter. Man passt also den richtigen Moment für LOS ab.
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
Editor beim Probespielen aufzeichnen (siehe §9) oder im Spiel mit `?debug`
zeichnen und mit `copy(__exportStrokes())` exportieren. Die Prüfung selbst ist
`checkSolution()` in `levels/solutionCheck.ts`; Test und Editor nutzen sie
gemeinsam.

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
- Der Editor ist ein eigener Chunk (`import()` aus `app.ts`); das Spiel-Bundle
  wächst dadurch nur um den Einstieg.
- `npm run build:file` → `dist-file/index.html`: alles in einer Datei, ohne PWA,
  startet per `file://`.
- `.github/workflows/deploy.yml`: Push auf `main` → `npm ci`, `npm test`,
  `npm run build` → GitHub Pages.

## 8. Tests

`npm test` (Vitest, jsdom). Abgedeckt sind Geometrie, Spieler, Schlitten,
Tinte, Elemente, Simulation (Ereignisse, Crash-Regeln, Ersatzplanung),
Wertung, Fortschritt, Takt, Gesten, Qualitätsstufen, Parallaxe, Erschütterung,
Bildschirm-Fluss, Hinweise, Level-Schema, die Lösbarkeit aller Levels und die
reine Logik des Editors (`src/editor/*.test.ts`).

## 9. Editor (`src/editor`)

| Datei | Inhalt |
|---|---|
| `doc.ts` | Elemente adressieren (`ElementRef`), hinzufügen, verschieben, löschen, duplizieren, Stationen umnummerieren (Station *i* ↔ `areas[i]` ↔ `dismounts[i]`) – alles rein, Eingabe bleibt unverändert |
| `history.ts` | Rückgängig/Wiederholen über Level-Stände (100 Schritte) |
| `handles.ts` | Umrisse, Griffe (Rechteck, Pendel, Kreis, Linie, Feder, Höhe), Trefferprüfung (Griffe 22 Bildschirm-px), Griff-Ziehen mit Raster |
| `pointer.ts` | Zeiger-Zustandsautomat → Editor-Aktionen; ein Ziehen = ein Verlaufsschritt; zwei Finger = Zoom/Verschieben |
| `fields.ts` | Eigenschaften- und Profi-Felder (Anzeige ↔ Levelwerte, z. B. Grad ↔ rad) |
| `checks.ts` | Prüfliste (Format-Fehler aus `validateLevel`, Warnungen) und Tinten-Vorschlag |
| `recorder.ts` | Lösung aus Probefahrten aufzeichnen (bei `arrive`/`win` des gefahrenen Abschnitts) |
| `draft.ts` | Entwurf in `localStorage['wichtelpiste.editor.draft.v1']` |
| `exchange.ts` | Export/Import (`{ format: 'wichtelpiste-level', level, solution }` oder nackte Level-Datei) |
| `savePlan.ts` | Prüft eine Speicher-Anfrage (Schema, ID, Lösbarkeit, Dateiname) und plant die Schreibvorgänge |
| `editor.ts`, `overlay.ts`, `panels.ts` | Steuerung, Pixi-Editor-Ebene, HTML-Leisten |

- **Darstellung:** `GameView.editMode` (freie Kamera, Bahnen sichtbar),
  `showLevel()` baut die Welt nach Änderungen neu (Kulisse nur bei neuem
  Theme), `renderStill()` zeichnet eine ungestartete `Simulation`.
- **Speichern:** Vite-Plugin in `vite.config.ts` (nur `serve`):
  `POST /__editor/save` → `planSave()` → schreibt nur innerhalb von
  `src/levels/`. Vite lädt danach neu; ein `sessionStorage`-Merker öffnet den
  Editor wieder.
- **Probespielen:** `App.startTest()` spielt das Level aus dem Speicher, ohne
  Fortschritt zu schreiben; Pause und Sieg führen zurück in den Editor.

## 10. Bauen und Teilen

### Speicher (`app/library.ts`, alles Best-Effort mit try/catch)

| Schlüssel | Inhalt |
|---|---|
| `wichtelpiste.mylevels.v1` | Eigene Levels `{ uid, level, solution, updatedAt, file?, camera? }` |
| `wichtelpiste.gifts.v1` | Geschenkte Levels `{ key = levelHash, level, from, challengeInk, receivedAt }` |
| `wichtelpiste.editor.prefs.v1` | Einfach/Profi, Schön/Skizze, Sprungweite, Name des Absenders |
| `schlittenfahrer.progress.v1` | Fortschritt; Menü-Levels unter `level.id`, eigene unter `mine:<uid>`, geschenkte unter `gift:<key>` |

Der alte Einzel-Entwurf (`wichtelpiste.editor.draft.v1`) wird einmalig nach
„Meine Levels“ übernommen.

### Link-Format (`share/codec.ts`)

`<Seite>#l=<code>`. `code[0]` = Format: `1` = v1 deflate-raw
(`CompressionStream`), `0` = v1 unkomprimiert (Rückfall); `2`–`9` = neuere
Version → Hinweis „Seite neu laden“. Danach base64url eines kompakten JSON
mit Kurzschlüsseln (`n` Name, `p` Plattformen `[x,y,w,h,eis]`, `mv` Beweger
…, leere Listen fehlen), dazu `f` Absender und `r` Rekord. Die Lösung wird nie
mitgeschickt. Grenze `SHARE_MAX_CODE = 1500` Zeichen (QR bleibt scanbar);
die 8 Menü-Levels liegen deutlich darunter. Empfang: `app/receive.ts` beim
Start und bei `hashchange`, danach wird der Hash entfernt.

### QR (`share/qr.ts`)

Eigener Encoder (Byte-Modus, Fehlerkorrektur M, Versionen 1–40, 8 Masken mit
Strafpunkten), Ausgabe als SVG. Tests lesen jeden Code mit einem eigenen
Leser zurück (Formatinfo, Reed-Solomon-Syndrome, Daten).

### Editor sparsam

- **Rendern auf Anforderung:** Im Editor ist der Pixi-Ticker angehalten
  (`GameView.setManualRender`); `RenderGate` lässt nur nach Änderungen
  (Level, Auswahl, Kamera, Größe) ein Bild plus ein Nachlauf-Bild zu.
- **Ziehen:** Vorschau nur auf der Editor-Ebene, Welt-Neuaufbau erst beim
  Loslassen; Häuser (Canvas-Texturen) werden wiederverwendet, wenn Plattformen,
  Seed und Höhe gleich sind.
- **Skizze:** Kulisse, Häuser, Objekte und Bloom werden gar nicht gebaut; die
  Editor-Ebene zeichnet einfache Flächen.
- Messung (Headless-Chrome mit Software-GL, Level 08, 3 × 8 Ziehbewegungen):
  vorher 1,78 s Rechenzeit (~74 ms je Bewegung), nachher 0,80 s (~33 ms, reines
  Zeichnen); Leerlauf 5 s: vorher jedes Bild, nachher 0 Bilder.

### Mit KI bauen, Spielbarkeit (`levels/verify.ts`, `editor/ai*.ts`)

| Datei | Inhalt |
|---|---|
| `levels/autoSolve.ts` | Löser je Abschnitt: erzeugt Kandidaten-Pisten (Bézierkurven Station → Landezone mit verschiedenem Durchhang, verkürzt als Schanze, mit/ohne Speedtinte; über eine Feder; Schanze + Landepiste über ein Zeichenverbot; durch Geschenke auf der Strecke), billigste zuerst, und fährt sie mit `runArea` ab (≤ 700 Fahrten). Löst alle Menü-Levels ohne ihre Lösungsdatei im Budget. |
| `levels/footReach.ts` | Wegsuche zu Fuß mit der echten `Simulation`: von jedem Standort ~30 Versuche (laufen, springen mit/ohne Anlauf, kurz/lang, mit/ohne Lenken), Standorte auf 24 × 12 px gerastert; Stationen führen über die Fahrt zur Landezone. Rückwärts: von wo kommt man noch zum Schornstein → welche Geschenke lassen sich einsammeln *und* abliefern. Bewegte Gefahren zählen nicht (man kann warten). |
| `levels/verify.ts` | `verifyLevel()`: vorhandene Lösung behalten, sonst Löser, sonst Löser ohne Budget (→ „Tinte reicht nicht“ + Vorschlag 1,3 ×); dann Wegsuche. Meldungen mit Koordinaten, damit ein Chatbot sie umsetzen kann. |
| `editor/ai.ts` | Anleitung für den Chatbot (Format, Maße, Sprungwerte aus `jumpStats`, Beispiel-Level 03), JSON aus der Antwort holen, Kleinigkeiten ergänzen, Rückmeldung als Text |
| `editor/aiDialog.ts` | Dialog „Mit KI bauen“ und „Spielbarkeit prüfen“; Idee/Antwort in `localStorage['wichtelpiste.ai.v1']` (am Handy lädt die Seite beim App-Wechsel oft neu) |

`runArea` gibt der Elfe bei Abschnitten, die zum Schornstein fahren, ein
Platzhalter-Geschenk mit: Der Schornstein nimmt nur mit Geschenk an, das hat
man in Wirklichkeit zu Fuß gesammelt.

### Sprungbögen (`editor/jumpReach.ts`)

Werden mit der echten `Player`-Physik vorberechnet (voller Anlauf, Sprung
gehalten; auf Eis mit Eis-Schwung) und für Boden/Start/Landezone gezeichnet.

### Handy-Layout

`layoutFor(w, h)`: Handy bei Höhe < 500 px oder Breite < 1000 px. Dann
Bausteine unten wischbar, Eigenschaften als Blatt, Selteneres im ⋯-Menü.
