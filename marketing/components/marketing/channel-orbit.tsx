// Kanal-Orbit — die verbundenen Buchungsplattformen als konzentrische
// Umlaufbahnen um myNextDays.
//
// Referenz (hostaway.com, „300+ integrations"): zwei Ringe aus weißen
// Logo-Kreisen um ein farbiges Zentrum, dünne Ringlinien mit einzelnen
// Punkten darauf, dahinter ein weicher radialer Schein. Ringe, Punkte und
// Schein liegen in EINEM SVG — Deckkraft dort als Attribut, weil die
// Arbitrary-Opacity-Varianten in Tailwind v4 unzuverlässig kompilieren.
//
// Logos: ausschließlich echte Markenlogos aus public/marketing/channels.
// Kein Platzhalter-Icon für Kanäle ohne Logo — lieber weniger Bubbles.
import Image from "next/image";

// Winkel in Grad, 0° = oben, im Uhrzeigersinn. Positionen sind fest gewählt
// (nicht zufällig), damit Server- und Client-Render identisch sind.
// Innerer Ring: 5 Bubbles im Abstand von 72°.
const INNER = [
  { src: "/marketing/channels/airbnb.svg", alt: "Airbnb", angle: -40 },
  { src: "/marketing/channels/booking.svg", alt: "Booking.com", angle: 32 },
  { src: "/marketing/channels/google.svg", alt: "Google", angle: 104 },
  { src: "/marketing/channels/vrbo.svg", alt: "Vrbo", angle: 176 },
  { src: "/marketing/channels/expedia.svg", alt: "Expedia", angle: 248 },
];

// Äußerer Ring: 8 Bubbles im Abstand von 45°, gegen den inneren versetzt.
const OUTER = [
  { src: "/marketing/channels/agoda.svg", alt: "Agoda", angle: 8 },
  { src: "/marketing/channels/tripcom.svg", alt: "Trip.com", angle: 53 },
  { src: "/marketing/channels/trivago.svg", alt: "Trivago", angle: 98 },
  { src: "/marketing/channels/hopper.svg", alt: "Hopper", angle: 143 },
  { src: "/marketing/channels/tripadvisor.svg", alt: "Tripadvisor", angle: 188 },
  { src: "/marketing/channels/makemytrip.svg", alt: "MakeMyTrip", angle: 233 },
  { src: "/marketing/channels/despegar.svg", alt: "Despegar", angle: 278 },
  { src: "/marketing/channels/webbeds.svg", alt: "WebBeds", angle: 323 },
];

// Ring-Radien in Prozent der Container-Kantenlänge.
const INNER_R = 27;
const OUTER_R = 43;

function position(angle: number, radius: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    left: `${50 + radius * Math.cos(rad)}%`,
    top: `${50 + radius * Math.sin(rad)}%`,
  };
}

// Einzelne Punkte auf den Bahnen (Winkel, Radius, Größe in SVG-Einheiten).
const DOTS = [
  { angle: 12, r: 43, size: 3 },
  { angle: 100, r: 27, size: 2.6 },
  { angle: 196, r: 43, size: 3 },
  { angle: 240, r: 27, size: 2.4 },
  { angle: 330, r: 49, size: 2 },
  { angle: 68, r: 49, size: 2.4 },
];

export function ChannelOrbit() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-xl">
      {/* Bahnen, Punkte und Schein */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full text-accent"
      >
        <defs>
          <radialGradient id="orbit-glow">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.05" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill="url(#orbit-glow)" />
        <circle
          cx="50"
          cy="50"
          r={INNER_R}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity="0.35"
        />
        <circle
          cx="50"
          cy="50"
          r={OUTER_R}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity="0.25"
        />
        <circle
          cx="50"
          cy="50"
          r="49"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.12"
        />
        {DOTS.map((dot) => {
          const rad = ((dot.angle - 90) * Math.PI) / 180;
          return (
            <circle
              key={`${dot.angle}-${dot.r}`}
              cx={50 + dot.r * Math.cos(rad)}
              cy={50 + dot.r * Math.sin(rad)}
              r={dot.size / 2}
              fill="currentColor"
              opacity="0.7"
            />
          );
        })}
      </svg>

      {/* Zentrum: myNextDays */}
      <div className="absolute left-1/2 top-1/2 flex size-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent shadow-soft sm:size-28">
        <span className="font-display text-4xl font-extrabold text-accent-foreground">
          m
        </span>
      </div>

      {/* Logo-Bubbles */}
      {[
        ...INNER.map((c) => ({ ...c, radius: INNER_R, size: "inner" as const })),
        ...OUTER.map((c) => ({ ...c, radius: OUTER_R, size: "outer" as const })),
      ].map((channel) => (
        <div
          key={channel.alt}
          style={position(channel.angle, channel.radius)}
          className={
            "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-card " +
            // Reichlich Innenabstand: die Logos sind teils breite Wortmarken,
            // teils quadratische Zeichen — ohne Puffer würden Letztere den
            // Kreis randlos ausfüllen.
            (channel.size === "inner"
              ? "size-16 p-3.5 sm:size-20 sm:p-5"
              : "size-14 p-3 sm:size-18 sm:p-4")
          }
        >
          {/* eager: das Orbit ist das tragende Bild der Sektion — mit
              Lazy-Loading blieben die Kreise beim Hereinscrollen kurz leer. */}
          <Image
            src={channel.src}
            alt={channel.alt}
            width={80}
            height={40}
            loading="eager"
            className="h-auto max-h-full w-full object-contain"
          />
        </div>
      ))}
    </div>
  );
}
