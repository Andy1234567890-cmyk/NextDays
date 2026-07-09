// Sub-Layout der PM-Fläche: links die feste Modul-Navigation (Lodgify „PM-
// Module"-Look), rechts der jeweilige Seiteninhalt (Buchungen, Detail, …). Die
// Auth-Prüfung liegt bereits im übergeordneten (dashboard)/layout — hier nur die
// Anordnung. Auf schmalen Screens klappt die Nav über den Inhalt.
//
// Im Objekt-Detailbereich (/reservierungen/unterkuenfte/{id}/…) blendet der
// PmModuleShell die globale PM-Nav aus — dort zeigt das Objekt-Sub-Layout seine
// eigene 6-Reiter-Navigation (wie Lodgify), damit nicht zwei Navspalten
// nebeneinander stehen.
import { PmModuleShell } from "@/components/reservierungen/pm-module-shell";

export default function ReservierungenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PmModuleShell>{children}</PmModuleShell>;
}
