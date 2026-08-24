"""Welche Portal-Raten hat dieses Objekt — und welche haben noch keinen Plan?

WOFUER: der Dialog „Preisplan anlegen" unter /objekte/<id>/preise. Bisher tippt
der Nutzer dort einen Namen. Die Zuordnung eines Preisplans zu einer Portal-Rate
laeuft aber AUSSCHLIESSLICH ueber Namensgleichheit
(`portal_raten_plaene.paar_fuer_portal_plan`: es sucht die EINE Rate, deren
Titel gleich dem Plannamen ist, und ordnet fail-closed gar nicht zu, wenn keine
oder mehrere passen). Tippt der Nutzer „Wochenpreis", waehrend Booking
„Wochenrate" fuehrt, entsteht ein Plan, der nie beim Portal ankommt: er steht
unter „Preise", `send_to_portals` ist gesetzt, und trotzdem traegt keine Rate
seine Restriktionen. Eine Attrappe ohne Fehlermeldung — genau die Klasse Fehler,
die niemand als Bug erkennt.

Dieser Endpunkt macht aus dem Textfeld eine AUSWAHL: der Nutzer nimmt den
Portal-Titel, statt ihn abzuschreiben.

REIN LESEND. Zwei Channex-Calls je verbundenem Portal, beide Leseabfragen:
  * `POST /channels/mapping_details` — was das Portal unter dieser Kennung
    fuehrt (Titel + Codes). Ein POST, aber eine reine Abfrage: sie legt nichts
    an; es gibt keinen GET-Pfad an die Rate-TITEL.
  * `GET /channels/{id}` — welche Rate schon auf ihren eigenen Plan zeigt.
Kein POST/PUT/PATCH/DELETE mit Wirkung, kein Job, kein Content-Sync.

WIEDERVERWENDET, NICHT NACHGEBAUT: `_kanaele_mit_raten`, `_portal_raten` und
`_belegte_ratencodes` sind die Bausteine des taeglichen Abgleichs
(`portal_raten_abgleich`). Eine zweite Lese-Regel „welche Rate ist versorgt"
waere die zweite Wahrheit, die genau dann auseinanderlaeuft, wenn es zaehlt: der
Dialog zeigte eine Rate als frei, und der Abgleich haette sie langst versorgt
(oder umgekehrt).

BELEGTE RATEN WERDEN MITGELIEFERT, nicht weggefiltert. Sie sind Information,
kein Rauschen: der Nutzer sieht ausgegraut, dass „Standard Rate" schon einen
Plan hat, statt sich zu fragen, wo sie geblieben ist — und legt keinen zweiten
Plan mit demselben Namen an (der waere nach `paar_fuer_portal_plan` nicht mehr
eindeutig zuordenbar und beide blieben ohne Mapping).

FAIL-CLOSED (Wurzel 5) — DER PUNKT DIESES ENDPUNKTS. „Keine Rate frei" und „der
Abruf ist fehlgeschlagen" sehen in einer leeren Liste identisch aus. Genau
deshalb gibt es `abruf_ok` JE PORTAL: ein `mapping_details` ohne Raten ist ein
fehlgeschlagener Abruf, kein Portal ohne Raten (dieselbe Begruendung wie in
`portal_raten_abgleich` und `verwaiste_raten.verwaiste_eintraege`). Ohne dieses
Feld behauptete die Oberflaeche bei jeder Channex-Stoerung „das Portal fuehrt
keine Raten" und der Nutzer tippte wieder von Hand — also genau der Fehler
zurueck, den der Dialog beheben soll.

Vier Zustaende, alle vier unterscheidbar:
  `abruf_ok: false, kanal_lesbar: *`    — Portal-Raten unbekannt. Nichts sagen.
  `abruf_ok: true, kanal_lesbar: false` — Raten bekannt, Belegung UNBEKANNT.
                                          Dann traegt jede Rate `belegt: null`,
                                          nicht `false`: den Nutzer einen Plan
                                          fuer eine bereits versorgte Rate
                                          anlegen zu lassen, waere derselbe
                                          Doppel-Plan wie oben.
  `abruf_ok: true, rates: []`           — kann nicht auftreten (leer ist der
                                          Fehlschlag), deshalb kein Sonderfall.
  `abruf_ok: true, kanal_lesbar: true`  — die vollstaendige Aussage.

AIRBNB IST NICHT DABEI, und zwar aus demselben Grund wie im Abgleich:
`PORTALE_MIT_RATEN` ist eine Allowlist, und Airbnb hat keine Raten-Ebene
(Channex-Doku: „Airbnb allows you to map only 1 rate plan";
`_normalize_mapping_rooms` liefert je Listing GENAU EINE „Rate" mit der
Listing-ID als Code, und die ist immer schon der Grundpreis). Ein Airbnb-Eintrag
in dieser Liste waere ein Angebot, fuer die Listing-ID einen Preisplan
„Feriehus Kornblomst" anzulegen — sinnlos und irrefuehrend. Airbnb-Verbindungen
erscheinen deshalb gar nicht; die Liste bleibt leer statt zu crashen.

OBERGRENZE (Wurzel 8): `MAX_RATEN_JE_PORTAL`. Der Abruf ist fremdgesteuert —
eine Booking-Kennung mit vielen Zimmern kann Dutzende Raten liefern, und eine
unbegrenzte Antwort waere eine unbegrenzte Liste im Dialog.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .common import ChannelManagerError, log
from .portal_raten_abgleich import PORTALE_MIT_RATEN
from .portal_raten_plaene import MAX_PLAENE_JE_ZIMMER, min_stay_aus_titel

# Harte Obergrenze der ausgelieferten Raten JE PORTAL.
#
# `MAX_PLAENE_JE_ZIMMER` (6) ist die Grenze fuer das ANLEGEN je Zimmer und passt
# hier nicht: diese Liste ist nicht je Zimmer, sondern je Kennung, und eine
# Booking-Kennung kann mehrere Zimmer fuehren (der Abgleich zieht die Raten
# ueber alle Zimmer zusammen). Sechs Raten waeren bei zwei Zimmern schon zu
# wenig und schnitten dem Nutzer echte Raten weg.
#
# Der Faktor ist die real gemessene Zimmerzahl je Booking-Kennung im Bestand
# (Ferienobjekte: 1, Hotel-Kennungen: wenige) — nicht geraten, sondern
# abgeleitet: 6 Raten je Zimmer x 5 Zimmer. Wer mehr braucht, hat kein
# Anzeige-Problem, sondern eine Kennung, die in diesen Dialog nicht gehoert.
MAX_RATEN_JE_PORTAL = MAX_PLAENE_JE_ZIMMER * 5


class PortalRatenAuswahlMixin:
    """Lesende Auswahl-Liste der Portal-Raten eines Objekts. Mixin des Service."""

    def portal_raten_auswahl(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """Je verbundenem Raten-Portal: seine Raten, mit `belegt` und Vorschlag.

        Rueckgabe:
        `{"property_id": str, "portals": [{"portal": str, "portal_label": str,
        "abruf_ok": bool, "kanal_lesbar": bool, "truncated": bool,
        "rates": [{"rate_plan_code": str, "title": str,
        "room_type_code": str|None, "portal": str, "belegt": bool|None,
        "min_stay": int|None}]}]}`

        `belegt` ist DREIWERTIG: `true` = hat schon einen eigenen Plan,
        `false` = frei, `null` = der Kanal war nicht lesbar, wir wissen es nicht
        (fail-closed, Wurzel 5 — die Oberflaeche darf daraus kein „frei" machen).
        `min_stay` ist ein VORSCHLAG aus dem Titel
        (`portal_raten_plaene.min_stay_aus_titel`: 7 bei Wochen-, 30 bei
        Monats-Woertern), `null` heisst „nicht erkannt" — kein geratener Wert
        (Wurzel 4).
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        # Wurzel 3: Load UND Scope in EINEM Schritt. Der Service-Key umgeht RLS;
        # ein ungescopter Load mit anschliessendem `!= tenant_id` ist genau der
        # Check, den man vergisst.
        load_scoped(
            db,
            "properties",
            property_id,
            tenant_id,
            columns="id",
            not_found=ChannelManagerError(
                "Objekt nicht gefunden.", status_code=404
            ),
        )
        # `_kanaele_mit_raten` filtert bereits auf `PORTALE_MIT_RATEN` UND
        # scopet auf (tenant_id, property_id) — Airbnb fliegt hier raus, nicht
        # erst in der Anzeige.
        conns = self._kanaele_mit_raten(  # type: ignore[attr-defined]
            db, tenant_id, property_id
        )
        portale = [
            self._portal_raten_eintrag(db, tenant_id, property_id, conn)
            for conn in conns
        ]
        log.info(
            "portal_raten_auswahl_gelesen",
            tenant_id=tenant_id, property_id=property_id,
            portale=len(portale),
            raten=sum(len(p["rates"]) for p in portale),
            fehlgeschlagen=[
                p["portal"] for p in portale if not p["abruf_ok"]
            ],
        )
        return {"property_id": property_id, "portals": portale}

    def _portal_raten_eintrag(
        self, db: Client, tenant_id: str, property_id: str,
        conn: dict[str, Any],
    ) -> dict[str, Any]:
        """Ein Portal dieser Liste — die beiden Lese-Calls und ihre Deutung."""
        portal = str(conn.get("ota_portal_code") or "")
        eintrag: dict[str, Any] = {
            "portal": portal,
            "portal_label": self._portal_label(portal),  # type: ignore[attr-defined]
            "abruf_ok": False,
            "kanal_lesbar": False,
            "truncated": False,
            "rates": [],
        }
        raten = self._portal_raten(conn)  # type: ignore[attr-defined]
        if not raten:
            # Fail-closed: LEER heisst „der Abruf lieferte nichts", nicht
            # „das Portal fuehrt keine Raten". `abruf_ok` bleibt false, damit
            # die Oberflaeche nicht „keine Raten frei" behauptet.
            log.warning(
                "portal_raten_auswahl_abruf_leer",
                tenant_id=tenant_id, property_id=property_id, portal=portal,
            )
            return eintrag
        eintrag["abruf_ok"] = True
        if len(raten) > MAX_RATEN_JE_PORTAL:
            # Wurzel 8: die Antwort des Portals ist fremdgesteuert. Gekappt
            # wird SICHTBAR (`truncated`), nicht still — sonst fehlte dem
            # Nutzer eine Rate, ohne dass es jemand merkt.
            log.warning(
                "portal_raten_auswahl_ueber_obergrenze",
                tenant_id=tenant_id, property_id=property_id, portal=portal,
                anzahl=len(raten), grenze=MAX_RATEN_JE_PORTAL,
            )
            raten = raten[:MAX_RATEN_JE_PORTAL]
            eintrag["truncated"] = True
        titel_je_code = {
            str(r.get("id")): (r.get("title") or "") for r in raten
        }
        # Dieselbe Belegungs-Regel wie der taegliche Abgleich, nicht eine
        # zweite: `None` = Kanal nicht lesbar.
        gelesen = self._belegte_ratencodes(  # type: ignore[attr-defined]
            db, tenant_id, property_id, conn, titel_je_code
        )
        belegt: set[str] = set()
        attrappen: set[str] = set()
        if gelesen is not None:
            eintrag["kanal_lesbar"] = True
            belegt, attrappen, _kanal_eintraege = gelesen
        eintrag["rates"] = [
            self._rate_eintrag(
                rate, portal=portal, kanal_lesbar=eintrag["kanal_lesbar"],
                belegt=belegt, attrappen=attrappen,
            )
            for rate in raten
        ]
        return eintrag

    @staticmethod
    def _rate_eintrag(
        rate: dict[str, Any], *, portal: str, kanal_lesbar: bool,
        belegt: set[str], attrappen: set[str],
    ) -> dict[str, Any]:
        """Eine Rate in der Form, die der Dialog braucht.

        `title` ist der Portal-Titel EXAKT (nur Rand-Leerzeichen weg): er ist
        der Zuordnungs-Schluessel, nicht ein Anzeigetext. Wer ihn hier
        normalisiert (Gross-/Kleinschreibung, Bindestriche), erzeugt genau den
        Plan, der nicht mehr namensgleich ist.

        Eine ATTRAPPE zaehlt als `belegt: true`: ihr Plan EXISTIERT (nur seine
        Kanal-Zuordnung traegt nichts). Ihn ein zweites Mal anzulegen hilft
        nicht, sondern macht den Namen mehrdeutig, und dann ordnet
        `paar_fuer_portal_plan` fail-closed GAR NICHTS mehr zu. Geheilt wird die
        Attrappe vom taeglichen Abgleich (der zaehlt sie als `zu_heilen`), nicht
        von einem zweiten Plan.
        """
        code = str(rate.get("id"))
        titel = (rate.get("title") or "").strip()
        raum = rate.get("room_type_code")
        return {
            "rate_plan_code": code,
            "title": titel,
            "room_type_code": None if raum is None else str(raum),
            "portal": portal,
            # Dreiwertig, siehe Modul-Kopf: ohne lesbaren Kanal ist die
            # Belegung UNBEKANNT und darf nicht als `false` erscheinen.
            "belegt": (
                (code in belegt or code in attrappen) if kanal_lesbar else None
            ),
            "min_stay": min_stay_aus_titel(titel),
        }


__all__ = ["MAX_RATEN_JE_PORTAL", "PORTALE_MIT_RATEN", "PortalRatenAuswahlMixin"]
