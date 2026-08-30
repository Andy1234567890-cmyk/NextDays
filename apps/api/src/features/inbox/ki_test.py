"""Die Test-KI und das Kontext-Panel — sehen, was die KI weiß und täte.

ES WIRD NICHTS GESENDET. Der Test läuft gegen dieselbe Kette wie der Ernstfall
(Kontext → Regeln → Prompt → Vertex → Zustell-Entscheidung), nur ohne Versand,
und zeigt, was im Ernstfall passieren WÜRDE: welche Regel griff, welche
Zustellart, ob eine Sperre zuschlug.

Das ist die Debugging-Pflicht in Produktform. Ohne diese beiden Ansichten ist
eine falsche Antwort NICHT diagnostizierbar — man rät zwischen „ein Fakt
fehlte", „eine Regel griff nicht" und „das Modell hat sich etwas zurechtgelegt".
Ein Betrieb kann so vor dem Einschalten prüfen, ob seine Regeln greifen, statt
es am ersten echten Gast zu erfahren.
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.ki import KiError
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.site_config.ki_nutzung import buchen, deckel_pruefen

from .errors import InboxError
from .ki_antwort import FUNKTION, luecke_trennen, vorschlag_erzeugen
from .ki_kontext import MAX_KONTEXT_ZEICHEN, kontext_bauen
from .schemas import (
    InboxMessage,
    KiKontextAbschnitt,
    KiKontextAntwort,
    KiTestAntwort,
    KiTestFrage,
    ReservationDetail,
)

log = get_logger("nextdays.inbox.ki_test")

# Wurzel 8: der Testverlauf ist frei vom Client gefüllt.
MAX_TESTVERLAUF = 20
MAX_TESTFRAGE = 1_500


class KiTestMixin:
    """Test-KI und Kontext-Panel. Teil von `InboxService`."""

    _db: Client | None

    # -- Das Kontext-Panel ------------------------------------------------------
    def ki_kontext_ansehen(
        self,
        ctx: AuthContext,
        *,
        property_id: str | None,
        frage: str = "",
    ) -> KiKontextAntwort:
        """Was die KI zu diesem Objekt wüsste — die tatsächlichen Werte.

        `frage` steuert die Abschnittsauswahl der Gästemappe; ohne sie zeigt
        das Panel die Vorauswahl. Das ist gewollt: das Panel soll zeigen, was
        bei DIESER Frage im Prompt landet, nicht was theoretisch verfügbar wäre.
        """
        db, tenant_id = self._require(ctx)
        prop = self._eigenes_objekt(db, tenant_id, property_id) if property_id else None

        kontext = kontext_bauen(
            db,
            tenant_id,
            prop=prop,
            frage=frage,
            sprache=None,
            # Im Panel wird der bestätigte Fall gezeigt: der Betrieb will
            # sehen, was die KI einem BUCHENDEN Gast sagen kann. Die Sperre
            # bleibt sichtbar, weil `weggelassen` sie ohnehin ausweist, wenn
            # sie greift.
            status="confirmed",
            heute=datetime.now(UTC).date(),
        )
        return _als_antwort(kontext)

    # -- Die Test-KI ------------------------------------------------------------
    def ki_testen(self, ctx: AuthContext, req: KiTestFrage) -> KiTestAntwort:
        """Eine Testfrage stellen. Sendet NICHTS."""
        db, tenant_id = self._require(ctx)
        frage = (req.frage or "").strip()
        if not frage:
            raise InboxError("Bitte eine Frage eingeben.", status_code=422)

        prop = (
            self._eigenes_objekt(db, tenant_id, req.property_id)
            if req.property_id
            else None
        )
        einstellungen = self.get_ai_settings(ctx)
        regeln = self.regeln_fuer_thread(
            db, tenant_id, str(prop["id"]) if prop and prop.get("id") else None
        )

        # Eine Reservierung gibt es im Test nicht. Statt eine zu erfinden
        # (Wurzel 4) bekommt der Prompt eine LEERE — das Modell sieht dann
        # keine Buchungsdaten und sagt das auch, genau wie bei einer echten
        # Anfrage ohne Buchung.
        reservierung = ReservationDetail(status="confirmed")
        verlauf = _testverlauf(req.verlauf, frage)

        try:
            deckel_pruefen(db, tenant_id)
            vorschlag = vorschlag_erzeugen(
                db,
                tenant_id,
                prop=prop,
                verlauf=verlauf,
                reservierung=reservierung,
                einstellungen=einstellungen,
                regeln=regeln,
            )
        except KiError as exc:
            raise InboxError(exc.message, status_code=exc.status_code) from exc

        buchen(
            db,
            tenant_id,
            user_id=ctx.user_id if ctx.user_id != "cron" else None,
            funktion=FUNKTION,
            antwort=vorschlag.antwort,
        )

        zustellart, grund, regel = self.zustellart_entscheiden(
            regeln, frage, einstellungen.autoantwort_aktiv
        )
        text, luecke = luecke_trennen(vorschlag.text)

        log.info(
            "ki_test_ausgefuehrt",
            tenant_id=tenant_id,
            property_id=req.property_id,
            zustellart=zustellart,
            luecke=bool(luecke),
        )
        return KiTestAntwort(
            antwort=text,
            kontext=_als_antwort(vorschlag.kontext),
            zustellart=zustellart,
            grund=grund,
            regel_name=str(regel.get("name")) if regel else None,
            fehlende_angabe=luecke,
        )

    # -- Hilfen -----------------------------------------------------------------
    def _eigenes_objekt(
        self, db: Client, tenant_id: str, property_id: str | None
    ) -> dict | None:
        """Objektzeile MIT Tenant-Filter im selben Aufruf (Wurzel 3).

        Ein ungescopter Load mit nachträglichem Vergleich wäre hier besonders
        teuer: über den Testweg liesse sich sonst die Gästemappe eines fremden
        Betriebs samt Türcode auslesen."""
        if not property_id:
            return None
        zeilen = (
            db.table("properties")
            .select(
                "id, title, address, city, country, postal_code, description, "
                "amenities, max_guests, property_type, type_attributes"
            )
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            raise InboxError("Objekt nicht gefunden.", status_code=404)
        return zeilen[0]


def _testverlauf(bisher: list[str], frage: str) -> list[InboxMessage]:
    """Den Testverlauf in Nachrichten übersetzen.

    Abwechselnd Gast und Gastgeber, beginnend beim Gast — so ist der Verlauf im
    Ernstfall aufgebaut, und nur so beurteilt das Modell die letzte Nachricht
    als Gastfrage."""
    nachrichten: list[InboxMessage] = []
    for i, text in enumerate(bisher[:MAX_TESTVERLAUF]):
        nachrichten.append(
            InboxMessage(
                id=f"test{i}",
                sender="guest" if i % 2 == 0 else "property",
                message=(text or "")[:MAX_TESTFRAGE],
            )
        )
    nachrichten.append(
        InboxMessage(id="testfrage", sender="guest", message=frage[:MAX_TESTFRAGE])
    )
    return nachrichten


def _als_antwort(kontext) -> KiKontextAntwort:  # noqa: ANN001 — KiKontext
    """Den gesammelten Kontext für die Oberfläche aufbereiten.

    Titel UND Inhalt gehen mit: das Panel zeigt den TEXT, der in den Prompt
    geht, nicht eine Beschreibung davon. Eine Beschreibung wäre eine zweite
    Wahrheit neben dem Prompt und liefe auseinander."""
    abschnitte = [
        KiKontextAbschnitt(
            titel=titel,
            inhalt=inhalt,
            quelle=kontext.quellen[i] if i < len(kontext.quellen) else titel,
            zeichen=len(inhalt),
        )
        for i, (titel, inhalt) in enumerate(kontext.bloecke)
    ]
    return KiKontextAntwort(
        abschnitte=abschnitte,
        quellen=list(kontext.quellen),
        weggelassen=list(kontext.weggelassen),
        zugang_gesperrt=kontext.zugang_gesperrt,
        zeichen=kontext.zeichen,
        max_zeichen=MAX_KONTEXT_ZEICHEN,
    )
