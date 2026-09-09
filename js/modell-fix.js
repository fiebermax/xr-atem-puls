// Zentriert ein geladenes glTF-Modell um seinen Ursprung
// und skaliert es auf eine Zielhoehe. Loest das "Klopfen"
// bei Modellen mit versetztem Pivot.

AFRAME.registerComponent('modell-fix', {
  schema: {
    zielhoehe: { type: 'number', default: 0.6 }   // Meter
  },

  init: function () {
    this.rohGroesse = null;   // Rohmasse des Modells, unskaliert
    this.rohMitte   = null;

    this.el.addEventListener('model-loaded', () => {
      this.messen();
      this.anwenden();
    });
  },

  // Laeuft, wenn die Zielhoehe zur Laufzeit geaendert wird.
  update: function () {
    if (this.rohGroesse) this.anwenden();
  },

  // Misst das Modell in seinem EIGENEN Koordinatensystem.
  messen: function () {
    const objekt = this.el.getObject3D('mesh');
    if (!objekt) return;

    objekt.position.set(0, 0, 0);
    objekt.scale.setScalar(1);

    // Box3.setFromObject misst in Weltkoordinaten. Solange das Modell im
    // Szenengraph haengt, stecken Position und Skalierung aller Eltern mit
    // drin - hier also die 0 1.5 -2 des Containers. Deshalb kurz aushaengen,
    // messen, wieder einhaengen. Ohne Eltern ist Weltraum gleich lokaler Raum.
    const elternteil = objekt.parent;
    if (elternteil) elternteil.remove(objekt);

    const box = new THREE.Box3().setFromObject(objekt);

    if (elternteil) elternteil.add(objekt);

    this.rohGroesse = box.getSize(new THREE.Vector3());
    this.rohMitte   = box.getCenter(new THREE.Vector3());
  },

  // Skaliert auf die Zielhoehe und schiebt den Mittelpunkt auf den Ursprung.
  // Danach liegt die Modellmitte exakt im Ursprung des Containers, sodass
  // dessen Skalierung das Modell um die Mitte dehnt statt es zu verschieben.
  anwenden: function () {
    const objekt = this.el.getObject3D('mesh');
    if (!objekt || !this.rohGroesse || this.rohGroesse.y === 0) return;

    const faktor = this.data.zielhoehe / this.rohGroesse.y;

    objekt.scale.setScalar(faktor);
    objekt.position.set(
      -this.rohMitte.x * faktor,
      -this.rohMitte.y * faktor,
      -this.rohMitte.z * faktor
    );
  }
});
