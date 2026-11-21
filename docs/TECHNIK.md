# Technische Dokumentation – „Schlittenfahrer"

*Stand: 21.11.2026 · Version 0.0.1*

---

## 1. Überblick

| | |
|---|---|
| Stack | **TypeScript 5.7** (strict, `noUnusedLocals`) · **Vite 6** · **Canvas 2D** · kein Framework · keine Laufzeit-Abhängigkeiten |
| Renderer | Canvas 2D, dpr-aware (`resize(dpr)`, capped bei 2), Kamera in Weltkoordinaten |
| Physik | Eigenbau: AABB (Fuß-Modus), Punktmasse + Segment-Kollision (Schlitten) |
| Audio | Prozedural per WebAudio (kein Asset, kein Netzwerk) |
| Persistenz | `localStorage["schlittenfahrer.stars"]` → `number[]` (Sterne je Level) |

Klassischer Aufbau ohne Engine: wenige hundert Zeilen pro Modul, klar getrennt in
`engine/` (plattformunabhängige Infrastruktur), `game/` (Spiellogik & Daten) und
`render/` (Ausgabe).

---

## 2. Modulübersicht

```
src/
├── main.ts                Einstieg: Canvas holen, Game erzeugen, Loop starten
├── styles.css             Canvas, Touch-Buttons, Werkzeugleiste, Overlays, Menü
├── engine/
│   ├── loop.ts            Fixed-Timestep: Physik mit 1/60 s + Accumulator,
│   │                      MAX_DT = 0,1 s (Bremse, falls rAF lange pausierte), Render via rAF
│   ├── input.ts           Tastatur + virtuelle Touch-Buttons → PlayerInput
│   │                      {move, jumpHeld}; Jump-Buffer 0,12 s; onKeyPress-Hook
│   ├── camera.ts          Follow-Cam mit Lookahead + Weltränder-Klemmung
│   ├── drawing.ts         Pointer-Events → WELT-Segmente (erster Zeiger gewinnt,
│   │                      min. 3 px Abstand pro Teilstück), canDraw-Gate
│   └── audio.ts           WebAudio-Synth: gift(streak)/checkpoint/crash/jump/
│                          launch/refuse/win; mount() entriegelt auf erste Geste
├── game/
│   ├── game.ts            Zustandsautomat + sämtliche Spielregeln (siehe §4)
│   ├── types.ts           Datenmodell (siehe §3)
│   ├── levels.ts          LEVELS + platformSegments() (Plattform-Kanten → Segmente)
│   ├── player.ts          Fuß-Physik (AABB), Tuning: gravityUp 1250 / gravityDown
│   │                      2200 / jumpVelocity −720 (≈ 207 px Sprunghöhe)
│   ├── sled.ts            Schlitten-Physik (siehe §5), closestPointOnSegment-Export
│   └── world.ts           stationZone() (Aufstiegs-Rechteck um eine Station)
└── render/
    └── renderer.ts        Sky/Plattformen/Linien/Geschenke/Schornstein/HUD/
                           Minimap/Notice-Toasts + Boost-Linien mit Chevrons
```

---

## 3. Datenmodell (`src/game/types.ts`)

```ts
Vec2 { x, y }                       // Weltpixel
Rect { x, y, w, h }                 // AABB
Platform = Rect
Segment { ax, ay, bx, by, boost?, area? }  // gezeichnete Linie; area = Stations-Index
SledStation { pos }
DismountZone = Rect                 // Automatik-Abstieg
Icicle { x, y, h }                  // Eiszapfen, Spitze hoch, y = Basis
CandyCane { x, y, h }               // Zuckerstange (Haken = obere 24 px)
InkBudget { ink, boost }            // number | 'unlimited', Einheit: Weltpixel Länge
LevelData {
  id, name, worldW, worldH, spawn,
  platforms, stations, dismounts,
  gifts, checkpoints, icicles, candies,
  chimney | null,
  areas: InkBudget[]                // Index = Stations-Index (kein Budget global!)
}
```

**Level-Bibliothek** (`levels.ts`):

