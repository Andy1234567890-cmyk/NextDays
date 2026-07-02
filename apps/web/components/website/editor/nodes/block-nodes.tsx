"use client";

// Craft.js-Block-Nodes (Hero/Text/Objekt-Grid/Suche/Bild/Button/Galerie/
// Kontakt/Abstand) — die direkt auf der Canvas editierbaren Blöcke. Props
// spiegeln das site_blocks-content-Schema (locale-Maps), Text wird INLINE
// editiert (InlineText).
import { useNode } from "@craftjs/core";
import { Icon } from "@iconify/react";

import { fontStack } from "@/lib/website-fonts";
import { gridImages } from "@/lib/website-stock";

import { InlineText } from "../inline-text";
import { type LocaleMap, pick, put } from "./shared";

// =============================================================================
// HERO
// =============================================================================
export type HeroProps = {
  heading: LocaleMap;
  subheading: LocaleMap;
  eyebrow: LocaleMap;
  cta_label: LocaleMap;
  cta_href: string;
  image_url: string;
  variant: "fullscreen" | "split" | "centered";
  font_family: string | null;
};

export function HeroNode(props: Partial<HeroProps>) {
  const {
    connectors: { connect },
    actions: { setProp },
  } = useNode();

  const heading = pick(props.heading);
  const subheading = pick(props.subheading);
  const eyebrow = pick(props.eyebrow);
  const image = typeof props.image_url === "string" ? props.image_url : "";
  const variant = props.variant ?? "fullscreen";
  const hStyle = (() => {
    const s = fontStack(props.font_family ?? null);
    return s ? { fontFamily: s } : {};
  })();

  if (variant === "split") {
    return (
      <section ref={(r) => { if (r) connect(r); }} className="grid items-stretch md:grid-cols-2">
        <div className="relative min-h-[20rem] overflow-hidden md:min-h-[34rem]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-secondary to-muted" />
          )}
        </div>
        <div className="flex flex-col justify-center px-8 py-14 md:px-14">
          <InlineText
            as="p"
            value={eyebrow}
            placeholder="Eyebrow"
            onChange={(v) => setProp((p: HeroProps) => { p.eyebrow = put(p.eyebrow, v); })}
            className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
          />
          <InlineText
            as="h1"
            value={heading}
            placeholder="Überschrift"
            style={hStyle}
            onChange={(v) => setProp((p: HeroProps) => { p.heading = put(p.heading, v); })}
            className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-5xl empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
          />
          <InlineText
            as="p"
            value={subheading}
            placeholder="Unterzeile …"
            onChange={(v) => setProp((p: HeroProps) => { p.subheading = put(p.subheading, v); })}
            className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground empty:before:content-[attr(data-placeholder)]"
          />
        </div>
      </section>
    );
  }

  const centered = variant === "centered";
  return (
    <section
      ref={(r) => { if (r) connect(r); }}
      className="relative isolate flex min-h-[30rem] items-center overflow-hidden md:min-h-[40rem]"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-foreground via-foreground/90 to-primary" />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
      <div className={"mx-auto w-full max-w-6xl px-6 py-20 md:px-10 " + (centered ? "text-center" : "")}>
        <div className={centered ? "mx-auto max-w-3xl" : "max-w-3xl"}>
          <InlineText
            as="p"
            value={eyebrow}
            placeholder="Eyebrow"
            onChange={(v) => setProp((p: HeroProps) => { p.eyebrow = put(p.eyebrow, v); })}
            className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/80 empty:before:content-[attr(data-placeholder)]"
          />
          <InlineText
            as="h1"
            value={heading}
            placeholder="Große Überschrift"
            style={hStyle}
            onChange={(v) => setProp((p: HeroProps) => { p.heading = put(p.heading, v); })}
            className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-white drop-shadow-sm md:text-7xl empty:before:text-white/60 empty:before:content-[attr(data-placeholder)]"
          />
          <InlineText
            as="p"
            value={subheading}
            placeholder="Unterzeile …"
            onChange={(v) => setProp((p: HeroProps) => { p.subheading = put(p.subheading, v); })}
            className={"mt-5 text-lg leading-relaxed text-white/90 md:text-xl empty:before:text-white/60 empty:before:content-[attr(data-placeholder)] " + (centered ? "mx-auto max-w-2xl" : "max-w-2xl")}
          />
          {pick(props.cta_label) ? (
            <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg">
              {pick(props.cta_label)}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
HeroNode.craft = {
  displayName: "Hero",
  props: {
    heading: { de: "Große Überschrift" },
    subheading: { de: "Eine einladende Unterzeile, die Lust auf den Aufenthalt macht." },
    eyebrow: {},
    cta_label: {},
    cta_href: "",
    image_url: "",
    variant: "fullscreen",
    font_family: null,
  } as HeroProps,
};

// =============================================================================
// RICH TEXT (einfacher Absatz, inline)
// =============================================================================
export function TextNode(props: { html?: LocaleMap; align?: "left" | "center" }) {
  const {
    connectors: { connect },
    actions: { setProp },
  } = useNode();
  const text = pick(props.html).replace(/<[^>]+>/g, "");
  return (
    <div ref={(r) => { if (r) connect(r); }} className="mx-auto max-w-3xl px-6 py-12">
      <InlineText
        as="p"
        value={text}
        placeholder="Schreiben Sie hier Ihren Text …"
        onChange={(v) => setProp((p: { html: LocaleMap }) => { p.html = put(p.html, `<p>${v}</p>`); })}
        className={"text-lg leading-relaxed text-foreground/90 empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] " + (props.align === "center" ? "text-center" : "")}
      />
    </div>
  );
}
TextNode.craft = {
  displayName: "Text",
  props: { html: { de: "<p>Schreiben Sie hier Ihren Text …</p>" }, align: "left" },
};

// =============================================================================
// OBJEKT-GRID (Buchung) — im Editor mit Demo-Karten, im Renderer echte Objekte
// =============================================================================
export function PropertiesGridNode(props: { headline?: LocaleMap }) {
  const {
    connectors: { connect },
    actions: { setProp },
  } = useNode();
  const headline = pick(props.headline);
  const demos = gridImages("berg", 3);
  return (
    <section ref={(r) => { if (r) connect(r); }} className="mx-auto max-w-7xl px-6 py-14">
      <div className="mb-6 flex items-center gap-2">
        <Icon icon="ph:grid-four" className="size-5 text-primary" />
        <InlineText
          as="h2"
          value={headline}
          placeholder="Unsere Unterkünfte"
          onChange={(v) => setProp((p: { headline: LocaleMap }) => { p.headline = put(p.headline, v); })}
          className="font-display text-3xl font-semibold tracking-tight empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        />
        <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
          echte Objekte
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {demos.map((src, i) => (
          <div key={i} className="group">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
            </div>
            <div className="mt-3 flex items-start justify-between gap-2">
              <p className="font-medium">Beispiel-Unterkunft</p>
              <span className="flex items-center gap-1 text-sm"><Icon icon="ph:star-fill" className="size-3.5" />4,9</span>
            </div>
            <p className="text-sm text-muted-foreground">Musterort</p>
            <p className="mt-1 text-sm"><span className="font-semibold">ab 120 €</span> <span className="text-muted-foreground">Nacht</span></p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Vorschau · auf der Live-Seite erscheinen Ihre echten Objekte.
      </p>
    </section>
  );
}
PropertiesGridNode.craft = {
  displayName: "Objekt-Grid",
  props: { headline: { de: "Unsere Unterkünfte" } },
};

// =============================================================================
// SUCHE (Buchung) — elegante Pill-Leiste
// =============================================================================
export function SearchNode(props: { placeholder?: LocaleMap }) {
  const {
    connectors: { connect },
  } = useNode();
  const ph = pick(props.placeholder) || "Reiseziel suchen";
  return (
    <div ref={(r) => { if (r) connect(r); }} className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card p-2 shadow-lg shadow-black/5">
        <div className="flex flex-1 items-center gap-2 px-4">
          <Icon icon="ph:magnifying-glass" className="size-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{ph}</span>
        </div>
        <div className="hidden items-center gap-2 border-l border-border px-4 text-sm text-muted-foreground sm:flex">
          <Icon icon="ph:calendar-blank" className="size-4" /> Datum
        </div>
        <div className="hidden items-center gap-2 border-l border-border px-4 text-sm text-muted-foreground sm:flex">
          <Icon icon="ph:user" className="size-4" /> Gäste
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
          Suchen
        </span>
      </div>
    </div>
  );
}
SearchNode.craft = {
  displayName: "Suche",
  props: { placeholder: { de: "Reiseziel suchen" } },
};

// =============================================================================
// BILD
// =============================================================================
export function ImageNode(props: { url?: string; alt?: LocaleMap }) {
  const {
    connectors: { connect },
  } = useNode();
  const url = typeof props.url === "string" ? props.url : "";
  return (
    <figure ref={(r) => { if (r) connect(r); }} className="mx-auto max-w-4xl px-6 py-10">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={pick(props.alt)} className="w-full rounded-2xl object-cover" />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/40 text-muted-foreground">
          <span className="flex items-center gap-2"><Icon icon="ph:image" className="size-6" /> Bild wählen (rechts)</span>
        </div>
      )}
    </figure>
  );
}
ImageNode.craft = { displayName: "Bild", props: { url: "", alt: {} } };

// =============================================================================
// BUTTON
// =============================================================================
export function ButtonNode(props: { label?: LocaleMap; href?: string; variant?: "primary" | "secondary" }) {
  const {
    connectors: { connect },
    actions: { setProp },
  } = useNode();
  const label = pick(props.label);
  const secondary = props.variant === "secondary";
  return (
    <div ref={(r) => { if (r) connect(r); }} className="mx-auto max-w-3xl px-6 py-6 text-center">
      <span
        className={
          "inline-flex items-center rounded-full px-7 py-3.5 text-sm font-semibold " +
          (secondary ? "border border-border text-foreground" : "bg-primary text-primary-foreground shadow-lg shadow-primary/20")
        }
      >
        <InlineText
          as="span"
          value={label}
          placeholder="Button-Text"
          onChange={(v) => setProp((p: { label: LocaleMap }) => { p.label = put(p.label, v); })}
          className="outline-none empty:before:content-[attr(data-placeholder)]"
        />
      </span>
    </div>
  );
}
ButtonNode.craft = { displayName: "Button", props: { label: { de: "Mehr erfahren" }, href: "", variant: "primary" } };

// =============================================================================
// GALERIE
// =============================================================================
export function GalleryNode(props: { images?: Array<{ url: string }> }) {
  const {
    connectors: { connect },
  } = useNode();
  const imgs = Array.isArray(props.images) && props.images.length
    ? props.images.map((i) => i.url).filter(Boolean)
    : gridImages("kueste", 6);
  return (
    <div ref={(r) => { if (r) connect(r); }} className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-6 py-10 md:grid-cols-3">
      {imgs.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" className="aspect-square w-full rounded-xl object-cover" />
      ))}
    </div>
  );
}
GalleryNode.craft = { displayName: "Galerie", props: { images: [] } };

// =============================================================================
// KONTAKT
// =============================================================================
export function ContactNode(props: { headline?: LocaleMap; email?: string; phone?: string }) {
  const {
    connectors: { connect },
    actions: { setProp },
  } = useNode();
  return (
    <section ref={(r) => { if (r) connect(r); }} className="mx-auto max-w-3xl px-6 py-16">
      <InlineText
        as="h2"
        value={pick(props.headline)}
        placeholder="Kontakt"
        onChange={(v) => setProp((p: { headline: LocaleMap }) => { p.headline = put(p.headline, v); })}
        className="font-display text-3xl font-semibold tracking-tight empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
      />
      <div className="mt-4 space-y-1 text-muted-foreground">
        <p className="flex items-center gap-2"><Icon icon="ph:envelope" className="size-4" />{props.email || "name@beispiel.de"}</p>
        <p className="flex items-center gap-2"><Icon icon="ph:phone" className="size-4" />{props.phone || "+49 …"}</p>
      </div>
    </section>
  );
}
ContactNode.craft = { displayName: "Kontakt", props: { headline: { de: "Kontakt" }, email: "", phone: "" } };

// =============================================================================
// ABSTAND
// =============================================================================
export const SPACER_REM: Record<string, string> = { sm: "1.5rem", md: "3rem", lg: "5rem", xl: "8rem" };

export function SpacerNode(props: { size?: string }) {
  const {
    connectors: { connect },
  } = useNode();
  return (
    <div
      ref={(r) => { if (r) connect(r); }}
      style={{ height: SPACER_REM[props.size ?? "md"] ?? SPACER_REM.md }}
      className="mx-auto max-w-5xl"
    />
  );
}
SpacerNode.craft = { displayName: "Abstand", props: { size: "md" } };
