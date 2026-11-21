# Schlittenfahrer 🎅🛷

Weihnachts-Jump'n'Run mit Line-Rider-Passagen – spielbar auf PC & Smartphone.
Du bist die Weihnachtself auf Lieferreise: Sammle Geschenke und wirf sie am
Schornstein ab. Wo du zu Fuß nicht weiterkommst, steigst du in den Schlitten –
aber **du darfst dann nur zeichnen, nicht steuern.**

> Konzept & Planung: `../brainstorming/konzept-schlittenfahrer.md`
> Technische Doku: [`docs/TECHNIK.md`](docs/TECHNIK.md)

## So spielt du

```
Levelstart → zu Fuß Geschenke sammeln → Schlittenstation erreichen
   → zeichnen (in Ruhe, Kamera verschieben erlaubt)
   → 🛷 LOS! → Schlitten fährt deine Linie entlang
   → ankommen (automatischer Abstieg + Checkpoint)
   → weiter zu Fuß → am Ende: Geschenke in den Schornstein 🎁 → ⭐
```

### Steuerung

| Aktion | Tastatur | Touch |
|---|---|---|
| Laufen | ← / → (A / D) | Pfeile links unten |
| Springen (halten = höher) | Space / W / ↑ | Knopf rechts unten |
| Schlitten starten | Space oder goldener „LOS!"-Button | „LOS!" |
| Werkzeuge | siehe unten | Werkzeugleiste rechts oben |
| Zeichnen / Radieren | Maus ziehen | Finger ziehen |
| Alles löschen | Backspace | 🗑️-Button |
| Neustart (Position) | R | — |
| Menü | Esc / ☰ | ☰ |

### Werkzeuge (Werkzeugleiste rechts oben)

| Werkzeug | Taste | Wirkung |
|---|---|---|
| ✏️ Piste | `Z` | Weiße Linien = Fahrbahn, verbraucht **Tinte** |
| 🚀 Speedtinte | `B` | Rote Linien mit Pfeilspitzen, schieben den Schlitten in Zeichenrichtung (a → b). Verbraucht **Speedtinte** – eigener, knapper Pool! |
| 🧽 Radierer | `E` | Linien entfernen, Tinte wird **erstattet** |
| ✋ Verschieben | `P` | Kamera in der Planungsphase frei schieben |
| 🗑️ Löschen | `Backspace` | Alle gezeichneten Linien des aktuellen Bereichs entfernen (Tinte erstattet) |

### Regeln im Überblick

- **Tinte** ist pro *Bereich* (je Station) begrenzt; Speedtinte ist extra und rar.
  Radierer/Mülleimer geben Tinte zurück: gezeichnet + übrig = Budget.
- **Crash oder `R`** während der Fahrt: Position zurück, aber **Zeichnung und Tinte
  bleiben** — Geschenke, die du *in dieser Fahrt* gesammelt hast, erscheinen wieder
  (nur beim Erfolg zählen sie).
- **Jede Schlitten-Ankunft** ist automatisch ein Checkpoint; Flaggen im Level auch.
- **Hindernisse** (❄️ Eiszapfen, 🍬 Zuckerstangen) sind solide: zu Fuß drüber
  springen, im Schlitten kosten sie Schwung — kein Reset.
- **Sterne:** ⭐ geschafft · ⭐⭐ mind. 60 % der Geschenke · ⭐⭐⭐ alles.
  Lieferung ab 1 Geschenk, zu Fuß oder per Schlitten.

## Entwicklung

```bash
npm install
npm run dev          # Dev-Server (HMR)
npm run typecheck    # tsc --noEmit (strict)
```

## Builds

```bash
npm run build        # -> dist/        (GitHub Pages / beliebiger Webspace)
npm run build:file   # -> dist-file/   (alles in EINER HTML-Datei zum Versenden)
```
