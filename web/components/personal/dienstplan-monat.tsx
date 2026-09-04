"use client";

// Monatsansicht des Dienstplans: 6×7-Raster ab dem Montag vor dem Ersten.
//
// WARUM 6 ZEILEN FEST: ein Monat verteilt sich je nach Wochentag des Ersten
// auf vier bis sechs Kalenderwochen. Ein Raster, das seine Höhe mitwandert,
// springt beim Monatswechsel — mit fester Höhe bleibt die Fläche ruhig und
// die Randtage des Vor-/Folgemonats sind gedimmt sichtbar (sie tragen echte
// Schichten und dürfen nicht fehlen).
//
// JE ZELLE höchstens drei Kacheln plus „+n" (Vertrag §5) — mehr wären in
// einer Monatszelle unlesbar. Ein Klick auf den Tag öffnet die Tagesansicht,
// die alles zeigt.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import type { SchichtPlus, Wettertag } from "@/lib/personal-planung-typen";
import { tageDiff, wetterIcon } from "@/lib/personal-planung-typen";
import type { Abwesenheit, Arbeitsbereich, PlanPerson } from "@/lib/personal-typen";
import { stunden, tagePlus } from "@/lib/personal-typen";
import { uhrzeitInZone } from "@/lib/personal-zeit";

const MAX_KACHELN = 3;

export function DienstplanMonat({
  monat,
  rasterStart,
  schichten,
  abwesenheiten,
  personen,
  arbeitsbereiche,
  feiertage,
  wetter,
  zone,
  heute,
  onTagOeffnen,
}: {
  /** Erster Tag des angezeigten Monats (yyyy-MM-01). */
  monat: string;
  /** Montag der ersten Rasterzeile. */
  rasterStart: string;
  schichten: SchichtPlus[];
  abwesenheiten: Abwesenheit[];
  personen: PlanPerson[];
  arbeitsbereiche: Arbeitsbereich[];
  feiertage: Record<string, string>;
  wetter: Record<string, Wettertag>;
  zone: string;
  heute: string;
  onTagOeffnen: (tag: string) => void;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const monatPrefix = monat.slice(0, 7);

  const jeTag = new Map<string, SchichtPlus[]>();
  for (const s of schichten) {
    if (s.status === "abgesagt" && s.quelle !== "abwesenheit") continue;
    jeTag.set(s.datum, [...(jeTag.get(s.datum) ?? []), s]);
  }

  // Abwesenheiten je Tag zählen — in der Monatssicht zeigt eine Zelle nur die
  // ANZAHL; wer weiß, wer fehlt, öffnet den Tag.
  const abwJeTag = new Map<string, number>();
  for (const a of abwesenheiten) {
    if (a.status === "abgelehnt" || a.status === "storniert") continue;
    let tag = a.von;
    while (tag <= a.bis) {
      abwJeTag.set(tag, (abwJeTag.get(tag) ?? 0) + 1);
      tag = tagePlus(tag, 1);
    }
  }

  const bereichFarbe = (id: string | null) =>
    arbeitsbereiche.find((b) => b.id === id)?.farbe ?? "#64748b";
  const personName = (id: string | null) =>
    id ? (personen.find((p) => p.user_id === id)?.full_name ?? "—") : t("dienstplan.offen");

  const wochentage = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
      new Date(`${tagePlus(rasterStart, i)}T12:00:00Z`),
    ),
  );

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-secondary/40 text-xs font-medium">
        {wochentage.map((w, i) => (
          <div key={w} className={`px-2 py-1.5 ${i >= 5 ? "text-muted-foreground" : ""}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 42 }, (_, i) => {
          const tag = tagePlus(rasterStart, i);
          const imMonat = tag.startsWith(monatPrefix);
          const inhalt = jeTag.get(tag) ?? [];
          const abw = abwJeTag.get(tag) ?? 0;
          const w = wetter[tag];
          const minuten = inhalt.reduce((n, s) => n + s.netto_minuten, 0);
          const wochenende = i % 7 >= 5;
          return (
            <button
              type="button"
              key={tag}
              onClick={() => onTagOeffnen(tag)}
              className={`flex min-h-24 flex-col gap-0.5 border-b border-r p-1 text-left align-top last:border-r-0 hover:bg-secondary/40 ${
                tag === heute ? "bg-primary/5" : wochenende ? "bg-secondary/20" : ""
              } ${imMonat ? "" : "opacity-45"}`}
            >
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-xs tabular-nums ${
                    tag === heute ? "font-bold text-primary" : "font-medium"
                  }`}
                >
                  {Number(tag.slice(8, 10))}
                </span>
                {w && (
                  <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Icon icon={wetterIcon(w.code)} className="size-3" />
                    {w.temp_max !== null ? `${Math.round(w.temp_max)}°` : ""}
                  </span>
                )}
              </div>
              {feiertage[tag] && (
                <div className="truncate text-[10px] text-rose-700" title={feiertage[tag]}>
                  {feiertage[tag]}
                </div>
              )}
              {inhalt.slice(0, MAX_KACHELN).map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-1 truncate rounded border-l-2 bg-card px-1 text-[10px] ${
                    s.status === "entwurf" ? "border-dashed" : ""
                  } ${s.user_id ? "" : "bg-amber-50"}`}
                  style={{ borderLeftColor: bereichFarbe(s.arbeitsbereich_id) }}
                >
                  <span className="tabular-nums">{uhrzeitInZone(s.start_at, zone)}</span>
                  <span className="truncate text-muted-foreground">{personName(s.user_id)}</span>
                </div>
              ))}
              {inhalt.length > MAX_KACHELN && (
                <div className="text-[10px] font-medium text-primary">
                  {t("monat.weitere", { anzahl: inhalt.length - MAX_KACHELN })}
                </div>
              )}
              <div className="mt-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {minuten > 0 && <span className="tabular-nums">{stunden(minuten)} h</span>}
                {abw > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Icon icon="ph:user-minus" className="size-3" />
                    {abw}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        {t("monat.hint", { tage: tageDiff(rasterStart, tagePlus(rasterStart, 42)) })}
      </p>
    </div>
  );
}
