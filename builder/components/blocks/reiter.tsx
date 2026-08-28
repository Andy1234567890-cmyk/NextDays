"use client";

// Reiter-Abschnitt (0450).
//
// Warum als CLIENT-Komponente, obwohl fast alles hier serverseitig läuft: das
// Umschalten zwischen Reitern ist ein Zustand im Browser. Die reine
// CSS-Variante (versteckte Radio-Inputs plus `:checked ~`) käme ohne
// JavaScript aus, verliert aber die Rollen `tablist`/`tab`/`tabpanel` und
// damit die Pfeiltasten-Bedienung — ein Screenreader-Nutzer bekäme eine
// Radiogruppe angesagt, wo Reiter stehen.
//
// Auf schmalen Geräten wird DIESELBE Datenmenge als Accordion gerendert, nicht
// als wischbare Reiterleiste. Hostaway bietet beides zur Wahl an und schreibt
// selbst dazu, dass „nicht alle mobilen Browser Wischen unterstützen" — eine
// Einstellung, deren eine Hälfte auf einem Teil der Geräte nicht funktioniert,
// ist keine Wahl, sondern eine Falle. Der Umschaltpunkt liegt im CSS
// (`md:`), damit kein Layout-Sprung nach der Hydration entsteht.
import { useId, useState } from "react";

import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { sanitizeHtml } from "@/lib/sanitize";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";
import { BildNachweis } from "./bildnachweis";

type ReiterEintrag = {
  label?: unknown;
  title?: unknown;
  text?: unknown;
  image_url?: unknown;
};

type Aufbereitet = {
  label: string;
  titel: string;
  html: string;
  bild: string | null;
};

/** Der Inhalt EINES Reiters — einmal für die Reiter-Ansicht, einmal für das
 *  Accordion darunter. Als eigene Komponente, damit beide Ansichten garantiert
 *  dasselbe zeigen. */
function ReiterInhalt({ eintrag }: { eintrag: Aufbereitet }) {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
      <div className="min-w-0">
        {eintrag.titel ? (
          <h3 className="font-display text-2xl font-semibold tracking-tight">
            {eintrag.titel}
          </h3>
        ) : null}
        {eintrag.html ? (
          <div
            className="pt-3 text-base leading-relaxed text-foreground/80 [&_a]:text-primary [&_a]:underline [&_p]:mt-3"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: eintrag.html }}
          />
        ) : null}
      </div>
      {eintrag.bild ? (
        // Die Breitenbegrenzung sitzt jetzt an der Huelle statt am Bild, damit
        // der Pflicht-Nachweis darunter dieselbe Breite hat. Ohne Nachweis
        // rendert er nichts — das Bild sieht dann aus wie zuvor.
        <div className="md:max-w-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={eintrag.bild}
            alt=""
            loading="lazy"
            className="w-full rounded-2xl object-cover"
          />
          <BildNachweis src={eintrag.bild} variante="zeile" />
        </div>
      ) : null}
    </div>
  );
}

export function ReiterBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  // `useId` steht VOR jedem frühen Return: ein Hook hinter einer Bedingung ist
  // der Fehler, den ESLint hier zu Recht meldet (rules-of-hooks).
  const basisId = useId();
  const [aktiv, setAktiv] = useState(0);

  const headline = pickText(content.headline, modus.locale);
  const roh = Array.isArray(content.items)
    ? (content.items as ReiterEintrag[])
    : [];
  const items: Aufbereitet[] = roh
    .map((e) => ({
      label: pickText(e.label, modus.locale).trim(),
      titel: pickText(e.title, modus.locale).trim(),
      html: sanitizeHtml(pickText(e.text, modus.locale)),
      bild: typeof e.image_url === "string" ? e.image_url : null,
    }))
    // Ohne Beschriftung gibt es keinen Reiter, auf den man klicken könnte.
    .filter((e) => e.label);

  if (items.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerReiter}
      />
    );
  }

  // Der gewählte Reiter kann außerhalb liegen, wenn der Kunde im Editor den
  // letzten löscht. Zurechtrücken statt leerer Fläche.
  const gewaehlt = Math.min(aktiv, items.length - 1);

  /** Pfeiltasten in der Reiterleiste — ARIA verlangt es, und ohne sie ist die
   *  Leiste mit der Tastatur nur über Tab-Sprünge erreichbar. */
  function taste(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowRight") {
      setAktiv((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowLeft") {
      setAktiv((i) => (i - 1 + items.length) % items.length);
    } else {
      return;
    }
    e.preventDefault();
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      {headline ? (
        <h2 className="pb-6 font-display text-3xl font-extrabold tracking-tight">
          {headline}
        </h2>
      ) : null}

      {/* --- Reiter (ab md) ------------------------------------------------ */}
      <div className="hidden md:block">
        <div
          role="tablist"
          aria-label={headline || texte(modus.locale).reiterNavigation}
          className="flex flex-wrap gap-1 border-b border-border"
        >
          {items.map((e, i) => (
            <button
              key={`${e.label}-${i}`}
              type="button"
              role="tab"
              id={`${basisId}-t-${i}`}
              aria-selected={i === gewaehlt}
              aria-controls={`${basisId}-p-${i}`}
              // Nur der aktive Reiter ist per Tab erreichbar; innerhalb der
              // Leiste bewegt man sich mit den Pfeiltasten (ARIA-Muster).
              tabIndex={i === gewaehlt ? 0 : -1}
              onClick={() => setAktiv(i)}
              onKeyDown={taste}
              className={
                "-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition " +
                (i === gewaehlt
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {e.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`${basisId}-p-${gewaehlt}`}
          aria-labelledby={`${basisId}-t-${gewaehlt}`}
          className="pt-8"
        >
          <ReiterInhalt eintrag={items[gewaehlt]!} />
        </div>
      </div>

      {/* --- Accordion (bis md) -------------------------------------------- */}
      <div className="divide-y divide-border border-y border-border md:hidden">
        {items.map((e, i) => (
          <details
            key={`${e.label}-m-${i}`}
            name={`${basisId}-m`}
            open={i === 0}
            className="group py-4"
          >
            <summary className="cursor-pointer list-none text-lg font-semibold">
              {e.label}
            </summary>
            <div className="pt-3">
              <ReiterInhalt eintrag={e} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
