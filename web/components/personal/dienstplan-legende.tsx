"use client";

// Legende des Dienstplans als eigenes Element (Vertrag §5).
//
// Bisher stand darunter EIN grauer Satz („Doppelklick legt an, Ziehen
// verschiebt") — der erklärte die Bedienung, aber keines der Zeichen, die im
// Raster tatsächlich Bedeutung tragen: gestrichelter Rahmen = Entwurf, Haken =
// bestätigt, Punkte = Wunsch/Sperre, Kuchen = Geburtstag, Schlüssel =
// Schichtleitung, Pfeile = Tausch. Ohne Legende muss man jedes Zeichen einzeln
// anhovern, um es zu verstehen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Arbeitsbereich } from "@/lib/personal-typen";

export function DienstplanLegende({ arbeitsbereiche }: { arbeitsbereiche: Arbeitsbereich[] }) {
  const t = useTranslations("personal");
  const [offen, setOffen] = useState(false);

  const zeichen: { icon?: string; klasse?: string; label: string }[] = [
    { icon: "ph:check", klasse: "text-emerald-600", label: t("legende.bestaetigt") },
    { icon: "ph:warning", klasse: "text-amber-600", label: t("legende.warnung") },
    { icon: "ph:warning-octagon", klasse: "text-destructive", label: t("legende.fehler") },
    { icon: "ph:arrows-left-right", klasse: "text-sky-600", label: t("legende.tausch") },
    { icon: "ph:cake", klasse: "text-fuchsia-600", label: t("legende.geburtstag") },
    { icon: "ph:key", klasse: "text-amber-600", label: t("legende.schichtleitung") },
    { icon: "ph:list-checks", klasse: "text-muted-foreground", label: t("legende.ausAufgabe") },
    { icon: "ph:sparkle", klasse: "text-violet-600", label: t("legende.kiErzeugt") },
  ];

  return (
    <div className="rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/40"
      >
        <Icon icon={offen ? "ph:caret-down" : "ph:caret-right"} className="size-3.5" />
        <Icon icon="ph:info" className="size-4 text-muted-foreground" />
        <span className="font-medium">{t("legende.title")}</span>
      </button>
      {offen && (
        <div className="grid gap-3 border-t p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="mb-1 font-medium">{t("legende.zeichen")}</div>
            <ul className="space-y-1 text-muted-foreground">
              {zeichen.map((z) => (
                <li key={z.label} className="flex items-center gap-1.5">
                  {z.icon && <Icon icon={z.icon} className={`size-3.5 ${z.klasse ?? ""}`} />}
                  {z.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 font-medium">{t("legende.zustaende")}</div>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-6 rounded border border-dashed bg-card" />
                {t("legende.entwurf")}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-6 rounded border bg-card" />
                {t("legende.veroeffentlicht")}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-6 rounded border bg-amber-50" />
                {t("legende.offeneSchicht")}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-6 rounded bg-secondary" />
                {t("legende.abwesend")}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-emerald-500" />
                {t("legende.wunsch")}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-rose-500" />
                {t("legende.gesperrt")}
              </li>
            </ul>
          </div>
          <div>
            <div className="mb-1 font-medium">{t("legende.bereiche")}</div>
            <ul className="space-y-1 text-muted-foreground">
              {arbeitsbereiche
                .filter((b) => !b.archived_at)
                .map((b) => (
                  <li key={b.id} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-1.5 rounded"
                      style={{ backgroundColor: b.farbe }}
                    />
                    {b.name} <span className="font-mono">{b.kurz}</span>
                  </li>
                ))}
              {arbeitsbereiche.filter((b) => !b.archived_at).length === 0 && (
                <li>{t("einstellungen.keineBereiche")}</li>
              )}
            </ul>
            <p className="mt-2">{t("dienstplan.legende")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
