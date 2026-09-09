// Datenquelle A: erzeugt einen plausiblen Herzfrequenzverlauf per Formel.
//
// Erfuellt die Quellen-Schnittstelle aus js/datenquelle.js und registriert
// sich dort unter dem Namen "simulation". Sie ist die Standardquelle, weil
// sie ohne Datei und ohne Server auskommt.

// Aeusserste Grenzen, auf die der ausgegebene Wert geklemmt wird. Sie sind
// bewusst weiter gefasst als die beiden Zielwerte unten: die natuerliche
// Schwankung darf ueber 60 bzw. 110 bpm hinausgehen, ein unplausibler Wert
// aber nicht.
const HR_MIN = 50;
const HR_MAX = 120;

// Zielwerte der beiden Zustaende. Der Bereich liegt in datenquelle.js,
// damit Formel, Aufzeichnung und Darstellung dieselbe Skala benutzen.
const ZIELWERTE = {
  rest:   datenquelle.bereich.ruhe,     // Zustand "Ruhe"
  stress: datenquelle.bereich.stress    // Zustand "Anspannung"
};

const UEBERGANGSDAUER = 10;   // Sekunden fuer den vollen Bereich
const SCHWANKUNG      = 2.5;  // maximale Abweichung in bpm

const simulation = {
  zustand: 'stopped',
  letzterZustand: 'rest',
  basispuls: ZIELWERTE.rest,   // geglaetteter Wert ohne Schwankung
  puls: ZIELWERTE.rest,        // ausgegebener Wert inkl. Schwankung
  rauschzeit: 0,

  // Nimmt den Zustand von vor dem Stopp wieder auf.
  start() {
    this.zustand = this.letzterZustand;
  },

  // Der laufende Zustand wird gemerkt, damit Start dort weitermacht, wo
  // Stopp aufgehoert hat, statt immer bei "Ruhe" zu beginnen.
  stop() {
    if (this.zustand !== 'stopped') this.letzterZustand = this.zustand;
    this.zustand = 'stopped';
  },

  // Im Zustand "stopped" wirkungslos: erst starten, dann steuern.
  setzeZustand(neuerZustand) {
    if (this.zustand === 'stopped') return;
    this.zustand = neuerZustand;
  },

  laeuft() {
    return this.zustand !== 'stopped';
  },

  // Liefert das Datenobjekt der Schnittstelle (Dokumentation Kapitel 13)
  getDaten() {
    return {
      source: 'simulation',
      timestamp: Date.now(),
      heartRate: Math.round(this.puls),
      unit: 'bpm',
      state: this.zustand
    };
  },

  update(deltaZeit) {
    if (!this.laeuft()) return this.puls;

    // Gleitende Annaeherung an den Zielwert. UEBERGANGSDAUER gilt fuer den
    // vollen Bereich HR_MIN bis HR_MAX. Der Weg von 60 auf 110 bpm ist nur
    // ein Teil davon und dauert deshalb rund sieben statt zehn Sekunden.
    const ziel = ZIELWERTE[this.zustand];
    const schritt = (HR_MAX - HR_MIN) / UEBERGANGSDAUER * deltaZeit;

    if (Math.abs(ziel - this.basispuls) <= schritt) {
      this.basispuls = ziel;
    } else {
      this.basispuls += Math.sign(ziel - this.basispuls) * schritt;
    }

    // natuerliche Schwankung: zwei ueberlagerte langsame Schwingungen
    this.rauschzeit += deltaZeit;
    const rauschen =
      Math.sin(this.rauschzeit * 0.7) * 0.6 +
      Math.sin(this.rauschzeit * 2.3) * 0.4;

    this.puls = this.basispuls + rauschen * SCHWANKUNG;
    this.puls = Math.min(HR_MAX, Math.max(HR_MIN, this.puls));

    return this.puls;
  }
};

datenquelle.registrieren('simulation', simulation);
