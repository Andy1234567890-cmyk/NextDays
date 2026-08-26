// Kanal-Sektion — die verbundenen Buchungsplattformen als Logo-Raster.
//
// Referenz-UX (hostaway.com): direkt unter dem Hero ein eigener heller Block
// mit „Elite Partner with …" und den Partner-Logos in flachen, einheitlich
// hohen Karten — kein Marquee, keine Filter auf den Logos, Originalfarben.
// Lag vorher als dunkle Leiste IM Hero; als eigene Sektion trägt sie den
// Nav-Anker #kanaele und bekommt die Überschrift, die sie erklärt.
import { useTranslations } from "next-intl";
import Image from "next/image";

// myBestDays steht am ENDE der Reihe. Vorher stand es vorn, weil es unser
// eigener Marktplatz ist; die Reihe beginnt jetzt aber mit den Portalen, die
// der Leser kennt — die eigene Marke schließt sie ab, statt sie anzuführen.
// Entscheidung vom 26.08.2026; dieselbe Reihenfolge gilt in
// `funktionen/funktions-grafiken.tsx` (GrafikKanaele).
const CHANNELS = [
  { src: "/marketing/channels/booking-com.svg", alt: "Booking.com" },
  { src: "/marketing/channels/airbnb.png", alt: "Airbnb" },
  { src: "/marketing/channels/expedia.svg", alt: "Expedia" },
  { src: "/marketing/channels/google.svg", alt: "Google" },
  { src: "/marketing/channels/agoda.svg", alt: "Agoda" },
  { src: "/marketing/channels/tripadvisor.svg", alt: "Tripadvisor" },
  { src: "/marketing/channels/mybestdays.png", alt: "myBestDays" },
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
        {/* Flex statt Grid, seit myBestDays als siebtes Logo dazukam: bei
            sieben Karten in einem 3-spaltigen Raster steht die letzte allein
            am linken Rand. `flex-wrap` mit fester Kartenbreite bricht
            genauso um, zentriert die angebrochene Reihe aber. */}
        <div className="mt-5 flex flex-wrap justify-center gap-3 sm:gap-4">
          {CHANNELS.map((ch) => (
            <div
              key={ch.alt}
              className="flex h-16 w-[calc((100%-1.5rem)/3)] items-center justify-center rounded-xl border border-border bg-card px-4 shadow-card transition hover:shadow-soft sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-6*1rem)/7)]"
            >
              <Image
                src={ch.src}
                alt={ch.alt}
                width={303}
                height={120}
                className="h-full w-auto object-contain py-3"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
