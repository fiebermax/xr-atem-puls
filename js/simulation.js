// Simulationsmodul: erzeugt einen plausiblen Herzfrequenzverlauf.
// Austauschpunkt fuer eine reale Datenquelle, siehe Dokumentation Kapitel 13.

const HR_MIN = 50;
const HR_MAX = 120;

const ZIELWERTE = {
  rest:   60,   // Zustand "Ruhe"
  stress: 110   // Zustand "Anspannung"
};

const UEBERGANGSDAUER = 10;   // Sekunden fuer den vollen Bereich
const SCHWANKUNG      = 2.5;  // maximale Abweichung in bpm

const simulation = {
  zustand: 'stopped',
  letzterZustand: 'rest',
  basispuls: 60,   // geglaetteter Wert ohne Schwankung
  puls: 60,        // ausgegebener Wert inkl. Schwankung
  rauschzeit: 0,

  start() {
    this.zustand = this.letzterZustand;
  },

  stop() {
    if (this.zustand !== 'stopped') this.letzterZustand = this.zustand;
    this.zustand = 'stopped';
  },

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

    // gleitende Annaeherung an den Zielwert
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