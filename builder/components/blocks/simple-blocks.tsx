// Schlanke Render-Blöcke auf Template-Niveau: Bild, Galerie, Button, Spacer,
// Kontakt. Großzügige Aspect-Ratios, Rundungen, Hover-States, Lesetypografie.
import type { BildLaden } from "@/lib/bilder";
import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

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
    <figure className="mx-auto max-w-5xl px-6 py-12">
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
    </figure>
  );
}

export function GalleryBlock({
  content,
  modus = NICHT_EDITIERBAR,
  laden = "lazy",
}: {
  content: Record<string, unknown>;
  /** Nur für den Platzhalter im Entwurf — die Galerie selbst hat keine
   *  bearbeitbaren Textstellen. */
  modus?: EditierModus;
  laden?: BildLaden;
}) {
  const images = Array.isArray(content.images)
    ? (content.images as Array<Record<string, unknown>>)
    : [];
  if (images.length === 0) {
    return (
      <AbschnittLeer modus={modus} grund={texte(modus.locale).leerGalerie} />
    );
  }
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-6 py-12 md:grid-cols-3">
      {images.map((img, i) => {
        const url = typeof img.url === "string" ? img.url : null;
        if (!url) return null;
        // Erstes Bild größer (Masonry-Anmutung).
        const span = i === 0 ? "md:col-span-2 md:row-span-2" : "";
        return (
          <div
            key={`${url}-${i}`}
            className={`group overflow-hidden rounded-2xl ${span}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={pickText(img.alt)}
              // Nur das GROSSE erste Bild folgt der Einstellung; die kleineren
              // stehen in einem Raster darunter und laden immer erst beim
              // Scrollen. Eine Galerie mit zwölf Bildern sofort zu laden wäre
              // der eine Fall, in dem der Schalter nichts retten könnte.
              loading={i === 0 ? laden : "lazy"}
              fetchPriority={i === 0 && laden === "eager" ? "high" : undefined}
              className="aspect-square size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        );
      })}
    </div>
  );
}

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

export function ContactBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const email = typeof content.email === "string" ? content.email : null;
  const phone = typeof content.phone === "string" ? content.phone : null;
  const address = pickText(content.address, modus.locale);
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
      </div>
    </section>
  );
}
