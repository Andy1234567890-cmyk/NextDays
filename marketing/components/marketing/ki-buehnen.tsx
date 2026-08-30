// Animierte Bühnen-Zeichnungen der KI-Seite (`/funktionen/ki-antworten`).
//
// WARUM ES SIE GIBT: Die Seite hatte an ihren beiden großen Flächen NICHTS —
// eine leere getönte Kachel, 64 px hoch, ohne ein einziges Kind im DOM (live
// gemessen am 30.08.2026). Grund war eine Kette aus zwei Halbheiten: es gibt
// keine Bildschirmaufnahme der KI-Seite (sie ist gebaut, aber nicht deployt),
// und der gedachte Rückfall auf die Gruppen-Zeichnung griff nicht, weil deren
// Registereintrag nur lokal existierte. Der Nutzer sah eine leere Fläche.
//
// WARUM EIGENE KOMPONENTEN STATT DER GRUPPEN-ZEICHNUNG:
// `GRUPPEN_ILLUSTRATION` liefert 96×96-Icons, die an fünf Stellen auch mit
// 28 px gerendert werden (Navigation, Preisrechner, Kachelgitter). Bewegung
// gehört an die große Bühne, nicht in eine Menüzeile — animierte 28-px-Icons
// flimmern und lenken vom Text ab. Deshalb zwei EIGENE Zeichnungen, die
// ausschließlich hier laufen; die Icons bleiben unangetastet.
//
// WARUM SMIL/CSS UND KEIN PAKET: Diese Bühnen sind Server Components ohne
// jedes JavaScript. Eine Animationsbibliothek wäre Client-Code plus Bundle für
// eine Bewegung, die das SVG selbst beherrscht. `prefers-reduced-motion` hält
// sie an — dann steht die Szene in ihrem Endzustand, es fehlt kein Inhalt
// (dieselbe Regel wie bei `wave-drift` und der KI-Szene der Startseite).
//
// Bildsprache wie `preis-illustrationen.tsx`: eigene Zeichnungen, Linien in
// `currentColor`, Deckkraft als Attribut (Tailwinds Arbitrary-Opacity
// kompiliert in v4 unzuverlässig).

