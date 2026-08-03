"use client";

// Block „Zu anderen Objekten hinzufügen": denselben Posten (Gebühr oder Steuer)
// auf weitere eigene Objekte übernehmen.
//
// Im Branchenstandard steht dieser Block als letzter Abschnitt IM Editor, mit
// Suchfeld, Zähler „8/20 ausgewählte", „Alle auswählen" und einer Zeile je
// Objekt mit Vorschaubild (live abgelesen 03.08.2026, Gebühren- und
// Steuer-Editor — in beiden derselbe Block). Deshalb liegt er hier als EINE
// Komponente und nicht zweimal: er stand vorher nur im Steuer-Editor, und eine
// Kopie für die Gebühr wäre die zweite Wahrheit über Auswahl und Zählweise.
//
// Die Liste kommt tenant-gescopt vom Server; welche IDs wirklich erlaubt sind,
// prüft der Endpunkt beim Anwenden erneut (Wurzel 3 — die Auswahl im Browser ist
// eine Bequemlichkeit, keine Autorisierung).
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Icon } from "@iconify/react";

import { Checkbox } from "@nextdays/ui/checkbox";
import { Input } from "@nextdays/ui/input";
import { listProperties, type Property } from "@/lib/properties";

export function ZuAnderenObjekten({
  propertyId,
  kind,
  selected,
  onChange,
}: {
  propertyId: string;
  /** Nur für den erklärenden Satz („dieselbe Gebühr" vs. „dieselbe Steuer" vs.
   *  „dieselbe Promotion") — die Mechanik ist identisch. Ein neutraler
   *  Sammelbegriff („Posten") wäre Fachjargon, den der Betrieb nirgends sonst
   *  liest. */
  kind: "fee" | "tax" | "promotion";
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("objects");
  const [objekte, setObjekte] = useState<Property[]>([]);
  const [suche, setSuche] = useState("");
  useEffect(() => {
    void (async () => {
      const res = await listProperties();
      if (res.ok) setObjekte(res.data.items.filter((p) => p.id !== propertyId));
    })();
  }, [propertyId]);

  const q = suche.trim().toLowerCase();
  const gefiltert = q
    ? objekte.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          objektReferenz(p).toLowerCase().includes(q),
      )
    : objekte;
  // „Alle auswählen" wirkt auf die aktuell SICHTBAREN Zeilen (wie die Suche
  // suggeriert), nicht auf ausgeblendete — sonst wählt man blind mit.
  const alleSichtbarGewaehlt =
    gefiltert.length > 0 && gefiltert.every((p) => selected.includes(p.id));

  function umschalten(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
  }

  function alleUmschalten() {
    const ids = gefiltert.map((p) => p.id);
    onChange(
      alleSichtbarGewaehlt
        ? selected.filter((x) => !ids.includes(x))
        : [...new Set([...selected, ...ids])],
    );
  }

  // Der Block bleibt IMMER sichtbar — auch bei nur einem Objekt. Wird er
  // ausgeblendet, sieht die Zuweisung aus wie „nicht gebaut"; stattdessen sagt
  // eine Zeile, warum gerade nichts zur Auswahl steht.
  if (objekte.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.applyToOthersTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">{t(hinweisSchluessel(kind))}</p>
        <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
          {t("pricingForm.applyToOthersEmpty")}
        </p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-extrabold">
        {t("pricingForm.applyToOthersTitle")}
      </h3>
      <p className="text-sm text-muted-foreground">{t(hinweisSchluessel(kind))}</p>
      <div className="relative">
        <Icon
          icon="ph:magnifying-glass"
          className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground"
        />
        <Input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={t("pricingForm.searchPropertiesPlaceholder")}
          className="pl-9"
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {t("pricingForm.selectedCount", {
            count: selected.length,
            total: objekte.length,
          })}
        </span>
        <button
          type="button"
          onClick={alleUmschalten}
          disabled={gefiltert.length === 0}
          className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          {alleSichtbarGewaehlt
            ? t("pricingForm.deselectAll")
            : t("pricingForm.selectAll")}
        </button>
      </div>
      <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-(--radius) border border-border">
        {gefiltert.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t("pricingForm.noMatches")}
          </p>
        ) : (
          gefiltert.map((p) => {
            const referenz = objektReferenz(p);
            return (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-secondary"
              >
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
                  {p.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photos[0]} alt="" className="size-full object-cover" />
                  ) : (
                    <Icon icon="ph:house-line" className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.title}</span>
                  {referenz && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {referenz}
                    </span>
                  )}
                </span>
                <Checkbox
                  checked={selected.includes(p.id)}
                  onCheckedChange={() => umschalten(p.id)}
                />
              </label>
            );
          })
        )}
      </div>
    </section>
  );
}

/** Welcher erklärende Satz über der Liste steht. */
function hinweisSchluessel(kind: "fee" | "tax" | "promotion"): string {
  if (kind === "fee") return "pricingForm.applyToOthersFeeHint";
  if (kind === "tax") return "pricingForm.applyToOthersTaxHint";
  return "pricingForm.applyToOthersPromoHint";
}

/** Zweite Zeile je Objekt: Adresse als Unterscheidungsmerkmal, wenn mehrere
 *  Objekte ähnlich heißen. Fehlt sie, bleibt die Zeile weg — kein Platzhalter. */
function objektReferenz(p: Property): string {
  const strasse = [p.street, p.house_number].filter(Boolean).join(" ");
  return [strasse, p.city].filter(Boolean).join(", ");
}
