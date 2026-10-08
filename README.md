# Epochenkrieg – Duell durch sechs Zeitalter

Ein Strategiespiel für **zwei Spieler an einem Gerät** (oder gegen die KI), das komplett im Browser läuft:
Jeder Spieler verteidigt seine Basis, bildet Einheiten aus, baut Türme, setzt Spezialangriffe ein und
steigt von der **Steinzeit** über **Antike**, **Mittelalter**, **Schießpulver** und **Moderne** bis in die
**Zukunft** auf. Wer zuerst die gegnerische Basis zerstört, gewinnt.

- Keine Installation, keine Abhängigkeiten, keine Bild- oder Audiodateien
- Grafik wird zur Laufzeit per Canvas gezeichnet, Musik und Soundeffekte werden per WebAudio erzeugt
- Steuerung per Tastatur, Maus, Touch (zwei Spieler an einem Tablet) und Gamepads

## Hinweis zur Herkunft

Dieses Projekt ist **kein dekompiliertes oder kopiertes Spiel**. Code, Grafik, Musik und Balancing sind
eigenständig neu geschrieben. Bestehende Spiele zu dekompilieren und deren Grafiken, Musik und Code
weiterzuverbreiten wäre eine Urheberrechtsverletzung – deshalb ist hier alles eigene Arbeit, die sich
lediglich am bekannten Genre-Prinzip „Basis gegen Basis auf einer Spur“ orientiert.

## Spielen

**Variante 1 – Datei öffnen:** `index.html` im Browser öffnen (Doppelklick genügt).

**Variante 2 – Einzeldatei:** `npm run build` erzeugt `dist/epochenkrieg.html`, eine einzelne Datei mit allem
drin – ideal zum Weitergeben. Zusätzlich entsteht `dist/artifact.html` (Seitenfragment für claude.ai-Artifacts).

**Variante 3 – lokaler Server:** `npm start` und dann <http://localhost:8080> öffnen.

**Variante 4 – GitHub Pages:** In den Repository-Einstellungen unter *Pages* „Deploy from a branch“ mit
dem Ordner `/ (root)` wählen – `index.html` liegt bereits im Hauptverzeichnis.

## Am Handy oder Tablet

- Hochformat und Querformat funktionieren. Im Hochformat wird das Spiel automatisch gedreht dargestellt –
  steht es auf dem Kopf, im Menü oder in der Pause „Bild drehen“ antippen.
- Gegen die KI liegen die acht Knöpfe groß am unteren Rand. Zu zweit hat Spieler 1 die Knöpfe links unten,
  Spieler 2 rechts unten (gespiegelt, sodass die Einheiten bei beiden außen liegen).
- „Verkaufen“ braucht per Touch ein zweites Tippen, „Neu starten“ und „Hauptmenü“ fragen nach.
- Beim Wechsel in eine andere App pausiert das Spiel; die Partie wird laufend gesichert und lässt sich nach
  dem Neuladen über „Partie fortsetzen“ weiterspielen.
- Ton startet nach der ersten Berührung. Am iPhone unterdrückt der Stummschalter den Ton.

## Steuerung

| Aktion                    | Spieler 1 (links, blau) | Spieler 2 (rechts, rot) | Nummernblock (Sp. 2) | Gamepad |
| ------------------------- | :---------------------: | :---------------------: | :------------------: | :-----: |
| Einheit 1 (Nahkampf)      | `Q`                     | `U`                     | `7`                  | A       |
| Einheit 2 (Fernkampf)     | `W`                     | `I`                     | `8`                  | X       |
| Einheit 3 (schwer)        | `E`                     | `O`                     | `9`                  | Y       |
| Spezialangriff            | `R`                     | `P`                     | `+`                  | B       |
| Turm kaufen               | `A`                     | `J`                     | `4`                  | LB      |
| Turmplatz bauen           | `S`                     | `K`                     | `5`                  | RB      |
| Ältesten Turm verkaufen   | `D`                     | `L`                     | `6`                  | LT      |
| Zeitalter aufsteigen      | `F`                     | `Ö` (`;` bei US-Layout) | `Enter`              | RT      |

