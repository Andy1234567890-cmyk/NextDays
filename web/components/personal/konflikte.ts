// Konflikt → lesbarer Satz (eine Stelle für Dienstplan, Dialog und Mein-Plan).
import type { useTranslations } from "next-intl";

import { formatCurrency } from "@/lib/currency";
import type { Konflikt } from "@/lib/personal-typen";

/** Geldwert eines Konflikts (Minor + Währung aus den Werten, Wurzel 4).
 *  Ohne Währung rendert `formatCurrency` symbollos — nie ein erfundenes EUR. */
function geld(minor: number | string | undefined, currency: number | string | undefined): string {
  const zahl = typeof minor === "number" ? minor : Number(minor);
  if (!Number.isFinite(zahl)) return "—";
  return formatCurrency(zahl / 100, typeof currency === "string" ? currency : "");
}

export function konfliktText(t: ReturnType<typeof useTranslations>, k: Konflikt): string {
  const w = k.werte;
  switch (k.art) {
    case "ruhezeit":
      return t("konflikte.ruhezeit", { ist: String(w.ist ?? ""), min: String(w.min ?? "") });
    case "max_tagesstunden":
      return t("konflikte.max_tagesstunden", { ist: String(w.ist ?? ""), max: String(w.max ?? "") });
    case "max_wochenstunden":
      return t("konflikte.max_wochenstunden", { ist: String(w.ist ?? ""), max: String(w.max ?? "") });
    case "doppelbelegung":
      return t("konflikte.doppelbelegung");
    case "abwesenheit":
      return t("konflikte.abwesenheit");
    case "gesperrt":
      return t("konflikte.gesperrt");
    case "urlaubssperre":
      return t("konflikte.urlaubssperre");
    case "qualifikation":
      return t("konflikte.qualifikation");
    case "jugendschutz":
      // Zwei Formen (Vertrag §1.2): Tagesstunden ODER Nachtfenster. Welche es
      // ist, sagen die mitgelieferten Werte — nicht die Konfliktart.
      return w.nacht_von !== undefined
        ? t("konflikte.jugendschutz_nacht", {
            alter: String(w.alter ?? ""),
            von: String(w.nacht_von ?? ""),
            bis: String(w.nacht_bis ?? ""),
          })
        : t("konflikte.jugendschutz_stunden", {
            alter: String(w.alter ?? ""),
            ist: String(w.ist_stunden ?? ""),
            max: String(w.max_stunden ?? ""),
          });
    case "verdienstgrenze":
      return t("konflikte.verdienstgrenze", {
        grenze: geld(w.grenze_minor, w.currency),
        geplant: geld(w.geplant_minor, w.currency),
      });
    default:
      return k.art;
  }
}
