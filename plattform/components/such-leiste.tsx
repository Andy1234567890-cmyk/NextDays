// Erweiterte Such-Leiste — drei Felder (Wohin / Wann / Wer) + Such-Button.
// Beim Klick auf "Wohin" öffnet ein Dropdown mit vorgeschlagenen Reisezielen.
// Struktur angelehnt an gängige Buchungs-Suchleisten, Design = myNextDays.
"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

const ZIEL_VORSCHLAEGE = [
  { icon: "ph:navigation-arrow", ort: "In der Nähe", text: "Finde heraus, was es in deiner Nähe gibt.", nahbei: true },
  { icon: "ph:eiffel-tower", ort: "Paris, Frankreich", text: "Wegen Sehenswürdigkeiten wie dem Eiffelturm" },
  { icon: "ph:sun-horizon", ort: "Barcelona, Spanien", text: "Beliebtes Reiseziel am Strand" },
  { icon: "ph:moon-stars", ort: "Bangkok, Thailand", text: "Wegen des pulsierenden Nachtlebens" },
  { icon: "ph:shrine", ort: "Tokio, Japan", text: "Wegen der atemberaubenden Architektur" },
  { icon: "ph:buildings", ort: "Hamburg, Deutschland", text: "Wegen Sehenswürdigkeiten wie der Speicherstadt" },
  { icon: "ph:fork-knife", ort: "Rom, Italien", text: "Wegen der erstklassigen Restaurants" },
];

export function SuchLeiste() {
  const [offen, setOffen] = useState(false);
  const [ziel, setZiel] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function waehle(vorschlag: { ort: string; nahbei?: boolean }) {
    // "In der Nähe": Browser-Standort abfragen (zeigt die native Berechtigungs-
    // Abfrage). Bei Erfolg setzen wir das Feld auf den ermittelten Standort.
    if (vorschlag.nahbei) {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => setZiel("In deiner Nähe"),
          () => setZiel("In der Nähe"),
        );
      } else {
        setZiel("In der Nähe");
      }
      setOffen(false);
      return;
    }
    setZiel(vorschlag.ort);
    setOffen(false);
  }

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-5xl">
      <div
        className={
          "flex items-center rounded-full border bg-card p-2 shadow-md transition-shadow " +
          (offen ? "border-accent/40 shadow-lg" : "border-border")
        }
      >
        <button
          type="button"
          onClick={() => setOffen((o) => !o)}
          className={
            "flex-1 rounded-full px-8 py-[0.9375rem] text-left transition-colors hover:bg-secondary " +
            (offen ? "bg-secondary" : "")
          }
        >
          <span className="block pb-0.5 text-xs font-medium leading-4 text-foreground">
            Wohin
          </span>
          <span
            className={
              "block text-sm leading-[1.125rem] " +
              (ziel ? "font-medium text-foreground" : "text-muted-foreground")
            }
          >
            {ziel ?? "Reiseziele suchen"}
          </span>
        </button>
        <span className="h-8 w-px shrink-0 bg-border" />
        <button
          type="button"
          className="flex-1 rounded-full px-6 py-[0.9375rem] text-left transition-colors hover:bg-secondary"
        >
          <span className="block pb-0.5 text-xs font-medium leading-4 text-foreground">
            Wann
          </span>
          <span className="block text-sm leading-[1.125rem] text-muted-foreground">
            Datum hinzufügen
          </span>
        </button>
        <span className="h-8 w-px shrink-0 bg-border" />
        <button
          type="button"
          className="flex-1 rounded-full px-6 py-[0.9375rem] text-left transition-colors hover:bg-secondary"
        >
          <span className="block pb-0.5 text-xs font-medium leading-4 text-foreground">
            Wer
          </span>
          <span className="block text-sm leading-[1.125rem] text-muted-foreground">
            Gäste hinzufügen
          </span>
        </button>
        <button
          type="button"
          aria-label="Suchen"
          className="ml-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-90"
        >
          <Icon icon="ph:magnifying-glass" className="size-5" />
        </button>
      </div>

      {/* Dropdown: vorgeschlagene Reiseziele */}
      {offen && (
        <div className="absolute left-0 top-full z-50 mt-3 w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
          <div className="p-6">
            <p className="mb-4 text-sm font-semibold text-muted-foreground">
              Vorgeschlagene Reiseziele
            </p>
            <ul className="flex flex-col">
              {ZIEL_VORSCHLAEGE.map((vorschlag) => (
                <li key={vorschlag.ort}>
                  <button
                    type="button"
                    onClick={() => waehle(vorschlag)}
                    className="flex w-full items-center gap-4 rounded-xl p-2 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-accent">
                      <Icon icon={vorschlag.icon} className="size-6" />
                    </span>
                    <span>
                      <span className="block font-medium">{vorschlag.ort}</span>
                      <span className="block text-sm text-muted-foreground">
                        {vorschlag.text}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
