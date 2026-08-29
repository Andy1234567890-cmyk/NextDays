"use client";

// Die Startbahn — die Fortschrittsliste, die NACH dem Assistenten bleibt.
//
// WARUM ES SIE GIBT: der Assistent endete bisher mit einem Link auf /objekte
// und verschwand. Von dort bis zum verkaufsfertigen Objekt führte niemand:
// Preise, Sperrtermine und das Veröffentlichen musste der Betrieb selbst
// finden. Genau diese Strecke bildet die Startbahn ab und bleibt sichtbar, bis
// sie erledigt ist.
//
// WOHER DIE WAHRHEIT KOMMT: `object_created`, `price_set` und `channels_done`
// werden serverseitig aus der DB GEMESSEN (dashboard/service.py,
// `_real_progress`) — aus `properties`, `rate_plans` und
// `channex_property_map`. Diese Liste kann deshalb nicht behaupten, etwas sei
// erledigt, was es nicht ist, und hakt sich auch dann ab, wenn der Betrieb den
// Schritt woanders erledigt hat. Neue Zeilen sollen genauso gemessen werden,
// statt ein Klick-Flag zu setzen.
//
// ZWEI KUNDEN, ZWEI LISTEN: ein Wechselkunde mit acht importierten
// Airbnb-Objekten braucht nicht „Erstes Objekt anlegen", sondern seinen
// Import-Stand. Deshalb entscheidet `customer_type` über die Zeilen, nicht über
// die Gestaltung.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@nextdays/ui/accordion";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Progress } from "@nextdays/ui/progress";
import { cn } from "@nextdays/ui/utils";

import type { OnboardingStatus } from "@/lib/onboarding";

/** Ein Schritt der Liste. */
type Schritt = {
  id: string;
  /** Erledigt — kommt aus der serverseitigen Messung, nie aus einem Klick. */
  fertig: boolean;
  /** Gesperrt, solange die Vorbedingung fehlt. Der Grund wird IMMER genannt. */
  gesperrt?: boolean;
  ziel?: string;
  /** Grobe Dauer, wenn sie ehrlich schätzbar ist. */
  dauerMinuten?: number;
};

type Gruppe = {
  id: string;
  icon: string;
  schritte: Schritt[];
};

/** Die Gruppen für einen Betrieb, der seine Objekte von einem Portal holt. */
function gruppenWechsler(s: OnboardingStatus): Gruppe[] {
  const objekteDa = s.object_created;
  return [
    {
      id: "kanaele",
      icon: "ph:plugs",
      schritte: [
        { id: "konto", fertig: true },
        { id: "firma", fertig: s.company_data_set, ziel: "/konto" },
        { id: "verbinden", fertig: s.channels_done, ziel: "/channels" },
        { id: "objekteHolen", fertig: objekteDa, ziel: "/objekte", dauerMinuten: 2 },
      ],
    },
    {
      id: "verkaufsfertig",
      icon: "ph:tag",
      schritte: [
        {
          id: "inhalteHolen",
          fertig: false,
          gesperrt: !objekteDa,
          ziel: "/objekte",
          dauerMinuten: 2,
        },
        {
          id: "preise",
          fertig: s.price_set,
          gesperrt: !objekteDa,
          ziel: "/objekte",
        },
        {
          id: "sperrtermine",
          fertig: false,
          gesperrt: !objekteDa,
          ziel: "/kalender",
        },
        {
          id: "veroeffentlichen",
          fertig: false,
          gesperrt: !objekteDa || !s.price_set,
          ziel: "/objekte",
        },
      ],
    },
  ];
}

/** Die Gruppen für einen Betrieb, der neu anfängt. */
function gruppenNeukunde(s: OnboardingStatus): Gruppe[] {
  return [
    {
      id: "grundlagen",
      icon: "ph:plugs",
      schritte: [
        { id: "konto", fertig: true },
        { id: "firma", fertig: s.company_data_set, ziel: "/konto" },
        { id: "erstesObjekt", fertig: s.object_created, ziel: "/objekte", dauerMinuten: 5 },
      ],
    },
    {
      id: "verkaufsfertig",
      icon: "ph:tag",
      schritte: [
        {
          id: "preise",
          fertig: s.price_set,
          gesperrt: !s.object_created,
          ziel: "/objekte",
        },
        {
          id: "kanaele",
          fertig: s.channels_done,
          gesperrt: !s.object_created,
          ziel: "/channels",
        },
        {
          id: "veroeffentlichen",
          fertig: false,
          gesperrt: !s.object_created || !s.price_set,
          ziel: "/objekte",
        },
      ],
    },
  ];
}

