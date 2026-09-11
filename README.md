# XR Atem und Puls

Ein 3D-Lungenmodell macht einen Puls als Bewegung sichtbar. Steigt der Puls,
zieht sich die Lunge zusammen und atmet flacher. Sinkt er, dehnt sie sich aus
und atmet ruhiger.

Die Kernidee ist, Entspannung als Bewegung erfahrbar zu machen statt als Zahl
abzulesen. Die Pulsanzeige oben links ist deshalb bewusst klein und
nebensächlich — sie belegt nur, dass die Bewegung an einem Wert hängt.

> **Es sind keine echten Messdaten.** Alle Pulswerte in diesem Projekt sind
> erzeugt, entweder per Formel oder aus einer vorbereiteten Datei. Es ist kein
> Sensor angeschlossen und es werden keine personenbezogenen Daten verarbeitet.
> Wie eine reale Datenquelle andocken würde, steht unter
> [Eine echte Datenquelle anbinden](#eine-echte-datenquelle-anbinden).

---

## Starten

Das Projekt braucht **keinen Build-Schritt** — kein npm, kein Bundler. Es
braucht aber einen **HTTP-Server**:

1. Ordner in VS Code öffnen
2. Rechtsklick auf `index.html` → *Open with Live Server*
3. Im Browser auf **Start** klicken

Die Adresszeile muss mit `http://` beginnen. Über `file://` blockiert der
Browser sowohl `fetch` als auch das Laden des glTF-Modells — die Lunge bliebe
unsichtbar und die Live Simulation stumm. Wenn der Live-Button orange
**„Live Simulation: Datei fehlt"** anzeigt, ist genau das die Ursache.

### Eine andere Datei abspielen

Standard ist `data/puls-kurz.csv`: der volle Verlauf in 72 Sekunden, kurz
genug für eine Vorführung. Wer den realistisch getakteten Fünf-Minuten-Verlauf
sehen will, hängt ihn an die Adresse:

```
http://localhost:5500/?aufzeichnung=data/puls.csv
```

Das funktioniert mit jeder Datei im Ordner `data/`, auch mit der JSON-Fassung.

---

## Bedienung

| Element | Wirkung |
|---|---|
| **Start / Stopp** | Hält die Wiedergabe an. Die Lunge bleibt in ihrer aktuellen Größe stehen. |
| **Ruhe** | Steuert auf 60 bpm. Läuft gerade die Aufzeichnung, wird dabei auf die Simulation gewechselt. |
| **Anspannung** | Steuert auf 110 bpm, ebenso. |
| **Live Simulation** (unten) | Spielt die Werte aus `data/puls-kurz.csv` ab. Grün markiert, solange sie läuft. Nochmal drücken schaltet zurück auf die Formel. |
| **Live Simulation: an / aus** (oben rechts) | Sagt in Worten, ob die Wiedergabe gerade läuft. Der Punkt links ist grün, wenn ja. Schaltet auf Klick genauso um. |

**Die Live Simulation läuft ab dem Start.** Die Werte kommen sofort aus
`data/puls-kurz.csv` und wandern durchgehend zwischen 56 und 117 bpm — der Puls
steht nirgends auf einer festen Stufe. Dafür muss nichts gedrückt werden.
Oben rechts steht jederzeit, ob sie gerade läuft.

Der Name sagt bewusst *Simulation*: die Werte sind erzeugt, es hängt kein
Sensor daran. „Live" meint nur, dass sie fortlaufend hereinkommen, so wie es
ein echter Sensor täte.

Ruhe und Anspannung bleiben bedienbar. Der Verlauf in der Datei steht zwar fest
und reagiert nicht auf `setzeZustand`, aber statt die beiden Buttons zu
sperren, **übernimmt ein Klick die Steuerung** und schaltet dabei die Live
Simulation ab. Wer Anspannung drückt, will Anspannung sehen. Kein Element der
Bedienleiste ist je ohne Wirkung.

---

## Wie der Puls zur Bewegung wird

Es bewegen sich vier Dinge, aber nur auf **zwei Zeitachsen**. Das ist der
Grund, warum die Szene zusammenhängend wirkt und nicht wie eine
Effektsammlung.

**Atemzyklus, etwa 6 Sekunden** — Modellgröße, Umgebungslicht und Bodenring
schwingen gemeinsam. Der Hub ist mit ±4,6 % bewusst klein: es soll atmen, nicht
pochen.

**Anspannung, etwa 10 Sekunden** — Grundgröße des Modells und Himmelsfarbe
folgen dem geglätteten Puls. Das ist der eigentliche Effekt: hoher Puls =
sichtbar kleinere Lunge.

```
Puls (bpm)
   |
   |  60 bpm ................................... 110 bpm
   |    |                                           |
   v    v                                           v
Grundgröße        1.00  ------------------------>  0.75
Atemhub          0.046  ------------------------>  0.014
Himmel oben    #20454C  ------------------------> #46352F
Himmel unten   #0E1F22  ------------------------> #241A1A
```

Die Umrechnung von bpm auf 0…1 macht `datenquelle.anteil()` an einer einzigen
Stelle. Größe, Licht, Ring und Himmel lesen denselben Wert.

---

## Architektur

```
        Bedienleiste                       Pulsanzeige
        (js/ui.js)                         (js/ui.js)
             |                                  |
             |          spricht nur mit         |
             +----------------+-----------------+
                              |
                              v
                  +---------------------------+
                  |    js/datenquelle.js      |
                  |  Schnittstelle M6         |
                  |  + Umschalter             |
                  |  + anteil() 0..1          |
                  +-------------+-------------+
                                |
                   aktive Quelle| (austauschbar)
                +---------------+---------------+
                |                               |
                v                               v
     +--------------------+        +-------------------------+
     | js/simulation.js   |        |  js/aufzeichnung.js     |
     | Formel 60 <-> 110  |        |  data/puls-kurz.csv     |
     |                    |        |  data/puls.csv / .json  |
     +--------------------+        +-------------------------+


                  +---------------------------+
                  |    js/datenquelle.js      |
                  +-------------+-------------+
                                | anteil()
             +------------------+------------------+
             |                  |                  |
             v                  v                  v
     +---------------+  +---------------+  +----------------+
     | js/atmung.js  |  | js/himmel.js  |  | js/atem-echo.js|
     | Modellgröße   |  | Hintergrund   |  | Licht + Ring   |
     +-------+-------+  +---------------+  +----------------+
             | atemwert (0..1, gemeinsamer Takt)
             +---------------------------------> js/atem-echo.js
```

Die entscheidende Eigenschaft: **außerhalb von `simulation.js` und
`aufzeichnung.js` steht im ganzen Projekt kein einziger Verweis auf eine
konkrete Quelle.** Alles geht über `datenquelle`. Deshalb lässt sich die
Herkunft der Werte austauschen, ohne dass Mapping, Animation oder Bedienung
davon etwas mitbekommen.

---

## Die Dateien im Einzelnen

### `index.html`
Szene, Overlay-Bedienung und alle Styles. Enthält die A-Frame-Szene mit
Himmelskugel, Licht, Boden, Atemring, Lungenmodell und Kamera.

Zwei Dinge sind hier erklärungsbedürftig. Erstens steht statt `<a-sky>` eine
gewöhnliche Kugel-Entity mit `side: back` — `a-sky` bringt eine Standardfarbe
mit, die der eigene Verlaufs-Shader nicht kennt, was bei jedem Start eine
Konsolenwarnung erzeugen würde. Zweitens ist das Lungenmodell in einen äußeren
Container verschachtelt: der Container wird skaliert, das innere Modell wird
zentriert. Ohne diese Trennung würde die Skalierung das Modell verschieben.

Die Ladereihenfolge der Skripte ist nicht beliebig: `datenquelle.js` definiert
den Vertrag und muss vor den beiden Quellen laufen, die sich dort registrieren.

### `js/datenquelle.js`
Definiert die Schnittstelle für Pulsdatenquellen und schaltet zwischen ihnen
um. Der Vertrag steht im Kopfkommentar der Datei.

Quellen **registrieren sich selbst** (`datenquelle.registrieren(name, quelle)`).
Der Umschalter kennt also keine der beiden namentlich — genau das belegt, dass
weitere Quellen ohne Änderung an diesem Modul dazukommen können.

Hier liegt auch `anteil()`, die Umrechnung von bpm auf 0…1. Das ist bewusst
**nicht** Teil der Quellen-Schnittstelle: es ist eine Darstellungsgröße, keine
Datenerzeugung. Läge sie in jeder Quelle, müsste jede künftige echte Quelle sie
mitliefern.

Beim Wechsel blendet `update()` über 2,5 Sekunden vom letzten Wert der alten
Quelle auf die neue. Ohne das würde die Lunge beim Umschalten springen.

### `js/simulation.js`
**Datenquelle A.** Erzeugt einen Pulsverlauf per Formel: gleitende Annäherung
an 60 bpm (Ruhe) oder 110 bpm (Anspannung), darüber zwei überlagerte
Schwingungen als natürliche Schwankung.

Der Übergang braucht rund 10 Sekunden für den vollen Bereich. Das ist die
Standardquelle, weil sie ohne Datei und ohne Server auskommt.

### `js/aufzeichnung.js`
**Datenquelle B.** Spielt eine vorbereitete Pulsreihe aus einer Datei ab.
Liest **JSON und CSV** — beide werden beim Einlesen auf dieselbe interne Form
gebracht, danach ist der Rest des Moduls formatunabhängig.

Der Index wird aus der verstrichenen Zeit gerechnet, zwischen benachbarten
Werten wird interpoliert, und am Ende läuft die Wiedergabe in einer Schleife
weiter. Der letzte Wert interpoliert dabei gegen den ersten, sonst gäbe es an
der Nahtstelle einen Ruck.

Die Datei enthält nur Pulswerte, kein Zustandsfeld. `rest` und `stress` werden
deshalb aus dem Wert abgeleitet — mit zwei Schwellen im Abstand (90 bpm hinauf,
80 bpm hinunter), damit die Anzeige an der Grenze nicht flackert.

**Das ist der Austauschpunkt für M6:** Wer echte Sensordaten anbinden will,
ersetzt hier das Laden der Datei durch den Sensorstrom.

### `js/modell-fix.js`
Zentriert das geladene glTF-Modell um seinen Ursprung und skaliert es auf eine
Zielhöhe in Metern.

Diese Datei löst einen konkreten Fehler. `THREE.Box3.setFromObject()` misst in
**Weltkoordinaten** — solange das Modell im Szenengraph hängt, steckt die
Position aller Eltern mit in der gemessenen Mitte. Wird dieser Wert dann als
*lokale* Position gesetzt, sitzt das Modell zu tief und zu nah, und beim
Skalieren verschiebt es sich, statt sich um die Mitte zu dehnen. Deshalb wird
zum Messen kurz aus dem Szenengraph ausgehängt: ohne Eltern ist der Weltraum
gleich dem lokalen Raum.

### `js/atmung.js`
A-Frame-Component auf dem äußeren Container. Bildet den Puls auf die
Modellgröße ab: Grundgröße folgt der Anspannung, darüber liegt eine kleine
Atembewegung.

Veröffentlicht `atemwert` (0…1), damit Licht und Bodenring im selben Takt
laufen. Diese Component ist auch die einzige, die `datenquelle.update()`
aufruft — würde eine zweite das tun, liefe die Simulation doppelt so schnell.

Die Atemfrequenz folgt der Formel aus Kapitel 11.6.2 der Dokumentation, mit
einem sichtbaren Faktor `tempo` davor. Die dokumentierte Formel bleibt dadurch
im Code stehen und die Abweichung ist erklärbar.

### `js/himmel.js`
Hintergrund. Enthält zwei Dinge: einen eigenen Shader `verlauf` für den
senkrechten Farbverlauf und die Component `himmel-puls`, die die beiden
Verlaufsfarben zwischen Ruhe und Anspannung blendet. *(Kann-Kriterium K1)*

Die Farbpaare haben absichtlich fast dieselbe Helligkeit, damit die Änderung
als Farbton wahrgenommen wird und nicht als Hell/Dunkel — sonst würde sie mit
dem Größeneffekt konkurrieren.

Im Fragment-Shader steht `pow(farbe, vec3(1.0 / 2.2))`. three.js rechnet Farben
intern linear; eigene Shader müssen selbst zurück nach sRGB rechnen, sonst
wirkt der Himmel zu dunkel.

### `js/atem-echo.js`
Zwei kleine Components, die die Szene mitatmen lassen: `atem-licht` am
Umgebungslicht und `atem-ring` am Bodenring. Beide lesen `atemwert` aus
`atmung`, damit es nur einen Takt gibt.

Beide holen sich die `atmung`-Component **einmal** und schreiben danach direkt
auf die three.js-Objekte. Ein `querySelector` und ein `setAttribute` pro Bild
wären 120 DOM-Zugriffe pro Sekunde — am Desktop unauffällig, im Headset nicht.

### `js/ui.js`
Bedienoberfläche. Spricht ausschließlich mit `datenquelle`, nie mit einer
Quelle direkt. Deshalb ändert sich hier nichts, wenn eine weitere Quelle
dazukommt — nur die Anzeigenamen in `QUELLENNAMEN` wachsen mit.

Zeigt außerdem an, wenn sich eine Quelle nicht aktivieren lässt. Ohne das stünde
ein abgelehnter Wechsel nur in der Konsole und der Button wirkte tot.

### `data/puls-kurz.csv`
**Die Standarddatei der Live Simulation.** 72 Werte im Sekundentakt. Derselbe
Bogen wie unten, nur gerafft, damit eine Vorführung nicht fünf Minuten dauert.
Genau deshalb ist er zeitlich nicht physiologisch: ein Puls steigt nicht in
zwölf Sekunden von 62 auf 112.

### `data/puls.csv`
Der realistisch getaktete Verlauf. 300 Werte im Sekundentakt, fünf Minuten:
60 s ruhig um 62 bpm, Anstieg auf 112 bpm, 90 s erhöht, dann langsame
Beruhigung zurück auf 60 bpm.

Die Schwankung ist kein Zufallsrauschen, sondern respiratorische
Sinusarrhythmie (Puls schwankt mit der Atmung) plus Mayer-Wellen der
Blutdruckregulation. Die Amplitude der Sinusarrhythmie sinkt unter Belastung —
das ist physiologisch so.

### `data/puls.json`
Dieselben 300 Werte als JSON. Beleg, dass die Schnittstelle beide Formate
annimmt: `?aufzeichnung=data/puls.json` spielt sie unverändert ab.

### `test/schnittstelle.js`
Prüft beide Quellen ohne Browser. Kein Teil der Anwendung; die Anwendung selbst
braucht weiterhin kein Node.

### `models/lunge.glb`
Das Lungenmodell (Quelle: Sketchfab). Hat einen versetzten Pivot, siehe
`js/modell-fix.js`.

---

## Die Datenquellen-Schnittstelle

*Muss-Kriterium M6. Vollständig dokumentiert im Kopfkommentar von
`js/datenquelle.js`.*

Jede Quelle registriert sich mit `datenquelle.registrieren(name, quelle)` und
stellt bereit:

| Methode | Rückgabe | Bedeutung |
|---|---|---|
| `start()` | — | Wiedergabe beginnen |
| `stop()` | — | Anhalten, letzten Wert behalten |
| `setzeZustand(zustand)` | — | `'rest'` oder `'stress'` anfordern. Eine Quelle mit festem Verlauf darf das folgenlos ignorieren. |
| `laeuft()` | `boolean` | Läuft die Quelle gerade? |
| `update(dt)` | `number` | Nächster Pulswert in bpm, `dt` in Sekunden |
| `getDaten()` | `object` | `{ source, timestamp, heartRate, unit, state }` |

Optional darf eine Quelle `verfuegbar()` anbieten. Meldet sie damit `false`,
verweigert der Umschalter den Wechsel und bleibt auf der bisherigen Quelle.

---

## Datenformate

### JSON

```json
{
  "intervall": 1,
  "einheit": "bpm",
  "werte": [ 62, 61, 63, 64 ]
}
```

`intervall` ist der Abstand zweier Werte in Sekunden.

### CSV

```csv
# Zeilen mit # am Anfang sind Kommentar
zeit,puls
0,62
1,61
2,63
```

Die Spalte `puls` ist Pflicht. Ist `zeit` vorhanden, wird das Intervall aus den
ersten beiden Zeitstempeln bestimmt, sonst wird eine Probe pro Sekunde
angenommen. Die Spaltenreihenfolge spielt keine Rolle.

CSV ist absichtlich dabei, weil Exporte echter Brustgurte und Uhren in aller
Regel CSV sind.

---

## Eine echte Datenquelle anbinden

1. Neue Datei `js/sensor.js` anlegen, die die sechs Methoden oben erfüllt.
   `update(dt)` gibt den zuletzt empfangenen Messwert zurück.
2. Am Ende der Datei registrieren:
   `datenquelle.registrieren('sensor', sensor);`
3. Script-Tag in `index.html` nach `js/datenquelle.js` einhängen.
4. In `js/ui.js` beim Live-Button eintragen, falls er sie ansteuern soll.

Mehr ist nicht nötig. Die Überblendung beim Wechsel greift automatisch, und an
Mapping, Animation oder Pulsanzeige ändert sich nichts. In `js/ui.js` legt der
Live-Button fest, zwischen welchen beiden Quellen er schaltet — dort steht die
einzige Stelle, die Quellen beim Namen nennt.

---

## Test

```
node test/schnittstelle.js
node test/oberflaeche.js
```

`schnittstelle.js` prüft die Datenschicht, 30 Prüfungen. Abgedeckt sind: beide Quellen erfüllen den Vertrag vollständig,
der Wechsel läuft ohne Sprung (größter Wertsprung pro Bild unter 1 bpm), die
Schleife am Dateiende läuft ohne Ruck durch, CSV und JSON werden gleich
interpretiert, und bei fehlender oder defekter Datei fällt die Anwendung sauber
auf die Simulation zurück.

`oberflaeche.js` prüft `js/ui.js` gegen einen minimalen DOM-Ersatz, 25
Prüfungen: Verdrahtung der Buttons, Beschriftung, Sperren beim Umschalten und
das Verhalten bei fehlender Datei.

Beide Tests laden die echten Modul-Dateien in einen `vm`-Kontext und ersetzen
nur `fetch` und das DOM. Es wird also der ausgelieferte Code geprüft, keine
Kopie davon.

Die Trennung hat einen konkreten Anlass: ein Fehler lag genau zwischen beiden
Schichten. Der Quellen-Button meldete beim Start „Aufzeichnung fehlt", obwohl
die Datei einwandfrei lud — `zustandAnzeigen()` läuft synchron, da war der
`fetch` noch unterwegs. Die Datenschicht war fehlerfrei, sichtbar wurde es erst
mit einem DOM.

---

## Bekannte Grenzen

- **Nur über HTTP.** Über `file://` funktionieren weder `fetch` noch das Laden
  des glTF-Modells.
- **Kamerahöhe gilt nur am Bildschirm.** In VR überschreibt WebXR die
  Kamerapose mit der Headset-Position relativ zum Boden. Für den Betrieb im
  Headset wäre ein Rig-Entity um die Kamera nötig.
- **Vignette ist nur am Bildschirm sichtbar.** Sie ist ein DOM-Overlay, und die
  werden im Headset nicht gerendert.
- **Der Atemring ist auf das aktuelle Modell abgestimmt.** Wird `lunge.glb`
  ausgetauscht, passen `radius-inner` und `radius-outer` in `index.html`
  vermutlich nicht mehr.

---

## Technischer Rahmen

A-Frame 1.7.1 (über CDN), WebXR, Vanilla JavaScript. Kein Build-Schritt, keine
Abhängigkeiten außer A-Frame selbst. Kommentare im Code sind deutsch und ohne
Umlaute, damit die Kodierung unter keinen Umständen stört.
