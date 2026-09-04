"use client";

// Filterleiste des Dienstplans: Arbeitsbereich, Objekt, Person, Freitext.
//
// Der Zustand lebt in der URL (Vertrag §5) und nicht im Component-State: ein
// gefilterter Plan ist damit verlinkbar, ein Reload behält die Sicht, und der
// Zurück-Knopf des Browsers tut, was er soll. Diese Komponente ist deshalb
// zustandslos — sie zeigt `wert` und meldet Änderungen nach oben; die
// URL-Pflege macht der Dienstplan an EINER Stelle.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { Filterzustand } from "@/lib/personal-planung-typen";
import type { Arbeitsbereich, PlanPerson } from "@/lib/personal-typen";

export function DienstplanFilter({
  wert,
  onChange,
  arbeitsbereiche,
  objekte,
  personen,
}: {
  wert: Filterzustand;
  onChange: (neu: Filterzustand) => void;
  arbeitsbereiche: Arbeitsbereich[];
  objekte: { id: string; title: string }[];
  personen: PlanPerson[];
}) {
  const t = useTranslations("personal");
  const aktiv =
    !!wert.arbeitsbereich_id || !!wert.property_id || !!wert.user_id || !!wert.suche;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2">
      <Icon icon="ph:funnel" className="ml-1 size-4 text-muted-foreground" />
      <NativeSelect
        aria-label={t("arbeitsbereich")}
        className="w-auto min-w-36"
        value={wert.arbeitsbereich_id}
        onChange={(e) => onChange({ ...wert, arbeitsbereich_id: e.target.value })}
      >
        <option value="">{t("filter.alleBereiche")}</option>
        {arbeitsbereiche
          .filter((b) => !b.archived_at)
          .map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
      </NativeSelect>
      <NativeSelect
        aria-label={t("objekt")}
        className="w-auto min-w-36"
        value={wert.property_id}
        onChange={(e) => onChange({ ...wert, property_id: e.target.value })}
      >
        <option value="">{t("filter.alleObjekte")}</option>
        {objekte.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label={t("dienstplan.person")}
        className="w-auto min-w-36"
        value={wert.user_id}
        onChange={(e) => onChange({ ...wert, user_id: e.target.value })}
      >
        <option value="">{t("filter.allePersonen")}</option>
        {personen.map((p) => (
          <option key={p.user_id} value={p.user_id}>
            {p.full_name ?? p.user_id}
          </option>
        ))}
      </NativeSelect>
      <Input
        className="w-auto min-w-40 flex-1"
        placeholder={t("filter.suche")}
        value={wert.suche}
        onChange={(e) => onChange({ ...wert, suche: e.target.value })}
      />
      {aktiv && (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() =>
            onChange({ arbeitsbereich_id: "", property_id: "", user_id: "", suche: "" })
          }
        >
          <Icon icon="ph:x" className="mr-1 size-3.5" />
          {t("filter.zuruecksetzen")}
        </Button>
      )}
    </div>
  );
}
