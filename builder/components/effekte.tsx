"use client";

// Partikel-Effekte über der ganzen Seite (0440).
//
// Neun Effekte, EINE Schleife. Sie unterscheiden sich in fünf Zahlen und einem
// Zeichen — Fallgeschwindigkeit, Seitwärtsdrift, Drehung, Größe, Farbe und das
// dargestellte Symbol. Neun eigene Animationen zu schreiben hieße, denselben
// Fehler neunmal zu machen.
//
// WARUM CANVAS UND NICHT DOM: 80 Elemente, die 60-mal je Sekunde ihre Position
// ändern, sind 4800 Layout-Rechnungen pro Sekunde. Auf einem älteren Telefon
// bleibt davon die Seite stehen. Auf einer Leinwand ist es EIN Element.
//
// WARUM EIN DECKEL AUF DIE DAUER: Eine Schleife, die nie aufhört, kostet
// dauerhaft Rechenzeit und Akku. `dauer_sekunden: 0` heißt „ohne Ende" und ist
// erlaubt, weil es verlangt wurde — aber die Voreinstellung sind 15 Sekunden.
//
// UND DER EHRLICHE SATZ DAZU: Auf einer Unterkunfts-Website verkauft keiner
// dieser Effekte eine Nacht. Sie stehen hier, weil sie ausdrücklich gewünscht
// waren; `fledermaeuse` und `pride` sind Kalendertage, kein Dauerzustand.
import { useEffect, useRef } from "react";

export type EffektName =
  | "schnee"
  | "feuerwerk"
  | "blaetter"
  | "herzen"
  | "sterne"
  | "fledermaeuse"
  | "ballons"
  | "pride"
  | "kleeblaetter";

type Bauart = {
  /** Das gezeichnete Zeichen. Emoji und Unicode statt Bilddateien: keine
   *  zusätzliche Anfrage, keine Lizenzfrage, überall vorhanden. */
  zeichen: string[];
  /** Fallgeschwindigkeit in Pixeln je Sekunde, von–bis. Negativ = steigt. */
  tempo: [number, number];
  /** Seitwärtsdrift je Sekunde. */
  drift: [number, number];
  /** Größe in Pixeln, von–bis. */
  groesse: [number, number];
  /** Drehung in Grad je Sekunde. */
  drehung: [number, number];
  /** Wie viele Teilchen gleichzeitig. */
  anzahl: number;
};

/** Die neun Bauarten.
 *
 *  Die Zahlen sind nicht beliebig: Schnee fällt langsam und driftet kaum,
 *  Blätter taumeln (viel Drehung, viel Drift), Ballons steigen (negatives
 *  Tempo), Feuerwerk ist der einzige, der nicht fällt, sondern von unten kommt
 *  und schnell ist. */
const BAUARTEN: Record<EffektName, Bauart> = {
  schnee: {
    zeichen: ["❄", "❅", "❆"],
    tempo: [30, 70], drift: [-12, 12], groesse: [10, 22],
    drehung: [-20, 20], anzahl: 60,
  },
  feuerwerk: {
    zeichen: ["✦", "✧", "★", "•"],
    tempo: [-260, -120], drift: [-70, 70], groesse: [6, 14],
    drehung: [0, 0], anzahl: 70,
  },
  blaetter: {
    zeichen: ["🍂", "🍁"],
    tempo: [40, 90], drift: [-45, 45], groesse: [14, 26],
    drehung: [-140, 140], anzahl: 35,
  },
  herzen: {
    zeichen: ["❤", "💗", "💕"],
    tempo: [35, 80], drift: [-25, 25], groesse: [12, 24],
    drehung: [-30, 30], anzahl: 40,
  },
  sterne: {
    zeichen: ["★", "☆", "✦"],
    tempo: [50, 110], drift: [-15, 15], groesse: [8, 18],
    drehung: [-60, 60], anzahl: 50,
  },
  fledermaeuse: {
    zeichen: ["🦇"],
    tempo: [60, 130], drift: [-80, 80], groesse: [16, 30],
    drehung: [-15, 15], anzahl: 20,
  },
  ballons: {
    zeichen: ["🎈", "🎉"],
    tempo: [-90, -40], drift: [-20, 20], groesse: [18, 34],
    drehung: [-12, 12], anzahl: 25,
  },
  pride: {
    zeichen: ["🌈", "▪"],
    tempo: [60, 140], drift: [-40, 40], groesse: [8, 18],
    drehung: [-180, 180], anzahl: 60,
  },
  kleeblaetter: {
    zeichen: ["🍀", "☘"],
    tempo: [40, 95], drift: [-35, 35], groesse: [12, 24],
    drehung: [-120, 120], anzahl: 35,
  },
};

/** Farben für die Teilchen, die keine eigene Farbe mitbringen.
 *
 *  Emoji zeichnen sich selbst; die Liste gilt den Zeichen wie `▪` und `•`,
 *  die sonst schwarz wären. */
const PRIDE_FARBEN = ["#e40303", "#ff8c00", "#ffed00", "#008026", "#004dff", "#750787"];

type Teilchen = {
  x: number; y: number; vx: number; vy: number;
  groesse: number; winkel: number; drehung: number;
  zeichen: string; farbe: string;
};

