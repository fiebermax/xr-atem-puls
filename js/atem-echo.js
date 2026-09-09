// Die Szene atmet mit: Umgebungslicht und Bodenring folgen demselben
// Atemzyklus wie das Modell. Beide lesen den Wert aus der atmung-Component,
// damit es nur einen Takt gibt und nichts auseinanderlaeuft.

// Die Klammer haelt die Hilfsfunktion unten aus dem gemeinsamen Namensraum
// heraus. Klassische Scripts teilen sich einen, ein zweites atmungHolen in
// einer anderen Datei wuerde sonst zum Konflikt.
(function () {

  // Sucht die atmung-Component einmalig und merkt sie sich. Ein
  // querySelector pro Bild waere im Headset spuerbar teuer.
  function atmungHolen(component) {
    if (component.atmung) return component.atmung;

    const traeger = component.el.sceneEl.querySelector('[atmung]');
    if (traeger && traeger.components.atmung) {
      component.atmung = traeger.components.atmung;
    }
    return component.atmung;
  }

  // Helligkeit des Umgebungslichts folgt dem Atemzug.
  AFRAME.registerComponent('atem-licht', {
    schema: {
      grund:  { type: 'number', default: 0.45 },   // beim Ausatmen
      spanne: { type: 'number', default: 0.25 }    // Zunahme beim Einatmen
    },

    tick: function () {
      const atmung = atmungHolen(this);
      if (!atmung) return;

      // Direkt auf das three.js-Licht schreiben statt ueber setAttribute:
      // spart das Parsen des Attributstrings in jedem Frame.
      const licht = this.el.getObject3D('light');
      if (!licht) return;

      licht.intensity = this.data.grund + atmung.atemwert * this.data.spanne;
    }
  });

  // Ring am Boden als Atemfuehrung: waechst und leuchtet mit dem Einatmen.
  AFRAME.registerComponent('atem-ring', {
    schema: {
      spanne:          { type: 'number', default: 0.12 },  // Groessenhub
      deckkraftGrund:  { type: 'number', default: 0.18 },
      deckkraftSpanne: { type: 'number', default: 0.30 }
    },

    tick: function () {
      const atmung = atmungHolen(this);
      if (!atmung) return;

      // atemwert laeuft von 0 bis 1, hier gebraucht als -1 bis 1
      const schwingung = atmung.atemwert * 2 - 1;

      this.el.object3D.scale.setScalar(1 + schwingung * this.data.spanne);

      const mesh = this.el.getObject3D('mesh');
      if (mesh) {
        mesh.material.opacity =
          this.data.deckkraftGrund + atmung.atemwert * this.data.deckkraftSpanne;
      }
    }
  });

})();
