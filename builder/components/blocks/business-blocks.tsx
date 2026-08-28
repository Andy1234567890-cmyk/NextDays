// Die Business-Abschnitte des Baukastens (0452): Öffnungszeiten, Anruf-Knopf,
// E-Mail-Knopf, mehrere Standorte.
//
// Alle vier sind SERVER-Komponenten, und alle vier greifen auf dieselbe
// Rückfall-Regel zurück: ist das Feld leer, gilt, was im Firmenprofil steht.
// Der Renderer bekommt es ohnehin (`branding.organization`) — deshalb kostet
// der Rückfall keinen zusätzlichen Abruf.
//
// **Wochentage und Uhrzeiten stehen NICHT in einem Übersetzungskatalog.** Sie
// entstehen mit `Intl.DateTimeFormat` aus der Sprache der Seite. Eine eigene
// Liste „Montag … Sonntag" in 24 Sprachen wäre eine Übersetzungsbaustelle für
// etwas, das jede Laufzeitumgebung besser kann — samt der Frage, wie „Mo" in
// jeder Sprache abgekürzt wird.
import { Icon } from "@iconify/react";

import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import type { SiteBranding } from "@/lib/site-context";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

/** Überschrift eines Abschnitts. */
function Ueberschrift({ text, modus }: { text: string; modus: EditierModus }) {
  if (!text) return null;
  return (
    <h2
      {...editierbar(modus, "headline")}
      className="pb-6 font-display text-3xl font-extrabold tracking-tight"
    >
      {text}
    </h2>
  );
}

// =========================================================================
// Öffnungszeiten
// =========================================================================

type Zeit = { von?: unknown; bis?: unknown };
type Tag = { day?: unknown; mode?: unknown; times?: unknown };

/** Wochentagsname in der Sprache der Seite.
 *
 *  `day` ist 0 = Montag … 6 = Sonntag. Als Bezugsdatum dient ein bekannter
 *  Montag (2024-01-01 war einer) — so kommt der Name aus der Laufzeitumgebung
 *  statt aus einer gepflegten Liste. Die Uhrzeit im Datum ist mittags gesetzt,
 *  damit keine Zeitzone den Tag verschiebt.
 *
 *  Fällt `Intl` aus (sehr alte Umgebung), bleibt die Zahl stehen — sichtbar
 *  falsch statt still falsch. */
function wochentag(day: number, locale: string): string {
  try {
    const d = new Date(Date.UTC(2024, 0, 1 + day, 12));
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return String(day);
  }
}

/** `HH:MM` in der Schreibweise der Sprache — 24- oder 12-Stunden-Uhr.
 *
 *  Gespeichert wird immer 24-Stunden (`_ZEIT_RE` im Backend); wie es AUSSIEHT,
 *  entscheidet der Betrieb mit `clock_24h`. Zwei Formate in den Daten wären
 *  zwei Wahrheiten über dieselbe Uhrzeit. */
function uhrzeit(hhmm: string, locale: string, h24: boolean): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h)) return hhmm;
  try {
    const d = new Date(Date.UTC(2024, 0, 1, h, m));
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !h24,
      timeZone: "UTC",
    }).format(d);
  } catch {
    return hhmm;
  }
}

/** Die Zeile eines Tages: „09:00 – 17:00", „geschlossen", „durchgehend". */
function tagesText(
  tag: Tag,
  locale: string,
  h24: boolean,
  t: ReturnType<typeof texte>,
): string {
  switch (tag.mode) {
    case "closed":
      return t.zeitenGeschlossen;
    case "open24":
      return t.zeitenGanztaegig;
    case "appointment":
      return t.zeitenNachVereinbarung;
    default: {
      const zeiten = Array.isArray(tag.times) ? (tag.times as Zeit[]) : [];
      return zeiten
        .filter((z) => typeof z.von === "string" && typeof z.bis === "string")
        .map(
          (z) =>
            `${uhrzeit(z.von as string, locale, h24)} – ` +
            `${uhrzeit(z.bis as string, locale, h24)}`,
        )
        .join(", ");
    }
  }
}

