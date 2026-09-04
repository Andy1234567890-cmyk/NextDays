"use client";

// Filterleiste einer Berichtsseite. Gezeigt wird AUSSCHLIESSLICH, was der
// Katalog für DIESEN Bericht nennt (`filter: [...]`, Vertrag §4.1) — ein
// Personenfilter über einem Bericht, der je Tag aggregiert, wäre eine
// Attrappe.
//
// DER ZUSTAND LIEGT IN DER URL. Nicht aus Bequemlichkeit, sondern damit ein
// Link teilbar ist („schau dir den März an"): jede Änderung schreibt die
// Query mit `router.replace`, die Seite lädt serverseitig neu. Deshalb hält
// diese Komponente keinen eigenen Filterzustand ausser dem Entwurf der zwei
// Datumsfelder.
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { BerichtFilterName, BerichtFilterWerte } from "@/lib/personal-berichte-typen";
import { zeitraumSchnellwahl } from "@/lib/personal-berichte-typen";
import { BESCHAEFTIGUNGSARTEN, heuteIso } from "@/lib/personal-typen";

export type FilterOptionen = {
  arbeitsbereiche: { id: string; name: string }[];
  objekte: { id: string; title: string }[];
  personen: { user_id: string; full_name: string | null }[];
};

export function BerichtFilter({
  aktiv,
  werte,
  optionen,
  busy,
}: {
  /** Die Filternamen, die der Katalog für diesen Bericht nennt. */
  aktiv: BerichtFilterName[];
  werte: BerichtFilterWerte;
  optionen: FilterOptionen;
  busy: boolean;
}) {
  const t = useTranslations("personal");
  const router = useRouter();
  const params = useSearchParams();
  const [entwurf, setEntwurf] = useState({ von: werte.von, bis: werte.bis });

  /** Schreibt die Query neu — leere Werte fliegen raus, damit die URL nicht
   *  mit `&user_id=` zumüllt. */
  function setzen(aenderung: Partial<BerichtFilterWerte>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(aenderung)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  const zeigt = (f: BerichtFilterName) => aktiv.includes(f);

  function schnell(art: "dieserMonat" | "vormonat" | "diesesJahr") {
    const z = zeitraumSchnellwahl(art, heuteIso());
    setEntwurf(z);
    setzen(z);
  }

  const zeitraumGeaendert = entwurf.von !== werte.von || entwurf.bis !== werte.bis;

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-3 text-sm">
      {zeigt("zeitraum") && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("von")}</span>
            <DatePicker
              value={entwurf.von}
              onChange={(v) => setEntwurf((z) => ({ ...z, von: v }))}
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("bis")}</span>
            <DatePicker
              value={entwurf.bis}
              onChange={(v) => setEntwurf((z) => ({ ...z, bis: v }))}
              className="w-40"
            />
          </label>
          <Button
            variant={zeitraumGeaendert ? "default" : "outline"}
            className="rounded-full"
            disabled={busy}
            onClick={() => setzen(entwurf)}
          >
            {t("anzeigen")}
          </Button>
          <div className="flex flex-wrap items-center gap-1">
            {(["dieserMonat", "vormonat", "diesesJahr"] as const).map((art) => (
              <button
                key={art}
                type="button"
                onClick={() => schnell(art)}
                disabled={busy}
                className="rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                {t(`berichte.filter.${art}`)}
              </button>
            ))}
          </div>
        </>
      )}

      {zeigt("arbeitsbereich") && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("arbeitsbereich")}</span>
          <NativeSelect
            value={werte.arbeitsbereich_id}
            disabled={busy}
            onChange={(e) => setzen({ arbeitsbereich_id: e.target.value })}
            className="w-48"
          >
            <option value="">{t("berichte.filter.alleBereiche")}</option>
            {optionen.arbeitsbereiche.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}

      {zeigt("objekt") && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("objekt")}</span>
          <NativeSelect
            value={werte.property_id}
            disabled={busy}
            onChange={(e) => setzen({ property_id: e.target.value })}
            className="w-48"
          >
            <option value="">{t("berichte.filter.alleObjekte")}</option>
            {optionen.objekte.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}

      {zeigt("person") && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("berichte.spalten.person")}</span>
          <NativeSelect
            value={werte.user_id}
            disabled={busy}
            onChange={(e) => setzen({ user_id: e.target.value })}
            className="w-48"
          >
            <option value="">{t("berichte.filter.allePersonen")}</option>
            {optionen.personen.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.full_name ?? p.user_id}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}

      {zeigt("beschaeftigungsart") && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t("berichte.spalten.beschaeftigungsart")}
          </span>
          <NativeSelect
            value={werte.beschaeftigungsart}
            disabled={busy}
            onChange={(e) => setzen({ beschaeftigungsart: e.target.value })}
            className="w-48"
          >
            <option value="">{t("berichte.filter.alleArten")}</option>
            {BESCHAEFTIGUNGSARTEN.map((a) => (
              <option key={a} value={a}>
                {t(`beschaeftigungsart.${a}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}

      {istGesetzt(aktiv, werte) && (
        <Button
          variant="ghost"
          className="rounded-full"
          disabled={busy}
          onClick={() =>
            setzen({
              arbeitsbereich_id: "",
              property_id: "",
              user_id: "",
              beschaeftigungsart: "",
            })
          }
        >
          <Icon icon="ph:x" aria-hidden className="mr-1 size-4" />
          {t("berichte.filter.zuruecksetzen")}
        </Button>
      )}
    </div>
  );
}

/** Ist mindestens ein Nicht-Zeitraum-Filter gesetzt? Nur dann hat ein
 *  „Zurücksetzen" etwas zu tun. */
function istGesetzt(aktiv: BerichtFilterName[], w: BerichtFilterWerte): boolean {
  return (
    (aktiv.includes("arbeitsbereich") && !!w.arbeitsbereich_id) ||
    (aktiv.includes("objekt") && !!w.property_id) ||
    (aktiv.includes("person") && !!w.user_id) ||
    (aktiv.includes("beschaeftigungsart") && !!w.beschaeftigungsart)
  );
}
