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
Räume erscheinen dort nur lesend in `action/listing_details`.

ANLEGEN IST LIVE BEWIESEN, LÖSCHEN GEHT NICHT — beides gemessen, nicht vermutet:

  * ANLEGEN: `POST listing_rooms` mit FLACHEM Payload legte an Cornflower den
    Balkon an; Airbnb gab `{"data": {"id": "817240083"}}` zurück, und ein
    Rücklesen zeigte 9 statt 8 Räume mit genau dieser ID (16:28 Uhr).
    Der Payload darf KEINE `listing_room`-Hülle haben (siehe
    `create_airbnb_listing_room` — daran scheiterten drei Versuche).
  * LÖSCHEN: existiert nirgends. Bei Channex antworten alle vier Formen
    (`DELETE listing_rooms/{id}`, `DELETE listing_rooms` mit ID im Body,
    `PUT listing_rooms/{id}`, `POST listing_rooms/{id}/delete`) mit
    422 `Route not found`; Airbnbs eigene API antwortet auf
    `DELETE v2/listing_rooms/{id}` mit 404 `route_not_found` — identisch zu
    einem frei erfundenen Pfad (Kontrolltest). Ein in unserer Maske entferntes
    Zimmer bleibt bei Airbnb stehen und muss im Extranet nachgezogen werden;
    die Oberfläche sagt das (`objects.propertyOverview.zimmerLoeschenHinweis`).

Der Proxy ist damit ein echter Durchgriff und nicht die 200-Attrappe des
`execute`-Namensraums — aber nur für das Anlegen.

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