function zufall(von: number, bis: number): number {
  return von + Math.random() * (bis - von);
}

export function Effekte({
  effekt,
  dauerSekunden,
}: {
  effekt: EffektName;
  /** 0 = ohne Ende. */
  dauerSekunden: number;
}) {
  const leinwand = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = leinwand.current;
    if (!canvas) return;

    // Wer „weniger Bewegung" eingestellt hat, bekommt keine.
    //
    // Das ist keine Höflichkeit: fallende Partikel über der ganzen Seite können
    // bei vestibulären Störungen Übelkeit auslösen, und `prefers-reduced-motion`
    // ist genau die Angabe, mit der Betroffene das melden. Eine Animation, die
    // sie ignoriert, ist ein Barriere-Fehler.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const kontext = canvas.getContext("2d");
    if (!kontext) return;
    const bauart = BAUARTEN[effekt] ?? BAUARTEN.schnee;

    let breite = 0;
    let hoehe = 0;
    let dichte = 1;

    function messen() {
      if (!canvas) return;
      dichte = Math.min(window.devicePixelRatio || 1, 2);
      breite = window.innerWidth;
      hoehe = window.innerHeight;
      canvas.width = Math.floor(breite * dichte);
      canvas.height = Math.floor(hoehe * dichte);
      canvas.style.width = `${breite}px`;
      canvas.style.height = `${hoehe}px`;
    }
    messen();

    /** Ein Teilchen an seinen Startplatz.
     *
     *  Steigende Effekte (negatives Tempo) starten UNTEN, fallende oben.
     *  `frisch` verteilt die erste Generation über die ganze Höhe, damit die
     *  Seite nicht mit einer leeren Fläche beginnt, die sich erst füllt. */
    function setzen(frisch: boolean): Teilchen {
      const tempo = zufall(bauart.tempo[0], bauart.tempo[1]);
      const steigt = tempo < 0;
      return {
        x: zufall(0, breite),
        y: frisch ? zufall(0, hoehe) : steigt ? hoehe + 20 : -20,
        vx: zufall(bauart.drift[0], bauart.drift[1]),
        vy: tempo,
        groesse: zufall(bauart.groesse[0], bauart.groesse[1]),
        winkel: zufall(0, 360),
        drehung: zufall(bauart.drehung[0], bauart.drehung[1]),
        zeichen: bauart.zeichen[Math.floor(Math.random() * bauart.zeichen.length)]!,
        farbe:
          effekt === "pride"
            ? PRIDE_FARBEN[Math.floor(Math.random() * PRIDE_FARBEN.length)]!
            : "#ffffff",
      };
    }

    let teilchen = Array.from({ length: bauart.anzahl }, () => setzen(true));
    let laeuft = true;
    let letzte = performance.now();
    const beginn = letzte;
    let bild = 0;

    function schritt(jetzt: number) {
      if (!laeuft || !kontext) return;
      const delta = Math.min((jetzt - letzte) / 1000, 0.05);
      letzte = jetzt;

      if (dauerSekunden > 0 && (jetzt - beginn) / 1000 > dauerSekunden) {
        kontext.clearRect(0, 0, canvas!.width, canvas!.height);
        return;
      }

      kontext.setTransform(dichte, 0, 0, dichte, 0, 0);
      kontext.clearRect(0, 0, breite, hoehe);

      for (const t of teilchen) {
        t.x += t.vx * delta;
        t.y += t.vy * delta;
        t.winkel += t.drehung * delta;

        // Raus oben oder unten → neu von der Gegenseite. Seitlich wird
        // umgeschlagen statt neu gesetzt: sonst reißt der Strom an den Rändern.
        const raus = t.vy < 0 ? t.y < -30 : t.y > hoehe + 30;
        if (raus) Object.assign(t, setzen(false));
        if (t.x < -30) t.x = breite + 20;
        if (t.x > breite + 30) t.x = -20;

        kontext.save();
        kontext.translate(t.x, t.y);
        kontext.rotate((t.winkel * Math.PI) / 180);
        kontext.font = `${t.groesse}px sans-serif`;
        kontext.fillStyle = t.farbe;
        kontext.textAlign = "center";
        kontext.textBaseline = "middle";
        kontext.fillText(t.zeichen, 0, 0);
        kontext.restore();
      }
      bild = requestAnimationFrame(schritt);
    }
    bild = requestAnimationFrame(schritt);

    function beiGroesse() {
      messen();
      teilchen = Array.from({ length: bauart.anzahl }, () => setzen(true));
    }
    window.addEventListener("resize", beiGroesse);

    return () => {
      laeuft = false;
      cancelAnimationFrame(bild);
      window.removeEventListener("resize", beiGroesse);
    };
  }, [effekt, dauerSekunden]);

  return (
    <canvas
      ref={leinwand}
      aria-hidden="true"
      // `pointer-events-none`: die Leinwand liegt über der ganzen Seite. Ohne
      // diese Zeile wäre sie eine unsichtbare Scheibe vor jedem Knopf, und der
      // Effekt hätte die Buchungsstrecke blockiert.
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}
