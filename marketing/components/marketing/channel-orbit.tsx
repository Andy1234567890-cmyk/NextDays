// Kanal-Orbit — die verbundenen Buchungsplattformen als kleines Sonnensystem
// um myNextDays.
//
// Referenz (hostaway.com, „300+ integrations"): Logo-Kreise auf konzentrischen
// Bahnen um ein farbiges Zentrum, dünne Bahnlinien mit einzelnen Punkten,
// dahinter ein weicher radialer Schein.
//
// Bewegung nach Keplers drittem Gesetz (T ∝ r^1.5): jeder Kanal hat einen
// EIGENEN Radius und daraus abgeleitet eine eigene Umlaufzeit. Zwei starre
// Ringe, auf denen alle im Gleichschritt wandern, sehen aus wie ein Karussell —
// erst unterschiedliche Umlaufzeiten lassen die Abstände driften, und genau das
// liest sich als „Planeten um die Sonne".
//
// Logos: ausschließlich echte Markenlogos aus public/marketing/channels.
// Kein Platzhalter-Icon für Kanäle ohne Logo — lieber weniger Planeten.
import Image from "next/image";

type Planet = {
  src: string;
  alt: string;
  /** Startwinkel in Grad, 0° = oben, im Uhrzeigersinn. */
  angle: number;
  /** Bahnradius in Prozent der Container-Kantenlänge. */
  radius: number;
  /** Große Blase für die bekanntesten Portale. */
  gross?: boolean;
};

// Radien bewusst leicht gestreut (nicht exakt auf den beiden Bahnlinien),
// damit die Planeten nicht wie aufgefädelt wirken. Startwinkel fest gewählt —
// nichts Zufälliges, sonst weichen Server- und Client-Render voneinander ab.
const PLANETEN: Planet[] = [
  { src: "/marketing/channels/airbnb.svg", alt: "Airbnb", angle: -40, radius: 26, gross: true },
  { src: "/marketing/channels/booking.svg", alt: "Booking.com", angle: 32, radius: 28, gross: true },
  { src: "/marketing/channels/google.svg", alt: "Google", angle: 104, radius: 26.5, gross: true },
  { src: "/marketing/channels/vrbo.svg", alt: "Vrbo", angle: 176, radius: 29, gross: true },
  { src: "/marketing/channels/expedia.svg", alt: "Expedia", angle: 248, radius: 27, gross: true },
  { src: "/marketing/channels/agoda.svg", alt: "Agoda", angle: 8, radius: 43 },
  { src: "/marketing/channels/tripcom.svg", alt: "Trip.com", angle: 53, radius: 41 },
  { src: "/marketing/channels/trivago.svg", alt: "Trivago", angle: 98, radius: 44.5 },
  { src: "/marketing/channels/hopper.svg", alt: "Hopper", angle: 143, radius: 42 },
  { src: "/marketing/channels/tripadvisor.svg", alt: "Tripadvisor", angle: 188, radius: 44 },
  { src: "/marketing/channels/makemytrip.svg", alt: "MakeMyTrip", angle: 233, radius: 41.5 },
  { src: "/marketing/channels/despegar.svg", alt: "Despegar", angle: 278, radius: 43.5 },
  { src: "/marketing/channels/webbeds.svg", alt: "WebBeds", angle: 323, radius: 42.5 },
];

// Bahnlinien (nur Zeichnung) — die Planeten streuen um diese beiden Zonen.
const BAHN_INNEN = 27;
const BAHN_AUSSEN = 43;

// Umlaufzeit aus dem Radius: T = FAKTOR · r^1.5. Der Faktor ist so gewählt,
// dass die innere Bahn rund 80 s braucht und die äußere gut zweieinhalb Minuten
// — langsam genug, um beim Lesen nicht abzulenken.
const KEPLER_FAKTOR = 0.57;

function umlaufzeit(radius: number): number {
  return Math.round(KEPLER_FAKTOR * radius ** 1.5);
}

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
          r={BAHN_INNEN}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity="0.3"
        />
        <circle
          cx="50"
          cy="50"
          r={BAHN_AUSSEN}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity="0.22"
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
        <g className="orbit-punkte" style={{ transformOrigin: "50px 50px" }}>
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
        </g>
      </svg>

      {/* Sonne: das echte Logo, freigestellt (transparente Ränder entfernt,
          siehe brand/mynextdays-logo-freigestellt.png). Weiße Scheibe statt
          roter Fläche, weil die Wortmarke schwarz ist und das „AirSmil" rot —
          auf rotem Grund verschwände genau dieser Teil der Marke. Der rote
          Ring hält den Kreis trotzdem als Zentrum des Systems erkennbar. */}
      <div className="absolute left-1/2 top-1/2 flex size-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-accent bg-card px-4 shadow-float-lg sm:size-36 sm:px-5">
        <Image
          src="/marketing/brand/mynextdays-logo-freigestellt.png"
          alt="myNextDays"
          width={1443}
          height={373}
          priority
          className="h-auto w-full"
        />
      </div>

      {/* Planeten: je eine eigene Bahn-Ebene mit eigener Umlaufzeit. */}
      {PLANETEN.map((planet) => {
        const dauer = `${umlaufzeit(planet.radius)}s`;
        return (
          <div
            key={planet.alt}
            className="orbit-bahn absolute inset-0"
            style={{ animationDuration: dauer }}
          >
            <div
              style={position(planet.angle, planet.radius)}
              className={
                "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-card " +
                // Reichlich Innenabstand: die Logos sind teils breite Wortmarken,
                // teils quadratische Zeichen — ohne Puffer würden Letztere den
                // Kreis randlos ausfüllen.
                (planet.gross
                  ? "size-16 p-3.5 sm:size-20 sm:p-5"
                  : "size-14 p-3 sm:size-18 sm:p-4")
              }
            >
              <span
                className="orbit-gegen flex size-full items-center justify-center"
                style={{ animationDuration: dauer }}
              >
                {/* eager: das Orbit ist das tragende Bild der Sektion — mit
                    Lazy-Loading blieben die Kreise beim Hereinscrollen leer. */}
                <Image
                  src={planet.src}
                  alt={planet.alt}
                  width={80}
                  height={40}
                  loading="eager"
                  className="h-auto max-h-full w-full object-contain"
                />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
