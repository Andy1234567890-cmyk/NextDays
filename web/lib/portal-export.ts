// Portal-Export (Booking.com-Extranet) → unsere Buchungs-Import-CSV, im BROWSER.
//
// WARUM IM BROWSER: Booking liefert den Export als echtes altes Binaer-Excel
// (CDFV2/OLE2, Magic `d0cf 11e0`), NICHT als CSV — die Datei landet also so im
// Datei-Dialog, wie das Portal sie verschickt. Der Import-Endpunkt nimmt
// dagegen Text (`content: str`), und das Backend hat keine Excel-Bibliothek.
// Die Umwandlung gehoert deshalb dorthin, wo die Datei schon liegt.
//
// WARUM NICHT SERVERSEITIG: eine Binaerdatei durch die API zu schieben, nur um
// sie dort zu zerlegen, waere ein zweiter Upload-Pfad mit eigenem Parser als
// Angriffsfläche (Wurzel 8). Hier verlaesst nur der fertige, geprüfte CSV-Text
// den Browser — dieselbe Nutzlast, die auch eine handgepflegte CSV schickt.
import * as XLSX from "xlsx";

// Zielspalten = apps/api/.../csv_import.CSV_COLUMNS. Reihenfolge identisch
// halten: der Endpunkt prueft die Kopfzeile.
const ZIEL = [
  "property",
  "guest_first_name",
  "guest_last_name",
  "arrival",
  "departure",
  "guest_email",
  "guest_phone",
  "num_guests",
  "total_amount",
  "currency",
  "source",
  "external_id",
  // Die ADRESSE der Unterkunft, so wie das Portal sie schreibt. Sie ist die
  // verlässlichere Kennung als der Name: Booking.coms Reservierungs-Export
  // trägt KEINE Unterkunfts-ID (gemessen an der echten Datei vom 31.08.2026 —
  // zwölf Spalten, keine davon eine Objektkennung), und der Name weicht
  // regelmäßig ab („Odden-hus-mygdal" bei uns „Odden-hygge-mygdal",
  // „Holiday home Dora" bei uns „Feriehus Dora"). Die Straße ändert sich nicht,
  // wenn jemand ein Inserat umbenennt.
  "property_address",
] as const;

// Booking benennt die Spalten je Sprache/Ansicht anders. Exakte Treffer stehen
// zuerst, damit „name des buchers" nicht vom kurzen „name" ueberstimmt wird.
const SPALTEN: Record<string, string[]> = {
  objekt: ["unterkunftsname", "property name", "property", "hotel", "unterkunft", "accommodation"],
  gast: ["name des buchers", "guest name", "booker name", "gastname", "guest", "gast", "name"],
  anreise: ["anreise", "check in", "checkin", "arrival", "ankomst"],
  abreise: ["abreise", "check out", "checkout", "departure", "afrejse"],
  status: ["status", "booking status", "buchungsstatus"],
  betrag: ["gesamtbetrag", "total price", "gesamtpreis", "amount", "betrag", "price", "total"],
  waehrung: ["waehrung", "wahrung", "currency", "valuta"],
  nummer: ["buchungsnummer", "book number", "booking number", "reservation number", "res id", "id"],
  // „Lage" steht im deutschen Booking-Export; sie enthält Straße + Hausnummer,
  // Zeilenumbruch, Ort und Land ("Lærkevej 2\nBindslev, Denmark").
  lage: ["lage", "location", "adresse", "address", "beliggenhed"],
  personen: ["personen", "persons", "guests", "people", "gaste", "gaeste"],
};

// Stornierte/No-Show werden NICHT importiert (Branchenstandard, siehe
// csv_import-Doku). Ein Storno ist keine Belegung — er wuerde den Kalender
// sperren, ohne dass je jemand anreist.
const RAUS = ["cancel", "storn", "annull", "no-show", "no show", "afvist"];

// Der Export schreibt „9. Mai 2024", kein ISO-Datum.
const MONATE: Record<string, number> = {
  januar: 1, february: 2, februar: 2, marz: 3, maerz: 3, march: 3, april: 4,
  mai: 5, may: 5, juni: 6, june: 7, juli: 7, july: 7, august: 8,
  september: 9, oktober: 10, october: 10, november: 11, dezember: 12, december: 12,
  january: 1, februari: 2,
};

