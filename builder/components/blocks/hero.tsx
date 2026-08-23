// Hero-Block — Premium-Template-Niveau (kein flacher Farbkasten).
// Drei Varianten: "fullscreen" (Vollbild + Gradient, große Display-Headline),
// "split" (Bild/Text 50/50), "centered" (zentriert über Bild). Brand-aware über
// die CSS-Vars; Schrift je Block überschreibbar (font_family). Optional ein
// eingebetteter Such-Slot (children) — die Buchung sitzt direkt im Hero.
import type { CSSProperties, ReactNode } from "react";

import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { fontStack } from "@/lib/fonts-catalog";
import { pickText } from "@/lib/i18n";

type Variante = "fullscreen" | "split" | "centered";

function headingStyle(content: Record<string, unknown>): CSSProperties {
  const stack = fontStack(
    typeof content.font_family === "string" ? content.font_family : null,
  );
  return stack ? { fontFamily: stack } : {};
}

export function HeroBlock({
  content,
  children,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  children?: ReactNode;
  modus?: EditierModus;
}) {
  const heading = pickText(content.heading, modus.locale);
  const subheading = pickText(content.subheading, modus.locale);
  const eyebrow = pickText(content.eyebrow, modus.locale);
  const ctaLabel = pickText(content.cta_label, modus.locale);
  const ctaHref = typeof content.cta_href === "string" ? content.cta_href : null;
  const imageUrl =
    typeof content.image_url === "string" ? content.image_url : null;
  const variante: Variante =
    content.variant === "split" || content.variant === "centered"
      ? content.variant
      : "fullscreen";
  const hStyle = headingStyle(content);

  const eyebrowEl = eyebrow ? (
    <p
      {...editierbar(modus, "eyebrow")}
      className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-primary"
    >
      {eyebrow}
    </p>
  ) : null;

  const cta =
    ctaLabel && ctaHref ? (
      <a
        href={ctaHref}
        {...editierbar(modus, "cta_label")}
        className="btn-marke btn-marke-primaer mt-8 inline-flex items-center gap-2 bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl"
      >
        {ctaLabel}
      </a>
    ) : null;

  // --- Split: Bild links, Text rechts (luftig, modern) ---------------------
  if (variante === "split") {
    return (
      <section className="grid items-stretch md:grid-cols-2">
        <div className="relative min-h-[24rem] overflow-hidden md:min-h-[40rem]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-secondary to-muted" />
          )}
        </div>
        <div className="flex flex-col justify-center px-8 py-16 md:px-16">
          {eyebrowEl}
          {heading ? (
            <h1
              style={hStyle}
              {...editierbar(modus, "heading")}
              className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl"
            >
              {heading}
            </h1>
          ) : null}
          {subheading ? (
            <p
              {...editierbar(modus, "subheading")}
              className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
            >
              {subheading}
            </p>
          ) : null}
          {cta}
          {children ? <div className="mt-8 max-w-lg">{children}</div> : null}
        </div>
      </section>
    );
  }

  // --- Fullscreen & Centered: Text über Vollbild + Gradient ----------------
  const centered = variante === "centered";
  return (
    <section className="relative isolate flex min-h-[34rem] items-center overflow-hidden md:min-h-[46rem]">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-foreground via-foreground/90 to-primary" />
      )}
      {/* Gradient-Overlay für Lesbarkeit (dunkel unten/links). */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/30 to-black/10"
      />
      <div
        className={
          "mx-auto w-full max-w-6xl px-6 py-24 md:px-10 " +
          (centered ? "text-center" : "")
        }
      >
        <div className={centered ? "mx-auto max-w-3xl" : "max-w-3xl"}>
          {eyebrow ? (
            <p
              {...editierbar(modus, "eyebrow")}
              className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/80"
            >
              {eyebrow}
            </p>
          ) : null}
          {heading ? (
            <h1
              style={hStyle}
              {...editierbar(modus, "heading")}
              className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-white drop-shadow-sm md:text-7xl"
            >
              {heading}
            </h1>
          ) : null}
          {subheading ? (
            <p
              {...editierbar(modus, "subheading")}
              className={
                "mt-6 text-lg leading-relaxed text-white/90 md:text-xl " +
                (centered ? "mx-auto max-w-2xl" : "max-w-2xl")
              }
            >
              {subheading}
            </p>
          ) : null}
          {cta}
          {children ? (
            <div className={"mt-10 " + (centered ? "mx-auto max-w-3xl" : "max-w-3xl")}>
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