type Props = { className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Ein Takt der Erzählung. Alle Zeiten teilen sich diese Länge, damit die
 *  Szene als EIN Ablauf liest und nicht als drei nebeneinander laufende
 *  Schleifen. */
const TAKT = 6;

/**
 * Hero: die Frage eines Gastes wird zur Antwort.
 *
 * Ablauf in einem Takt: die Frage kommt herein → drei Punkte tippen → die
 * Antwort erscheint. Genau die Reihenfolge, die der Fließtext daneben
 * beschreibt („die KI beantwortet sie aus deiner Gästemappe").
 */
export function KiBuehneAntwort({ className }: Props) {
  return (
    <svg
      viewBox="0 0 320 200"
      className={className}
      role="img"
      aria-label="Eine Gastfrage wird von der KI beantwortet"
    >
      {/* Frage des Gastes — kommt zuerst, außen gezeichnet (noch offen). */}
      <g opacity="0">
        <animate
          attributeName="opacity"
          values="0;1;1;1"
          keyTimes="0;0.12;0.9;1"
          dur={`${TAKT}s`}
          repeatCount="indefinite"
        />
        <path
          d="M20 40a12 12 0 0 1 12-12h116a12 12 0 0 1 12 12v34a12 12 0 0 1-12 12H56L36 106V86H32a12 12 0 0 1-12-12z"
          {...STROKE}
        />
        <path d="M40 50h84M40 64h52" {...STROKE} opacity="0.45" />
      </g>

      {/* Tippen: drei Punkte, versetzt hüpfend — die Zeit zwischen Frage und
          Antwort. Sie verschwinden, sobald die Antwort steht. */}
      <g opacity="0">
        <animate
          attributeName="opacity"
          values="0;0;1;1;0;0"
          keyTimes="0;0.16;0.22;0.42;0.48;1"
          dur={`${TAKT}s`}
          repeatCount="indefinite"
        />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={186 + i * 16} cy="96" r="5" fill="currentColor" opacity="0.55">
            <animate
              attributeName="cy"
              values="96;89;96;96"
              keyTimes="0;0.12;0.24;1"
              dur="1.1s"
              begin={`${i * 0.14}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>

      {/* Der Funke: die Umwandlung. Pulsiert genau in dem Moment, in dem aus
          der Frage die Antwort wird. */}
      <g>
        <path
          d="M168 22l5 11 11 5-11 5-5 11-5-11-11-5 11-5z"
          fill="currentColor"
          opacity="0.3"
        >
          <animate
            attributeName="opacity"
            values="0.3;0.3;1;0.3;0.3"
            keyTimes="0;0.2;0.3;0.45;1"
            dur={`${TAKT}s`}
            repeatCount="indefinite"
          />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 173 38;0 173 38;180 173 38;180 173 38"
            keyTimes="0;0.2;0.42;1"
            dur={`${TAKT}s`}
            repeatCount="indefinite"
          />
        </path>
      </g>

      {/* Antwort des Systems — gefüllt, weil sie das Ergebnis ist. Sie wächst
          aus dem Punkt heraus, an dem der Funke stand. */}
      <g opacity="0">
        <animate
          attributeName="opacity"
          values="0;0;1;1"
          keyTimes="0;0.46;0.56;1"
          dur={`${TAKT}s`}
          repeatCount="indefinite"
        />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 10;0 10;0 0;0 0"
          keyTimes="0;0.46;0.58;1"
          dur={`${TAKT}s`}
          repeatCount="indefinite"
        />
        <path
          d="M160 112a12 12 0 0 1 12-12h116a12 12 0 0 1 12 12v34a12 12 0 0 1-12 12h-12l12 20-32-20h-84a12 12 0 0 1-12-12z"
          fill="currentColor"
          opacity="0.9"
        />
        {/* Zeilen der Antwort: schreiben sich nacheinander. Der Trick ist die
            Breite — kein Textrendering, also keine Sprachabhängigkeit. */}
        {[
          { y: 122, w: 92, t: 0.58 },
          { y: 136, w: 74, t: 0.64 },
        ].map((z) => (
          <rect
            key={z.y}
            x="180"
            y={z.y}
            width="0"
            height="6"
            rx="3"
            fill="var(--color-card, #fff)"
            opacity="0.75"
          >
            <animate
              attributeName="width"
              values={`0;0;${z.w};${z.w}`}
              keyTimes={`0;${z.t};${z.t + 0.08};1`}
              dur={`${TAKT}s`}
              repeatCount="indefinite"
            />
          </rect>
        ))}
      </g>

      {/* Quelle: die Gästemappe, aus der die Antwort stammt. Sie leuchtet
          kurz auf, wenn die Antwort entsteht — die Aussage „erfindet nichts"
          bekommt damit ein Bild. */}
      <g opacity="0.35">
        <animate
          attributeName="opacity"
          values="0.35;0.35;0.9;0.35;0.35"
          keyTimes="0;0.42;0.52;0.68;1"
          dur={`${TAKT}s`}
          repeatCount="indefinite"
        />
        <rect x="24" y="128" width="52" height="46" rx="8" {...STROKE} />
        <path d="M36 142h28M36 152h20M36 162h24" {...STROKE} opacity="0.6" />
        {/* Verbindung zur Antwort — gestrichelt, die Striche wandern mit. */}
        <path
          d="M80 150h56"
          {...STROKE}
          strokeDasharray="4 6"
          opacity="0.7"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="20;0"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  );
}

/**
 * Beleg-Block: die Regeln je Thema.
 *
 * Drei Zeilen mit Schaltern, die nacheinander umlegen — das ist die Aussage
 * „Du bestimmst, was sie darf". Der dritte bleibt aus und trägt daneben den
 * Entwurfs-Stift: dieses Thema beantwortet die KI nicht selbst, sondern legt
 * einen Entwurf hin.
 */
export function KiBuehneRegeln({ className }: Props) {
  const zeilen = [
    { y: 46, breite: 74, an: true, ab: 0.1 },
    { y: 100, breite: 54, an: true, ab: 0.28 },
    { y: 154, breite: 88, an: false, ab: 0.46 },
  ];

  return (
    <svg
      viewBox="0 0 320 200"
      className={className}
      role="img"
      aria-label="Drei Themen mit Schaltern: zwei antworten selbst, eines legt einen Entwurf hin"
    >
      {zeilen.map((z) => (
        <g key={z.y}>
          <rect
            x="20"
            y={z.y - 22}
            width="280"
            height="44"
            rx="22"
            {...STROKE}
            opacity="0.3"
          />
          {/* Thema links */}
          <rect
            x="40"
            y={z.y - 4}
            width={z.breite}
            height="8"
            rx="4"
            fill="currentColor"
            opacity="0.5"
          />

          {/* Schalter rechts. Die Bahn bleibt, der Knopf wandert — und die
              Füllung wechselt zeitgleich, sonst sieht ein „an" wie ein
              halbfertiges „aus" aus. */}
          <rect
            x="232"
            y={z.y - 12}
            width="48"
            height="24"
            rx="12"
            fill="currentColor"
            opacity="0.18"
          >
            {z.an && (
              <animate
                attributeName="opacity"
                values="0.18;0.18;0.85;0.85"
                keyTimes={`0;${z.ab};${z.ab + 0.06};1`}
                dur={`${TAKT}s`}
                repeatCount="indefinite"
              />
            )}
          </rect>
          <circle
            cx="244"
            cy={z.y}
            r="8"
            fill="var(--color-card, #fff)"
            stroke="currentColor"
            strokeWidth="2"
          >
            {z.an && (
              <animate
                attributeName="cx"
                values={`244;244;268;268`}
                keyTimes={`0;${z.ab};${z.ab + 0.06};1`}
                dur={`${TAKT}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>

          {/* Häkchen bzw. Stift zwischen Thema und Schalter: WAS passiert,
              wenn der Schalter so steht. */}
          {z.an ? (
            <path
              d={`M196 ${z.y} l5 5 9-11`}
              {...STROKE}
              strokeWidth="3"
              opacity="0"
            >
              <animate
                attributeName="opacity"
                values={`0;0;1;1`}
                keyTimes={`0;${z.ab + 0.04};${z.ab + 0.1};1`}
                dur={`${TAKT}s`}
                repeatCount="indefinite"
              />
            </path>
          ) : (
            // Entwurfs-Stift: schreibt endlos einen kurzen Strich — der
            // Entwurf, der auf die Freigabe wartet.
            <g opacity="0.65">
              <path d={`M194 ${z.y + 4} l12 -12 5 5 -12 12z`} {...STROKE} strokeWidth="2" />
              <path d={`M190 ${z.y + 8} h22`} {...STROKE} strokeWidth="2" opacity="0.5">
                <animate
                  attributeName="stroke-dasharray"
                  values="0 22;22 0;22 0;0 22"
                  keyTimes="0;0.25;0.75;1"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
