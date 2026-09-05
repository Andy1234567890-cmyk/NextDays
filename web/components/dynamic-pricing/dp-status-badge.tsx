// Status-Etikett der Objektseite (Hostaway: „SUBSCRIBED – PRICES NOT SYNCED").
// Server-tauglich, ohne Zustand: die Seite kennt die Werte aus der Übersicht
// und rendert nach jeder Aktion (router.refresh) neu.
//
// „NICHT GESENDET" gibt es nur mit FREIGABEPFLICHT — dort wartet der Preis
// auf den Betrieb. Im Sofort-Modus ist ein ungestempelter Tag kein Auftrag an
// den Nutzer, sondern Arbeit der Automatik; das Etikett sagt das. Vorher
// stand „AKTIV – 366 TAGE NICHT GESENDET" samt Sende-Knopf, während der
// Betrieb die Freigabe gerade abgeschaltet hatte (05.09.2026).
export function DpStatusBadge({
  enabled,
  offen,
  freigabeNoetig,
}: {
  enabled: boolean;
  offen: number;
  freigabeNoetig: boolean;
}) {
  if (!enabled) {
    return (
      <span className="w-fit rounded-(--radius) bg-secondary px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Dynamic Pricing aus
      </span>
    );
  }
  if (freigabeNoetig && offen > 0) {
    return (
      <span className="w-fit rounded-(--radius) bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Aktiv – {offen} {offen === 1 ? "Tag wartet" : "Tage warten"} auf Freigabe
      </span>
    );
  }
  if (!freigabeNoetig && offen > 0) {
    return (
      <span className="w-fit rounded-(--radius) bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        Aktiv – Preise gehen automatisch raus · {offen} {offen === 1 ? "Tag" : "Tage"} in Arbeit
      </span>
    );
  }
  return (
    <span className="w-fit rounded-(--radius) bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      Aktiv – Preise gesendet
    </span>
  );
}
