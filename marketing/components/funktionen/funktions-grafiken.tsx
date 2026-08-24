// Grafiken der Funktions-Unterseiten — gebaute Kompositionen, keine Screenshots.
//
// WARUM SIE EXISTIEREN (Referenz: hostaway.com/features/communication/,
// abgelesen 18.08.2026): Neben jedem Feature-Reiter steht dort keine
// abfotografierte Oberfläche, sondern eine gebaute Szene — Portal-Logos als
// schwebende Kacheln, Nachrichtenblasen, Karten mit Kennzahlen. Das hat einen
// Grund: ein echter Screenshot zeigt zwanzig Dinge gleichzeitig, die Szene
// zeigt genau eins. Für eine Seite, die EINE Funktion erklärt, ist das die
// bessere Grafik.
//
// Unsere Fassung nutzt dieselbe Machart, aber unsere Mittel: Karten im
// Systemstil (Radius, Schatten, Akzentrot), echte Portal-Logos aus
// `public/marketing/channels` und die Zeichnungen aus `preis-illustrationen`.
// Alles ist HTML/SVG — keine Bilddatei, die bei einer Farbänderung veraltet.
import { useLocale } from "next-intl";
import Image from "next/image";

import { GRUPPEN_ILLUSTRATION } from "@/components/preise/preis-illustrationen";
import { anzeigewaehrung } from "@/lib/anzeigewaehrung";
import { currencySymbol } from "@/lib/currency";

type Props = { titel: string; punkte: readonly string[] };

