# Wichtelpiste – Bauanleitung für Chatbots

Diese Datei erklärt einem Chatbot (ChatGPT, Claude, Gemini, …) alles, was er braucht, um
**gute, spielbare Level** für „Wichtelpiste“ zu bauen: welche Elemente es gibt, was sie zu Fuß und im
Schlitten bewirken, welche Maße funktionieren und wie man ein Level aufbaut, das Spaß macht.

Das Spiel prüft jedes Level automatisch (Wege zu Fuß, Schlittenfahrten, Tinte) und schickt dir
gegebenenfalls eine Rückmeldung. Dann korrigiere das Level und gib es wieder **vollständig** aus.

## 1. Das Spiel in drei Sätzen

Eine Elfe läuft und springt (Jump'n'Run), sammelt Geschenke und bringt sie zum Schornstein.
Lücken, die zu Fuß zu groß sind, überwindet sie im Schlitten: An einer **Station** steigt sie automatisch
ein, der Spieler **zeichnet eine Piste**, drückt LOS, und der Schlitten rutscht mit Schwerkraft darauf los.
Er muss in der **Landezone** dieses Abschnitts ankommen; dort steigt die Elfe aus und läuft weiter.

## 2. Drei Arten von Leveln

| Art | Aufbau | Felder |
|---|---|---|
| **Reines Jump'n'Run** | Nur laufen und springen, kein Schlitten | `stations: []`, `areas: []`, `dismounts: []` |
| **Reine Schlittenfahrt** | Ein kurzes Stück zu Fuß (z. B. 200–500 px) zur Station, dann eine lange Fahrt direkt zum Schornstein | 1 Station, 1 Eintrag in `areas`, `dismounts: []` |
| **Gemischt** | Abwechselnd laufen und fahren | n Stationen, n `areas`, Landezonen für alle außer evtl. der letzten |

Wenn der Wunsch nichts anderes sagt: **gemischt** mit 1–3 Stationen.

## 3. Koordinaten

- Weltpixel. **x nach rechts, y nach UNTEN** (kleineres y = höher oben).
- Welt typisch 2400–5000 breit, 700–1300 hoch. Alles muss innerhalb von `worldW` × `worldH` liegen.
- Wer unten aus der Welt fällt (y > worldH + 240) oder seitlich weit hinaus fährt, verliert einen Versuch.
- „Dachhöhe“ = `y` einer Plattform (ihre Oberkante). Fast alle Elemente werden relativ dazu gesetzt.

## 4. Die Elfe zu Fuß (gemessen mit der echten Spielphysik)

- Größe 30 × 38 px. Läuft bis 300 px/s.
- **Sprung** (voller Anlauf, Taste gehalten): bis **190 px hoch**, auf gleicher Höhe **208 px weit**.
  Kurz antippen = kleiner Sprung.
- **Plane mit Reserve**: Lücken zu Fuß höchstens **160 px**, Stufen nach oben höchstens **130 px**,
  beides zugleich (weit UND hoch) eher 120 × 100. Herunterfallen ist beliebig tief erlaubt.
- Alles Feste ist von **allen Seiten** fest: Wer unter einem Balken hochspringt, stößt sich den Kopf.
  Über einer Absprungstelle mindestens 230 px frei lassen.
- **Eis** (`ice: true`): Anlaufen dauert länger, die Elfe rutscht lange nach und behält den Schwung im
  Sprung. Auf kurzen Eisbalken hat man wenig Anlauf → Lücken danach kleiner planen (≤ 120 px).
- Fällt die Elfe in eine Gefahr oder aus der Welt, beginnt sie an der letzten erreichten Laterne
  (sonst am Start). Bereits gesammelte Geschenke bleiben.

## 5. Der Schlitten

- Steht an der Station und fährt beim LOS langsam (120 px/s) in Fahrtrichtung los; danach nur
  Schwerkraft, Reibung fast null. Er hat **keine Steuerung** – die gezeichnete Piste ist alles.
- Ohne Speedtinte kommt er **nicht höher als die Station**. Darum: Landezone **100–300 px tiefer** als
  die Station und **400–1100 px** entfernt. Weiter weg geht, braucht aber mehr Tinte.
- **Speedtinte** (`boost`) schiebt den Schlitten in **Zeichenrichtung** und erlaubt Fahrten bergauf oder
  sehr weite Sprünge. Nur geben, wenn das Level das wirklich braucht (dann z. B. 200–400).