from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import text as mail_text
from src.core.security import AuthContext
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

    def airbnb_zimmer_rest(
        self, ctx: AuthContext, *, property_id: str
    ) -> dict[str, Any]:
        """Zimmer, die bei Airbnb stehen, obwohl wir sie nicht (mehr) führen.

        WOZU DAS DA IST: Airbnb hat keinen Löschweg für Räume — gemessen am
        05.08.2026 in sechzehn Formen, über Channex UND direkt gegen
        `api.airbnb.com`; `v2/listing_rooms` kennt ausschließlich GET und POST,
        jede andere Methode ist `route_not_found`. Wer bei uns ein Zimmer
        entfernt, hat es bei Airbnb also weiterhin stehen.

        Statt das im Log verschwinden zu lassen, liefert diese Abfrage den
        Reststand an die Oberfläche: das Zimmer bleibt dort sichtbar, mit dem
        Weg, der wirkt (Airbnb-Extranet, Fototour). `stand_bekannt=False`, wenn
        Airbnb nicht lesbar ist — dann wird nichts behauptet (Wurzel 4).
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        load_scoped(
            db, "properties", property_id, tenant_id, columns="id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        listing_id = self._airbnb_listing_id(db, property_id)  # type: ignore[attr-defined]
        channel_id = self._airbnb_kanal_des_betriebs(  # type: ignore[attr-defined]
            db, tenant_id, property_id
        )
        if not listing_id or not channel_id:
            return {"verbunden": False, "stand_bekannt": True, "rest": []}
        raeume = self._airbnb_raeume_lesen(channel_id, listing_id)
        if raeume is None:
            return {"verbunden": True, "stand_bekannt": False, "rest": []}

        soll = _soll_stand(db, tenant_id, property_id)
        ist = _ist_stand(raeume)
        _anlegen, ueberzaehlig = zimmer_diff(soll, ist)
        art_je_id = {
            str(r.get("id")): str(r.get("room_type") or "")
            for r in raeume if r.get("id")
        }
        rest = [
            {
                "airbnb_room_id": raum_id,
                "airbnb_art": art_je_id.get(raum_id, ""),
                "slug": AIRBNB_RAUM_AUF_SLUG.get(art_je_id.get(raum_id, "")),
            }
            for raum_id in ueberzaehlig
        ]
        log.info(
            "airbnb_zimmer_rest",
            property_id=property_id, listing_id=listing_id,
            soll=soll, airbnb_roh=sorted(art_je_id.values()), rest=ueberzaehlig,
        )
        return {
            "verbunden": True,
            "stand_bekannt": True,
            "rest": rest,
            # Direkt an die Stelle, die es wirklich kann.
            "extranet_url": (
                f"https://www.airbnb.com/hosting/listings/editor/{listing_id}"
                "/details/photo-tour"
            ),
        }

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
        channel_id = self._airbnb_kanal_des_betriebs(  # type: ignore[attr-defined]
            db, tenant_id, property_id
        )
        if not channel_id:
            return {"gesendet": False, "grund": "kein_airbnb_kanal"}

        raeume = self._airbnb_raeume_lesen(channel_id, listing_id)
        if raeume is None:
            return {"gesendet": False, "grund": "stand_unlesbar"}

        soll = _soll_stand(db, tenant_id, property_id)
        ist = _ist_stand(raeume)
        anlegen, loeschen = zimmer_diff(soll, ist)
        # Soll, Ist und Diff in EINER Zeile: ohne sie war live nicht zu sehen, ob
        # ein leerer Diff „beide Seiten gleich" heißt oder „unsere Seite falsch
        # gelesen". `airbnb_roh` nennt die Raumarten, die Airbnb liefert — auch
        # die, für die wir keinen Slug haben (sie fehlen absichtlich in `ist`).
        log.info(
            "airbnb_zimmer_diff",
            property_id=property_id, listing_id=listing_id,
            soll=soll, ist={k: len(v) for k, v in ist.items()},
            airbnb_roh=sorted(
                str(r.get("room_type") or "?") for r in raeume
            ),
            anlegen=anlegen, loeschen=loeschen,
        )
        if len(anlegen) + len(loeschen) > _MAX_AENDERUNGEN:
            log.warning(
                "airbnb_zimmer_zu_viele_aenderungen",
                property_id=property_id, anlegen=len(anlegen),
                loeschen=len(loeschen), grenze=_MAX_AENDERUNGEN,
            )
            return {"gesendet": False, "grund": "zu_viele_aenderungen"}
        if not anlegen and not loeschen:
            # Gleichstand heißt NICHT „alles gut": ein Raum ohne Foto blendet bei
            # Airbnb die ganze Photo tour aus. Auch hier prüfen, sonst meldet die
            # Glocke es nur beim ersten Mal.
            self._fehlende_fotos_melden(db, tenant_id, property_id)
            return {"gesendet": False, "grund": "gleichstand"}

        angelegt = self._raeume_anlegen(channel_id, listing_id, anlegen)
        geloescht = self._raeume_loeschen(channel_id, listing_id, loeschen)
        # Was NICHT wegging, muss der Betrieb im Extranet nachziehen — sonst
        # steht das Zimmer bei Airbnb weiter und wirkt bei uns gelöscht.
        if len(geloescht) < len(loeschen):
            self._nicht_loeschbar_melden(
                db, tenant_id, property_id,
                [r for r in loeschen if r not in geloescht], raeume,
            )
        # NACH dem Anlegen: ein gerade erzeugter Raum hat noch kein Foto, und
        # genau davor soll die Meldung warnen.
        self._fehlende_fotos_melden(db, tenant_id, property_id)
        log.info(
            "airbnb_zimmer_gepusht",
            tenant_id=tenant_id, property_id=property_id,
            listing_id=listing_id, angelegt=angelegt, geloescht=geloescht,
        )
        return {"gesendet": True, "angelegt": angelegt, "geloescht": geloescht}

    def _fehlende_fotos_melden(
        self, db: Client, tenant_id: str, property_id: str
    ) -> None:
        """Räume ohne Foto in die Glocke legen.

        WARUM DAS WICHTIG IST: Airbnb blendet die GESAMTE „Photo tour" für Gäste
        aus, sobald ein einziger Raum kein Foto hat („Guests only see your photo
        tour if every room has a photo"). Der Betrieb sieht das nur im
        Airbnb-Extranet — bei uns wirkte das Objekt vollständig gepflegt. Genau
        so ist es live passiert: der neu angelegte Balkon hatte kein Bild, und
        Airbnb versteckte die ganze Tour.

        `dedup_key` je Objekt: der Zimmer-Sync läuft bei jeder Änderung, die
        Meldung darf aber nicht bei jedem Lauf neu erscheinen (Wurzel 2). Der
        partielle UNIQUE-Index greift nur für UNGELESENE — hat der Betrieb sie
        gelesen und fehlt später wieder ein Foto, meldet es erneut.

        Best effort: die Meldung ist ein Nebenpfad. Fällt sie aus, ist der
        Zimmer-Sync trotzdem gelaufen — der Grund steht im Log (Wurzel 5).
        """
        try:
            stand = self._airbnb_raeume_ohne_foto(db, tenant_id, property_id)
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, kein Hauptpfad
            log.warning(
                "airbnb_fotopruefung_fehlgeschlagen",
                property_id=property_id, error=str(exc)[:200],
            )
            return
        if not stand:
            return
        self._an_die_glocke(
            db, tenant_id, property_id,
            betreff_key="airbnb.zimmer_ohne_foto",
            text_key="airbnb.rumpf_ohne_foto",
            anzahl=len(stand),
            raeume=", ".join(stand),
            ziel_pfad=f"/objekte/{property_id}/fotos",
            dedup_key=f"airbnb_foto_fehlt:{property_id}",
        )

    def _nicht_loeschbar_melden(  # noqa: PLR0913 — Kontext der Meldung
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        raum_ids: list[str],
        raeume: list[dict[str, Any]],
    ) -> None:
        """Melden, welches Zimmer bei Airbnb stehen bleibt.

        Ohne diese Meldung ist das Löschen eine stille Lüge: bei uns ist das
        Zimmer weg, bei Airbnb steht es weiter in der Fototour. Der einzige Weg
        dorthin ist Airbnbs Extranet (Listings → Photo tour → Raum → „Delete
        room or space") — das muss dastehen, sonst sucht der Betrieb den Fehler
        bei uns.
        """
        namen: list[str] = []
        for raum_id in raum_ids:
            treffer = next(
                (r for r in raeume if str(r.get("id")) == str(raum_id)), None
            )
            art = str((treffer or {}).get("room_type") or "").strip()
            namen.append(AIRBNB_RAUM_AUF_SLUG.get(art) or art or str(raum_id))
        self._an_die_glocke(
            db, tenant_id, property_id,
            betreff_key="airbnb.zimmer_noch_vorhanden",
            text_key="airbnb.rumpf_noch_vorhanden",
            anzahl=len(namen),
            raeume=", ".join(sorted(namen)),
            ziel_pfad=f"/objekte/{property_id}",
            # Je Zimmer eigener Schlüssel: löscht der Betrieb zwei Zimmer
            # nacheinander, darf die zweite Meldung nicht an der ersten
            # hängenbleiben (Wurzel 2 gilt für Wiederholungen, nicht für
            # verschiedene Sachverhalte).
            dedup_key=f"airbnb_zimmer_bleibt:{property_id}:{'-'.join(sorted(raum_ids))}",
        )

    def _an_die_glocke(  # noqa: PLR0913 — Empfänger plus Inhalt der Meldung
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        *,
        betreff_key: str,
        text_key: str,
        anzahl: int,
        raeume: str,
        ziel_pfad: str,
        dedup_key: str,
    ) -> None:
        """Eine Meldung an alle Admins des Betriebs.

        `listing_activity` trägt laut Katalog `email_pflicht=True` — die
        Meldung geht also NICHT nur an die Glocke, sondern auch ins Postfach.
        Betreff und Rumpf kommen deshalb als Katalog-SCHLÜSSEL herein und
        werden vom Dispatcher in der Sprache des jeweiligen Admins gerendert;
        vorher standen hier deutsche Sätze, die jeden nicht-deutschen Betrieb
        auf Deutsch erreichten.
        """
        # Empfaenger = wer System-Warnungen erhaelt (RECEIVE_SYSTEM_ALERTS,
        # §4.1): admin UND co_admin, Rolle frisch aus der DB. Bis 07.09.2026
        # stand hier `eq("role", "admin")` — der Co-Admin, dem das Lastenheft
        # die System-Warnungen ausdruecklich zuspricht, erfuhr nichts.
        from src.features.notification_settings.ereignisse import (  # noqa: PLC0415
            system_warnungs_empfaenger,
        )

        empfaenger = sorted(system_warnungs_empfaenger(db, tenant_id))
        if not empfaenger:
            log.info("airbnb_meldung_ohne_empfaenger", tenant_id=tenant_id)
            return
        titel = (
            db.table("properties")
            .select("title")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        # Ohne Titel die ID-Kurzform: der Betrieb muss erkennen können, WELCHES
        # Objekt gemeint ist. Ein erfundener Name („Ihr Objekt") wäre schlechter
        # als die Kennung (Wurzel 4) — dieselbe Notlösung wie in `ereignisse`.
        objekt = (titel[0].get("title") if titel else None) or property_id[:8]
        werte: dict[str, object] = {
            "objekt": objekt, "anzahl": anzahl, "raeume": raeume,
        }
        from src.features.notification_settings.dispatcher import (  # noqa: PLC0415
            NotificationDispatcher,
        )

        dispatcher = NotificationDispatcher(db)
        for user_id in empfaenger:
            dispatcher.sende(
                user_id=user_id,
                schluessel="listing_activity",
                betreff=mail_text(betreff_key, FALLBACK, **werte),
                text=mail_text(text_key, FALLBACK, **werte),
                betreff_key=betreff_key,
                betreff_werte=werte,
                text_key=text_key,
                text_werte=werte,
                tenant_id=tenant_id,
                property_id=property_id,
                ziel_pfad=ziel_pfad,
                dedup_key=dedup_key,
                # WIEDERHOLBAR (0617) — der Musterfall dafuer: „Balkon hat kein
                # Foto" und „Zimmer steht bei Airbnb noch" sind ZUSTAENDE. Hat
                # der Betrieb die Meldung gelesen und fehlt spaeter wieder ein
                # Foto, MUSS es erneut melden, sonst bleibt die Fototour
                # dauerhaft ausgeblendet, ohne dass es jemand erfaehrt. Live
                # gemessen (09.09.2026): `airbnb_foto_fehlt` hatte bei einer
                # Meldung keinen Ueberschuss — der partielle Index reicht hier.
                einmalig=False,
                inapp=True,
            )

    def _airbnb_raeume_ohne_foto(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[str]:
        """Namen der Airbnb-Räume ohne Foto. Leer = alles in Ordnung.

        Belegt/nicht belegt kommt DIREKT von Airbnb, nicht aus unserer Tabelle
        `airbnb_foto_raum` (0288). Die ist nur ein Cache für den Schreibweg und
        kann leer sein, obwohl jedes Zimmer ein Bild hat — live genau so
        passiert: 16 Fotos waren importiert, bevor es die Tabelle gab, und die
        Meldung führte JEDES Zimmer als fotolos auf. Nicht-Wissen ist kein
        Befund (Wurzel 4).

        Räume, die Airbnb führt und unsere Liste nicht kennt (`exterior`,
        `garden`), zählen mit: Airbnb verlangt auch für sie ein Foto.
        """
        listing_id = self._airbnb_listing_id(db, property_id)  # type: ignore[attr-defined]
        channel_id = self._airbnb_kanal_des_betriebs(  # type: ignore[attr-defined]
            db, tenant_id, property_id
        )
        if not listing_id or not channel_id:
            return []
        raeume = self._airbnb_raeume_lesen(channel_id, listing_id)
        if not raeume:
            return []
        zugang = self._airbnb_token(db, tenant_id, property_id)  # type: ignore[attr-defined]
        if not zugang:
            # Ohne Foto-Stand keine Aussage — lieber schweigen als jedes Zimmer
            # fälschlich melden.
            return []
        token, _user = zugang
        belegt = {
            str(f["airbnb_room_id"])
            for f in self.airbnb_fotos_direkt(token, str(listing_id))  # type: ignore[attr-defined]
            if f.get("airbnb_room_id")
        }
        fehlend = []
        for raum in raeume:
            raum_id = str(raum.get("id") or "")
            if not raum_id or raum_id in belegt:
                continue
            art = str(raum.get("room_type") or "").strip()
            # Airbnbs Rohwert, wenn wir keinen Slug haben — lieber `exterior` als
            # ein leerer Eintrag in der Meldung.
            fehlend.append(AIRBNB_RAUM_AUF_SLUG.get(art) or art or raum_id)
        return sorted(fehlend)

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
            art = SLUG_AUF_AIRBNB_RAUM[slug]
            try:
                antwort = self._channex.create_airbnb_listing_room(  # type: ignore[attr-defined]
                    channel_id, listing_id, art, privat=True,
                )
            except ChannexError as exc:
                # `exc.message` ist nur „Channex-Fehler 422." — die Begründung
                # steht in `payload`. Ohne sie war live nicht zu unterscheiden,
                # ob Airbnb den Raumtyp, die Kennung oder die Form ablehnt.
                log.warning(
                    "airbnb_zimmer_anlegen_fehlgeschlagen",
                    listing_id=listing_id, slug=slug, raumart=art,
                    status=exc.channex_status, error=exc.message,
                    antwort=exc.payload,
                )
                continue
            # Auch der Erfolgsfall wird protokolliert: eine 200 von Channex heißt
            # NICHT, dass Airbnb den Raum angelegt hat (Wurzel 5). Erst die
            # zurückgegebene Raum-ID ist ein Beweis — steht sie nicht drin, ist
            # das im Log sichtbar, statt als „angelegt" zu gelten.
            log.info(
                "airbnb_zimmer_anlegen_antwort",
                listing_id=listing_id, slug=slug, raumart=art,
                antwort=antwort,
            )
            angelegt.append(slug)
        return angelegt

    def _raeume_loeschen(
        self, channel_id: str, listing_id: str, raum_ids: list[str]
    ) -> list[str]:
        """Die überzähligen Räume bei Airbnb löschen; zurück kommt, was wegging.

        AIRBNB KANN DAS NICHT — zweimal gemessen (05.08.2026), acht Formen: auf
        `listing_rooms/{id}` antwortet JEDE Methode „Route not found", auch das
        harmlose `PUT {"is_private": true}`; die Sammlung ist ebenfalls nicht
        ersetzbar. Kontrolltest, der ausschließt, dass Channex filtert: ein
        `DELETE listing_photos/<unsinn>` kommt bis Airbnb durch (403 mit
        Airbnb-`error_id`). Die Route existiert bei Airbnb schlicht nicht;
        Räume verschwinden nur im Extranet.

        Der Aufruf bleibt trotzdem stehen: er kostet einen Request pro
        Löschung, und käme die Route je dazu, wirkt der Rückweg sofort. Der
        Fehlschlag ist hier aber der ERWARTETE Fall — deshalb `info` statt
        `warning`, sonst sieht jedes Löschen im Log wie eine Störung aus.
        """
        geloescht: list[str] = []
        for raum_id in raum_ids:
            try:
                antwort = self._channex.delete_airbnb_listing_room(  # type: ignore[attr-defined]
                    channel_id, listing_id, raum_id
                )
            except ChannexError as exc:
                log.info(
                    "airbnb_zimmer_loeschen_nicht_moeglich",
                    listing_id=listing_id, raum_id=raum_id,
                    status=exc.channex_status, error=exc.message,
                )
                continue
            log.info(
                "airbnb_zimmer_loeschen_antwort",
                listing_id=listing_id, raum_id=raum_id, antwort=antwort,
            )
            geloescht.append(raum_id)
        return geloescht
