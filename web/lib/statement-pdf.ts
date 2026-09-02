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
const txt = {
  // Kopf
  invoice: "Eigentümer-Abrechnung",
  storno: "Stornorechnung",
  issuer: "Aussteller",
  owner: "Eigentümer",
  vatId: "USt-IdNr.",
  period: "Zeitraum",
  // Buchungstabelle
  bookings: "Buchungen",
  listing: "Objekt",
  guest: "Gast",
  arrival: "Anreise",
  departure: "Abreise",
  nights: "Nächte",
  channel: "Kanal",
  commission: "Provision",
  flatFee: "Pauschale",
  ownerShare: "Eigentümer-Anteil",
  noBookings: "Keine Reservierungen im Zeitraum.",
  // Posten-Block
  breakdownTitle: "Aufstellung je Buchung",
  posAfterPortal: "Gesamtbetrag nach Portal-Abzug",
  posAfterPortalHint: "Gastpreis abzüglich Portal-Provision und Portal-Zahlungsgebühr",
  posCommission: "Verwaltungsprovision",
  posMinCommission: "Mindestprovision (Vertrag) statt",
  posContractFrom: "Vertrag ab",
  posRateManual: "manuell in dieser Abrechnung",
  posRateLegacy: "Standardsatz aus den Stammdaten",
  posFlatFee: "Pauschale je Buchung/Nacht (Vertrag)",
  posFeesBack: "Ihre Gebühren — ungekürzt, ohne Provision",
  posOwnerShare: "= Eigentümer-Anteil",
  posRate: "Kurs",
  commissionable: "provisionspflichtig",
  quantity: "×",
  noFeesReported:
    "Das Portal hat zu dieser Buchung keine Gebühren gemeldet; es wurden deshalb keine angesetzt.",
  // Abzüge und Gutschriften
  deductionsTitle: "Abzüge und Gutschriften",
  deductions: "Abzüge (zulasten des Eigentümers)",
  credits: "Gutschriften (zugunsten des Eigentümers)",
  srcExpense: "Verrechnungsposten",
  srcRecurring: "wiederkehrend",
  receipt: "Beleg",
  perBooking: "je Buchung",
  perNight: "je Nacht",
  perPeriod: "je Zeitraum",
  // Summen
  sumShares: "Summe Eigentümer-Anteile aus Buchungen",
  sumFlatFees: "Pauschalen aus Vertrag",
  sumFlatFeesNote: "bereits in den Anteilen berücksichtigt — kein weiterer Abzug",
  sumDeductions: "Abzüge",
  sumCredits: "Gutschriften",
  sumOwnerPayout: "Eigentümer-Auszahlung",
  vat: "Umsatzsteuer",
  vatNet: "Verwaltungsprovision netto",
  vatGross: "Verwaltungsprovision brutto",
} as const;

export type StatementPdfOptionen = {
  /** Anzeigenamen je Kanalschlüssel (`calendar.channel.*`), vom Aufrufer
   *  übergeben — das PDF hat keinen Hook-Zugriff und soll die Liste nicht
   *  duplizieren. `ota_name` der Buchung geht immer vor. */
  kanalLabels?: Record<string, string>;
};

function kanalText(r: RentalRow, opts: StatementPdfOptionen): string {
  return r.ota_name ?? opts.kanalLabels?.[r.channel] ?? r.channel;
}

