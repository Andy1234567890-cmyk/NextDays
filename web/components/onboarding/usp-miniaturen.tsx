"use client";

// Miniaturen für die USP-Karten — Ausschnitte des ECHTEN Produkts, nachgebaut.
//
// WARUM NACHGEBAUT UND NICHT ILLUSTRIERT: hier standen zuerst frei erfundene
// Formen — Raster aus gleich großen Rechtecken, Balkendiagramme, drei Striche
// als „Nachricht". Sie sahen aus wie das Piktogramm einer beliebigen Software.
// Das Produkt hat aber eine eigene Formensprache, und die ist wiedererkennbar:
//
//   * Belegung  → vollständig RUNDE Pillen (`rounded-full`) in der Farbe des
//                 KANALS, halb so hoch wie die Zeile, um einen halben Tag
//                 versetzt beginnend und endend (zwei Buchungen teilen sich den
//                 Wechseltag). Nicht: eingefärbte Einzelzellen.
//   * Preise    → flache Zellen mit senkrechter Trennlinie, Zahlen rechtsbündig
//                 in `tabular-nums`; ein abweichender Preis ist rot hinterlegt
//                 (`bg-accent/10 text-accent`), nicht ein höherer Balken.
//   * Posteingang → Kreis-Avatar mit rotem Ungelesen-Punkt oben rechts, vier
//                 gestapelte Textzeilen, aktive Zeile mit 2 px rotem Balken
//                 links und blassrotem Grund.
//
// Wer diese drei Miniaturen sieht und später das Dashboard öffnet, erkennt es
// wieder. Das war bei den erfundenen Formen nicht so.
//
// Belege im Code: `components/kalender/calendar-board.tsx` (Geometrie COL 5.5rem
// / ROW_H 3.5rem / Balkenhöhe 1.75rem, `rounded-full`), `lib/calendar-channels.ts`
// + `globals.css` (Kanalfarben), `components/kalender/views/rates-view.tsx`
// (Preiszelle, Override-Farbe), `components/inbox/inbox-list.tsx` (Zeilenaufbau).
//
// WARUM TOKEN UND NICHT HEX, WO ES GEHT: die Miniaturen liegen auf einem
// dunklen Glasträger über dem Foto und müssen dort in beiden Modi tragen. Die
// Kanalfarben sind dagegen MARKENFARBEN — sie stehen als Hex, weil Airbnb-Rot
// im Dunkelmodus nicht ein anderes Rot wird.

/** Kanalfarben — die BESTEHENDEN aus `globals.css` (`--channel-*`), nicht neu
 *  eingetippt. Genau dieselben Werte faerben die Balken im Belegungskalender;
 *  eine zweite Liste hier waere die dritte Stelle mit demselben Airbnb-Rot
 *  gewesen und irgendwann eine andere Farbe (Wurzel 4).
 *
 *  Marken folgen keinem Hell-/Dunkel-Modus — die Variablen sind deshalb in
 *  beiden Modi gleich definiert, und das ist Absicht. */
const KANAL = {
  airbnb: "var(--channel-airbnb)",
  booking: "var(--channel-booking)",
  vrbo: "var(--channel-vrbo)",
  portal: "var(--channel-portal)",
} as const;

/** Unsere eigene Akzentfarbe — ebenfalls aus dem Token, nicht als Hex. */
const AKZENT = "var(--accent)";

/* ------------------------------------------------------------------ */

/** Belegungskalender: drei Objektzeilen, Buchungspillen in Kanalfarbe.
 *
 *  Das Seitenverhältnis Spalte:Zeile ist das des Boards (5.5 rem : 3.5 rem),
 *  die Pille ist halb so hoch wie die Zeile und startet/endet auf halber
 *  Spalte — genau wie dort. */