| Level | Bereiche (Tinte/🚀) | Besonderheit |
|---|---|---|
| 1 · Erste Schlucht | 1500 / 350 | Tutorial, große Kluft |
| 2 · Wellen-Parcours | 1400/250 + 1000/200 | 2 Stationen, schwebende Stufen |
| 3 · Nachtexpress | 1800/300 + 1300/250 | 2 Fahrten, mehr Hindernisse |

`platformSegments(level)` baut aus jeder Plattform 4 Kantensegmente — der
Schlitten reitet dadurch auf Plattformen wie auf gezeichneten Linien (eine
einzige Kollisionsroutine für beides).

---

## 4. Spielzustand & Regeln (`game.ts`)

### Zustandsautomat

```
State:   menu ⇄ play ⇄ won          (Esc/☰ → Menü, Level-Button → play)
Mode:    foot ⇄ sled                (Aufsitzen an Station / Dis­mount)
SledPhase: plan ⇄ ride              (Physik pausiert in der Planungsphase)
Tool:    draw | boost | eraser | pan
```

### Bereiche (Areas) – der zentrale Fairness-Mechanismus

- Jede Station = ein Bereich mit eigenem `inkByArea[]`/`boostByArea[]`.
- Beim Aufsitzen (`board(areaIdx)`) wird `activeArea` gesetzt.
- **Zeichnen** verbraucht aus dem Pool des aktiven Bereichs (boost-Linien aus
  dem 🚀-Pool), **Radierer/Löschen** erstatten exakt dorthin.
- Invariante pro Pool: `gezeichnete Länge + übrig = Budget`.
- Radierer/Mülleimer wirken **nur auf Segmente des aktiven Bereichs**; Linien
  anderer Bereiche bleiben als fahrbarer Untergrund, sind aber immun.

### Reset- & Checkpoint-Philosophie

| Ereignis | Wirkung |
|---|---|
| `R`, Sturz unter die Welt | nur **Position** → `respawnPos`; Zeichnung, Tinte, Geschenke bleiben |
| Flagg-Checkpoint berührt | `respawnPos` = Flaggen-Position |
| Schlitten-Ankunft (Dismount-Zone oder Auto-Aussteigen) | `respawnPos` = Ankunftsposition + Toast „Angekommen" |
| `❄️`/`🍬`-Berührung | **kein Reset mehr**: solide Hürde (Fuß blockt, Schlitten verliert Schwung) |
| Festkleben (< 30 px/s für 1,2 s) | automatisches Aussteigen (Anti-Softlock) |

### Geschenk-Snapshot & Fahrt-Restart
```
launch():  giftSnapshot = [...giftTaken]
Crash/R während ride:  giftTaken = [...giftSnapshot]
```
→ Geschenke der gescheiterten Fahrt erscheinen wieder und zählen nicht;
  zu Fuß gesammelte bleiben unangetastet. Nur eine **erfolgreiche** Ankunft
  belässt die Beute.

### Sieg

`checkChimneyDelivery` (Zone um Schornstein): ab 1 Geschenk → Sterne wie in
der Spielanleitung; Won-Overlay, `saveStars()` (Bestwert je Level).

---

## 5. Schlitten-Physik (`sled.ts`)

```
SLED_TUNING = {
  radius: 12,                 // Kollisionsradius (komfortabler Kurvenführer)
  gravity: 2000,
  maxSpeed: 2200,             // Basis-Cap
  boostMaxSpeed: 3200,        // 🚀 darf überschießen
  surfaceFriction: 0.9985,    // Tempo-Verlust pro Bodenkontakt-Substep
  restitution: 0,             // kein Abpraller (reserviert für Federn)
  boostAccel: 2600,           // Schub pro Sekunde KONTAKT entlang der Linie
}
```

- **Substeps:** ≤ ~6 Weltpixel pro Subschritt (max. 8); verhindert Tunneling
  auch bei Boost-Tempo.
- **Überschuss-Tempo** über `maxSpeed` klingt sanft ab (× 0,995/Substep) –
  Boost fühlt sich wie ein Kick an, ohne dass der Rest-Level unkontrollierbar wird.
- **Kollision:** nächstliegender Punkt auf Segment, inelastisch (restitution 0),
  Normalkorrektur + leichte Reibung.
- `fell` → Sturz unter `world.h + 240` bzw. ±300 seitlich.

---

## 6. Rendering (`renderer.ts`)