/** Kachel-Raster der verbundenen Portale (Referenz: Logo-Kacheln mit Farbtupfern). */
export function GrafikKanaele() {
  const logos = [
    { src: "/marketing/channels/mybestdays.png", alt: "myBestDays" },
    { src: "/marketing/channels/booking-com.svg", alt: "Booking.com" },
    { src: "/marketing/channels/airbnb.png", alt: "Airbnb" },
    { src: "/marketing/channels/expedia.svg", alt: "Expedia" },
    { src: "/marketing/channels/google.svg", alt: "Google" },
    { src: "/marketing/channels/agoda.svg", alt: "Agoda" },
  ];
  return (
    <div className="relative">
      {/* Farbtupfer im Hintergrund — bei der Referenz sind es Quadrate in den
          Markenfarben; hier zwei Töne aus unserer Palette, sehr blass. */}
      <span
        aria-hidden
        className="absolute -left-2 top-6 size-10 rounded-xl bg-surface-accent"
      />
      <span
        aria-hidden
        className="absolute -right-1 bottom-10 size-8 rounded-lg bg-accent/15"
      />
      <div className="relative grid grid-cols-3 gap-3 sm:gap-4">
        {logos.map((l, i) => (
          <span
            key={l.alt}
            className={`flex h-20 items-center justify-center rounded-2xl border border-border bg-card p-4 shadow-card ${
              i % 2 === 1 ? "translate-y-3" : ""
            }`}
          >
            <Image
              src={l.src}
              alt={l.alt}
              width={120}
              height={40}
              className="h-7 w-auto object-contain"
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Nachrichtenverlauf: zwei Blasen, eine Antwort in Akzentfarbe. */
export function GrafikNachrichten({ punkte }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-[80%] rounded-3xl rounded-bl-lg border border-border bg-card p-4 shadow-card">
        <p className="text-xs font-semibold text-muted-foreground">
          {punkte[0]}
        </p>
        <p className="mt-1 text-sm">{punkte[1]}</p>
      </div>
      <div className="ml-auto max-w-[80%] rounded-3xl rounded-br-lg bg-accent p-4 text-accent-foreground shadow-float">
        <p className="text-sm">{punkte[2]}</p>
      </div>
      <div className="max-w-[60%] rounded-3xl rounded-bl-lg border border-border bg-card px-4 py-3 shadow-card">
        <span className="flex gap-1">
          {[0, 1, 2].map((p) => (
            <span
              key={p}
              className="typing-dot size-2 rounded-full bg-muted-foreground"
              style={{ animationDelay: `${p * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

/** Checkliste mit abgehakten Punkten — für Aufgaben, Rollen, Einrichtung. */
export function GrafikCheckliste({ titel, punkte }: Props) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-float">
      <p className="font-display text-base font-semibold">{titel}</p>
      <ul className="mt-4 flex flex-col gap-3">
        {punkte.map((p, i) => (
          <li key={p} className="flex items-center gap-3">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                i < punkte.length - 1
                  ? "bg-accent text-accent-foreground"
                  : "border border-border"
              }`}
            >
              {i < punkte.length - 1 ? (
                <svg viewBox="0 0 24 24" aria-hidden className="size-3.5">
                  <path
                    d="m5 12 5 5 9-10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <span
              className={`text-sm ${i < punkte.length - 1 ? "text-muted-foreground line-through" : "font-medium"}`}
            >
              {p}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Balken mit Kennzahl — für Auslastung, Umsatz, Auswertungen. */
export function GrafikBalken({ titel, punkte }: Props) {
  // Feste Höhen: die Grafik illustriert, sie behauptet keine echten Werte.
  const hoehen = [38, 62, 48, 82, 70, 95];
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-float">
      <p className="font-display text-base font-semibold">{titel}</p>
      <div className="mt-6 flex h-40 items-end gap-3">
        {hoehen.map((h, i) => (
          <span
            key={h}
            className={`flex-1 rounded-t-xl ${i === hoehen.length - 1 ? "bg-accent" : "bg-surface-accent"}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {punkte.map((p) => (
          <span
            key={p}
            className="rounded-full bg-surface-warm px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Preiskarte mit Min-/Max-Korridor — für dynamische Preise. */
export function GrafikPreise({ titel, punkte }: Props) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-float">
      <p className="font-display text-base font-semibold">{titel}</p>
      <svg viewBox="0 0 320 140" className="mt-5 w-full text-accent" aria-hidden>
        {/* Korridor zwischen Minimum und Maximum */}
        <path
          d="M10 30 C 80 20, 140 46, 200 34 S 290 22, 310 30 L310 104 C 290 96, 250 112, 200 104 S 80 118, 10 106 Z"
          fill="currentColor"
          opacity="0.08"
        />
        <path
          d="M10 68 C 70 40, 110 96, 170 74 S 250 44, 310 60"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {[
          [70, 55],
          [170, 74],
          [250, 52],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="5" fill="currentColor" />
        ))}
      </svg>
      <div className="mt-4 flex flex-wrap gap-2">
        {punkte.map((p) => (
          <span
            key={p}
            className="rounded-full bg-surface-accent px-3 py-1 text-xs font-medium"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Beispiel-Auszahlung in der Grafik. Dekorativ, kein beworbener Betrag. */
const BEISPIEL_AUSZAHLUNG = 1240;

/** Zahlungs-Karte mit Statuszeilen. */
export function GrafikZahlung({ titel, punkte }: Props) {
  const locale = useLocale();
  // Das Zeichen war hier als „€" hartkodiert und stand damit auch vor einem
  // dänischen oder polnischen Leser (Wurzel 4: nie ein € hardcoden). Die Karte
  // stellt die Oberfläche dar, und die zeigt die Währung des Betriebs —
  // deshalb dasselbe Zeichen und dieselbe Zahlenschreibweise wie der Rest der
  // Seite. Der BETRAG bleibt ein Beispiel: er kommt aus keiner Preisliste und
  // wäre aus keiner ableitbar; er behauptet keinen Preis, sondern zeigt, wie
  // eine Auszahlung in der Software aussieht.
  const zeichen = currencySymbol(anzeigewaehrung(locale), locale);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-float">
        <p className="text-xs uppercase tracking-widest text-primary-foreground/60">
          {titel}
        </p>
        <p className="mt-3 font-display text-3xl font-extrabold tabular-nums">
          {zeichen}&nbsp;
          {new Intl.NumberFormat(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(BEISPIEL_AUSZAHLUNG)}
        </p>
        <div className="mt-5 flex gap-2">
          <span className="h-1.5 flex-1 rounded-full bg-accent" />
          <span className="h-1.5 flex-1 rounded-full bg-accent" />
          <span className="h-1.5 flex-1 rounded-full bg-primary-foreground/25" />
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {punkte.map((p, i) => (
          <li
            key={p}
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-card"
          >
            <span>{p}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                i === punkte.length - 1
                  ? "bg-surface-warm text-muted-foreground"
                  : "bg-accent/12 text-accent"
              }`}
            >
              {i === punkte.length - 1 ? "•••" : "✓"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kalenderraster mit Buchungsbalken — für Belegung und Objekte. */
export function GrafikBelegung({ titel, punkte }: Props) {
  const zeilen = [
    { start: 0, span: 3, ton: "bg-accent" },
    { start: 3, span: 2, ton: "bg-surface-accent" },
    { start: 1, span: 4, ton: "bg-primary" },
    { start: 4, span: 2, ton: "bg-accent/60" },
  ];
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-float">
      <p className="font-display text-base font-semibold">{titel}</p>
      <div className="mt-5 flex flex-col gap-2.5">
        {zeilen.map((z, i) => (
          <div key={i} className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: 6 }, (_, s) => (
              <span
                key={s}
                className={`h-7 rounded-lg ${
                  s >= z.start && s < z.start + z.span
                    ? `${z.ton} ${z.ton === "bg-surface-accent" ? "" : "shadow-card"}`
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {punkte.map((p) => (
          <span
            key={p}
            className="rounded-full bg-surface-warm px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Rückfallgrafik: die Zeichnung der Funktionsgruppe, groß auf getönter Fläche. */
/** Zeichnung der Funktionsgruppe mit den drei Stichpunkten als Karten.
 *
 *  Vorher war das eine 4:3-Fläche mit EINEM kleinen Symbol darin — im
 *  Reiter-Panel, das selbst schon eine getönte Fläche ist, ergab das zwei
 *  ineinander liegende rosa Kästen mit einem Icon in der Mitte und sonst
 *  nichts („hier ist kein Bild", 19.08.2026). Die Zeichnung ist jetzt der
 *  Kopf einer Karte, die auch die drei Punkte des Reiters trägt — dieselben
 *  Mittel wie die übrigen Grafiken hier, nur ohne erfundene Oberfläche für
 *  Funktionen, von denen es keine Aufnahme gibt. */
export function GrafikZeichnung({
  gruppe,
  titel,
  punkte,
}: Props & { gruppe: string }) {
  const Illustration = GRUPPEN_ILLUSTRATION[gruppe];
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-float">
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-surface-accent text-accent">
          {Illustration ? <Illustration className="size-9" /> : null}
        </span>
        <p className="font-display text-base font-semibold">{titel}</p>
      </div>
      <ul className="mt-5 flex flex-col gap-2.5">
        {punkte.map((p) => (
          <li
            key={p}
            className="flex items-center gap-3 rounded-2xl bg-surface-warm px-4 py-3"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <svg viewBox="0 0 24 24" aria-hidden className="size-3.5">
                <path
                  d="m5 12 5 5 9-10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-sm font-medium">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
