// Schlanke Render-Blöcke: Bild, Galerie, Button, Spacer, Kontakt.
import { pickText } from "@/lib/i18n";

export function ImageBlock({ content }: { content: Record<string, unknown> }) {
  const url = typeof content.url === "string" ? content.url : null;
  if (!url) return null;
  const alt = pickText(content.alt);
  const caption = pickText(content.caption);
  return (
    <figure className="mx-auto max-w-4xl px-6 py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="w-full rounded-2xl object-cover" />
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function GalleryBlock({ content }: { content: Record<string, unknown> }) {
  const images = Array.isArray(content.images)
    ? (content.images as Array<Record<string, unknown>>)
    : [];
  if (images.length === 0) return null;
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-6 py-8 md:grid-cols-3">
      {images.map((img, i) => {
        const url = typeof img.url === "string" ? img.url : null;
        if (!url) return null;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${url}-${i}`}
            src={url}
            alt={pickText(img.alt)}
            className="aspect-square w-full rounded-xl object-cover"
          />
        );
      })}
    </div>
  );
}

export function ButtonBlock({ content }: { content: Record<string, unknown> }) {
  const label = pickText(content.label);
  const href = typeof content.href === "string" ? content.href : null;
  if (!label || !href) return null;
  const secondary = content.variant === "secondary";
  return (
    <div className="mx-auto max-w-3xl px-6 py-6 text-center">
      <a
        href={href}
        className={
          "inline-flex items-center rounded-full px-6 py-3 text-sm font-medium " +
          (secondary
            ? "border border-border text-foreground"
            : "bg-primary text-primary-foreground")
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

export function ContactBlock({ content }: { content: Record<string, unknown> }) {
  const headline = pickText(content.headline);
  const email = typeof content.email === "string" ? content.email : null;
  const phone = typeof content.phone === "string" ? content.phone : null;
  const address = pickText(content.address);
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      {headline ? (
        <h2 className="font-display text-2xl font-semibold">{headline}</h2>
      ) : null}
      <div className="mt-4 space-y-1 text-muted-foreground">
        {email ? (
          <p>
            <a href={`mailto:${email}`} className="underline">
              {email}
            </a>
          </p>
        ) : null}
        {phone ? <p>{phone}</p> : null}
        {address ? <p className="whitespace-pre-line">{address}</p> : null}
      </div>
    </section>
  );
}
