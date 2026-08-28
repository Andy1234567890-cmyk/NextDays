// „Farben aus dem Logo erzeugen" — Hostaways Reiter `Marke` im Farbwähler.
//
// Läuft VOLLSTÄNDIG im Browser des Kunden, nicht auf dem Server. Das ist eine
// bewusste Entscheidung und kein Notbehelf:
//
//   · Serverseitig wäre es ein Endpunkt, der eine vom Kunden gelieferte Adresse
//     holt und ein Bild dekodiert — genau die Klasse Angriff aus Wurzel 8
//     (SSRF plus Bild-Parser als Angriffsfläche), für ein Ergebnis, das der
//     Kunde ohnehin sofort sieht und annimmt oder verwirft.
//   · Das Logo liegt bereits im Browser: der Baukasten zeigt es. Es ein zweites
//     Mal über unsere Infrastruktur zu laden wäre Arbeit ohne Gegenwert.
//
// Was es NICHT tut: eine Palette „generieren", die schön aussieht. Es liest die
// häufigsten Farben aus, die im Bild WIRKLICH vorkommen. Ein schwarz-weißes
// Logo liefert deshalb Schwarz und Weiß und keine erfundene Markenwelt
// (Wurzel 4) — die UI benennt das Ergebnis als das, was es ist.

/** Ein Fund: Farbe plus ihr Anteil an den gezählten Bildpunkten. */
export type LogoFarbe = { hex: string; anteil: number };

/** Warum die Auslese nicht möglich war. Die UI übersetzt den Schlüssel; es wird
 *  KEIN Ergebnis vorgetäuscht (Wurzel 5, fail-closed). */
export type LogoFehler = "kein-logo" | "nicht-lesbar" | "gesperrt" | "leer";

export type LogoErgebnis =
  | { ok: true; farben: LogoFarbe[] }
  | { ok: false; grund: LogoFehler };

/** Kantenlänge, auf die das Logo vor dem Zählen verkleinert wird.
 *
 *  64 × 64 = 4096 Punkte. Das reicht, um die tragenden Flächen einer Marke zu
 *  treffen, und ist unabhängig davon, ob das Logo 200 oder 4000 Pixel breit
 *  ist — sonst hinge die Laufzeit an der Dateigröße des Kunden. */
const RASTER = 64;

/** Auf wie viele Stufen je Kanal zusammengefasst wird.
 *
 *  Ohne diese Bündelung liefert ein Logo mit Verlauf oder Kantenglättung
 *  hunderte fast gleicher Töne, und die „häufigste Farbe" wäre ein Zufall unter
 *  Nachbarn. 24 Stufen je Kanal fassen sichtbar Gleiches zusammen und trennen
 *  sichtbar Verschiedenes. */
const STUFEN = 24;

/** Ab welchem Anteil eine Farbe genannt wird. Alles darunter ist Kantensaum. */
const MINDESTANTEIL = 0.02;

function stufe(wert: number): number {
  return Math.min(STUFEN - 1, Math.floor((wert / 256) * STUFEN));
}

function hex(r: number, g: number, b: number): string {
  const teil = (n: number) => n.toString(16).padStart(2, "0");
  return `#${teil(r)}${teil(g)}${teil(b)}`;
}

/**
 * Die häufigsten Farben eines Logos auslesen.
 *
 * @param logoUrl Adresse des Logos (aus dem Branding).
 * @param anzahl  Wie viele Farben höchstens zurückkommen.
 */
export async function farbenAusLogo(
  logoUrl: string | null | undefined,
  anzahl = 6,
): Promise<LogoErgebnis> {
  if (!logoUrl) return { ok: false, grund: "kein-logo" };

  let bild: HTMLImageElement;
  try {
    bild = await ladeBild(logoUrl);
  } catch {
    return { ok: false, grund: "nicht-lesbar" };
  }

  const canvas = document.createElement("canvas");
  canvas.width = RASTER;
  canvas.height = RASTER;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { ok: false, grund: "nicht-lesbar" };
  ctx.drawImage(bild, 0, 0, RASTER, RASTER);

  let daten: Uint8ClampedArray;
  try {
    daten = ctx.getImageData(0, 0, RASTER, RASTER).data;
  } catch {
    // SecurityError: das Bild kommt von einem fremden Host ohne CORS-Freigabe,
    // die Zeichenfläche ist dadurch gesperrt. Das ist eine Browser-Regel und
    // kein Fehler unsererseits — und es wird auch nicht umgangen.
    return { ok: false, grund: "gesperrt" };
  }

  const zaehler = new Map<number, { n: number; r: number; g: number; b: number }>();
  let gezaehlt = 0;
  for (let i = 0; i < daten.length; i += 4) {
    const alpha = daten[i + 3]!;
    // Durchsichtige Punkte zählen nicht mit: ein Logo auf transparentem Grund
    // hätte sonst „Schwarz" als häufigste Farbe, obwohl dort nichts ist.
    if (alpha < 128) continue;
    const r = daten[i]!;
    const g = daten[i + 1]!;
    const b = daten[i + 2]!;
    const schluessel = stufe(r) * STUFEN * STUFEN + stufe(g) * STUFEN + stufe(b);
    const eintrag = zaehler.get(schluessel);
    if (eintrag) {
      eintrag.n += 1;
      eintrag.r += r;
      eintrag.g += g;
      eintrag.b += b;
    } else {
      zaehler.set(schluessel, { n: 1, r, g, b });
    }
    gezaehlt += 1;
  }
  if (!gezaehlt) return { ok: false, grund: "leer" };

  // Als Farbe zurückgegeben wird der MITTELWERT der Gruppe, nicht ihr
  // Rasterpunkt: der Rasterwert wäre eine gerundete Farbe, die im Logo so gar
  // nicht vorkommt.
  const farben = [...zaehler.values()]
    .map((e) => ({
      hex: hex(
        Math.round(e.r / e.n),
        Math.round(e.g / e.n),
        Math.round(e.b / e.n),
      ),
      anteil: e.n / gezaehlt,
    }))
    .filter((f) => f.anteil >= MINDESTANTEIL)
    .sort((a, b) => b.anteil - a.anteil)
    .slice(0, anzahl);

  return farben.length ? { ok: true, farben } : { ok: false, grund: "leer" };
}

function ladeBild(url: string): Promise<HTMLImageElement> {
  return new Promise((aufloesen, abweisen) => {
    const bild = new Image();
    // Ohne `crossOrigin` ist die Zeichenfläche nach `drawImage` in JEDEM Fall
    // gesperrt, auch wenn der Server CORS erlaubt. Mit gesetztem Attribut
    // klappt es, sobald der Speicher-Host `Access-Control-Allow-Origin`
    // schickt — und schlägt sonst sauber fehl, statt still ein leeres Ergebnis
    // zu liefern.
    bild.crossOrigin = "anonymous";
    bild.onload = () => aufloesen(bild);
    bild.onerror = () => abweisen(new Error("Logo nicht ladbar"));
    bild.src = url;
  });
}
