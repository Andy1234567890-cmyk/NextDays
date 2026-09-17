"""Buchungsberechtigungen — wer darf bei diesem Betrieb SOFORT buchen.

Airbnb-Modell (Hilfe-Artikel 484 · 1170 · 1237 sowie Airbnbs eigene API-
Kategorie `instant_booking_allowed_category`, siehe Migration 0718):

    Anfrage                         jede Buchung geht über den Gastgeber
    Sofortbuchung · alle            niemand wird geprüft
    Sofortbuchung · Identität       nur Gäste mit geprüftem Ausweis
    Sofortbuchung · Vorgeschichte   nur Gäste mit abgeschlossenem Aufenthalt
                                    und ohne negative Bewertung
    Sofortbuchung · beides          beide Bedingungen

DER WICHTIGSTE SATZ DARAN: Wer eine Voraussetzung nicht erfüllt, wird NICHT
abgewiesen — seine Buchung wird zu einer ANFRAGE. Airbnb: „guests who do not
meet the requirements will not be able to book instantly, but they can still
send a booking request." Das ist der Unterschied zu `blocked_guests`, wo
wirklich gesperrt wird. Eine Voraussetzung, die Gäste aussperrt statt sie
umzuleiten, kostet den Betrieb Umsatz, den er nie zu Gesicht bekommt.

Die Prüfung läuft über alle Betriebe hinweg: eine Vorgeschichte entsteht nicht
beim einzelnen Gastgeber. Gelesen wird ausschließlich hier, serverseitig, mit
service_role — der Gast erfährt nie, was über ihn vorliegt, und der Gastgeber
bekommt kein Dossier, sondern nur das Ergebnis „sofort oder Anfrage"
(Wurzel 9: keine Daten an Rollen, die sie nicht brauchen).
"""
from __future__ import annotations

from datetime import date

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import escape_like

from .schemas import (
    Buchungsberechtigung,
    BuchungsberechtigungUpdate,
    Buchungsmodus,
    Zielgruppe,
)

log = get_logger("nextdays.booking_access")

# Ab wann eine Bewertung des Gastgebers über den Gast als negativ gilt.
# Airbnb nennt keine Zahl („haven't received any negative reviews"). Bei einer
# Skala von 1 bis 5 sind 1 und 2 die Hälfte unterhalb der Mitte — 3 ist
# ausdrücklich keine Beschwerde und darf niemanden aussperren.
_NEGATIV_BIS = 2

# Wie viele Objekte höchstens einzeln verglichen werden, bevor die Zahl der
# abweichenden über eine Zählung statt über die Liste ermittelt wird. Ohne
# Grenze lädt ein Betrieb mit 5000 Objekten sie alle in den Speicher
# (Wurzel 8).
_VERGLEICH_MAX = 2000

# Zielgruppen, die eine geprüfte Identität verlangen.
_BRAUCHT_IDENTITAET = {
    Zielgruppe.guests_with_verified_identity.value,
    Zielgruppe.well_reviewed_guests_with_verified_identity.value,
}
# Zielgruppen, die eine gute Vorgeschichte verlangen.
_BRAUCHT_VORGESCHICHTE = {
    Zielgruppe.well_reviewed_guests.value,
    Zielgruppe.well_reviewed_guests_with_verified_identity.value,
}

# Ein Aufenthalt zählt als abgeschlossen, wenn er stattgefunden hat. Abgesagte,
# abgelehnte und abgelaufene Anfragen zählen NICHT — sonst genügte eine
# stornierte Buchung als Vorgeschichte.
_GEZAEHLTE_STATUS = ("confirmed", "completed")


