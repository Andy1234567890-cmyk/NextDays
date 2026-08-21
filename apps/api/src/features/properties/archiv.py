"""Objekt archivieren statt löschen (0416).

DER FALL: Ein Beta-Betrieb hat ein Ferienhaus gekündigt („Fewo-Mosbjerg-Sindal")
und wollte es loswerden. Löschen scheitert an der Datenbank —
`reservations.property_id` steht auf RESTRICT, und das Objekt trägt 10
abgeschlossene Aufenthalte. Der Betrieb sah nur den rohen PostgREST-Fehler
(„violates foreign key constraint reservations_property_id_fkey"), also einen
technischen Text ohne Ausweg.

WARUM RESTRICT RICHTIG IST: An den Buchungen hängt die Historie — Umsatz,
Eigentümer-Abrechnung, Gastprofile. Ein Objekt zu löschen, dessen Aufenthalte
abgerechnet sind, nähme all das mit. Die Sperre gehört also nicht gelockert,
sondern ERKLÄRT, und es braucht den Weg daneben.

ZWEI TEILE, und der zweite ist der, den man vergisst:

  1. `archived_at` — das Objekt verschwindet aus den Arbeitslisten.
  2. Das VERTRAGSENDE auf heute (0355/0359). Ein reines Ausblenden liesse
     Booking und Airbnb WEITERVERKAUFEN: ein Tag ohne `availability`-Zeile gilt
     überall als offen (siehe `vertragsende.py`). Erst
     `vertragsende_durchsetzen` schreibt echte Sperrnächte und meldet sie an
     die Portale.

DIE LISTE (`PropertiesService.list`, `?archiviert=`) zeigt entweder den
geführten Bestand ODER das Archiv, nie beides zusammen: ein aufgegebenes Haus
zwischen den geführten wäre genau das Rauschen, das das Archiv beseitigen soll.
Archivierte Objekte bleiben per Direktlink erreichbar — ihre Buchungen,
Abrechnungen und Eigentümer-Berichte hängen daran.

Eigenes Modul, weil `service.py` an der Zeilengrenze steht (pylint C0302) und
das Archiv ein abgeschlossenes Thema mit eigener Begründung ist — dasselbe
Muster wie `vertragsende.py` und `gebaeude.py`.
"""
from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .errors import PropertyError
from .schemas import PropertyResponse, PropertyStatus
from .vertragsende import vertragsende_durchsetzen

log = get_logger("nextdays.properties.archiv")


