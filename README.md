# Schlittenfahrer

Ein Weihnachtsspiel für die ganze Familie, gemacht fürs Handy (Querformat) und
spielbar auf jedem Rechner. Du bist eine Weihnachtself auf Lieferreise: Sammle
Geschenke und bring sie zum Schornstein. Wo du zu Fuß nicht weiterkommst,
steigst du in den Schlitten. **Steuern kannst du ihn nicht, du zeichnest ihm
die Piste.**

> Konzept: `../brainstorming/konzept-schlittenfahrer.md` ·
> Design-Spec: [`docs/superpowers/specs/2026-11-21-schlittenfahrer-v1-design.md`](docs/superpowers/specs/2026-11-21-schlittenfahrer-v1-design.md) ·
> Technik: [`docs/TECHNIK.md`](docs/TECHNIK.md)

## So spielst du

```
Titel → Levelauswahl → Level
  zu Fuß: laufen, springen, Geschenke sammeln → zur Station
  im Schlitten: Piste zeichnen (in Ruhe, Kamera frei) → LOS!
  → Schlitten landet in der leuchtend grünen Landezone → weiter zu Fuß
  → Geschenke in den Schornstein → Sterne
```

Das erste Level erklärt alles mit kleinen Hinweisen. Alle 8 Levels sind von
Anfang an freigeschaltet.

### Steuerung

| Aktion | Touch | Tastatur |
|---|---|---|
| Laufen | Pfeile links unten | ← / → (A / D) |
| Springen (halten = höher) | Knopf rechts unten | Leertaste / W / ↑ |
| Zeichnen / Radieren | Finger ziehen | Maus ziehen |
| Zoomen beim Planen | zwei Finger / + − | Mausrad / + − |
| Kamera verschieben | Hand-Werkzeug oder zwei Finger | P, dann ziehen |
| Losfahren | goldener „LOS!“-Knopf | Leertaste |
| Zurück zum Zeichnen (nach der Ankunft) | Knopf unten | Q |
| Pause | Knopf oben rechts | Esc |
| Vollbild | Knopf oben rechts | F |

### Werkzeuge beim Planen

| Werkzeug | Taste | Wirkung |
|---|---|---|
| Piste | Z | Leuchtend weiße Linie zum Fahren, verbraucht **Tinte** |
| Speedtinte | B | Rot-goldene Linie mit wandernden Pfeilen. Sie schiebt den Schlitten in Zeichenrichtung, auch bergauf. Eigener, knapper Vorrat. |
| Radierer | E | Linien entfernen, die Tinte kommt zurück |
| Verschieben | P | Kamera frei schieben |
| Rückgängig | U / Strg+Z | Letzte Linie zurücknehmen |
| Löschen | Backspace | Alle Linien des Abschnitts entfernen |

### Was es im Level gibt

- **Stationen:** Jede Station hat ihren eigenen Tintenvorrat (Abschnitt).
- **Landezone:** Der leuchtend grüne Rahmen beim Planen. Dort steigt die Elfe aus.
  Fährt der Schlitten daran vorbei, beginnt die Fahrt neu.
- **Eis:** Zu Fuß rutschig. Anfahren dauert, Bremsen auch, und beim Absprung
  bleibt der Schwung erhalten.
- **Sprungfedern:** Schleudern die Elfe und den Schlitten hoch.
- **Blaue Felder mit Verbotsschild:** Hier kann man nicht zeichnen. Bau eine
  Schanze und spring darüber.
- **Harmlose Hindernisse:** Eiszapfen und Zuckerstangen sind fest. Man springt
  darüber oder fährt drumherum.
- **Gefahren leuchten rot:** hängende Eiszapfen, Lametta, schwingende Glocken
  und Krähen. Bewegte Gefahren zeigen beim Planen ihre Bahn als Punktlinie. Mit
  jedem LOS beginnt ihr Takt neu, so kann man den richtigen Moment planen.
- **Laternen:** Checkpoints. Sie leuchten auf, sobald man sie erreicht.

### Sterne und Bestwert

- Ein Stern fürs Abliefern, zwei ab 60 % der Geschenke, drei für alle Geschenke.
- **Bestwert** (Pokal): Wer mit drei Sternen fertig wird, bekommt die
  verbrauchte Tinte als Rekord. Weniger ist besser. Ändert sich ein Level,
  beginnt sein Rekord neu.
- Fortschritt und Stummschalter werden im Browser gespeichert.

## Installieren und offline spielen

Die Web-Version ist eine installierbare App (PWA). Am Handy die Seite öffnen,
dann „Zum Startbildschirm hinzufügen“ wählen. Danach startet sie wie eine App
im Vollbild und läuft auch ohne Internet.

## Entwicklung

```bash
npm install
npm run dev          # Dev-Server, im WLAN: npx vite --host
npm test             # Vitest (Simulation, Levels, Lösbarkeit, UI-Logik)
npm run typecheck    # tsc --noEmit (strict)
```

Nützlich beim Entwickeln:

- `?debug`: Kollisionsrahmen, FPS und Qualitätsstufe einblenden. In der
  Konsole kopiert `copy(__exportStrokes())` die gezeichneten Linien im
  Lösungsformat.
- `?q=low` / `?q=medium`: eine Qualitätsstufe erzwingen.
- **Neues Level:** JSON nach `src/levels/` legen und eine Lösung nach
  `src/levels/solutions/<id>.json` (im Spiel mit `?debug` zeichnen und exportieren).
  Ohne Lösung schlägt `npm test` fehl, und damit auch das Veröffentlichen.

## Builds und Veröffentlichung

```bash
npm run build        # -> dist/       PWA für GitHub Pages / beliebigen Webspace (< 1 MB)
npm run build:file   # -> dist-file/  alles in EINER HTML-Datei (startet auch per Doppelklick)
```

Bei jedem Push auf `main` testet und baut GitHub Actions
(`.github/workflows/deploy.yml`) und veröffentlicht auf GitHub Pages. Dafür
muss einmalig in den Repo-Einstellungen unter Pages die Quelle
„GitHub Actions“ gewählt werden. Durch `base: './'` ist der Repo-Name egal.
