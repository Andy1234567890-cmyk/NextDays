"use client";

// „Schlafmöglichkeiten"-Übersicht (Airbnb „Add sleeping arrangements"): Titel +
// Untertitel + je Schlafzimmer eine große umrandete Card mit 3D-Bett-Illustration
// (fluent-emoji, Screenshot-Größe) und Bett-Zusammenfassung. Klick auf eine Card
// meldet das Zimmer nach OBEN — der Editor öffnet dann die rechte Bett-Sidebar
// (SchlafPanel), genau wie in der Fototour.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { BETT_TYPEN } from "./bett-typen";

export type SchlafRaum = { id: string; titel: string };

/** Kurz-Zusammenfassung der Betten eines Zimmers („1 Doppelbett · 1 Einzelbett"). */
function zusammenfassung(werte: Record<string, number>): string {
  return BETT_TYPEN.filter((bt) => (werte[bt.key] ?? 0) > 0)
    .map((bt) => `${werte[bt.key]} ${bt.label}`)
    .join(" · ");
}

export function SchlafmoeglichkeitenPanel({
  raeume,
  sleeping,
  onOeffne,
}: {
  raeume: SchlafRaum[];
  sleeping: Record<string, Record<string, number>>;
  onOeffne: (raumId: string) => void;
}) {
  const t = useTranslations("objektEditor");

  return (
    <section className="max-w-3xl">
      <h2 className="font-sans text-[2rem] font-bold tracking-tight">
        {t("schlafUebersichtTitel")}
      </h2>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {t("schlafUebersichtHint")}
      </p>

      <div className="mt-8 space-y-4">
        {raeume.map((r) => {
          const zus = zusammenfassung(sleeping[r.id] ?? {});
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onOeffne(r.id)}
              className="flex w-full items-center gap-4 rounded-2xl border border-border p-4 text-left transition-shadow hover:shadow-md"
            >
              {/* 3D-Bett-Illustration (Airbnb: direkt in der Card, keine Kachel). */}
              <Icon icon="fluent-emoji:bed" className="size-12 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{r.titel}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {zus || t("schlafDetailsHinzufuegen")}
                </span>
              </span>
              <Icon
                icon="ph:caret-right"
                className="size-5 shrink-0 text-muted-foreground"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
