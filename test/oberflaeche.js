// Prueft js/ui.js gegen einen minimalen DOM-Ersatz.
//
// Die Schnittstellenpruefung in test/schnittstelle.js deckt die Datenschicht
// ab. Genau dazwischen lag ein Fehler: der Quellen-Button meldete beim Start
// "Aufzeichnung fehlt", obwohl die Datei einwandfrei lud - zustandAnzeigen()
// laeuft synchron, da war der fetch noch unterwegs. Diese Datei schliesst
// diese Luecke.
//
// Aufruf aus dem Projektordner:   node test/oberflaeche.js

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const WURZEL = path.join(__dirname, '..');

const IDS = ['btn-los', 'startbildschirm', 'pulsanzeige', 'bedienleiste',
             'btn-startstopp', 'btn-ruhe', 'btn-anspannung', 'btn-quelle'];

// Gerade so viel DOM, wie js/ui.js benutzt.
function macheElement(id) {
  const klassen = new Set();
  const hoerer  = {};

  return {
    id,
    textContent: '',
    disabled: false,

    classList: {
      add:      c => klassen.add(c),
      remove:   c => klassen.delete(c),
      toggle:   (c, an) => { if (an) klassen.add(c); else klassen.delete(c); },
      contains: c => klassen.has(c)
    },

    addEventListener(typ, fn) {
      hoerer[typ] = hoerer[typ] || [];
      hoerer[typ].push(fn);
    },

    klick() {
      const liste = hoerer.click || [];
      if (liste.length === 0) throw new Error('kein Klick-Listener an #' + id);
      liste.forEach(fn => fn());
    },

    anzahlListener() {
      return (hoerer.click || []).length;
    }
  };
}

// Baut eine vollstaendige Umgebung: DOM-Ersatz, fetch, Zeitgeber.
function aufbauen(fetchImpl) {
  const el = {};
  IDS.forEach(id => { el[id] = macheElement(id); });

  let intervallFn = null;

  const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} },   // Modulmeldungen unterdruecken
    URLSearchParams,
    location: { search: '' },
    document: { getElementById: id => el[id] || null },
    setInterval: fn => { intervallFn = fn; return 1; },
    setTimeout,
    fetch: fetchImpl
  });

  for (const datei of ['js/datenquelle.js', 'js/simulation.js',
                       'js/aufzeichnung.js', 'js/ui.js']) {
    vm.runInContext(fs.readFileSync(path.join(WURZEL, datei), 'utf8'), ctx,
                    { filename: datei });
  }

  return {
    el,
    dq: vm.runInContext('datenquelle', ctx),
    auf: vm.runInContext('aufzeichnung', ctx),
    tick: () => { if (intervallFn) intervallFn(); }
  };
}

const vonPlatte = (pfad) => {
  const voll = path.join(WURZEL, pfad);
  if (!fs.existsSync(voll)) return Promise.resolve({ ok: false, status: 404 });
  return Promise.resolve({
    ok: true, status: 200,
    text: () => Promise.resolve(fs.readFileSync(voll, 'utf8'))
  });
};

const nichtGefunden = () => Promise.resolve({ ok: false, status: 404 });

let fehlgeschlagen = 0;

function pruefe(name, bedingung, zusatz) {
  console.log((bedingung ? '  OK   ' : '  FEHL ') + name + (zusatz ? '   ' + zusatz : ''));
  if (!bedingung) fehlgeschlagen++;
}

(async () => {

  console.log('\n--- Verdrahtung ---');
  const a = aufbauen(vonPlatte);

  for (const id of ['btn-los', 'btn-startstopp', 'btn-ruhe',
                    'btn-anspannung', 'btn-quelle']) {
    pruefe('#' + id + ' hat genau einen Klick-Listener',
           a.el[id].anzahlListener() === 1);
  }

  console.log('\n--- Zustand beim Start ---');
  // Noch waehrend des Ladens: hier trat der Fehlalarm auf.
  pruefe('meldet waehrend des Ladens keine Stoerung',
         a.el['btn-quelle'].classList.contains('stoerung') === false,
         JSON.stringify(a.el['btn-quelle'].textContent));

  await a.auf.laden();
  a.tick();

  pruefe('Label zeigt die Simulation',
         a.el['btn-quelle'].textContent === 'Quelle: Simulation',
         JSON.stringify(a.el['btn-quelle'].textContent));
  pruefe('Ruhe ist bedienbar',       a.el['btn-ruhe'].disabled === false);
  pruefe('Anspannung ist bedienbar', a.el['btn-anspannung'].disabled === false);

  console.log('\n--- Umschalten ---');
  a.el['btn-los'].klick();
  pruefe('Start setzt die Wiedergabe in Gang', a.dq.laeuft() === true);

  a.el['btn-quelle'].klick();
  pruefe('Klick wechselt zur Aufzeichnung', a.dq.name === 'aufzeichnung');
  pruefe('Label folgt dem Wechsel',
         a.el['btn-quelle'].textContent === 'Quelle: Aufzeichnung',
         JSON.stringify(a.el['btn-quelle'].textContent));
  pruefe('Ruhe wird gesperrt',       a.el['btn-ruhe'].disabled === true);
  pruefe('Anspannung wird gesperrt', a.el['btn-anspannung'].disabled === true);

  a.el['btn-quelle'].klick();
  pruefe('zweiter Klick fuehrt zurueck', a.dq.name === 'simulation');
  pruefe('Sperre wird wieder aufgehoben', a.el['btn-ruhe'].disabled === false);

  console.log('\n--- Steuerung und Anzeige ---');
  a.el['btn-anspannung'].klick();
  pruefe('Anspannung wird uebernommen',
         a.dq.getDaten().state === 'stress');

  for (let i = 0; i < 600; i++) a.dq.update(1 / 60);
  a.tick();
  pruefe('Pulsanzeige zeigt einen Wert',
         /^\d+ bpm$/.test(a.el['pulsanzeige'].textContent),
         JSON.stringify(a.el['pulsanzeige'].textContent));

  a.el['btn-startstopp'].klick();
  pruefe('Stopp haelt an', a.dq.laeuft() === false);
  a.tick();
  // Der Platzhalter ist "– bpm" und enthaelt selbst "bpm",
  // deshalb wird auf den Gedankenstrich am Anfang geprueft.
  pruefe('Anzeige faellt auf den Platzhalter',
         a.el['pulsanzeige'].textContent.charAt(0) === '–',
         JSON.stringify(a.el['pulsanzeige'].textContent));

  console.log('\n--- Datei nicht ladbar ---');
  const b = aufbauen(nichtGefunden);
  await b.auf.laden();
  b.tick();

  pruefe('Stoerung wird am Button angezeigt',
         b.el['btn-quelle'].classList.contains('stoerung') === true);
  pruefe('Label nennt die fehlende Quelle',
         b.el['btn-quelle'].textContent === 'Quelle: Aufzeichnung fehlt',
         JSON.stringify(b.el['btn-quelle'].textContent));

  b.el['btn-los'].klick();
  b.el['btn-quelle'].klick();
  pruefe('Klick wechselt nicht auf die kaputte Quelle',
         b.dq.name === 'simulation');
  pruefe('Ruhe bleibt bedienbar', b.el['btn-ruhe'].disabled === false);

  console.log(fehlgeschlagen === 0
    ? '\nAlle Pruefungen bestanden.\n'
    : '\n' + fehlgeschlagen + ' Pruefung(en) fehlgeschlagen.\n');

  process.exit(fehlgeschlagen === 0 ? 0 : 1);
})();
