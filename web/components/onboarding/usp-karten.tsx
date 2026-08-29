"use client";

// Schwebende Karten über dem Foto — je Schritt ein eigener Satz.
//
// WARUM JE SCHRITT ANDERE: Foto und Claim wechseln mit dem Schritt, die Karten
// standen dagegen fest. Wer sich durch fünf Schritte klickt, las fünfmal
// dieselben fünf Sätze — sie wurden damit zur Tapete statt zur Aussage. Jetzt
// trägt jeder Abschnitt, was DORT zählt: erst die Portale, dann der Alltag,
// dann Geld und Gäste.
//
// WARUM MINIATUREN STATT ICONS: ein Schild-Icon neben „Doppelbuchungen" ist
// Dekoration; ein Belegungsplan, in dem zwei Nächte belegt sind, ZEIGT dieselbe
// Aussage. Die Miniaturen sind SVG in Token-Farben — sie folgen damit dem
// Hell-/Dunkel-Modus und müssen bei einer UI-Änderung nicht neu fotografiert
// werden (dasselbe Prinzip wie in `packages/ui/src/empty-state.tsx`).
//
// DIE PORTAL-KARTE ZEIGT DIE ECHTEN LOGOS: eine Karte, die „Airbnb, Booking,
// Expedia …" nur AUFZÄHLT, ist eine Behauptung; dieselben Marken als Zeichen
// sind der Beweis. Die Pfade kommen aus `CHANNEL_LOGO` (lib/channel-logos),
// nicht als Literale hier — damit gilt auch hier: nur echte, offiziell
// beschaffte Logos, nichts Geratenes, nichts Selbstgezeichnetes.
//
// WARUM DAS SCHWEBEN LOKAL DEFINIERT IST: `tw-animate-css` bringt Ein- und
// Ausblend-Animationen mit, aber kein dauerhaftes Auf-und-Ab. Eine erfundene
// Tailwind-Klasse fiele hier still aus (die Karten stünden einfach), deshalb
// steht das Keyframe als eigenes `<style>` in dieser Datei statt in globals.css.
import { Icon } from "@iconify/react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { channelLogo } from "@/lib/channel-logos";
import {
  MiniAuszahlung,
  MiniImport,
  MiniKalender,
  MiniPosteingang,
  MiniPreise,
  MiniSperre,
} from "@/components/onboarding/usp-miniaturen";

/** Die Kanäle auf der Portal-Karte, in der Reihenfolge ihrer Bedeutung für
 *  einen Ferienvermieter. Nicht der ganze Channex-Katalog — sechs Zeichen sind
 *  eine Aussage, vierzig wären eine Tapete.
 *
 *  myBestDays steht bewusst mit dabei und nicht abgesetzt: für den Betrieb ist
 *  unser Marktplatz ein Vertriebskanal wie Booking oder Airbnb, kein
 *  Sonderfall — genau so führt ihn auch die Kanal-Auswahl. */
const PORTALE = [
  "AirBNB",
  "BookingCom",
  "Expedia",
  "Vrbo",
  "Agoda",
  "myBestDays",
] as const;

/* ------------------------------------------------------------------ */
/* Die Sätze                                                           */
/* ------------------------------------------------------------------ */

type Karte = {
  id: string;
  /** Miniatur ODER Icon — Miniatur, wo sie etwas zeigt, das ein Icon nur benennt. */
  mini?: ReactNode;
  icon?: string;
  /** Die Portal-Karte trägt statt einer Miniatur die echten Logos. */
  logos?: boolean;
  oben: string;
  links: string;
  verzoegerung: string;
};

/** Ein Satz Karten je Abschnitt. Reihum, nicht starr je Schrittnummer — die
 *  Zahl der Schritte hängt am Zweig (Neukunde/Wechselkunde), ein fest
 *  verdrahteter Satz je Nummer liefe bei einer Änderung der Schrittfolge ins
 *  Leere. Genauso macht es die Schale mit den Fotos.
 *
 *  Die Positionen lassen die BILDMITTE frei: dort sitzt bei allen drei Fotos
 *  das Motiv (Person am Schreibtisch). Der Versatz je Karte verhindert, dass
 *  daraus eine Säule am Bildrand wird. */
