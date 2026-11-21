# Wichtelpiste

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

## Levels bauen (Editor)

`npm run dev` starten, auf dem Titelbildschirm **Editor** wählen. Auf der
veröffentlichten Seite gibt es den Editor nur mit `?editor` (dann ohne
Speichern ins Projekt, nur Export/Import als Datei).

1. **Neues Level** anlegen oder ein vorhandenes öffnen. Ein angefangener
   Entwurf wird im Browser gemerkt und lässt sich fortsetzen.
2. **Bauen:** Baustein links wählen und in die Welt tippen (Umschalt: mehrere
   nacheinander). Elemente antippen und ziehen, an den weißen Griffen die Größe,
   die Bahn von Glocke und Krähe oder die Richtung einer Feder ändern. Feinwerte
   stehen rechts im Eigenschaften-Feld. **Level** (oben rechts) öffnet die
   Profi-Einstellungen: Name, ID, Weltgröße, Polarlicht, Tinte je Abschnitt.
3. **Probespielen** (wahlweise ab einer Station). Jede geschaffte Fahrt wird als
   Lösung ihres Abschnitts gemerkt; unten zeigt „Lösung“, welche Abschnitte
   gelöst sind. **Tinte vorschlagen** setzt die Tinte auf das 1,5-Fache deiner
   Lösung.
4. **Ins Spiel speichern** schreibt `src/levels/NN-<id>.json` und
   `src/levels/solutions/<id>.json`. Gespeichert wird nur, wenn deine Lösung
   noch ankommt; sonst nennt der Editor den Grund. Danach lädt die Seite neu,
   der Editor ist wieder offen, und das Level steht am Ende der Levelauswahl.
   Committen und pushen, fertig.

| Aktion | Maus/Tastatur | Touch |
|---|---|---|
| Auswählen, verschieben | Klicken, ziehen | Antippen, ziehen |
| Kamera verschieben | Leertaste + ziehen, mittlere Taste, ins Leere ziehen | ins Leere ziehen, zwei Finger |
| Zoomen | Mausrad, + / − | zwei Finger |
| Ohne Raster ziehen | Alt halten | Raster-Knopf |
| Rückgängig / Wiederholen | Strg+Z / Strg+Y | Knöpfe oben |
| Duplizieren / Löschen | Strg+D / Entf | Knöpfe rechts |
| Feinschieben | Pfeiltasten (Umschalt: 1 px) | – |
| Probespielen / Speichern | T / Strg+S | Knöpfe oben |

Ändert sich ein vorhandenes Level, beginnen Sterne und Rekorde dafür neu.

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
