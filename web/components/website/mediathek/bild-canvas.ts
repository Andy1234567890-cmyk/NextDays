// Bildbearbeitung im Browser: die zwei Fallen, an denen Canvas-Editoren
// reihenweise scheitern — und wie sie hier behandelt werden.
//
// Kein Server-Dienst: Zuschneiden, Drehen und Farbregler brauchen kein Backend,
// und ein Bild für jeden Reglerzug hoch- und wieder herunterzuladen wäre der
// langsamste denkbare Weg. Der Browser kann das, und er kann es sofort.
//
// ============================================================================
// FALLE 1 — `drawImage` ignoriert die EXIF-Orientierung
// ============================================================================
// Ein Handyfoto liegt physisch fast immer im Querformat auf dem Sensor; dass es
// hochkant ist, steht NUR im EXIF-Tag `Orientation` (0x0112). Ein `<img>` im
// Browser dreht danach, `ctx.drawImage` NICHT — es zeichnet die rohen Pixel.
// Wer das übersieht, dessen Editor kippt jedes Hochkantfoto auf die Seite,
// sobald man einmal auf „Zuschneiden" geklickt hat. Und zwar erst DANN, was die
// Ursache schwer findbar macht: vorher sah alles richtig aus.
//
// `createImageBitmap(blob, { imageOrientation: "from-image" })` erledigt das
// eigentlich — nur unterstützt das nicht jeder Browser, und wo die Option
// ignoriert wird, gibt es keinen Fehler, sondern ein liegendes Bild. Deshalb
// wird das Tag hier SELBST gelesen und die Kompensation selbst gerechnet: eine
// Prüfung, deren Ausfall still ist, darf man nicht dem Zufall überlassen
// (Wurzel 5).
//
// ============================================================================
// FALLE 2 — Safari bricht ab 16 777 216 Pixeln Fläche ab, OHNE Fehler
// ============================================================================
// iOS/Safari deckelt die Canvas-Fläche bei 16 777 216 Pixeln (4096 × 4096).
// Darüber wird nicht geworfen — der Canvas bleibt schlicht leer bzw. `toBlob`
// liefert ein weißes Bild. Ein 6000 × 4000-Foto (24 Mio Pixel) aus einer
// Spiegelreflex liegt darüber; das ist kein Randfall, sondern die
// Standardauflösung.
//
// Deshalb wird JEDE Vorlage vor dem Zeichnen auf `MAX_CANVAS_FLAECHE`
// heruntergerechnet — verlustfrei proportional. Der Kunde bekommt ein
// bearbeitetes Bild mit höchstens 16 Mpx statt ein weißes.
//
// ============================================================================
// FALLE 3 — jedes `toBlob` kodiert JPEG NEU
// ============================================================================
// JPEG ist verlustbehaftet. Wer bei jedem Reglerzug `toBlob` ruft, kodiert das
// Bild bei zwanzig Zügen zwanzigmal neu — sichtbar als Artefakte, und niemand
// versteht, warum das Bild nach dem Bearbeiten schlechter aussieht.
//
// Die Vorschau läuft deshalb über CSS-Filter auf dem angezeigten Element (kein
// Neukodieren, und sie ist obendrein flüssig). Kodiert wird GENAU EINMAL: beim
// Speichern. Das ist der Grund, warum `zeichne` und `alsBlob` getrennt sind.

/** Fläche, ab der Safari/iOS ohne Fehlermeldung aussteigt. */
export const MAX_CANVAS_FLAECHE = 16_777_216;

/** Die Bearbeitung, die der Editor beschreibt. Reine Daten — was daraus wird,
 *  entscheidet erst `zeichne`. */
export type Bearbeitung = {
  /** Zuschnitt in ANTEILEN des orientierten Bildes (0–1), nicht in Pixeln:
   *  so bleibt er gültig, wenn die Vorlage heruntergerechnet wird. */
  zuschnitt: { x: number; y: number; b: number; h: number };
  /** Drehung im Uhrzeigersinn, in 90er-Schritten. */
  drehung: 0 | 90 | 180 | 270;
  spiegelH: boolean;
  spiegelV: boolean;
  /** Je 100 = unverändert. */
  helligkeit: number;
  kontrast: number;
  saettigung: number;
  /** 0–100. */
  graustufen: number;
};

