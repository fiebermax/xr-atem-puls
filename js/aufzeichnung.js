// Datenquelle B: spielt eine aufgezeichnete Pulsreihe aus einer Datei ab.
//
// Erfuellt dieselbe Quellen-Schnittstelle wie js/simulation.js und
// registriert sich in js/datenquelle.js unter dem Namen "aufzeichnung".
//
// Diese Datei ist der eigentliche Austauschpunkt fuer Muss-Kriterium M6:
// Wer spaeter echte Sensordaten anbinden will, ersetzt hier das Laden der
// Datei durch den Sensorstrom. Alles andere in der Anwendung bleibt gleich.
//
// UNTERSTUETZTE FORMATE
// Beide werden auf dieselbe interne Form gebracht, danach ist der Rest
// des Moduls formatunabhaengig.
//
//   .json   { "intervall": 1, "einheit": "bpm", "werte": [ 62, 61, ... ] }
//   .csv    Kopfzeile mit den Spalten "zeit" und "puls", eine Probe je
//           Zeile. Zeilen mit # am Anfang gelten als Kommentar.
//
// CSV kann mit, JSON ohne Umweg gelesen werden. Beides ist absichtlich
// dabei, weil Exporte echter Brustgurte und Uhren in aller Regel CSV sind.
//
// Hinweis: die Werte in data/ sind erzeugt, keine echten Messdaten.

// Standardpfad. Zum Testen ohne Codeaenderung per Adresszeile umstellbar:
//   http://localhost:5500/?aufzeichnung=data/puls-kurz.csv
const PFAD = new URLSearchParams(location.search).get('aufzeichnung')
          || 'data/puls.json';

// Schwellen fuer die Ableitung des Zustands aus dem Pulswert. Der Abstand
// zwischen beiden verhindert Flackern, wenn der Wert an der Grenze pendelt.
const SCHWELLE_STRESS = 90;
const SCHWELLE_RUHE   = 80;