def channex_abraeumen(db: Client, tenant_id: str, property_id: str) -> str:
    """Das Objekt bei Channex ENTFERNEN — Kanäle ab, Property gelöscht.

    WARUM DAS SEIN MUSS: Channex rechnet je gefuehrter Property ab. Ein
    gekuendigtes Objekt, das dort weiterlaeuft, kostet jeden Monat Geld — und
    es bleibt ein Verkaufsrisiko: solange ein Kanal aktiv haengt, verkauft die
    OTA weiter, waehrend unsere Pushes aufhoeren (Blindverkauf → Overbooking).
    „Aus unserer Liste ausgeblendet" ist deshalb NICHT abgeraeumt.

    DIE REIHENFOLGE IST ZWINGEND (und Channex erzwingt sie auch):
      1. jeden Kanal der Property deaktivieren,
      2. die lokale Kanal-Verbindung als inaktiv spiegeln,
      3. die Property bei Channex loeschen (`force`, weil abgebaute Kanaele
         sonst noch als Referenz zaehlen),
      4. das Mapping lokal soft-loeschen.
    Ohne Schritt 1 antwortet `DELETE properties/{id}` mit 422.

    Gibt einen Kurzbefund fuer das Log/die Antwort zurueck. Wirft NICHT: der
    Aufrufer hat den Zustand lokal schon geschrieben, und ein Channex-Ausfall
    darf die Archivierung nicht zurueckdrehen (Wurzel 5). Was nicht geklappt
    hat, steht im Befund und im Log — dort ist es auffindbar, statt still zu
    verschwinden.
    """
    # Import hier, nicht oben: der channel_manager-Slice importiert seinerseits
    # aus properties (Objektdaten fuer den Content-Sync) — ein Modul-Import
    # waere ein Zyklus.
    from src.features.channel_manager.channex_client import (  # noqa: PLC0415
        ChannexClient,
        ChannexError,
    )

    zeilen = (
        db.table("channex_property_map")
        .select("id, channex_property_id, channex_hotel_policy_id")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .is_("deleted_at", "null")
        .execute()
    ).data or []
    if not zeilen:
        return "kein Channex-Mapping"

    client = ChannexClient()
    if not client.is_configured:
        # Kein Schluessel hinterlegt: das Mapping trotzdem lokal schliessen,
        # sonst bliebe es als Karteileiche stehen und der naechste Sync griffe
        # wieder darauf zu.
        _map_schliessen(db, tenant_id, [z["id"] for z in zeilen])
        return "Channex nicht konfiguriert — Mapping lokal geschlossen"

    befunde: list[str] = []
    for zeile in zeilen:
        chx = zeile.get("channex_property_id")
        if not chx:
            _map_schliessen(db, tenant_id, [zeile["id"]])
            continue
        # 1. NUR die Zuordnungen DIESES Objekts vom Kanal loesen.
        #
        # NICHT `deactivate_channel` — das war ein schwerer Fehler in der ersten
        # Fassung: bei Airbnb traegt EIN Kanal alle Objekte des Kontos (live
        # gemessen 21.08.2026: ein Kanal, 18 Properties, 17 Zuordnungen). Den
        # Kanal abzuschalten, um EIN Objekt zu archivieren, haette die 17
        # anderen mit von Airbnb genommen.
        #
        # Channex hat das verhindert und mit 422
        # `{"channel": ["remove mappings before"]}` geantwortet — der Fehler war
        # ein Schutz, kein Hindernis. Richtig ist der feine Schnitt: die
        # Zuordnungen dieses Objekts loesen (`delete_channel_mapping`), den
        # Kanal selbst unberuehrt lassen.
        #
        # Die `mapping_id` steht ausschliesslich im Kanal-Objekt unter
        # `attributes.rate_plans[].id`; zugeordnet wird sie ueber die
        # Channex-Rate-Plan-IDs DIESER Property.
        try:
            eigene_rate_plans = {
                r.get("id")
                for r in (
                    client.get(
                        "rate_plans", params={"filter[property_id]": chx}
                    ).get("data")
                    or []
                )
                if r.get("id")
            }
            kanaele = (client.list_channels(property_id=chx).get("data") or [])
            geloest = 0
            for kanal in kanaele:
                kid = kanal.get("id") or (kanal.get("attributes") or {}).get("id")
                if not kid:
                    continue
                attrs = (
                    client.get_channel(str(kid)).get("data") or {}
                ).get("attributes") or {}
                for zuordnung in attrs.get("rate_plans") or []:
                    if zuordnung.get("rate_plan_id") in eigene_rate_plans:
                        client.delete_channel_mapping(
                            str(kid), str(zuordnung["id"])
                        )
                        geloest += 1
            if geloest:
                befunde.append(f"{geloest} Kanal-Zuordnung(en) gelöst")
        except ChannexError as exc:
            befunde.append(f"Zuordnungen lösen fehlgeschlagen: {exc.message}")
            log.warning(
                "archiv_channex_mapping_loesen_fehlgeschlagen",
                tenant_id=tenant_id, property_id=property_id,
                channex_property_id=chx, error=exc.message,
            )
            # NICHT loeschen, solange eine Zuordnung steht: die Property waere
            # bei Channex verwaist, waehrend der Kanal sie weiter verkauft.
            continue
        # 2. Lokale Kanal-Verbindungen spiegeln (Wurzel 1).
        db.table("channex_channel_connection").update({"is_active": False}).eq(
            "tenant_id", tenant_id
        ).eq("channex_property_id", chx).execute()
        # 3. Hotel Policy abräumen — best effort (Channex raeumt sie mit der
        #    Property ohnehin ab).
        policy_id = zeile.get("channex_hotel_policy_id")
        if policy_id:
            try:
                client.delete_hotel_policy(policy_id)
            except ChannexError as exc:
                log.warning(
                    "archiv_channex_policy_loeschen_fehlgeschlagen",
                    policy_id=policy_id, error=exc.message,
                )
        # 4. Die Property bei Channex loeschen. DAS ist der Schritt, der die
        #    Kosten beendet — ein blosses Trennen liesse sie dort stehen
        #    (Channex raeumt erst nach 90 Tagen ohne Kanal selbst ab).
        try:
            client.delete_property(chx, force=True)
            befunde.append(f"Channex-Property {chx} gelöscht")
        except ChannexError as exc:
            befunde.append(f"Löschen bei Channex fehlgeschlagen: {exc.message}")
            log.warning(
                "archiv_channex_property_loeschen_fehlgeschlagen",
                tenant_id=tenant_id, property_id=property_id,
                channex_property_id=chx, error=exc.message,
            )
        # 5. Mapping lokal schliessen — auch wenn (4) scheiterte: die Kanäle
        #    sind ab, das Objekt ist bei uns aus dem Verkauf. Bliebe das
        #    Mapping offen, wuerde der naechste Sync es wieder anfassen.
        _map_schliessen(db, tenant_id, [zeile["id"]])

    return "; ".join(befunde) if befunde else "abgeräumt"


