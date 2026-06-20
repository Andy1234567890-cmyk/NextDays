// Testimonials — "Was unsere zufriedenen Kunden sagen" (2 Zitat-Karten).
// Der Stats-Block ist eine eigene Sektion: marketing-stats.tsx (Figma 3-1109).
import { Icon } from "@iconify/react";

const TESTIMONIALS = [
  {
    quote:
      "Es ist so einfach zu bedienen! Alle Informationen laufen an einem Ort zusammen und ich kann von überall darauf zugreifen. Wirklich brillant. Auch das Support-Team ist sehr hilfsbereit.",
    name: "French Bay House",
    location: "Neuseeland",
  },
  {
    quote:
      "myNextDays hatte ein fantastisches Onboarding und war leicht einzurichten. Ich hatte alle Zeit, die ich brauchte, um mit dem Team zu sprechen. Es ist sehr benutzerfreundlich.",
    name: "Country Dome Suites",
    location: "Houston, USA",
  },
];

export function MarketingTestimonials() {
  return (
    <section id="kunden" className="bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Was unsere zufriedenen Kunden sagen.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-8 shadow-sm"
            >
              <div className="flex text-accent">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Icon key={i} icon="ph:star-fill" className="size-4" />
                ))}
              </div>
              <blockquote className="text-muted-foreground">„{t.quote}“</blockquote>
              <figcaption className="mt-auto">
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.location}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
