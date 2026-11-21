# Wichtelpiste

Ein Weihnachtsspiel für die ganze Familie, gemacht fürs Handy (Querformat) und
spielbar auf jedem Rechner. Du bist eine Weihnachtself auf Lieferreise: Sammle
Geschenke und bring sie zum Schornstein. Wo du zu Fuß nicht weiterkommst,
steigst du in den Schlitten. **Steuern kannst du ihn nicht, du zeichnest ihm
die Piste.**

> Konzept: `../brainstorming/konzept-schlittenfahrer.md` ·
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

## Bauen und Teilen

Auf dem Titelbildschirm **Bauen** tippen. Es erscheint **Meine Levels**:
ein neues Level anfangen oder ein eigenes weiterbauen. Alles wird im Browser
gespeichert, nichts geht beim Neuladen verloren.

1. **Bauen:** Baustein unten (Handy) bzw. links (PC) wählen und in die Welt
   tippen. Elemente antippen und ziehen; an den weißen Punkten ändert man die
   Größe. **Boden** legt ein Haus an, dessen Dach am angetippten Punkt liegt.
2. **Sprungweite:** Ist ein Boden, der Start oder eine Landezone gewählt,
   zeigen grüne Bögen, wie weit und hoch die Elfe von dort springen kann.
3. **Probespielen** (▶). Wer sein Level geschafft hat, sieht oben
   „✓ geschafft“; die Tinte passt sich im Einfach-Modus automatisch an.
4. **Teilen** (Teilen-Symbol): erst möglich, wenn man das Level selbst
   geschafft hat. Name eintragen, dann den **QR-Code** scannen lassen oder
   **Teilen**/**Link kopieren** und im Messenger verschicken. Wer den Link
   öffnet, sieht „Geschenkt von …“ und kann sofort spielen – ohne Installation,
   ohne Server. Wer das eigene Level mit 3 Sternen geschafft hat, schickt seinen
   Tinten-Rekord als Herausforderung mit.
5. Empfangene Levels liegen unter **Level wählen → Geschenkt**. Mit 3 Sternen
   kann man sie mit dem eigenen Rekord **zurückschicken**.

Im **⋯-Menü**: **Profi-Modus** (alle Bausteine wie Glocke, Krähe, Lametta,
Zeichenverbot, Hinweise und alle Zahlenwerte, Level-Einstellungen),
**Skizze** (schlichte Ansicht, schont Akku und Rechner), Sprungweite, Raster,
Export/Import als Datei, Level löschen.

### Am PC (Menü-Levels für das Spiel)

Mit `npm run dev` gibt es in „Meine Levels“ zusätzlich **Menü-Level öffnen**
und den Knopf **Ins Spiel speichern**: Er schreibt `src/levels/NN-<id>.json`
und `src/levels/solutions/<id>.json` – nur, wenn deine gemerkte Lösung noch
ankommt. Danach lädt die Seite neu, der Editor ist wieder offen, das Level steht
am Ende der Levelauswahl. Committen und pushen, fertig.

| Aktion | Maus/Tastatur | Touch |
|---|---|---|
| Auswählen, verschieben | Klicken, ziehen | Antippen, ziehen |
| Kamera verschieben | Leertaste + ziehen, mittlere Taste, ins Leere ziehen | ins Leere ziehen, zwei Finger |
| Zoomen | Mausrad, + / − | zwei Finger |
| Ohne Raster ziehen | Alt halten | Raster im ⋯-Menü |
| Rückgängig / Wiederholen | Strg+Z / Strg+Y | Knopf oben / ⋯-Menü |
| Duplizieren / Löschen | Strg+D / Entf | Knöpfe im Eigenschaften-Blatt |
| Feinschieben | Pfeiltasten (Umschalt: 1 px) | – |
| Probespielen / Speichern | T / Strg+S | Knöpfe oben |

Ändert sich ein Level, beginnen Sterne und Rekorde dafür neu.

## Entwicklung

```bash
npm install
npm run dev          # Dev-Server, im WLAN: npx vite --host
npm test             # Vitest (Simulation, Levels, Lösbarkeit, UI-Logik)
npm run typecheck    # tsc --noEmit (strict)
```

Nützlich beim Entwickeln:

- `?debug`: Kollisionsrahmen, FPS und Qualitätsstufe einblenden. Notlösung
  ohne Editor: In der Konsole kopiert `copy(__exportStrokes())` die
  gezeichneten Linien im Lösungsformat.
- `?q=low` / `?q=medium`: eine Qualitätsstufe erzwingen.
- **Neues Level:** am einfachsten mit dem Editor (siehe oben). Von Hand: JSON
  nach `src/levels/` und eine Lösung nach `src/levels/solutions/<id>.json`.
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

Online: **https://mjakobi-github.github.io/wichtelpiste/**

## Lizenz

Der Code steht unter der [MIT-Lizenz](LICENSE). Mitgelieferte Fremdsoftware
(PixiJS, pixi-filters: MIT; Schrift Fredoka: SIL Open Font License 1.1) und
ihre Lizenztexte stehen in [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).
Beide Dateien liegen auch jedem Build bei.
