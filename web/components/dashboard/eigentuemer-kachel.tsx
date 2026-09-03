"use client";

// Eigentümer-Vorgänge auf der Startseite: offene Sperranträge,
// Aufhebungswünsche und angekündigte Vertragsenden.
//
// WARUM ES DIESE KACHEL BRAUCHT: Der Sperrantrags-Workflow ist vollständig
// gebaut (Antrag im Eigentümer-Portal, Familien-Freigabe, Kollisionsprüfung,
// Entscheidung, Kündigungswertung, Aufhebung) und hat seine eigene Seite unter
// /kalender/sperrantraege. Auf der Startseite stand davon NICHTS. Ein Betrieb,
// der nicht weiß, dass dort etwas liegt, ruft die Seite nie auf — genau so
// blieb der Workflow schon einmal wirkungslos, damals weil das Frontend ganz
// fehlte (siehe Kopf von app/(dashboard)/kalender/sperrantraege/page.tsx).
//
// Die Benachrichtigung allein reicht dafür nicht: sie ist ein Ereignis, das
// vorbeizieht. Sobald sie quittiert ist, erinnert nichts mehr an den offenen
// Antrag. Ein Bestand gehört auf die Startseite.
//
// Bewusst KEIN Zeitraum-Selektor: die drei Zahlen sind ein Ist-Stand. „Offene
// Anträge der letzten 30 Tage" wäre eine Angabe, die niemand braucht — offen
// ist offen, und älter heißt dringender, nicht weniger relevant.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

import { Card, CardContent } from "@nextdays/ui/card";
import {
  KachelKopf,
  PeriodBadge,
} from "@/components/dashboard/kachel-kopf";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import type { EigentuemerVorgaenge } from "@/lib/calendar";

/** Ganze Tage zwischen dem Zeitstempel und heute. `null` bei fehlendem oder
 *  unlesbarem Wert — kein erfundenes Alter (Wurzel 4). */
function tageSeit(iso: string | null): number | null {
  if (!iso) return null;
  const dann = new Date(iso).getTime();
  if (Number.isNaN(dann)) return null;
  const tage = Math.floor((Date.now() - dann) / 86_400_000);
  return tage < 0 ? 0 : tage;
}

function Zeile({
  icon,
  label,
  wert,
  hervorheben,
}: {
  icon: string;
  label: string;
  wert: number;
  hervorheben: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon icon={icon} className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`shrink-0 tabular-nums text-sm font-semibold ${
          hervorheben && wert > 0 ? "text-accent" : "text-foreground"
        }`}
      >
        {wert}
      </span>
    </li>
  );
}

export function EigentuemerKachel({ daten }: { daten: EigentuemerVorgaenge }) {
  const t = useTranslations("reservations");
  const tGemein = useTranslations("common");
  const locale = useLocale();
  const titel = t("dashboard.ownerRequests");
  // Die Zahl im Blickfang ist das, was eine ENTSCHEIDUNG verlangt: offene
  // Anträge plus Aufhebungswünsche. Vertragsenden sind eine Information, kein
  // Handgriff — sie stehen in der Liste, aber nicht in der großen Zahl.
  const zuEntscheiden = daten.offen + daten.aufhebung_offen;
  const tage = tageSeit(daten.aeltester_offen_am);

  return (
    <Card className="relative h-full transition-colors hover:border-accent/40">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <KachelKopf
          icon="ph:hand-palm"
          title={titel}
          gross
          info={
            /* Der Info-Punkt liegt mit z-10 über der Klickfläche: sein
               Auslöser ist ein <button>, und ein <button> in einem <a> wäre
               weder gültiges HTML noch bedienbar (dieselbe Lösung wie in
               ObjektKachel). */
            <span className="relative z-10 shrink-0">
              <InfoHinweis
                titel={titel}
                text={t("dashboard.ownerRequestsExplain")}
                ariaLabel={tGemein("explain", { label: titel })}
              />
            </span>
          }
          rechts={<PeriodBadge label={t("dashboard.badgeCurrent")} />}
        />

        <div>
          <p className="font-display text-4xl font-extrabold leading-none">
            {zuEntscheiden}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.ownerRequestsLabel")}
          </p>
        </div>

        {/* Das Alter des ältesten offenen Antrags. Es ist die Dringlichkeit:
            solange niemand entscheidet, wartet ein Eigentümer auf eine
            Antwort. Nur wenn es wirklich etwas Offenes gibt. */}
        {daten.offen > 0 && tage !== null && (
          <p className="text-xs text-muted-foreground">
            {t("dashboard.ownerRequestsOldest", { count: tage })}
          </p>
        )}

        <ul className="divide-y divide-border border-t border-border">
          <Zeile
            icon="ph:hourglass-medium"
            label={t("dashboard.ownerRequestsPending")}
            wert={daten.offen}
            hervorheben
          />
          <Zeile
            icon="ph:lock-open"
            label={t("dashboard.ownerRequestsLift")}
            wert={daten.aufhebung_offen}
            hervorheben
          />
          <Zeile
            icon="ph:file-x"
            label={t("dashboard.ownerRequestsTermination")}
            wert={daten.kuendigungen}
            hervorheben={false}
          />
        </ul>

        {zuEntscheiden === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("dashboard.ownerRequestsNone")}
          </p>
        )}

        {/* Ziel ist die Warteschlange, in der entschieden wird. Bei einem
            offenen Aufhebungswunsch führt der Sprung direkt auf den Filter
            „genehmigt" — dort und nur dort steht der Knopf dafür. */}
        <Link
          href={
            daten.offen === 0 && daten.aufhebung_offen > 0
              ? "/kalender/sperrantraege?status=approved"
              : "/kalender/sperrantraege"
          }
          lang={locale}
          className="absolute inset-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* Eine leere Fläche ohne Text ist für Screenreader ein Ziel ohne
              Beschriftung. */}
          <span className="sr-only">{titel}</span>
        </Link>
      </CardContent>
    </Card>
  );
}