- Der Schlitten prallt an **allen Kanten** von Plattformen, Eiszapfen und Zuckerstangen ab und kann
  auf Dächern weiterrutschen. Eis hat für ihn keine Wirkung.
- Eine Fahrt **scheitert** und beginnt neu an der Station, wenn der Schlitten
  - eine Gefahr berührt (Lametta, hängender Eiszapfen, Glocke, Krähe),
  - aus der Welt fällt,
  - stecken bleibt (über 1 s fast stillsteht) oder 2,5 s nicht weiter von der Station wegkommt,
  - mehr als 150 px **über die Landezone hinaus** fährt.
  Gezeichnete Linien und Tinte bleiben, die Geschenke dieser Fahrt erscheinen wieder.
- Der Schlitten sammelt Geschenke ein, durch die er fährt (auch in der Luft).
- **Tinte**: Länge aller Linien in px. Großzügig planen: **etwa 1,5 × Entfernung Station → Ziel**.
  `"unlimited"` ist erlaubt, nimmt aber den Reiz; für Kinder-Level trotzdem okay.

## 6. Alle Felder und Elemente

Alle Felder sind Pflicht, Listen dürfen leer sein (`[]`).

### Grunddaten
- `"version": 1`
- `"id"`: kurzer-name-mit-bindestrichen
- `"name"`: Anzeigename, höchstens 30 Zeichen
- `"worldW"`, `"worldH"`: Weltgröße
- `"spawn": {x,y}`: Startpunkt der Elfe (linke obere Ecke). `y = Dachhöhe darunter − 60`.
- `"theme": {seed, auroraHue}`: `seed` = beliebige Zahl für die Landschaft, `auroraHue` 0–360 = Farbe
  des Polarlichts (150 grün, 200 türkis, 280 lila, 330 rosa).

### Untergrund
- `"platforms": [{x,y,w,h,ice?}]` – Boden, Häuser, Balken. `x,y` = linke obere Ecke, `y` = Dachhöhe.
  - Ab `h ≥ 50` wird ein **Haus** gezeichnet (Boden/Häuser bis zum Weltrand: `y + h = worldH`).
  - Darunter ein **Balken** (empfohlen `h: 24`, `w` 100–300) – ideal für Jump'n'Run-Treppen.
  - `ice: true` = rutschig zu Fuß.

### Schlitten-Abschnitte (alle drei Listen gehören zusammen)
- `"stations": [{pos:{x,y}, dir?}]` – Station auf einem Dach: `pos.y = Dachhöhe − 60`, mindestens
  60 px von der Dachkante entfernt (zur Fahrtrichtung hin). Die Elfe steigt ein, sobald sie dort steht.
  - `dir`: Fahrtrichtung beim LOS, `1` = rechts, `-1` = links. **Weglassen** = zum Ziel hin. Nur
    angeben, wenn der Schlitten erst vom Ziel weg muss (z. B. zu einer Feder, die ihn zurückschleudert).
- `"areas": [{ink, boost}]` – **genau ein Eintrag je Station**, gleiche Reihenfolge. `ink` = Tinte
  (z. B. 1000), `boost` = Speedtinte (0 oder z. B. 300). Zahl ≥ 0 oder `"unlimited"`.
- `"dismounts": [{x,y,w,h}]` – Landezone von Station i an Stelle i. Liegt auf einem Dach:
  `y + h = Dachhöhe`, `w ≈ 240`, `h = 150`. Höchstens so viele wie Stationen. **Fehlt** der Eintrag
  für die letzte Station, fährt der Schlitten direkt zum Schornstein.

### Ziel und Belohnung
- `"gifts": [{x,y}]` – mindestens eins. Auf dem Boden `y = Dachhöhe − 25`. Auch in der Luft möglich
  (über Lücken, auf einer Sprung- oder Schlittenbahn); eingesammelt wird im Umkreis von 26 px.
- `"chimney": {x,y}` – Schornstein, steht auf einem Dach: `y = Dachhöhe`. Nimmt erst an, wenn man
  **mindestens ein Geschenk** dabei hat. Sterne: alle Geschenke ⭐⭐⭐, ab 60 % ⭐⭐, sonst ⭐.
- `"checkpoints": [{x,y}]` – Laternen = Neustartpunkt zu Fuß, `y = Dachhöhe`. Aktiv, wenn die Elfe
  50 px nahe kommt. **In Wegreihenfolge auflisten**: Wer eine spätere Laterne erreicht, kann die
  früheren nicht mehr aktivieren. Sinnvoll vor schweren Sprungpassagen und nach Landezonen.

