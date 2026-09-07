// Eigentümer-Abrechnung als sauberes A4-PDF. Baut aus dem Statement ein
// eigenständiges HTML (Rechnungskopf PM/Owner, Buchungstabelle, je Buchung die
// Posten-Aufstellung, Abzüge und Gutschriften, Summenblock, Steuer) und schickt
// es an den HTML→PDF-Dienst (/api/v1/generate-pdf-single, Playwright). Bewusst
// ein eigenes Statement-Layout statt der InvoiceData-Templates: ein
// Owner-Statement hat eine andere Struktur als eine klassische Positions-Rechnung.
//
// GLIEDERUNG SEIT 02.09.2026 — Ansage des Betriebs, wörtlich: „Jede Gebühr muss
// als einzelner Posten aufgeschlüsselt werden auf der Abrechnung." Vorher stand
// unter jeder Zeile eine 9-px-Grauzeile „Portal −849,38 · Verwaltung −703,84 ·
// Pauschale −50,00 · Gebühren +725,00" — eine Summe ohne Aufstellung. Jetzt hat
// jede Buchung einen Posten-Block: Gesamtbetrag nach Portal-Abzug,
// Verwaltungsprovision mit Satz und Vertragsstichtag, Pauschale, die Gebühren
// des Eigentümers einzeln und ungekürzt, Eigentümer-Anteil. Immer, ohne
// Schwellwert.
//
// DAS PDF IST DIE EIGENTÜMERSICHT — FEST, NICHT ROLLENABHÄNGIG. Anlass
// (Betrieb, 02.09.2026): „Warum sieht der Eigentümer Gastpreis, was die Agentur
// bekommt?" Vorher entschied die Maske des BETRACHTERS, welche Spalten das PDF
// zeigt; die Agentur sah in der Vorschau ihre eigene Sicht und hielt sie für
// das Dokument des Eigentümers. Jetzt zeigt der Beleg NUR, was den Eigentümer
// betrifft: den Gesamtbetrag seiner Buchung NACH Portal-Abzug (Gastpreis minus
// Portal-Provision minus Zahlungsgebühr — die Zahl, die beim Betrieb ankommt),
// seine Provision, seine Pauschale, seine Gebühren, seinen Anteil, Abzüge und
// Gutschriften. Gastpreis, die Portalabzüge einzeln, Bemessungsgrundlage,
// Betriebsgebühren und Zusatzleistungen (auch nur dem Namen nach — „Wäschepaket
// 2 ×, verbleibt beim Betrieb" hat auf dem Eigentümerbeleg nichts verloren,
// Ansage 02.09.2026) erscheinen NICHT — auch nicht für einen Admin. Die
// Betriebszahlen stehen im Editor, nicht im Beleg.
//
// DAS PDF RECHNET NICHT. Jede Zahl kommt vom Server (RentalRow, Summary); die
// einzige Addition hier ist die Summe bereits gezeigter Beträge je Währung.
// Kontrollsummen (gebuehren_betrieb, gebuehren_an_eigentuemer, addon_total)
// werden vom Backend geliefert und dort per Test gegen die Liste gehalten.
//
// DIE SPRACHE IST DIE DES BELEGS, NICHT DES BETRACHTERS (0604, 07.09.2026).
// Bis dahin standen die Texte hart deutsch in dieser Datei (`const txt`), und
// Zahlen/Datum folgten `useLocale()` — der Oberflächensprache der Person, die
// gerade klickt. René Dahl Nielsen (`owners.language = 'da'`) bekam so eine
// deutsche „Eigentümer-Abrechnung", weil die Mitarbeiterin auf Deutsch
// arbeitet. Jetzt: `statement.language` (Snapshot am Beleg) bestimmt Texte
// (`texte`, aus `web/messages/<lang>.json` → `statementPdf.*`, geladen über
// `lib/beleg-texte`), Zahlen- und Datumsformat. Der Aufrufer übergibt die
// Texte; diese Datei kennt keine Sprache mehr selbst.
import type { StatementPdfTexte } from "@/lib/beleg-texte";
import { channelLabelLoose } from "@/lib/channel-logos";
import type {
  Expense,
  RentalRow,
  Statement,
  WiederkehrenderPosten,
} from "@/lib/owner-statements";

