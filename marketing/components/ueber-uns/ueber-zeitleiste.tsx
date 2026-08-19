// Zeitleiste — die Etappen bis zum Start.
//
// Referenz-UX (guesty.com/about-us „2013–2026", mews.com/en/about „OUR STORY"):
// beide erzählen die Firmengeschichte als senkrechte Leiste aus Jahr + Titel +
// einem Satz. Das ist auf einer Über-uns-Seite der Abschnitt, der Vertrauen
// trägt, weil er nachprüfbar ist.
//
// Unsere Leiste ist kurz — die Gesellschaft ist am 01.07.2026 gegründet worden.
// Genau deshalb steht hier KEINE aufgeblähte Historie mit erfundenen
// Vorgeschichten: vier Etappen, jede mit einem Datum, das in den
// Registerdaten (anbieter.ts) oder in den Start-Claims dieser Seite steht.
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";

// Reihenfolge = Chronologie. Der letzte Eintrag ist als kommend markiert und
// bekommt einen offenen Punkt statt eines gefüllten.
const ETAPPEN = [
  { key: "airsmil", kommend: false },
  { key: "gruendung", kommend: false },
  { key: "beta", kommend: false },
  { key: "start", kommend: true },
] as const;

export function UeberZeitleiste() {
  const t = useTranslations("ueberUns.zeitleiste");

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
        />

        <ol className="relative mx-auto mt-14 max-w-3xl">
          {/* Durchgehende Linie hinter den Punkten. Sie endet an der Mitte des
              letzten Punktes, damit sie nicht ins Leere ausläuft. */}
          <span
            aria-hidden
            className="absolute left-[0.4375rem] top-2 bottom-8 w-px bg-border"
          />

          {ETAPPEN.map((e) => (
            <li key={e.key} className="relative pb-10 pl-10 last:pb-0">
              <span
                aria-hidden
                className={
                  "absolute left-0 top-1.5 size-3.5 rounded-full " +
                  (e.kommend
                    ? "border-2 border-accent bg-background"
                    : "bg-accent")
                }
              />
              <p className="font-display text-sm font-semibold uppercase tracking-wide text-accent">
                {t(`${e.key}.datum`)}
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold">
                {t(`${e.key}.titel`)}
              </h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {t(`${e.key}.text`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
