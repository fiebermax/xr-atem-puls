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
const elLive         = document.getElementById('btn-live');
const elLiveStatus   = document.getElementById('live-status');

function zustandAnzeigen() {
  const daten = datenquelle.getDaten();

  elRuhe.classList.toggle('aktiv', daten.state === 'rest');
  elAnspannung.classList.toggle('aktiv', daten.state === 'stress');
  elStartStopp.textContent = datenquelle.laeuft() ? 'Stopp' : 'Start';

  // Ein fehlgeschlagener Ladeversuch darf nicht nur in der Konsole stehen,
  // sonst wirkt ein abgelehnter Klick wie ein toter Button.
  const gestoert = datenquelle.stoerung();
  const an       = datenquelle.name === 'aufzeichnung';

  elLive.textContent = gestoert ? 'Live Simulation: Datei fehlt'
                                : 'Live Simulation';
  elLive.classList.toggle('stoerung', gestoert !== null);
  elLive.classList.toggle('aktiv', an);

  // Anzeige oben rechts. Sagt in Worten, was die gruene Markierung unten
  // in der Leiste nur farblich zeigt.
  elLiveStatus.textContent = gestoert
    ? 'Live Simulation: Datei fehlt'
    : 'Live Simulation: ' + (an ? 'an' : 'aus');

  elLiveStatus.classList.toggle('stoerung', gestoert !== null);
  elLiveStatus.classList.toggle('an', an && !gestoert);
}

// Schaltet die Wiedergabe der CSV-Werte ein und aus. wechseln() kann
// ablehnen, etwa wenn die Datei nicht geladen wurde. Die Anzeige wird
// deshalb immer aus dem tatsaechlichen Zustand neu gesetzt und nie aus der
// Annahme, der Klick haette gewirkt.
function liveUmschalten() {
  datenquelle.wechseln(
    datenquelle.name === 'aufzeichnung' ? 'simulation' : 'aufzeichnung'
  );
  zustandAnzeigen();
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
  elLiveStatus.classList.remove('versteckt');
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

elLive.addEventListener('click', liveUmschalten);
elLiveStatus.addEventListener('click', liveUmschalten);

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