function fmt(amount: number, currency: string, locale: string): string {
  // Ungültige/leere Währung: reine Zahl OHNE Symbol (kein erfundenes EUR, kein
  // Intl-Crash) — konsistent zu lib/currency.formatCurrency, keine EUR-Erfindung.
  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  const valid = /^[A-Z]{3}$/.test(code);
  return new Intl.NumberFormat(locale, {
    ...(valid ? { style: "currency" as const, currency: code } : {}),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Betrag ODER „—", wenn es die Zahl nicht gibt.
 *
 *  `null` heisst hier „nicht berechenbar" (kein Provisionssatz hinterlegt)
 *  bzw. „maskiert" (§4.2) — NIE „0,00". Im PDF wiegt das besonders schwer:
 *  das Dokument bekommt der Eigentuemer in die Hand, und eine erfundene Null
 *  darin ist eine schriftliche Falschaussage ueber Geld (Wurzel 4). */
function fmtOderStrich(
  amount: number | null | undefined,
  currency: string,
  locale: string,
): string {
  return amount == null ? "—" : fmt(amount, currency, locale);
}

/** Vorzeichen ausdrücklich: „−1.075,00" / „+225,00". Für die Posten-Blöcke,
 *  in denen jede Zeile sagt, ob sie ab- oder zugeht. */
function fmtSigniert(
  amount: number,
  currency: string,
  locale: string,
  richtung: "minus" | "plus",
): string {
  const zeichen = richtung === "minus" ? "−" : "+";
  return `${zeichen}${fmt(Math.abs(amount), currency, locale)}`;
}

/** ISO-Kalendertag → Datum in der Sprache des Belegs. Kein Zeitzonen-Anteil:
 *  An-/Abreise sind `date`-Spalten, der Termin des Gastes (Wurzel 5b). */
function fmtDatum(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return esc(iso);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}

function fmtPct(pct: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(pct)} %`;
}

/** Auf dem Beleg steht vom Gast NUR der Vorname (Ansage des Betriebs,
 *  02.09.2026). Der Beleg geht an den Eigentümer; der volle Name gehört ihm
 *  nicht, unabhängig davon, wer den Beleg gerade erzeugt — die Rollen-Maske
 *  des Servers gibt einem Admin den vollen Namen, und genau der landete so im
 *  PDF. Erstes Token wie `guest_masking._first_name_only` im Backend. */
function vorname(s: string | null | undefined): string {
  if (!s) return "";
  return s.trim().split(" ", 1)[0] ?? "";
}

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Eine Adress-/Kontaktzeile — nur ausgeben, wenn befüllt (keine leeren <p>).
function line(value: string | null | undefined, strong = false): string {
  if (!value) return "";
  const v = esc(value);
  return strong ? `<p><strong>${v}</strong></p>` : `<p>${v}</p>`;
}

// Die Beschriftungen dieses Dokuments sind — wie der ganze Rest der Datei
// (Titel, „Aussteller") — deutsch. Das PDF ist der Beleg zwischen Betrieb und
// Eigentümer, kein Oberflächentext. Hier stehen sie gebündelt, damit eine
// spätere Übersetzung EINE Stelle hat statt Dutzender Template-Literale.
// Die Texte kommen vom Aufrufer (`StatementPdfTexte`, Namensraum
// `statementPdf.*`). Fehlt ein Schlüssel, steht der Schlüsselname im Beleg —
// sichtbar und damit auffindbar, statt eines stillen deutschen Rückfalls.
type Tx = StatementPdfTexte;
function t(tx: Tx, key: string): string {
  return tx[key] ?? key;
}

export type StatementPdfOptionen = {
  /** Anzeigenamen je Kanalschlüssel (`calendar.channel.*`), vom Aufrufer
   *  übergeben — das PDF hat keinen Hook-Zugriff und soll die Liste nicht
   *  duplizieren. `ota_name` der Buchung geht immer vor. */
  kanalLabels?: Record<string, string>;
  /** AUSZUG JE OBJEKT (13.3, 07.09.2026): nur die Buchungen und Posten dieses
   *  Objekts, Summen aus `listing_rows` des Servers. Anlass: „Der René ist
   *  Eigentümer von 3 Objekten … so dass er einmal für alle Objekte die
   *  Abrechnung hat und nach Objekten für jedes einzelne." Der Auszug ist KEIN
   *  eigener Beleg mit Nummer — dieselbe Buchung darf nicht zweimal
   *  abgerechnet werden (409 beim Finalisieren); er ist die Objektsicht der
   *  EINEN Abrechnung. Umsatzsteuer und Posten ohne Objektbezug stehen nur in
   *  der Gesamtabrechnung, der Auszug sagt das. */
  objektId?: string;
};

/** Dateiname-tauglicher Objekttitel (ASCII, Bindestriche). */
function dateiTeil(titel: string | null | undefined, ersatz: string): string {
  const roh = (titel ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const teil = roh.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return teil || ersatz;
}

/** Kanalname einer Zeile — EINE Schreibweise je Portal (13.7).
 *
 *  `ota_name` steht je Quelle verschieden in den Daten: der Feed schreibt
 *  Channex' Katalogcode `BookingCom`, der CSV-Import `Booking.com`. Beides ist
 *  dasselbe Portal und soll auf dem Beleg gleich heißen. `channelLabelLoose`
 *  ist derselbe Normalisierer wie in der Buchungskarte — keine zweite Liste.
 *  Ohne `ota_name` gilt das übersetzte Kanal-Label des Aufrufers. */
function kanalText(r: RentalRow, opts: StatementPdfOptionen): string {
  if (r.ota_name) return channelLabelLoose(r.ota_name);
  return opts.kanalLabels?.[r.channel] ?? r.channel;
}

function modusText(modus: WiederkehrenderPosten["modus"], tx: Tx): string {
  if (modus === "je_nacht") return t(tx, "perNight");
  if (modus === "je_zeitraum") return t(tx, "perPeriod");
  return t(tx, "perBooking");
}

/** Eine Posten-Zeile im Block. `wert === null` → kein Betrag, nur Text (die
 *  Zeile ist maskiert oder eine Überschrift). */
function posten(
  label: string,
  wert: string | null,
  klasse: "" | "sum" | "head" | "head-sum" | "muted" = "",
): string {
  const cls = klasse ? ` class="${klasse}"` : "";
  return `<tr${cls}><td>${label}</td><td class="num">${wert ?? ""}</td></tr>`;
}

/** Der Posten-Block EINER Buchung — die Kette des Servers, Zeile für Zeile.
 *
 *  Erster Summand ist der Gesamtbetrag NACH Portal-Abzug (`auszahlungsbasis`,
 *  serverseitig unmaskiert). Gebühren und Zusatzleistungen des Betriebs
 *  kommen NICHT vor, auch nicht dem Namen nach. Regel für fehlende Werte: eine
 *  Zeile mit `null` wird WEGGELASSEN, nicht als „—" oder 0 gezeigt. */
function buchungsBlock(
  r: RentalRow,
  ownerCur: string,
  locale: string,
  tx: Tx,
  opts: StatementPdfOptionen,
): string {
  const rc = r.currency;
  const zeilen: string[] = [];

  // Ausgangspunkt: was vom Gastpreis nach dem Portal beim Betrieb ankommt.
  if (r.auszahlungsbasis !== null) {
    zeilen.push(
      posten(
        `${t(tx, "posAfterPortal")}<br><span class="muted">${t(tx, "posAfterPortalHint")}</span>`,
        fmt(r.auszahlungsbasis, rc, locale),
        "head-sum",
      ),
    );
  }

  if (r.verwaltungsprovision !== null) {
    let herkunft = "";
    if (r.provision_quelle === "vertrag") {
      herkunft = r.vertrag_gueltig_ab
        ? ` (${t(tx, "posContractFrom")} ${fmtDatum(r.vertrag_gueltig_ab, locale)})`
        : "";
    } else if (r.provision_quelle === "override") {
      herkunft = ` (${t(tx, "posRateManual")})`;
    } else if (r.provision_quelle === "altspalten") {
      herkunft = ` (${t(tx, "posRateLegacy")})`;
    }
    const satz = r.provisions_pct !== null ? fmtPct(r.provisions_pct, locale) : "";
    const label = r.min_provision_angewandt
      ? `− ${t(tx, "posMinCommission")} ${satz}${herkunft}`
      : `− ${t(tx, "posCommission")} ${satz}${herkunft}`;
    zeilen.push(posten(label, fmtSigniert(r.verwaltungsprovision, rc, locale, "minus")));
  }
  if (r.pauschale !== null && r.pauschale !== 0) {
    zeilen.push(posten(`− ${t(tx, "posFlatFee")}`, fmtSigniert(r.pauschale, rc, locale, "minus")));
  }

  // Die Gebühren des EIGENTÜMERS — jede einzeln, ungekürzt durch Provision.
  const eigene = r.gebuehren.filter((g) => g.gehoert_zu === "eigentuemer");
  if (eigene.length) {
    zeilen.push(posten(t(tx, "posFeesBack"), null, "head"));
    for (const g of eigene) {
      const zusatz = g.provisionspflichtig ? ` · ${t(tx, "commissionable")}` : "";
      zeilen.push(
        posten(
          `+ ${esc(g.label || g.art)}${zusatz}`,
          g.betrag === null ? "—" : fmtSigniert(g.betrag, rc, locale, "plus"),
        ),
      );
    }
  }

  // Eigentümer-Anteil, bei Fremdwährung mit Umrechnung und Kurs.
  const anteil =
    rc !== ownerCur && r.owner_payout_converted !== null
      ? `${fmtOderStrich(r.owner_payout_converted, ownerCur, locale)}<br><span class="muted">${fmtOderStrich(r.owner_payout, rc, locale)} · ${t(tx, "posRate")} ${r.fx_rate} (${esc(r.fx_date)})</span>`
      : fmtOderStrich(r.owner_payout, rc, locale);
  zeilen.push(posten(t(tx, "posOwnerShare"), anteil, "sum"));

  const fussnote =
    r.gebuehren_quelle === "ota_ohne_aufstellung"
      ? `<p class="muted note">${t(tx, "noFeesReported")}</p>`
      : "";

  const kopf = [
    esc(r.listing) || "—",
    esc(vorname(r.guest)) || "—",
    esc(kanalText(r, opts)),
  ].join(" · ");
  const zeit = `${t(tx, "arrival")} ${fmtDatum(r.check_in, locale)} · ${t(tx, "departure")} ${fmtDatum(r.check_out, locale)} · ${r.nights} ${t(tx, "nights")}`;

  return `
    <div class="block">
      <div class="block-head"><strong>${kopf}</strong><br><span class="muted">${zeit}</span></div>
      <table class="posten"><tbody>${zeilen.join("")}</tbody></table>
      ${fussnote}
    </div>`;
}

export function buildStatementHtml(
  st: Statement,
  texte: StatementPdfTexte,
  opts: StatementPdfOptionen = {},
): string {
  const tx = texte;
  // Zahlen- und Datumsformat folgen der Sprache DES BELEGS (0604).
  const locale = st.language;
  const h = st.header;
  const cur = st.summary.currency;
  const ownerCur = st.summary.owner_currency || cur;
  const isStorno = st.kind === "cancellation";
  const belegTitel = isStorno ? t(tx, "storno") : t(tx, "invoice");
  // Auszug je Objekt: die Objektzeile des Servers ist die Quelle der Summen.
  // Ein unbekanntes Objekt ist ein Aufruffehler — laut, nicht als leerer
  // Auszug mit 0,00 (Wurzel 4/5).
  const auszug = opts.objektId
    ? st.listing_rows.find((l) => l.listing_id === opts.objektId)
    : undefined;
  if (opts.objektId && !auszug) {
    throw new Error(`Objekt ${opts.objektId} gehört nicht zu dieser Abrechnung.`);
  }
  const auszugTitel = auszug
    ? esc(auszug.listing || st.objekte.find((o) => o.id === auszug.listing_id)?.title) ||
      esc(auszug.listing_id)
    : "";
  const title = auszug ? t(tx, "excerpt") : belegTitel;
  // Objektmenge im Kopf (0603): welche Objekte dieser Beleg umfasst. Bei einer
  // Teilmenge die Namen, sonst „alle Objekte" — ohne diese Zeile sähen zwei
  // Belege desselben Monats (einer je Haus) identisch aus. Im Auszug: DAS Objekt.
  const objektZeile = auszug
    ? `${t(tx, "object")}: ${auszugTitel}`
    : st.property_ids && st.property_ids.length
      ? `${t(tx, "objects")}: ${st.objekte.map((o) => esc(o.title) || esc(o.id)).join(", ")}`
      : `${t(tx, "objects")}: ${t(tx, "allObjects")}`;

  // DATEN-SPLIT (§4.2) im PDF: Der Server maskiert den Gast-Bruttopreis und den
  // Ertrag der Verwaltung für einen Eigentümer zu `null`. Betroffene Spalten
  // und Zeilen werden dann GAR NICHT gerendert — nicht als „—", nicht als 0,00.
  // Im Auszug nur die Zeilen und Posten DIESES Objekts (Posten ohne Objektbezug
  // gehören keinem Haus und bleiben der Gesamtabrechnung).
  const rows = auszug
    ? st.rental_rows.filter((r) => r.listing_id === auszug.listing_id)
    : st.rental_rows;
  const expenses = auszug
    ? st.expenses.filter((e) => e.listing_id === auszug.listing_id)
    : st.expenses;
  const recurring = auszug
    ? (st.recurring ?? []).filter((p) => p.property_id === auszug.listing_id)
    : (st.recurring ?? []);
  const zeigtPauschale = rows.some((r) => (r.pauschale ?? 0) !== 0);

  // --- Buchungstabelle (Übersicht) -------------------------------------------
  // Spaltenreihenfolge vom BELEG (0605): dieselbe Liste wie im Editor —
  // „wenn wir es verschieben wird es nicht an vorschau weitergeben". Die
  // Betriebsspalten (`gross`, `portal`) kennt der Eigentümerbeleg nicht; sie
  // werden übersprungen. Fehlende Schlüssel (Beleg von vor 0605) kommen in
  // Standardfolge hinten dazu.
  type PdfSpalte = { kopf: string; zelle: (r: RentalRow) => string };
  const pdfSpalten: Partial<Record<string, PdfSpalte>> = {
    listing: { kopf: `<th>${t(tx, "listing")}</th>`, zelle: (r) => `<td>${esc(r.listing) || "—"}</td>` },
    guest: { kopf: `<th>${t(tx, "guest")}</th>`, zelle: (r) => `<td>${esc(vorname(r.guest)) || "—"}</td>` },
    check_in: { kopf: `<th>${t(tx, "arrival")}</th>`, zelle: (r) => `<td>${fmtDatum(r.check_in, locale)}</td>` },
    check_out: { kopf: `<th>${t(tx, "departure")}</th>`, zelle: (r) => `<td>${fmtDatum(r.check_out, locale)}</td>` },
    nights: { kopf: `<th class="num">${t(tx, "nights")}</th>`, zelle: (r) => `<td class="num">${r.nights}</td>` },
    channel: { kopf: `<th>${t(tx, "channel")}</th>`, zelle: (r) => `<td>${esc(kanalText(r, opts))}</td>` },
    commission: {
      kopf: `<th class="num">${t(tx, "commission")}</th>`,
      zelle: (r) => `<td class="num">${fmtOderStrich(r.verwaltungsprovision, r.currency, locale)}</td>`,
    },
    ...(zeigtPauschale
      ? {
          flat_fee: {
            kopf: `<th class="num">${t(tx, "flatFee")}</th>`,
            zelle: (r: RentalRow) => `<td class="num">${fmtOderStrich(r.pauschale, r.currency, locale)}</td>`,
          },
        }
      : {}),
    owner_payout: {
      kopf: `<th class="num">${t(tx, "ownerShare")}</th>`,
      zelle: (r) => {
        const rc = r.currency;
        const anteil =
          rc !== ownerCur && r.owner_payout_converted !== null
            ? fmtOderStrich(r.owner_payout_converted, ownerCur, locale)
            : fmtOderStrich(r.owner_payout, rc, locale);
        return `<td class="num"><strong>${anteil}</strong></td>`;
      },
    },
  };
  const standardFolge = Object.keys(pdfSpalten);
  const folge = [
    ...st.column_order.filter((k) => k in pdfSpalten),
    ...standardFolge.filter((k) => !st.column_order.includes(k as (typeof st.column_order)[number])),
  ];
  const aktive = folge.map((k) => pdfSpalten[k]).filter((sp): sp is PdfSpalte => Boolean(sp));
  const kopfzellen = aktive.map((sp) => sp.kopf);
  const spalten = kopfzellen.length;
  const tabelle = rows
    .map((r) => `
      <tr>${aktive.map((sp) => sp.zelle(r)).join("")}</tr>`)
    .join("");

  // --- Posten-Block je Buchung, IMMER (§2.0) ---------------------------------
  const bloecke = rows.map((r) => buchungsBlock(r, ownerCur, locale, tx, opts)).join("");

  // --- Abzüge und Gutschriften: Verrechnungsposten + wiederkehrende Posten ---
  const abzuege: string[] = [];
  const gutschriften: string[] = [];
  const postenZeile = (label: string, quelle: string, wert: string, zulasten: boolean) =>
    `<tr><td>${label}<br><span class="muted">${quelle}</span></td><td class="num"${zulasten ? ' style="color:#b42318"' : ""}>${wert}</td></tr>`;
  for (const e of expenses as Expense[]) {
    const zulasten = e.direction === "from_owner";
    const quelle = [
      t(tx, "srcExpense"),
      fmtDatum(e.date, locale),
      e.category ? esc(e.category) : "",
      e.has_receipt ? `${t(tx, "receipt")} ✓` : "",
      e.created_by_name ? esc(e.created_by_name) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const wert = fmtSigniert(e.signed_amount, e.currency || cur, locale, e.signed_amount < 0 ? "minus" : "plus");
    (zulasten ? abzuege : gutschriften).push(postenZeile(esc(e.concept), quelle, wert, zulasten));
  }
  for (const p of recurring) {
    const zulasten = p.betrag < 0;
    const quelle = `${t(tx, "srcRecurring")} · ${p.anzahl} ${t(tx, "quantity")} ${fmt(p.einzelbetrag, p.currency, locale)} ${modusText(p.modus, tx)}`;
    const wert = fmtSigniert(p.betrag, p.currency, locale, zulasten ? "minus" : "plus");
    (zulasten ? abzuege : gutschriften).push(postenZeile(esc(p.label), quelle, wert, zulasten));
  }
  const abzugBlock =
    abzuege.length || gutschriften.length
      ? `<div class="section-title">${t(tx, "deductionsTitle")}</div>
         <table>
           <tbody>
             ${abzuege.length ? `<tr class="head"><td colspan="2">${t(tx, "deductions")}</td></tr>${abzuege.join("")}` : ""}
             ${gutschriften.length ? `<tr class="head"><td colspan="2">${t(tx, "credits")}</td></tr>${gutschriften.join("")}` : ""}
           </tbody>
         </table>`
      : "";

  // --- Summenblock -------------------------------------------------------------
  // Die Richtungssummen der Verrechnungsposten werden aus den POSTEN gebildet,
  // je WÄHRUNG getrennt (quer darüber addiert man sonst DKK auf EUR). Die
  // wiederkehrenden Posten stehen bereits in der Summary in Owner-Währung.
  const postenWaehrungen = new Set(expenses.map((e) => e.currency || cur));
  const eineWaehrung = postenWaehrungen.size <= 1;
  const summenZeilen: string[] = [];
  const row = (label: string, wert: string, klasse = "") =>
    `<div class="row${klasse ? ` ${klasse}` : ""}"><span>${label}</span><span>${wert}</span></div>`;

  // Σ Eigentümer-Anteile: im Auszug die Objektsumme des Servers, sonst die
  // Summe der GEZEIGTEN Zeilenwerte in Owner-Währung.
  const anteileBekannt = rows.every((r) => r.owner_payout_converted !== null);
  if (rows.length) {
    const summeAnteile = auszug
      ? auszug.owner_payout
      : rows.reduce((s, r) => s + (r.owner_payout_converted ?? 0), 0);
    summenZeilen.push(
      row(
        `${t(tx, "sumShares")} (${rows.length})`,
        anteileBekannt && summeAnteile !== null ? fmt(summeAnteile, ownerCur, locale) : "—",
      ),
    );
  }
  // Pauschalen-Ausweis nur in der Gesamtabrechnung — die Summary trägt ihn für
  // alle Objekte, eine Aufteilung je Objekt hat der Server nicht.
  if (!auszug && st.summary.pauschalen_gesamt !== null && st.summary.pauschalen_gesamt !== 0) {
    const n = rows.filter((r) => (r.pauschale ?? 0) !== 0).length;
    summenZeilen.push(
      row(
        `${t(tx, "sumFlatFees")} (${n})<br><span class="muted">${t(tx, "sumFlatFeesNote")}</span>`,
        `<span class="muted">${fmtSigniert(st.summary.pauschalen_gesamt, ownerCur, locale, "minus")}</span>`,
      ),
    );
  }
  for (const wc of postenWaehrungen) {
    const zu = expenses
      .filter((e) => (e.currency || cur) === wc && e.direction !== "from_owner")
      .reduce((s, e) => s + Math.abs(e.amount), 0);
    const ab = expenses
      .filter((e) => (e.currency || cur) === wc && e.direction === "from_owner")
      .reduce((s, e) => s + Math.abs(e.amount), 0);
    const suffix = eineWaehrung ? "" : ` (${esc(wc)})`;
    if (ab > 0) summenZeilen.push(row(`− ${t(tx, "sumDeductions")} · ${t(tx, "srcExpense")}${suffix}`, fmtSigniert(ab, wc, locale, "minus")));
    if (zu > 0) summenZeilen.push(row(`+ ${t(tx, "sumCredits")} · ${t(tx, "srcExpense")}${suffix}`, fmtSigniert(zu, wc, locale, "plus")));
  }
  // Wiederkehrende Posten und Endsumme: aus der Objektzeile (Auszug) oder der
  // Summary (Gesamt) — beides Zahlen des Servers, hier wird nicht gerechnet.
  const quelle = auszug ?? st.summary;
  if (quelle.recurring_from_owner !== 0) {
    summenZeilen.push(
      row(`− ${t(tx, "sumDeductions")} · ${t(tx, "srcRecurring")}`, fmtSigniert(quelle.recurring_from_owner, ownerCur, locale, "minus")),
    );
  }
  if (quelle.recurring_to_owner !== 0) {
    summenZeilen.push(
      row(`+ ${t(tx, "sumCredits")} · ${t(tx, "srcRecurring")}`, fmtSigniert(quelle.recurring_to_owner, ownerCur, locale, "plus")),
    );
  }
  summenZeilen.push(
    row(
      `${auszug ? t(tx, "excerptPayout") : t(tx, "sumOwnerPayout")} (${esc(ownerCur)})`,
      fmtOderStrich(auszug ? auszug.payout : st.summary.owner_payout, ownerCur, locale),
      "grand",
    ),
  );

  // --- Übersicht je Objekt (nur Gesamtabrechnung über mehrere Objekte) -------
  // „einmal für alle Objekte … und nach Objekten für jedes einzelne": die
  // Gesamtabrechnung weist je Objekt aus, was ihm zusteht; die Zeile „ohne
  // Objektbezug" hält die Spalte zur Endsumme geschlossen. Alle Zahlen vom
  // Server (`listing_rows`, `ohne_objekt`, `summary`).
  let objektTabelle = "";
  if (!auszug && st.listing_rows.length > 1) {
    const rest = st.ohne_objekt;
    const restAb = rest.expenses_from_owner + rest.recurring_from_owner;
    const restZu = rest.expenses_to_owner + rest.recurring_to_owner;
    const zeile = (
      name: string,
      buchungen: string,
      naechte: string,
      anteile: string,
      ab: number,
      zu: number,
      payout: string,
      klasse = "",
    ) =>
      `<tr${klasse ? ` class="${klasse}"` : ""}><td>${name}</td><td class="num">${buchungen}</td><td class="num">${naechte}</td><td class="num">${anteile}</td><td class="num">${ab ? fmtSigniert(ab, ownerCur, locale, "minus") : "—"}</td><td class="num">${zu ? fmtSigniert(zu, ownerCur, locale, "plus") : "—"}</td><td class="num"><strong>${payout}</strong></td></tr>`;
    const zeilen = st.listing_rows.map((l) =>
      zeile(
        esc(l.listing) || esc(l.listing_id),
        String(l.reservations),
        String(l.nights),
        fmtOderStrich(l.owner_payout, ownerCur, locale),
        l.expenses_from_owner + l.recurring_from_owner,
        l.expenses_to_owner + l.recurring_to_owner,
        fmtOderStrich(l.payout, ownerCur, locale),
      ),
    );
    if (restAb || restZu) {
      zeilen.push(
        zeile(`<span class="muted">${t(tx, "noObjectRef")}</span>`, "", "", "", restAb, restZu, fmtSigniert(restZu - restAb, ownerCur, locale, restZu - restAb < 0 ? "minus" : "plus")),
      );
    }
    const alleAnteile = st.listing_rows.every((l) => l.owner_payout !== null);
    zeilen.push(
      zeile(
        `<strong>${t(tx, "total")}</strong>`,
        String(st.summary.booking_count),
        String(st.listing_rows.reduce((n, l) => n + l.nights, 0)),
        alleAnteile
          ? fmt(st.listing_rows.reduce((n, l) => n + (l.owner_payout ?? 0), 0), ownerCur, locale)
          : "—",
        st.summary.expenses_from_owner + st.summary.recurring_from_owner,
        st.summary.expenses_to_owner + st.summary.recurring_to_owner,
        fmtOderStrich(st.summary.owner_payout, ownerCur, locale),
        "total",
      ),
    );
    objektTabelle = `
    <div class="section-title">${t(tx, "perObjectTitle")}</div>
    <table>
      <thead><tr><th>${t(tx, "object")}</th><th class="num">${t(tx, "bookingsCount")}</th><th class="num">${t(tx, "nights")}</th><th class="num">${t(tx, "ownerShares")}</th><th class="num">${t(tx, "deductionsShort")}</th><th class="num">${t(tx, "creditsShort")}</th><th class="num">${t(tx, "payout")}</th></tr></thead>
      <tbody>${zeilen.join("")}</tbody>
    </table>`;
  }

  // Steuer: die Verwaltungsprovision ist die Leistung des Betriebs an den
  // Eigentümer — die Umsatzsteuer darauf gehört auf SEINEN Beleg. Erst nach
  // dem Finalisieren gesetzt (`tax.gross`), sonst leer.
  const steuerZeilen: string[] = [];
  if (!auszug && st.tax.gross) {
    steuerZeilen.push(row(t(tx, "vatNet"), fmt(st.tax.net, cur, locale)));
    steuerZeilen.push(
      st.tax.category === "S"
        ? row(`${t(tx, "vat")} (${st.tax.rate}%)`, fmt(st.tax.tax, cur, locale))
        : row(t(tx, "vat"), esc(st.tax.exemption_reason) || "0,00"),
    );
    steuerZeilen.push(row(t(tx, "vatGross"), fmt(st.tax.gross, cur, locale), "strong"));
  }

  return `<!doctype html><html lang="${esc(locale)}"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; font-size: 11px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { color: #666; margin-bottom: 24px; }
    .muted { color: #777; font-size: 9px; }
    .note { margin: 4px 0 0; }
    .parties { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 28px; }
    .party { width: 48%; }
    .party h3 { font-size: 11px; text-transform: uppercase; color: #888; margin: 0 0 6px; }
    .party p { margin: 1px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding: 5px 6px; }
    td { padding: 5px 6px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr.head td { font-weight: 700; font-size: 9px; text-transform: uppercase; color: #888; border-bottom: none; padding-top: 10px; }
    tr.total td { border-top: 2px solid #1a1a1a; border-bottom: none; font-weight: 700; }
    .num { text-align: right; white-space: nowrap; }
    .section-title { font-size: 13px; font-weight: 700; margin: 18px 0 8px; }
    .block { break-inside: avoid; border: 1px solid #e5e5e5; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; }
    .block-head { margin-bottom: 6px; }
    table.posten { margin-bottom: 0; }
    table.posten td { padding: 3px 4px; border-bottom: none; }
    table.posten tr.sum td { border-top: 1px solid #ddd; font-weight: 700; padding-top: 5px; }
    table.posten tr.head-sum td { font-weight: 700; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    table.posten tr.head td { padding-top: 8px; }
    table.posten tr.muted td { color: #777; }
    .totals { margin-left: auto; width: 340px; margin-top: 16px; }
    .totals .row { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; }
    .totals .row > span:last-child { white-space: nowrap; text-align: right; }
    .totals .grand { font-weight: 700; font-size: 14px; border-top: 2px solid #1a1a1a; padding-top: 8px; margin-top: 4px; }
    .totals .strong { font-weight: 700; }
    .betrieb { margin-left: auto; width: 340px; margin-top: 18px; padding-top: 8px; border-top: 1px dashed #bbb; }
    .betrieb .title { font-size: 9px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; }
    .logo { max-height: 64px; max-width: 200px; object-fit: contain; }
  </style></head><body>
    <div class="head">
      <div>
        <h1>${title}</h1>
        ${auszug ? `<div class="meta" style="margin-bottom:0">${t(tx, "excerptOf")} ${belegTitel}${h.invoice_number ? ` ${t(tx, "invoiceNo")} ${esc(h.invoice_number)}` : ""}</div>` : ""}
        <div class="meta" style="margin-bottom:0">
          ${!auszug && h.invoice_number ? `${t(tx, "invoiceNo")} ${esc(h.invoice_number)} · ` : ""}
          ${t(tx, "period")} ${fmtDatum(st.period_from, locale)} – ${fmtDatum(st.period_to, locale)}
          ${st.invoice_date ? ` · ${fmtDatum(st.invoice_date, locale)}` : ""}
        </div>
        <div class="meta" style="margin-bottom:0">${objektZeile}</div>
      </div>
      ${h.pm_logo_url ? `<img class="logo" src="${esc(h.pm_logo_url)}" alt="Logo" />` : ""}
    </div>

    <div class="parties">
      <div class="party">
        <h3>${t(tx, "issuer")}</h3>
        ${line(h.pm_name, true)}
        ${line(h.pm_address)}
        ${line(h.pm_email)}
        ${line(h.pm_phone)}
        ${h.pm_tax_id ? `<p>${t(tx, "vatId")}: ${esc(h.pm_tax_id)}</p>` : ""}
      </div>
      <div class="party">
        <h3>${t(tx, "owner")}</h3>
        ${line(h.owner_name, true)}
        ${line(h.owner_address)}
        ${line(h.owner_email)}
        ${line(h.owner_phone)}
        ${h.owner_tax_id ? `<p>${t(tx, "vatId")}: ${esc(h.owner_tax_id)}</p>` : ""}
      </div>
    </div>

    <div class="section-title">${t(tx, "bookings")}</div>
    <table>
      <thead><tr>${kopfzellen.join("")}</tr></thead>
      <tbody>${tabelle || `<tr><td colspan="${spalten}" style="color:#888">${t(tx, "noBookings")}</td></tr>`}</tbody>
    </table>

    ${objektTabelle}

    ${rows.length ? `<div class="section-title">${t(tx, "breakdownTitle")}</div>${bloecke}` : ""}

    ${abzugBlock}

    <div class="totals">${summenZeilen.join("")}</div>
    ${steuerZeilen.length ? `<div class="betrieb">${steuerZeilen.join("")}</div>` : ""}
    ${auszug ? `<p class="meta" style="margin-top:24px">${t(tx, "excerptNote")}</p>` : ""}

    ${st.tax.exemption_reason ? `<p class="meta" style="margin-top:24px">${esc(st.tax.exemption_reason)}</p>` : ""}
    ${h.notes ? `<p class="meta">${esc(h.notes)}</p>` : ""}
  </body></html>`;
}

/** Erzeugt das PDF über den Render-Dienst und stößt den Download an. */
export async function downloadStatementPdf(
  st: Statement,
  texte: StatementPdfTexte,
  opts: StatementPdfOptionen = {},
): Promise<void> {
  const res = await fetch("/api/v1/generate-pdf-single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmlContent: buildStatementHtml(st, texte, opts) }),
  });
  // Die Fehlermeldung des Dienstes DURCHREICHEN, nicht verschlucken: die Route
  // legt die Ursache in `error` ab (fehlender Browser, zu großes HTML …). Ein
  // pauschales „fehlgeschlagen" ließ am 07.09.2026 niemanden erkennen, warum.
  let data: { success?: boolean; pdfBase64?: string; error?: string } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    /* kein JSON — Status reicht dann als Aussage */
  }
  if (!res.ok || !data.success) {
    const ursache = data.error ? ` — ${data.error.split("\n")[0]}` : "";
    throw new Error(`PDF-Dienst antwortete ${res.status}${ursache}`);
  }
  if (!data.pdfBase64) throw new Error("Leeres PDF.");

  const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const name = st.header.invoice_number || `abrechnung-${st.period_from}`;
  // Auszug je Objekt: Objektname im Dateinamen, sonst hießen drei Auszüge gleich.
  const objekt = opts.objektId
    ? st.listing_rows.find((l) => l.listing_id === opts.objektId)
    : undefined;
  const zusatz = objekt ? `-${dateiTeil(objekt.listing, objekt.listing_id.slice(0, 8))}` : "";
  a.download = `${name}${zusatz}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