export const KEINE_BEARBEITUNG: Bearbeitung = {
  zuschnitt: { x: 0, y: 0, b: 1, h: 1 },
  drehung: 0,
  spiegelH: false,
  spiegelV: false,
  helligkeit: 100,
  kontrast: 100,
  saettigung: 100,
  graustufen: 0,
};

/** Feste Seitenverhältnisse für den Zuschnitt. `null` = frei. */
export const SEITENVERHAELTNISSE = [
  { id: "frei", wert: null },
  { id: "16zu9", wert: 16 / 9 },
  { id: "4zu3", wert: 4 / 3 },
  { id: "1zu1", wert: 1 },
  { id: "3zu2", wert: 3 / 2 },
] as const;

export type VerhaeltnisId = (typeof SEITENVERHAELTNISSE)[number]["id"];

/** CSS-Filter der Bearbeitung. Wird für die LIVE-Vorschau am `<img>` benutzt und
 *  beim Speichern am Canvas-Kontext — beide verstehen dieselbe Syntax, also gibt
 *  es die Formel genau einmal. Weichen sie auseinander, sieht das gespeicherte
 *  Bild anders aus als die Vorschau, und das merkt niemand vor dem Kunden. */
export function filterKette(b: Bearbeitung): string {
  const teile = [
    `brightness(${b.helligkeit}%)`,
    `contrast(${b.kontrast}%)`,
    `saturate(${b.saettigung}%)`,
  ];
  if (b.graustufen > 0) teile.push(`grayscale(${b.graustufen}%)`);
  return teile.join(" ");
}

// --- EXIF -------------------------------------------------------------------

/** Der EXIF-Orientierungswert (1–8), oder 1, wenn keiner gefunden wurde.
 *
 *  1 ist hier KEIN geratener Ersatzwert, sondern die Bedeutung von „kein Tag":
 *  die EXIF-Spezifikation definiert 1 als „oben links", also unverändert. Genau
 *  das gilt für jedes Bild ohne Tag (PNG und WebP haben keins). */
export async function exifOrientierung(datei: Blob): Promise<number> {
  // Nur den Kopf lesen. Ein 20-MB-Foto komplett in den Speicher zu holen, um
  // zwei Bytes zu finden, wäre die teuerste Art, diese Frage zu stellen.
  const kopf = await datei.slice(0, 128 * 1024).arrayBuffer();
  const sicht = new DataView(kopf);
  if (sicht.byteLength < 4 || sicht.getUint16(0, false) !== 0xffd8) return 1;
  let i = 2;
  while (i + 4 <= sicht.byteLength) {
    if (sicht.getUint8(i) !== 0xff) return 1;
    const marker = sicht.getUint8(i + 1);
    // SOS (0xDA) = ab hier kommen Bilddaten; danach gibt es kein APP1 mehr.
    if (marker === 0xda) return 1;
    const laenge = sicht.getUint16(i + 2, false);
    if (laenge < 2) return 1;
    if (marker === 0xe1 && i + 4 + 6 <= sicht.byteLength) {
      // APP1 muss mit "Exif\0\0" beginnen — sonst ist es XMP o. ä.
      const kennung = String.fromCharCode(
        sicht.getUint8(i + 4),
        sicht.getUint8(i + 5),
        sicht.getUint8(i + 6),
        sicht.getUint8(i + 7),
      );
      if (kennung === "Exif") return exifTagLesen(sicht, i + 10);
    }
    i += 2 + laenge;
  }
  return 1;
}

