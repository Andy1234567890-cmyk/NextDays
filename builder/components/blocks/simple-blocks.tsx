// Schlanke Render-Blöcke auf Template-Niveau: Bild, Button, Spacer, Kontakt.
// Großzügige Aspect-Ratios, Rundungen, Hover-States, Lesetypografie.
//
// Die Galerie stand hier bis 0451 und liegt jetzt in `galerie.tsx` — siehe die
// Begründung an ihrer alten Stelle weiter unten.
import type { BildLaden } from "@/lib/bilder";
import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

import type { SiteBranding } from "@/lib/site-context";

import { AbschnittLeer } from "./abschnitt-leer";
import { FormularBlock } from "./formular";
import { BildNachweis } from "./bildnachweis";

export function ImageBlock({
  content,
  modus = NICHT_EDITIERBAR,
  laden = "lazy",
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  /** Ladeart des Bildes (0430) — hängt an der Position des Blocks. */
  laden?: BildLaden;
}) {
  const url = typeof content.url === "string" ? content.url : null;
  if (!url) {
    return (
      <AbschnittLeer modus={modus} grund={texte(modus.locale).leerBild} />
    );
  }
  const alt = pickText(content.alt, modus.locale);
  const caption = pickText(content.caption, modus.locale);
  return (
    <figure className="mx-auto max-w-5xl px-6 py-12 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading={laden}
        // `fetchPriority` nur beim sofort geladenen Bild: es sagt dem Browser,
        // dieses eine Bild VOR den anderen Anfragen zu holen. Auf jedem Bild
        // gesetzt wäre es wirkungslos — Priorität ist eine Reihenfolge, keine
        // Eigenschaft.
        fetchPriority={laden === "eager" ? "high" : undefined}
        className="w-full rounded-3xl object-cover shadow-sm"
      />
      {caption ? (
        <figcaption
          {...editierbar(modus, "caption")}
          className="mt-3 text-center text-sm text-muted-foreground"
        >
          {caption}
        </figcaption>
      ) : null}
      {/* Pflicht-Nachweis der Stock-Quelle. Rendert nichts, wenn es zu dieser
          Adresse keinen gibt (components/blocks/bildnachweis.tsx). */}
      <BildNachweis src={url} variante="zeile" />
    </figure>
  );
}

// `GalleryBlock` stand hier bis 0451. Sie ist nach `galerie.tsx` gezogen, weil
// sie mit der Lightbox einen Zustand im Browser bekommen hat und damit eine
// Client-Komponente sein muss. NICHT kopiert, sondern verschoben: zwei
// Galerie-Fassungen derselben Daten wären irgendwann auseinandergelaufen.

export function ButtonBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const label = pickText(content.label, modus.locale);
  const href = typeof content.href === "string" ? content.href : null;
  // Beides ist nötig: eine Beschriftung ohne Ziel führt nirgendwohin, ein Ziel
  // ohne Beschriftung ist unsichtbar.
  if (!label || !href) {
    return (
      <AbschnittLeer modus={modus} grund={texte(modus.locale).leerButton} />
    );
  }
  const secondary = content.variant === "secondary";
  return (
    <div className="mx-auto max-w-3xl px-6 py-8 text-center">
      <a
        href={href}
        {...editierbar(modus, "label")}
        className={
          "btn-marke inline-flex items-center gap-2 px-8 py-4 text-base font-semibold transition hover:-translate-y-0.5 " +
          (secondary
            ? "border border-border text-foreground hover:bg-secondary"
            : "btn-marke-primaer bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl")
        }
      >
        {label}
      </a>
    </div>
  );
}

const SPACER_REM: Record<string, string> = {
  sm: "1.5rem",
  md: "3rem",
  lg: "5rem",
  xl: "8rem",
};

export function SpacerBlock({ content }: { content: Record<string, unknown> }) {
  const size = typeof content.size === "string" ? content.size : "md";
  return <div style={{ height: SPACER_REM[size] ?? SPACER_REM.md }} />;
}

