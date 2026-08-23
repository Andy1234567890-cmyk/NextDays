"use client";

// „Abschnitt hinzufügen" — der Katalog als Dialog, nach Gruppen geordnet.
//
// Bewusst eine flache, vollständige Liste statt eines Baums oder einer Suche:
// bei rund einem Dutzend Abschnitten ist Sehen schneller als Suchen. Jeder
// Eintrag trägt eine Ein-Zeilen-Erklärung — der Kunde soll nicht raten müssen,
// was „Hero" bedeutet.
//
// Die Buchungs-Abschnitte sind markiert: sie bringen echte Verfügbarkeit und
// echte Preise auf die Seite. Das ist der Unterschied zu einem reinen
// Website-Baukasten und darf sichtbar sein.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import type { BlockType } from "@/lib/site-pages";

import { GRUPPEN, type Abschnitt } from "../abschnitte";

export function AbschnittKatalog({
  eintraege,
  onWaehle,
  onSchliesse,
}: {
  eintraege: Abschnitt[];
  onWaehle: (typ: BlockType) => void;
  onSchliesse: () => void;
}) {
  const t = useTranslations("website");

  // Escape schließt — Tastaturbedienung ohne Mausweg zum X.
  useEffect(() => {
    function aufTaste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliesse();
    }
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [onSchliesse]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("editor.abschnittHinzufuegen")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onSchliesse}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl"
        // Klick im Inhalt darf nicht zum Hintergrund durchschlagen (schließt sonst).
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-extrabold">
            {t("editor.abschnittHinzufuegen")}
          </h2>
          <button
            type="button"
            aria-label={t("editor.schliessen")}
            onClick={onSchliesse}
            className="text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-6">
            {GRUPPEN.map((gruppe) => {
              const inGruppe = eintraege.filter((a) => a.gruppe === gruppe);
              if (inGruppe.length === 0) return null;
              return (
                <section key={gruppe} className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`editor.gruppe.${gruppe}`)}
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {inGruppe.map((a) => (
                      <li key={a.typ}>
                        <button
                          type="button"
                          onClick={() => onWaehle(a.typ)}
                          className="flex w-full items-start gap-3 rounded-(--radius) border border-border px-3 py-2.5 text-left transition hover:border-foreground hover:bg-secondary/50"
                        >
                          <Icon
                            icon={a.icon}
                            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 font-medium">
                              {t(`abschnitte.${a.label}`)}
                              {a.buchung ? (
                                <span title={t("editor.buchungsAbschnitt")}>
                                  <Icon
                                    icon="ph:calendar-check"
                                    aria-label={t("editor.buchungsAbschnitt")}
                                    className="size-3.5 text-emerald-600"
                                  />
                                </span>
                              ) : null}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {t(`abschnitte.${a.hinweis}`)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
