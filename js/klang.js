// Ein ruhiger Ton, der mit dem Modell atmet.
//
// Dritter Abnehmer desselben Taktes: atmung veroeffentlicht atemwert, und
// Licht (atem-licht), Bodenring (atem-ring) und dieser Klang lesen ihn. Es
// gibt also nur eine Quelle fuer den Rhythmus, nichts kann auseinanderlaufen.
//
// Erzeugt statt einer Audiodatei zwei leicht gegeneinander verstimmte
// Sinustoene. Die Verstimmung ergibt eine langsame Schwebung, das klingt
// waermer als ein einzelner Ton und braucht keine externe Datei - also auch
// keine Lizenzangabe in der Dokumentation.
//
// Beim Einatmen wird der Ton lauter und das Filter oeffnet sich, beim
// Ausatmen geht beides zurueck. Mit steigender Anspannung hebt sich die
// Tonhoehe leicht an.

// 220 Hz statt der tieferen Oktave: eingebaute Laptoplautsprecher geben
// unterhalb von rund 200 Hz kaum noch etwas her, und ein reiner Sinus hat
// keine Obertoene, ueber die sie die Tonhoehe sonst noch andeuten koennten.
const GRUNDTON    = 220;    // Hz, A3
const SCHWEBUNG   = 1.004;  // Verstimmung des zweiten Oszillators
const LAUTSTAERKE = 0.22;   // Obergrenze

// Dreieck statt Sinus, aus demselben Grund: die ungeraden Obertoene machen
// den Ton auf kleinen Lautsprechern ueberhaupt erst hoerbar. Der Tiefpass
// nimmt ihnen danach die Schaerfe wieder.
const WELLENFORM  = 'triangle';

const klang = {
  ctx: null,
  bereit: false,
  an: true,        // Schalter in der Bedienleiste

  meister: null,
  filter: null,

  // Browser lassen Audio erst nach einer Nutzergeste zu. Diese Methode wird
  // deshalb aus dem Klick auf Start aufgerufen, nicht beim Laden.
  aufbauen() {
    if (this.bereit || !this.verfuegbar()) return;

    try {
      const AudioKlasse = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioKlasse();

      // Tiefpass nimmt den Obertoenen die Schaerfe und oeffnet sich
      // beim Einatmen ein Stueck weit.
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 500;
      this.filter.Q.value = 0.7;

      this.meister = this.ctx.createGain();
      this.meister.gain.value = 0;          // beginnt still

      this.oszA = this.ctx.createOscillator();
      this.oszB = this.ctx.createOscillator();
      this.oszA.type = this.oszB.type = WELLENFORM;
      this.oszA.frequency.value = GRUNDTON;
      this.oszB.frequency.value = GRUNDTON * SCHWEBUNG;

      this.oszA.connect(this.filter);
      this.oszB.connect(this.filter);
      this.filter.connect(this.meister);
      this.meister.connect(this.ctx.destination);

      this.oszA.start();
      this.oszB.start();
      this.bereit = true;

      // Ein frisch erzeugter AudioContext kann trotz Nutzergeste im Zustand
      // "suspended" starten. Dann laeuft alles korrekt, es kommt nur nichts
      // aus den Lautsprechern - und zwar ohne jede Fehlermeldung. Deshalb
      // immer aufwecken und den Zustand melden.
      if (typeof this.ctx.resume === 'function') {
        this.ctx.resume().then(
          () => console.log('Klang bereit, AudioContext:', this.ctx.state),
          f  => console.warn('AudioContext liess sich nicht starten:', f)
        );
      }
    } catch (fehler) {
      // Kein Ton ist kein Grund, die Anwendung anzuhalten.
      console.warn('Klang nicht verfuegbar:', fehler.message);
      this.bereit = false;
    }
  },

  verfuegbar() {
    return typeof window !== 'undefined' &&
           !!(window.AudioContext || window.webkitAudioContext);
  },

  umschalten() {
    this.an = !this.an;
    return this.an;
  },

  // Wird in jedem Bild aufgerufen. atemwert und anteil laufen von 0 bis 1.
  setzen(atemwert, anteil, laeuft) {
    if (!this.bereit) return;

    // Stumm, solange nichts laeuft oder der Ton abgeschaltet ist. Der Wert
    // wandert dann auf 0 zu, statt hart abzureissen.
    const ziel = (this.an && laeuft) ? LAUTSTAERKE * (0.25 + atemwert * 0.75) : 0;

    // Direktes Setzen reicht: bei 60 Bildern je Sekunde sind die Schritte
    // so klein, dass nichts knackt.
    this.meister.gain.value += (ziel - this.meister.gain.value) * 0.08;

    // Filter oeffnet sich mit dem Einatmen
    this.filter.frequency.value = 500 + atemwert * 1300;

    // Anspannung hebt die Tonhoehe um knapp einen Ganzton an
    const hoehe = GRUNDTON * (1 + anteil * 0.12);
    this.oszA.frequency.value = hoehe;
    this.oszB.frequency.value = hoehe * SCHWEBUNG;
  }
};

// Die Ankopplung an die Szene. Nur registrieren, wenn A-Frame da ist -
// der Test in test/oberflaeche.js laedt diese Datei ohne Szene.
if (typeof AFRAME !== 'undefined') {
  // Gehoert auf dieselbe Entity wie atmung. Dann liegt der Atemwert direkt
  // nebenan und muss nicht gesucht werden - und es ist sichergestellt, dass
  // tick ueberhaupt laeuft, denn atmung tickt auf dieser Entity ja bereits.
  AFRAME.registerComponent('atem-klang', {
    tick: function () {
      if (!klang.bereit) return;

      const atmung = this.el.components.atmung;
      if (!atmung) return;

      klang.setzen(atmung.atemwert, datenquelle.anteil(), datenquelle.laeuft());
    }
  });
}
