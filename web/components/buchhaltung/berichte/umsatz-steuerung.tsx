"use client";

// Gruppierung (Monat/Quartal/Jahr) und Aufschlüsselung (gesamt/Kunde/Objekt/
// Kanal) der Umsatz-Seite — beides in der URL, wie der Zeitraum.
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";

import { NativeSelect } from "@nextdays/ui/native-select";
import { Segmented } from "@nextdays/ui/segmented";
import type { Aufschluesselung, Gruppierung } from "@/lib/buchhaltung-berichte-typen";

const GRUPPEN: readonly Gruppierung[] = ["month", "quarter", "year"];
const AUFSCHLUESSELUNGEN: readonly (Aufschluesselung | "gesamt")[] = [
  "gesamt",
  "customer",
  "property",
  "channel",
];

export function UmsatzSteuerung({
  group,
  by,
}: {
  group: Gruppierung;
  by: Aufschluesselung | null;
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = useId();

  function setzen(key: "group" | "by", wert: string) {
    const q = new URLSearchParams(params.toString());
    if (wert === "gesamt") q.delete(key);
    else q.set(key, wert);
    router.replace(`${pathname}?${q}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented
        value={group}
        onChange={(g) => setzen("group", g)}
        options={GRUPPEN.map((g) => ({ value: g, label: t(`umsatzPage.gruppe.${g}`) }))}
      />
      <label className="sr-only" htmlFor={id}>
        {t("umsatzPage.aufschluesselung")}
      </label>
      <NativeSelect
        id={id}
        value={by ?? "gesamt"}
        onChange={(e) => setzen("by", e.target.value)}
        className="h-9 w-auto min-w-44"
      >
        {AUFSCHLUESSELUNGEN.map((a) => (
          <option key={a} value={a}>
            {t(`umsatzPage.nach.${a}`)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
