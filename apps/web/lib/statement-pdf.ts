// Eigentümer-Abrechnung als sauberes A4-PDF. Baut aus dem Statement ein
// eigenständiges HTML (Rechnungskopf PM/Owner, Rental-Aktivität, Ausgaben,
// Steueraufschlüsselung, Owner-/PM-Payout) und schickt es an den HTML→PDF-Dienst
// (/api/v1/generate-pdf-single, Playwright). Bewusst ein eigenes Statement-Layout
// statt der InvoiceData-Templates: ein Owner-Statement hat eine andere Struktur
// (Vermietungs-Aktivität + Auszahlungen) als eine klassische Positions-Rechnung.
import type { Statement } from "@/lib/owner-statements";

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount);
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

export function buildStatementHtml(st: Statement): string {
  const h = st.header;
  const cur = st.summary.currency;
  const ownerCur = st.summary.owner_currency || cur;
  const isStorno = st.kind === "cancellation";
  const title = isStorno ? "Stornorechnung" : "Eigentümer-Abrechnung";

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
          ? `${fmt(r.owner_payout_converted, ownerCur)}<br><span style="color:#999;font-size:9px">${fmt(r.owner_payout, rc)} · Kurs ${r.fx_rate} (${esc(r.fx_date)})</span>`
          : fmt(r.owner_payout, ownerCur);
      return `
      <tr>
        <td>${esc(r.guest) || "—"}</td>
        <td>${r.nights}</td>
        <td>${esc(r.listing) || "—"}</td>
        <td style="text-transform:capitalize">${esc(r.channel)}</td>
        <td class="num">${fmt(r.total_price, rc)}</td>
        <td class="num">${fmt(r.total_payout, rc)}</td>
        <td class="num">${conv}</td>
      </tr>`;
    })
    .join("");

  const expenses = st.expenses
    .map(
      (e) => `
      <tr>
        <td>${esc(e.concept)}</td>
        <td>${esc(e.date)}</td>
        <td>${esc(e.category) || "—"}</td>
        <td class="num">${fmt(e.amount, cur)}</td>
      </tr>`,
    )
    .join("");

  const taxLine =
    st.tax.category === "S"
      ? `<div class="row"><span>Umsatzsteuer (${st.tax.rate}%)</span><span>${fmt(st.tax.tax, cur)}</span></div>`
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
      <thead><tr><th>Gast</th><th>Nächte</th><th>Objekt</th><th>Kanal</th><th class="num">Gesamtpreis</th><th class="num">Auszahlung</th><th class="num">Eigentümer-Auszahlung</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" style="color:#888">Keine Reservierungen im Zeitraum.</td></tr>`}</tbody>
    </table>

    ${
      st.expenses.length
        ? `<div class="section-title">Ausgaben & Extras</div>
           <table>
             <thead><tr><th>Konzept</th><th>Datum</th><th>Kategorie</th><th class="num">Betrag</th></tr></thead>
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
            `<div class="row"><span>Auszahlung (${esc(c.currency)})</span><span>${fmt(c.amount, c.currency)}</span></div>`,
        )
        .join("")}
      ${st.summary.pm_payout_by_currency
        .map(
          (c) =>
            `<div class="row"><span>Verwaltungs-Auszahlung (${esc(c.currency)})</span><span>${fmt(c.amount, c.currency)}</span></div>`,
        )
        .join("")}
      <div class="row grand"><span>Eigentümer-Auszahlung (${esc(ownerCur)})</span><span>${fmt(st.summary.owner_payout, ownerCur)}</span></div>
    </div>`
        : `<div class="totals">
      <div class="row"><span>Mieteinnahmen</span><span>${fmt(st.summary.total_price, cur)}</span></div>
      <div class="row"><span>Gesamt-Auszahlung</span><span>${fmt(st.summary.total_payout, cur)}</span></div>
      <div class="row"><span>Ausgaben</span><span>${fmt(st.summary.expenses_total, cur)}</span></div>
      ${st.tax.gross ? taxLine : ""}
      <div class="row grand"><span>Eigentümer-Auszahlung</span><span>${fmt(st.summary.owner_payout, ownerCur)}</span></div>
      <div class="row"><span>Verwaltungs-Auszahlung</span><span>${fmt(st.summary.pm_payout, cur)}</span></div>
    </div>`
    }

    ${st.tax.exemption_reason ? `<p class="meta" style="margin-top:24px">${esc(st.tax.exemption_reason)}</p>` : ""}
    ${h.notes ? `<p class="meta">${esc(h.notes)}</p>` : ""}
  </body></html>`;
}

/** Erzeugt das PDF über den Render-Dienst und stößt den Download an. */
export async function downloadStatementPdf(st: Statement): Promise<void> {
  const res = await fetch("/api/v1/generate-pdf-single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmlContent: buildStatementHtml(st) }),
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
