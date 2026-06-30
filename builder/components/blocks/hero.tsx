// Hero-Block: großes Bild/Farbfläche + Überschrift, Unterzeile, optionaler CTA.
import { pickText } from "@/lib/i18n";

export function HeroBlock({ content }: { content: Record<string, unknown> }) {
  const heading = pickText(content.heading);
  const subheading = pickText(content.subheading);
  const ctaLabel = pickText(content.cta_label);
  const ctaHref = typeof content.cta_href === "string" ? content.cta_href : null;
  const imageUrl =
    typeof content.image_url === "string" ? content.image_url : null;

  return (
    <section className="relative overflow-hidden">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-secondary" />
      )}
      <div className="relative mx-auto flex max-w-5xl flex-col items-start gap-4 px-6 py-24">
        {heading ? (
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
            {heading}
          </h1>
        ) : null}
        {subheading ? (
          <p className="max-w-2xl text-lg text-muted-foreground">{subheading}</p>
        ) : null}
        {ctaLabel && ctaHref ? (
          <a
            href={ctaHref}
            className="mt-2 inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            {ctaLabel}
          </a>
        ) : null}
      </div>
    </section>
  );
}
