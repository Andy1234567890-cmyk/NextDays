// Die Menschen dahinter — die eingetragene Direktion der myNextDays ApS.
//
// Referenz-UX (mews.com/en/about, „Our people make Mews"): Porträt, Name,
// Rolle, zwei Sätze. Lodgify und Guesty zeigen auf ihrer About-Seite gar kein
// Team; für ein junges Unternehmen ist das der schlechtere Weg — wer neu ist,
// muss zeigen, mit wem man es zu tun hat.
//
// NAMENSQUELLE ist ausschließlich `ANBIETER.direktion` aus den Registerdaten.
// Die Karte sucht ihren Namen dort und rendert NICHT, wenn er fehlt: scheidet
// jemand aus der Direktion aus, verschwindet die Karte mit der Registerpflege,
// statt eine überholte Person weiter auszuweisen. Ein zweites, hier
// gepflegtes Namensfeld wäre genau die zweite Wahrheit, die das verhindert.
//
// Jede Karte trägt ein freigegebenes Porträt (`public/marketing/team/`). Kommt
// jemand ohne Foto in die Direktion, wird ein Porträt gemacht — ein
// Stock-Bild oder ein Platzhalter kommt hier nicht hin.
import { useTranslations } from "next-intl";
import Image from "next/image";

import { SectionHeading } from "@/components/marketing/section-kit";
import { ANBIETER } from "@/content/legal/anbieter";

const PERSONEN = [
  {
    key: "jeanine",
    vorname: "Jeanine",
    foto: "/marketing/team/jeanine-aagaard.png",
  },
  {
    key: "torsten",
    vorname: "Torsten",
    foto: "/marketing/team/torsten-aagaard.png",
  },
] as const;

export function UeberMenschen() {
  const t = useTranslations("ueberUns.menschen");

  const karten = PERSONEN.map((p) => ({
    ...p,
    name: ANBIETER.direktion.find((d) => d.startsWith(p.vorname)),
  })).filter((p): p is typeof p & { name: string } => Boolean(p.name));

  return (
    <section className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
        />

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
          {karten.map((p) => (
            <article
              key={p.key}
              className="overflow-hidden rounded-3xl bg-card shadow-card"
            >
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={p.foto}
                  alt={p.name}
                  fill
                  sizes="(min-width: 640px) 24rem, 100vw"
                  className="object-cover object-top"
                />
              </div>

              <div className="p-8">
                <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm font-medium text-accent">
                  {t(`${p.key}.rolle`)}
                </p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {t(`${p.key}.text`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