function modusText(modus: WiederkehrenderPosten["modus"]): string {
  if (modus === "je_nacht") return txt.perNight;
  if (modus === "je_zeitraum") return txt.perPeriod;
  return txt.perBooking;
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
  opts: StatementPdfOptionen,
): string {
  const rc = r.currency;
  const zeilen: string[] = [];

  // Ausgangspunkt: was vom Gastpreis nach dem Portal beim Betrieb ankommt.
  if (r.auszahlungsbasis !== null) {
    zeilen.push(
      posten(
        `${txt.posAfterPortal}<br><span class="muted">${txt.posAfterPortalHint}</span>`,
        fmt(r.auszahlungsbasis, rc, locale),
        "head-sum",
      ),
    );
  }

  if (r.verwaltungsprovision !== null) {
    let herkunft = "";
    if (r.provision_quelle === "vertrag") {
      herkunft = r.vertrag_gueltig_ab
        ? ` (${txt.posContractFrom} ${fmtDatum(r.vertrag_gueltig_ab, locale)})`
        : "";
    } else if (r.provision_quelle === "override") {
      herkunft = ` (${txt.posRateManual})`;
    } else if (r.provision_quelle === "altspalten") {
      herkunft = ` (${txt.posRateLegacy})`;
    }
    const satz = r.provisions_pct !== null ? fmtPct(r.provisions_pct, locale) : "";
    const label = r.min_provision_angewandt
      ? `− ${txt.posMinCommission} ${satz}${herkunft}`
      : `− ${txt.posCommission} ${satz}${herkunft}`;
    zeilen.push(posten(label, fmtSigniert(r.verwaltungsprovision, rc, locale, "minus")));
  }
  if (r.pauschale !== null && r.pauschale !== 0) {
    zeilen.push(posten(`− ${txt.posFlatFee}`, fmtSigniert(r.pauschale, rc, locale, "minus")));
  }

  // Die Gebühren des EIGENTÜMERS — jede einzeln, ungekürzt durch Provision.
  const eigene = r.gebuehren.filter((g) => g.gehoert_zu === "eigentuemer");
  if (eigene.length) {
    zeilen.push(posten(txt.posFeesBack, null, "head"));
    for (const g of eigene) {
      const zusatz = g.provisionspflichtig ? ` · ${txt.commissionable}` : "";
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
      ? `${fmtOderStrich(r.owner_payout_converted, ownerCur, locale)}<br><span class="muted">${fmtOderStrich(r.owner_payout, rc, locale)} · ${txt.posRate} ${r.fx_rate} (${esc(r.fx_date)})</span>`
      : fmtOderStrich(r.owner_payout, rc, locale);
  zeilen.push(posten(txt.posOwnerShare, anteil, "sum"));

  const fussnote =
    r.gebuehren_quelle === "ota_ohne_aufstellung"
      ? `<p class="muted note">${txt.noFeesReported}</p>`
      : "";

  const kopf = [
    esc(r.listing) || "—",
    esc(vorname(r.guest)) || "—",
    esc(kanalText(r, opts)),
  ].join(" · ");
  const zeit = `${txt.arrival} ${fmtDatum(r.check_in, locale)} · ${txt.departure} ${fmtDatum(r.check_out, locale)} · ${r.nights} ${txt.nights}`;

  return `
    <div class="block">
      <div class="block-head"><strong>${kopf}</strong><br><span class="muted">${zeit}</span></div>
      <table class="posten"><tbody>${zeilen.join("")}</tbody></table>
      ${fussnote}
    </div>`;
}

export function buildStatementHtml(
  st: Statement,
  locale: string,
  opts: StatementPdfOptionen = {},
): string {
  const h = st.header;
  const cur = st.summary.currency;
  const ownerCur = st.summary.owner_currency || cur;
  const isStorno = st.kind === "cancellation";
  const title = isStorno ? txt.storno : txt.invoice;

  // DATEN-SPLIT (§4.2) im PDF: Der Server maskiert den Gast-Bruttopreis und den
  // Ertrag der Verwaltung für einen Eigentümer zu `null`. Betroffene Spalten
  // und Zeilen werden dann GAR NICHT gerendert — nicht als „—", nicht als 0,00.
  const rows = st.rental_rows;
  const zeigtPauschale = rows.some((r) => (r.pauschale ?? 0) !== 0);

  // --- Buchungstabelle (Übersicht) -------------------------------------------
  const kopfzellen = [
    `<th>${txt.listing}</th>`,
    `<th>${txt.guest}</th>`,
    `<th>${txt.arrival}</th>`,
    `<th>${txt.departure}</th>`,
    `<th class="num">${txt.nights}</th>`,
    `<th>${txt.channel}</th>`,
    `<th class="num">${txt.commission}</th>`,
    zeigtPauschale ? `<th class="num">${txt.flatFee}</th>` : "",
    `<th class="num">${txt.ownerShare}</th>`,
  ];
  const spalten = kopfzellen.filter(Boolean).length;
  const tabelle = rows
    .map((r) => {
      const rc = r.currency;
      const anteil =
        rc !== ownerCur && r.owner_payout_converted !== null
          ? fmtOderStrich(r.owner_payout_converted, ownerCur, locale)
          : fmtOderStrich(r.owner_payout, rc, locale);
      return `
      <tr>
        <td>${esc(r.listing) || "—"}</td>
        <td>${esc(vorname(r.guest)) || "—"}</td>
        <td>${fmtDatum(r.check_in, locale)}</td>
        <td>${fmtDatum(r.check_out, locale)}</td>
        <td class="num">${r.nights}</td>
        <td>${esc(kanalText(r, opts))}</td>
        <td class="num">${fmtOderStrich(r.verwaltungsprovision, rc, locale)}</td>
        ${zeigtPauschale ? `<td class="num">${fmtOderStrich(r.pauschale, rc, locale)}</td>` : ""}
        <td class="num"><strong>${anteil}</strong></td>
      </tr>`;
    })
    .join("");

  // --- Posten-Block je Buchung, IMMER (§2.0) ---------------------------------
  const bloecke = rows.map((r) => buchungsBlock(r, ownerCur, locale, opts)).join("");

  // --- Abzüge und Gutschriften: Verrechnungsposten + wiederkehrende Posten ---
  const abzuege: string[] = [];
  const gutschriften: string[] = [];
  const postenZeile = (label: string, quelle: string, wert: string, zulasten: boolean) =>
    `<tr><td>${label}<br><span class="muted">${quelle}</span></td><td class="num"${zulasten ? ' style="color:#b42318"' : ""}>${wert}</td></tr>`;
  for (const e of st.expenses as Expense[]) {
    const zulasten = e.direction === "from_owner";
    const quelle = [
      txt.srcExpense,
      fmtDatum(e.date, locale),
      e.category ? esc(e.category) : "",
      e.has_receipt ? `${txt.receipt} ✓` : "",
      e.created_by_name ? esc(e.created_by_name) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const wert = fmtSigniert(e.signed_amount, e.currency || cur, locale, e.signed_amount < 0 ? "minus" : "plus");
    (zulasten ? abzuege : gutschriften).push(postenZeile(esc(e.concept), quelle, wert, zulasten));
  }
  for (const p of st.recurring ?? []) {
    const zulasten = p.betrag < 0;
    const quelle = `${txt.srcRecurring} · ${p.anzahl} ${txt.quantity} ${fmt(p.einzelbetrag, p.currency, locale)} ${modusText(p.modus)}`;
    const wert = fmtSigniert(p.betrag, p.currency, locale, zulasten ? "minus" : "plus");
    (zulasten ? abzuege : gutschriften).push(postenZeile(esc(p.label), quelle, wert, zulasten));
  }
  const abzugBlock =
    abzuege.length || gutschriften.length
      ? `<div class="section-title">${txt.deductionsTitle}</div>
         <table>
           <tbody>
             ${abzuege.length ? `<tr class="head"><td colspan="2">${txt.deductions}</td></tr>${abzuege.join("")}` : ""}
             ${gutschriften.length ? `<tr class="head"><td colspan="2">${txt.credits}</td></tr>${gutschriften.join("")}` : ""}
           </tbody>
         </table>`
      : "";

  // --- Summenblock -------------------------------------------------------------
  // Die Richtungssummen der Verrechnungsposten werden aus den POSTEN gebildet,
  // je WÄHRUNG getrennt (quer darüber addiert man sonst DKK auf EUR). Die
  // wiederkehrenden Posten stehen bereits in der Summary in Owner-Währung.
  const postenWaehrungen = new Set(st.expenses.map((e) => e.currency || cur));
  const eineWaehrung = postenWaehrungen.size <= 1;
  const summenZeilen: string[] = [];
  const row = (label: string, wert: string, klasse = "") =>
    `<div class="row${klasse ? ` ${klasse}` : ""}"><span>${label}</span><span>${wert}</span></div>`;

  // Σ Eigentümer-Anteile: Summe der GEZEIGTEN Zeilenwerte in Owner-Währung.
  const anteileBekannt = rows.every((r) => r.owner_payout_converted !== null);
  if (rows.length) {
    const summeAnteile = rows.reduce((s, r) => s + (r.owner_payout_converted ?? 0), 0);
    summenZeilen.push(
      row(
        `${txt.sumShares} (${rows.length})`,
        anteileBekannt ? fmt(summeAnteile, ownerCur, locale) : "—",
      ),
    );
  }
  if (st.summary.pauschalen_gesamt !== null && st.summary.pauschalen_gesamt !== 0) {
    const n = rows.filter((r) => (r.pauschale ?? 0) !== 0).length;
    summenZeilen.push(
      row(
        `${txt.sumFlatFees} (${n})<br><span class="muted">${txt.sumFlatFeesNote}</span>`,
        `<span class="muted">${fmtSigniert(st.summary.pauschalen_gesamt, ownerCur, locale, "minus")}</span>`,
      ),
    );
  }
  for (const wc of postenWaehrungen) {
    const zu = st.expenses
      .filter((e) => (e.currency || cur) === wc && e.direction !== "from_owner")
      .reduce((s, e) => s + Math.abs(e.amount), 0);
    const ab = st.expenses
      .filter((e) => (e.currency || cur) === wc && e.direction === "from_owner")
      .reduce((s, e) => s + Math.abs(e.amount), 0);
    const suffix = eineWaehrung ? "" : ` (${esc(wc)})`;
    if (ab > 0) summenZeilen.push(row(`− ${txt.sumDeductions} · ${txt.srcExpense}${suffix}`, fmtSigniert(ab, wc, locale, "minus")));
    if (zu > 0) summenZeilen.push(row(`+ ${txt.sumCredits} · ${txt.srcExpense}${suffix}`, fmtSigniert(zu, wc, locale, "plus")));
  }
  if (st.summary.recurring_from_owner !== 0) {
    summenZeilen.push(
      row(`− ${txt.sumDeductions} · ${txt.srcRecurring}`, fmtSigniert(st.summary.recurring_from_owner, ownerCur, locale, "minus")),
    );
  }
  if (st.summary.recurring_to_owner !== 0) {
    summenZeilen.push(
      row(`+ ${txt.sumCredits} · ${txt.srcRecurring}`, fmtSigniert(st.summary.recurring_to_owner, ownerCur, locale, "plus")),
    );
  }
  summenZeilen.push(
    row(
      `${txt.sumOwnerPayout} (${esc(ownerCur)})`,
      fmtOderStrich(st.summary.owner_payout, ownerCur, locale),
      "grand",
    ),
  );

  // Steuer: die Verwaltungsprovision ist die Leistung des Betriebs an den
  // Eigentümer — die Umsatzsteuer darauf gehört auf SEINEN Beleg. Erst nach
  // dem Finalisieren gesetzt (`tax.gross`), sonst leer.
  const steuerZeilen: string[] = [];
  if (st.tax.gross) {
    steuerZeilen.push(row(txt.vatNet, fmt(st.tax.net, cur, locale)));
    steuerZeilen.push(
      st.tax.category === "S"
        ? row(`${txt.vat} (${st.tax.rate}%)`, fmt(st.tax.tax, cur, locale))
        : row(txt.vat, esc(st.tax.exemption_reason) || "0,00"),
    );
    steuerZeilen.push(row(txt.vatGross, fmt(st.tax.gross, cur, locale), "strong"));
  }

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
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
        <div class="meta" style="margin-bottom:0">
          ${h.invoice_number ? `Nr. ${esc(h.invoice_number)} · ` : ""}
          ${txt.period} ${fmtDatum(st.period_from, locale)} – ${fmtDatum(st.period_to, locale)}
          ${st.invoice_date ? ` · ${fmtDatum(st.invoice_date, locale)}` : ""}
        </div>
      </div>
      ${h.pm_logo_url ? `<img class="logo" src="${esc(h.pm_logo_url)}" alt="Logo" />` : ""}
    </div>

    <div class="parties">
      <div class="party">
        <h3>${txt.issuer}</h3>
        ${line(h.pm_name, true)}
        ${line(h.pm_address)}
        ${line(h.pm_email)}
        ${line(h.pm_phone)}
        ${h.pm_tax_id ? `<p>${txt.vatId}: ${esc(h.pm_tax_id)}</p>` : ""}
      </div>
      <div class="party">
        <h3>${txt.owner}</h3>
        ${line(h.owner_name, true)}
        ${line(h.owner_address)}
        ${line(h.owner_email)}
        ${line(h.owner_phone)}
        ${h.owner_tax_id ? `<p>${txt.vatId}: ${esc(h.owner_tax_id)}</p>` : ""}
      </div>
    </div>

    <div class="section-title">${txt.bookings}</div>
    <table>
      <thead><tr>${kopfzellen.join("")}</tr></thead>
      <tbody>${tabelle || `<tr><td colspan="${spalten}" style="color:#888">${txt.noBookings}</td></tr>`}</tbody>
    </table>

    ${rows.length ? `<div class="section-title">${txt.breakdownTitle}</div>${bloecke}` : ""}

    ${abzugBlock}

    <div class="totals">${summenZeilen.join("")}</div>
    ${steuerZeilen.length ? `<div class="betrieb">${steuerZeilen.join("")}</div>` : ""}

    ${st.tax.exemption_reason ? `<p class="meta" style="margin-top:24px">${esc(st.tax.exemption_reason)}</p>` : ""}
    ${h.notes ? `<p class="meta">${esc(h.notes)}</p>` : ""}
  </body></html>`;
}

/** Erzeugt das PDF über den Render-Dienst und stößt den Download an. */
export async function downloadStatementPdf(
  st: Statement,
  locale: string,
  opts: StatementPdfOptionen = {},
): Promise<void> {
  const res = await fetch("/api/v1/generate-pdf-single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmlContent: buildStatementHtml(st, locale, opts) }),
  });
  if (!res.ok) throw new Error("PDF-Generierung fehlgeschlagen.");
  const data = await res.json();
  if (!data.success || !data.pdfBase64) throw new Error("Leeres PDF.");

  const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const name = st.header.invoice_number || `abrechnung-${st.period_from}`;
  a.download = `${name}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
