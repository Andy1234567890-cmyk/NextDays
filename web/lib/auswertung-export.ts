// Export der Auswertung — CSV, Excel, PDF, im BROWSER aus den bereits
// geladenen Zahlen (Hostaway „Download report").
//
// WARUM IM BROWSER: der Bericht liegt schon vollständig im Client (EIN Abruf
// für alle Reiter). Ihn für den Export ein zweites Mal im Backend zu rechnen
// hieße, zwei Rechenwege zu pflegen — und genau das führte bei Hostaway zu
// „unterschiedlichen Zahlen auf verschiedenen Seiten". Was exportiert wird,
// ist byte­gleich das, was auf dem Bildschirm steht.
//
// Excel über `xlsx` (liegt bereits für den Portal-Import im Bundle), PDF über
// den HTML→PDF-Dienst (/api/v1/generate-pdf-single), den auch die
// Eigentümer-Abrechnung nutzt. Kein zweiter Renderer.
//
// KEIN `"use server"`: alles hier läuft im Client.
import * as XLSX from "xlsx";

export type ExportTabelle = {
  /** Blattname (Excel) bzw. Überschrift (PDF). */
  titel: string;
  kopf: string[];
  zeilen: (string | number | null)[][];
  /** Optionale Summenzeile, im PDF fett und in Excel als letzte Zeile. */
  summe?: (string | number | null)[];
};

export type ExportFormat = "csv" | "xlsx" | "pdf";

/** Antwort des PDF-Dienstes prüfen und seine Fehlermeldung durchreichen.
 *
 *  Die Route legt die Ursache in `error` ab (z. B. „Executable doesn't exist
 *  at …/chrome-headless-shell" bei fehlendem Browser). Sie hinter einem
 *  nackten „500" zu verstecken kostete am 07.09.2026 die Diagnose — der
 *  Nutzer sah „PDF-Dienst antwortete 500" und niemand wusste, warum. */
async function pdfAntwortPruefen(res: Response): Promise<string> {
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
  return data.pdfBase64;
}

function herunterladen(blob: Blob, dateiname: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(url);
}

function csvZelle(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(v) : v;
  // Anführungszeichen, wenn Trennzeichen, Zeilenumbruch oder Anführungszeichen
  // enthalten sind — RFC 4180.
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV mit Semikolon und BOM — so öffnet Excel in DE/DK/… die Datei mit
 *  Umlauten und Spalten korrekt, ohne Import-Assistent. */
export function exportCsv(tabelle: ExportTabelle, dateiname: string) {
  const zeilen = [tabelle.kopf, ...tabelle.zeilen];
  if (tabelle.summe) zeilen.push(tabelle.summe);
  const text = zeilen.map((z) => z.map(csvZelle).join(";")).join("\r\n");
  herunterladen(
    new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }),
    `${dateiname}.csv`,
  );
}

/** Excel: ein Blatt je Tabelle. Zahlen bleiben Zahlen (kein Text). */
export function exportXlsx(tabellen: ExportTabelle[], dateiname: string) {
  const wb = XLSX.utils.book_new();
  for (const t of tabellen) {
    const daten: (string | number | null)[][] = [t.kopf, ...t.zeilen];
    if (t.summe) daten.push(t.summe);
    const ws = XLSX.utils.aoa_to_sheet(daten);
    // Spaltenbreite grob nach Inhalt — sonst steht alles auf 8 Zeichen.
    ws["!cols"] = t.kopf.map((_, i) => ({
      wch: Math.min(
        48,
        Math.max(10, ...daten.map((z) => String(z[i] ?? "").length)),
      ),
    }));
    // Blattnamen dürfen höchstens 31 Zeichen haben und keine []:*?/\ enthalten.
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      t.titel.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Bericht",
    );
  }
  const puffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  herunterladen(
    new Blob([puffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${dateiname}.xlsx`,
  );
}

function esc(s: string | number | null): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** PDF-Bericht: Kopf mit Titel, Zeitraum und Filtern, dann die Tabellen. */
export async function exportPdf(
  kopf: { titel: string; untertitel: string; filter: string[]; erzeugt: string },
  tabellen: ExportTabelle[],
  dateiname: string,
): Promise<void> {
  const html = `<!doctype html><html><head><meta charset="utf-8">
  <style>
    @page { size: A4 landscape; margin: 14mm 12mm; }
    body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; font-size: 10px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    h2 { font-size: 12px; margin: 18px 0 6px; page-break-after: avoid; }
    .meta { color: #555; margin: 0 0 4px; }
    .filter span { display: inline-block; border: 1px solid #ddd; border-radius: 999px; padding: 1px 8px; margin: 2px 4px 2px 0; }
    table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    th, td { border-bottom: 1px solid #e5e5e5; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-weight: 600; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    tr.summe td { font-weight: 700; border-top: 2px solid #333; }
  </style></head><body>
  <h1>${esc(kopf.titel)}</h1>
  <p class="meta">${esc(kopf.untertitel)}</p>
  <p class="filter">${kopf.filter.map((f) => `<span>${esc(f)}</span>`).join("")}</p>
  <p class="meta">${esc(kopf.erzeugt)}</p>
  ${tabellen
    .map((t) => {
      const numerisch = t.kopf.map((_, i) =>
        t.zeilen.some((z) => typeof z[i] === "number"),
      );
      const zelle = (v: string | number | null, i: number) =>
        `<td${numerisch[i] ? ' class="num"' : ""}>${esc(v)}</td>`;
      return `<h2>${esc(t.titel)}</h2><table><thead><tr>${t.kopf
        .map((k, i) => `<th${numerisch[i] ? ' class="num"' : ""}>${esc(k)}</th>`)
        .join("")}</tr></thead><tbody>${t.zeilen
        .map((z) => `<tr>${z.map(zelle).join("")}</tr>`)
        .join("")}${
        t.summe ? `<tr class="summe">${t.summe.map(zelle).join("")}</tr>` : ""
      }</tbody></table>`;
    })
    .join("")}
  </body></html>`;
  const res = await fetch("/api/v1/generate-pdf-single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmlContent: html }),
  });
  const pdfBase64 = await pdfAntwortPruefen(res);
  const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  herunterladen(new Blob([bytes], { type: "application/pdf" }), `${dateiname}.pdf`);
}
