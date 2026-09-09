// Bildet die Herzfrequenz auf das Lungenmodell ab.
// Zwei Effekte: Grundgroesse folgt dem Puls (hoch = zusammengezogen),
// darueber liegt eine minimale Atembewegung.

AFRAME.registerComponent('atmung', {
  schema: {
    // Grundgroesse bei Ruhepuls bzw. bei Anspannungspuls
    groesseRuhe:   { type: 'number', default: 1.00 },
    groesseStress: { type: 'number', default: 0.75 },

    // Staerke der Atembewegung bei niedrigem bzw. hohem Puls
    hubRuhe:   { type: 'number', default: 0.046 },
    hubStress: { type: 'number', default: 0.014 },

    // Faktor auf die Atemfrequenz aus Kapitel 11.6.2. 1.0 entspricht der
    // dort dokumentierten Formel, hoehere Werte lassen schneller atmen.
    tempo: { type: 'number', default: 1.25 }
  },

  init: function () {
    this.phase = 0;

    // 0 beim vollen Ausatmen, 1 beim vollen Einatmen. Licht und Bodenring
    // lesen diesen Wert, damit die ganze Szene in einem Takt laeuft.
    this.atemwert = 0.5;
  },

  // Laeuft nach init und bei jeder Wertaenderung zur Laufzeit.
  update: function () {
    this.anwenden();
  },

  tick: function (time, timeDelta) {
    // Nach einem Tabwechsel liefert timeDelta sehr grosse Werte.
    const dt = Math.min(timeDelta / 1000, 0.1);

    if (datenquelle.laeuft()) {
      const bpm = datenquelle.update(dt);

      // Atemfrequenz laut Dokumentation Kapitel 11.6.2, mal Tempofaktor
      const atemfrequenz = (6 + (bpm - 50) * 0.2) * this.data.tempo;
      this.phase += dt * (atemfrequenz / 60) * Math.PI * 2;
    }

    // Auch im Zustand "stopped" anwenden, damit die eingestellte
    // Groesse sichtbar bleibt statt einzufrieren.
    this.anwenden();
  },

  anwenden: function () {
    // 0 beim Ruhepuls, 1 beim Anspannungspuls. Frueher lag die Skala bei
    // 50 bis 120 bpm - Werte, welche die Simulation nie erreicht. Dadurch
    // kamen nur rund 72 Prozent der eingestellten Spanne an.
    const t = datenquelle.anteil();

    // Grundgroesse: schrumpft mit steigendem Puls
    const grund = this.data.groesseRuhe +
                  (this.data.groesseStress - this.data.groesseRuhe) * t;

    // Atemhub: wird flacher mit steigendem Puls
    const hub = this.data.hubRuhe +
                (this.data.hubStress - this.data.hubRuhe) * t;

    const schwingung = Math.sin(this.phase);
    this.atemwert = (schwingung + 1) / 2;

    this.el.object3D.scale.setScalar(grund * (1 + schwingung * hub));
  }
});