- `Esc` = Pause, `M` = Musik an/aus. Gegen die KI zusätzlich Zifferntasten `1`–`8`.
- Alle Knöpfe in den Spieler-Panels lassen sich anklicken bzw. antippen (Multitouch).
- Die Tasten werden über ihre physische Position erkannt – QWERTZ und QWERTY funktionieren gleich.
- Gamepad 1 steuert Spieler 1, Gamepad 2 steuert Spieler 2.

## Spielregeln

- **Gold** gibt es laufend und für jeden besiegten Gegner. Damit kauft man Einheiten, Türme und Turmplätze.
- **Erfahrung (XP)** sammelt man durch Kämpfe. Ist der Balken voll, kann man ins nächste Zeitalter
  aufsteigen: neue, deutlich stärkere Einheiten, ein neuer Turm, ein neuer Spezialangriff und eine
  größere Basis (die beim Aufstieg teilweise repariert wird).
- Jedes Zeitalter hat **drei Einheiten** (Nahkampf, Fernkampf, schwer), **einen Turm** und
  **einen Spezialangriff** mit Abklingzeit:

| Zeitalter    | Einheiten                                         | Turm           | Spezialangriff   |
| ------------ | ------------------------------------------------- | -------------- | ---------------- |
| Steinzeit    | Keulenkrieger, Schleuderer, Säbelzahnreiter       | Steinschleuder | Felslawine       |
| Antike       | Hoplit, Bogenschütze, Streitwagen                 | Balliste       | Zorn der Götter  |
| Mittelalter  | Ritter, Armbrustschütze, Lanzenreiter             | Feuerkatapult  | Pfeilsturm       |
| Schießpulver | Säbelfechter, Musketier, Feldkanone               | Bastionskanone | Breitseite       |
| Moderne      | Sturmsoldat, Raketenschütze, Panzer               | MG-Stellung    | Luftschlag       |
| Zukunft      | Cyborg, Plasmaschütze, Kampfmech                  | Ionenturm      | Orbitallaser     |

- Im letzten Zeitalter wird weitere Erfahrung in **Elite-Stufen** umgewandelt (bis zu 5, je +12 % LP und
  Schaden für neu ausgebildete Einheiten), damit späte Partien nicht im Patt enden.
- Bis zu **drei Turmplätze** pro Basis. „Verkaufen“ gibt die Hälfte des Preises des ältesten Turms zurück –
  so lassen sich veraltete Türme ersetzen.
- Gegen die KI gibt es drei Stufen (Leicht, Normal, Schwer); die Stufe beeinflusst Reaktionszeit, Taktik
  und Wirtschaft der KI.

## Projektstruktur

```
index.html        Einstieg (lädt die Skripte der Reihe nach)
src/data.js       Zeitalter, Einheiten, Türme, Spezialangriffe, Balancing-Werte
src/sim.js        Deterministische Spielsimulation (ohne DOM, testbar in Node)
src/ai.js         Computergegner (nutzt dieselben Befehle wie Menschen)
src/sprites.js    Prozedurale Vektorgrafik: Figuren, Reittiere, Fahrzeuge, Basen, Türme
src/render.js     Hintergründe je Epoche, Geschosse, Effekte, Partikel
src/hud.js        Spieler-Panels mit klickbaren Knöpfen
src/ui.js         Menü, Steuerung, Pause, Siegbildschirm
src/audio.js      Musik-Sequenzer mit generierten Melodien + synthetisierte Soundeffekte
src/input.js      Tastatur, Maus/Touch, Gamepads
src/main.js       Spielschleife mit festem Zeitschritt, Zustandsautomat
tests/            Tests der Spiellogik (node --test)
tools/build.js    Baut die Einzeldatei-Version nach dist/
tools/balance.js  Lässt KI gegen KI spielen und gibt Kennzahlen zum Balancing aus
```

## Entwicklung

```bash
npm test                         # Spiellogik testen
npm run build                    # dist/epochenkrieg.html erzeugen
node tools/balance.js 6 normal leicht   # 6 Partien KI „Normal“ gegen „Leicht“
```

Die Simulation läuft mit festem Zeitschritt (60 Hz) und ist bei gleichem Seed deterministisch.
Darstellung und Ton lesen nur den Spielzustand und die Ereignisliste (`state.events`) – dadurch lässt sich
die gesamte Spiellogik ohne Browser testen.

## Lizenz

MIT – siehe [LICENSE](LICENSE).
