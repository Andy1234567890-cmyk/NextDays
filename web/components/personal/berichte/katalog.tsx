"use client";

// Berichts-Katalog: Karten je Gruppe (zeit · abwesenheit · finanzen · personal
// · plan) mit Name, Kurzbeschreibung und Link auf die Berichtsseite.
//
// GEZEIGT WIRD, WAS DER SERVER LIEFERT — nichts sonst. `GET /berichte` ist
// bereits auf die Rechte des Aufrufers gefiltert (Vertrag §4.1); eine zweite
// Rechte-Logik hier wäre entweder redundant oder falsch, und ein Bericht, den
// die Oberfläche verbirgt, während der Endpunkt ihn liefert, ist kein Schutz
// (Wurzel 3/9). Sieht eine Schichtleitung also nur vier Karten, ist das die
// Antwort des Servers, keine Ausblendung hier.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState } from "@nextdays/ui/empty-state";
import { Input } from "@nextdays/ui/input";
import type { BerichtGruppe, BerichtKatalogEintrag } from "@/lib/personal-berichte-typen";
import { BERICHT_GRUPPEN, GRUPPEN_ICON } from "@/lib/personal-berichte-typen";

export function BerichteKatalog({
  eintraege,
  loadError,
}: {
  eintraege: BerichtKatalogEintrag[];
  loadError: string | null;
}) {
  const t = useTranslations("personal");
  const [suche, setSuche] = useState("");

  const titelVon = (name: string) =>
    t.has(`berichte.namen.${name}.titel`) ? t(`berichte.namen.${name}.titel`) : name;
  const textVon = (name: string) =>
    t.has(`berichte.namen.${name}.beschreibung`)
      ? t(`berichte.namen.${name}.beschreibung`)
      : "";

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase();
    if (!s) return eintraege;
    return eintraege.filter((e) =>
      [e.name, titelVon(e.name), textVon(e.name)].some((w) => w.toLowerCase().includes(s)),
    );
    // titelVon/textVon hängen nur an `t`, das über die Sprache stabil ist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eintraege, suche, t]);

  const gruppen = useMemo(() => {
    const map = new Map<BerichtGruppe, BerichtKatalogEintrag[]>();
    for (const g of BERICHT_GRUPPEN) {
      const liste = gefiltert.filter((e) => e.gruppe === g);
      if (liste.length) map.set(g, liste);
    }
    // Eine Gruppe, die der Server neu einführt, fällt nicht unter den Tisch.
    for (const e of gefiltert) {
      if (!BERICHT_GRUPPEN.includes(e.gruppe)) {
        map.set(e.gruppe, [...(map.get(e.gruppe) ?? []), e]);
      }
    }
    return [...map.entries()];
  }, [gefiltert]);

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{t("berichte.titel")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("berichte.untertitel", { anzahl: eintraege.length })}
          </p>
        </div>
        {eintraege.length > 4 && (
          <Input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={t("berichte.suche")}
            className="w-full max-w-xs"
          />
        )}
      </div>

      {loadError && (
        <p className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {loadError}
        </p>
      )}

      {gruppen.length === 0 && !loadError && (
        <EmptyState
          icon="ph:chart-bar"
          titel={t("berichte.keine.titel")}
          text={t("berichte.keine.text")}
        />
      )}

      {gruppen.map(([gruppe, liste]) => (
        <section key={gruppe} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <Icon
              icon={GRUPPEN_ICON[gruppe] ?? "ph:chart-bar"}
              aria-hidden
              className="size-5 text-muted-foreground"
            />
            {t.has(`berichte.gruppen.${gruppe}`) ? t(`berichte.gruppen.${gruppe}`) : gruppe}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {liste.map((e) => (
              <Link
                key={e.name}
                href={`/hr/berichte/${encodeURIComponent(e.name)}`}
                className="group flex flex-col gap-1 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-secondary/30"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-medium">{titelVon(e.name)}</span>
                  <Icon
                    icon="ph:arrow-right"
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </span>
                <span className="text-sm text-muted-foreground">{textVon(e.name)}</span>
                {e.capability === "export_lohn" && (
                  <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    <Icon icon="ph:lock-simple" aria-hidden className="size-3" />
                    {t("berichte.nurLeitung")}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