def _map_schliessen(db: Client, tenant_id: str, map_ids: list[str]) -> None:
    """Mapping soft-loeschen und die Policy-ID nullen.

    Die ID MUSS mit weg: bliebe sie stehen, reanimierte ein spaeterer Reconnect
    dieselbe Zeile, und der Content-Sync riefe `update_hotel_policy` auf eine
    tote ID → 404 und dauerhaft roter Sync (dieselbe Falle wie in
    `property_mapping.disconnect_property`).
    """
    for mid in map_ids:
        db.table("channex_property_map").update(
            {
                "deleted_at": datetime.now(UTC).isoformat(),
                "sync_enabled": False,
                "channex_hotel_policy_id": None,
            }
        ).eq("id", mid).eq("tenant_id", tenant_id).execute()


class ArchivMixin:
    """Archivieren/Reaktivieren eines Objekts + Löschschutz.

    Mixin des PropertiesService (siehe service.py). Nutzt von dort
    `_require_tenant`, `_db`, `_sync_subscription_quantity` und
    `_portals_state_by_property`.
    """

    def archivieren(
        self, ctx: AuthContext, property_id: str, *, archivieren: bool
    ) -> PropertyResponse:
        """Objekt archivieren (gekündigt/aufgegeben) bzw. wieder in den Bestand.

        DER FALL, DER DAZU FÜHRTE: Ein Beta-Betrieb hat ein Ferienhaus
        gekündigt. `delete()` ist dafür der falsche Weg und scheitert ohnehin —
        `reservations.property_id` steht auf RESTRICT, und das Objekt trägt
        10 abgeschlossene Aufenthalte (live geprüft 21.08.2026). Ein hartes
        Löschen nähme deren Historie mit: Umsatz, Eigentümer-Abrechnung,
        Gastprofile. Der Betrieb sah bisher nur den rohen Datenbankfehler.

        ZWEI DINGE PASSIEREN, und beide sind nötig:

        1. `archived_at` setzen — das Objekt verschwindet aus den Listen.
        2. Das VERTRAGSENDE auf heute setzen und durchsetzen. Ein reines
           Ausblenden hätte Booking und Airbnb weiter verkaufen lassen: ein Tag
           ohne `availability`-Zeile gilt überall als offen (siehe
           vertragsende.py). Erst `vertragsende_durchsetzen` schreibt echte
           Sperrnächte und meldet sie an die Portale.

        Beide Richtungen über DIESELBE Methode (Wurzel 1): beim Aufheben wird
        `archived_at` geleert UND das Vertragsende zurückgenommen, womit die
        gesperrten Nächte wieder frei und als verfügbar gemeldet werden. Sonst
        bliebe ein reaktiviertes Objekt unverkäuflich, ohne dass man sähe warum.

        BESTEHENDE BUCHUNGEN BLEIBEN GÜLTIG — das ist die Entscheidung aus 0359
        und gilt hier genauso: gesperrt werden die FREIEN Tage. Ein Gast mit
        Bestätigung wird bedient, auch hinter dem Vertragsende.
        """
        tenant_id = self._require_tenant(ctx)
        row = load_scoped(
            self._db,
            "properties",
            property_id,
            tenant_id,
            not_found="Objekt nicht gefunden.",
        )
        heute = date.today()
        # Das Vertragsende NUR beim Archivieren auf heute setzen. Beim Aufheben
        # wird es geleert — ein bereits von Hand gepflegtes Enddatum (etwa ein
        # künftiges) ginge dabei verloren, deshalb bleibt es stehen, wenn es
        # NICHT von dieser Archivierung stammt (also in der Zukunft liegt).
        if archivieren:
            neues_ende: date | None = heute
        else:
            altes = row.get("contract_end_date")
            altes_datum = date.fromisoformat(str(altes)) if altes else None
            neues_ende = (
                altes_datum if altes_datum and altes_datum > heute else None
            )
        payload: dict[str, Any] = {
            "archived_at": (
                datetime.now(UTC).isoformat() if archivieren else None
            ),
            "contract_end_date": neues_ende.isoformat() if neues_ende else None,
        }
        res = (
            self._db.table("properties")
            .update(payload)
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .execute()
        )
        if not res.data:
            raise PropertyError("Objekt nicht gefunden.", status_code=404)

        # Kalender + Portale auf den neuen Stand bringen. Best-effort: die
        # Archivierung selbst ist geschrieben, und ein Portal-Fehler darf sie
        # nicht zurückdrehen — sonst stünde das Objekt weiter in der Liste,
        # obwohl der Betrieb es abgehakt hat (Wurzel 5).
        try:
            gesperrt = vertragsende_durchsetzen(
                self._db, tenant_id, property_id, neues_ende, heute=heute
            )
        except Exception as exc:  # noqa: BLE001 — Hauptpfad darf nicht kippen
            gesperrt = -1
            log.warning(
                "property_archive_contract_end_failed",
                tenant_id=tenant_id,
                property_id=property_id,
                error=str(exc)[:200],
            )

        # DAS OBJEKT MUSS AUCH BEI CHANNEX RAUS — nicht nur aus unserer Liste.
        #
        # Channex rechnet je gefuehrter Property ab: ein gekuendigtes Objekt,
        # das dort weiterlaeuft, kostet jeden Monat Geld. Und solange ein Kanal
        # aktiv haengt, verkauft die OTA weiter, waehrend unsere Pushes
        # aufhoeren — Blindverkauf. „Archiviert" hiess vorher nur „bei uns
        # ausgeblendet", und genau das war der Fehler.
        #
        # Nur beim Archivieren. Beim Zurueckholen wird NICHT automatisch neu
        # verbunden: das Anlegen bei Channex braucht Mapping-Entscheidungen
        # (Zimmertyp, Rate-Plan, Kanal), die niemand raten darf — der Betrieb
        # verbindet das Objekt dann bewusst neu (Wurzel 4).
        channex_befund = ""
        if archivieren:
            channex_befund = channex_abraeumen(self._db, tenant_id, property_id)

        # Objektzahl ans Abo melden (Wurzel 1: Gegenzustand). Ein archiviertes
        # Objekt ist nicht mehr abrechenbar — dieselbe Regel wie bei delete().
        if row.get("status") == PropertyStatus.active.value:
            self._sync_subscription_quantity(tenant_id)

        log.info(
            "property_archived" if archivieren else "property_unarchived",
            tenant_id=tenant_id,
            property_id=property_id,
            sperrtage=gesperrt,
            channex=channex_befund,
        )
        # Das Objekt frisch ueber `get()` zurueckgeben statt die Zeile hier
        # selbst ins Schema zu heben: `_row`/`_derive_channels` liegen im
        # Service-Modul, das DIESES Mixin importiert — ein Import zurueck waere
        # ein Zirkelbezug. `get()` ist ohnehin der eine Weg, auf dem ein Objekt
        # die Oberflaeche erreicht (samt Kanal-Chips).
        return self.get(ctx, property_id)

    def loeschschutz_pruefen(self, tenant_id: str, property_id: str) -> None:
        """Vor dem Löschen: hängen Buchungen dran? Dann 409 mit dem Ausweg.

        `reservations.property_id` steht auf RESTRICT (bewusst — die Historie
        der Aufenthalte hängt daran: Umsatz, Eigentümer-Abrechnung,
        Gastprofile). Ohne diese Prüfung antwortete die Route mit dem rohen
        PostgREST-Fehler:

            update or delete on table "properties" violates foreign key
            constraint "reservations_property_id_fkey"

        Genau das hat ein Beta-Betrieb am 21.08.2026 gesehen, als er sein
        gekündigtes Ferienhaus loswerden wollte (10 abgeschlossene
        Aufenthalte). Ein technischer Fehlertext ohne Ausweg ist die
        schlechteste Antwort: der Betrieb weiß daraus nicht, dass es das
        Archiv gibt.
        """
        anzahl = (
            self._db.table("reservations")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).count or 0
        if anzahl:
            raise PropertyError(
                f"Dieses Objekt hat {anzahl} Buchungen und kann nicht gelöscht "
                "werden — ihre Historie (Umsatz, Eigentümer-Abrechnung) hängt "
                "daran. Archiviere es stattdessen: es verschwindet aus den "
                "Listen, wird nirgends mehr verkauft, und alle Daten bleiben "
                "erhalten.",
                status_code=409,
            )
