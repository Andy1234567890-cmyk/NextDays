"""Profilbilder der Gäste vom Portal holen (0295).

DER IRRTUM, den dieses Modul auflöst (06.08.2026): Im Posteingang standen nur
Initialen-Kreise, und die Aussage lautete „Airbnb liefert kein Profilbild".
Geprüft worden waren aber nur zwei Endpunkte:

  * `v2/reservations` — Bildfelder: keine, `guest` ist ein leeres Objekt.
  * `v2/threads/{id}` — die Nutzer tragen nur `first_name`, `location`,
    `preferred_locale`, `role`; und zwar in ALLEN vier Formaten
    (`for_api_partners`, `for_api_partners_with_posts`, `for_mobile_thread`,
    `full`) — nachgemessen, nicht angenommen.

Das Bild steht woanders, nämlich an der NUTZER-Ressource. Live gemessen:

    GET v2/users/6776750
    {"user": {"first_name": "Nicolette", "id": "6776750",
              "picture_url":       "https://a0.muscache.com/im/pictures/user/…
                                    ?aki_policy=profile_x_medium",
              "picture_url_large": "…?aki_policy=profile_large"}}

Die Lehre daraus gehört zu Wurzel 4: „das Portal hat es nicht" ist erst dann
eine Tatsache, wenn die Ressource geprüft wurde, an der das Feld hingehört —
nicht, wenn zwei andere es nicht führen.

WOHER DIE NUTZER-ID KOMMT: aus der Reservierung (`guest_id`) oder aus dem
Thread (`users[]` mit `role == "GUEST"`). Der Weg über die Reservierung ist der
kürzere und braucht keinen zweiten Abruf.

WAS NICHT PASSIERT: Das Bild wird nicht heruntergeladen. Airbnb liefert es über
sein CDN mit stabilem Pfad je Nutzer; eine Kopie bei uns wäre ein zusätzlich
gespeichertes personenbezogenes Foto, das beim nächsten Profilwechsel veraltet.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Final

from supabase import Client

from .common import ChannelManagerError, log

# Airbnb bietet mehrere Größen an. Wir nehmen die große: die Oberfläche zeigt
# das Bild in verschiedenen Größen (Liste 32px, Kopfzeile 40px, Gästekarte
# größer), und ein hochskaliertes Miniaturbild sieht in der Gästekarte matschig
# aus. Reihenfolge = Verlässlichkeit, nicht Vorliebe.
_BILD_FELDER: Final = ("picture_url_large", "picture_url")

# Obergrenze je Lauf. Ohne sie würde ein Konto mit tausenden Gästen den Tick
# blockieren (Wurzel 8: jeder unbegrenzte Lauf bekommt eine harte Grenze).
_GRENZE_JE_LAUF: Final = 200


def bild_aus_nutzer(nutzer: dict[str, Any]) -> str | None:
    """Die Bild-URL aus einer Airbnb-Nutzer-Payload — None, wenn keine da ist.

    Kein Platzhalter, kein generiertes Avatar-Bild: ein Gast ohne Portalprofil
    hat keins, und die Oberfläche zeigt dann seine Initialen (Wurzel 4).
    """
    for feld in _BILD_FELDER:
        wert = nutzer.get(feld)
        if isinstance(wert, str) and wert.startswith("https://"):
            return wert
    return None


class AirbnbProfilbilderMixin:
    """Profilbilder nachziehen — als Teil des ChannelManagerService."""

    def airbnb_profilbild_lesen(self, token: str, nutzer_id: str) -> str | None:
        """Das Profilbild EINES Airbnb-Nutzers lesen (ein Aufruf)."""
        antwort = self._airbnb_get(  # type: ignore[attr-defined]
            token, f"v2/users/{nutzer_id}"
        )
        if not antwort:
            return None
        nutzer = antwort.get("user")
        return bild_aus_nutzer(nutzer) if isinstance(nutzer, dict) else None

    def profilbilder_heilen(self, grenze: int = _GRENZE_JE_LAUF) -> dict[str, int]:
        """Fehlende Gast-Profilbilder bei ALLEN Tenants nachtragen (Worker-Tick).

        Warum ein Dauerlauf und keine Einmal-Reparatur: Jeder neue Gast kommt
        ohne Bild herein — der Feed kennt die Nutzer-Ressource nicht. Ein
        Handlauf würde den Bestand einmal füllen, und ab der nächsten Buchung
        stünde wieder ein Initialen-Kreis da. Deshalb heilt das System sich
        selbst, genau wie beim Buchungszeitpunkt (0291/0292).

        Angefasst wird nur, was `avatar_url IS NULL` hat. Ein vorhandener Wert
        bleibt stehen — auch ein von Hand gesetzter.
        """
        db = self._require_db()  # type: ignore[attr-defined]
        offen = self._gaeste_ohne_bild(db, grenze)
        if not offen:
            return {"geprueft": 0, "gesetzt": 0}

        gesetzt = 0
        for tenant_id, zeilen in offen.items():
            try:
                gesetzt += self._bilder_eines_tenants(db, tenant_id, zeilen)
            except (ChannelManagerError, OSError) as exc:
                # Ein Konto ohne Token darf die anderen nicht aufhalten; der
                # nächste Tick versucht es erneut (Wurzel 5: spezifisch
                # gefangen, nicht blind).
                log.warning(
                    "profilbild_heilung_tenant_fehlgeschlagen",
                    tenant_id=tenant_id, error=str(exc)[:200],
                )
        anzahl = sum(len(z) for z in offen.values())
        log.info(
            "profilbilder_geheilt",
            geprueft=anzahl, gesetzt=gesetzt, tenants=len(offen),
        )
        return {"geprueft": anzahl, "gesetzt": gesetzt}

    @staticmethod
    def _gaeste_ohne_bild(
        db: Client, grenze: int
    ) -> dict[str, list[dict[str, Any]]]:
        """Gäste ohne Bild, die an einer Airbnb-Buchung hängen — nach Tenant.

        Der Weg führt über `channex_booking`, nicht über `guests`: nur dort
        steht, aus welchem Portal der Gast stammt und welche Nutzer-ID er dort
        trägt. Ein Gast aus einer Direktbuchung hat kein Portalprofil und darf
        gar nicht erst abgefragt werden.
        """
        zeilen = (
            db.table("channex_booking")
            .select("tenant_id, guest_id, ota_reservation_code")
            .eq("ota_name", "AirBNB")
            .not_.is_("guest_id", "null")
            .limit(grenze * 50)
            .execute()
        ).data or []
        if not zeilen:
            return {}

        # Nur Gäste ohne Bild. Ein Query statt einer Abfrage je Gast.
        gast_ids = list({str(z["guest_id"]) for z in zeilen if z.get("guest_id")})
        ohne_bild: set[str] = set()
        for start in range(0, len(gast_ids), 100):
            teil = gast_ids[start : start + 100]
            treffer = (
                db.table("guests")
                .select("id")
                .in_("id", teil)
                .is_("avatar_url", "null")
                .execute()
            ).data or []
            ohne_bild.update(str(g["id"]) for g in treffer)

        je_tenant: dict[str, list[dict[str, Any]]] = {}
        gesehen: set[str] = set()
        for zeile in zeilen:
            gid = str(zeile.get("guest_id") or "")
            tid = str(zeile.get("tenant_id") or "")
            if not gid or not tid or gid not in ohne_bild or gid in gesehen:
                continue
            # Die Grenze gilt JE TENANT, nicht global: eine globale Zählung
            # ließe einen Betrieb mit vielen offenen Gästen alle anderen
            # verdrängen — und die Verdrängten kämen bei jedem Tick erneut zu
            # spät (live passiert bei den Anreisezeiten: 13 von 23 gesetzt,
            # weil fremde Zeilen das Kontingent gefüllt hatten).
            if len(je_tenant.setdefault(tid, [])) >= grenze:
                continue
            gesehen.add(gid)
            je_tenant[tid].append(zeile)
        return je_tenant

    def _bilder_eines_tenants(
        self, db: Client, tenant_id: str, zeilen: list[dict[str, Any]]
    ) -> int:
        """Die offenen Bilder EINES Kontos holen und setzen."""
        zugang = self._airbnb_token(db, tenant_id)  # type: ignore[attr-defined]
        if not zugang:
            return 0
        token = zugang[0]

        # Die Nutzer-IDs in EINEM Durchgang holen: ein Abruf über den vollen
        # Bestandszeitraum liefert alle Reservierungen des Kontos samt
        # `guest_id`. Die Alternative wäre ein Abruf je Buchung — bei 22 offenen
        # Gästen 22 zusätzliche Rundreisen für dieselbe Auskunft.
        nutzer_je_code = self._nutzer_ids_des_kontos(token)

        gesetzt = 0
        for zeile in zeilen:
            code = str(zeile.get("ota_reservation_code") or "")
            nutzer_id = nutzer_je_code.get(code)
            if not nutzer_id:
                continue
            bild = self.airbnb_profilbild_lesen(token, nutzer_id)
            if not bild:
                continue
            (
                db.table("guests")
                .update({"avatar_url": bild})
                .eq("tenant_id", tenant_id)
                .eq("id", zeile["guest_id"])
                .is_("avatar_url", "null")
                .execute()
            )
            gesetzt += 1
        return gesetzt

    def _nutzer_ids_des_kontos(self, token: str) -> dict[str, str]:
        """Bestätigungscode → Airbnb-Nutzer-ID, für den ganzen Bestand.

        WARUM NICHT AUS UNSERER DB: Channex reicht die Airbnb-Nutzer-ID NICHT
        durch. Nachgemessen an einer Live-Zeile — `raw` enthält 30 Felder
        (`booking_id`, `customer`, `occupancy`, `rooms` …), aber keine Nutzer-ID;
        `customer` führt nur Name, Telefon und Sprache. Wer sie dort sucht,
        findet dauerhaft nichts und hält das für „das Portal hat kein Bild".

        Bei Airbnb selbst steht sie an der Reservierung (`guest_id`, live
        gemessen: 6776750 zu HMA4TWBXAC). Der Bestätigungscode ist die Klammer
        zwischen beiden Welten — derselbe Weg, über den auch die
        Buchungszeitpunkte geheilt werden.
        """
        heute = date.today()
        gelesen = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            token, listing_id="", von=date(heute.year - 6, 1, 1),
            bis=date(heute.year + 2, 12, 31), alle_listings=True,
        )
        ids: dict[str, str] = {}
        for buchung in gelesen.buchungen:
            code = str(buchung.get("confirmation_code") or "")
            nutzer = buchung.get("guest_id")
            if code and nutzer:
                ids[code] = str(nutzer)
        return ids
