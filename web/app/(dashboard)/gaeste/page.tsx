// Gästekarte — Liste. Server Component lädt die (maskierten) Gäste + das Konto
// (für das Berechtigungs-Gating), Client-Teil rendert Suche/Filter/Tabelle.
import { GuestsList } from "@/components/gaeste/guests-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getAccount } from "@/lib/account";
import { guestAccessFor } from "@/lib/guests-access";
import { listGuests } from "@/lib/guests";

export const dynamic = "force-dynamic";

export default async function GaestePage() {
  // limit MUSS zu SEITENGROESSE in guests-list.tsx passen: die erste Seite
  // kommt von hier, alle weiteren aus der Client-Komponente. Verschiedene
  // Werte hiessen, dass beim Blaettern Zeilen doppelt oder gar nicht kaemen.
  const [res, acc] = await Promise.all([
    listGuests({ limit: 50, offset: 0 }),
    getAccount(),
  ]);
  const access = acc.ok
    ? guestAccessFor(acc.data.role, acc.data.permissions)
    : guestAccessFor(null, []);
  return (
    <>
      {/* guests ist fuer authenticated bewusst gesperrt (Wurzel 6, Migration
          0336): die Zeile traegt Name, Kontakt, Geburtsdatum und Umsatz, und
          der DB-Direktpfad umgeht die Rollen-Maskierung aus guest_masking.py.
          Ein Abo auf guests waere ab da eine stumme Attrappe.
          Ersatz ist reservations, und zwar KEIN stiller: die Kennzahlen dieser
          Liste (Aufenthalte, letzter Aufenthalt, Umsatz) werden von
          recompute_guest_aggregates() nach JEDEM Anlegen/Stornieren einer
          Reservierung in die guests-Zeile zurueckgeschrieben — dasselbe
          Ereignis erzeugt also beide Aenderungen.
          EHRLICH DAZU: eine reine Stammdaten-Pflege (Name/Adresse von Hand
          geaendert) beruehrt keine Reservierung und erscheint deshalb nicht
          mehr von selbst. Sie geschieht aber in dieser Oberflaeche, die danach
          ohnehin neu laedt. */}
      <RealtimeRefresh tables={["reservations"]} />
      <GuestsList
        guests={res.ok ? res.data.items : []}
        total={res.ok ? res.data.total : 0}
        error={res.ok ? null : res.error}
        access={access}
      />
    </>
  );
}