/** Die Felder des Kontaktformulars für den Renderer.
 *
 *  DIESELBEN vier wie serverseitig (`block_inhalte.kontakt_formular_felder`),
 *  und die Namen sind der Vertrag: der Absende-Endpunkt prüft die Eingaben
 *  gegen seine Liste und wirft unbekannte Felder weg. Ein hier umbenanntes
 *  Feld käme also stumm nicht an.
 *
 *  Die Beschriftungen kommen aus dem Renderer-Katalog und nicht aus dem
 *  Block-Inhalt: der Kontakt-Abschnitt hat keinen Feld-Baukasten (dafür gibt
 *  es den Formular-Abschnitt), er hat einen Schalter. */
function kontaktFelder(sprache: string) {
  const t = texte(sprache);
  // Die Locale-Map trägt nur DIESE Sprache — der Renderer zeigt pro Aufruf
  // genau eine, und `pickText` im Formular liest sie darüber.
  const map = (wert: string) => ({ [sprache]: wert });
  return [
    { name: "name", type: "text", required: true, label: map(t.kontaktFormularName) },
    { name: "email", type: "email", required: true, label: map(t.kontaktFormularEmail) },
    {
      name: "message",
      type: "textarea",
      required: true,
      label: map(t.kontaktFormularNachricht),
    },
    {
      name: "consent",
      type: "consent",
      required: true,
      label: map(t.datenschutzZustimmung),
    },
  ];
}

export function ContactBlock({
  content,
  modus = NICHT_EDITIERBAR,
  branding,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  /** Für den Datenschutz-Link am Zustimmungsfeld des Formulars. */
  branding?: SiteBranding | null;
}) {
  const headline = pickText(content.headline, modus.locale);
  const email = typeof content.email === "string" ? content.email : null;
  const phone = typeof content.phone === "string" ? content.phone : null;
  const address = pickText(content.address, modus.locale);
  // Der Schalter „Kontaktformular anzeigen". Bis 27.08.2026 las ihn NIEMAND:
  // er stand im Katalog, im Pydantic-Schema und in drei Vorlagen auf `true`,
  // und der Renderer kannte das Feld nicht — ein Bedienelement ohne Deckung
  // (Prüfbericht B4, Wurzel 4).
  const zeigeFormular = content.show_form === true;
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="rounded-3xl bg-secondary/40 px-8 py-12 md:px-14">
        {headline ? (
          <h2
            {...editierbar(modus, "headline")}
            className="font-display text-3xl font-semibold tracking-tight md:text-4xl"
          >
            {headline}
          </h2>
        ) : null}
        <div className="mt-6 grid gap-4 text-lg text-muted-foreground sm:grid-cols-2">
          {email ? (
            <a
              href={`mailto:${email}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {email}
            </a>
          ) : null}
          {phone ? <p>{phone}</p> : null}
          {address ? (
            <p className="whitespace-pre-line sm:col-span-2">{address}</p>
          ) : null}
        </div>
        {zeigeFormular ? (
          // Der bestehende Formular-Block, gespeist mit den festen Feldern.
          // Kein zweites Formular: Absenden, Spamschutz, Fehlerzustände und
          // die Bestätigung stecken dort schon (0436/0444/0445), und eine
          // Kopie davon liefe beim ersten Fix auseinander.
          //
          // `-mx-*` hebt die Innenabstände der Kontaktkarte auf: der
          // Formular-Block bringt seine eigenen mit, und zwei übereinander
          // ließen ihn eingerückt neben den Kontaktdaten stehen.
          <div className="-mx-8 mt-4 md:-mx-14">
            <FormularBlock
              content={{
                __block_id: content.__block_id,
                fields: kontaktFelder(modus.locale),
                submit_label: {
                  [modus.locale]: texte(modus.locale).kontaktFormularSenden,
                },
              }}
              modus={modus}
              branding={branding}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
