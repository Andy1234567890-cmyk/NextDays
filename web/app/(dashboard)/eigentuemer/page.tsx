// Eigentümer-Übersicht (Agentur verwaltet Objekte für fremde Eigentümer).
// Server Component — lädt die Liste, rendert sie als Client-Komponente mit
// Anlage-Dialog.
import { notFound } from "next/navigation";

import { OwnersList } from "@/components/eigentuemer/owners-list";
import { getMe } from "@/lib/auth";
import { getFreeProperties, listOwners } from "@/lib/owners";

// Ohne Realtime-Quelle (siehe Kommentar unten) ist `router.refresh()` nach
// eigener Aktion der einzige Weg, die Liste zu erneuern. Das wirkt nur, wenn
// die Seite bei jeder Anfrage wirklich neu gerendert wird — wie auf den
// Schwesterseiten `reisebueros` und `gaeste`.
export const dynamic = "force-dynamic";

export default async function EigentuemerPage() {
  // Die freien Objekte gleich mitladen: sie füllen die Mehrfachauswahl im
  // Anlege-Dialog. Beim Öffnen des Dialogs erst zu laden hieße, den Betreiber
  // vor eine leere Liste zu setzen, die sich einen Moment später füllt.
  const [res, me, freieRes] = await Promise.all([
    listOwners(),
    getMe(),
    getFreeProperties(),
  ]);
  // Fehlende Berechtigung (manage_owners) → Seite existiert für diesen Nutzer
  // nicht (Sidebar-Gate + Rollen-Whitelist, Wurzel 3), kein 403-Fehlerkasten.
  if (!res.ok && res.status === 403) notFound();
  // Schreib-Aktionen (Löschen) nur mit manage_owners. Reine UX — der echte
  // Schutz sitzt im Backend (owners-Router ist MANAGE_OWNERS-geschützt).
  const canManage = me?.capabilities.includes("manage_owners") ?? false;
  return (
    <>
      {/* Kein Realtime mehr: `owners` und `owner_properties` sind für
        authenticated bewusst gesperrt (Wurzel 6, Migration 0337: revoke +
        raus aus supabase_realtime), ein Abo darauf wäre eine stumme Attrappe.
        Eine offene Tabelle, die dieselben Ereignisse trägt, gibt es nicht —
        weder Stammdaten noch Objekt-Zuweisungen (property_count,
        commission_min/max aus service.py) bilden sich in `reservations` ab.
        Ehrlich benannt: Änderungen eines ZWEITEN Nutzers erscheinen erst beim
        nächsten Laden der Seite. Der eigene Aktions-Pfad hing bisher
        fälschlich an einem Abo, das es hier nie gab (die Karte blieb nach dem
        Löschen stehen) — er lädt jetzt selbst nach: `router.refresh()` in
        `DeleteOwnerDialog` bzw. `OwnerDetail.remove`. */}
      <OwnersList
        initial={res.ok ? res.data.items : []}
        loadError={res.ok ? null : res.error}
        // Kein `?? []` als Notnagel: ein Ladefehler wird als Fehler
        // durchgereicht und im Dialog benannt. Eine leere Liste wäre die
        // Aussage „alle Objekte sind vergeben" — eine andere Tatsache.
        freieObjekte={freieRes.ok ? freieRes.data.items : []}
        freieObjekteError={freieRes.ok ? null : freieRes.error}
        canManage={canManage}
      />
    </>
  );
}