export function MiniKalender() {
  // Zeile, Startspalte (halbe erlaubt), Länge in Spalten, Farbe.
  const buchungen = [
    { zeile: 0, von: 0.5, len: 2, farbe: KANAL.airbnb },
    { zeile: 0, von: 3.5, len: 2.5, farbe: KANAL.booking },
    { zeile: 1, von: 1.5, len: 3, farbe: KANAL.vrbo },
    { zeile: 2, von: 0.5, len: 1.5, farbe: KANAL.portal },
    { zeile: 2, von: 3, len: 3, farbe: KANAL.airbnb },
  ];
  const SP = 13.2; // Spaltenbreite
  const ZH = 8.4; // Zeilenhöhe
  const KOPF = 9;

  return (
    <svg viewBox="0 0 96 36" className="h-full w-full" aria-hidden>
      {/* Kopf: Tagesspalten. Der laufende Tag trägt im Board einen roten
          Kreis — das ist die auffälligste Marke des Kalenders. */}
      {Array.from({ length: 7 }, (_, i) => (
        <g key={`k${i}`}>
          {i === 2 ? (
            <circle cx={5 + i * SP} cy={4.5} r={3.4} fill={AKZENT} />
          ) : null}
          <rect
            x={2.6 + i * SP}
            y={3.4}
            width={4.8}
            height={2.2}
            rx={1.1}
            fill={i === 2 ? "white" : "currentColor"}
            opacity={i === 2 ? 0.95 : 0.4}
          />
        </g>
      ))}

      {/* Senkrechte Tagestrennung — im Board `border-r` je Spalte. */}
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={`t${i}`}
          x1={11.6 + i * SP}
          y1={KOPF}
          x2={11.6 + i * SP}
          y2={36}
          stroke="currentColor"
          strokeOpacity={0.12}
        />
      ))}
      {/* Waagerechte Zeilentrennung. */}
      {[0, 1, 2].map((z) => (
        <line
          key={`z${z}`}
          x1={0}
          y1={KOPF + z * ZH}
          x2={96}
          y2={KOPF + z * ZH}
          stroke="currentColor"
          strokeOpacity={0.12}
        />
      ))}

      {/* Die Buchungen: runde Pillen, vertikal in der Zeile zentriert. */}
      {buchungen.map((b, i) => (
        <rect
          key={i}
          x={b.von * SP + 0.7}
          y={KOPF + b.zeile * ZH + (ZH - 4.2) / 2}
          width={b.len * SP - 1.4}
          height={4.2}
          rx={2.1}
          fill={b.farbe}
        />
      ))}
    </svg>
  );
}

/** Preisraster: flache Zellen, Zahlen, ein hervorgehobener Abweichler.
 *
 *  Zahlen ohne Währungszeichen — die Währung kommt im Produkt aus den Daten
 *  (27 EU-Länder), und ein „€" hier wäre genau der Hardcode, den Wurzel 4
 *  verbietet. Die Miniatur zeigt deshalb die FORM des Rasters, nicht Beträge. */
