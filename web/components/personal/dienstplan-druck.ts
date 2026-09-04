// Dienstplan als PDF zum Aushängen (Vertrag §5).
//
// A4 QUERFORMAT, weil sieben Tagesspalten plus Personenspalte im Hochformat
// unlesbar schmal werden. Der Aufbau ist derselbe wie `lib/statement-pdf.ts`:
// ein eigenständiges HTML mit eingebettetem `<style>` an
// /api/v1/generate-pdf-single, danach Download aus dem Base64. Kein
// `window.print()` — der Browserdruck nimmt das Bildschirm-Layout samt
// Sidebar, Popovers und Scroll-Containern mit.
//
// OHNE JEDE FINANZZAHL — UNVERHANDELBAR. Dieser Plan hängt im Personalraum:
// jeder, der vorbeigeht, liest ihn, unabhängig von seiner Rolle. Die Fähigkeit
// `view_team_schedule` sieht kein Geld (§4.3 des Rollen-Datensplits), und ein
// PDF kennt keine Rolle mehr, sobald es erzeugt ist. Deshalb nimmt diese Datei
// gar keine Geldfelder an: keine Löhne, keine Personalkosten, keine
// Verdienstgrenzen, keine Zuschläge, keine Umsätze. Was hier nicht als
// Parameter existiert, kann auch nicht versehentlich durchgereicht werden —
// das ist der Grund, warum die Signatur die Schicht- und Personenfelder
// einzeln nennt statt `PlanDaten` komplett zu übernehmen.
import { uhrzeitInZone } from "@/lib/personal-zeit";

/** Eine Schicht, so weit der Aushang sie braucht. Bewusst OHNE Geldfelder. */
export type DruckSchicht = {
  id: string;
  user_id: string | null;
  datum: string;
  start_at: string;
  end_at: string;
  status: string;
  arbeitsbereich_id: string | null;
  property_title: string | null;
  notiz: string | null;
};

/** Eine Person des Plans. Bewusst OHNE AZK, Zuschläge und Verdienstgrenze. */
export type DruckPerson = {
  user_id: string;
  full_name: string | null;
};

export type DruckBereich = {
  id: string;
  kurz: string;
  farbe: string;
};

export type DruckOptionen = {
  /** Betriebsname für den Kopf. */
  betrieb: string | null;
  /** Montag der Woche (yyyy-MM-dd). */
  woche: string;
  /** Die sieben (oder mehr) Tage der Ansicht, aufsteigend. */
  tage: string[];
  personen: DruckPerson[];
  schichten: DruckSchicht[];
  bereiche: DruckBereich[];
  /** Feiertagsnamen je ISO-Tag. */
  feiertage: Record<string, string>;
  /** Betriebszeitzone — die Uhrzeiten auf dem Aushang sind Ortszeit. */
  zone: string;
  locale: string;
  /** Deutsche/lokalisierte Beschriftungen; der Aufrufer liefert sie aus `useTranslations`. */
  texte: {
    titel: string;
    kw: string;
    person: string;
    offeneSchichten: string;
    keineSchichten: string;
    erzeugtAm: string;
    entwurf: string;
  };
};

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** ISO-Kalenderwoche eines Montags — dieselbe Rechnung wie im Dienstplan. */
function isoWoche(montag: string): number {
  const d = new Date(`${montag}T00:00:00Z`);
  const donnerstag = new Date(d);
  donnerstag.setUTCDate(d.getUTCDate() + 3);
  const jahrStart = new Date(Date.UTC(donnerstag.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((donnerstag.getTime() - jahrStart.getTime()) / 86400000 + jahrStart.getUTCDay() + 1) / 7,
  );
}

/** Kalendertag, rein kalendarisch formatiert (`date`-Wert, kein Zeitanteil). */
function fmtTag(iso: string, locale: string, opts: Intl.DateTimeFormatOptions): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return esc(iso);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat(locale, opts).format(d);
}

