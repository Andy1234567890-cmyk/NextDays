"""Eigentümer-Seite des Chats mit der Verwaltung (0611, ADR-0029).

Die Gegenseite (Agentur) liest über den Posteingang (`inbox/eigentuemer.py`);
die gemeinsame Logik steht in `owner_chat.kern`. Hier steht nur, was
eigentümerspezifisch ist: der Objekt-Scope.

WURZEL 9 — der Scope ist an JEDER Stelle derselbe: Liste, Verlauf und Senden
prüfen alle gegen `_owned_property_ids`. Prüfte nur die Liste, käme ein
Eigentümer über eine geratene `thread_id` an das Gespräch eines fremden Hauses.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.owner_chat import kern, melden
from src.features.owner_chat.fehler import OwnerChatError

log = get_logger(__name__)


class PortalChatService:
    """Chat-Zugriffe des Eigentümer-Portals."""

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    @staticmethod
    def _require(ctx: AuthContext) -> tuple[str, str]:
        if not ctx.tenant_id or not ctx.user_id:
            raise OwnerChatError("Kein Tenant/Nutzer im Konto.", status_code=400)
        return ctx.tenant_id, ctx.user_id

    def _meine_objekte(self, ctx: AuthContext) -> list[str]:
        """Objekte dieses Eigentümers. Fail-closed: im Zweifel keine.

        Dieselbe Quelle wie der übrige Portal-Service
        (`owner_property_assignments`) — nicht `owner_properties`: die
        Zuordnungstabelle trägt die PORTAL-Sicht, inklusive der
        Familienmitglieder, die kein Eintrag in `owner_properties` sind.
        """
        tenant_id, user_id = self._require(ctx)
        zeilen = (
            self._db.table("owner_property_assignments")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        ).data or []
        return sorted({str(z["property_id"]) for z in zeilen})

    def _objekt_pruefen(self, ctx: AuthContext, property_id: str) -> str:
        """Gehört dieses Objekt dem Anfragenden? Sonst 404, nicht 403.

        404 statt 403, weil ein 403 die Existenz bestätigt — für jemanden, der
        IDs durchprobiert, wäre das eine Landkarte fremder Objekte (Wurzel 9).
        """
        if property_id not in self._meine_objekte(ctx):
            raise OwnerChatError("Objekt nicht gefunden.", status_code=404)
        return property_id

    def _thread_pruefen(self, ctx: AuthContext, thread_id: str) -> dict:
        """Faden laden UND scopen in einem Schritt (Wurzel 3)."""
        tenant_id, _ = self._require(ctx)
        zeilen = (
            self._db.table("owner_threads")
            .select("id, property_id")
            .eq("id", thread_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            raise OwnerChatError("Gespräch nicht gefunden.", status_code=404)
        faden = zeilen[0]
        self._objekt_pruefen(ctx, str(faden["property_id"]))
        return faden

    # --- Lesen ---------------------------------------------------------------

    def faeden(self, ctx: AuthContext) -> list[dict]:
        """Alle Gespräche des Eigentümers, je Objekt eins."""
        tenant_id, _ = self._require(ctx)
        objekte = self._meine_objekte(ctx)
        zeilen = kern.faeden_zu_objekten(self._db, tenant_id, objekte)

        titel = self._objekt_titel(objekte)
        # Objekte OHNE Faden gehören in die Liste: sonst gäbe es für ein Haus,
        # über das noch nie gesprochen wurde, keinen Weg, ein Gespräch zu
        # beginnen — der Eigentümer sähe eine leere Seite ohne Knopf.
        mit_faden = {str(z["property_id"]) for z in zeilen}
        out = [
            {
                "thread_id": str(z["id"]),
                "property_id": str(z["property_id"]),
                "property_title": titel.get(str(z["property_id"])),
                "last_message_at": z.get("last_message_at"),
                "ungelesen": self._ungelesen(z),
            }
            for z in zeilen
        ]
        out.extend(
            {
                "thread_id": "",
                "property_id": pid,
                "property_title": titel.get(pid),
                "last_message_at": None,
                "ungelesen": False,
            }
            for pid in objekte
            if pid not in mit_faden
        )
        return out

    @staticmethod
    def _ungelesen(zeile: dict) -> bool:
        """Gibt es Neues seit dem letzten Blick des Eigentümers?"""
        letzte = zeile.get("last_message_at")
        if not letzte:
            return False
        gelesen = zeile.get("owner_read_at")
        return not gelesen or str(letzte) > str(gelesen)

    def _objekt_titel(self, property_ids: list[str]) -> dict[str, str]:
        if not property_ids:
            return {}
        zeilen = (
            self._db.table("properties")
            .select("id, title")
            .in_("id", property_ids)
            .execute()
        ).data or []
        return {str(z["id"]): str(z.get("title") or "") for z in zeilen}

    def verlauf(
        self, ctx: AuthContext, thread_id: str, *, device_id: str | None
    ) -> dict:
        tenant_id, user_id = self._require(ctx)
        faden = self._thread_pruefen(ctx, thread_id)
        zeilen, nicht_lesbar = kern.verlauf_lesen(
            self._db,
            tenant_id,
            thread_id,
            # Nur das EIGENE Gerät (Wurzel 9) — ein fremdes gäbe Krypto-Material
            # heraus, das diesem Nutzer nicht gehört.
            device_id=kern.eigenes_geraet(self._db, tenant_id, user_id, device_id),
        )
        kern.gelesen_setzen(self._db, tenant_id, thread_id, seite="owner")
        pid = str(faden["property_id"])
        return {
            "thread_id": thread_id,
            "property_id": pid,
            "property_title": self._objekt_titel([pid]).get(pid),
            "items": zeilen,
            "nicht_lesbar": nicht_lesbar,
        }

    def empfaenger(self, ctx: AuthContext, property_id: str) -> list[dict]:
        """Geräte, für die der Eigentümer verschlüsseln muss."""
        tenant_id, _ = self._require(ctx)
        self._objekt_pruefen(ctx, property_id)
        return kern.empfaenger_geraete(self._db, tenant_id, property_id)

    # --- Schreiben -----------------------------------------------------------

    def senden(
        self,
        ctx: AuthContext,
        property_id: str,
        *,
        chiffre: str,
        schluessel: dict[str, str],
        bilder: list[str],
        sender_key: str,
    ) -> dict:
        """Nachricht des Eigentümers ablegen.

        Der Empfängerkreis wird HIER neu ermittelt, nicht vom Client
        übernommen (Wurzel 3). Hat sich zwischen dem Abholen der Schlüssel und
        dem Senden ein Gerät hinzugesellt, fehlt dessen Schlüssel — dann 409
        statt einer Nachricht, die ein Empfänger nie öffnen kann.
        """
        tenant_id, user_id = self._require(ctx)
        self._objekt_pruefen(ctx, property_id)
        geraete = kern.empfaenger_geraete(self._db, tenant_id, property_id)
        thread_id = kern.thread_holen_oder_anlegen(self._db, tenant_id, property_id)
        name = self._eigener_name(tenant_id, user_id)
        zeile = kern.nachricht_ablegen(
            self._db,
            tenant_id,
            thread_id,
            seite="owner",
            user_id=user_id,
            sender_name=name,
            chiffre=chiffre,
            schluessel=schluessel,
            geraete=geraete,
            bilder=bilder,
            sender_key=sender_key,
        )
        # NACH dem Ablegen (Wurzel 5): die Meldung ist best effort und darf das
        # Senden nicht kippen — die Nachricht liegt bereits.
        melden.neue_nachricht_melden(
            self._db,
            tenant_id,
            property_id=property_id,
            thread_id=thread_id,
            message_id=str(zeile["id"]),
            seite="owner",
            absender_name=name,
            absender_user_id=user_id,
        )
        return zeile

    def _eigener_name(self, tenant_id: str, user_id: str) -> str:
        """Anzeigename des Absenders, eingefroren an der Nachricht.

        Bei der Familienfreigabe schreiben mehrere Menschen in denselben Faden
        — ohne den Namen stünde dort „der Eigentümer", und die Agentur wüsste
        nicht, mit wem sie es zu tun hat.
        """
        zeilen = (
            self._db.table("users")
            .select("full_name, email")
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            # Ein Konto ohne Zeile darf nicht zu einer Nachricht ohne Absender
            # führen (`sender_name` ist NOT NULL) — und ein erfundener Name
            # wäre eine Falschaussage (Wurzel 4).
            raise OwnerChatError("Konto nicht gefunden.", status_code=403)
        # KEIN Rückfall auf die E-Mail (Wurzel 9: kein `email` an Rollen, die es
        # nicht brauchen). Sonst stünde die dienstliche Adresse des Mitarbeiters
        # beim Eigentümer im Verlauf — eingefroren, für immer. Umgekehrt sähe die
        # Agentur die private Adresse eines Familienmitglieds.
        return str(zeilen[0].get("full_name") or "").strip() or "—"