### Federn
- `"springs": [{pos:{x,y}, angle, power}]` – `pos.y = Dachhöhe`, `angle` in Grad: `0` = senkrecht,
  positiv = nach rechts geneigt, negativ = nach links. `power` 1200–1500.
  - **Zu Fuß**: Auslösen durch Draufspringen oder -laufen. Hebt die Elfe ca. **345 px** (power bis 1400)
    bzw. **400 px** (power 1500) – für hohe Dächer, die man nicht erspringen kann.
  - **Im Schlitten**: schleudert ihn in Federrichtung (plus ein Teil seines Tempos). Für Schanzen
    oder um ihn zurückzuwerfen (dann `dir` an der Station setzen).
  - Über der Feder Platz lassen (keine Decke darüber)!

### Harmlose Hindernisse (fest für Elfe UND Schlitten)
- `"icicles": [{x,y,h}]` – stehender Eiszapfen, `x` = Mitte, `y` = Dachhöhe, `h` 40–80. 12 px breit.
- `"candies": [{x,y,h}]` – Zuckerstange, wie oben, 18 px breit, **ragt 24 px höher als h**.
- Man springt darüber oder nutzt sie als Trittstein. Auf einer Schlittenstrecke bremsen oder blockieren
  sie den Schlitten – dort nur hinstellen, wenn man drüberzeichnen kann.

### Tödliche Gefahren (für Elfe UND Schlitten)
- `"hazards": [{kind, rect:{x,y,w,h}}]`
  - `"tinsel"` (Lametta): als Boden einer Grube, z. B. `{x: Lückenanfang, y: worldH − 30, w: Lückenbreite, h: 20}`.
    Macht Fehlsprünge sichtbar und spannend.
  - `"icicle-hanging"`: hängt von einer Decke/Balkenunterseite, z. B. `w 20–30`, `h 40–70`.
- `"movers": [{kind, radius, path}]` – bewegte Gefahr, `kind` `"bell"` (Glocke) oder `"crow"` (Krähe),
  `radius: 18`. `path` ist eins von:
  - `{type:"pendulum", pivot:{x,y}, length, amplitude, period}` – hängt **unter** dem Drehpunkt
    und schwingt; `amplitude` in rad (0.6–1.0).
  - `{type:"line", from:{x,y}, to:{x,y}, period}` – pendelt hin und zurück.
  - `{type:"circle", center:{x,y}, radius, period}` – kreist.
  - optional `phase` 0–1, um mehrere Beweger zeitversetzt laufen zu lassen. `period` in s (1.5–3).
  - Die Uhr der Beweger startet beim Einsteigen, Neustart und Respawn bei 0, **läuft beim LOS aber
    weiter**: Der Spieler muss den richtigen Moment zum Losfahren abpassen.

### Zeichnen
- `"noDraw": [{x,y,w,h}]` – Zeichenverbot: dort keine Linie. Der Schlitten darf durch, braucht aber
  davor eine Schanze, um darüber zu fliegen. Nicht direkt an Station oder Landezone legen.

### Hinweise (optional)
- `"hints": [{at:{x,y,w,h}, text, icon}]` – kurzer Text, solange die Elfe im Bereich `at` ist.
  `icon`: `"move"`, `"jump"`, `"station"`, `"draw"`, `"launch"`, `"chimney"`. Gut für neue Ideen im
  Level („Spring auf die Feder!“). Höchstens 3–4, Texte unter 40 Zeichen.

## 7. Gutes Leveldesign

**Rhythmus.** Abwechseln zwischen Spannung und Ruhe: schwere Sprungfolge → sicheres Dach mit Laterne →
Schlittenfahrt → Landen → ruhiges Stück mit Geschenk.

**Eine Idee pro Abschnitt.** Jeder Abschnitt stellt eine Aufgabe: eine Grube mit Lametta, eine Feder
zu einem hohen Dach, eine Glocke, deren Takt man abpasst, eine Zeichenverbotszone, über die man springt.
Nicht alles auf einmal.

**Steigende Schwierigkeit.** Am Anfang leicht (breite Plattformen, kleine Lücken), zum Ende hin
anspruchsvoller. Keine schwere Stelle direkt am Start.

**Geschenke als Wegweiser und Belohnung.** Ein leichtes Geschenk auf dem Weg, ein schwerer erreichbares
(auf einem hohen Balken, in der Luft über einer Lücke, auf der Schlittenbahn) für den dritten Stern.
3–6 Geschenke sind ein guter Wert.

