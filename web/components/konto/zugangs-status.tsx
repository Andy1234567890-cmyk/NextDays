"use client";

// Zugangs-Status eines Benutzers als Chip („Aktiviert" / „Deaktiviert").
//
// Eine Quelle für Liste und Detailseite. Bei einem gesperrten Zugang steht das
// DATUM daneben, sobald es bekannt ist — „Deaktiviert" allein lässt offen, ob es
// gestern war oder vor einem Jahr. Der Zeitstempel kommt aus
// `users.deactivated_at` und beschreibt UNSERE Handlung (Wurzel 5b greift hier
// nicht: das Deaktivieren ist unser Ereignis, nicht das eines Portals).
import { useFormatter, useTranslations } from "next-intl";

export function ZugangsStatus({
  aktiv,
  seit,
}: {
  aktiv: boolean;
  /** ISO-Zeitpunkt der Deaktivierung; null, wenn aktiv oder unbekannt. */
  seit?: string | null;
}) {
  const t = useTranslations("account");
  const format = useFormatter();
  const datum = !aktiv && seit ? new Date(seit) : null;
  // Ein unlesbarer Zeitstempel wird WEGGELASSEN, nicht als „Invalid Date"
  // angezeigt und nicht durch das heutige Datum ersetzt (Wurzel 4).
  const lesbar = datum && !Number.isNaN(datum.getTime()) ? datum : null;

  if (aktiv) {
    return (
      <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
        {t("userDetail.statusActive")}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
      {lesbar
        ? t("userDetail.statusInactiveSince", {
            date: format.dateTime(lesbar, { dateStyle: "medium" }),
          })
        : t("userDetail.statusInactive")}
    </span>
  );
}
