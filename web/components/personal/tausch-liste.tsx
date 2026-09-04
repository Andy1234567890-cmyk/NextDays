"use client";

// Offene Schichttausche des Fensters (Vertrag §1.4, GET /tausch).
//
// WER WAS DARF, entscheidet die Rolle im Vorgang, nicht ein globaler Schalter:
//  * der EMPFÄNGER nimmt an oder lehnt ab (`/annehmen`, `/ablehnen`),
//  * der GEBER zieht zurück, solange nichts freigegeben ist (`/zurueckziehen`),
//  * die LEITUNG entscheidet (`/entscheiden` mit `freigeben: true|false`) —
//    erst diese Freigabe schreibt die Schichten um.
// Deshalb zeigt jede Zeile nur die Knöpfe, die für DIESEN Betrachter in DIESEM
// Zustand etwas tun. Ein Knopf, der 403 erntet, ist eine Falle.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import type { Tausch } from "@/lib/personal-planung-typen";
import { tagKurz, uhrzeitInZone } from "@/lib/personal-zeit";

export function TauschListe({
  tausche,
  eigeneId,
  kannEntscheiden,
  zone,
  onAnnehmen,
  onAblehnen,
  onZurueckziehen,
  onEntscheiden,
}: {
  tausche: Tausch[];
  eigeneId: string | null;
  kannEntscheiden: boolean;
  zone: string;
  onAnnehmen: (id: string) => void;
  onAblehnen: (id: string) => void;
  onZurueckziehen: (id: string) => void;
  onEntscheiden: (id: string, freigeben: boolean) => void;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();

  const offen = tausche.filter((x) => x.status === "angefragt" || x.status === "angenommen");
  if (offen.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
        <Icon icon="ph:arrows-left-right" className="size-4 text-sky-600" />
        {t("tausch.offene", { anzahl: offen.length })}
      </div>
      <ul className="divide-y text-sm">
        {offen.map((x) => {
          const istEmpfaenger = eigeneId !== null && x.an_user_id === eigeneId;
          const istGeber = eigeneId !== null && x.von_user_id === eigeneId;
          return (
            <li key={x.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="inline-flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
                <span className="font-medium">{x.von_name ?? "—"}</span>
                <Icon icon="ph:arrow-right" className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{x.an_name ?? "—"}</span>
                {x.schicht && (
                  <span className="text-muted-foreground">
                    · {tagKurz(x.schicht.datum, locale)} {uhrzeitInZone(x.schicht.start_at, zone)}–
                    {uhrzeitInZone(x.schicht.end_at, zone)}
                    {x.schicht.property_title ? ` · ${x.schicht.property_title}` : ""}
                  </span>
                )}
                {/* Nur mit der Zeit der Gegenschicht: „Tausch gegen" ohne Zeit
                    wäre eine halbe Aussage, und der Platzhalter bliebe leer. */}
                {x.gegen_schicht && (
                  <span className="rounded-full bg-secondary px-1.5 text-xs text-muted-foreground">
                    {t("tausch.mitGegenschicht", {
                      zeit: `${tagKurz(x.gegen_schicht.datum, locale)} ${uhrzeitInZone(
                        x.gegen_schicht.start_at,
                        zone,
                      )}–${uhrzeitInZone(x.gegen_schicht.end_at, zone)}`,
                    })}
                  </span>
                )}
                <span className="rounded-full bg-secondary px-1.5 text-xs">
                  {t(`tausch.status.${x.status}`)}
                </span>
                {x.grund && <span className="text-xs text-muted-foreground">„{x.grund}"</span>}
              </span>

              <span className="flex shrink-0 gap-1">
                {istEmpfaenger && x.status === "angefragt" && (
                  <>
                    <Button size="sm" className="rounded-full" onClick={() => onAnnehmen(x.id)}>
                      {t("annehmen")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onAblehnen(x.id)}>
                      {t("ablehnen")}
                    </Button>
                  </>
                )}
                {istGeber && (
                  <Button size="sm" variant="ghost" onClick={() => onZurueckziehen(x.id)}>
                    {t("zuruecknehmen")}
                  </Button>
                )}
                {kannEntscheiden && (
                  <>
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => onEntscheiden(x.id, true)}
                    >
                      <Icon icon="ph:check" className="mr-1 size-3.5" />
                      {t("tausch.freigeben")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onEntscheiden(x.id, false)}>
                      {t("tausch.verwerfen")}
                    </Button>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
