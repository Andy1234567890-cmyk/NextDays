"""Darf ein Objekt an die Buchungsportale übertragen werden?

EINE Wahrheit für alle Slices, die Content nach Channex schieben (Objekte,
Zimmer, Preise). Vorher gab es diese Frage nirgends — jeder Sync-Anstoß ging
bedingungslos raus, und damit auch jeder Entwurf.

Warum das ein Fehler war, live am 07.08.2026 an „FeWo Stjerneskud": bei uns um
03:56 als Entwurf angelegt, um 04:09 stand die Channex-Property samt Zimmertyp
und Rate, um 04:10 hing sie am Airbnb-Kanal. Channex zählte 20 Objekte, wo der
Betrieb 18 verbundene kannte. Ein Entwurf ist eine interne Notiz; ihn bei den
Portalen anzumelden ist eine Aussage nach außen, die niemand getroffen hat.

Dazu kam ein Dauerschaden: ein Entwurf hat keinen Preisplan, `sync_content`
schlägt dafür fail-closed mit 422 fehl, die Map-Zeile geht auf `error`, und der
Heil-Tick reiht den Job stündlich neu ein — für ein Objekt, das nie rausgehen
sollte.

Bewusst NICHT hier eingehängt ist die Airbnb-Übernahme
(`channel_manager/airbnb_uebernahme.py`, `_registrierung_nachholen`): sie meldet
ihre Entwürfe absichtlich bei Channex an, weil erst die Channex-Property das
Ziel ist, auf das die bereits bestehende Airbnb-Anzeige gemappt werden kann.
Dort entsteht nur die Property, kein Zimmertyp und keine Rate — verkauft wird
also nichts. Diese Objekte sind danach registriert und fallen deshalb unten
durch die zweite Bedingung von selbst wieder in die Freigabe.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover — nur für die Typprüfung
    from supabase import Client

# public.property_status (0003). Bewusst als Festwert und nicht über den Import
# des Properties-Schemas: dieses Modul wird auch vom Rates-Slice benutzt, und
# ein Slice-übergreifender Import nur für eine Zeichenkette wäre eine Kopplung
# ohne Gegenwert.
_ENTWURF = "draft"


def darf_zu_den_portalen(db: Client, tenant_id: str, property_id: str) -> bool:
    """Darf dieses Objekt an die Portale übertragen werden?

    Ja, sobald es einmal veröffentlicht wurde — erkennbar entweder am Status
    (`active`/`inactive`) oder an einer bestehenden Portal-Registrierung.

    Die zweite Bedingung ist nötig, weil `inactive` „vorübergehend aus dem
    Verkauf" heißt, nicht „nie dagewesen": ein solches Objekt steht bei den
    Portalen und muss weiter gepflegte Inhalte bekommen. Und ein aus Airbnb
    übernommenes Objekt bleibt formal `draft`, ist aber registriert — sein
    Content muss fließen, sonst käme eine Beschreibungsänderung dort nie an.

    Fehlt die Zeile (Objekt gelöscht, fremder Betrieb), ist die Antwort NEIN —
    fail-closed: lieber nichts übertragen als das Falsche (Wurzel 5).
    """
    zeile = (
        db.table("properties")
        .select("status")
        .eq("tenant_id", tenant_id)
        .eq("id", property_id)
        .limit(1)
        .execute()
    ).data
    if not zeile:
        return False
    if zeile[0].get("status") != _ENTWURF:
        return True
    registriert = (
        db.table("channex_property_map")
        .select("channex_property_id")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    ).data
    return bool(registriert)
