// Bedienoberflaeche: ruft ausschliesslich Zustandsfunktionen auf.

const elStart        = document.getElementById('btn-los');
const elStartbild    = document.getElementById('startbildschirm');
const elPuls         = document.getElementById('pulsanzeige');
const elLeiste       = document.getElementById('bedienleiste');
const elStartStopp   = document.getElementById('btn-startstopp');
const elRuhe         = document.getElementById('btn-ruhe');
const elAnspannung   = document.getElementById('btn-anspannung');

function zustandAnzeigen() {
  elRuhe.classList.toggle('aktiv', simulation.zustand === 'rest');
  elAnspannung.classList.toggle('aktiv', simulation.zustand === 'stress');
  elStartStopp.textContent = simulation.laeuft() ? 'Stopp' : 'Start';
}

elStart.addEventListener('click', () => {
  elStartbild.classList.add('versteckt');
  elPuls.classList.remove('versteckt');
  elLeiste.classList.remove('versteckt');
  simulation.start();
  zustandAnzeigen();
});

elStartStopp.addEventListener('click', () => {
  if (simulation.laeuft()) {
    simulation.stop();
  } else {
    simulation.start();
  }
  zustandAnzeigen();
});

elRuhe.addEventListener('click', () => {
  simulation.setzeZustand('rest');
  zustandAnzeigen();
});

elAnspannung.addEventListener('click', () => {
  simulation.setzeZustand('stress');
  zustandAnzeigen();
});

// Pulsanzeige aktualisieren
setInterval(() => {
  elPuls.textContent = simulation.laeuft()
    ? Math.round(simulation.puls) + ' bpm'
    : '– bpm';
}, 200);