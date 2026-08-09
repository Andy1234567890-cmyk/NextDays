// Gästekarte — Detail. Lädt den (maskierten) Gast + das Konto fürs Gating.
// Sub-Ressourcen werden client-seitig je Tab nachgeladen.
import { notFound } from "next/navigation";

import { GuestDetail } from "@/components/gaeste/guest-detail";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getAccount } from "@/lib/account";
import { guestAccessFor } from "@/lib/guests-access";
import { getGuest } from "@/lib/guests";

export const dynamic = "force-dynamic";

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [res, acc] = await Promise.all([getGuest(id), getAccount()]);
  if (!res.ok) notFound();
  const access = acc.ok
    ? guestAccessFor(acc.data.role, acc.data.permissions)
    : guestAccessFor(null, []);
  return (
    <>
      {/* guests ist fuer authenticated bewusst gesperrt (Wurzel 6, Migration
          0336) — ein Abo darauf waere eine stumme Attrappe. Ersatz ist
          reservations, gefiltert auf DIESEN Gast: recompute_guest_aggregates()
          schreibt Aufenthalte/Umsatz/letzten Aufenthalt nach jedem Anlegen und
          Stornieren einer Reservierung in die guests-Zeile zurueck, dasselbe
          Ereignis erzeugt also beide Aenderungen.
          Der Filter wechselt bewusst von id=eq. auf guest_id=eq. — es ist eine
          andere Tabelle, id waere hier die Reservierungs-ID und der Filter
          damit still wirkungslos.
          EHRLICH DAZU: eine reine Stammdaten-Aenderung (Name/Adresse) beruehrt
          keine Reservierung und erscheint nicht mehr von selbst; sie geschieht
          in dieser Oberflaeche, die danach neu laedt. */}
      <RealtimeRefresh tables={["reservations"]} filter={`guest_id=eq.${id}`} />
      <GuestDetail guest={res.data} access={access} />
    </>
  );
}
