// „Warum es uns gibt" — der Ursprung, zweispaltig mit einem echten Foto.
//
// Referenz-UX (guesty.com/about-us): auf den Hero folgt kein Funktionsblock,
// sondern der Gründungsgedanke in Fließtext („Guesty was born from a simple
// belief"). Lodgify macht dasselbe eine Etage tiefer. Übernommen ist die
// Reihenfolge, nicht der Ton: hier steht die konkrete Reibung aus dem eigenen
// Vermietungsalltag, weil genau die der Grund für das Produkt war.
//
// Das Bild ist eines der Objektfotos aus public/marketing/usecases — dieselbe
// Bildwelt wie auf der Startseite, kein neues Stock-Motiv.
import { useTranslations } from "next-intl";
import Image from "next/image";

import { SectionHeading } from "@/components/marketing/section-kit";

export function UeberStory() {
  const t = useTranslations("ueberUns.warum");

  return (
    <section className="bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow={t("eyebrow")}
            heading={t("heading")}
            align="left"
          />
          <div className="mt-6 flex flex-col gap-5 text-lg leading-relaxed text-muted-foreground">
            <p>{t("p1")}</p>
            <p>{t("p2")}</p>
            <p>{t("p3")}</p>
          </div>
        </div>

        {/* Zwei versetzte Bilder statt eines großen: die linke Spalte ist
            reiner Text und würde neben einem einzelnen Rechteck kippen. */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative aspect-[3/4] overflow-hidden rounded-3xl shadow-float">
            <Image
              src="/marketing/usecases/ferienobjekt.jpg"
              alt={t("bildFerienobjekt")}
              fill
              sizes="(min-width: 1024px) 20rem, 45vw"
              className="object-cover"
            />
          </div>
          <div className="relative mt-10 aspect-[3/4] overflow-hidden rounded-3xl shadow-float">
            <Image
              src="/marketing/usecases/hotelzimmer.jpg"
              alt={t("bildHotel")}
              fill
              sizes="(min-width: 1024px) 20rem, 45vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
