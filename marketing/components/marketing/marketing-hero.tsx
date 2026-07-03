// Hero — Vollbild-Hintergrund mit dunklem Overlay, zentrierter Headline,
// CTAs und Channel-Logo-Leiste. Ähnlich Lodgify-Stil.
// Hintergrundbild: ersetze /marketing/hero-bg.jpg durch ein echtes Foto.
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";

import { Button } from "@/components/ui/button";

const CHANNELS = [
  { src: "/marketing/channels/booking-com.svg", alt: "Booking.com" },
  { src: "/marketing/channels/airbnb.png",      alt: "Airbnb" },
  { src: "/marketing/channels/expedia.svg",     alt: "Expedia" },
  { src: "/marketing/channels/google.svg",      alt: "Google" },
  { src: "/marketing/channels/agoda.svg",       alt: "Agoda" },
  { src: "/marketing/channels/tripadvisor.svg", alt: "Tripadvisor" },
];

export function MarketingHero() {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden bg-primary">
      {/* Hintergrundbild — lege eine Datei unter /public/marketing/hero-bg.jpg ab,
          um sie zu aktivieren. Bis dahin zeigt bg-primary (Schwarz). */}
      {/* <Image
        src="/marketing/hero-bg.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center opacity-50"
      /> */}

      {/* Dunkles Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

      {/* Inhalt */}
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-28 pb-16 text-center">
        {/* Credibility */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <div className="flex text-yellow-400">
              {[0, 1, 2, 3].map((i) => (
                <Icon key={i} icon="ph:star-fill" className="size-4" />
              ))}
              <Icon icon="ph:star-half-fill" className="size-4" />
            </div>
            <span className="text-sm font-semibold text-white">4,5 / 5</span>
            <span className="text-sm text-white/60">· 921 Bewertungen</span>
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            Empfohlen von 53.000+ Gastgebern
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
          Mehr{" "}
          <span className="relative text-accent">
            Buchungen
            <svg
              aria-hidden
              viewBox="0 0 300 20"
              className="absolute -bottom-2 left-0 w-full text-accent"
              preserveAspectRatio="none"
            >
              <path
                d="M2 14 C 80 4, 220 4, 298 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
          ,<br />
          weniger Aufwand.
        </h1>

        {/* Subline */}
        <p className="mt-7 max-w-xl text-lg text-white/70">
          Verwalte deine Ferienwohnungen mit einer Plattform — Channel Manager,
          Kalender, Gäste-Kommunikation und Zahlungen in einem Ort.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" variant="accent" className="min-w-48 text-base">
            <Link href="/register">Jetzt 30 Tage kostenlos</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="min-w-40 border-white/30 bg-white/10 text-base text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
          >
            <Link href="#demo" className="gap-2">
              <Icon icon="ph:play-circle" className="size-5" />
              Demo ansehen
            </Link>
          </Button>
        </div>
      </div>

      {/* Channel-Karten — dunkel gestylt im Hero (die frühere helle
          Kanal-Sektion ist hierher gewandert; id="kanaele" hält den
          Nav-Anker). Logos per brightness-0+invert einheitlich weiß. */}
      <div
        id="kanaele"
        className="relative z-10 w-full border-t border-white/10 bg-black/40 py-8 backdrop-blur-sm"
      >
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest text-white/40">
          Verbunden mit allen großen Plattformen
        </p>
        <p className="mb-6 text-center text-sm text-white/70">
          Verbinde dich mit über 450 Buchungskanälen und maximiere deine
          Auslastung.
        </p>
        {/* Weiße Karten mit Original-Logofarben: die Figma-Exporte bringen
            eigene weiße Hintergrund-Flächen mit — auf weißer Karte unsichtbar,
            jeder CSS-Filter würde sie dagegen als Blöcke sichtbar machen. */}
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-stretch justify-center gap-4 px-6">
          {CHANNELS.map((ch) => (
            <div
              key={ch.alt}
              className="flex h-[4.25rem] flex-1 items-center justify-center rounded-2xl bg-white px-6 shadow-sm transition hover:shadow-md"
              style={{ minWidth: "10rem", maxWidth: "13.33rem" }}
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
    </section>
  );
}
