// Prueft die Datenquellen-Schnittstelle aus js/datenquelle.js ohne Browser.
//
// Beleg fuer Muss-Kriterium M6: beide Quellen erfuellen denselben Vertrag,
// der Wechsel laeuft ohne Sprung, und bei einem Ladefehler faellt die
// Anwendung sauber auf die Simulation zurueck.
//
// Aufruf aus dem Projektordner:   node test/schnittstelle.js
//
// Kein Teil der Anwendung. Die Anwendung selbst braucht weiterhin kein
// Node und keinen Build-Schritt.

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const WURZEL = path.join(__dirname, '..');

// Die Module deklarieren ihre Objekte mit const auf oberster Ebene. Die
// landen nicht am globalen Objekt, sind aber - genau wie im Browser
// zwischen klassischen Scripts - fuer die anderen Dateien sichtbar.
// Deshalb werden sie ueber den Kontext ausgelesen, nicht als Property.
function laden(fetchImpl, suche) {
  const ctx = vm.createContext({
    console,
    fetch: fetchImpl,
    URLSearchParams,
    location: { search: suche || '' }
  });

  for (const datei of ['js/datenquelle.js', 'js/simulation.js', 'js/aufzeichnung.js']) {
    vm.runInContext(fs.readFileSync(path.join(WURZEL, datei), 'utf8'), ctx,
                    { filename: datei });
  }

  return {
    dq:  vm.runInContext('datenquelle', ctx),
    auf: vm.runInContext('aufzeichnung', ctx)
  };
}

// Ersetzt fetch durch einen Zugriff auf das Dateisystem.
const vonPlatte = (pfad) => {
  const voll = path.join(WURZEL, pfad);
  if (!fs.existsSync(voll)) return Promise.resolve({ ok: false, status: 404 });
  return Promise.resolve({
    ok: true, status: 200,
    text: () => Promise.resolve(fs.readFileSync(voll, 'utf8'))
  });
};

const nichtGefunden = () => Promise.resolve({ ok: false, status: 404 });

// CSV, in der die Spalte "puls" fehlt
const kaputt = () => Promise.resolve({
  ok: true, status: 200,
  text: () => Promise.resolve('zeit,herzschlag\n0,62\n1,63\n')
});

let fehlgeschlagen = 0;

function pruefe(name, bedingung, zusatz) {
  console.log((bedingung ? '  OK   ' : '  FEHL ') + name + (zusatz ? '   ' + zusatz : ''));
  if (!bedingung) fehlgeschlagen++;
}

const DT = 1 / 60;   // ein Bild bei 60 Hz

function fahren(dq, sekunden, sammler) {
  for (let i = 0; i < Math.round(sekunden / DT); i++) {
    dq.update(DT);
    if (sammler) sammler(dq.puls);
  }
}

function groessterSchritt(werte) {
  let m = 0;
  for (let i = 1; i < werte.length; i++) m = Math.max(m, Math.abs(werte[i] - werte[i - 1]));
  return m;
}