/** Das Orientierungs-Tag im TIFF-Kopf ab `tiff`. */
function exifTagLesen(sicht: DataView, tiff: number): number {
  if (tiff + 8 > sicht.byteLength) return 1;
  // Byte-Reihenfolge steht im TIFF-Kopf und ist NICHT fest: "II" = little,
  // "MM" = big endian. Canon schreibt das eine, Nikon das andere — wer eines
  // annimmt, liest beim halben Weltmarkt Unsinn.
  const bom = sicht.getUint16(tiff, false);
  if (bom !== 0x4949 && bom !== 0x4d4d) return 1;
  const little = bom === 0x4949;
  const ifd0 = sicht.getUint32(tiff + 4, little);
  const start = tiff + ifd0;
  if (start + 2 > sicht.byteLength) return 1;
  const anzahl = sicht.getUint16(start, little);
  // Gedeckelt: eine manipulierte Datei darf keine Endlosschleife auslösen.
  for (let e = 0; e < Math.min(anzahl, 256); e += 1) {
    const eintrag = start + 2 + e * 12;
    if (eintrag + 12 > sicht.byteLength) return 1;
    if (sicht.getUint16(eintrag, little) === 0x0112) {
      const wert = sicht.getUint16(eintrag + 8, little);
      return wert >= 1 && wert <= 8 ? wert : 1;
    }
  }
  return 1;
}

/** Wie die EXIF-Orientierung ausgeglichen wird: Drehung plus Spiegelung.
 *
 *  Die Werte 2, 4, 5, 7 sind GESPIEGELT. Sie sind selten, aber es gibt sie
 *  (Frontkameras, manche Scanner) — sie als „unbekannt, also 1" zu behandeln
 *  hieße, ein Bild seitenverkehrt zu speichern. */
export function orientierungsAusgleich(wert: number): {
  drehung: number;
  spiegelH: boolean;
} {
  switch (wert) {
    case 2:
      return { drehung: 0, spiegelH: true };
    case 3:
      return { drehung: 180, spiegelH: false };
    case 4:
      return { drehung: 180, spiegelH: true };
    case 5:
      return { drehung: 90, spiegelH: true };
    case 6:
      return { drehung: 90, spiegelH: false };
    case 7:
      return { drehung: 270, spiegelH: true };
    case 8:
      return { drehung: 270, spiegelH: false };
    default:
      return { drehung: 0, spiegelH: false };
  }
}

// --- Zeichnen ---------------------------------------------------------------

/** Eine Bildvorlage, die schon EXIF-korrekt und auf die Canvas-Grenze
 *  heruntergerechnet ist. Alles Weitere rechnet gegen diese Maße. */
export type Vorlage = {
  bild: CanvasImageSource;
  breite: number;
  hoehe: number;
  /** Wurde für die Canvas-Grenze verkleinert? Die Oberfläche sagt das — ein
   *  stilles Herunterrechnen wäre eine Änderung, die niemand angekündigt hat. */
  verkleinert: boolean;
  /** Die ECHTEN Maße des Originals, für die Anzeige. */
  originalBreite: number;
  originalHoehe: number;
};

/** Bild laden, EXIF ausgleichen, auf die Canvas-Grenze bringen.
 *
 *  Danach ist die Vorlage „aufrecht": jede weitere Rechnung darf die
 *  Orientierung vergessen, und niemand muss sie an zweiter Stelle noch einmal
 *  berücksichtigen. */
export async function ladeVorlage(quelle: Blob): Promise<Vorlage> {
  const orientierung = await exifOrientierung(quelle);
  const roh = await createImageBitmap(quelle);
  const { drehung, spiegelH } = orientierungsAusgleich(orientierung);
  const gedreht = drehung === 90 || drehung === 270;
  const bReal = gedreht ? roh.height : roh.width;
  const hReal = gedreht ? roh.width : roh.height;

  // Safari-Grenze: proportional herunterrechnen, BEVOR gezeichnet wird.
  const faktor = Math.min(1, Math.sqrt(MAX_CANVAS_FLAECHE / (bReal * hReal)));
  const breite = Math.max(1, Math.round(bReal * faktor));
  const hoehe = Math.max(1, Math.round(hReal * faktor));

  const flaeche = document.createElement("canvas");
  flaeche.width = breite;
  flaeche.height = hoehe;
  const ctx = flaeche.getContext("2d");
  if (!ctx) {
    roh.close();
    throw new Error("Canvas nicht verfügbar");
  }
  ctx.save();
  ctx.translate(breite / 2, hoehe / 2);
  ctx.rotate((drehung * Math.PI) / 180);
  if (spiegelH) ctx.scale(-1, 1);
  ctx.drawImage(roh, -roh.width / 2, -roh.height / 2, roh.width, roh.height);
  ctx.restore();
  roh.close();

  return {
    bild: flaeche,
    breite,
    hoehe,
    verkleinert: faktor < 1,
    originalBreite: bReal,
    originalHoehe: hReal,
  };
}

