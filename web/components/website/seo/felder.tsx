"use client";

// Die Eingabefelder des SEO-Bereichs (0430) — an einer Stelle, weil sie auf
// mehreren Unterseiten vorkommen (site-weit und je Seite).
//
// Der eigentliche Mehrwert steckt in der LÄNGENANZEIGE. Suchmaschinen
// schneiden einen Titel bei etwa 60 und eine Beschreibung bei etwa 160 Zeichen
// ab. Hostaway schreibt das als Satz in die Hilfe („Try to limit this to 60
// characters") — was bedeutet, dass man beim Tippen zählen muss. Hier steht
// die Zahl am Feld, und sie wird auffällig, sobald sie überschritten ist.
//
// Sie ist BEWUSST keine Sperre: eine deutsche Überschrift mit Komposita kommt
// mit 60 Zeichen oft nicht aus, und ein abgeschnittener Titel ist besser als
// ein unverständlicher. Die Empfehlung ist eine Empfehlung.
import type { ReactNode } from "react";

/** Empfohlene Höchstlänge eines Meta-Titels (Zeichen). */
const EMPFEHLUNG_TITEL = 60;
/** Empfohlene Höchstlänge einer Meta-Beschreibung (Zeichen). */
const EMPFEHLUNG_BESCHREIBUNG = 160;

export function empfehlungFuer(art: "titel" | "beschreibung"): number {
  return art === "titel" ? EMPFEHLUNG_TITEL : EMPFEHLUNG_BESCHREIBUNG;
}

/** Ein Textfeld mit Längenanzeige gegen die Suchmaschinen-Empfehlung.
 *
 *  `empfehlung` ist die Zeichenzahl, ab der abgeschnitten wird — nicht die
 *  technische Obergrenze. Die steht in `maxLength` und ist deutlich höher. */
export function SeoTextFeld({
  label,
  hinweis,
  wert,
  platzhalter,
  empfehlung,
  maxLength,
  mehrzeilig = false,
  rueckfall,
  rueckfallLabel,
  onWert,
}: {
  label: string;
  hinweis?: string;
  wert: string | null;
  platzhalter?: string;
  empfehlung?: number;
  maxLength: number;
  mehrzeilig?: boolean;
  /** Der Wert, der greift, wenn dieses Feld leer bleibt (site-weite Angabe).
   *
   *  Er wird ANGEZEIGT und nicht eingesetzt: stünde er im Feld, wüsste niemand,
   *  ob die Seite einen eigenen Wert hat oder den geerbten — und beim ersten
   *  Speichern wäre der geerbte Wert festgeschrieben. Genau so entstehen
   *  hundert Seiten mit derselben Beschreibung. */
  rueckfall?: string | null;
  rueckfallLabel?: string;
  onWert: (v: string | null) => void;
}) {
  const laenge = wert?.length ?? 0;
  const zuLang = Boolean(empfehlung && laenge > empfehlung);
  const gemeinsam = {
    value: wert ?? "",
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onWert(e.target.value || null),
    placeholder: platzhalter,
    maxLength,
    className:
      "w-full rounded-(--radius) border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground",
  };

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {hinweis ? (
        <span className="text-xs text-muted-foreground">{hinweis}</span>
      ) : null}
      {mehrzeilig ? (
        <textarea {...gemeinsam} rows={3} />
      ) : (
        <input type="text" {...gemeinsam} />
      )}
      <span className="flex items-baseline justify-between gap-2">
        {rueckfall && !wert && rueckfallLabel ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {rueckfallLabel}: {rueckfall}
          </span>
        ) : (
          <span />
        )}
        {empfehlung ? (
          <span
            className={
              "shrink-0 text-xs " +
              // Rot, nicht nur grau: die Zahl ist nur nützlich, wenn sie
              // auffällt, sobald sie zählt.
              (zuLang ? "font-semibold text-destructive" : "text-muted-foreground")
            }
          >
            {laenge}/{empfehlung}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** Ein Abschnitt mit Überschrift und Erklärung. */
export function SeoAbschnitt({
  titel,
  beschreibung,
  children,
}: {
  titel: string;
  beschreibung?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-base font-extrabold">{titel}</h2>
        {beschreibung ? (
          <p className="pt-1 text-sm text-muted-foreground">{beschreibung}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
