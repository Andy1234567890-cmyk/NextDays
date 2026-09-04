// Bericht als A4-PDF. Baut aus der Antwort des Servers ein eigenständiges
// HTML (Kopf mit Berichtsname, Zeitraum und den gesetzten Filtern, Tabelle,
// Summenzeile, Fußzeile mit Erzeugungszeit) und schickt es an den HTML→PDF-
// Dienst — dasselbe Muster wie `lib/statement-pdf.ts`
// (/api/v1/generate-pdf-single).
//
// DIESES MODUL RECHNET NICHT. Jede Zahl kommt aus `BerichtResponse`; auch die
// Summenzeile ist die des Servers (`summen`), nie eine hier gebildete Summe —
// eine zweite Rechnung wäre eine zweite Wahrheit auf einem Dokument, das
// jemand ausdruckt und weitergibt (Wurzel 4).
//
// Die Beschriftungen kommen als Wörterbuch vom Aufrufer, weil nur die
// Komponente `useTranslations` hat. Das PDF hat keinen Hook-Zugriff und soll
// die Spaltenliste nicht duplizieren.
import { formatCurrency } from "@/lib/currency";
import type { BerichtResponse, BerichtZeile, BerichtZelle } from "@/lib/personal-berichte-typen";
import { minutenText, prozentText, zahlText } from "@/lib/personal-berichte-typen";

export type DruckTexte = {
  /** Titel des Berichts (`personal.berichte.namen.<name>.titel`). */
  titel: string;
  /** „Zeitraum" */
  zeitraumLabel: string;
  /** „Filter" */
  filterLabel: string;
  /** „Summe" */
  summeLabel: string;
  /** „Erzeugt am {zeit}" — bereits eingesetzt. */
  fusszeile: string;
  /** Spaltenbeschriftung je `key`. */
  spalten: Record<string, string>;
  /** Statustexte je Wert (`personal.berichte.status.<wert>`). */
  status: Record<string, string>;
  /** Aktive Filter als fertige „Label: Wert"-Zeilen. */
  filter: string[];
  /** Hinweise des Servers — sie gehören auf den Ausdruck, nicht nur in die
   *  Oberfläche: ein Bericht mit Datenlücke darf nicht als vollständig
   *  wirken. */
  hinweise: string[];
};

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function datumText(iso: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return esc(iso);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
}

/** Eine Zelle als Text — dieselben Regeln wie in `bericht-tabelle.tsx`:
 *  Minuten `h:mm`, Geld über `formatCurrency` mit der Währung DER ANTWORT
 *  (fehlt sie: reine Zahl ohne Symbol), Prozent mit einer Nachkommastelle.
 *  `null` ist „—", nie eine 0. */
