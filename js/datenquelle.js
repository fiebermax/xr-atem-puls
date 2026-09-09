// Schnittstelle und Umschalter fuer Pulsdatenquellen (Muss-Kriterium M6).
//
// Die Anwendung spricht ausschliesslich dieses Modul an, nie eine Quelle
// direkt. Dadurch laesst sich die Herkunft der Werte austauschen, ohne dass
// Mapping, Animation oder Bedienoberflaeche davon etwas mitbekommen.
//
// SCHNITTSTELLE EINER QUELLE
// Jede Quelle registriert sich mit datenquelle.registrieren(name, quelle)
// und stellt bereit:
//
//   start()                 Wiedergabe beginnen
//   stop()                  Wiedergabe anhalten, letzten Wert behalten
//   setzeZustand(zustand)   'rest' oder 'stress' anfordern; eine Quelle mit
//                           festem Verlauf darf das folgenlos ignorieren
//   laeuft()      -> bool   laeuft die Quelle gerade
//   update(dt)    -> Zahl   naechster Pulswert in bpm, dt in Sekunden
//   getDaten()    -> Objekt { source, timestamp, heartRate, unit, state }
//
// Optional darf eine Quelle verfuegbar() anbieten. Meldet sie damit false,
// verweigert der Umschalter den Wechsel und bleibt auf der bisherigen Quelle.
//
// Nicht Teil der Quellen-Schnittstelle ist anteil(). Das ist eine reine
// Darstellungsgroesse und liegt deshalb hier, damit jede kuenftige Quelle
// nur Rohwerte liefern muss.

// Projektkonstante: Pulsbereich, auf den die Darstellung abbildet.
// Beide Quellen richten sich danach.
const BEREICH = { ruhe: 60, stress: 110 };

// Sekunden, ueber die nach einem Quellenwechsel ueberblendet wird.
const UEBERBLENDUNG = 2.5;

const datenquelle = {
  quellen: {},
  aktiv: null,
  name: null,

  puls: BEREICH.ruhe,
  bereich: BEREICH,

  // Ueberblendung nach einem Wechsel
  blendeVon: BEREICH.ruhe,
  blendeRest: 0,

  registrieren(name, quelle) {
    this.quellen[name] = quelle;
    if (!this.aktiv) {
      this.aktiv = quelle;
      this.name  = name;
    }
  },

  // Wechselt die aktive Quelle. Gibt zurueck, ob der Wechsel geklappt hat.
  wechseln(name) {
    const neu = this.quellen[name];

    if (!neu) {
      console.warn('Datenquelle "' + name + '" ist nicht registriert.');
      return false;
    }
    if (neu === this.aktiv) return true;

    if (typeof neu.verfuegbar === 'function' && !neu.verfuegbar()) {
      console.warn('Datenquelle "' + name + '" ist nicht verfuegbar, ' +
                   'bleibe bei "' + this.name + '".');
      return false;
    }

    // Laufzustand mitnehmen, damit der Wechsel die Wiedergabe nicht abbricht
    const lief = this.aktiv.laeuft();

    this.aktiv.stop();
    this.aktiv = neu;
    this.name  = name;
    if (lief) neu.start();

    // Ab dem letzten ausgegebenen Wert weiterblenden statt springen
    this.blendeVon  = this.puls;
    this.blendeRest = UEBERBLENDUNG;

    return true;
  },

  // Reihum durch alle registrierten Quellen
  naechste() {
    const namen = Object.keys(this.quellen);
    const i = namen.indexOf(this.name);
    return this.wechseln(namen[(i + 1) % namen.length]);
  },

  // Meldet, ob die aktive Quelle auf setzeZustand reagiert. Eine Quelle mit
  // festem Verlauf tut das nicht und sagt das ueber steuerbar: false.
  steuerbar() {
    return this.aktiv.steuerbar !== false;
  },

  start()               { this.aktiv.start(); },
  stop()                { this.aktiv.stop(); },
  setzeZustand(zustand) { this.aktiv.setzeZustand(zustand); },
  laeuft()              { return this.aktiv.laeuft(); },
  getDaten()            { return this.aktiv.getDaten(); },

  update(deltaZeit) {
    const roh = this.aktiv.update(deltaZeit);

    if (this.blendeRest > 0) {
      this.blendeRest = Math.max(0, this.blendeRest - deltaZeit);

      // 0 direkt nach dem Wechsel, 1 am Ende der Ueberblendung
      const x = 1 - this.blendeRest / UEBERBLENDUNG;
      const weich = x * x * (3 - 2 * x);

      this.puls = this.blendeVon + (roh - this.blendeVon) * weich;
    } else {
      this.puls = roh;
    }

    return this.puls;
  },

  // Meldet den Namen einer registrierten Quelle, die sich nicht aktivieren
  // laesst, sonst null. Damit kann die Oberflaeche einen Ladefehler zeigen,
  // statt ihn nur in die Konsole zu schreiben.
  stoerung() {
    for (const [name, quelle] of Object.entries(this.quellen)) {
      if (typeof quelle.stoerung === 'function' && quelle.stoerung()) {
        return name;
      }
    }
    return null;
  },

  // Normierte Anspannung: 0 beim Ruhepuls, 1 beim Anspannungspuls.
  // Gemeinsame Skala fuer Modellgroesse und Hintergrundfarbe.
  anteil() {
    const spanne = BEREICH.stress - BEREICH.ruhe;
    return Math.min(1, Math.max(0, (this.puls - BEREICH.ruhe) / spanne));
  }
};