export function MiniPreise() {
  // Fünf statt sieben Spalten: bei sieben ist eine Zelle 13 Einheiten breit,
  // und der Betrag darin wird zum Punkt. Das Raster bleibt erkennbar, die
  // Zahlen werden lesbar.
  const SP = 19.2;
  const werte = ["120", "120", "145", "120", "180"];
  const abweichend = new Set([2, 4]);

  return (
    <svg viewBox="0 0 96 36" className="h-full w-full" aria-hidden>
      {/* Verfügbarkeitszeile: im Rate-Grid steht über den Preisen je Tag ein
          Punkt (grün frei, rot gebucht). */}
      {werte.map((_, i) => (
        <circle
          key={`p${i}`}
          cx={SP / 2 + i * SP}
          cy={4}
          r={1.7}
          fill={i === 3 ? AKZENT : "#16a34a"}
        />
      ))}

      <line x1={0} y1={9} x2={96} y2={9} stroke="currentColor" strokeOpacity={0.14} />

      {/* Preiszellen. Der Abweichler ist rot HINTERLEGT und der Betrag rot —
          so markiert das Grid einen manuell gesetzten Preis. */}
      {werte.map((w, i) => (
        <g key={i}>
          {abweichend.has(i) ? (
            <rect x={i * SP} y={9} width={SP} height={27} fill={AKZENT} opacity={0.1} />
          ) : null}
          {i > 0 ? (
            <line
              x1={i * SP}
              y1={9}
              x2={i * SP}
              y2={36}
              stroke="currentColor"
              strokeOpacity={0.14}
            />
          ) : null}
          {/* Echte Ziffern statt Balken: bei 19 Einheiten Spaltenbreite trägt
              9-px-Text, und eine Preistabelle ohne Zahlen ist keine. Ohne
              Währungszeichen — die Währung kommt im Produkt aus den Daten
              (27 EU-Länder), ein „€" hier wäre der Hardcode aus Wurzel 4. */}
          <text
            x={SP / 2 + i * SP}
            y={25.5}
            textAnchor="middle"
            fontSize={9}
            fontWeight={abweichend.has(i) ? 700 : 500}
            fill={abweichend.has(i) ? AKZENT : "currentColor"}
            opacity={abweichend.has(i) ? 1 : 0.6}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {w}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Posteingang: drei Zeilen, die oberste aktiv und ungelesen.
 *
 *  Die Signatur der echten Liste: Kreis-Avatar, roter Punkt oben rechts am
 *  Avatar (nicht daneben), 2 px roter Balken am linken Rand der aktiven Zeile,
 *  und unten eine Meta-Zeile, in der das Portal-Logo steht. */
export function MiniPosteingang() {
  const ZH = 12;
  return (
    <svg viewBox="0 0 96 36" className="h-full w-full" aria-hidden>
      {[0, 1, 2].map((i) => {
        const y = i * ZH;
        const aktiv = i === 0;
        return (
          <g key={i}>
            {aktiv ? (
              <>
                <rect x={0} y={y} width={96} height={ZH} fill={AKZENT} opacity={0.07} />
                <rect x={0} y={y} width={1.6} height={ZH} fill={AKZENT} />
              </>
            ) : null}
            <line
              x1={0}
              y1={y + ZH}
              x2={96}
              y2={y + ZH}
              stroke="currentColor"
              strokeOpacity={0.12}
            />

            {/* Avatar mit Ungelesen-Punkt oben rechts. */}
            <circle cx={9} cy={y + 6} r={4.2} fill="currentColor" opacity={0.22} />
            {aktiv ? (
              <circle cx={12} cy={y + 3} r={1.7} fill={AKZENT} stroke="white" strokeWidth={0.7} />
            ) : null}

            {/* Name (fett, wenn ungelesen) + Zeitstempel rechts. */}
            <rect
              x={16.5}
              y={y + 2.6}
              width={aktiv ? 30 : 24}
              height={2.6}
              rx={1.3}
              fill="currentColor"
              opacity={aktiv ? 0.75 : 0.45}
            />
            <rect
              x={84}
              y={y + 2.8}
              width={9}
              height={2.2}
              rx={1.1}
              fill="currentColor"
              opacity={0.25}
            />

            {/* Vorschauzeile. */}
            <rect
              x={16.5}
              y={y + 6.6}
              width={aktiv ? 62 : 48}
              height={2.2}
              rx={1.1}
              fill="currentColor"
              opacity={aktiv ? 0.4 : 0.22}
            />

            {/* Meta-Zeile: Kanalfarbe als kurzer Strich (im Produkt steht dort
                das echte Portal-Logo) + Zeitraum. */}
            <rect
              x={16.5}
              y={y + 10}
              width={7}
              height={1.8}
              rx={0.9}
              fill={[KANAL.airbnb, KANAL.booking, KANAL.vrbo][i]}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Import: Portal-Inserate werden zu Objekten. Zwei Stapel, ein Pfeil.
 *
 *  Links unfertige Umrisse (das Inserat beim Portal), rechts die fertige
 *  Objektzeile mit Vorschaubild und zwei Textzeilen — die Form der echten
 *  Objektliste. */
export function MiniImport() {
  return (
    <svg viewBox="0 0 96 36" className="h-full w-full" aria-hidden>
      {[0, 1, 2].map((i) => (
        <rect
          key={`q${i}`}
          x={1}
          y={2 + i * 11}
          width={24}
          height={9}
          rx={2.5}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeDasharray="2.5 2"
        />
      ))}

      <path
        d="M31 18 h9 m-3.5 -3.5 l3.5 3.5 l-3.5 3.5"
        stroke={AKZENT}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {[0, 1, 2].map((i) => (
        <g key={`z${i}`}>
          <rect
            x={47}
            y={2 + i * 11}
            width={48}
            height={9}
            rx={2.5}
            fill="currentColor"
            opacity={0.1}
          />
          {/* Vorschaubild der Objektzeile. */}
          <rect
            x={49}
            y={4 + i * 11}
            width={5}
            height={5}
            rx={1.4}
            fill={AKZENT}
            opacity={0.85}
          />
          <rect
            x={56.5}
            y={4.4 + i * 11}
            width={22 - i * 3}
            height={2}
            rx={1}
            fill="currentColor"
            opacity={0.5}
          />
          <rect
            x={56.5}
            y={7.4 + i * 11}
            width={14}
            height={1.6}
            rx={0.8}
            fill="currentColor"
            opacity={0.25}
          />
        </g>
      ))}
    </svg>
  );
}

/** Sperre: ein Tag zu — und dieselbe Sperre steht auf allen Kanälen.
 *
 *  Die schwarze Fläche ist die echte Sperrfarbe des Kalenders
 *  (`bg-foreground text-background`), nicht ein rotes Verbotszeichen. */
export function MiniSperre() {
  // Alle Zeilen teilen dieselbe Zeitachse: sie beginnt hinter dem Kanalpunkt
  // und ist in sechs Tage geteilt. Nur wenn der gesperrte Block in JEDER Zeile
  // an derselben x-Position steht, sagt das Bild „überall dieselbe Sperre" —
  // eine verschobene Zeile macht daraus vier unabhängige Balken.
  const ACHSE = 13;
  const TAG = (96 - ACHSE - 2) / 6;
  const SPERRE_VON = 2;
  const SPERRE_BIS = 4;
  const x1 = ACHSE + SPERRE_VON * TAG;
  const breite = (SPERRE_BIS - SPERRE_VON) * TAG;

  return (
    <svg viewBox="0 0 96 36" className="h-full w-full" aria-hidden>
      {/* Kopfzeile: der Kalender. Tagesraster + der massiv schwarze Block, mit
          dem das Board eine Sperre zeichnet (`bg-foreground`). */}
      {Array.from({ length: 7 }, (_, i) => (
        <line
          key={i}
          x1={ACHSE + i * TAG}
          y1={1}
          x2={ACHSE + i * TAG}
          y2={12}
          stroke="currentColor"
          strokeOpacity={0.14}
        />
      ))}
      <rect
        x={x1 + 0.6}
        y={3.5}
        width={breite - 1.2}
        height={6}
        rx={3}
        fill="currentColor"
        opacity={0.85}
      />
      <line x1={0} y1={13.5} x2={96} y2={13.5} stroke="currentColor" strokeOpacity={0.14} />

      {/* Darunter dieselbe Achse je Kanal: vorne der Markenpunkt, dahinter die
          freie Strecke — und an EXAKT derselben Stelle derselbe schwarze Block. */}
      {[KANAL.airbnb, KANAL.booking, KANAL.vrbo].map((farbe, i) => {
        const y = 18.5 + i * 6.5;
        return (
          <g key={i}>
            <circle cx={5} cy={y} r={2.6} fill={farbe} />
            <rect
              x={ACHSE}
              y={y - 1.4}
              width={96 - ACHSE - 2}
              height={2.8}
              rx={1.4}
              fill="currentColor"
              opacity={0.12}
            />
            <rect
              x={x1 + 0.6}
              y={y - 1.4}
              width={breite - 1.2}
              height={2.8}
              rx={1.4}
              fill="currentColor"
              opacity={0.85}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Auszahlung: Buchungen laufen zu einer Auszahlung zusammen.
 *
 *  Die Beträge bleiben abstrakt (keine Währung, Wurzel 4); erkennbar ist die
 *  Form der Abrechnungszeile: Kanalpunkt, Bezeichnung, Betrag rechtsbündig. */
export function MiniAuszahlung() {
  return (
    <svg viewBox="0 0 96 36" className="h-full w-full" aria-hidden>
      {[KANAL.airbnb, KANAL.booking, KANAL.vrbo].map((farbe, i) => (
        <g key={i}>
          <circle cx={4} cy={4.5 + i * 8} r={2.2} fill={farbe} />
          <rect
            x={9}
            y={3.2 + i * 8}
            width={20 - i * 2}
            height={2.4}
            rx={1.2}
            fill="currentColor"
            opacity={0.35}
          />
          <rect
            x={38}
            y={3.2 + i * 8}
            width={10}
            height={2.4}
            rx={1.2}
            fill="currentColor"
            opacity={0.5}
          />
        </g>
      ))}

      {/* Summenlinie und Auszahlung — im Produkt die hervorgehobene Zeile
          am Fuß der Abrechnung. */}
      <line
        x1={0}
        y1={26}
        x2={52}
        y2={26}
        stroke="currentColor"
        strokeOpacity={0.25}
      />
      <rect x={9} y={30} width={16} height={2.6} rx={1.3} fill="currentColor" opacity={0.5} />
      <rect x={36} y={30} width={14} height={2.6} rx={1.3} fill="currentColor" opacity={0.75} />

      <path
        d="M58 18 h8 m-3 -3 l3 3 l-3 3"
        stroke="currentColor"
        strokeOpacity={0.4}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Die Auszahlung selbst: rote Karte, wie der Akzent im Produkt. */}
      <rect x={70} y={9} width={25} height={18} rx={3} fill={AKZENT} />
      <rect x={74} y={14} width={17} height={2.6} rx={1.3} fill="white" opacity={0.95} />
      <rect x={74} y={19} width={10} height={2.2} rx={1.1} fill="white" opacity={0.6} />
    </svg>
  );
}
