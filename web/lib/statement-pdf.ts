// Eigentümer-Abrechnung als sauberes A4-PDF. Baut aus dem Statement ein
// eigenständiges HTML (Rechnungskopf PM/Owner, Rental-Aktivität, Ausgaben,
// Steueraufschlüsselung, Owner-/PM-Payout) und schickt es an den HTML→PDF-Dienst
// (/api/v1/generate-pdf-single, Playwright). Bewusst ein eigenes Statement-Layout
// statt der InvoiceData-Templates: ein Owner-Statement hat eine andere Struktur
// (Vermietungs-Aktivität + Auszahlungen) als eine klassische Positions-Rechnung.
import type { Statement } from "@/lib/owner-statements";

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
// (Titel, „Aussteller", „Vermietungs-Aktivität") — deutsch. Das PDF ist der
// Beleg zwischen Betrieb und Eigentümer, kein Oberflächentext. Hier stehen sie
// gebündelt, damit eine spätere Übersetzung EINE Stelle hat statt Dutzender
// Template-Literale.
const txt = {
  toOwner: "zugunsten",
  fromOwner: "zulasten",
  settlement: "Verrechnungsposten",
  direction: "Richtung",
  sumToOwner: "Verrechnung zugunsten",
  sumFromOwner: "Verrechnung zulasten",
  settlementNet: "Verrechnung (netto)",
} as const;