export function zelleText(
  wert: BerichtZelle,
  typ: string,
  currency: string | null,
  locale: string,
  status: Record<string, string>,
): string {
  if (wert === null || wert === undefined || wert === "") return "—";
  if (Array.isArray(wert)) return wert.length ? wert.join(" · ") : "—";
  if (typeof wert === "boolean") return wert ? "✓" : "—";
  switch (typ) {
    case "minuten":
      return typeof wert === "number" ? minutenText(wert) : String(wert);
    case "geld": {
      if (typeof wert !== "number") return String(wert);
      // Ohne Währung: reine Zahl OHNE Symbol — kein erfundenes EUR (Wurzel 4).
      return currency
        ? formatCurrency(wert / 100, currency, locale)
        : new Intl.NumberFormat(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(wert / 100);
    }
    case "prozent":
      return typeof wert === "number" ? prozentText(wert, locale) : String(wert);
    case "zahl":
    case "tage":
      return typeof wert === "number" ? zahlText(wert, locale) : String(wert);
    case "datum":
      return typeof wert === "string" ? datumText(wert, locale) : String(wert);
    case "status":
      return status[String(wert)] ?? String(wert);
    default:
      return String(wert);
  }
}

const RECHTS = new Set(["zahl", "minuten", "geld", "prozent", "tage"]);

export function buildBerichtHtml(
  bericht: BerichtResponse,
  texte: DruckTexte,
  locale: string,
): string {
  const spalten = bericht.spalten;
  const kopf = spalten
    .map(
      (s) =>
        `<th${RECHTS.has(s.typ) ? ' class="num"' : ""}>${esc(texte.spalten[s.key] ?? s.key)}</th>`,
    )
    .join("");

  const zelle = (zeile: BerichtZeile, key: string, typ: string) =>
    esc(zelleText(zeile[key] ?? null, typ, bericht.currency, locale, texte.status));

  const koerper = bericht.zeilen
    .map(
      (z) =>
        `<tr>${spalten
          .map(
            (s) =>
              `<td${RECHTS.has(s.typ) ? ' class="num"' : ""}>${zelle(z, s.key, s.typ)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  // Summenzeile: NUR Spalten mit `summe: true` tragen einen Wert. Der erste
  // Platz bekommt die Beschriftung, damit die Zeile nicht namenlos steht.
  const summen = bericht.summen;
  const summenZeile = summen
    ? `<tr class="sum">${spalten
        .map((s, i) => {
          const rechts = RECHTS.has(s.typ) ? ' class="num"' : "";
          if (i === 0 && !s.summe) return `<td>${esc(texte.summeLabel)}</td>`;
          if (!s.summe) return `<td${rechts}></td>`;
          return `<td${rechts}>${zelle(summen, s.key, s.typ)}</td>`;
        })
        .join("")}</tr>`
    : "";

  const hinweise = texte.hinweise.length
    ? `<ul class="hinweise">${texte.hinweise.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`
    : "";
  const filter = texte.filter.length
    ? `<div class="meta">${esc(texte.filterLabel)}: ${texte.filter.map(esc).join(" · ")}</div>`
    : "";

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 10px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #666; font-size: 9px; margin-bottom: 2px; }
    .hinweise { margin: 10px 0 14px; padding: 8px 10px 8px 24px; border: 1px solid #f0c060; background: #fdf6e3; border-radius: 6px; }
    .hinweise li { margin: 1px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { text-align: left; font-size: 8px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding: 4px 5px; }
    td { padding: 4px 5px; border-bottom: 1px solid #f2f2f2; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    tr.sum td { border-top: 2px solid #1a1a1a; border-bottom: none; font-weight: 700; padding-top: 6px; }
    tfoot { color: #888; font-size: 8px; }
    .foot { margin-top: 16px; color: #888; font-size: 8px; border-top: 1px solid #eee; padding-top: 6px; }
    .leer { color: #888; padding: 16px 5px; }
  </style></head><body>
    <h1>${esc(texte.titel)}</h1>
    <div class="meta">${esc(texte.zeitraumLabel)}: ${datumText(bericht.von, locale)} – ${datumText(bericht.bis, locale)}</div>
    ${filter}
    ${hinweise}
    <table>
      <thead><tr>${kopf}</tr></thead>
      <tbody>${koerper || `<tr><td class="leer" colspan="${spalten.length}">—</td></tr>`}</tbody>
      ${summenZeile ? `<tfoot>${summenZeile}</tfoot>` : ""}
    </table>
    <div class="foot">${esc(texte.fusszeile)}</div>
  </body></html>`;
}

/** Erzeugt das PDF über den Render-Dienst und stößt den Download an. */
export async function downloadBerichtPdf(
  bericht: BerichtResponse,
  texte: DruckTexte,
  locale: string,
): Promise<void> {
  const res = await fetch("/api/v1/generate-pdf-single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmlContent: buildBerichtHtml(bericht, texte, locale) }),
  });
  if (!res.ok) throw new Error("PDF-Generierung fehlgeschlagen.");
  const data = await res.json();
  if (!data.success || !data.pdfBase64) throw new Error("Leeres PDF.");

  const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bericht.name}_${bericht.von}_${bericht.bis}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
