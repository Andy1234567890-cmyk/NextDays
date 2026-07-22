// Kanal-Logo-Leiste (Figma 3-663) — zentrierte Überschrift oben, darunter die
// Buchungskanal-Logos jeweils in einer weißen Karte. Logos sind echte Vektor-
// SVGs aus Figma (Airbnb als PNG, da im SVG-Export nur der Karten-Hintergrund
// vorlag). Padding im Original 4rem/20rem — hier über max-w-7xl responsiv.
import Image from "next/image";

const CHANNELS = [
  { name: "Booking.com", src: "/marketing/channels/booking-com.svg" },
  { name: "Google", src: "/marketing/channels/google.svg" },
  { name: "Expedia", src: "/marketing/channels/expedia.svg" },
  { name: "Airbnb", src: "/marketing/channels/airbnb.png" },
  { name: "Agoda", src: "/marketing/channels/agoda.svg" },
  { name: "Tripadvisor", src: "/marketing/channels/tripadvisor.svg" },
];

export function MarketingChannelsBar() {
  return (
    <section id="kanaele" className="bg-secondary/40">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-6 py-16">
        <p className="text-center text-base font-medium text-foreground">
          Verbinde dich mit über 450 Buchungskanälen und maximiere deine
          Auslastung.
        </p>
        <div className="flex w-full flex-wrap items-stretch justify-center gap-4">
          {CHANNELS.map((channel) => (
            <div
              key={channel.name}
              className="flex h-[4.25rem] flex-1 items-center justify-center rounded-2xl border border-border bg-card px-6 shadow-sm"
              style={{ minWidth: "10rem", maxWidth: "13.33rem" }}
            >
              <Image
                src={channel.src}
                alt={channel.name}
                width={181}
                height={68}
                className="h-full w-auto object-contain py-3"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