const aufzeichnung = {
  werte: [],
  intervall: 1,
  dauer: 0,      // Sekunden fuer einen Durchlauf
  zeit: 0,       // Abspielposition in Sekunden

  zustand: 'stopped',
  puls: 60,

  geladen: false,
  fehler: null,

  laden() {
    return fetch(PFAD)
      .then(antwort => {
        if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
        return antwort.text();
      })
      .then(text => {
        const datei = PFAD.toLowerCase().endsWith('.csv')
          ? this.ausCsv(text)
          : JSON.parse(text);

        this.uebernehmen(datei);

        console.log('Aufzeichnung "' + PFAD + '" geladen: ' + this.werte.length +
                    ' Werte, ' + Math.round(this.dauer) + ' Sekunden.');
      })
      .catch(fehler => {
        this.fehler = fehler.message;
        console.error('Aufzeichnung "' + PFAD + '" nicht ladbar: ' +
                      fehler.message + '. Die Anwendung bleibt bei der Simulation.');
      });
  },

  // Liest CSV in dieselbe Form, die die JSON-Datei direkt mitbringt.
  ausCsv(text) {
    const zeilen = text.split(/\r?\n/)
      .map(z => z.trim())
      .filter(z => z !== '' && z[0] !== '#');   // Leerzeilen und Kommentare weg

    if (zeilen.length < 2) throw new Error('CSV enthaelt keine Datenzeilen');

    const kopf  = zeilen.shift().split(',').map(s => s.trim().toLowerCase());
    const iPuls = kopf.indexOf('puls');
    const iZeit = kopf.indexOf('zeit');

    if (iPuls < 0) throw new Error('CSV braucht eine Spalte "puls"');

    const zeiten = [];
    const werte = zeilen.map(zeile => {
      const felder = zeile.split(',');
      if (iZeit >= 0) zeiten.push(parseFloat(felder[iZeit]));
      return parseFloat(felder[iPuls]);
    });

    // Abstand aus den ersten beiden Zeitstempeln. Ohne Zeitspalte wird
    // eine Probe pro Sekunde angenommen.
    const intervall = zeiten.length > 1 ? zeiten[1] - zeiten[0] : 1;

    return { intervall, einheit: 'bpm', werte };
  },

  uebernehmen(datei) {
    if (!Array.isArray(datei.werte) || datei.werte.length < 2) {
      throw new Error('Feld "werte" fehlt oder enthaelt zu wenige Eintraege');
    }
    if (!datei.werte.every(Number.isFinite)) {
      throw new Error('Feld "werte" enthaelt Eintraege, die keine Zahl sind');
    }

    this.werte     = datei.werte;
    this.intervall = datei.intervall > 0 ? datei.intervall : 1;
    this.dauer     = this.werte.length * this.intervall;
    this.puls      = this.werte[0];
    this.geladen   = true;
  },

  // Der Umschalter fragt das ab und verweigert den Wechsel, wenn die
  // Datei fehlt oder kaputt ist.
  verfuegbar() {
    return this.geladen;
  },

  // Grund, falls das Laden fehlgeschlagen ist, sonst null. Bewusst getrennt
  // von verfuegbar(): waehrend der fetch noch laeuft, ist die Quelle nicht
  // verfuegbar, aber auch nicht gestoert. Ohne diese Unterscheidung meldet
  // die Bedienleiste beim Start einen Fehler, den es gar nicht gibt.
  stoerung() {
    return this.fehler;
  },

  // Beginnt den Verlauf wieder am ruhigen Anfang, damit jede Vorfuehrung
  // denselben Bogen zeigt.
  start() {
    this.zustand = 'rest';
    this.zeit = 0;
  },

  stop() {
    this.zustand = 'stopped';
  },

  // Ohne Wirkung: der Verlauf steht in der Datei fest. Die Methode gehoert
  // trotzdem zur Schnittstelle, damit die Bedienoberflaeche nicht wissen
  // muss, welche Quelle gerade aktiv ist.
  setzeZustand() {},

  laeuft() {
    return this.zustand !== 'stopped';
  },

  getDaten() {
    return {
      source: 'aufzeichnung',
      timestamp: Date.now(),
      heartRate: Math.round(this.puls),
      unit: 'bpm',
      state: this.zustand
    };
  },

  update(deltaZeit) {
    if (!this.laeuft() || !this.geladen) return this.puls;

    // Am Ende der Aufzeichnung von vorn beginnen
    this.zeit = (this.zeit + deltaZeit) % this.dauer;

    // Index aus der verstrichenen Zeit rechnen und zwischen den beiden
    // benachbarten Werten interpolieren, damit der Verlauf nicht stuft.
    const genau  = this.zeit / this.intervall;
    const index  = Math.floor(genau);
    const anteil = genau - index;

    const a = this.werte[index];
    const b = this.werte[(index + 1) % this.werte.length];   // Uebergang in die Schleife

    this.puls = a + (b - a) * anteil;
    this.zustand = this.zustandAus(this.puls);

    return this.puls;
  },

  // Die Datei enthaelt nur Pulswerte, der Zustand wird daraus abgeleitet.
  zustandAus(bpm) {
    if (this.zustand === 'stress') {
      return bpm < SCHWELLE_RUHE ? 'rest' : 'stress';
    }
    return bpm > SCHWELLE_STRESS ? 'stress' : 'rest';
  }
};

datenquelle.registrieren('aufzeichnung', aufzeichnung);

// Im Hintergrund laden, damit das Umschalten spaeter ohne Wartezeit geht.
//
// Bewusst NICHT gleich aktiv schalten. Bei laufender Wiedergabe sind Ruhe
// und Anspannung gesperrt - startet die Anwendung von sich aus in diesem
// Modus, wirken zwei Buttons von Anfang an tot, ohne dass jemand das
// ausgeloest hat. Die Wiedergabe beginnt deshalb erst auf Knopfdruck.
aufzeichnung.laden();
