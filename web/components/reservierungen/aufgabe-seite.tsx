"use client";

// Der Seiten-Rahmen des Aufgaben-Deep-Links (/aufgaben/<id>).
//
// Bewusst schmal (max-w-2xl) und ohne Liste dahinter: wer aus einer Mail kommt,
// hat genau EINE Frage — „was soll ich tun und wie melde ich es fertig". Eine
// Team-Liste im Hintergrund wäre Kontext, den dieser Weg nicht braucht, und auf
// dem Telefon (der Regelfall für Reinigung/Wartung) nur Ballast.
//
// Der Zurück-Weg führt auf „Meine Aufgaben" — die persönliche Ansicht des
// Empfängers (§4.3). Ein `router.back()` wäre hier falsch: aus der Mail heraus
// gibt es keine Vorgeschichte, der Knopf täte dann nichts.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Button } from "@nextdays/ui/button";

import { TaskDetailInhalt } from "./task-detail-inhalt";

const MEINE_AUFGABEN = "/reservierungen/aufgaben/meine";

export function AufgabeSeite({ taskId }: { taskId: string }) {
  const t = useTranslations("reservations");
  const [weg, setWeg] = useState(false);
  // Stabil, damit der Ladeeffekt im Inhalt nicht bei jedem Rendern neu läuft.
  const nichtGefunden = useCallback(() => setWeg(true), []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 pb-20">
      <Link
        href={MEINE_AUFGABEN}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icon icon="ph:caret-left" className="size-4" />
        {t("taskPage.backToMyTasks")}
      </Link>

      <div className="rounded-(--radius) border border-border bg-card p-5">
        {weg ? (
          // Ein 404 vom Server heißt hier IMMER dasselbe für den Aufrufer:
          // die Aufgabe ist für ihn nicht da. Ob sie gelöscht wurde, einem
          // anderen Mandanten gehört oder außerhalb seiner Objekt-Freigabe
          // liegt, wird NICHT unterschieden — das wäre eine Auskunft über
          // fremde Daten.
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon
              icon="ph:clipboard-text"
              className="size-10 text-muted-foreground"
            />
            <div>
              <p className="font-display text-lg font-extrabold">
                {t("taskPage.notFoundTitle")}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("taskPage.notFoundHint")}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={MEINE_AUFGABEN}>{t("taskPage.toMyTasks")}</Link>
            </Button>
          </div>
        ) : (
          <TaskDetailInhalt taskId={taskId} onNichtGefunden={nichtGefunden} />
        )}
      </div>
    </div>
  );
}