/** Baut das eigenständige HTML des Aushangs. Exportiert für Prüfbarkeit. */
export function buildDienstplanHtml(o: DruckOptionen): string {
  const kurz = new Map(o.bereiche.map((b) => [b.id, b.kurz]));
  const farbe = new Map(o.bereiche.map((b) => [b.id, b.farbe]));

  // Schichten nach (Person, Tag) — abgesagte gehören nicht auf den Aushang.
  const zellen = new Map<string, DruckSchicht[]>();
  for (const s of o.schichten) {
    if (s.status === "abgesagt") continue;
    const key = `${s.user_id ?? "__offen__"}|${s.datum}`;
    zellen.set(key, [...(zellen.get(key) ?? []), s]);
  }
  for (const liste of zellen.values()) liste.sort((a, b) => a.start_at.localeCompare(b.start_at));

  function zelle(userId: string | null, tag: string): string {
    const liste = zellen.get(`${userId ?? "__offen__"}|${tag}`) ?? [];
    if (liste.length === 0) return '<td class="leer"></td>';
    const pillen = liste
      .map((s) => {
        const k = kurz.get(s.arbeitsbereich_id ?? "") ?? "";
        const f = farbe.get(s.arbeitsbereich_id ?? "") ?? "#64748b";
        const zeit = `${uhrzeitInZone(s.start_at, o.zone)}–${uhrzeitInZone(s.end_at, o.zone)}`;
        const zusatz = [k, s.property_title].filter(Boolean).join(" · ");
        const entwurf = s.status === "entwurf" ? " entwurf" : "";
        return `<div class="pille${entwurf}" style="border-left-color:${esc(f)}">
            <span class="zeit">${esc(zeit)}</span>
            ${zusatz ? `<span class="zusatz">${esc(zusatz)}</span>` : ""}
            ${s.notiz ? `<span class="notiz">${esc(s.notiz)}</span>` : ""}
          </div>`;
      })
      .join("");
    return `<td>${pillen}</td>`;
  }

  const kopfzellen = o.tage
    .map((tag) => {
      const feiertag = o.feiertage[tag];
      return `<th>
        <div class="wtag">${fmtTag(tag, o.locale, { weekday: "short" })}</div>
        <div class="wdatum">${fmtTag(tag, o.locale, { day: "2-digit", month: "2-digit" })}</div>
        ${feiertag ? `<div class="feiertag">${esc(feiertag)}</div>` : ""}
      </th>`;
    })
    .join("");

  // Offene Schichten stehen zuerst — sie sind der Handlungsbedarf.
  const hatOffene = o.schichten.some((s) => !s.user_id && s.status !== "abgesagt");
  const offeneZeile = hatOffene
    ? `<tr class="offen">
        <th class="person">${esc(o.texte.offeneSchichten)}</th>
        ${o.tage.map((tag) => zelle(null, tag)).join("")}
      </tr>`
    : "";

  const personenZeilen = o.personen
    .map(
      (p) => `<tr>
        <th class="person">${esc(p.full_name ?? p.user_id)}</th>
        ${o.tage.map((tag) => zelle(p.user_id, tag)).join("")}
      </tr>`,
    )
    .join("");

  const leer = !hatOffene && o.personen.length === 0;

  const legende = o.bereiche
    .map(
      (b) =>
        `<span class="lg"><span class="lgfarbe" style="background:${esc(b.farbe)}"></span>${esc(b.kurz)}</span>`,
    )
    .join("");

  const zeitraum = `${fmtTag(o.tage[0] ?? o.woche, o.locale, { dateStyle: "medium" })} – ${fmtTag(
    o.tage[o.tage.length - 1] ?? o.woche,
    o.locale,
    { dateStyle: "medium" },
  )}`;

  return `<!DOCTYPE html><html lang="${esc(o.locale)}"><head><meta charset="utf-8" />
  <title>${esc(o.texte.titel)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
           font-size: 9px; color: #1a1a1a; margin: 0; }
    .kopf { display: flex; justify-content: space-between; align-items: flex-end;
            gap: 16px; margin-bottom: 8px; border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; }
    h1 { font-size: 15px; margin: 0 0 2px; }
    .betrieb { font-size: 11px; font-weight: 700; margin: 0 0 2px; }
    .meta { font-size: 9px; color: #666; text-align: right; }
    .kw { font-size: 13px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #d4d4d4; padding: 2px 3px; vertical-align: top; }
    thead th { background: #f2f2f2; text-align: left; font-size: 8px; }
    thead th:first-child { width: 15%; }
    .wtag { font-size: 10px; font-weight: 700; }
    .wdatum { color: #666; }
    .feiertag { color: #b91c1c; font-size: 7px; }
    th.person { background: #fafafa; text-align: left; font-size: 9px; font-weight: 600;
                word-break: break-word; }
    tr.offen th.person { background: #fff7ed; }
    td { height: 26px; }
    td.leer { background: #fcfcfc; }
    .pille { border-left: 3px solid #64748b; background: #f8f8f8; border-radius: 2px;
             padding: 1px 3px; margin-bottom: 1px; }
    .pille.entwurf { background: #fff; border-top: 1px dashed #bbb;
                     border-right: 1px dashed #bbb; border-bottom: 1px dashed #bbb; }
    .zeit { display: block; font-weight: 700; font-variant-numeric: tabular-nums; }
    .zusatz { display: block; color: #555; font-size: 8px; }
    .notiz { display: block; color: #777; font-size: 7px; font-style: italic; }
    .fuss { margin-top: 8px; display: flex; justify-content: space-between;
            align-items: center; gap: 12px; font-size: 8px; color: #777; }
    .lg { display: inline-flex; align-items: center; gap: 3px; margin-right: 8px; }
    .lgfarbe { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }
    .hinweis { font-size: 8px; color: #777; }
    .keine { padding: 16px; text-align: center; color: #888; }
  </style></head><body>
    <div class="kopf">
      <div>
        ${o.betrieb ? `<p class="betrieb">${esc(o.betrieb)}</p>` : ""}
        <h1>${esc(o.texte.titel)}</h1>
      </div>
      <div class="meta">
        <div class="kw">${esc(o.texte.kw)} ${isoWoche(o.woche)}</div>
        <div>${esc(zeitraum)}</div>
      </div>
    </div>

    ${
      leer
        ? `<p class="keine">${esc(o.texte.keineSchichten)}</p>`
        : `<table>
      <thead><tr><th>${esc(o.texte.person)}</th>${kopfzellen}</tr></thead>
      <tbody>${offeneZeile}${personenZeilen}</tbody>
    </table>`
    }

    <div class="fuss">
      <div>${legende}${legende ? " · " : ""}<span class="hinweis">${esc(o.texte.entwurf)}</span></div>
      <div>${esc(o.texte.erzeugtAm)}</div>
    </div>
  </body></html>`;
}

/** Erzeugt das PDF über den Render-Dienst und stößt den Download an. */
export async function downloadDienstplanPdf(o: DruckOptionen): Promise<void> {
  const res = await fetch("/api/v1/generate-pdf-single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ htmlContent: buildDienstplanHtml(o) }),
  });
  if (!res.ok) throw new Error("PDF-Generierung fehlgeschlagen.");
  const data = await res.json();
  if (!data.success || !data.pdfBase64) throw new Error("Leeres PDF.");

  const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dienstplan-${o.woche}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
