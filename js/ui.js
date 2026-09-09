// Bedienoberflaeche: ruft ausschliesslich Zustandsfunktionen auf.
//
// Spricht nie eine Quelle direkt an, sondern immer den Umschalter in
// js/datenquelle.js. Deshalb aendert sich an dieser Datei nichts, wenn
// eine weitere Quelle dazukommt - nur die Beschriftung unten waechst mit.

const elStart        = document.getElementById('btn-los');
const elStartbild    = document.getElementById('startbildschirm');
const elPuls         = document.getElementById('pulsanzeige');
const elLeiste       = document.getElementById('bedienleiste');
const elStartStopp   = document.getElementById('btn-startstopp');
const elRuhe         = document.getElementById('btn-ruhe');
const elAnspannung   = document.getElementById('btn-anspannung');
const elQuelle       = document.getElementById('btn-quelle');

// Anzeigenamen der registrierten Quellen
const QUELLENNAMEN = {
  simulation:   'Simulation',
  aufzeichnung: 'Aufzeichnung'
};

function zustandAnzeigen() {
  const daten = datenquelle.getDaten();

  elRuhe.classList.toggle('aktiv', daten.state === 'rest');
  elAnspannung.classList.toggle('aktiv', daten.state === 'stress');
  elStartStopp.textContent = datenquelle.laeuft() ? 'Stopp' : 'Start';

  // Ein fehlgeschlagener Ladeversuch darf nicht nur in der Konsole stehen,
  // sonst wirkt ein abgelehnter Wechsel wie ein toter Button.
  const gestoert = datenquelle.stoerung();

  elQuelle.textContent = gestoert
    ? 'Quelle: ' + (QUELLENNAMEN[gestoert] || gestoert) + ' fehlt'
    : 'Quelle: ' + (QUELLENNAMEN[datenquelle.name] || datenquelle.name);

  elQuelle.classList.toggle('stoerung', gestoert !== null);
}

// Ruhe und Anspannung. Laeuft gerade die Aufzeichnung, reagiert die nicht auf
// setzeZustand - dann wird zuerst auf die steuerbare Quelle gewechselt. Wer
// Anspannung drueckt, will Anspannung sehen und nicht einen toten Button.
function zustandAnfordern(zustand) {
  if (!datenquelle.steuerbar()) datenquelle.wechseln('simulation');
  datenquelle.setzeZustand(zustand);
  zustandAnzeigen();
}

elStart.addEventListener('click', () => {
  // Erst ausblenden, danach aus dem Layout nehmen. Die Bedienelemente
  // liegen schon darunter bereit und werden vom Verlauf freigelegt.
  elStartbild.classList.add('weg');
  setTimeout(() => elStartbild.classList.add('versteckt'), 800);

  elPuls.classList.remove('versteckt');
  elLeiste.classList.remove('versteckt');
  datenquelle.start();
  zustandAnzeigen();
});

elStartStopp.addEventListener('click', () => {
  if (datenquelle.laeuft()) {
    datenquelle.stop();
  } else {
    datenquelle.start();
  }
  zustandAnzeigen();
});

elRuhe.addEventListener('click',       () => zustandAnfordern('rest'));
elAnspannung.addEventListener('click', () => zustandAnfordern('stress'));

elQuelle.addEventListener('click', () => {
  // naechste() kann ablehnen, etwa wenn data/puls.json nicht geladen wurde.
  // Die Beschriftung wird deshalb immer aus dem tatsaechlichen Zustand neu
  // gesetzt und nie aus der Annahme, der Wechsel haette geklappt.
  datenquelle.naechste();
  zustandAnzeigen();
});

// Pulsanzeige aktualisieren
setInterval(() => {
  elPuls.textContent = datenquelle.laeuft()
    ? Math.round(datenquelle.puls) + ' bpm'
    : '– bpm';

  // Bei der Aufzeichnung wechselt der Zustand ohne Klick, weil er aus der
  // Datei abgeleitet wird. Die Anzeige muss deshalb mitziehen.
  zustandAnzeigen();
}, 200);

zustandAnzeigen();
