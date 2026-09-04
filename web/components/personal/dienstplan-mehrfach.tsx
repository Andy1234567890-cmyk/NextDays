"use client";

// Aktionsleiste der Mehrfachauswahl (Vertrag §1.4, POST /schichten/mehrfach).
//
// Sie erscheint erst, wenn etwas ausgewählt ist, und legt sich unten über die
// Fläche — so bleibt der Plan sichtbar, während man auswählt. Jede Aktion
// nennt die ANZAHL, auf die sie wirkt: „12 Schichten löschen" ist eine andere
// Entscheidung als „löschen".
//
// Der Server prüft die Regeln und antwortet 409 mit der Konfliktliste je
// Schicht; die Rückfrage („trotzdem?") führt der Dienstplan, weil er auch die
// Einzelschicht so behandelt — EIN Konfliktfluss, nicht zwei.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { MehrfachAktion } from "@/lib/personal-planung-typen";
import type { PlanPerson } from "@/lib/personal-typen";

export function MehrfachLeiste({
  anzahl,
  personen,
  onAktion,
  onAbbrechen,
  laeuft,
}: {
  anzahl: number;
  personen: PlanPerson[];
  onAktion: (aktion: MehrfachAktion, opts: { tage?: number; user_id?: string }) => void;
  onAbbrechen: () => void;
  laeuft: boolean;
}) {
  const t = useTranslations("personal");
  const [zielPerson, setZielPerson] = useState("");
  if (anzahl === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-2 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 text-sm">
        <span className="ml-1 inline-flex items-center gap-1 font-medium">
          <Icon icon="ph:check-square" className="size-4 text-primary" />
          {t("mehrfach.ausgewaehlt", { anzahl })}
        </span>

        <span className="mx-1 h-5 w-px bg-border" />

        <span className="text-muted-foreground">{t("mehrfach.verschieben")}</span>
        {[-7, -1, 1, 7].map((d) => (
          <Button
            key={d}
            variant="outline"
            size="sm"
            className="rounded-full tabular-nums"
            disabled={laeuft}
            onClick={() => onAktion("verschieben", { tage: d })}
          >
            {d > 0 ? `+${d}` : d}
          </Button>
        ))}

        <span className="mx-1 h-5 w-px bg-border" />

        <NativeSelect
          aria-label={t("mehrfach.zuweisen")}
          className="w-auto min-w-40"
          value={zielPerson}
          onChange={(e) => setZielPerson(e.target.value)}
        >
          <option value="">{t("mehrfach.zuweisenAn")}</option>
          {personen.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.full_name ?? p.user_id}
            </option>
          ))}
        </NativeSelect>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={laeuft || !zielPerson}
          onClick={() => onAktion("zuweisen", { user_id: zielPerson })}
        >
          <Icon icon="ph:user-switch" className="mr-1 size-4" />
          {t("mehrfach.zuweisen")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={laeuft}
          onClick={() => onAktion("freigeben", {})}
        >
          <Icon icon="ph:user-minus" className="mr-1 size-4" />
          {t("mehrfach.freigeben")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-destructive"
          disabled={laeuft}
          onClick={() => onAktion("loeschen", {})}
        >
          <Icon icon="ph:trash" className="mr-1 size-4" />
          {t("mehrfach.loeschen")}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto rounded-full"
          onClick={onAbbrechen}
          disabled={laeuft}
        >
          <Icon icon="ph:x" className="mr-1 size-4" />
          {t("mehrfach.beenden")}
        </Button>
        {laeuft && <Icon icon="ph:circle-notch" className="size-4 animate-spin" />}
      </div>
    </div>
  );
}