export function OeffnungszeitenBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const roh = Array.isArray(content.days) ? (content.days as Tag[]) : [];
  const t = texte(modus.locale);

  if (roh.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerOeffnungszeiten}
      />
    );
  }

  const h24 = content.clock_24h !== false;
  const start =
    typeof content.week_start === "number" &&
    content.week_start >= 0 &&
    content.week_start <= 6
      ? content.week_start
      : 0;

  // Nach dem gewählten Wochenbeginn sortieren. `(d - start + 7) % 7` dreht die
  // Woche, ohne die gespeicherten Nummern zu verändern — die bleiben ISO
  // (0 = Montag), damit dieselben Daten bei einer späteren Änderung des
  // Wochenbeginns weiter stimmen.
  const tage = [...roh]
    .filter((d) => typeof d.day === "number")
    .sort(
      (a, b) =>
        (((a.day as number) - start + 7) % 7) -
        (((b.day as number) - start + 7) % 7),
    )
    .map((d) => ({
      tag: d.day as number,
      text: tagesText(d, modus.locale, h24, t),
    }));

  // Aufeinanderfolgende Tage mit gleichem Text zusammenfassen („Mo – Fr").
  // „Aufeinanderfolgend" heißt in der GEDREHTEN Reihenfolge — sonst entstünde
  // bei Wochenbeginn Sonntag eine Gruppe, die über den Wochenwechsel springt.
  const gruppen: Array<{ von: number; bis: number; text: string }> = [];
  const fassen = content.combine_identical !== false;
  for (const eintrag of tage) {
    const letzte = gruppen[gruppen.length - 1];
    const folgt =
      letzte !== undefined &&
      ((eintrag.tag - letzte.bis + 7) % 7 === 1 || eintrag.tag === letzte.bis);
    if (fassen && letzte && letzte.text === eintrag.text && folgt) {
      letzte.bis = eintrag.tag;
    } else {
      gruppen.push({ von: eintrag.tag, bis: eintrag.tag, text: eintrag.text });
    }
  }

  // Ausnahmetage erscheinen erst, wenn sie nah genug sind — Hostaways Regel
  // (13 Tage, `SONDERTAG_VORLAUF_TAGE` im Backend). Ein Hinweis „am 24.12.
  // geschlossen", der im März auf der Seite steht, ist kein Hinweis.
  const heute = new Date();
  const grenze = new Date(heute.getTime() + 13 * 86400000);
  const sonder = (
    Array.isArray(content.special_days)
      ? (content.special_days as Array<Record<string, unknown>>)
      : []
  )
    .filter((s) => typeof s.date === "string")
    // Mittags und in UTC: ein Datum ohne Uhrzeit landet je nach Zeitzone einen
    // Tag daneben, und ein Feiertag am falschen Tag ist schlimmer als keiner.
    .map((s) => ({ eintrag: s, d: new Date(`${s.date as string}T12:00:00Z`) }))
    .filter((s) => !Number.isNaN(s.d.getTime()) && s.d >= heute && s.d <= grenze)
    .sort((a, b) => a.d.getTime() - b.d.getTime());

  return (
    <section className="mx-auto max-w-2xl px-6 py-14">
      <Ueberschrift text={headline} modus={modus} />
      <dl className="divide-y divide-border rounded-2xl border border-border px-6">
        {gruppen.map((g, i) => (
          <div key={i} className="flex justify-between gap-6 py-3">
            <dt className="font-medium">
              {g.von === g.bis
                ? wochentag(g.von, modus.locale)
                : `${wochentag(g.von, modus.locale)} – ${wochentag(g.bis, modus.locale)}`}
            </dt>
            <dd className="text-right text-muted-foreground">{g.text}</dd>
          </div>
        ))}
      </dl>
      {sonder.length > 0 ? (
        <ul className="flex flex-col gap-1 pt-4 text-sm">
          {sonder.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <Icon
                icon="ph:calendar-x"
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-primary"
              />
              <span>
                <span className="font-medium">
                  {new Intl.DateTimeFormat(modus.locale, {
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  }).format(s.d)}
                </span>{" "}
                <span className="text-muted-foreground">
                  {pickText(s.eintrag.label, modus.locale) ||
                    tagesText(s.eintrag as Tag, modus.locale, h24, t)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

// =========================================================================
// Anruf-Knopf
// =========================================================================

/** Was in ein `tel:` darf: Ziffern und ein führendes `+`.
 *
 *  Die Nummer ist beim Speichern schon geprüft; hier fallen zusätzlich die
 *  Trennzeichen weg, die zum LESEN da sind und beim WÄHLEN stören. */
function telZiel(nummer: string): string {
  const ziffern = nummer.replace(/[^\d+]/g, "");
  return ziffern.startsWith("+") ? ziffern : ziffern.replace(/\+/g, "");
}

export function AnrufBlock({
  content,
  modus = NICHT_EDITIERBAR,
  branding,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  branding?: SiteBranding | null;
}) {
  const t = texte(modus.locale);
  // Leer = die Nummer aus dem Firmenprofil. Derselbe Grundsatz wie beim
  // Karten-Abschnitt.
  const eigene = typeof content.phone === "string" ? content.phone.trim() : "";
  const nummer = eigene || branding?.organization?.phone || "";

  if (!nummer) {
    return <AbschnittLeer modus={modus} grund={t.leerAnrufen} />;
  }

  const beschriftung = pickText(content.label, modus.locale) || t.anrufen;
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-6 py-8">
      <a
        href={`tel:${telZiel(nummer)}`}
        {...editierbar(modus, "label")}
        className="btn-marke btn-marke-primaer inline-flex items-center gap-2 bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5"
      >
        <Icon icon="ph:phone" aria-hidden className="size-5" />
        {beschriftung}
      </a>
      {/* Die Nummer zusätzlich als Text: am Rechner kann `tel:` nichts tun,
          und ohne sie hätte der Gast dort einen Knopf ohne Wirkung. */}
      {content.show_number !== false ? (
        <span className="text-sm text-muted-foreground">{nummer}</span>
      ) : null}
    </div>
  );
}

// =========================================================================
// E-Mail-Knopf
// =========================================================================

export function EmailBlock({
  content,
  modus = NICHT_EDITIERBAR,
  branding,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  branding?: SiteBranding | null;
}) {
  const t = texte(modus.locale);
  const eigene = typeof content.email === "string" ? content.email.trim() : "";
  const adresse = eigene || branding?.organization?.email || "";

  if (!adresse) {
    return <AbschnittLeer modus={modus} grund={t.leerEmailKnopf} />;
  }

  const betreff = pickText(content.subject, modus.locale).trim();
  // Ohne Betreff entfällt der Parameter — kein erfundenes „Anfrage über die
  // Website" (Wurzel 4).
  const ziel =
    `mailto:${encodeURIComponent(adresse)}` +
    (betreff ? `?subject=${encodeURIComponent(betreff)}` : "");
  const beschriftung = pickText(content.label, modus.locale) || t.emailSchreiben;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-6 py-8">
      <a
        href={ziel}
        {...editierbar(modus, "label")}
        className="btn-marke btn-marke-primaer inline-flex items-center gap-2 bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5"
      >
        <Icon icon="ph:envelope" aria-hidden className="size-5" />
        {beschriftung}
      </a>
      {content.show_address !== false ? (
        <span className="text-sm text-muted-foreground">{adresse}</span>
      ) : null}
    </div>
  );
}

// =========================================================================
// Mehrere Standorte
// =========================================================================

const SPALTEN: Record<number, string> = {
  1: "grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function StandorteBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const t = texte(modus.locale);
  const headline = pickText(content.headline, modus.locale);
  const roh = Array.isArray(content.items)
    ? (content.items as Array<Record<string, unknown>>)
    : [];
  const items = roh
    .map((s) => ({
      name: pickText(s.name, modus.locale).trim(),
      adresse: typeof s.address === "string" ? s.address.trim() : "",
      info: pickText(s.info, modus.locale).trim(),
      telefon: typeof s.phone === "string" ? s.phone.trim() : "",
      href: typeof s.href === "string" ? s.href : null,
      anrufKnopf: s.show_call !== false,
    }))
    // Ein Standort ohne Namen UND ohne Anschrift ist kein Standort.
    .filter((s) => s.name || s.adresse);

  if (items.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerStandorte}
      />
    );
  }

  const spalten =
    typeof content.columns === "number" && SPALTEN[content.columns]
      ? SPALTEN[content.columns]!
      : SPALTEN[3]!;

  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <Ueberschrift text={headline} modus={modus} />
      <ul className={`grid gap-4 ${spalten}`}>
        {items.map((s, i) => (
          <li
            key={i}
            className="flex flex-col gap-2 rounded-2xl border border-border p-5"
          >
            {s.name ? (
              <span className="text-lg font-semibold">{s.name}</span>
            ) : null}
            {s.adresse ? (
              <span className="whitespace-pre-line text-sm text-muted-foreground">
                {s.adresse}
              </span>
            ) : null}
            {s.info ? <span className="text-sm">{s.info}</span> : null}
            <div className="flex flex-wrap gap-3 pt-1 text-sm font-semibold">
              {s.telefon && s.anrufKnopf ? (
                <a
                  href={`tel:${telZiel(s.telefon)}`}
                  className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
                >
                  <Icon icon="ph:phone" aria-hidden className="size-4" />
                  {s.telefon}
                </a>
              ) : null}
              {s.adresse ? (
                // Der Link in die Karten-App des Gastes, nicht in einen
                // eingebetteten Rahmen: aus einem iframe heraus lässt sich
                // keine Navigation starten, und auf dem Telefon will man die
                // Route in der eigenen App.
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.adresse)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-4"
                >
                  <Icon icon="ph:map-pin" aria-hidden className="size-4" />
                  {t.standortKarte}
                </a>
              ) : null}
              {s.href ? (
                <a
                  href={s.href}
                  className="inline-flex items-center gap-1 underline underline-offset-4"
                >
                  <Icon icon="ph:arrow-right" aria-hidden className="size-4" />
                  {t.standortMehr}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
