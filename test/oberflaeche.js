// Prueft js/ui.js gegen einen minimalen DOM-Ersatz.
//
// Die Schnittstellenpruefung in test/schnittstelle.js deckt die Datenschicht
// ab. Genau dazwischen lag ein Fehler: der Live-Button meldete beim Start,
// die Datei fehle, obwohl sie einwandfrei lud - zustandAnzeigen() laeuft
// synchron, da war der fetch noch unterwegs. Diese Datei schliesst die Luecke.
//
// Aufruf aus dem Projektordner:   node test/oberflaeche.js

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const WURZEL = path.join(__dirname, '..');

const IDS = ['btn-los', 'startbildschirm', 'pulsanzeige', 'bedienleiste',
             'btn-startstopp', 'btn-ruhe', 'btn-anspannung', 'btn-live',
             'live-status', 'btn-ton'];

// Gerade so viel Web Audio, wie js/klang.js benutzt. Damit laesst sich
// pruefen, ob der Ton dem Atemzug folgt, ohne etwas hoerbar zu machen.
function audioAttrappe() {
  return function () {
    const wert = v => ({ value: v });
    return {
      destination: {},
      createBiquadFilter: () => ({ type: '', frequency: wert(0), Q: wert(0),
                                   connect() {} }),
      createGain:         () => ({ gain: wert(0), connect() {} }),
      createOscillator:   () => ({ type: '', frequency: wert(0),
                                   connect() {}, start() {} })
    };
  };
}

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
function aufbauen(fetchImpl, fensterStub) {
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
    fetch: fetchImpl,
    window: fensterStub || {}      // ohne AudioContext bleibt der Ton stumm
  });

  for (const datei of ['js/datenquelle.js', 'js/simulation.js',
                       'js/aufzeichnung.js', 'js/klang.js', 'js/ui.js']) {
    vm.runInContext(fs.readFileSync(path.join(WURZEL, datei), 'utf8'), ctx,
                    { filename: datei });
  }

  return {
    el,
    dq: vm.runInContext('datenquelle', ctx),
    auf: vm.runInContext('aufzeichnung', ctx),
    klang: vm.runInContext('klang', ctx),
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
                    'btn-anspannung', 'btn-live', 'live-status', 'btn-ton']) {
    pruefe('#' + id + ' hat genau einen Klick-Listener',
           a.el[id].anzahlListener() === 1);
  }

  console.log('\n--- Zustand beim Start ---');
  // Noch waehrend des Ladens: hier trat der Fehlalarm auf.
  pruefe('meldet waehrend des Ladens keine Stoerung',
         a.el['btn-live'].classList.contains('stoerung') === false,
         JSON.stringify(a.el['btn-live'].textContent));

  await a.auf.laden();
  await new Promise(r => setTimeout(r, 0));   // automatischen Wechsel abwarten
  a.tick();

  pruefe('CSV-Wiedergabe laeuft ab dem Start', a.dq.name === 'aufzeichnung');
  pruefe('Beschriftung lautet "Live Simulation"',
         a.el['btn-live'].textContent === 'Live Simulation',
         JSON.stringify(a.el['btn-live'].textContent));
  pruefe('Button ist als aktiv markiert',
         a.el['btn-live'].classList.contains('aktiv') === true);
  pruefe('Statusanzeige oben rechts meldet "an"',
         a.el['live-status'].textContent === 'Live Simulation: an',
         JSON.stringify(a.el['live-status'].textContent));
  pruefe('Statusanzeige ist als an markiert',
         a.el['live-status'].classList.contains('an') === true);

  // Kein Button darf beim Start tot sein. Genau das sah vorher wie ein
  // Defekt aus, obwohl es der Regel entsprach.
  pruefe('Ruhe ist bedienbar',       a.el['btn-ruhe'].disabled === false);
  pruefe('Anspannung ist bedienbar', a.el['btn-anspannung'].disabled === false);

  console.log('\n--- Umschalten ---');
  a.el['btn-los'].klick();
  pruefe('Start setzt die Wiedergabe in Gang', a.dq.laeuft() === true);

  a.el['btn-live'].klick();
  pruefe('Klick schaltet die Wiedergabe ab', a.dq.name === 'simulation');
  pruefe('Markierung faellt dabei weg',
         a.el['btn-live'].classList.contains('aktiv') === false);
  pruefe('Statusanzeige meldet "aus"',
         a.el['live-status'].textContent === 'Live Simulation: aus',
         JSON.stringify(a.el['live-status'].textContent));
  pruefe('Statusanzeige ist nicht mehr als an markiert',
         a.el['live-status'].classList.contains('an') === false);
  pruefe('Beschriftung bleibt unveraendert',
         a.el['btn-live'].textContent === 'Live Simulation',
         JSON.stringify(a.el['btn-live'].textContent));

  a.el['live-status'].klick();
  pruefe('Klick auf die Statusanzeige schaltet sie wieder an',
         a.dq.name === 'aufzeichnung');
  pruefe('Markierung ist wieder da',
         a.el['btn-live'].classList.contains('aktiv') === true);

  console.log('\n--- Ruhe und Anspannung waehrend der Wiedergabe ---');
  pruefe('Ausgangslage ist die Aufzeichnung', a.dq.name === 'aufzeichnung');

  a.el['btn-anspannung'].klick();
  pruefe('Klick uebernimmt die Steuerung', a.dq.name === 'simulation');
  pruefe('und setzt den Zustand', a.dq.getDaten().state === 'stress');

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
         b.el['btn-live'].classList.contains('stoerung') === true);
  pruefe('Label nennt die fehlende Quelle',
         b.el['btn-live'].textContent === 'Live Simulation: Datei fehlt',
         JSON.stringify(b.el['btn-live'].textContent));
  pruefe('Statusanzeige meldet den Fehler ebenfalls',
         b.el['live-status'].textContent === 'Live Simulation: Datei fehlt' &&
         b.el['live-status'].classList.contains('stoerung') === true,
         JSON.stringify(b.el['live-status'].textContent));

  b.el['btn-los'].klick();
  b.el['btn-live'].klick();
  pruefe('Klick wechselt nicht auf die kaputte Quelle',
         b.dq.name === 'simulation');
  pruefe('Ruhe bleibt bedienbar', b.el['btn-ruhe'].disabled === false);

  console.log('
--- Klang ohne Web Audio ---');
  pruefe('ohne AudioContext bleibt der Ton stumm', a.klang.bereit === false);
  pruefe('Ton-Button ist trotzdem nicht als aktiv markiert',
         a.el['btn-ton'].classList.contains('aktiv') === false);
  a.el['btn-ton'].klick();
  pruefe('Klick darauf wirft nichts um', a.dq.laeuft() === false);

  console.log('
--- Klang mit Web Audio ---');
  const c = aufbauen(vonPlatte, { AudioContext: audioAttrappe() });
  await c.auf.laden();
  await new Promise(r => setTimeout(r, 0));

  c.el['btn-los'].klick();        // diese Geste baut den Klang auf
  pruefe('Klang wird beim Start aufgebaut', c.klang.bereit === true);
  pruefe('Ton-Button ist als aktiv markiert',
         c.el['btn-ton'].classList.contains('aktiv') === true);

  // Einatmen: Lautstaerke und Filter steigen
  for (let i = 0; i < 200; i++) c.klang.setzen(1, 0.5, true);
  const lautEin   = c.klang.meister.gain.value;
  const filterEin = c.klang.filter.frequency.value;
  pruefe('beim Einatmen wird es lauter', lautEin > 0.1, lautEin.toFixed(3));

  // Ausatmen: beides geht zurueck
  for (let i = 0; i < 200; i++) c.klang.setzen(0, 0.5, true);
  pruefe('beim Ausatmen wird es leiser',
         c.klang.meister.gain.value < lautEin,
         c.klang.meister.gain.value.toFixed(3));
  pruefe('Filter oeffnet sich nur beim Einatmen',
         c.klang.filter.frequency.value < filterEin);

  // Anspannung hebt die Tonhoehe
  c.klang.setzen(0.5, 0, true);
  const tiefer = c.klang.oszA.frequency.value;
  c.klang.setzen(0.5, 1, true);
  pruefe('Anspannung hebt die Tonhoehe',
         c.klang.oszA.frequency.value > tiefer,
         tiefer.toFixed(1) + ' -> ' + c.klang.oszA.frequency.value.toFixed(1) + ' Hz');

  c.el['btn-ton'].klick();
  for (let i = 0; i < 400; i++) c.klang.setzen(1, 0.5, true);
  pruefe('abgeschaltet wird es still',
         c.klang.meister.gain.value < 0.001,
         c.klang.meister.gain.value.toFixed(5));

  c.el['btn-ton'].klick();
  for (let i = 0; i < 400; i++) c.klang.setzen(1, 0.5, false);
  pruefe('bei angehaltener Wiedergabe ebenfalls still',
         c.klang.meister.gain.value < 0.001);

  console.log(fehlgeschlagen === 0
    ? '\nAlle Pruefungen bestanden.\n'
    : '\n' + fehlgeschlagen + ' Pruefung(en) fehlgeschlagen.\n');

  process.exit(fehlgeschlagen === 0 ? 0 : 1);
})();