**Fair bleiben.**
- Jede Gefahr muss man sehen, bevor man hineinläuft, und es muss einen Weg daran vorbei geben.
- Keine Gefahr auf dem einzigen Weg ohne Ausweichmöglichkeit (drüberspringen, Takt abwarten).
- Laterne vor jeder Stelle, an der man oft scheitert.
- Nichts liegt in der Luft, wo man nicht hinkommt.

**Schlittenstrecke.**
- Zwischen Station und Landezone eine Lücke, die man zu Fuß **nicht** schafft (sonst braucht man den
  Schlitten nicht): breiter als 260 px oder tiefer als die Station.
- Der Raum zwischen Station und Landezone ist die Zeichenfläche: frei lassen oder bewusst eine Hürde
  einbauen (hohes Haus zum Überspringen, Glocke, Zeichenverbot).

**Schwierigkeit nach Wunsch.**
| | Leicht (Kinder) | Mittel | Schwer |
|---|---|---|---|
| Lücken zu Fuß | ≤ 100 px | ≤ 140 px | ≤ 160 px |
| Plattformen | breit (≥ 200) | 120–200 | 100–140, Eis |
| Gefahren | keine/1 | 2–3 | mehrere, Beweger |
| Tinte | 2 × Entfernung | 1,5 × | 1,2 × |
| Laternen | vor jeder Stelle | jede 2. Stelle | wenige |

## 8. Bausteine (Rezepte)

- **Treppe aus Balken**: Balken `h: 24`, je 100–130 px höher und 100–140 px seitlich versetzt.
- **Grube**: Lücke 120–160 px zwischen zwei Dächern gleicher Höhe, darin unten Lametta.
- **Hohes Dach**: Dach 250–380 px über dem Boden, davor Feder mit `angle` 10–20 zum Dach hin.
- **Abwärtssprung**: von hohem Dach auf tieferes – fast beliebig weit, gut für Tempo.
- **Pendelglocke über der Grube**: Drehpunkt 220–300 px über dem Boden, `length` 160–220.
- **Krähenpatrouille**: `line` waagerecht auf Kopfhöhe (Dach − 30) oder senkrecht über einer Lücke.
- **Schanze für den Schlitten**: tiefe Station, Landezone hinter einem hohen Haus; der Spieler zeichnet
  bergab und am Ende eine kleine Rampe nach oben.
- **Zurückschleudern**: Feder hinter der Station, `dir` zur Feder hin, Landezone auf der anderen Seite.
- **Eisrutsche**: lange Eisplattform, an deren Ende eine Lücke – die Elfe muss früh abbremsen.

## 9. Checkliste vor dem Ausgeben

1. `stations`, `areas` gleich lang; `dismounts` höchstens so lang.
2. `spawn`, Stationen, Geschenke, Schornstein, Laternen sitzen auf Dächern (Formeln aus Abschnitt 6).
3. Jeder Fußweg mit Sprüngen ≤ 160 px weit / ≤ 130 px hoch oder mit Feder schaffbar.
4. Landezone tiefer als Station (oder Speedtinte), Entfernung 400–1100 px, Tinte ≈ 1,5 × Entfernung.
5. Keine Gefahr und kein Hindernis direkt vor der Station oder auf der Landezone.
6. Alles innerhalb der Welt; Böden reichen bis `worldH`.
7. Laternen in Wegreihenfolge.

## 10. Rückmeldungen des Spiels verstehen

| Meldung | Bedeutung und Abhilfe |
|---|---|
| „Station … ist zu Fuß nicht erreichbar“ | Weg dorthin zu weit/hoch, oder Gefahr im Weg. Lücken verkleinern, Treppe/Feder einbauen. |
| „Die Tinte reicht nicht … bräuchte etwa N“ | `ink`/`boost` dieses Abschnitts auf mind. 1,3 × N setzen – oder Ziel näher/tiefer legen. |
| „Keine Piste gefunden“ | Ziel zu hoch, zu weit oder blockiert. Landezone tiefer und näher, Hindernisse dazwischen entfernen. |
| „Der Schornstein … ist nicht erreichbar“ | Schornstein auf ein erreichbares Dach stellen (`y = Dachhöhe`). |
| „Geschenk … kann man nicht einsammeln und danach noch abliefern“ | Geschenk liegt zu hoch/weit oder hinter dem Ziel ohne Rückweg. Verschieben. |
| „Formatfehler: …“ | Feld fehlt oder hat den falschen Typ – Pfad in der Meldung zeigt die Stelle. |

## 11. Antwortformat