- `baseScale = max(h/560, w/1100)` → gleiche Weltgröße auf Hand & Desktop;
  `scale = baseScale × zoom`; der Zoom wird in `game.ts` exponentiell auf das
  Ziel geglättet (Rate 4/s) und liegt im Schlitten bei 0,5 (Fuß: 1).
- Linien: weiße Piste vs. rote Boost-Linien mit Chevrons (Pfeile zeigen die
  Schubrichtung a → b).
- HUD: Tinte + Speedtinte (Balken blinken unter 20 %), 🎁-Zähler,
  Level-Label inkl. „Bereich i/n", Modus-Hinweiszeile.
- Minimap: Welt-Downsampling mit Plattformen, Geschenke, Checkpoints,
  Eiszapfen, Zuckerstangen (Marker), Schornstein.
- Off-Screen-Zielpfeil Richtung Schornstein bei Ziel ~Distanz.

---

## 7. Eingabe & Werkzeuge

| Quelle | Kanal |
|---|---|
| Tastatur | `ArrowLeft/Right, A/D, Space/W/ArrowUp` (Foot), `Z/B/E/P` (Tools), `Space`/Launch-Button, `R`, `Backspace`, `Esc` |
| Touch | D-Pad + Jump-Button (quasi `Input`-virtuelle Keys), Tool-Leiste, LOS-Button |
| Zeichnen | `DrawingInput` (Pointer-Events → Welt-Segmente; `canDraw()` schließt Foot-Modus/ride-Phase aus) |
| Radieren | eigener Pointer-Handler (Radius 18 Welt-px, refund) |
| Verschieben | eigener Pointer-Handler (nur plan-Phase + Tool pan, Clamp an Weltgrenzen) |

Pan umgeht die Kamera-Follow-Logik: In der Planungsphase wird die Kamera nicht
aktualisiert (der Schlitten steht ja), so ist freies Durchschwenken möglich.

---

## 8. Build & Deployment

```bash
npm run dev          # Vite dev server (HMR), http://localhost:5173
npm run typecheck    # tsc --noEmit, strict
npm run build        # → dist/            (GitHub Pages / beliebiger Webspace)
npm run build:file   # → dist-file/      (vite-plugin-singlefile: 1 HTML, ~47 kB)
```

- **GitHub Pages (geplant, Tag 7):** `dist/`-Inhalt auf `gh-pages`
  pushen; HTTPS-URL ist zugleich PWA-Basis für iOS-Installation.
- **Ein-Datei-Variante:** `dist-file/index.html` per Mail/Messenger
  verschicken – öffnet offline in jedem Desktop-Browser.
- Empfohlenes Deployment-Script: `npm run build && npx gh-pages -d dist`
  (oder GitHub-Action auf push → `main`).

## 9. Tests & Repo-Hygiene

- `npm run typecheck` (strict) als Mindest-Gate vor jedem Commit.
- Manueller Smoke-Test je Feature: beide Modi, alle 3 Level, Absturz-Fall,
  Reset-Invarianten (Tinten-Budget, Geschenke), Menü-Kreislauf.
- *Bekanntes Formatierungs-Risiko beim Generieren langer Codeblöcke:* nach
  dem Schreiben `grep -rnP '[\x{4E00}-\x{9FFF}\x{0400}-\x{04FF}]' src/` laufen
  (fremdsprachige Müll-Tokens in Kommentaren), vor dem Commit bereinigen.

## 10. Bekannte Grenzen / TODO (Stand v0.0.1)

- PWA (Manifest, Service-Worker, Icons) fehlt – Tag 6.
- Kein Level-Editor; Levels sind handgeschriebene `LevelData`-Literale
  (`levels.ts`). JSON-Format wäre Drop-in (Kap. 6 des Konzepts).
- `renderer.ts` kennt teilweise feste Werte (z. B. Schornstein-Zone 44×64),
  die parallel auch in `game.ts` definiert sind — bei Änderungen beide Dateien
  anfassen (bewusst gedupliziert, um Import-Zyklen zu vermeiden).
- Audio wird erst nach erster Nutzer-Geste entriegelt (`audio.mount()` –
  Browser-/Safari-Policy), davor verlieren frühe Effekte etwas Füllung.
