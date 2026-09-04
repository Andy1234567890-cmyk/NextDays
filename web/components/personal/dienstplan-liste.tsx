"use client";

// Listen-Darstellung des Dienstplans: eine Zeile je Schicht, chronologisch.
//
// WOFÜR: das Raster zeigt Struktur, die Liste zeigt Vollständigkeit. Notizen,
// Status, Quelle und Konflikte stehen im Raster nur als Zeichen oder im
// Tooltip; wer den Plan durchgeht (Freigabe, Übergabe, Kontrolle), braucht sie
// nebeneinander lesbar. Dieselbe Datenbasis, dieselben Filter, dieselbe
// Mehrfachauswahl wie im Raster.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Checkbox } from "@nextdays/ui/checkbox";
import { EmptyState } from "@nextdays/ui/empty-state";
import type { SchichtPlus } from "@/lib/personal-planung-typen";
import type { Arbeitsbereich, Konflikt, PlanPerson } from "@/lib/personal-typen";
import { stunden } from "@/lib/personal-typen";
import { tagKurz, uhrzeitInZone, wochentagKurz } from "@/lib/personal-zeit";

export function DienstplanListe({
  schichten,
  personen,
  arbeitsbereiche,
  zone,
  heute,
  auswahlModus,
  ausgewaehlt,
  onAuswahl,
  onOeffnen,
  onTausch,
  konfliktText,
  kannPlanen,
}: {
  schichten: SchichtPlus[];
  personen: PlanPerson[];
  arbeitsbereiche: Arbeitsbereich[];
  zone: string;
  heute: string;
  auswahlModus: boolean;
  ausgewaehlt: Set<string>;
  onAuswahl: (id: string, shift: boolean) => void;
  onOeffnen: (s: SchichtPlus) => void;
  onTausch: (s: SchichtPlus) => void;
  konfliktText: (k: Konflikt) => string;
  kannPlanen: boolean;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();

  const name = (id: string | null) =>
    id ? (personen.find((p) => p.user_id === id)?.full_name ?? "—") : t("dienstplan.offen");
  const bereich = (id: string | null) => arbeitsbereiche.find((b) => b.id === id);

  const sortiert = [...schichten].sort(
    (a, b) => a.start_at.localeCompare(b.start_at) || (a.user_id ?? "").localeCompare(b.user_id ?? ""),
  );

  if (sortiert.length === 0) {
    return (
      <EmptyState
        icon="ph:calendar-blank"
        titel={t("liste.leerTitel")}
        text={t("liste.leerText")}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
            {auswahlModus && <th className="w-8 p-2" />}
            <th className="p-2 font-medium">{t("datum")}</th>
            <th className="p-2 font-medium">{t("zeit.zeitraum")}</th>
            <th className="p-2 font-medium">{t("dienstplan.person")}</th>
            <th className="p-2 font-medium">{t("arbeitsbereich")}</th>
            <th className="p-2 font-medium">{t("objekt")}</th>
            <th className="p-2 text-right font-medium">{t("zeit.netto")}</th>
            <th className="p-2 font-medium">{t("dienstplan.status")}</th>
            <th className="p-2 font-medium">{t("notiz")}</th>
            <th className="w-10 p-2" />
          </tr>
        </thead>
        <tbody>
          {sortiert.map((s) => {
            const b = bereich(s.arbeitsbereich_id);
            const fehler = s.konflikte.some((k) => k.schwere === "fehler");
            const warnung = s.konflikte.length > 0 && !fehler;
            return (
              <tr
                key={s.id}
                className={`border-b last:border-b-0 ${s.datum === heute ? "bg-primary/5" : ""} ${
                  ausgewaehlt.has(s.id) ? "bg-primary/10" : ""
                }`}
              >
                {auswahlModus && (
                  <td className="p-2">
                    <Checkbox
                      checked={ausgewaehlt.has(s.id)}
                      onClick={(e) => onAuswahl(s.id, e.shiftKey)}
                      aria-label={t("mehrfach.auswaehlen")}
                    />
                  </td>
                )}
                <td className="whitespace-nowrap p-2">
                  {wochentagKurz(s.datum, locale)} {tagKurz(s.datum, locale)}
                </td>
                <td className="whitespace-nowrap p-2 tabular-nums">
                  {uhrzeitInZone(s.start_at, zone)}–{uhrzeitInZone(s.end_at, zone)}
                  {s.pause_min > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({t("zeit.pause")} {s.pause_min})
                    </span>
                  )}
                </td>
                <td className="p-2">{name(s.user_id)}</td>
                <td className="p-2">
                  {b ? (
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block h-3 w-1.5 rounded"
                        style={{ backgroundColor: b.farbe }}
                      />
                      {b.name}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2 text-muted-foreground">{s.property_title ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{stunden(s.netto_minuten)}</td>
                <td className="p-2">
                  <span className="inline-flex items-center gap-1">
                    {t(`schichtStatus.${s.status}`)}
                    {s.tausch_status && (
                      <span title={t(`tausch.status.${s.tausch_status}`)}>
                        <Icon icon="ph:arrows-left-right" className="size-3.5 text-sky-600" />
                      </span>
                    )}
                    {fehler && <Icon icon="ph:warning-octagon" className="size-3.5 text-destructive" />}
                    {warnung && <Icon icon="ph:warning" className="size-3.5 text-amber-600" />}
                  </span>
                </td>
                <td className="max-w-48 truncate p-2 text-xs text-muted-foreground">
                  {[s.notiz, ...s.konflikte.map(konfliktText)].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="p-2 text-right">
                  <div className="flex justify-end gap-1">
                    {kannPlanen && s.user_id && (
                      <button
                        type="button"
                        onClick={() => onTausch(s)}
                        aria-label={t("tausch.anfragen")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Icon icon="ph:arrows-left-right" className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOeffnen(s)}
                      aria-label={t("dienstplan.schichtAendern")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Icon icon="ph:pencil-simple" className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