(async () => {

  console.log('\n--- Startquelle ---');
  const { dq, auf } = laden(vonPlatte);

  // Waehrend der fetch laeuft, ist die Aufzeichnung nicht verfuegbar, aber
  // auch nicht kaputt. Wird das verwechselt, meldet die Bedienleiste beim
  // Start einen Fehler, den es gar nicht gibt.
  pruefe('waehrend des Ladens keine Stoerung', dq.stoerung() === null);

  await auf.laden();
  await new Promise(r => setTimeout(r, 0));   // automatischen Wechsel abwarten

  pruefe('beide Quellen registriert',
         Object.keys(dq.quellen).join(',') === 'simulation,aufzeichnung');
  pruefe('nach dem Laden spielt die Aufzeichnung', dq.name === 'aufzeichnung');
  pruefe('nach dem Laden keine Stoerung', dq.stoerung() === null);
  pruefe('Aufzeichnung meldet sich als nicht steuerbar', dq.steuerbar() === false);

  console.log('\n--- Simulation ---');
  dq.wechseln('simulation');
  pruefe('Simulation ist steuerbar', dq.steuerbar() === true);
  dq.start();
  fahren(dq, 15);
  pruefe('Ruhe naehert sich 60 bpm', Math.abs(dq.puls - 60) < 4, dq.puls.toFixed(1));

  dq.setzeZustand('stress');
  fahren(dq, 14);
  pruefe('Anspannung naehert sich 110 bpm', Math.abs(dq.puls - 110) < 4, dq.puls.toFixed(1));
  pruefe('anteil() bei Anspannung nahe 1', dq.anteil() > 0.9, dq.anteil().toFixed(2));

  console.log('\n--- Vertrag M6 ---');
  for (const [name, quelle] of Object.entries(dq.quellen)) {
    pruefe(name + ': alle sechs Methoden vorhanden',
           ['start', 'stop', 'setzeZustand', 'laeuft', 'update', 'getDaten']
             .every(m => typeof quelle[m] === 'function'));

    const daten = quelle.getDaten();
    pruefe(name + ': getDaten vollstaendig',
           ['source', 'timestamp', 'heartRate', 'unit', 'state'].every(k => k in daten),
           JSON.stringify(daten));
  }

  console.log('\n--- Wechsel ohne Sprung ---');
  const verlauf = [];
  fahren(dq, 0.5, v => verlauf.push(v));
  const vorher = dq.puls;

  pruefe('Wechsel zur Aufzeichnung akzeptiert', dq.wechseln('aufzeichnung') === true);
  fahren(dq, 4, v => verlauf.push(v));

  pruefe('groesster Wertsprung pro Bild unter 1 bpm', groessterSchritt(verlauf) < 1.0,
         groessterSchritt(verlauf).toFixed(3) + ' bpm');
  pruefe('von ' + vorher.toFixed(1) + ' auf ' + dq.puls.toFixed(1) + ' bpm geblendet',
         Math.abs(dq.puls - vorher) > 20);
  pruefe('Wiedergabe beginnt am ruhigen Anfang', auf.zeit < 6, auf.zeit.toFixed(1) + ' s');

  console.log('\n--- Wiedergabe data/puls.json ---');
  pruefe('300 Werte, 300 Sekunden', auf.werte.length === 300 && auf.dauer === 300);

  const vorSetz = dq.puls;
  dq.setzeZustand('stress');
  dq.update(DT);
  pruefe('setzeZustand bleibt wirkungslos', Math.abs(dq.puls - vorSetz) < 2);

  let min = Infinity, max = -Infinity, sahStress = false, sahRuhe = false;
  const proben = [];

  for (let i = 0; i < Math.round(620 / DT); i++) {     // gut zwei Durchlaeufe
    dq.update(DT);
    min = Math.min(min, dq.puls);
    max = Math.max(max, dq.puls);
    const zustand = dq.getDaten().state;
    if (zustand === 'stress') sahStress = true;
    if (zustand === 'rest')   sahRuhe   = true;
    proben.push(dq.puls);
  }

  pruefe('Werte im plausiblen Bereich', min > 50 && max < 125,
         min.toFixed(0) + ' bis ' + max.toFixed(0) + ' bpm');
  pruefe('Zustand wird aus dem Puls abgeleitet', sahStress && sahRuhe);
  pruefe('Schleife laeuft ohne Ruck durch', groessterSchritt(proben) < 0.4,
         'groesster Schritt ' + groessterSchritt(proben).toFixed(3) + ' bpm/Bild');

  pruefe('Rueckwechsel zur Simulation', dq.wechseln('simulation') === true);
  pruefe('Laufzustand ueberlebt den Wechsel', dq.laeuft() === true);

  console.log('\n--- Wiedergabe data/puls-kurz.csv ---');
  const csv = laden(vonPlatte, '?aufzeichnung=data/puls-kurz.csv');
  await csv.auf.laden();

  pruefe('CSV geladen', csv.auf.geladen === true,
         csv.auf.werte.length + ' Werte, ' + csv.auf.dauer + ' s');
  pruefe('Kommentarzeilen uebersprungen', csv.auf.werte.length === 72);
  pruefe('Intervall aus der Zeitspalte erkannt', csv.auf.intervall === 1);
  pruefe('nur Zahlen eingelesen', csv.auf.werte.every(Number.isFinite));

  csv.dq.start();
  csv.dq.wechseln('aufzeichnung');

  const csvProben = [];
  let csvStress = false, csvRuhe = false;

  for (let i = 0; i < Math.round(160 / DT); i++) {     // gut zwei Durchlaeufe
    csv.dq.update(DT);
    csvProben.push(csv.dq.puls);
    const z = csv.dq.getDaten().state;
    if (z === 'stress') csvStress = true;
    if (z === 'rest')   csvRuhe   = true;
  }

  pruefe('CSV-Wiedergabe erreicht beide Zustaende', csvStress && csvRuhe);
  pruefe('CSV-Schleife laeuft ohne Ruck durch', groessterSchritt(csvProben) < 0.4,
         'groesster Schritt ' + groessterSchritt(csvProben).toFixed(3) + ' bpm/Bild');

  console.log('\n--- Fehlerfaelle ---');
  const fehlt = laden(nichtGefunden);
  await fehlt.auf.laden();

  pruefe('fehlende Datei: Wechsel wird abgelehnt',
         fehlt.dq.wechseln('aufzeichnung') === false);
  pruefe('fehlende Datei: bleibt auf der Simulation', fehlt.dq.name === 'simulation');
  pruefe('fehlende Datei: Stoerung wird gemeldet',
         fehlt.dq.stoerung() === 'aufzeichnung');

  fehlt.dq.start();
  fahren(fehlt.dq, 3);
  pruefe('fehlende Datei: Anwendung laeuft weiter', fehlt.dq.puls > 50,
         fehlt.dq.puls.toFixed(1) + ' bpm');

  const defekt = laden(kaputt, '?aufzeichnung=data/irgendwas.csv');
  await defekt.auf.laden();
  pruefe('CSV ohne Spalte puls: Wechsel wird abgelehnt',
         defekt.dq.wechseln('aufzeichnung') === false);

  console.log(fehlgeschlagen === 0
    ? '\nAlle Pruefungen bestanden.\n'
    : '\n' + fehlgeschlagen + ' Pruefung(en) fehlgeschlagen.\n');

  process.exit(fehlgeschlagen === 0 ? 0 : 1);
})();
