// Such-Block — elegante Pill-Leiste (Airbnb-Niveau, eigenständig). Navigiert mit
// ?q=&start=&end=&guests= (wird vom properties_grid-Block der Seite ausgewertet).
"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

export function SearchBlock({
  content,
  modus = NICHT_EDITIERBAR,
  aufgeschluesselt = false,
}: {
  content: Record<string, unknown>;
  // Der Platzhalter eines <input> ist per contentEditable nicht bearbeitbar —
  // dieser Abschnitt wird im Formular links gepflegt. Der Modus wird trotzdem
  // durchgereicht, damit die Sprache stimmt.
  modus?: EditierModus;
  /** true = Gästezahl getrennt nach Erwachsenen, Kindern und Kleinkindern
   *  erfragen (`show_guest_breakdown`, 0426), statt einer einzigen Zahl.
   *
   *  BEWUSST OHNE Haustiere, obwohl der Markt sie hier mit anbietet: die Suche
   *  des Backends filtert nicht nach Tieren (`guests` ist der einzige
   *  Belegungs-Parameter). Ein Tier-Feld wäre eine Eingabe ohne Wirkung — der
   *  Gast trüge seinen Hund ein und bekäme dieselbe Trefferliste. Die
   *  Tier-Angabe gehört in die Buchungsstrecke, wo sie ankommt. */
  aufgeschluesselt?: boolean;
}) {
  const router = useRouter();
  // Die Beschriftungen kommen aus dem Katalog des Renderers, in der Sprache der
  // Website (lib/texte.ts). Vorher standen hier feste deutsche Wörter — „Von",
  // „Bis", „Gäste", „Suchen" — auf JEDER Kundenseite, auch der dänischen.
  const txt = texte(modus.locale);
  const placeholder =
    pickText(content.placeholder, modus.locale) || txt.sucheReiseziel;
  const showGuests = content.show_guests !== false;
  const showDates = content.show_dates !== false;

  const [q, setQ] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [guests, setGuests] = useState("");
  // Aufgeschlüsselte Eingabe. Erwachsene starten bei 1, weil eine Suche ohne
  // eine einzige reisende Person keinen Sinn hat; Kinder und Kleinkinder bei 0.
  const [erwachsene, setErwachsene] = useState(1);
  const [kinder, setKinder] = useState(0);
  const [kleinkinder, setKleinkinder] = useState(0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (showDates && start) params.set("start", start);
    if (showDates && end) params.set("end", end);
    if (showGuests) {
      if (aufgeschluesselt) {
        // Kleinkinder zählen NICHT zur Belegung — Branchenstandard, und die
        // Objekte sind mit `max_guests` ohne Kleinkinder gepflegt. Würden sie
        // mitgezählt, fiele eine Familie mit Baby aus Treffern heraus, in die
        // sie hineinpasst.
        params.set("guests", String(erwachsene + kinder));
      } else if (guests) {
        params.set("guests", guests);
      }
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <form
        onSubmit={submit}
        className="flex flex-col items-stretch gap-2 rounded-3xl border border-border bg-card p-2 shadow-lg shadow-black/5 sm:flex-row sm:items-center sm:rounded-full"
      >
        <label className="flex flex-1 items-center gap-2 px-4 py-2">
          <Icon icon="ph:magnifying-glass" className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        {showDates ? (
          <div className="flex items-center gap-2 border-border px-2 sm:border-l">
            <label className="flex items-center gap-1.5 px-2 text-sm">
              <Icon icon="ph:calendar-blank" className="size-4 text-muted-foreground" />
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="bg-transparent text-sm outline-none"
                aria-label={txt.sucheVon}
              />
            </label>
            <span className="text-muted-foreground">–</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-transparent px-2 text-sm outline-none"
              aria-label={txt.sucheBis}
            />
          </div>
        ) : null}

        {showGuests && aufgeschluesselt ? (
          <div className="flex flex-wrap items-center gap-3 border-border px-4 text-sm sm:border-l">
            {(
              [
                [txt.gaesteErwachsene, erwachsene, setErwachsene, 1],
                [txt.gaesteKinder, kinder, setKinder, 0],
                [txt.gaesteKleinkinder, kleinkinder, setKleinkinder, 0],
              ] as Array<
                [string, number, (n: number) => void, number]
              >
            ).map(([label, wert, setzen, min]) => (
              <label key={label} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{label}</span>
                <input
                  type="number"
                  min={min}
                  max={30}
                  value={wert}
                  onChange={(e) => {
                    // Ein leeres Feld ergibt NaN — dann gilt das Minimum, statt
                    // dass die Summe zu NaN wird und die Suche ohne
                    // Gästezahl losläuft.
                    const n = Number(e.target.value);
                    setzen(Number.isFinite(n) ? Math.max(min, Math.min(30, n)) : min);
                  }}
                  aria-label={label}
                  className="w-12 bg-transparent text-sm outline-none"
                />
              </label>
            ))}
          </div>
        ) : showGuests ? (
          <label className="flex items-center gap-1.5 border-border px-4 text-sm sm:border-l">
            <Icon icon="ph:user" className="size-4 text-muted-foreground" />
            <input
              type="number"
              min={1}
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              placeholder={txt.sucheGaeste}
              className="w-16 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        ) : null}

        <button
          type="submit"
          className="btn-marke btn-marke-primaer inline-flex items-center justify-center gap-2 bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Icon icon="ph:magnifying-glass" className="size-4" />
          {txt.sucheSuchen}
        </button>
      </form>
    </div>
  );
}
