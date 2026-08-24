"use client";

// Formular-Abschnitt einer Kunden-Website (0436).
//
// Client-Komponente, weil sie absendet — der einzige Abschnitt, der etwas
// zurückschickt. Alles andere im Renderer ist Server-Component.
//
// Was hier bewusst NICHT passiert:
//
//   · Keine eigene Feldprüfung als KONTROLLE. Die Browser-Prüfung (`required`,
//     `type="email"`) ist eine Bequemlichkeit für den Gast; die Kontrolle sitzt
//     am Endpunkt, weil ein POST sie umgeht.
//   · Kein Zurücksetzen des Formulars nach Fehler. Wer fünf Felder gefüllt hat
//     und einen Serverfehler bekommt, soll sie nicht neu tippen.
//   · Keine Erfolgsmeldung, die der Betrieb nicht geschrieben hat. Fehlt sein
//     Text, steht ein neutraler Satz da (Wurzel 4) — kein „Vielen Dank, wir
//     melden uns in Kürze!", das nicht stimmen muss.
import { useState } from "react";

import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import type { SiteBranding } from "@/lib/site-context";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

type Feld = {
  name?: unknown;
  type?: unknown;
  label?: unknown;
  placeholder?: unknown;
  required?: unknown;
  options?: unknown;
};

/** Feldarten, die der Renderer kennt. Muss mit `FormFieldType` im Backend
 *  deckungsgleich sein — ein unbekannter Typ wird als einzeiliges Textfeld
 *  gerendert und NICHT weggelassen: der Gast soll das Feld ausfüllen können,
 *  auch wenn wir seine Sonderdarstellung nicht kennen. */
const EINZEILIG = new Set(["text", "email", "phone", "number", "date"]);

/** HTML-Eingabetyp zur Feldart. `phone` → `tel`, damit ein Telefon die
 *  Zifferntastatur zeigt; `number` bleibt `number`. */
function htmlTyp(art: string): string {
  if (art === "email") return "email";
  if (art === "phone") return "tel";
  if (art === "number") return "number";
  if (art === "date") return "date";
  return "text";
}

export function FormularBlock({
  content,
  modus = NICHT_EDITIERBAR,
  branding,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  /** Für den Datenschutz-Link am Zustimmungsfeld. */
  branding?: SiteBranding | null;
}) {
  const t = texte(modus.locale);
  const headline = pickText(content.headline, modus.locale);
  const intro = pickText(content.intro, modus.locale);
  const felder = (Array.isArray(content.fields) ? content.fields : []) as Feld[];
  const [stand, setStand] = useState<"ruht" | "sendet" | "fertig" | "fehler">(
    "ruht",
  );
  const [meldung, setMeldung] = useState<string | null>(null);

  if (felder.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerFormular}
      />
    );
  }

  // Im ENTWURF wird nicht abgesendet: der Betrieb würde beim Ausprobieren
  // Einsendungen in seiner eigenen Antwortenliste erzeugen.
  const nurAnsicht = modus.aktiv;

  if (stand === "fertig") {
    const eigener = pickText(content.success_text, modus.locale);
    return (
      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-semibold">{eigener || t.formularDanke}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      {headline ? (
        <h2
          {...editierbar(modus, "headline")}
          className="font-display text-3xl font-extrabold tracking-tight"
        >
          {headline}
        </h2>
      ) : null}
      {intro ? (
        <p
          {...editierbar(modus, "intro")}
          className="pt-3 text-muted-foreground"
        >
          {intro}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-4 pt-8"
        onSubmit={async (e) => {
          e.preventDefault();
          if (nurAnsicht) return;
          const form = new FormData(e.currentTarget);
          const daten: Record<string, string> = {};
          for (const [k, v] of form.entries()) {
            daten[k] = typeof v === "string" ? v : "";
          }
          setStand("sendet");
          setMeldung(null);
          try {
            const res = await fetch("/api/v1/site/form", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                block_id: content.__block_id ?? "",
                daten,
              }),
            });
            if (!res.ok) {
              // Die Meldung des Servers zeigen, wenn es eine gibt: „Bitte
              // stimmen Sie der Datenverarbeitung zu" ist für den Gast
              // brauchbar, „Fehler 422" nicht.
              const körper = (await res.json().catch(() => null)) as {
                detail?: string;
              } | null;
              setMeldung(körper?.detail ?? t.formularFehler);
              setStand("fehler");
              return;
            }
            setStand("fertig");
          } catch {
            // Netzfehler: die Eingaben bleiben stehen, damit niemand neu tippen
            // muss.
            setMeldung(t.formularFehler);
            setStand("fehler");
          }
        }}
      >
        {felder.map((f, i) => {
          const name = typeof f.name === "string" ? f.name : `feld_${i}`;
          const art = typeof f.type === "string" ? f.type : "text";
          const label = pickText(f.label, modus.locale) || name;
          const platzhalter = pickText(f.placeholder, modus.locale);
          const pflicht = f.required === true;

          if (art === "consent") {
            const ziel = branding?.privacy_policy_slug;
            return (
              <label key={name} className="flex items-start gap-2 text-sm">
                {/* Der Wert „ja" und nicht „on": der Betrieb liest die Antwort
                    in seiner Liste, nicht ein Programm. */}
                <input
                  type="checkbox"
                  name={name}
                  value="ja"
                  required
                  className="mt-1 size-4"
                />
                <span>
                  {label}
                  {ziel ? (
                    <>
                      {" "}
                      <a
                        href={`/${ziel}`}
                        className="underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.datenschutzMehr}
                      </a>
                    </>
                  ) : null}
                </span>
              </label>
            );
          }

          if (art === "checkbox") {
            return (
              <label key={name} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name={name}
                  value="ja"
                  required={pflicht}
                  className="mt-1 size-4"
                />
                <span>{label}</span>
              </label>
            );
          }

          if (art === "select") {
            const optionen = (
              Array.isArray(f.options) ? f.options : []
            ) as Array<Record<string, string>>;
            return (
              <label key={name} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{label}</span>
                <select
                  name={name}
                  required={pflicht}
                  defaultValue=""
                  className="rounded-(--radius) border border-border bg-transparent px-3 py-2"
                >
                  {/* Die leere erste Option: ohne sie ist die erste Wahl
                      vorausgewählt, und der Gast schickt sie ab, ohne sie
                      getroffen zu haben. */}
                  <option value="" disabled={pflicht}>
                    {platzhalter || "—"}
                  </option>
                  {optionen.map((o, j) => {
                    const text = pickText(o, modus.locale);
                    return text ? (
                      <option key={`${text}-${j}`} value={text}>
                        {text}
                      </option>
                    ) : null;
                  })}
                </select>
              </label>
            );
          }

          if (art === "textarea") {
            return (
              <label key={name} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{label}</span>
                <textarea
                  name={name}
                  rows={5}
                  required={pflicht}
                  placeholder={platzhalter || undefined}
                  maxLength={5000}
                  className="rounded-(--radius) border border-border bg-transparent px-3 py-2"
                />
              </label>
            );
          }

          return (
            <label key={name} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{label}</span>
              <input
                type={htmlTyp(EINZEILIG.has(art) ? art : "text")}
                name={name}
                required={pflicht}
                placeholder={platzhalter || undefined}
                maxLength={5000}
                className="rounded-(--radius) border border-border bg-transparent px-3 py-2"
              />
            </label>
          );
        })}

        {meldung ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {meldung}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={stand === "sendet" || nurAnsicht}
          className="btn-marke btn-marke-primaer self-start bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pickText(content.submit_label, modus.locale) || t.formularSenden}
        </button>
      </form>
    </section>
  );
}