export function Startbahn({
  status,
  /** Kompakt = das eingeklappte Feld auf Unterseiten (nur Titel + Balken). */
  kompakt = false,
  className,
}: {
  status: OnboardingStatus;
  kompakt?: boolean;
  className?: string;
}) {
  const t = useTranslations("startbahn");
  const wechsler = status.customer_type === "switch";
  const gruppen = wechsler ? gruppenWechsler(status) : gruppenNeukunde(status);

  const alle = gruppen.flatMap((g) => g.schritte);
  const fertig = alle.filter((s) => s.fertig).length;
  const anteil = alle.length ? Math.round((fertig / alle.length) * 100) : 0;

  // Der erste Schritt, der weder erledigt noch gesperrt ist — er steht offen.
  const offener = alle.find((s) => !s.fertig && !s.gesperrt)?.id;

  if (kompakt) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
            <Icon icon="ph:rocket-launch" aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{t("titel")}</p>
            <p className="text-xs text-muted-foreground">
              {t("fortschritt", { fertig, gesamt: alle.length })}
            </p>
          </div>
        </div>
        <Progress value={anteil} className="mt-3 h-1.5" />
      </Card>
    );
  }

  return (
    // Die linke Spalte waechst mit ihrem laengsten Text, statt ihn umbrechen
    // zu lassen: `fit-content` zwischen 19 und 26 rem. Feste 19 rem zwangen
    // „Objekte verkaufsfertig machen" in zwei Zeilen, wodurch die Gruppe
    // hoeher wurde als ihre Nachbarn und die Spalte unruhig wirkte.
    //
    // Bemessen wird nicht nach dem deutschen Text: laengster Gruppentitel ist
    // das rumaenische „Pregătiți proprietățile pentru vânzare" mit 38 Zeichen
    // (Deutsch: 30). Die Obergrenze deckt ihn ab, ohne dass die Spalte in
    // Sprachen mit kurzen Titeln unnoetig breit wird — `min-content` waere zu
    // schmal, eine feste Breite fuer 38 Zeichen zu grob.
    <Card
      className={cn(
        "grid gap-0 lg:grid-cols-[fit-content(26rem)_1fr]",
        className,
      )}
    >
      {/* Links: die Gruppen mit ihren Zählern. */}
      <div className="flex flex-col gap-1 border-b border-border p-5 lg:border-b-0 lg:border-r">
        <p className="mb-3 font-display text-lg font-extrabold">{t("titel")}</p>

        {gruppen.map((g) => {
          const gFertig = g.schritte.filter((s) => s.fertig).length;
          const enthaeltOffenen = g.schritte.some((s) => s.id === offener);
          return (
            <div
              key={g.id}
              className={cn(
                "flex items-start gap-3 rounded-(--radius) px-3 py-2.5",
                enthaeltOffenen && "bg-secondary",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon icon={g.icon} aria-hidden className="size-4" />
              </span>
              <div className="min-w-0">
                {/* `whitespace-nowrap` ist hier der Hebel: dadurch meldet die
                    Zelle ihre volle Textbreite an `fit-content`, und die
                    Spalte waechst mit — bis zur Obergrenze, ab der doch
                    umbrochen wird, statt die Karte zu sprengen. */}
                <p className="text-sm font-medium lg:whitespace-nowrap">
                  {t(`gruppe.${g.id}`)}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {t("gruppeZaehler", {
                    fertig: gFertig,
                    gesamt: g.schritte.length,
                  })}
                </p>
              </div>
            </div>
          );
        })}

        {/* `mt-5` statt `mt-auto`: die rechte Spalte ist deutlich höher, ein
            `mt-auto` schob den Balken dort an den unteren Rand und riss ihn von
            den Zählern los, auf die er sich bezieht. */}
        <div className="mt-5">
          <Progress value={anteil} />
          <p className="mt-1.5 text-right text-xs tabular-nums text-muted-foreground">
            {t("fortschritt", { fertig, gesamt: alle.length })}
          </p>
        </div>
      </div>

      {/* Rechts: die Schritte. Immer nur einer offen — `collapsible`, damit der
          Betrieb ihn auch zuklappen kann. */}
      <div className="p-5">
        <Accordion type="single" collapsible defaultValue={offener}>
          {alle.map((s) => (
            <AccordionItem key={s.id} value={s.id}>
              <AccordionTrigger
                // Ein gesperrter Schritt klappt trotzdem auf: dort steht, was
                // ihn freischaltet. Ein Schloss ohne Begründung ist eine
                // Sackgasse.
                className={cn(
                  s.fertig && "text-muted-foreground",
                  s.gesperrt && "text-muted-foreground",
                )}
              >
                {s.fertig ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Icon
                      icon="ph:check-bold"
                      aria-hidden
                      className="size-3 text-primary-foreground"
                    />
                  </span>
                ) : s.gesperrt ? (
                  <Icon
                    icon="ph:lock-simple"
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                ) : (
                  <span className="size-5 shrink-0 rounded-full border border-border" />
                )}

                <span className={cn(s.fertig && "line-through")}>
                  {t(`schritt.${s.id}.titel`)}
                </span>

                {!s.fertig && !s.gesperrt && s.dauerMinuten ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t("dauer", { minuten: s.dauerMinuten })}
                  </span>
                ) : null}
              </AccordionTrigger>

              <AccordionContent className="pl-8">
                {/* `t.has` und nicht blind `t(...)`: erledigte Schritte wie
                    „Konto angelegt" haben weder Sperr- noch Aktionstext, und
                    next-intl wirft bei einem fehlenden Schlüssel einen
                    MISSING_MESSAGE-Fehler statt ihn zu überspringen. */}
                <p className="mb-3 max-w-prose text-sm text-muted-foreground">
                  {s.gesperrt && t.has(`schritt.${s.id}.gesperrt`)
                    ? t(`schritt.${s.id}.gesperrt`)
                    : t(`schritt.${s.id}.text`)}
                </p>
                {!s.fertig && !s.gesperrt && s.ziel && t.has(`schritt.${s.id}.aktion`) ? (
                  <Button asChild size="sm">
                    <Link href={s.ziel}>{t(`schritt.${s.id}.aktion`)}</Link>
                  </Button>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Card>
  );
}