class BookingAccessError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class BookingAccessService:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Entscheidung des Betriebs ------------------------------------------

    def einstellung(self, ctx: AuthContext) -> Buchungsberechtigung:
        """Die Entscheidung des Betriebs plus der tatsächliche Objektstand."""
        tenant_id = self._tenant(ctx)
        rows = (
            self._db.table("tenants")
            .select("booking_mode, instant_booking_audience")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise BookingAccessError("Betrieb nicht gefunden.", status_code=404)
        modus = Buchungsmodus(rows[0]["booking_mode"])
        zielgruppe = Zielgruppe(rows[0]["instant_booking_audience"])
        gesamt, abweichend = self._objektstand(tenant_id, modus, zielgruppe)
        return Buchungsberechtigung(
            modus=modus,
            zielgruppe=zielgruppe,
            objekte_gesamt=gesamt,
            objekte_abweichend=abweichend,
        )

    def setzen(
        self, ctx: AuthContext, req: BuchungsberechtigungUpdate
    ) -> Buchungsberechtigung:
        """Entscheidung setzen — am Betrieb UND an allen seinen Objekten.

        Beides, weil der Betriebswert die Vorgabe für NEUE Objekte ist und die
        Objektspalte für die einzelne Buchung gilt. Nur eines von beidem zu
        schreiben hieße: die Seite zeigt eine Entscheidung, die entweder für
        den Bestand oder für alles Künftige nicht gilt (Wurzel 1).
        """
        tenant_id = self._tenant(ctx)
        werte = {
            "booking_mode": req.modus.value,
            "instant_booking_audience": req.zielgruppe.value,
        }
        # Zuerst der Betrieb: bricht der Objekt-Schreibvorgang ab, steht die
        # Vorgabe wenigstens fest und ein erneuter Aufruf zieht die Objekte nach
        # (der Aufruf ist idempotent — er setzt Werte, er verändert nichts
        # relativ zum Vorzustand).
        self._db.table("tenants").update(werte).eq("id", tenant_id).execute()
        self._db.table("properties").update(werte).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "buchungsberechtigung_gesetzt",
            tenant_id=tenant_id,
            modus=req.modus.value,
            zielgruppe=req.zielgruppe.value,
        )
        gesamt, abweichend = self._objektstand(tenant_id, req.modus, req.zielgruppe)
        return Buchungsberechtigung(
            modus=req.modus,
            zielgruppe=req.zielgruppe,
            objekte_gesamt=gesamt,
            objekte_abweichend=abweichend,
        )

    # -- Durchsetzung (von der Buchungsstrecke genutzt) ---------------------

    def sofortbuchung_erlaubt(
        self, *, booking_mode: str | None, zielgruppe: str | None, email: str
    ) -> bool:
        """Darf DIESE Adresse dieses Objekt sofort buchen?

        `False` heißt NICHT „abgelehnt", sondern „wird eine Anfrage".

        Fail-closed (Wurzel 5): ist die Zielgruppe unbekannt — etwa ein aus
        Airbnb importierter Wert, den wir noch nicht kennen —, gilt sie als
        nicht erfüllt. Eine unbekannte Einschränkung als „alle dürfen" zu
        lesen, wäre die gefährlichere Annahme: der Gastgeber hätte eine Hürde
        gesetzt und bekäme trotzdem ungeprüfte Sofortbuchungen.
        """
        if booking_mode == "request":
            return False
        if zielgruppe == Zielgruppe.everyone.value:
            return True
        if zielgruppe not in _BRAUCHT_IDENTITAET | _BRAUCHT_VORGESCHICHTE:
            log.warning("buchungszielgruppe_unbekannt", zielgruppe=str(zielgruppe))
            return False

        if zielgruppe in _BRAUCHT_IDENTITAET and not self._identitaet_geprueft(email):
            return False
        return not (
            zielgruppe in _BRAUCHT_VORGESCHICHTE
            and not self._gute_vorgeschichte(email)
        )

    # -- intern --------------------------------------------------------------

    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise BookingAccessError("Kein Betrieb im Kontext.", status_code=403)
        return ctx.tenant_id

    def _objektstand(
        self, tenant_id: str, modus: Buchungsmodus, zielgruppe: Zielgruppe
    ) -> tuple[int, int]:
        """Wie viele Objekte es gibt und wie viele davon anders eingestellt sind."""
        rows = (
            self._db.table("properties")
            .select("booking_mode, instant_booking_audience")
            .eq("tenant_id", tenant_id)
            .limit(_VERGLEICH_MAX)
            .execute()
        ).data or []
        abweichend = sum(
            1
            for r in rows
            if r.get("booking_mode") != modus.value
            # Die Zielgruppe zählt nur, wenn sie überhaupt etwas bedeutet —
            # bei „Anfrage" ist sie bedeutungslos, und ein Objekt deswegen als
            # abweichend zu melden, wäre eine Falschmeldung.
            or (
                modus is Buchungsmodus.instant
                and r.get("instant_booking_audience") != zielgruppe.value
            )
        )
        return len(rows), abweichend

    def _identitaet_geprueft(self, email: str) -> bool:
        """Hat der Gast eine abgeschlossene Ausweisprüfung?

        Kein Konto = nicht geprüft. Das ist kein Sonderfall, sondern der
        Normalfall der JWT-losen Buchungsstrecke: wer ohne Anmeldung bucht,
        hat nichts vorgelegt.
        """
        sauber = _norm(email)
        if not sauber:
            return False
        rows = (
            self._db.table("portal_guests")
            .select("identity_status")
            # escape_like: '_' ist ein ILIKE-Platzhalter und in Adressen
            # häufig — ohne Escaping träfe 'max_muster@x.de' auch
            # 'maxamuster@x.de', und ein fremder Prüfstand ginge als eigener
            # durch (Wurzel 8).
            .ilike("email", escape_like(sauber))
            .execute()
        ).data or []
        return any(r.get("identity_status") == "verified" for r in rows)

    def _gute_vorgeschichte(self, email: str) -> bool:
        """Airbnb: mindestens ein abgeschlossener Aufenthalt UND keine negative
        Bewertung. Beides muss stimmen — ein Gast ohne jede Historie ist nicht
        „gut bewertet", er ist unbekannt."""
        sauber = _norm(email)
        if not sauber:
            return False
        if self._hat_negative_bewertung(sauber):
            return False
        return self._hat_abgeschlossenen_aufenthalt(sauber)

    def _hat_negative_bewertung(self, email: str) -> bool:
        rows = (
            self._db.table("guest_reviews_by_host")
            .select("rating")
            .ilike("guest_email", escape_like(email))
            # Nur veröffentlichte: ein Entwurf ist noch keine Aussage.
            .not_.is_("published_at", "null")
            .lte("rating", _NEGATIV_BIS)
            .limit(1)
            .execute()
        ).data or []
        return bool(rows)

    def _hat_abgeschlossenen_aufenthalt(self, email: str) -> bool:
        rows = (
            self._db.table("reservations")
            .select("id")
            .ilike("guest_email", escape_like(email))
            .in_("status", list(_GEZAEHLTE_STATUS))
            # Abgereist. Eine laufende oder künftige Buchung ist noch kein
            # abgeschlossener Aufenthalt.
            .lte("check_out", date.today().isoformat())
            .limit(1)
            .execute()
        ).data or []
        return bool(rows)


def _norm(wert: str | None) -> str:
    return (wert or "").strip().lower()
