"use client";

// Teamaufgaben auf der Startseite: was offen ist, was überfällig ist, was
// heute ansteht, was niemandem gehört und was auf Abnahme wartet.
//
// WARUM ES DIESE KACHEL BRAUCHT: Das Aufgaben-Modul ist vollständig gebaut
// (Regeln, Kalender, Team-Liste, Inspektion, Vertretung) und hat seine Seiten
// unter /reservierungen/aufgaben. Auf der Startseite stand davon NICHTS —
// dieselbe Lücke wie beim Sperrantrags-Workflow (siehe eigentuemer-kachel.tsx).
// Wer nicht weiß, dass eine Reinigung überfällig ist, ruft die Liste nicht auf;
// die Reinigung fällt aus, und der nächste Gast steht im ungemachten Objekt.
//
// Bewusst KEIN Zeitraum-Selektor: das ist ein Ist-Stand. „Offene Aufgaben der
// letzten 30 Tage" wäre eine Angabe, die niemand braucht — offen ist offen, und
// älter heißt dringender, nicht weniger relevant.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, CardContent } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { KachelKopf, PeriodBadge } from "@/components/dashboard/kachel-kopf";
import { tagesbeginnIso, tagesendeIso } from "@/lib/aufgaben-konstanten";
import { getTeamaufgabenStand, type TeamaufgabenStand } from "@/lib/tasks";

/** Ganze Tage zwischen dem Zeitstempel und heute. `null` bei fehlendem oder
 *  unlesbarem Wert — kein erfundenes Alter (Wurzel 4). */
function tageSeit(iso: string | null): number | null {
  if (!iso) return null;
  const dann = new Date(iso).getTime();
  if (Number.isNaN(dann)) return null;
  const tage = Math.floor((Date.now() - dann) / 86_400_000);
  return tage < 0 ? 0 : tage;
}

/** `wert = null` heißt NICHT ERMITTELT, nicht 0 — die Zeile zeigt dann einen
 *  Gedankenstrich statt einer Zahl, die Ruhe behaupten würde. */
function Zeile({
  icon,
  label,
  wert,
  hervorheben,
}: {
  icon: string;
  label: string;
  wert: number | null;
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
          wert === null
            ? "text-muted-foreground"
            : hervorheben && wert > 0
              ? "text-accent"
              : "text-foreground"
        }`}
      >
        {wert === null ? "—" : wert}
      </span>
    </li>
  );
}

export function AufgabenKachel({ daten }: { daten: TeamaufgabenStand }) {
  const t = useTranslations("reservations");
  const tGemein = useTranslations("common");
  const locale = useLocale();
  const titel = t("dashboard.teamTasks");
  // Der Serverstand kommt OHNE Tagesgrenzen (die Server Component kennt die
  // Zone des Lesers nicht) und trägt deshalb `ueberfaellig`/`heute` auf 0 —
  // den reinen Bestand. Erst im Browser stehen die echten Grenzen fest; dann
  // wird einmal nachgeladen. Der Serverstand ist der Startwert, damit die
  // Kachel nicht leer aufblitzt.
  const [stand, setStand] = useState(daten);
  // Solange das Nachladen nicht durch ist, sind `ueberfaellig`/`heute`
  // NICHT ERMITTELT — nicht 0. Ohne diese Unterscheidung sähe ein
  // fehlgeschlagener Aufruf genau aus wie „nichts ist überfällig", und die
  // Kachel meldete Ruhe, wo niemand nachgesehen hat (Wurzel 4).
  const [dringlichkeit, setDringlichkeit] = useState<"laedt" | "da" | "fehler">(
    "laedt",
  );
  useEffect(() => {
    let lebt = true;
    void getTeamaufgabenStand({
      tagesbeginn: tagesbeginnIso(),
      tagesende: tagesendeIso(),
    }).then((r) => {
      if (!lebt) return;
      if (r.ok) {
        setStand(r.data);
        setDringlichkeit("da");
      } else {
        // Der Bestand aus dem Serverstand bleibt stehen und stimmt; nur die
        // Dringlichkeit fehlt. Statt einer Fehlerkarte anstelle vorhandener
        // Zahlen sagt die Kachel genau das.
        setDringlichkeit("fehler");
      }
    });
    return () => {
      lebt = false;
    };
  }, []);
  const dringlichkeitDa = dringlichkeit === "da";
  // Die große Zahl ist das, was einen HANDGRIFF verlangt: überfällig plus
  // heute fällig. Der reine Bestand steht in der Liste darunter — eine Aufgabe
  // nächste Woche ist kein Grund, jetzt etwas zu tun.
  const dringend = dringlichkeitDa ? stand.ueberfaellig + stand.heute : null;
  const tage = tageSeit(stand.aeltester_faellig_am);

  return (
    <Card className="relative h-full transition-colors hover:border-accent/40">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <KachelKopf
          icon="ph:list-checks"
          title={titel}
          gross
          info={
            /* z-10 über der Klickfläche: der Auslöser ist ein <button>, und ein
               <button> in einem <a> wäre weder gültiges HTML noch bedienbar
               (dieselbe Lösung wie in EigentuemerKachel/ObjektKachel). */
            <span className="relative z-10 shrink-0">
              <InfoHinweis
                titel={titel}
                text={t("dashboard.teamTasksExplain")}
                ariaLabel={tGemein("explain", { label: titel })}
              />
            </span>
          }
          rechts={<PeriodBadge label={t("dashboard.badgeCurrent")} />}
        />

        <div>
          <p className="font-display text-4xl font-extrabold leading-none">
            {dringend ?? "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {dringlichkeit === "fehler"
              ? t("dashboard.teamTasksUrgencyUnknown")
              : t("dashboard.teamTasksLabel")}
          </p>
        </div>

        {/* Das Alter der ältesten überfälligen Aufgabe ist die Dringlichkeit.
            Nur wenn wirklich etwas überfällig ist. */}
        {dringlichkeitDa && stand.ueberfaellig > 0 && tage !== null && (
          <p className="text-xs text-muted-foreground">
            {t("dashboard.teamTasksOldest", { count: tage })}
          </p>
        )}

        <ul className="divide-y divide-border border-t border-border">
          <Zeile
            icon="ph:warning-circle"
            label={t("dashboard.teamTasksOverdue")}
            wert={dringlichkeitDa ? stand.ueberfaellig : null}
            hervorheben
          />
          <Zeile
            icon="ph:calendar-dot"
            label={t("dashboard.teamTasksToday")}
            wert={dringlichkeitDa ? stand.heute : null}
            hervorheben
          />
          <Zeile
            icon="ph:user-minus"
            label={t("dashboard.teamTasksUnassigned")}
            wert={stand.ohne_zustaendige}
            hervorheben
          />
          <Zeile
            icon="ph:seal-check"
            label={t("dashboard.teamTasksToReview")}
            wert={stand.zur_abnahme}
            hervorheben={false}
          />
          <Zeile
            icon="ph:tray"
            label={t("dashboard.teamTasksOpen")}
            wert={stand.offen}
            hervorheben={false}
          />
        </ul>

        {/* Ziel ist die TEAM-Liste, nicht /reservierungen/aufgaben — das ist
            der Aufgaben-Kalender. Bewusst OHNE Filter-Parameter: der Reiter
            ist reiner Client-Zustand (`team-tasks.tsx`), die Seite liest keine
            `searchParams`. Ein `?bucket=overdue` sähe wie ein Sprung auf den
            Filter aus und wäre wirkungslos (Wurzel 4). */}
        <Link
          href="/reservierungen/aufgaben/team"
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