/** Die Bearbeitung auf eine Vorlage anwenden und den fertigen Canvas liefern. */
export function zeichne(vorlage: Vorlage, b: Bearbeitung): HTMLCanvasElement {
  const zx = Math.round(vorlage.breite * b.zuschnitt.x);
  const zy = Math.round(vorlage.hoehe * b.zuschnitt.y);
  const zb = Math.max(1, Math.round(vorlage.breite * b.zuschnitt.b));
  const zh = Math.max(1, Math.round(vorlage.hoehe * b.zuschnitt.h));
  const gedreht = b.drehung === 90 || b.drehung === 270;

  const flaeche = document.createElement("canvas");
  flaeche.width = gedreht ? zh : zb;
  flaeche.height = gedreht ? zb : zh;
  const ctx = flaeche.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");

  ctx.translate(flaeche.width / 2, flaeche.height / 2);
  ctx.rotate((b.drehung * Math.PI) / 180);
  ctx.scale(b.spiegelH ? -1 : 1, b.spiegelV ? -1 : 1);
  // Dieselbe Filterformel wie die Live-Vorschau — sonst sähe das gespeicherte
  // Bild anders aus als das, was der Kunde eingestellt hat.
  ctx.filter = filterKette(b);
  ctx.drawImage(vorlage.bild, zx, zy, zb, zh, -zb / 2, -zh / 2, zb, zh);
  return flaeche;
}

/** GENAU EINMAL kodieren — beim Speichern (siehe Falle 3 oben).
 *
 *  Zielformat: das Format der Vorlage, sofern wir es unterstützen. Ein PNG als
 *  JPEG zu speichern würde Transparenz gegen Schwarz eintauschen; ein Foto als
 *  PNG wäre fünfmal so groß. */
export function alsBlob(
  flaeche: HTMLCanvasElement,
  mime: string,
): Promise<Blob> {
  const ziel =
    mime === "image/png" || mime === "image/webp" ? mime : "image/jpeg";
  return new Promise((aufloesen, ablehnen) => {
    flaeche.toBlob(
      (blob) => {
        if (blob) aufloesen(blob);
        // Kein stiller Fehlschlag: `toBlob` gibt null, wenn der Canvas zu groß
        // oder „tainted" ist. Ohne diese Ablehnung sähe es aus, als hätte das
        // Speichern nur lange gedauert (Wurzel 5).
        else ablehnen(new Error("Bild konnte nicht erzeugt werden"));
      },
      ziel,
      // 0.92 ist die Qualität, die Browser auch selbst als Standard nehmen —
      // hoch genug, dass ein einzelner Speichervorgang nicht sichtbar ist.
      ziel === "image/jpeg" ? 0.92 : undefined,
    );
  });
}

/** Zuschnitt so beschneiden, dass er ein festes Seitenverhältnis einhält und im
 *  Bild bleibt. `null` = freier Zuschnitt, dann wird nur begrenzt. */
export function haltVerhaeltnis(
  zuschnitt: Bearbeitung["zuschnitt"],
  bildBreite: number,
  bildHoehe: number,
  verhaeltnis: number | null,
): Bearbeitung["zuschnitt"] {
  let { x, y, b, h } = zuschnitt;
  b = Math.min(Math.max(b, 0.05), 1);
  h = Math.min(Math.max(h, 0.05), 1);
  if (verhaeltnis !== null) {
    // Anteile sind einheitenlos; das Verhältnis gilt in PIXELN. Ohne diese
    // Umrechnung wäre „1:1" auf einem 3:2-Bild kein Quadrat.
    const zielH = (b * bildBreite) / verhaeltnis / bildHoehe;
    if (zielH <= 1) {
      h = zielH;
    } else {
      h = 1;
      b = (h * bildHoehe * verhaeltnis) / bildBreite;
    }
  }
  x = Math.min(Math.max(x, 0), 1 - b);
  y = Math.min(Math.max(y, 0), 1 - h);
  return { x, y, b, h };
}