const SAETZE: Karte[][] = [
  // Satz 1 — Anschluss: welche Portale, ein Kalender, kein Abtippen.
  [
    { id: "portale", logos: true, oben: "8%", links: "5%", verzoegerung: "0s" },
    {
      id: "kalender",
      mini: <MiniKalender />,
      oben: "30%",
      links: "44%",
      verzoegerung: "1.1s",
    },
    {
      id: "import",
      mini: <MiniImport />,
      oben: "55%",
      links: "6%",
      verzoegerung: "2.2s",
    },
    {
      id: "doppelt",
      mini: <MiniSperre />,
      oben: "77%",
      links: "12%",
      verzoegerung: "0.6s",
    },
  ],
  // Satz 2 — Alltag: Preise, Posteingang, Sperren, alles an einer Stelle.
  [
    {
      id: "preise",
      mini: <MiniPreise />,
      oben: "9%",
      links: "6%",
      verzoegerung: "0.4s",
    },
    {
      id: "posteingang",
      mini: <MiniPosteingang />,
      oben: "32%",
      links: "43%",
      verzoegerung: "1.6s",
    },
    {
      id: "doppelt",
      mini: <MiniSperre />,
      oben: "56%",
      links: "5%",
      verzoegerung: "0s",
    },
    {
      id: "kalender",
      mini: <MiniKalender />,
      oben: "78%",
      links: "13%",
      verzoegerung: "2.4s",
    },
  ],
  // Satz 3 — Geld und Gäste: was am Ende zählt.
  [
    {
      id: "zahlung",
      mini: <MiniAuszahlung />,
      oben: "9%",
      links: "7%",
      verzoegerung: "0.8s",
    },
    { id: "portale", logos: true, oben: "31%", links: "40%", verzoegerung: "0s" },
    {
      id: "posteingang",
      mini: <MiniPosteingang />,
      oben: "57%",
      links: "5%",
      verzoegerung: "2s",
    },
    { id: "app", icon: "ph:device-mobile", oben: "79%", links: "14%", verzoegerung: "1.2s" },
  ],
];

export function UspKarten({
  /** 1-basiert, wie in der Schale. */
  schritt,
  className,
}: {
  schritt: number;
  className?: string;
}) {
  const t = useTranslations("onboarding");

  // Ein Portal ohne echtes Logo fliegt raus, statt als leerer Kreis zu stehen.
  const logos = PORTALE.map((code) => ({ code, logo: channelLogo(code) })).filter(
    (p): p is { code: (typeof PORTALE)[number]; logo: string } => p.logo !== null,
  );

  const karten = SAETZE[(Math.max(schritt, 1) - 1) % SAETZE.length];

  return (
    <div className={className} aria-hidden>
      <style>{`
        @keyframes nd-schweben {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-0.55rem); }
        }
        /* Wer Bewegung abgestellt hat, bekommt die Karten ruhig — sie sind
           Dekoration, kein Inhalt, und dürfen niemandem Übelkeit machen. */
        @media (prefers-reduced-motion: reduce) {
          .nd-schwebekarte { animation: none !important; }
        }
      `}</style>

      {karten.map((k) => (
        <div
          // Der Schritt gehört in den Schlüssel: ohne ihn hält React die Karte
          // beim Schrittwechsel für dieselbe und lässt Position und
          // Animationsphase stehen, wo Satz 1 und Satz 2 dieselbe `id` haben.
          key={`${schritt}-${k.id}`}
          // Die Portal-Karte trägt sechs Logos nebeneinander und braucht dafür
          // mehr Breite als eine reine Textkarte.
          //
          // `bg-black/25` statt eines hellen Trägers: die Fotos sind warm und
          // hell (Sandwand, Fensterlicht), und weißer Text auf weißem Glas
          // verschwand dort. Ein dunkler Träger hält den Kontrast auf JEDEM der
          // drei Bilder, ohne das Foto abzudunkeln.
          className={`nd-schwebekarte absolute flex flex-col gap-2 rounded-2xl border border-white/20 bg-black/25 px-3 py-2.5 text-white shadow-lg backdrop-blur-md ${
            k.logos ? "max-w-[15.5rem]" : "max-w-[13rem]"
          }`}
          style={{
            top: k.oben,
            left: k.links,
            animation: `nd-schweben 6s ease-in-out ${k.verzoegerung} infinite`,
          }}
        >
          <div className="flex items-center gap-2.5">
            {k.icon ? (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/85">
                <Icon icon={k.icon} className="size-4 text-[#b82028]" />
              </span>
            ) : null}
            <span className="text-xs leading-snug font-medium drop-shadow">
              {t(`usp.${k.id}`)}
            </span>
          </div>

          {/* Miniatur bzw. Logos stehen UNTER dem Satz, nicht daneben: nebeneinander
              müssten sich sechs Marken und drei Textzeilen dieselben 13 rem
              teilen, und beides würde unlesbar. */}
          {/* Die Miniatur sitzt auf einer hellen Fläche: sie zitiert das
              Dashboard, und das ist hell. Auf dem dunklen Glasträger wäre sie
              ein Negativ ihrer selbst und nicht wiederzuerkennen.
              `text-black/70` setzt das `currentColor`, das die Miniaturen für
              alles Neutrale verwenden — die Kanalfarben bleiben davon
              unberührt. */}
          {k.mini ? (
            <div className="h-[3.25rem] overflow-hidden rounded-lg bg-white px-2 py-1.5 text-black/70">
              {k.mini}
            </div>
          ) : null}

          {k.logos ? (
            <div className="flex items-center gap-1.5">
              {logos.map((p) => (
                <span
                  key={p.code}
                  className="flex size-7 items-center justify-center rounded-full bg-white p-1 shadow-sm"
                >
                  {/* Kein next/image: die Logos sind kleine, statische SVGs aus
                      dem eigenen public-Ordner — der Optimierer brächte hier
                      nichts und `fill` verlangte je Logo einen Positionsrahmen. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.logo}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