/** Spaltenkopf vergleichbar machen: klein, ohne Diakritika/Sonderzeichen. */
function norm(s: string): string {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function finde(kopf: string[], feld: string): number {
  const kandidaten = (SPALTEN[feld] ?? []).map(norm);
  const normiert = kopf.map(norm);
  for (const k of kandidaten) {
    const i = normiert.indexOf(k);
    if (i >= 0) return i;
  }
  for (let i = 0; i < normiert.length; i++) {
    if (kandidaten.some((k) => k && normiert[i].includes(k))) return i;
  }
  return -1;
}

/** „9. Mai 2024" / ISO / TT.MM.JJJJ → YYYY-MM-DD. Leer bei Unlesbarem. */
function datum(wert: unknown): string {
  const t = (wert ?? "").toString().trim();
  if (!t) return "";
  const lang = t.match(/^(\d{1,2})\.\s*([^\s.]+)\s*(\d{4})/);
  if (lang) {
    const m = MONATE[norm(lang[2])];
    if (m) {
      const d = Number(lang[1]);
      return `${lang[3]}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const de = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (de) {
    return `${de[3]}-${String(Number(de[2])).padStart(2, "0")}-${String(
      Number(de[1]),
    ).padStart(2, "0")}`;
  }
  return "";
}

/** Zahl aus „1.234,50 DKK" loesen. Leer bleibt leer — ein erfundener 0-Preis
 *  waere schlimmer als kein Preis (Wurzel 4). */
function betrag(wert: unknown): string {
  const roh = (wert ?? "").toString();
  let t = roh.replace(/[^\d,.-]/g, "");
  if (!t) return "";
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  return t;
}

/**
 * Buchungsnummer als reine Ziffernfolge — der DEDUP-SCHLUESSEL.
 *
 * Sie landet im Import als `ota_reservation_code` und wird gegen
 * `reservations.external_ref` geprueft; dort steht bei den ueber die
 * Schnittstelle gekommenen Buchungen die nackte Nummer (live gemessen
 * 21.08.2026: `ota_name='BookingCom'` fuehrt `5008485743`, kein Praefix).
 *
 * Excel fuehrt die Nummer als ZAHL. Wird sie als Zahl gelesen, macht die
 * Umwandlung in Text `5535387537.0` daraus — und ein einziges angehaengtes
 * „.0" verhindert JEDEN Treffer: der Import findet die vorhandene Zeile nicht
 * und legt sie ein zweites Mal an. Gegen den echten Bestand gemessen waren das
 * 54 Doubletten, jede mit eigener Kalender-Belegung. In der Datei ist der
 * Fehler unsichtbar; er faellt erst im Kalender auf (Wurzel 2).
 *
 * Deshalb wird hier mit `raw: false` gelesen (SheetJS liefert dann den
 * formatierten Text) UND zusaetzlich ein etwaiges „.0" abgeschnitten — der
 * Guertel zum Hosentraeger, weil das Zellformat je Export abweichen kann.
 */
function nummer(wert: unknown): string {
  const t = (wert ?? "").toString().trim();
  if (!t) return "";
  const fliess = t.match(/^(\d+)\.0+$/);
  if (fliess) return fliess[1];
  // Exponentialschreibweise (5.535387537e+09) auflösen — sonst ginge die
  // Nummer als „5.535387537e+09" in die Datei und traefe nie.
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n) && Number.isInteger(n)) return String(n);
  }
  return t;
}

/** „Hansen, Ole" und „Ole Hansen" → ["Ole", "Hansen"]. */
function nameTeilen(voll: unknown): [string, string] {
  const v = (voll ?? "").toString().replace(/\s+/g, " ").trim();
  if (!v) return ["", ""];
  if (v.includes(",")) {
    const [nach, ...rest] = v.split(",");
    return [rest.join(",").trim(), nach.trim()];
  }
  const t = v.split(" ");
  return t.length > 1 ? [t[0], t.slice(1).join(" ")] : ["", t[0]];
}

function csvFeld(w: string): string {
  return /[",;\n\r]/.test(w) ? `"${w.replace(/"/g, '""')}"` : w;
}

export type ExportBefund = {
  /** Fertiger CSV-Text für POST /bookings/csv-import. */
  csv: string;
  /** Zeilen in der Datei (ohne Kopf). */
  gelesen: number;
  /** Zeilen in der CSV. */
  uebernommen: number;
  /** Warum Zeilen wegfielen, mit Anzahl. */
  ausgelassen: Record<string, number>;
  /** Frühestes/spätestes Anreisedatum der übernommenen Zeilen. */
  von: string;
  bis: string;
  /** Objektnamen, wie das Portal sie schreibt, mit Anzahl. Der Aufrufer prüft
   *  daran, ob sie zu den eigenen Objekttiteln passen — der Import trifft
   *  EXAKT und überspringt sonst still. */
  objekte: Record<string, number>;
  /** Zeilen ohne Buchungsnummer. Ihr Dedup-Schlüssel wird aus Objekt + Datum +
   *  Name abgeleitet — schwächer, deshalb sichtbar gemacht. */
  ohneNummer: number;
};

/**
 * Eine schon fertige Import-CSV (Vorlagen-Weg) als denselben Befund lesen.
 *
 * Damit zeigt die Oberfläche für BEIDE Wege dieselbe Vorschau — sonst wäre die
 * handgepflegte Datei der einzige Weg ohne Kontrolle der Objektnamen, und
 * genau dort passieren Tippfehler.
 *
 * Hier wird NICHT umgewandelt: die Spalten stehen schon richtig. Es wird nur
 * gezählt, damit vor dem Schreiben sichtbar ist, was hineinläuft.
 */
export function csvAlsBefund(text: string): ExportBefund {
  const roh = text.replace(/^\uFEFF/, "").trim();
  if (!roh) throw new Error("Die Datei ist leer.");
  const zeilen = roh.split(/\r?\n/);
  // Trennzeichen wie im Backend erkennen: EU-Excel schreibt Semikolon.
  const probe = zeilen[0];
  const trenner = (probe.match(/;/g) ?? []).length > (probe.match(/,/g) ?? []).length ? ";" : ",";
  const kopf = zeilen[0].split(trenner).map((s) => s.trim().replace(/^"|"$/g, ""));
  const fehlend = ["property", "guest_first_name", "guest_last_name", "arrival", "departure"].filter(
    (p) => !kopf.includes(p),
  );
  if (fehlend.length > 0) {
    throw new Error(
      `In der CSV fehlen Pflichtspalten: ${fehlend.join(", ")}. ` +
        `Nutze die Vorlage aus dem Knopf daneben.`,
    );
  }
  const iP = kopf.indexOf("property");
  const iA = kopf.indexOf("arrival");
  const iX = kopf.indexOf("external_id");
  const objekte: Record<string, number> = {};
  const anreisen: string[] = [];
  let ohneNummer = 0;
  let n = 0;
  for (const z of zeilen.slice(1)) {
    if (!z.trim()) continue;
    n++;
    const f = z.split(trenner).map((s) => s.trim().replace(/^"|"$/g, ""));
    const o = f[iP] ?? "";
    if (o) objekte[o] = (objekte[o] ?? 0) + 1;
    if (f[iA]) anreisen.push(f[iA]);
    if (iX >= 0 && !(f[iX] ?? "").trim()) ohneNummer++;
  }
  anreisen.sort();
  return {
    csv: roh + "\n",
    gelesen: n,
    uebernommen: n,
    ausgelassen: {},
    von: anreisen[0] ?? "",
    bis: anreisen[anreisen.length - 1] ?? "",
    objekte,
    ohneNummer,
  };
}

/**
 * Portal-Export (.xls/.xlsx/.csv) → Import-CSV.
 *
 * `jahr` grenzt auf Anreisen dieses Jahres ein (0 = alle). `umbenennen` bildet
 * Portal-Objektnamen auf die eigenen Objekttitel ab: Portal und PMS führen
 * dasselbe Haus oft unter verschiedenen Namen, und der Import trifft den Titel
 * exakt — ohne Abbildung fällt die Zeile still aus.
 */
export function portalExportNachCsv(
  daten: ArrayBuffer,
  opts: { jahr?: number; umbenennen?: Record<string, string> } = {},
): ExportBefund {
  const { jahr = 0, umbenennen = {} } = opts;
  const wb = XLSX.read(daten, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Die Datei enthält keine Tabelle.");
  // raw:false → Zahlen kommen als formatierter TEXT. Entscheidend für die
  // Buchungsnummer (siehe nummer()); defval:"" hält die Spaltenposition, wenn
  // eine Zelle leer ist.
  const zeilen = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
  });

  // Kopfzeile suchen: die erste Zeile, die Anreise UND Gast trägt. Der Export
  // hat je Ansicht Vorzeilen (Titel/Filter), deshalb nicht blind Zeile 0.
  let kopfIdx = -1;
  for (let i = 0; i < Math.min(20, zeilen.length); i++) {
    const k = (zeilen[i] ?? []).map((c) => (c ?? "").toString());
    if (finde(k, "anreise") >= 0 && finde(k, "gast") >= 0) {
      kopfIdx = i;
      break;
    }
  }
  if (kopfIdx < 0) {
    throw new Error(
      "Kopfzeile nicht erkannt — die Datei hat keine Spalten für Anreise und Gast. " +
        "Stammt sie wirklich aus dem Buchungs-Export des Portals?",
    );
  }

  const kopf = (zeilen[kopfIdx] ?? []).map((c) => (c ?? "").toString());
  const sp = Object.fromEntries(
    Object.keys(SPALTEN).map((f) => [f, finde(kopf, f)]),
  ) as Record<string, number>;

  const fehlend = (["objekt", "gast", "anreise", "abreise"] as const).filter(
    (f) => sp[f] < 0,
  );
  if (fehlend.length > 0) {
    throw new Error(
      `In der Datei fehlen Pflichtspalten: ${fehlend.join(", ")}. ` +
        `Gefunden wurden: ${kopf.filter(Boolean).join(", ")}`,
    );
  }

  const ausgelassen: Record<string, number> = {};
  const objekte: Record<string, number> = {};
  const raus: string[][] = [];
  let ohneNummer = 0;
  const zaehl = (d: Record<string, number>, k: string) => {
    d[k] = (d[k] ?? 0) + 1;
  };

  const datenZeilen = zeilen.slice(kopfIdx + 1).filter((z) =>
    (z ?? []).some((c) => (c ?? "").toString().trim()),
  );

  for (const z of datenZeilen) {
    const hole = (f: string) =>
      sp[f] >= 0 && sp[f] < z.length ? (z[sp[f]] ?? "").toString().trim() : "";

    const an = datum(hole("anreise"));
    const ab = datum(hole("abreise"));
    if (!an || !ab || ab <= an) {
      zaehl(ausgelassen, "Datum fehlt oder unplausibel");
      continue;
    }
    if (jahr && Number(an.slice(0, 4)) !== jahr) {
      zaehl(ausgelassen, `Anreise nicht ${jahr}`);
      continue;
    }
    const status = hole("status").toLowerCase();
    if (RAUS.some((r) => status.includes(r))) {
      zaehl(ausgelassen, "storniert oder No-Show");
      continue;
    }

    let objekt = hole("objekt");
    // Erst umbenennen, DANN zählen: sonst zeigte die Liste den Portal-Namen,
    // obwohl die Abbildung ihn längst auflöst.
    const abbild = umbenennen[objekt] ?? umbenennen[objekt.toLowerCase()];
    if (abbild) objekt = abbild;
    if (!objekt) {
      zaehl(ausgelassen, "Objektname fehlt");
      continue;
    }
    zaehl(objekte, objekt);

    const [vor, nach] = nameTeilen(hole("gast"));
    if (!vor && !nach) {
      zaehl(ausgelassen, "Gastname fehlt");
      continue;
    }

    const nr = nummer(hole("nummer"));
    if (!nr) ohneNummer++;

    raus.push([
      objekt,
      vor,
      nach,
      an,
      ab,
      "", // Der Export trägt keine Gast-Kontaktdaten.
      "",
      hole("personen").replace(/\D/g, ""),
      betrag(hole("betrag")),
      // Währung aus eigener Spalte; leer → der Import nimmt die
      // Objektwährung (kein EUR-Fallback, Wurzel 4).
      hole("waehrung").toUpperCase().slice(0, 3),
      "Booking.com",
      nr,
      // Zeilenumbruch zu Komma: die Lage kommt zweizeilig ("Straße 2\nOrt,
      // Land") und würde die CSV-Zeile sonst zerreißen.
      hole("lage").replace(/\s*\n\s*/g, ", ").trim(),
    ]);
  }

  const daten_ = raus.map((r) => r.map(csvFeld).join(","));
  const csv = [ZIEL.join(","), ...daten_].join("\n") + (daten_.length ? "\n" : "");
  const anreisen = raus.map((r) => r[3]).sort();

  return {
    csv,
    gelesen: datenZeilen.length,
    uebernommen: raus.length,
    ausgelassen,
    von: anreisen[0] ?? "",
    bis: anreisen[anreisen.length - 1] ?? "",
    objekte,
    ohneNummer,
  };
}
