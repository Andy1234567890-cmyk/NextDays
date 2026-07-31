// Kanal-Sektion — die verbundenen Buchungsplattformen als Logo-Raster.
//
// Referenz-UX (hostaway.com): direkt unter dem Hero ein eigener heller Block
// mit „Elite Partner with …" und den Partner-Logos in flachen, einheitlich
// hohen Karten — kein Marquee, keine Filter auf den Logos, Originalfarben.
// Lag vorher als dunkle Leiste IM Hero; als eigene Sektion trägt sie den
// Nav-Anker #kanaele und bekommt die Überschrift, die sie erklärt.
import { useTranslations } from "next-intl";
import Image from "next/image";

const CHANNELS = [
  { src: "/marketing/channels/booking-com.svg", alt: "Booking.com" },
  { src: "/marketing/channels/airbnb.png", alt: "Airbnb" },
  { src: "/marketing/channels/expedia.svg", alt: "Expedia" },
  { src: "/marketing/channels/google.svg", alt: "Google" },
  { src: "/marketing/channels/agoda.svg", alt: "Agoda" },
  { src: "/marketing/channels/tripadvisor.svg", alt: "Tripadvisor" },
];

export function MarketingChannels() {
  const t = useTranslations("hero");

  return (
    // Teil des ersten Bildschirms (eingehängt im Hero): flache Abstände, damit
    // Botschaft, CTAs und Logos zusammen ohne Scrollen sichtbar bleiben.
    <div id="kanaele" className="w-full">
      <div className="mx-auto max-w-7xl px-6 pb-8">
        {/* Nur die Eyebrow-Zeile: die Überschrift hätte den ersten Bildschirm
            gesprengt, der erklärende Text steht ohnehin in der Orbit-Sektion
            (marketing-integrations). */}
        <p className="eyebrow text-center">{t("kanaeleLabel")}</p>

        {/* Karten mit Original-Logofarben: die Exporte bringen eigene weiße
            Hintergrundflächen mit — jeder CSS-Filter würde sie als Blöcke
            sichtbar machen. */}
        <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-6">
          {CHANNELS.map((ch) => (
            <div
              key={ch.alt}
              className="flex h-16 items-center justify-center rounded-xl border border-border bg-card px-4 shadow-card transition hover:shadow-soft"
            >
              <Image
                src={ch.src}
                alt={ch.alt}
                width={181}
                height={68}
                className="h-full w-auto object-contain py-3"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