export function buildStatementHtml(st: Statement, locale: string): string {
  const h = st.header;
  const cur = st.summary.currency;
  const ownerCur = st.summary.owner_currency || cur;
  const isStorno = st.kind === "cancellation";
  const title = isStorno ? "Stornorechnung" : "Eigentümer-Abrechnung";

  // DATEN-SPLIT (§4.2) im PDF: Der Server maskiert den Gast-Bruttopreis und den
  // Ertrag der Verwaltung für einen Eigentümer zu `null`. Beide Spalten/Zeilen
  // werden dann GAR NICHT gerendert — nicht als „—", nicht als 0,00. Ein
  // Dokument, das er ausdruckt und weitergibt, soll die Zahl nicht einmal als
  // Leerstelle andeuten. Die Agentur bekommt die Werte und damit die Spalten.
  const zeigtGastpreis = st.rental_rows.every((r) => r.total_price !== null);
  const zeigtVerwaltung = st.summary.pm_payout !== null;
  const spalten = zeigtGastpreis ? 7 : 6;

  // Die Richtungssummen werden aus den POSTEN abgeleitet, nicht aus der
  // Summary gelesen. Auf dem Snapshot-Pfad (finalisiert/storniert) baut das
  // Backend die Summary aus der gespeicherten Zeile neu auf und setzt dort nur
  // `expenses_total`; `expenses_to_owner/_from_owner` fallen auf ihren
  // Schema-Default 0.0 zurück. Aus einer gelieferten 0 lässt sich „es gab
  // keine" und „das Feld wurde nicht gefüllt" nicht unterscheiden — genau das
  // PDF einer finalisierten Abrechnung, also das, was der Eigentümer wirklich
  // in die Hand bekommt, verlöre dadurch beide Zeilen (Wurzel 4). Aus den
  // Posten gerechnet stimmt es auf BEIDEN Pfaden und kann der Postentabelle
  // darüber nicht widersprechen.
  //
  // Summiert wird je WÄHRUNG getrennt: die Tabelle zeigt jeden Betrag in der
  // Währung des Postens, quer darüber addiert man sonst DKK auf EUR. Nur wenn
  // ausschliesslich eine Währung vorkommt, ist eine einzelne Summe überhaupt
  // eine zulässige Aussage; sonst bekommt jede Zeile ihr Währungskürzel.
  const postenWaehrungen = new Set(st.expenses.map((e) => e.currency || cur));
  const eineWaehrung = postenWaehrungen.size <= 1;
  const verrechnungBlock = (): string => {
    if (!st.expenses.length) return "";
    // Bei gemischten Währungen je Währung eine eigene Zeilengruppe — eine
    // zusammengezählte Zahl wäre schlicht falsch (Wurzel 4).
    return [...postenWaehrungen]
      .map((wc) => {
        const zu = st.expenses
          .filter((e) => (e.currency || cur) === wc && e.direction !== "from_owner")
          .reduce((s, e) => s + Math.abs(e.amount), 0);
        const ab = st.expenses
          .filter((e) => (e.currency || cur) === wc && e.direction === "from_owner")
          .reduce((s, e) => s + Math.abs(e.amount), 0);
        const suffix = eineWaehrung ? "" : ` (${esc(wc)})`;
        return [
          zu > 0
            ? `<div class="row"><span>${txt.sumToOwner}${suffix}</span><span>${fmt(zu, wc, locale)}</span></div>`
            : "",
          ab > 0
            ? `<div class="row"><span>${txt.sumFromOwner}${suffix}</span><span>−${fmt(ab, wc, locale)}</span></div>`
            : "",
          zu > 0 && ab > 0
            ? `<div class="row"><span>${txt.settlementNet}${suffix}</span><span>${fmt(zu - ab, wc, locale)}</span></div>`
            : "",
        ].join("");
      })
      .join("");
  };

  // Mehrere Quellwährungen? Dann je Zeile die eigene Währung zeigen + Kurszeile.
  const mixed =
    new Set(st.rental_rows.map((r) => r.currency)).size > 1 ||
    st.rental_rows.some((r) => r.currency !== ownerCur);

  const rows = st.rental_rows
    .map((r) => {
      const rc = r.currency || cur;
      // Owner-Auszahlung umgerechnet + Kurs-Hinweis, wenn Währung abweicht.
      const conv =
        rc !== ownerCur
          ? `${fmtOderStrich(r.owner_payout_converted, ownerCur, locale)}<br><span style="color:#999;font-size:9px">${fmtOderStrich(r.owner_payout, rc, locale)} · Kurs ${r.fx_rate} (${esc(r.fx_date)})</span>`
          : fmtOderStrich(r.owner_payout, ownerCur, locale);
      const gastpreis =
        zeigtGastpreis && r.total_price !== null
          ? `<td class="num">${fmt(r.total_price, rc, locale)}</td>`
          : "";
      return `
      <tr>
        <td>${esc(r.guest) || "—"}</td>
        <td>${r.nights}</td>
        <td>${esc(r.listing) || "—"}</td>
        <td style="text-transform:capitalize">${esc(r.channel)}</td>
        ${gastpreis}
        <td class="num">${fmt(r.total_payout, rc, locale)}</td>
        <td class="num">${conv}</td>
      </tr>`;
    })
    .join("");

  // Verrechnungsposten: der Eigentümer muss SEHEN, wofür etwas abgezogen oder
  // gutgeschrieben wurde — sonst ist die Abrechnung nicht prüfbar. Darum eigene
  // Richtungsspalte im Klartext statt nur eines Minuszeichens am Betrag, und
  // die Währung des POSTENS (ein DKK-Objekt behält DKK, Wurzel 4).
  const expenses = st.expenses
    .map((e) => {
      const zulasten = e.direction === "from_owner";
      const richtung = zulasten ? txt.fromOwner : txt.toOwner;
      return `
      <tr>
        <td>${esc(e.concept)}${e.created_by_name ? `<br><span style="color:#999;font-size:9px">${esc(e.created_by_name)}</span>` : ""}</td>
        <td>${esc(e.date)}</td>
        <td>${richtung}</td>
        <td>${esc(e.category) || "—"}</td>
        <td class="num"${zulasten ? ' style="color:#b42318"' : ""}>${fmt(e.signed_amount, e.currency || cur, locale)}</td>
      </tr>`;
    })
    .join("");

  const taxLine =
    st.tax.category === "S"
      ? `<div class="row"><span>Umsatzsteuer (${st.tax.rate}%)</span><span>${fmt(st.tax.tax, cur, locale)}</span></div>`
      : `<div class="row"><span>Umsatzsteuer</span><span>${esc(st.tax.exemption_reason) || "0,00"}</span></div>`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; font-size: 12px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { color: #666; margin-bottom: 24px; }
    .parties { display: flex; justify-content: space-between; gap: 40px; margin-bottom: 28px; }
    .party { width: 48%; }
    .party h3 { font-size: 11px; text-transform: uppercase; color: #888; margin: 0 0 6px; }
    .party p { margin: 1px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding: 6px 8px; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
    .num { text-align: right; }
    .totals { margin-left: auto; width: 280px; }
    .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .grand { font-weight: 700; font-size: 14px; border-top: 2px solid #1a1a1a; padding-top: 8px; margin-top: 4px; }
    .section-title { font-size: 13px; font-weight: 700; margin: 0 0 8px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; }
    .logo { max-height: 64px; max-width: 200px; object-fit: contain; }
  </style></head><body>
    <div class="head">
      <div>
        <h1>${title}</h1>
        <div class="meta" style="margin-bottom:0">
          ${h.invoice_number ? `Nr. ${esc(h.invoice_number)} · ` : ""}
          Zeitraum ${esc(st.period_from)} – ${esc(st.period_to)}
          ${st.invoice_date ? ` · ${esc(st.invoice_date)}` : ""}
        </div>
      </div>
      ${h.pm_logo_url ? `<img class="logo" src="${esc(h.pm_logo_url)}" alt="Logo" />` : ""}
    </div>

    <div class="parties">
      <div class="party">
        <h3>Aussteller</h3>
        ${line(h.pm_name, true)}
        ${line(h.pm_address)}
        ${line(h.pm_email)}
        ${line(h.pm_phone)}
        ${h.pm_tax_id ? `<p>USt-IdNr.: ${esc(h.pm_tax_id)}</p>` : ""}
      </div>
      <div class="party">
        <h3>Eigentümer</h3>
        ${line(h.owner_name, true)}
        ${line(h.owner_address)}
        ${line(h.owner_email)}
        ${line(h.owner_phone)}
        ${h.owner_tax_id ? `<p>USt-IdNr.: ${esc(h.owner_tax_id)}</p>` : ""}
      </div>
    </div>

    <div class="section-title">Vermietungs-Aktivität</div>
    <table>
      <thead><tr><th>Gast</th><th>Nächte</th><th>Objekt</th><th>Kanal</th>${zeigtGastpreis ? `<th class="num">Gesamtpreis</th>` : ""}<th class="num">Auszahlung</th><th class="num">Eigentümer-Auszahlung</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="${spalten}" style="color:#888">Keine Reservierungen im Zeitraum.</td></tr>`}</tbody>
    </table>

    ${
      st.expenses.length
        ? `<div class="section-title">${txt.settlement}</div>
           <table>
             <thead><tr><th>Konzept</th><th>Datum</th><th>${txt.direction}</th><th>Kategorie</th><th class="num">Betrag</th></tr></thead>
             <tbody>${expenses}</tbody>
           </table>`
        : ""
    }

    ${
      mixed
        ? `<div class="totals">
      ${st.summary.totals_by_currency
        .map(
          (c) =>
            `<div class="row"><span>Auszahlung (${esc(c.currency)})</span><span>${fmt(c.amount, c.currency, locale)}</span></div>`,
        )
        .join("")}
      ${(zeigtVerwaltung ? st.summary.pm_payout_by_currency : [])
        .map(
          (c) =>
            `<div class="row"><span>Verwaltungs-Auszahlung (${esc(c.currency)})</span><span>${fmt(c.amount, c.currency, locale)}</span></div>`,
        )
        .join("")}
      ${/* Auch bei gemischten Währungen gehören die Verrechnungsposten in die
           Summen — sonst zeigt das Dokument eine Postentabelle, deren Beträge
           in keiner Summe auftauchen. */ verrechnungBlock()}
      <div class="row grand"><span>Eigentümer-Auszahlung (${esc(ownerCur)})</span><span>${fmtOderStrich(st.summary.owner_payout, ownerCur, locale)}</span></div>
    </div>`
        : `<div class="totals">
      ${
        st.summary.total_price !== null
          ? `<div class="row"><span>Mieteinnahmen</span><span>${fmt(st.summary.total_price, cur, locale)}</span></div>`
          : ""
      }
      <div class="row"><span>Gesamt-Auszahlung</span><span>${fmt(st.summary.total_payout, cur, locale)}</span></div>
      ${
        /* Beide Richtungen EINZELN ausweisen: eine Nettozahl allein verbirgt,
           dass z. B. 500 Kompensation und 500 Material gegeneinanderstehen —
           der Eigentümer sähe „0,00" und wüsste nicht, wofür. */
        verrechnungBlock()
      }
      ${st.tax.gross ? taxLine : ""}
      <div class="row grand"><span>Eigentümer-Auszahlung</span><span>${fmtOderStrich(st.summary.owner_payout, ownerCur, locale)}</span></div>
      ${
        st.summary.pm_payout !== null
          ? `<div class="row"><span>Verwaltungs-Auszahlung</span><span>${fmt(st.summary.pm_payout, cur, locale)}</span></div>`
          : ""
      }
    </div>`
    }

    ${st.tax.exemption_reason ? `<p class="meta" style="margin-top:24px">${esc(st.tax.exemption_reason)}</p>` : ""}
    ${h.notes ? `<p class="meta">${esc(h.notes)}</p>` : ""}
  </body></html>`;
}

/** Erzeugt das PDF über den Render-Dienst und stößt den Download an. */
export async function downloadStatementPdf(st: Statement, locale: string): Promise<void> {
  const res = await fetch("/api/v1/generate-pdf-single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmlContent: buildStatementHtml(st, locale) }),
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
