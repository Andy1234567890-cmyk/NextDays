"""Portal-Raten NACHTRAEGLICH zu Preisplaenen machen — fuer BESTEHENDE Kanaele.

DIE LUECKE (gemessen 23.08.2026): `channels._plaene_fuer_uebrige_raten` legt je
Portal-Rate einen eigenen Preisplan an, laeuft aber ausschliesslich in
`_build_rate_plans` — also nur beim VERBINDEN eines Kanals. Fuer die 18 bereits
verbundenen Booking-Kennungen griff es nie. Belegt an „FeWo *Stjerneskud*"
(lokal 6efd2281-1649-4883-9cf1-4e39f49fec66): Booking fuehrt dort ZWEI Raten
(47588686 „Standard Rate", 63941996 „Wochenrate"), lokal standen nur
`Grundpreis` und `Grundpreis · BookingCom` — kein Plan „Wochenrate". Unter
/objekte/<id>/preise war die zweite Rate damit unsichtbar, und Booking fuehrt
Restriktionen auf RATE-Ebene: was der Betrieb nicht sieht, kann er nicht
bepreisen und nicht mit einem Mindestaufenthalt versehen.

Dieselbe Klasse Luecke wie bei `objekt_kanal.freigegebene_plaene_zuordnen`
(13.08.2026): eine Regel, die nur beim Verbinden lief, und ein Bestand, der nie
verbunden wurde, seit es die Regel gibt. Der Nachbau ist dieselbe Bauart — ein
Heil-Lauf, der den Bestand einholt.

WAS DIESER LAUF TUT:
  a) Kanal-Verbindung + `ota_hotel_id` je Objekt+Portal lesen, gescopt auf
     tenant_id (Wurzel 3),
  b) die Raten des Portals per `POST /channels/mapping_details` LESEN und den
     Kanal per `GET /channels/{id}` — wer schon einen EIGENEN Plan hat, ist
     fertig, der Rest ist die Arbeit (siehe „belegt ist nicht gemappt"),
  c) fuer jede uebrige Rate ohne namensgleichen lokalen Plan einen anlegen
     (`portal_raten_plaene.plan_fuer_portal_rate`, idempotent ueber
     `vorhandene_plan_namen` — Wurzel 2),
  d) bei mindestens einem neuen Plan den Content-Sync einreihen.

WELCHE RATE ARBEIT IST — „BELEGT" IST NICHT „GEMAPPT":
Der erste Entwurf dieses Laufs liess jede Rate aus, die im Kanal irgendeinem
Plan zugeordnet ist. Der Trockenlauf ueber alle 18 Kennungen ergab damit
ueberall „nichts uebrig" — der Lauf waere ein No-op gewesen. Der Grund steht im
Kanal von „FeWo *Stjerneskud*" (6194a921-b1c8-41b3-8971-f8bf0a645efc), gelesen
am 23.08.2026:

    rate_plan_code 47588686 (Standard Rate) -> 94cc38bb… „Grundpreis"  primary
    rate_plan_code 63941996 (Wochenrate)    -> 94cc38bb… „Grundpreis"  primary
    rate_plan_code 63941996 (Wochenrate)    -> bd74737b… „Grundpreis · BookingCom"

Die Wochenrate IST zugeordnet — an den Grundpreis. Genau das ist der Fehler,
nicht sein Gegenteil: zwei Portal-Raten auf einem Plan, also ein
Mindestaufenthalt fuer beide und keine eigene Zeile unter „Preise".

Eine Rate ist deshalb erst BELEGT, wenn der Plan, auf den sie zeigt, IHR
gehoert — sein Name ist ihr Titel (`plan_fuer_portal_rate` benennt ihn so). Die
eine Ausnahme ist die PRIMAERE Zuordnung (`primary_occ: true`): die haelt der
Grundpreis, und sie ihm zu nehmen waere der Schaden statt der Behebung. Channex
traegt je OTA-Paar nur EINEN lokalen Plan („One OTA room+rate pair should map to
at most one local rate plan"), und `freigegebene_plaene_zuordnen` legte einen
neuen Plan per `nur_paar` auf genau dieses Paar — der Grundpreis waere danach
von seiner Rate geloest. Deshalb: primaere Rate bleibt, alle anderen ohne
eigenen Plan sind die Arbeit.

WAS ER NICHT SELBST TUT — UND WARUM DAS RICHTIG IST (Schritt e):
Das Kanal-Mapping neu zu schreiben (der Channex-SCHREIBaufruf, der die neue
Rate auf IHREN Plan mit `primary_occ` legt) ist der Gegenzustand zum Anlegen
(Wurzel 1). Er passiert AUTOMATISCH, ohne dass dieser Lauf ihn selbst macht:

    Schritt (d) reiht `sync_property_content` ein.
    `worker._handle_sync_property_content` ruft ERST `sync_content`
    (registriert den Plan bei Channex, schreibt `channex_rate_plan_map`)
    und DANACH, im SELBEN Handler-Aufruf, `freigegebene_plaene_zuordnen`.
    Das ist Schritt (e): sie liest die Plaene mit `send_to_portals` — und
    genau das Flag setzt `plan_fuer_portal_rate` —, holt die Rate-Titel per
    `mapping_details` und legt den Plan ueber `_portal_raten_plan_ziel` auf
    GENAU SEINE Rate (`nur_paar`), nicht auf alle Raten des Zimmers.

Die Abhaengigkeit (d)->(e) ist damit keine Wartezeit und kein zweiter Job,
sondern eine Reihenfolge INNERHALB eines Handlers — nachlesbar in
`src/worker.py` (`_handle_sync_property_content`). Eine erfundene Verzoegerung
waere schlechter: sie waere geraten, waehrend die Garantie hier im Code steht.

FREQUENZ UND BUDGET (gerechnet, nicht vermutet):
  Live gezaehlt (23.08.2026, `channex_channel_connection` mit Kanal):
  BookingCom 18 Verbindungen / 18 Objekte / 18 verschiedene `ota_hotel_id`,
  AirBNB 19 Verbindungen / 19 Objekte / 2 `ota_hotel_id`.
  Dieser Lauf ruft je Objekt+Portal mit Raten-Ebene ZWEI lesende Calls:
  `mapping_details` (was das Portal fuehrt) und `GET /channels/{id}` (was schon
  zugeordnet ist).
  Airbnb hat keine: `_normalize_mapping_rooms` liefert je Listing GENAU EINE
  Rate mit der Listing-ID als Code („Airbnb allows you to map only 1 rate
  plan"), und die ist immer schon der Grundpreis-Plan — deshalb ueberspringt
  `PORTALE_MIT_RATEN` Airbnb ganz und spart 19 Calls.
  Bleiben 18 Objekte x 2 = 36 Calls je Lauf. Das kontoweite Budget ist
  `channex_account_budget` = 200 Requests/60 s (`core/config.py`); je Property
  20/60 s. 36 Calls sind also 18 % EINES Minutenfensters, verteilt auf 18
  verschiedene Properties (je 2 von 20). Bei TAEGLICHER Frequenz ist das
  gegenueber dem taeglichen Reconcile + Voll-Push nicht messbar.
  Deshalb haengt der Auslöser am taeglichen `_reconcile_tick` und nicht am
  stuendlichen `_content_heal_tick`: der Abgleich ist nicht zeitkritisch (eine
  im Extranet angelegte Rate verkauft nicht schlechter, weil unser Plan einen
  Tag spaeter erscheint), und stuendlich waere es 24x dieselbe Last fuer eine
  Aenderung, die ein Betrieb wenige Male im Jahr macht.

IDEMPOTENZ (Wurzel 2 — kritisch, weil der Lauf taeglich wiederkommt):
  Der zweite und der hundertste Lauf tun NICHTS. Zwei Sperren:
  1. Die Rate zeigt nach dem ersten Durchlauf auf ihren namensgleichen Plan,
     ist damit BELEGT und kommt gar nicht mehr in Frage.
  2. `vorhandene_plan_namen` findet den Plan vom Vortag zusaetzlich am Namen
     wieder → kein Insert, auch wenn (1) noch nicht gegriffen hat (der
     Content-Sync des Vortags kann noch offen sein).
  3. Ohne Insert wird `try_enqueue_content_sync` NICHT gerufen → kein
     Content-Sync, also auch kein Channex-Schreibaufruf aus (e).
  Der Test `test_portal_raten_abgleich.py` prueft genau diese zwei Laeufe.

FAIL-CLOSED (Wurzel 5): ein `mapping_details` ohne Raten ist ein
fehlgeschlagener Abruf, kein Portal ohne Raten (dieselbe Begruendung wie in
`verwaiste_raten.verwaiste_eintraege`). Dann wird NICHTS angelegt und NICHTS
abgeraeumt.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from .channex_client import ChannexError
from .common import log

# Nur Portale mit einer echten Raten-Ebene. Airbnb fuehrt GENAU EINE Rate je
# Anzeige (Channex-Doku: „Airbnb allows you to map only 1 rate plan"), und
# `channels._normalize_mapping_rooms` gibt fuer ein Listing genau eine Rate mit
# der Listing-ID als Code zurueck. Ein Abgleich dort haette nie etwas zu tun und
# kostete trotzdem 19 Channex-Calls je Lauf (live gezaehlt).
#
# Bewusst eine ALLOWLIST, keine Sperrliste: ein neues Portal soll erst nach einer
# Messung mitlaufen, nicht per Vermutung („7 OTAs — jede eigene Einstellung").
PORTALE_MIT_RATEN = frozenset({"BookingCom", "OpenChannel", "SandBox"})


class PortalRatenAbgleichMixin:
    """Nachtraeglicher Abgleich Portal-Raten -> eigene Preisplaene."""

    def portal_raten_abgleichen(
        self, tenant_id: str, property_id: str
    ) -> dict[str, Any]:
        """Fehlende Portal-Raten-Plaene EINES Objekts nachziehen.

        Rueckgabe (fuer den Job-Verlauf, damit dort steht was passiert ist und
        keine Taetigkeit behauptet wird, Wurzel 4):
        `{"kanaele": n, "portal_raten": n, "angelegt": n, "nachgezogen": n,
        "sync_eingereiht": b}` — `nachgezogen` sind Plaene, deren verlorene
        Portal-Freigabe wieder gesetzt wurde (s. `portalfreigabe_nachziehen`).
        """
        db = self._require_db()
        conns = self._kanaele_mit_raten(db, tenant_id, property_id)
        if not conns:
            return {
                "kanaele": 0, "portal_raten": 0, "angelegt": 0,
                "nachgezogen": 0,
                "sync_eingereiht": False,
            }

        from .portal_raten_plaene import (
            MAX_PLAENE_JE_ZIMMER,
            plan_fuer_portal_rate,
            portalfreigabe_nachziehen,
            vorhandene_plan_namen,
        )

        grundpreis = self._grundpreis_zeile(db, property_id)
        if not grundpreis:
            # Ohne Grundpreis gibt es keine Erbmasse (Preis, Waehrung,
            # Mindestaufenthalt) — und ein erfundener Startpreis waere eine
            # Behauptung ueber den Verkauf (Wurzel 4). Nichts tun.
            log.info(
                "portal_raten_abgleich_ohne_grundpreis",
                tenant_id=tenant_id, property_id=property_id,
            )
            return {
                "kanaele": len(conns), "portal_raten": 0, "angelegt": 0,
                "nachgezogen": 0,
                "sync_eingereiht": False,
            }

        bekannt = vorhandene_plan_namen(db, property_id)
        raten_gesamt = 0
        angelegt = 0
        nachgezogen = 0
        # Raten, deren eigener Plan nur als Attrappe zugeordnet ist (s. u.).
        zu_heilen = 0
        for conn in conns:
            portal = str(conn.get("ota_portal_code") or "")
            raten = self._portal_raten(conn)
            if not raten:
                # Fail-closed: leer heisst „Abruf lieferte nichts", nicht
                # „Portal fuehrt keine Raten" (Wurzel 5).
                continue
            raten_gesamt += len(raten)
            titel_je_code = {
                str(r.get("id")): (r.get("title") or "") for r in raten
            }
            gelesen = self._belegte_ratencodes(
                db, tenant_id, property_id, conn, titel_je_code
            )
            if gelesen is None:
                # Der Kanal war nicht lesbar. Dann ist UNBEKANNT, welche Rate
                # ihren eigenen Plan schon traegt — und ohne dieses Wissen
                # wuerde der Lauf dem Grundpreis seine PRIMAERE Rate wegnehmen.
                # Fail-closed (Wurzel 5).
                log.warning(
                    "portal_raten_abgleich_kanal_unlesbar_uebersprungen",
                    tenant_id=tenant_id, property_id=property_id,
                    portal=portal,
                )
                continue
            belegt, attrappen = gelesen
            # Eine Attrappe ist ARBEIT, auch wenn nichts anzulegen ist: der
            # Plan steht da, sein Flag stimmt, nur seine Kanal-Zuordnung traegt
            # nichts. Ohne diesen Zaehler blieben `angelegt` und `nachgezogen`
            # auf 0, der Content-Sync entfiel — und `freigegebene_plaene_
            # zuordnen`, das die Attrappe heilt, lief nie. Live gemessen
            # (23.08.2026): bei „Feriehus Grævlinge" stand die Wochenrate mit
            # `occ=None, primary=None` am Kanal, `send_to_portals` war korrekt
            # `true`, und fuenf Laeufe hintereinander taten nichts.
            zu_heilen += len(attrappen)
            # Nur die Raten, die noch KEINEN EIGENEN Plan haben.
            #
            # „Belegt" ist NICHT dasselbe wie „gemappt" — daran haengt der ganze
            # Befund. Live gemessen an „FeWo *Stjerneskud*" (Kanal
            # 6194a921-b1c8-41b3-8971-f8bf0a645efc):
            #
            #   rate_plan_code 47588686 (Standard Rate) -> 94cc38bb… Grundpreis
            #   rate_plan_code 63941996 (Wochenrate)    -> 94cc38bb… Grundpreis
            #   rate_plan_code 63941996 (Wochenrate)    -> bd74737b… Grundpreis
            #                                              · BookingCom
            #
            # BEIDE Codes sind zugeordnet, aber die Wochenrate haengt am
            # GRUNDPREIS — genau der Zustand, der behoben werden soll. Ein
            # Filter auf „ist irgendwie gemappt" haette hier nichts gefunden
            # und den Lauf ueberall zum No-op gemacht (so gemessen im
            # Trockenlauf ueber alle 18 Kennungen).
            #
            # Belegt ist eine Rate deshalb nur, wenn der Plan, auf den sie
            # zeigt, IHR gehoert: sein Name ist ihr Titel. Zwei Faelle:
            #   * Ein namensgleicher Plan  -> die Rate hat ihren eigenen.
            #   * Die PRIMAERE Zuordnung des Grundpreises -> die bleibt, wie sie
            #     ist. Sie ihm zu nehmen, hiesse den Grundpreis von seiner Rate
            #     zu loesen; Channex traegt je OTA-Paar nur EINEN lokalen Plan
            #     („One OTA room+rate pair should map to at most one local rate
            #     plan"), und `freigegebene_plaene_zuordnen` legte den neuen Plan
            #     per `nur_paar` auf genau dieses Paar.
            raten = [
                r for r in raten if str(r.get("id")) not in belegt
            ]
            if not raten:
                continue
            if len(raten) > MAX_PLAENE_JE_ZIMMER:
                # Wurzel 8: ein Abruf, der Dutzende Raten liefert, darf nicht
                # Dutzende Plaene anlegen.
                log.warning(
                    "portal_raten_abgleich_ueber_obergrenze",
                    tenant_id=tenant_id, property_id=property_id,
                    portal=portal, anzahl=len(raten),
                    grenze=MAX_PLAENE_JE_ZIMMER,
                )
                raten = raten[:MAX_PLAENE_JE_ZIMMER]
            for rate in raten:
                titel = (rate.get("title") or "").strip()
                if not titel:
                    # Ohne Titel gibt es keinen Namens-Schluessel — und der ist
                    # das EINZIGE, was den Plan spaeter seiner Rate zuordnet
                    # (`portal_raten_plaene.paar_fuer_portal_plan`). Ein Plan
                    # ohne diesen Schluessel bekaeme nie sein Mapping, waere
                    # also eine Attrappe unter „Preise". Beim Kanal-AUFBAU ist
                    # das anders (dort faellt die Rate auf den Grundpreis
                    # zurueck und verkauft weiter) — hier gibt es nichts zu
                    # retten, also wird nichts angelegt.
                    log.warning(
                        "portal_rate_ohne_titel_uebersprungen",
                        tenant_id=tenant_id, property_id=property_id,
                        portal=portal, rate_code=rate.get("id"),
                    )
                    continue
                if titel.lower() in bekannt:
                    # Wurzel 2: der Plan steht schon da. ABER der Gegenzustand
                    # zu dieser Sperre muss mit (Wurzel 1): ein Plan, dessen
                    # `send_to_portals` verloren ging, ist fuer
                    # `freigegebene_plaene_zuordnen` unsichtbar und bekommt
                    # nie seine Kanal-Zuordnung. Ohne dieses Nachziehen bliebe
                    # er dauerhaft eine Zeile unter „Preise", die kein Portal
                    # liest — Begruendung und Live-Beleg in
                    # `portal_raten_plaene.portalfreigabe_nachziehen`.
                    if portalfreigabe_nachziehen(
                        db, property_id=property_id,
                        plan_id=bekannt[titel.lower()], plan_name=titel,
                    ):
                        nachgezogen += 1
                    continue
                neu = plan_fuer_portal_rate(
                    db,
                    property_id=property_id,
                    grundpreis=grundpreis,
                    portal_titel=titel,
                    rate_code=rate.get("id"),
                    portal_label=self._portal_label(portal),
                )
                if not neu:
                    continue
                bekannt[titel.lower()] = neu
                angelegt += 1

        if not angelegt and not nachgezogen and not zu_heilen:
            # KEIN Content-Sync ohne neuen oder nachgezogenen Plan: sonst
            # kostete jeder taegliche Lauf je Objekt einen vollen
            # Channex-Content-Push, obwohl sich nichts geaendert hat (Wurzel 2 —
            # der Lauf muss beim zweiten Mal NICHTS tun). Ein nachgezogenes Flag
            # zaehlt dazu, denn erst der Content-Sync ruft im selben Handler
            # `freigegebene_plaene_zuordnen`, die es liest.
            return {
                "kanaele": len(conns), "portal_raten": raten_gesamt,
                "angelegt": 0, "nachgezogen": 0, "zu_heilen": 0,
                "sync_eingereiht": False,
            }

        # Der Gegenzustand zum Anlegen (Wurzel 1) haengt an DIESEM Job:
        # `sync_property_content` registriert den Plan bei Channex und ruft im
        # SELBEN Handler `freigegebene_plaene_zuordnen`, die ihn am Kanal auf
        # genau seine Rate legt. Siehe Modul-Kopf, Abschnitt (d)->(e).
        from src.jobs.queue import try_enqueue_content_sync

        try_enqueue_content_sync(db, tenant_id, property_id)
        log.info(
            "portal_raten_abgleich_plaene_angelegt",
            tenant_id=tenant_id, property_id=property_id,
            kanaele=len(conns), portal_raten=raten_gesamt, angelegt=angelegt,
            nachgezogen=nachgezogen, zu_heilen=zu_heilen,
        )
        return {
            "kanaele": len(conns), "portal_raten": raten_gesamt,
            "angelegt": angelegt, "nachgezogen": nachgezogen,
            "zu_heilen": zu_heilen, "sync_eingereiht": True,
        }

    def _kanaele_mit_raten(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, Any]]:
        """Verbundene Kanaele dieses Objekts, deren Portal eine Raten-Ebene hat.

        Wurzel 3: gescopt auf (tenant_id, property_id) — der Service-Key umgeht
        RLS, der Scope muss hier stehen.
        """
        rows = (
            db.table("channex_channel_connection")
            .select("ota_portal_code, ota_hotel_id, channex_channel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .not_.is_("channex_channel_id", "null")
            .execute()
        ).data or []
        return [
            r for r in rows
            if str(r.get("ota_portal_code") or "") in PORTALE_MIT_RATEN
            and r.get("ota_hotel_id")
        ]

    def _belegte_ratencodes(
        self, db: Client, tenant_id: str, property_id: str,
        conn: dict[str, Any], titel_je_code: dict[str, str],
    ) -> tuple[set[str], set[str]] | None:
        """Die Ratencodes, die ihren EIGENEN Plan schon haben.

        `None` heisst „Kanal nicht lesbar" — dann wird nichts angelegt
        (fail-closed, Wurzel 5). Der Unterschied zu einer leeren Menge ist
        wesentlich: leer heisst „keine Rate hat einen eigenen Plan", unlesbar
        heisst „wir wissen es nicht".

        Der Kanal ist die Quelle der Wahrheit, nicht `channex_rate_plan_map`:
        die Map sagt nur, welcher Plan REGISTRIERT ist — welche Portal-Rate auf
        welchen Plan zeigt, steht ausschliesslich im `rate_plans`-Array des
        Kanals.

        Zwei Belegungsgruende (Begruendung an der Aufrufstelle):
        1. Der zugeordnete Plan traegt den Titel der Rate — sie hat ihren
           eigenen (das ist der Zustand, den dieser Lauf herstellt; beim
           zweiten Durchlauf greift er als Idempotenz-Sperre).
        2. Sie ist die EINE Rate, die ein namensfremder Plan (im Regelfall der
           Grundpreis) je Zimmer behalten darf.

        Zu 2. — WELCHE Rate ein namensfremder Plan behalten darf, entscheidet
        `primary_occ`, und zwar JE PLAN, nicht global. Das Flag markiert die
        Zuordnung, ueber die dieser Plan seine Restriktionen sendet; die ist
        seine. Alle WEITEREN Raten am selben Plan sind der Fehlzustand — sie
        verkaufen mit, tragen aber keine eigenen Werte. Live gemessen
        (23.08.2026):

            Bedstefars lille skovhus   63942079 primary=False   ein Plan,
                                       55268553 primary=True    zwei Raten
            Feriehus Rævehulen         65402734 primary=False
                                       64513248 primary=True

        Der Plan behaelt hier 55268553 bzw. 64513248, und die Wochenraten
        63942079/65402734 sind die Arbeit — genau umgekehrt zur reinen
        Reihenfolge, in der Channex das Array liefert (die Wochenrate steht
        vorn). Ueber die Reihenfolge zu gehen waere also falsch gewesen; sie ist
        kein Ordnungskriterium.

        Der Sonderfall „FeWo *Stjerneskud*" hat ZWEI Eintraege mit
        `primary_occ: true` auf demselben Plan (47588686 und 63941996). Dann
        gewinnt der erste primaere, und der zweite bleibt Arbeit — mehr als eine
        primaere Zuordnung je Plan und Zimmer ist ein Widerspruch in den Daten,
        und ihn beidseitig als „versorgt" zu lesen hiesse, den bekannten
        Fehlzustand fuer korrekt zu erklaeren.
        """
        channel_id = conn.get("channex_channel_id")
        if not channel_id:
            return None
        try:
            aktuell = self._channex.get_channel(str(channel_id))
        except ChannexError as exc:
            log.warning(
                "portal_raten_abgleich_kanal_unlesbar",
                channel_id=channel_id, error=str(exc)[:200],
            )
            return None
        daten = aktuell.get("data")
        if not daten:
            # Eine Antwort ohne `data` ist kein leerer Kanal, sondern eine
            # Antwort, die wir nicht deuten koennen.
            return None
        namen = self._plannamen_je_channex_id(db, tenant_id, property_id)
        belegt: set[str] = set()
        # Raten, deren eigener Plan nur als Attrappe zugeordnet ist. Sie sind
        # weder versorgt (kein Traeger) noch anzulegen (der Plan existiert) —
        # aber sie sind ARBEIT: erst der Content-Sync heilt die Zuordnung.
        attrappen: set[str] = set()
        # Je (Plan, Zimmer) die EINE primaere Rate, die ein namensfremder Plan
        # behalten darf — siehe Docstring, Punkt 2.
        behalten: set[tuple[str, str]] = set()
        for eintrag in (daten.get("attributes") or {}).get("rate_plans") or []:
            settings = eintrag.get("settings") or {}
            code = settings.get("rate_plan_code")
            if code is None:
                continue
            # String als Vergleichsschluessel: Channex liefert die Codes je OTA
            # als int (Booking) oder str (Sandbox) — ein Typvergleich verfehlte
            # jeden Code (dieselbe Lehre wie in `verwaiste_raten.portal_ratencodes`).
            code = str(code)
            plan_cx = str(eintrag.get("rate_plan_id"))
            name = (namen.get(plan_cx) or "").strip()
            titel = (titel_je_code.get(code) or "").strip()
            if name and titel and name.lower() == titel.lower():
                # Der eigene Plan zaehlt nur, wenn sein Eintrag ueberhaupt
                # etwas TRAEGT. Eine Attrappe (`occupancy`/`primary_occ` fehlen)
                # sendet keine Restriktionen — sie als „versorgt" zu lesen war
                # die Sperre, die den Fehlzustand einfror.
                #
                # Live gemessen (23.08.2026, Feriehus Grævlinge und FeWo
                # *Stjerneskud*): der Plan „Wochenrate" stand am Kanal mit
                # `occ=None, primary=None`. Der Abgleich meldete daraufhin
                # `angelegt = 0`, `nachgezogen = 0`, stiess keinen Content-Sync
                # an — und `objekt_kanal._eintrag_ist_vollwertig`, das die
                # Attrappe erkennen WUERDE, wurde nie erreicht. Im
                # Booking-Extranet blieb die Mindestaufenthalt-Zelle der
                # Wochenrate leer, waehrend die 7 bei Channex korrekt anlag.
                if _eintrag_traegt_restriktionen(settings):
                    belegt.add(code)  # eigener Plan, vollwertig zugeordnet
                else:
                    attrappen.add(code)
                continue
            if settings.get("primary_occ") is not True:
                continue  # weitere Rate an einem fremden Plan = Arbeit
            schluessel = (plan_cx, str(settings.get("room_type_code")))
            if schluessel not in behalten:
                behalten.add(schluessel)
                belegt.add(code)
        return belegt, attrappen

    def _plannamen_je_channex_id(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, str]:
        """{channex_rate_plan_id: lokaler Planname} fuer dieses Objekt."""
        plaene = (
            db.table("rate_plans")
            .select("id, name")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        name_je_lokal = {
            str(p["id"]): str(p.get("name") or "")
            for p in plaene if p.get("id")
        }
        if not name_je_lokal:
            return {}
        maps = (
            db.table("channex_rate_plan_map")
            .select("local_rate_plan_id, channex_rate_plan_id")
            .eq("tenant_id", tenant_id)
            .in_("local_rate_plan_id", list(name_je_lokal))
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        return {
            str(m["channex_rate_plan_id"]): name_je_lokal[str(m["local_rate_plan_id"])]
            for m in maps
            if m.get("channex_rate_plan_id")
            and str(m.get("local_rate_plan_id")) in name_je_lokal
        }

    def _portal_raten(self, conn: dict[str, Any]) -> list[dict[str, Any]]:
        """Die Raten, die das Portal unter dieser Kennung fuehrt — LESEND.

        `POST /channels/mapping_details` ist eine reine Leseabfrage (sie legt
        nichts an); es ist der einzige Weg an die Rate-TITEL, denn das
        bestehende Kanal-Mapping traegt nur Codes.

        Leere Liste bei JEDEM Fehlschlag → der Aufrufer legt nichts an
        (fail-closed, Wurzel 5). Ein eingeschraenkt antwortender Abruf darf
        nicht als „das Portal hat nur noch eine Rate" gelesen werden.

        Das ZIMMER wird gefiltert, wenn die Verbindung eines kennt
        (`ota_room_type_code` steht hier nicht in der Auswahl, deshalb ueber
        alle Zimmer): eine Booking-Kennung kann mehrere Zimmer fuehren, und ein
        Ferienobjekt ist genau eines davon. Zusammengefasst wird bewusst NICHT
        nach Zimmer getrennt — die Raten-TITEL sind der Schluessel, und
        `paar_fuer_portal_plan` verlangt ohnehin, dass ein Titel im ganzen
        Bestand eindeutig ist; sonst ordnet es fail-closed gar nicht zu.
        """
        portal = str(conn.get("ota_portal_code") or "")
        hotel_id = conn.get("ota_hotel_id")
        try:
            details = self._channex.get_channel_mapping_details(
                channel=portal, settings={"hotel_id": str(hotel_id)}
            )
        except ChannexError as exc:
            log.warning(
                "portal_raten_abgleich_abruf_fehlgeschlagen",
                portal=portal, hotel_id=hotel_id, error=str(exc)[:200],
            )
            return []
        raten: list[dict[str, Any]] = []
        gesehen: set[str] = set()
        for room in self._normalize_mapping_rooms(details) or []:
            for rate in room.get("rates") or []:
                code = rate.get("id")
                if code is None or str(code) in gesehen:
                    continue
                gesehen.add(str(code))
                raten.append(rate)
        return raten


def _eintrag_traegt_restriktionen(settings: dict[str, Any]) -> bool:
    """Traegt dieser Kanal-Eintrag die Restriktionen seines Paares?

    Nur mit `primary_occ is True` UND einer `occupancy`: `primary_occ` markiert
    den Restriktions-Traeger („Primary Rate – This will be the rate plan that
    sends the restrictions such as min stay or stop sell", Booking-Mapping-
    Guide), und ohne Belegung ist der Eintrag bei Channex eine Attrappe.

    Dieselbe Bedingung wie `objekt_kanal._eintrag_ist_vollwertig` fuer
    Paar-Kanaele — hier bewusst als eigene, engere Pruefung: dort geht es um
    „darf ich neu anlegen", hier um „ist die Rate versorgt". Ein Eintrag ohne
    Paar-Code (Airbnb: `listing_id`) erreicht diese Stelle nicht, der Aufrufer
    filtert ihn vorher aus.
    """
    return (
        settings.get("primary_occ") is True
        and settings.get("occupancy") is not None
    )
