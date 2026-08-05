"""Zimmer aus UNSERER Maske zurück an Airbnb (Gegenrichtung zum Import).

WARUM DIESES MODUL EXISTIERT — live gemessen am Beta-Betrieb (05.08.2026,
„Holiday house Cornflower", Listing 1675950565421151420):

  * Der Betrieb löschte in unserer Maske den Balkon. Unsere DB: 7 Zimmer, kein
    Balkon. Airbnb: 9 Räume, `balcony` (ID 792924440) weiter online.
  * Danach fügte er ihn über unsere Maske wieder hinzu. Unsere DB: `balkon`
    geschrieben um 14:44:47. Airbnb: unverändert 8 Räume, kein `balcony`.

Beide Richtungen kamen nie an, und zwar OHNE Fehlermeldung: `delete_room`/
`create_room` riefen `_content_sync_anstossen`, und dessen eigener Docstring hält
fest, dass Channex von der Zimmerstruktur nichts annimmt. Es wurde also nie
etwas versucht — der klassische Wurzel-1-Fehler: eine Aktion ohne Gegenzustand
nach außen. Der Import (`airbnb_objekt_abruf._zimmer_zeilen_anlegen`) war die
Einbahnstraße Airbnb → wir.

DER WEG DORTHIN steht in Airbnbs „Airbnb Connection API"
(`docs/OTA/Airbnb/Airbnb Connection API.pdf`, S. 10, „Execute API Proxy
request"): `POST channels/{id}/action/api_proxy` mit `method: PUT|POST|GET|
DELETE`. Ein eigener Raum-Endpunkt ist bei Channex NICHT dokumentiert — die
Räume erscheinen dort nur lesend in `action/listing_details`. Der Proxy ist ein
echter Durchgriff und nicht die 200-Attrappe des `execute`-Namensraums:
`listing_rooms` liefert lesend die Räume, ein erfundener Endpunkt antwortet
422 `route_not_found` (kontrolliert gemessen).

OFFENE LÜCKE (bewusst, nicht vergessen): Airbnbs Auswahlliste hat 40 Raumarten
(„Choose a room or space", 05.08.2026 abgelesen), unsere `ZIMMER_SLUGS` haben 12.
Nicht abbildbar sind u.a. `garage`, `gym`, `pool`, `hot_tub`, `library`,
`kitchenette`, `porch`, `rooftop`, `courtyard`, `front_yard`, `wine_cellar`,
`movie_theater`, `workshop`. Kommt ein solcher Raum aus Airbnb, protokolliert ihn
der Import als `airbnb_raumart_unbekannt` und lässt ihn liegen; dieser Push löscht
ihn NICHT (siehe `_ist_stand`). Die Liste zu erweitern ist eine Produkt-
Entscheidung samt Labels in 24 Sprachen — sie gehört nicht in diesen Push.

WAS HIER BEWUSST NICHT PASSIERT:
  * Kein Bett wird geschrieben. Betten hängen bei uns am OBJEKT
    (`type_attributes.beds`, 0251), nicht am Zimmer — ein Bett je Raum wäre
    erfunden (Wurzel 4).
  * Kein Raum, den Airbnb führt und unsere Liste nicht kennt, wird gelöscht.
    `exterior`, `garden`, `sunroom`, `common_spaces` überspringt schon der Import
    bewusst (sie haben keinen Slug). Wer sie hier löschte, würde dem Gastgeber
    Räume aus der Anzeige nehmen, die er in unserer Maske nie sehen konnte.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.supabase import load_scoped

from .airbnb_listing_import import _RAUM_UEBERSPRINGEN, AIRBNB_RAUM_AUF_SLUG
from .channex_client import ChannexError
from .common import ChannelManagerError, log

# Unser Slug → DER Airbnb-Raumtyp, der beim Anlegen gesendet wird.
#
# Die Import-Tabelle ist mehrdeutig (drei Airbnb-Arten führen auf `terrasse`,
# zwei auf `badezimmer`, zwei auf `wc`, zwei auf `arbeitszimmer`), also braucht
# die Rückrichtung eine EIGENE, eindeutige Zuordnung — sie lässt sich nicht
# maschinell umkehren.
#
# Die Auswahl ist nicht geraten, sondern nach der Häufigkeit im echten Konto
# entschieden (`GET v2/listing_rooms` über alle 18 Anzeigen, 05.08.2026, 157
# Räume): bedroom 47, full_bathroom 25, living_room 20, dining_room 18,
# kitchen 17, laundry_room 10, patio 7, deck 5, game_room 1, workspace 1.
# `terrasse` geht deshalb als `patio` (7×) und nicht als `deck` (5×) oder
# `terrace` (0×) hinaus.
#
# `balkon` und `schlafbereich` kommen im Konto nicht vor; ihre Airbnb-Namen
# stehen in der Import-Tabelle, die aus Airbnbs Vokabular stammt — und genau
# `balcony` war der Raum, dessen Löschung der Betrieb vermisst hat.
#
# ACHTUNG — DIE WERTE HIER SIND API-WERTE, NICHT DIE UI-LABELS. Airbnbs
# Extranet-Auswahlliste („Choose a room or space") zeigt ANDERE Bezeichnungen als
# die API für DIESELBEN Räume liefert. An Cornflower gegenübergestellt
# (05.08.2026, dieselben Raum-IDs):
#
#     UI-Label          API-`room_type`     Raum-ID
#     Dining area   →   dining_room         792924437
#     Full kitchen  →   kitchen             792924438
#     Living room   →   living_room         792924439
#     Full bathroom →   full_bathroom       792022808
#
# Wer diese Tabelle nach der UI-Liste „korrigiert" (`dining_area`,
# `full_kitchen`, `laundry_area`), schickt Werte, die der Import nicht
# zurücklesen kann — der nächste Abgleich hielte den Raum dann für unbekannt und
# legte ihn erneut an. Maßgeblich ist die API, weil über sie geschrieben wird.
# `laundry_room` ist ebenfalls ein API-Messwert (10× im Konto), nicht das
# UI-Label „Laundry area".
SLUG_AUF_AIRBNB_RAUM: dict[str, str] = {
    "schlafzimmer": "bedroom",
    "badezimmer": "full_bathroom",
    "wc": "half_bathroom",
    "wohnzimmer": "living_room",
    "esszimmer": "dining_room",
    "kueche": "kitchen",
    "terrasse": "patio",
    "balkon": "balcony",
    "arbeitszimmer": "workspace",
    "spielzimmer": "game_room",
    "hauswirtschaftsraum": "laundry_room",
    # `schlafbereich` steht hier BEWUSST NICHT: `sleeping_area` ist in keiner der
    # beiden Quellen belegt — 0× in der API-Messung über alle 18 Anzeigen UND
    # nicht in Airbnbs Auswahlliste (40 Einträge, 05.08.2026). Der Wert stand nur
    # in unserer Import-Tabelle, wo ein nie eintreffender Eintrag harmlos ist;
    # als SENDE-Wert wäre er geraten (Wurzel 4). Ein Schlafbereich bleibt damit
    # lokal, und `zimmer_diff` protokolliert ihn als
    # `airbnb_zimmer_ohne_entsprechung` statt still zu verschwinden.
}

# Höchstzahl der Räume, die EIN Abgleich anfasst. Ein Objekt hat real bis zu 15
# Räume (gemessenes Maximum: 12); alles darüber ist ein Fehler in unseren Daten
# und kein Grund, hundert Fremdaufrufe abzufeuern (Wurzel 8 — jeder unbegrenzte
# Lauf bekommt eine harte Grenze).
_MAX_AENDERUNGEN = 30


def _ist_stand(raeume: list[dict[str, Any]]) -> dict[str, list[str]]:
    """Airbnbs Räume → `{slug: [raum_id, …]}`, nur was unsere Liste kennt.

    Räume ohne Slug (`exterior`, `garden`, …) bleiben absichtlich draußen: sie
    tauchen in unserer Maske nicht auf, dürfen also auch nicht von ihr entfernt
    werden.
    """
    ergebnis: dict[str, list[str]] = {}
    for raum in raeume:
        art = str(raum.get("room_type") or "").strip()
        raum_id = str(raum.get("id") or "").strip()
        if not art or not raum_id or art in _RAUM_UEBERSPRINGEN:
            continue
        slug = AIRBNB_RAUM_AUF_SLUG.get(art)
        if not slug:
            continue
        ergebnis.setdefault(slug, []).append(raum_id)
    return ergebnis


def _soll_stand(db: Client, tenant_id: str, property_id: str) -> dict[str, int]:
    """Unsere Zimmer → `{slug: anzahl}`. Eine Zeile = ein Zimmer (0246/0251)."""
    zeilen = (
        db.table("property_rooms")
        .select("raum_typ")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .execute()
    ).data or []
    soll: dict[str, int] = {}
    for zeile in zeilen:
        slug = str(zeile.get("raum_typ") or "").strip()
        if slug:
            soll[slug] = soll.get(slug, 0) + 1
    return soll


def zimmer_diff(
    soll: dict[str, int], ist: dict[str, list[str]]
) -> tuple[list[str], list[str]]:
    """(anzulegende Slugs, zu löschende Airbnb-Raum-IDs).

    Der Diff geht über die VEREINIGUNG beider Seiten — nur über `soll` zu laufen
    würde genau den gemeldeten Fehler wiederholen: der gelöschte Balkon steht
    dann in keiner Schleife und bleibt bei Airbnb online.

    Slugs ohne Airbnb-Entsprechung werden nicht angelegt (kein geratener
    Raumtyp), aber auch nicht stillschweigend geschluckt — sie werden benannt.
    """
    anlegen: list[str] = []
    loeschen: list[str] = []
    for slug in set(soll) | set(ist):
        vorhanden = ist.get(slug, [])
        fehlend = soll.get(slug, 0) - len(vorhanden)
        if fehlend > 0:
            if slug not in SLUG_AUF_AIRBNB_RAUM:
                log.info("airbnb_zimmer_ohne_entsprechung", slug=slug)
                continue
            anlegen.extend([slug] * fehlend)
        elif fehlend < 0:
            # Die ÜBERZÄHLIGEN von hinten: die zuletzt angelegten zuerst weg.
            loeschen.extend(vorhanden[fehlend:])
    return sorted(anlegen), sorted(loeschen)


class AirbnbZimmerPushMixin:
    """Schickt die Zimmer eines Objekts an dessen Airbnb-Anzeige."""

    def sync_airbnb_zimmer(self, tenant_id: str, property_id: str) -> dict[str, Any]:
        """Einstieg für den Worker (kein AuthContext).

        Der Job trägt den Tenant selbst; das Objekt wird darauf gescopt geladen
        (Wurzel 3) — die Service-Rolle umgeht RLS, ein ungescopter Zugriff per ID
        wäre ein fremdes Objekt.
        """
        db = self._require_db()  # type: ignore[attr-defined]
        load_scoped(
            db, "properties", property_id, tenant_id, columns="id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        return self.airbnb_zimmer_pushen(db, tenant_id, property_id)

    def airbnb_zimmer_pushen(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, Any]:
        """Unsere Zimmer mit Airbnbs Räumen abgleichen.

        Reihenfolge: LESEN → Diff → schreiben → nichts behaupten. Der Rückgabewert
        nennt, was wirklich gesendet wurde; er wird NICHT aus dem HTTP-Status
        abgeleitet (Wurzel 5 — ein 200 von Channex hat hier schon zweimal nichts
        bedeutet).

        Kein Airbnb-Objekt, kein Kanal oder kein lesbarer Ist-Stand → nichts tun
        und den Grund nennen. Das ist der Normalfall für jedes Objekt, das nicht
        bei Airbnb hängt, und darf das Speichern in unserer Maske nie kippen.
        """
        listing_id = self._airbnb_listing_id(db, property_id)  # type: ignore[attr-defined]
        if not listing_id:
            return {"gesendet": False, "grund": "kein_airbnb_objekt"}
        channel_id = self._airbnb_kanal_des_betriebs(db, tenant_id)  # type: ignore[attr-defined]
        if not channel_id:
            return {"gesendet": False, "grund": "kein_airbnb_kanal"}

        raeume = self._airbnb_raeume_lesen(channel_id, listing_id)
        if raeume is None:
            return {"gesendet": False, "grund": "stand_unlesbar"}

        soll = _soll_stand(db, tenant_id, property_id)
        anlegen, loeschen = zimmer_diff(soll, _ist_stand(raeume))
        if len(anlegen) + len(loeschen) > _MAX_AENDERUNGEN:
            log.warning(
                "airbnb_zimmer_zu_viele_aenderungen",
                property_id=property_id, anlegen=len(anlegen),
                loeschen=len(loeschen), grenze=_MAX_AENDERUNGEN,
            )
            return {"gesendet": False, "grund": "zu_viele_aenderungen"}
        if not anlegen and not loeschen:
            return {"gesendet": False, "grund": "gleichstand"}

        angelegt = self._raeume_anlegen(channel_id, listing_id, anlegen)
        geloescht = self._raeume_loeschen(channel_id, listing_id, loeschen)
        log.info(
            "airbnb_zimmer_gepusht",
            tenant_id=tenant_id, property_id=property_id,
            listing_id=listing_id, angelegt=angelegt, geloescht=geloescht,
        )
        return {"gesendet": True, "angelegt": angelegt, "geloescht": geloescht}

    def _airbnb_raeume_lesen(
        self, channel_id: str, listing_id: str
    ) -> list[dict[str, Any]] | None:
        """Airbnbs Räume als Liste. None = Stand unbekannt (dann NICHT schreiben).

        Wurzel 1: ohne den Ist-Stand gibt es keinen Diff, nur Raten. Wer bei einem
        Leseausfall trotzdem schreibt, legt Räume doppelt an.
        """
        try:
            antwort = self._channex.get_airbnb_listing_rooms(  # type: ignore[attr-defined]
                channel_id, listing_id
            )
        except ChannexError as exc:
            log.warning(
                "airbnb_zimmer_stand_unlesbar",
                listing_id=listing_id, error=exc.message,
            )
            return None
        rohe = ((antwort or {}).get("data") or {}).get("listing_rooms")
        if not isinstance(rohe, list):
            return None
        return [r for r in rohe if isinstance(r, dict)]

    def _raeume_anlegen(
        self, channel_id: str, listing_id: str, slugs: list[str]
    ) -> list[str]:
        """Die fehlenden Räume bei Airbnb anlegen; zurück kommt, was ankam.

        Ein Fehler bei EINEM Raum stoppt die übrigen nicht — aber er wird
        protokolliert, nicht verschluckt (Wurzel 5). `privat=True`, weil Airbnb
        für alle 157 gemessenen Räume dieses Kontos `is_private: true` führt und
        ein ganzes Ferienhaus (`entire_home`) keine geteilten Räume hat.
        """
        angelegt: list[str] = []
        for slug in slugs:
            try:
                self._channex.create_airbnb_listing_room(  # type: ignore[attr-defined]
                    channel_id, listing_id,
                    SLUG_AUF_AIRBNB_RAUM[slug], privat=True,
                )
            except ChannexError as exc:
                log.warning(
                    "airbnb_zimmer_anlegen_fehlgeschlagen",
                    listing_id=listing_id, slug=slug, error=exc.message,
                )
                continue
            angelegt.append(slug)
        return angelegt

    def _raeume_loeschen(
        self, channel_id: str, listing_id: str, raum_ids: list[str]
    ) -> list[str]:
        """Die überzähligen Räume bei Airbnb löschen; zurück kommt, was wegging."""
        geloescht: list[str] = []
        for raum_id in raum_ids:
            try:
                self._channex.delete_airbnb_listing_room(  # type: ignore[attr-defined]
                    channel_id, listing_id, raum_id
                )
            except ChannexError as exc:
                log.warning(
                    "airbnb_zimmer_loeschen_fehlgeschlagen",
                    listing_id=listing_id, raum_id=raum_id, error=exc.message,
                )
                continue
            geloescht.append(raum_id)
        return geloescht