Gib das Level als **einen** JSON-Codeblock aus (```json … ```), ohne Kommentare im JSON. Wenn die Aufgabe
einen Link verlangt: Spieladresse + `#ki=` + dasselbe JSON kompakt und URL-kodiert (wie
`encodeURIComponent`). Standard-Spieladresse: https://mjakobi-github.github.io/wichtelpiste/

## 12. Beispiele

Alle Beispiele sind geprüft und spielbar.

### Reines Jump'n'Run: „Dachhüpfer“
Balkentreppe, Lametta-Grube, Feder auf ein hohes Dach, Zuckerstange, Krähe.

```json
{"version":1,"id":"dachhuepfer","name":"Dachhüpfer","worldW":2600,"worldH":900,"spawn":{"x":60,"y":640},"platforms":[{"x":0,"y":700,"w":600,"h":200},{"x":720,"y":620,"w":140,"h":24},{"x":960,"y":560,"w":320,"h":340},{"x":1440,"y":340,"w":200,"h":24},{"x":1400,"y":700,"w":1200,"h":200}],"stations":[],"areas":[],"dismounts":[],"gifts":[{"x":300,"y":675},{"x":790,"y":595},{"x":1540,"y":315},{"x":2000,"y":675}],"chimney":{"x":2450,"y":700},"checkpoints":[{"x":1100,"y":560},{"x":1500,"y":700}],"springs":[{"pos":{"x":1220,"y":560},"angle":15,"power":1500}],"icicles":[],"candies":[{"x":1800,"y":700,"h":50}],"hazards":[{"kind":"tinsel","rect":{"x":600,"y":870,"w":360,"h":20}}],"movers":[{"kind":"crow","radius":18,"path":{"type":"line","from":{"x":2150,"y":520},"to":{"x":2150,"y":660},"period":2}}],"noDraw":[],"theme":{"seed":42,"auroraHue":200},"hints":[{"at":{"x":1100,"y":420,"w":180,"h":140},"text":"Spring auf die Feder!","icon":"jump"}]}
```

### Reine Schlittenfahrt: „Talfahrt“
Ein paar Schritte zur Station auf dem Berg, dann eine lange Fahrt direkt zum Schornstein. Ein Geschenk
hängt in der Luft auf der Fahrbahn, eins liegt kurz vor dem Schornstein, wo der Schlitten durchrutscht.

```json
{"version":1,"id":"talfahrt","name":"Talfahrt","worldW":2600,"worldH":1000,"spawn":{"x":60,"y":340},"platforms":[{"x":0,"y":400,"w":500,"h":600},{"x":1500,"y":850,"w":1100,"h":150}],"stations":[{"pos":{"x":420,"y":340}}],"areas":[{"ink":2600,"boost":0}],"dismounts":[],"gifts":[{"x":250,"y":375},{"x":900,"y":570},{"x":2050,"y":825}],"chimney":{"x":2200,"y":850},"checkpoints":[],"springs":[],"icicles":[],"candies":[],"hazards":[{"kind":"tinsel","rect":{"x":500,"y":970,"w":1000,"h":20}}],"movers":[],"noDraw":[],"theme":{"seed":7,"auroraHue":280},"hints":[]}
```

### Gemischt: „Zwei Dächer weiter“ (Level 3 aus dem Spiel)
Zwei Stationen: Die erste fährt in eine Landezone, die zweite direkt zum Schornstein.

```json
{"version":1,"id":"zwei-daecher","name":"Zwei Dächer weiter","worldW":2950,"worldH":820,"spawn":{"x":80,"y":560},"platforms":[{"x":0,"y":620,"w":620,"h":200},{"x":290,"y":500,"w":150,"h":24},{"x":1120,"y":680,"w":600,"h":140},{"x":2320,"y":720,"w":630,"h":100}],"stations":[{"pos":{"x":560,"y":560}},{"pos":{"x":1660,"y":620}}],"dismounts":[{"x":1120,"y":530,"w":240,"h":150}],"gifts":[{"x":200,"y":595},{"x":365,"y":470},{"x":880,"y":700},{"x":1480,"y":655},{"x":2000,"y":740}],"checkpoints":[{"x":1420,"y":680}],"icicles":[],"candies":[],"hazards":[],"movers":[],"springs":[],"noDraw":[],"chimney":{"x":2700,"y":720},"areas":[{"ink":800,"boost":0},{"ink":800,"boost":0}],"theme":{"seed":37,"auroraHue":200},"hints":[{"at":{"x":1360,"y":400,"w":260,"h":420},"text":"Jede Station hat ihre eigene Tinte","icon":"station"}]}
```
