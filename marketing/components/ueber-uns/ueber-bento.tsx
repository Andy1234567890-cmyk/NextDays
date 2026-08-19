// Zahlen-Bento — die belegbaren Größen der Plattform.
//
// Referenz-UX (lodgify.com/about-us, „LODGIFY'S IMPACT"): ein Raster aus
// ungleich großen Karten, in dem eine Karte ein Foto trägt, eine einen
// Farbverlauf und die restlichen nur Zahl plus Erklärzeile. Das Ungleichmaß
// ist der Punkt — eine Reihe gleich großer Kacheln liest sich wie eine
// Tabelle, das Bento führt den Blick.
//
// Was hier bewusst FEHLT: Kundenzahlen, verwaltete Objekte, Buchungsvolumen.
// Der Start ist der 01.09.2026; solche Zahlen gibt es nicht, und eine
// geschätzte wäre eine Erfindung (Wurzel 4). Es stehen nur Werte, die an einer
// Quelle im Repo hängen: 27 Länder / 24 Sprachen (i18n), 56 Plattformen
// (Kanalanbindung), EU-Hosting (Infrastruktur), Sitz (anbieter.ts).
import { useTranslations } from "next-intl";
import Image from "next/image";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon } from "@/components/ui/icon";

export function UeberBento() {
  const t = useTranslations("ueberUns.bento");

  return (
    <section className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
        />

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {/* Große Foto-Karte: trägt die Aussage, die keine Zahl ist. */}
          <article className="relative row-span-2 min-h-[22rem] overflow-hidden rounded-3xl md:col-span-2">
            <Image
              src="/marketing/usecases/agentur.jpg"
              alt={t("vermieter.bildAlt")}
              fill
              sizes="(min-width: 768px) 42rem, 100vw"
              className="object-cover"
            />
            {/* Verlauf, damit der Text auf jedem Bildausschnitt lesbar bleibt. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
            />
            <div className="relative flex h-full flex-col justify-end p-8 text-white">
              <h3 className="font-display text-2xl font-bold sm:text-3xl">
                {t("vermieter.titel")}
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/80">
                {t("vermieter.text")}
              </p>
            </div>
          </article>

          <Kachel
            wert={t("laender.wert")}
            titel={t("laender.titel")}
            text={t("laender.text")}
            ton="accent"
          />
          <Kachel
            wert={t("sprachen.wert")}
            titel={t("sprachen.titel")}
            text={t("sprachen.text")}
            ton="card"
          />
          <Kachel
            wert={t("kanaele.wert")}
            titel={t("kanaele.titel")}
            text={t("kanaele.text")}
            ton="card"
          />

          {/* EU-Karte auf dunklem Grund: der Datenschutz-Punkt ist für die
              europäische Zielgruppe das Argument, nicht eine Fußnote. */}
          <article className="flex flex-col justify-between gap-6 rounded-3xl bg-primary p-8 text-primary-foreground md:col-span-2">
            <Icon icon="ph:shield-check" className="size-9 text-accent" />
            <div>
              <h3 className="font-display text-2xl font-bold">
                {t("eu.titel")}
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/70">
                {t("eu.text")}
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function Kachel({
  wert,
  titel,
  text,
  ton,
}: {
  wert: string;
  titel: string;
  text: string;
  ton: "accent" | "card";
}) {
  return (
    <article
      className={
        "flex flex-col justify-center rounded-3xl p-8 " +
        (ton === "accent" ? "bg-surface-accent" : "bg-card shadow-card")
      }
    >
      <p className="font-display text-5xl font-extrabold text-accent">{wert}</p>
      <h3 className="mt-3 font-display text-lg font-semibold">{titel}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
    </article>
  );
}
