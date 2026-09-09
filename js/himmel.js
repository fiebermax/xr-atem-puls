// Hintergrund: senkrechter Farbverlauf, dessen Farben dem Puls folgen.
// Ruhe = kuehles Blaugruen, Anspannung = entsaettigtes Warmgrau.
// Der Uebergang braucht dieselben rund 10 Sekunden wie die Groessenaenderung,
// weil beide am selben Pulswert aus js/datenquelle.js haengen.

// Eigener Shader: zwei Farben, senkrecht ineinander geblendet. A-Frame
// bringt keinen Verlaufs-Shader mit, deshalb hier von Hand.
AFRAME.registerShader('verlauf', {
  schema: {
    farbeOben:  { type: 'color',  default: '#20454C', is: 'uniform' },
    farbeUnten: { type: 'color',  default: '#0E1F22', is: 'uniform' },

    // Breite des Uebergangs. 0 gibt eine harte Kante am Horizont,
    // 1 blendet ueber die gesamte Kugel.
    weichheit:  { type: 'number', default: 0.9,       is: 'uniform' }
  },

  vertexShader: `
    varying vec3 vPos;

    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform vec3  farbeOben;
    uniform vec3  farbeUnten;
    uniform float weichheit;
    varying vec3  vPos;

    void main() {
      // -1 am Boden der Kugel, +1 am Scheitel
      float hoehe = normalize(vPos).y;
      float t = smoothstep(-weichheit, weichheit, hoehe);

      vec3 farbe = mix(farbeUnten, farbeOben, t);

      // three.js rechnet Farben intern linear. Ohne diese Umrechnung
      // in den sRGB-Raum wirkt der Himmel deutlich zu dunkel.
      farbe = pow(farbe, vec3(1.0 / 2.2));

      gl_FragColor = vec4(farbe, 1.0);
    }
  `
});

// Blendet die beiden Verlaufsfarben zwischen Ruhe und Anspannung.
AFRAME.registerComponent('himmel-puls', {
  schema: {
    ruheOben:    { type: 'color', default: '#20454C' },
    ruheUnten:   { type: 'color', default: '#0E1F22' },
    stressOben:  { type: 'color', default: '#46352F' },
    stressUnten: { type: 'color', default: '#241A1A' }
  },

  init: function () {
    // Zwei Farbobjekte zum Wiederverwenden. In tick jedes Bild neue
    // anzulegen waere unnoetiger Muell fuer die Speicherbereinigung.
    this.oben  = new THREE.Color();
    this.unten = new THREE.Color();
  },

  // Die vier Eckfarben einmal umrechnen statt in jedem Bild. THREE.Color
  // wandelt den Hexwert dabei in den linearen Arbeitsfarbraum um, was fuer
  // das Mischen mit lerp auch der richtige Raum ist.
  update: function () {
    this.ruheOben    = new THREE.Color(this.data.ruheOben);
    this.ruheUnten   = new THREE.Color(this.data.ruheUnten);
    this.stressOben  = new THREE.Color(this.data.stressOben);
    this.stressUnten = new THREE.Color(this.data.stressUnten);
  },

  tick: function () {
    const mesh = this.el.getObject3D('mesh');
    if (!mesh || !mesh.material.uniforms) return;

    // Nur lesen. datenquelle.update() ruft ausschliesslich die atmung-
    // Component auf, sonst liefe die Simulation doppelt so schnell.
    const t = datenquelle.anteil();

    this.oben.copy(this.ruheOben).lerp(this.stressOben, t);
    this.unten.copy(this.ruheUnten).lerp(this.stressUnten, t);

    mesh.material.uniforms.farbeOben.value.copy(this.oben);
    mesh.material.uniforms.farbeUnten.value.copy(this.unten);
  }
});
