// Bildet die Herzfrequenz auf den Atemrhythmus des Modells ab.

AFRAME.registerComponent('atmung', {
  schema: {
    basis: { type: 'number', default: 1 }   // Grundskalierung des Modells
  },

  init: function () {
    this.phase = 0;
  },

  tick: function (time, timeDelta) {
    if (!simulation.laeuft()) return;        // gestoppt: Position einfrieren

    const dt = timeDelta / 1000;
    const bpm = simulation.update(dt);

    // Mapping laut Dokumentation Kapitel 11.6.2
    const atemfrequenz = 6 + (bpm - 50) * 0.2;       // Atemzuege pro Minute
    const amplitude    = 0.18 - (bpm - 50) * 0.002;  // Skalierungshub

    this.phase += dt * (atemfrequenz / 60) * Math.PI * 2;

    const s = this.data.basis * (1 + Math.sin(this.phase) * amplitude);
    this.el.object3D.scale.set(s, s, s);
  }
});