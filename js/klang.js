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

const GRUNDTON    = 110;    // Hz, tiefes A
const SCHWEBUNG   = 1.004;  // Verstimmung des zweiten Oszillators
const LAUTSTAERKE = 0.14;   // Obergrenze, bewusst leise

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
      this.filter.frequency.value = 300;
      this.filter.Q.value = 0.7;

      this.meister = this.ctx.createGain();
      this.meister.gain.value = 0;          // beginnt still

      this.oszA = this.ctx.createOscillator();
      this.oszB = this.ctx.createOscillator();
      this.oszA.type = this.oszB.type = 'sine';
      this.oszA.frequency.value = GRUNDTON;
      this.oszB.frequency.value = GRUNDTON * SCHWEBUNG;

      this.oszA.connect(this.filter);
      this.oszB.connect(this.filter);
      this.filter.connect(this.meister);
      this.meister.connect(this.ctx.destination);

      this.oszA.start();
      this.oszB.start();

      this.bereit = true;
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
    this.filter.frequency.value = 300 + atemwert * 420;

    // Anspannung hebt die Tonhoehe um knapp einen Ganzton an
    const hoehe = GRUNDTON * (1 + anteil * 0.12);
    this.oszA.frequency.value = hoehe;
    this.oszB.frequency.value = hoehe * SCHWEBUNG;
  }
};

// Die Ankopplung an die Szene. Nur registrieren, wenn A-Frame da ist -
// der Test in test/oberflaeche.js laedt diese Datei ohne Szene.
if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('atem-klang', {
    tick: function () {
      if (!klang.bereit) return;

      // Die atmung-Component einmal suchen und merken, wie in atem-echo.js.
      if (!this.atmung) {
        const traeger = this.el.sceneEl.querySelector('[atmung]');
        if (!traeger || !traeger.components.atmung) return;
        this.atmung = traeger.components.atmung;
      }

      klang.setzen(this.atmung.atemwert, datenquelle.anteil(), datenquelle.laeuft());
    }
  });
}
