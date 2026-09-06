"""Schlösser: Verbindung, Geräte, Zuordnung und der Zugang je Buchung.

DIE FACHLICHEN ENTSCHEIDUNGEN, die hier und nicht im Client stehen:

1. ZWEI ZEITPUNKTE, NICHT EINER. Der Zugang entsteht bei Buchungsbestätigung
   (damit die Buchung sofort einen Datensatz hat), wird aber erst
   `vorlauf_stunden` vor Gültigkeitsbeginn an Seam gegeben — Standard 72 h.
   Hostaway begründet genau diesen Wert ausdrücklich mit dem Wiederholfenster
   bei Fehlschlag, Guesty nennt denselben. Für Last-Minute-Buchungen greift
   der Sofortpfad.

2. PUFFER, KEINE ABSOLUTZEIT. Gültigkeit ist Check-in minus `puffer_vor_min`
   bis Check-out plus `puffer_nach_min`. Alle Referenz-PMS machen es so,
   Lodgify mit 30 Minuten als Default.

3. RUNDUNG NUR NACH AUSSEN. igloohome nimmt ausschließlich ganze Stunden.
   Deshalb wird der Beginn ABGERUNDET und das Ende AUFGERUNDET — der Code
   gilt dann etwas länger als der Aufenthalt, aber NIE kürzer. Andersherum
   stünde ein Gast mit gültiger Buchung vor verschlossener Tür.

4. DER WIDERRUF IST EHRLICH. Bei Offline-Codes (igloohome algoPIN, dormakaba
   Oracode, Lockly) ist ein ausgegebener Code physikalisch nicht entziehbar —
   Seam wörtlich: „you cannot revoke a created offline access code before the
   configured expiration date". Der Storno wird dann als
   `nicht_widerrufbar` verbucht, mit Klartext und Ablaufdatum, NICHT als
   „widerrufen". Ein PMS, das hier „zurückgezogen" anzeigt, während der Code
   weiterläuft, produziert genau die stille Falschaussage aus Wurzel 5b:
   plausibel aussehend und von niemandem als Bug erkennbar.

5. DER HTTP-200 IST KEIN BEWEIS. Auch bei Online-Schlössern wird eine
   Löschung erst wirksam, wenn das Gerät sie abholt. Deshalb ist
   `am_geraet_at` ein eigenes Feld, gesetzt vom Webhook — nicht aus dem
   Erfolg des Anlege-Aufrufs geschlossen.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.supabase import load_scoped
from src.features.reservations._base import anzeigename
from src.features.subscriptions.schemas import (
    SCHLOSS_ANBIETER,
    kennung_aus_schloss_modul,
    schloss_modul_key,
)

from .seam_client import (
    SeamClient,
    SeamFehler,
    SeamGeraet,
    SeamNichtKonfiguriert,
)

log = get_logger("nextdays.schloesser")

# Obergrenze für den Zeitraum eines Zugangs. igloohome kann stundenbasiert
# maximal 672 Stunden (28 Tage) und tagesbasiert 367 Tage; darüber lehnt der
# Hersteller ab. Ein unbegrenzter Bereich wäre zudem Wurzel 8 (jeder
# unbegrenzte Datums-Span bekommt eine harte Obergrenze -> 422).
_MAX_TAGE = 367

# Ab wann ein Zugang als „gleich fällig" gilt und sofort angelegt wird, statt
# auf den Vorlauf-Tick zu warten (Last-Minute-Buchung).
_SOFORT_SCHWELLE = timedelta(hours=1)


class SchloesserFehler(HTTPException):
    """Fachlicher Fehler dieses Slices, mit Klartext für die Oberfläche."""

    def __init__(self, detail: str, status_code: int = 422) -> None:
        super().__init__(status_code=status_code, detail=detail)


@dataclass(frozen=True)
class Gueltigkeit:
    """Der an Seam zu übergebende Zeitraum, schon gerundet."""

    beginn: datetime
    ende: datetime


def als_zeitpunkt(wert: object) -> datetime | None:
    """Ein Datum aus der DB als aware datetime (UTC).

    Ein reines Datum („2026-09-10") wird als Mitternacht UTC gelesen. Die
    Uhrzeiten des Objekts stehen in der Buchung bzw. der Objekt-Policy und
    werden über den Puffer verrechnet — hier bewusst keine erfundene
    Standard-Checkin-Zeit (Wurzel 4).

    Modulfunktion und nicht Methode: der Worker-Tick braucht sie auch, und
    eine private Methode von außen zu rufen wäre die Art Kopplung, die beim
    nächsten Umbau bricht.
    """
    if wert is None:
        return None
    text = str(wert).strip()
    if not text:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        text += "T00:00:00+00:00"
    try:
        zeit = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return zeit if zeit.tzinfo else zeit.replace(tzinfo=UTC)


def objekt_zone(name: object) -> ZoneInfo | None:
    """Die Zeitzone eines Objekts. Unbekanntes ergibt None, nicht UTC-als-ob.

    Dieselbe Lesart wie in der Aufgaben-Engine (`tasks/engine._zone`): eine
    geratene Zone verschiebt jeden Zugang still um Stunden (Wurzel 4).
    """
    if not isinstance(name, str) or not name.strip():
        return None
    try:
        return ZoneInfo(name.strip())
    except (ZoneInfoNotFoundError, ValueError):
        log.warning("schloesser_zeitzone_unbekannt", extra={"zone": name})
        return None


def uhrzeit(wert: object) -> time | None:
    """Eine Policy-Uhrzeit („16:00", „11:00:00") als `time`.

    `reservations.checkin_time`/`checkout_time` sind Freitext-Strings
    (Migration 0049, kanal-/policy-abhängig). Unlesbares ergibt `None` — dann
    gilt der TAG, nicht eine erfundene Standardstunde.
    """
    if not isinstance(wert, str) or not wert.strip():
        return None
    text = wert.strip()
    for form in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(text, form).time()
        except ValueError:
            continue
    return None


def als_ortszeit(
    tag: object, stunde: time | None, zone: ZoneInfo | None
) -> datetime | None:
    """Tag + Uhrzeit in der ZONE DES OBJEKTS → UTC-Zeitstempel.

    DER KERN DER ZEITRECHNUNG DIESES SLICES, und der Grund, warum es diesen
    Helfer gibt: „Anreise am 10.07., Check-in 16:00" meint 16:00 VOR ORT. Wer
    das reine Datum als Mitternacht UTC liest und den Puffer darauf rechnet,
    erzeugt für ein Objekt in Athen (UTC+3) einen Code, der am Abreisetag um
    03:30 Ortszeit ausläuft — der Gast kommt am letzten Morgen nicht mehr in
    die Wohnung. Dieselbe Fehlerklasse hat am 03.09.2026 die Aufgaben-Engine
    getroffen (Migration 0258).

    Ohne bekannte Zone bleibt es bei UTC: die ehrliche Auskunft für ein Objekt
    ohne gepflegte Zeitzone, keine geratene Ortszeit.
    """
    tag_wert = als_datum(tag)
    if tag_wert is None:
        return None
    return datetime.combine(
        tag_wert, stunde or time(0, 0), tzinfo=zone or UTC
    ).astimezone(UTC)


def als_datum(wert: object) -> date | None:
    """Ein Datum aus der DB als `date` (auch aus einem Zeitstempel)."""
    zeit = als_zeitpunkt(wert)
    return zeit.date() if zeit else None


class SchloesserService:
    """Alle Schreib- und Lesevorgänge rund um Schlösser."""

    def __init__(self, db: Client) -> None:
        self.db = db
        self._client = SeamClient(
            get_settings().seam_api_key.get_secret_value()
        )

    # =====================================================================
    # Diagnose
    # =====================================================================
    def workspace_pruefen(self) -> dict:
        """Ob der Seam-Schlüssel funktioniert (durchgereicht an den Client)."""
        return self._client.workspace_pruefen()

    # =====================================================================
    # Verbindung
    # =====================================================================
    def gebuchte_anbieter(self, tenant_id: str) -> list[str]:
        """Die Schloss-Hersteller, die dieser Betrieb gebucht hat (0577).

        JE ANBIETER EIN MODUL: der Betrieb bucht genau den Hersteller, dessen
        Schlösser er besitzt. Nur diese erscheinen in der Anmeldemaske — ein
        nicht gebuchter Hersteller ist dort nicht wählbar, und ein Gerät an
        einem nicht gebuchten Konto bekommt keine Codes.

        EINE Abfrage statt 32 (`in_` auf die Modulschlüssel): 32 Einzelabfragen
        bei jedem Öffnen der Maske wären dieselbe Art Fehler wie ein N+1 im
        Kalender.
        """
        schluessel = [schloss_modul_key(k) for k in SCHLOSS_ANBIETER]
        zeilen = (
            self.db.table("tenant_module_entitlement")
            .select("module_key, active")
            .eq("tenant_id", tenant_id)
            .in_("module_key", schluessel)
            .execute()
        ).data or []
        gebucht: list[str] = []
        for z in zeilen:
            if not z.get("active"):
                continue
            kennung = kennung_aus_schloss_modul(str(z.get("module_key") or ""))
            if kennung:
                gebucht.append(kennung)
        return sorted(gebucht)

    def verbindung_starten(self, tenant_id: str, rueckkehr_url: str) -> dict:
        """Ein Connect Webview für den Betrieb erzeugen.

        Der Kunde meldet sich in der Maske bei SEINEM Hersteller an. Wir
        legen die Zeile erst an, wenn Seam eine Webview-Kennung geliefert hat
        — sonst sammelt die Tabelle Zeilen für abgebrochene Versuche.

        DER TENANT WIRD HIER GEBRAUCHT (0577): in der Maske erscheinen nur die
        Hersteller, deren Modul der Betrieb gebucht hat. Ohne gebuchtes Modul
        gibt es keine Auswahl — und damit auch keine Verbindung, für die
        niemand zahlt.

        Ohne ein einziges gebuchtes Anbieter-Modul schlägt der Aufruf klar
        fehl, statt eine leere Maske zu öffnen: eine Auswahl ohne Optionen ist
        für den Betrieb nicht unterscheidbar von einer Störung.
        """
        gebucht = self.gebuchte_anbieter(tenant_id)
        if not gebucht:
            raise SchloesserFehler(
                # Einfache Anführungszeichen im Text: das typografische
                # schließende beendet sonst das String-Literal (Projektregel).
                "Es ist noch kein Schloss-Hersteller gebucht. Unter "
                "‚Erweiterungen‘ den Hersteller Ihrer Schlösser aktivieren — "
                "danach lässt sich das Konto verbinden.",
                status_code=409,
            )
        return self._client.webview_erzeugen(
            rueckkehr_url, anbieter=gebucht, tenant_id=tenant_id
        )

    def verbindung_uebernehmen(
        self, tenant_id: str, webview_id: str
    ) -> dict:
        """Nach der Rückkehr aus dem Webview: das verbundene Konto speichern.

        IDEMPOTENT (Wurzel 2): Der Kunde landet nach dem Webview auf unserer
        Seite, und ein Neuladen ruft das hier ein zweites Mal. Deshalb wird
        eine vorhandene Zeile zur selben `connected_account_id`
        WIEDERVERWENDET statt eine zweite anzulegen; die UNIQUE-Bedingung in
        0573 ist der Backstop, falls zwei Aufrufe gleichzeitig kommen.
        """
        zustand = self._client.webview_lesen(webview_id)
        konto_id = zustand.get("connected_account_id")
        if not konto_id:
            # Kein Fehler, sondern der normale Zwischenzustand: der Kunde hat
            # die Anmeldung noch nicht abgeschlossen.
            return {"status": "pending", "connectionId": None}

        vorhanden = (
            self.db.table("seam_connection")
            .select("id, tenant_id")
            .eq("connected_account_id", str(konto_id))
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            zeile = vorhanden[0]
            # Fremder Tenant: dasselbe Schloss-Konto darf nicht zwei Betrieben
            # gehören. Klar fehlschlagen statt still übernehmen.
            if str(zeile.get("tenant_id")) != str(tenant_id):
                raise SchloesserFehler(
                    "Dieses Schloss-Konto ist bereits mit einem anderen "
                    "Betrieb verbunden.",
                    status_code=409,
                )
            self.db.table("seam_connection").update(
                {"status": "connected", "error_code": None}
            ).eq("id", zeile["id"]).eq("tenant_id", tenant_id).execute()
            return {"status": "connected", "connectionId": zeile["id"]}

        eingefuegt = (
            self.db.table("seam_connection")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "connected_account_id": str(konto_id),
                    "provider": str(
                        zustand.get("accepted_provider")
                        or zustand.get("device_selection_mode")
                        or "unbekannt"
                    ).lower(),
                    "status": "connected",
                    "connected_at": datetime.now(UTC).isoformat(),
                }
            )
            .execute()
        ).data or []
        neu_id = eingefuegt[0]["id"] if eingefuegt else None
        # Direkt die Geräte holen: ohne sie ist die Verbindung für den Kunden
        # eine leere Seite, und er weiß nicht, ob es geklappt hat.
        if neu_id:
            self.geraete_abgleichen(tenant_id, neu_id)
        return {"status": "connected", "connectionId": neu_id}

    def verbindung_aus_ereignis(
        self, tenant_id: str, konto_id: str, provider: str | None = None
    ) -> str | None:
        """Die Verbindung aus einem Webhook-Ereignis anlegen oder bestätigen.

        WARUM ES DIESEN ZWEITEN WEG GIBT: `verbindung_uebernehmen` hängt an
        der Rückkehr aus dem Webview — schließt der Kunde das Fenster, bevor
        er zurückgeleitet wird, ist sein Schloss-Konto bei Seam verbunden und
        bei uns unsichtbar. Seam meldet denselben Vorgang zusätzlich als
        `connected_account.connected`; dieser Weg fängt genau den Fall.

        Der Mandant kommt AUSSCHLIESSLICH aus der `custom_metadata`, die wir
        beim Erzeugen des Webviews selbst gesetzt haben (Wurzel 3) — nie aus
        einem anderen Feld der Nutzlast, die angreiferkontrolliert ist.

        IDEMPOTENT (Wurzel 2): Redelivery und der parallele Rückkehr-Pfad
        laufen beide hier durch. Eine vorhandene Zeile wird bestätigt, nicht
        verdoppelt.
        """
        vorhanden = (
            self.db.table("seam_connection")
            .select("id, tenant_id")
            .eq("connected_account_id", str(konto_id))
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            zeile = vorhanden[0]
            if str(zeile.get("tenant_id")) != str(tenant_id):
                # Dasselbe Schloss-Konto bei zwei Betrieben: hier NICHT
                # werfen, sondern stehen lassen und laut loggen — ein
                # Webhook darf keinen Zustand fremder Mandanten anfassen.
                log.warning(
                    "schloesser.verbindung_fremder_tenant",
                    extra={"connected_account_id": str(konto_id)},
                )
                return None
            self.db.table("seam_connection").update(
                {"status": "connected", "error_code": None}
            ).eq("id", zeile["id"]).eq("tenant_id", tenant_id).execute()
            return str(zeile["id"])

        eingefuegt = (
            self.db.table("seam_connection")
            .insert(
                {
                    "tenant_id": str(tenant_id),
                    "connected_account_id": str(konto_id),
                    "provider": str(provider or "unbekannt").lower(),
                    "status": "connected",
                    "connected_at": datetime.now(UTC).isoformat(),
                }
            )
            .execute()
        ).data or []
        neu_id = str(eingefuegt[0]["id"]) if eingefuegt else None
        if neu_id:
            # Ohne Geräte ist die Verbindung für den Kunden eine leere Seite —
            # aber sie darf den Webhook NICHT kippen. Der Abgleich ruft Seam,
            # und jeder Fehler dort (Timeout, Rate-Limit, Konto schon wieder
            # weg) käme sonst als 500 heraus; Svix wiederholt bei 5xx endlos,
            # und die Verbindung STEHT zu diesem Zeitpunkt bereits.
            # Live gesehen (06.09.2026): `Invalid uuid for
            # "connected_account_id"` riss den ganzen Endpunkt auf 500,
            # obwohl die Zeile korrekt angelegt war.
            # Best-effort mit lautem Log (Wurzel 5) — die Geräte holt der
            # nächste Aufruf der Oberfläche nach.
            try:
                self.geraete_abgleichen(str(tenant_id), neu_id)
            except SeamFehler as exc:  # noqa: BLE001 - Hauptpfad steht schon
                log.warning(
                    "schloesser.geraete_abgleich_nach_ereignis_fehlgeschlagen",
                    extra={
                        "connection_id": neu_id,
                        "grund": str(exc)[:200],
                    },
                )
        return neu_id

    def verbindungen_lesen(self, tenant_id: str) -> list[dict]:
        return (
            self.db.table("seam_connection")
            .select(
                "id, provider, display_name, status, error_code, connected_at"
            )
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        ).data or []

    def verbindung_trennen(self, tenant_id: str, connection_id: str) -> None:
        """Eine Verbindung trennen.

        Die Geräte bleiben als Zeilen stehen (Historie), werden aber über den
        Status der Verbindung als unbrauchbar erkennbar. Bewusst kein
        `delete`: bestehende Zugänge referenzieren die Geräte, und ein Storno
        muss auch danach noch nachvollziehbar sein.
        """
        load_scoped(
            self.db,
            "seam_connection",
            connection_id,
            tenant_id,
            columns="id",
            not_found=SchloesserFehler(
                "Diese Verbindung gibt es nicht.", status_code=404
            ),
        )
        self.db.table("seam_connection").update(
            {"status": "disconnected"}
        ).eq("id", connection_id).eq("tenant_id", tenant_id).execute()

    # =====================================================================
    # Geräte
    # =====================================================================
    def geraete_abgleichen(self, tenant_id: str, connection_id: str) -> int:
        """Die Geräte einer Verbindung von Seam holen und speichern.

        Gibt die Anzahl gespeicherter Geräte zurück. Bestehende Zeilen werden
        AKTUALISIERT, nicht gelöscht und neu angelegt — sonst brechen die
        Zuordnungen (`seam_device_zuordnung` hängt an `seam_device.id`).
        """
        verbindung = load_scoped(
            self.db,
            "seam_connection",
            connection_id,
            tenant_id,
            columns="id, connected_account_id",
            not_found=SchloesserFehler(
                "Diese Verbindung gibt es nicht.", status_code=404
            ),
        )
        geraete = self._client.geraete_lesen(
            str(verbindung["connected_account_id"])
        )
        for geraet in geraete:
            self._geraet_speichern(tenant_id, connection_id, geraet)
        return len(geraete)

    def _geraet_speichern(
        self, tenant_id: str, connection_id: str, geraet: SeamGeraet
    ) -> None:
        """Ein Gerät anlegen oder aktualisieren (Upsert über seam_device_id)."""
        werte = {
            "tenant_id": tenant_id,
            "connection_id": connection_id,
            "seam_device_id": geraet.device_id,
            "display_name": geraet.name,
            "can_revoke": geraet.kann_widerrufen,
            "is_offline_capable": geraet.ist_offline_faehig,
            "time_granularity": geraet.zeitraster,
            "online": geraet.online,
            "battery_level": geraet.batterie,
            "capacity_total": geraet.kapazitaet_gesamt,
            # AUS UNSERER EIGENEN ZÄHLUNG, nicht von Seam: Seam liefert keinen
            # Belegungsstand. Ohne diesen Wert war der in 0573 begründete
            # Kapazitätsschutz nur ein Kommentar — die Spalte wurde gelesen und
            # angezeigt, aber nie geschrieben (Review-Fund).
            "capacity_used": None,  # nachgezogen, sobald die Zeile eine id hat
            "last_seen_at": datetime.now(UTC).isoformat(),
        }
        vorhanden = (
            self.db.table("seam_device")
            .select("id")
            .eq("seam_device_id", geraet.device_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            self.db.table("seam_device").update(werte).eq(
                "id", vorhanden[0]["id"]
            ).eq("tenant_id", tenant_id).execute()
        else:
            self.db.table("seam_device").insert(werte).execute()

    def _belegte_codes(self, tenant_id: str, geraet_id: str) -> int:
        """Wie viele Code-Plätze dieses Gerät derzeit belegt.

        WARUM DIESE ZAHL ZÄHLT: igloohome fasst 199 Codes, Nuki 100 bzw. 200.
        Und — das ist der Punkt — ein storniertes Offline-Code gibt seinen
        Platz NICHT frei: er läuft bis zum Ablauf weiter. Ein Objekt mit viel
        Wechsel kann den Speicher deshalb füllen, und ohne diese Zählung liefe
        das in einen Seam-Fehler statt in eine klare Meldung.

        Gezählt werden nur Zustände, die wirklich einen Platz belegen:
        `geplant` (kommt noch), `angelegt`/`aktiv` (liegt am Gerät) und
        `nicht_widerrufbar` (läuft weiter). `abgelaufen`, `widerrufen` und
        `fehlgeschlagen` belegen nichts.

        Der Weg führt über die ZUORDNUNGEN: ein Zugang gilt für die Einheit
        bzw. das Gebäude, an dem das Gerät hängt. Alle Zugänge des Tenants zu
        zählen wäre bei mehreren Schlössern falsch — jedes hätte dann die
        Summe aller anderen als eigene Belegung.
        """
        zuordnungen = (
            self.db.table("seam_device_zuordnung")
            .select("unit_id, building_id")
            .eq("tenant_id", tenant_id)
            .eq("device_id", geraet_id)
            .execute()
        ).data or []
        if not zuordnungen:
            # Ohne Zuordnung bekommt das Gerät keine Codes.
            return 0
        einheiten = [str(z["unit_id"]) for z in zuordnungen if z.get("unit_id")]
        gebaeude = [
            str(z["building_id"]) for z in zuordnungen if z.get("building_id")
        ]
        # Die Objekte, deren Buchungen an diesem Gerät hängen.
        prop_ids: set[str] = set()
        if einheiten:
            zeilen = (
                self.db.table("property_units")
                .select("property_id")
                .in_("id", einheiten)
                .execute()
            ).data or []
            prop_ids |= {str(z["property_id"]) for z in zeilen}
        if gebaeude:
            zeilen = (
                self.db.table("properties")
                .select("id")
                .eq("tenant_id", tenant_id)
                .in_("building_id", gebaeude)
                .execute()
            ).data or []
            prop_ids |= {str(z["id"]) for z in zeilen}
        if not prop_ids:
            return 0
        buchungen = (
            self.db.table("reservations")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("property_id", sorted(prop_ids))
            .execute()
        ).data or []
        if not buchungen:
            return 0
        aktive = (
            self.db.table("seam_zugang")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("reservation_id", [str(b["id"]) for b in buchungen])
            .in_(
                "status",
                ["geplant", "angelegt", "aktiv", "nicht_widerrufbar"],
            )
            .execute()
        ).data or []
        return len(aktive)

    def geraete_lesen(self, tenant_id: str) -> list[dict]:
        """Alle Geräte des Betriebs samt ihrer Zuordnungen."""
        geraete = (
            self.db.table("seam_device")
            .select(
                "id, seam_device_id, display_name, can_revoke, "
                "is_offline_capable, time_granularity, online, battery_level, "
                "capacity_total, capacity_used, last_seen_at, connection_id"
            )
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        ).data or []
        if not geraete:
            return []
        zuordnungen = (
            self.db.table("seam_device_zuordnung")
            .select("id, device_id, unit_id, building_id")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        je_geraet: dict[str, list[dict]] = {}
        for z in zuordnungen:
            je_geraet.setdefault(str(z["device_id"]), []).append(z)
        for g in geraete:
            g["zuordnungen"] = je_geraet.get(str(g["id"]), [])
            # Belegung frisch zählen statt aus der Spalte zu lesen: sie ändert
            # sich mit jeder Buchung, und ein veralteter Wert wäre schlimmer
            # als keiner (die UI würde freien Platz behaupten).
            g["capacity_used"] = self._belegte_codes(tenant_id, str(g["id"]))
        return geraete

    # =====================================================================
    # Zuordnung (Einheit ODER Gebäude — der Türtyp)
    # =====================================================================
    def zuordnen(
        self,
        tenant_id: str,
        device_id: str,
        *,
        unit_id: str | None = None,
        building_id: str | None = None,
    ) -> dict:
        """Ein Gerät an eine Einheit ODER ein Gebäude hängen.

        Einheit = private Tür (nur dieser Gast). Gebäude = Gemeinschaftstür
        (jeder Gast im Haus). Genau eines von beiden, erzwungen hier UND als
        Check in 0573 — die DB ist der Backstop, wenn ein späterer Aufrufer
        die Prüfung vergisst.
        """
        if bool(unit_id) == bool(building_id):
            raise SchloesserFehler(
                "Ein Schloss haengt entweder an einer Einheit (private Tuer) "
                "oder an einem Gebaeude (Gemeinschaftstuer) — nicht an beidem "
                "und nicht an keinem."
            )
        load_scoped(
            self.db,
            "seam_device",
            device_id,
            tenant_id,
            columns="id",
            not_found=SchloesserFehler(
                "Dieses Schloss gibt es nicht.", status_code=404
            ),
        )
        # Die Zielzeile MUSS demselben Tenant gehören — sonst hängt ein
        # Angreifer sein Schloss an eine fremde Einheit (Wurzel 3).
        if unit_id:
            self._eigene_einheit(tenant_id, unit_id)
        else:
            self._eigenes_gebaeude(tenant_id, str(building_id))

        vorhanden = (
            self.db.table("seam_device_zuordnung")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("device_id", device_id)
            .eq("unit_id" if unit_id else "building_id",
                unit_id or building_id)
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            # Doppelklick: die vorhandene Zuordnung ist das Ergebnis.
            return vorhanden[0]
        eingefuegt = (
            self.db.table("seam_device_zuordnung")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "device_id": device_id,
                    "unit_id": unit_id,
                    "building_id": building_id,
                }
            )
            .execute()
        ).data or []
        return eingefuegt[0] if eingefuegt else {}

    def zuordnung_loesen(self, tenant_id: str, zuordnung_id: str) -> None:
        """Eine Zuordnung entfernen.

        Bestehende Zugänge bleiben, was sie sind: ein Code, der schon am
        Schloss ist, verschwindet nicht dadurch, dass wir die Zuordnung
        löschen. Guesty sagt das ausdrücklich („all scheduled guest codes will
        no longer work"), wir bleiben hier ehrlicher und lassen die Historie
        stehen.
        """
        load_scoped(
            self.db,
            "seam_device_zuordnung",
            zuordnung_id,
            tenant_id,
            columns="id",
            not_found=SchloesserFehler(
                "Diese Zuordnung gibt es nicht.", status_code=404
            ),
        )
        self.db.table("seam_device_zuordnung").delete().eq(
            "id", zuordnung_id
        ).eq("tenant_id", tenant_id).execute()

    def _eigene_einheit(self, tenant_id: str, unit_id: str) -> dict:
        """Die Einheit gehört diesem Betrieb — über ihr Objekt geprüft.

        `property_units` trägt keinen `tenant_id`, deshalb der Umweg über
        `properties`. Getrennt geladen und dann geprüft wäre die Stelle, an
        der man den Scope vergisst (Wurzel 3) — daher hier beides zusammen.
        """
        zeilen = (
            self.db.table("property_units")
            .select("id, property_id, properties!inner(tenant_id)")
            .eq("id", unit_id)
            .eq("properties.tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            raise SchloesserFehler(
                "Diese Einheit gibt es nicht.", status_code=404
            )
        return zeilen[0]

    def _eigenes_gebaeude(self, tenant_id: str, building_id: str) -> dict:
        return load_scoped(
            self.db,
            "buildings",
            building_id,
            tenant_id,
            columns="id",
            not_found=SchloesserFehler(
                "Dieses Gebaeude gibt es nicht.", status_code=404
            ),
        )

    # =====================================================================
    # Einstellungen je Objekt
    # =====================================================================
    def einstellungen_lesen(self, tenant_id: str, property_id: str) -> dict:
        """Puffer und Vorlauf eines Objekts, mit den Defaults aus 0573."""
        zeilen = (
            self.db.table("seam_einstellungen")
            .select("puffer_vor_min, puffer_nach_min, vorlauf_stunden, aktiv")
            .eq("property_id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if zeilen:
            return zeilen[0]
        # Die Defaults stehen in der Migration; hier gespiegelt, damit ein
        # Objekt ohne Zeile dieselben Werte hat wie eines mit.
        return {
            "puffer_vor_min": 30,
            "puffer_nach_min": 30,
            "vorlauf_stunden": 72,
            "aktiv": True,
        }

    def einstellungen_setzen(
        self, tenant_id: str, property_id: str, werte: dict
    ) -> dict:
        """Puffer/Vorlauf eines Objekts setzen (Upsert)."""
        load_scoped(
            self.db,
            "properties",
            property_id,
            tenant_id,
            columns="id",
            not_found=SchloesserFehler(
                "Dieses Objekt gibt es nicht.", status_code=404
            ),
        )
        daten = {
            k: v
            for k, v in werte.items()
            if k in {
                "puffer_vor_min",
                "puffer_nach_min",
                "vorlauf_stunden",
                "aktiv",
            }
            and v is not None
        }
        if not daten:
            return self.einstellungen_lesen(tenant_id, property_id)
        vorhanden = (
            self.db.table("seam_einstellungen")
            .select("property_id")
            .eq("property_id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            self.db.table("seam_einstellungen").update(daten).eq(
                "property_id", property_id
            ).eq("tenant_id", tenant_id).execute()
        else:
            self.db.table("seam_einstellungen").insert(
                {"property_id": property_id, "tenant_id": tenant_id, **daten}
            ).execute()
        return self.einstellungen_lesen(tenant_id, property_id)

    # =====================================================================
    # Der Zugang je Buchung
    # =====================================================================
    def zugang_planen(self, tenant_id: str, reservation_id: str) -> dict | None:
        """Für eine Buchung einen Zugang vormerken.

        Wird bei Buchungsbestätigung gerufen. Legt NUR die Zeile an
        (`geplant`) — an Seam geht der Grant erst `vorlauf_stunden` vorher
        bzw. sofort, wenn die Anreise näher ist. Gibt `None` zurück, wenn es
        für dieses Objekt keine zugeordneten Schlösser gibt: das ist der
        Normalfall bei Betrieben ohne Schlösser und kein Fehler.
        """
        buchung = self._buchung(tenant_id, reservation_id)
        geraete = self._geraete_fuer_buchung(tenant_id, buchung)
        if not geraete:
            return None
        einstellungen = self.einstellungen_lesen(
            tenant_id, str(buchung["property_id"])
        )
        if not einstellungen.get("aktiv"):
            return None

        gueltig = self._gueltigkeit(buchung, einstellungen, geraete)
        schluessel = self._reservation_key(reservation_id)

        # Idempotenz (Wurzel 2): derselbe Schlüssel = dieselbe Zeile. Bei
        # igloohome besonders wichtig, weil dort nur DREI PINs je Tag möglich
        # sind und auch stornierte einen verbrauchen.
        vorhanden = (
            self.db.table("seam_zugang")
            # `seam_grant_id` gehört dazu: `_zeitraum_nachziehen` entscheidet
            # daran, ob ein bestehender Grant VERSCHOBEN wird oder ein neuer
            # geplant. Ohne das Feld wäre die Antwort immer „neu planen" —
            # und bei igloohome ein verbrauchter PIN-Slot je Änderung.
            .select("id, status, code, starts_at, ends_at, seam_grant_id")
            .eq("reservation_key", schluessel)
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            return self._zeitraum_nachziehen(
                tenant_id, vorhanden[0], gueltig, geraete
            )

        eingefuegt = (
            self.db.table("seam_zugang")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "reservation_key": schluessel,
                    "starts_at": gueltig.beginn.isoformat(),
                    "ends_at": gueltig.ende.isoformat(),
                    "status": "geplant",
                }
            )
            .execute()
        ).data or []
        zugang = eingefuegt[0] if eingefuegt else {}
        # Last-Minute: wenn die Gültigkeit schon (fast) beginnt, sofort
        # anlegen statt auf den Tick zu warten.
        if zugang and gueltig.beginn - datetime.now(UTC) <= _SOFORT_SCHWELLE:
            return self.zugang_anlegen(tenant_id, str(zugang["id"]))
        return zugang

    def zugang_anlegen(self, tenant_id: str, zugang_id: str) -> dict:
        """Einen geplanten Zugang an Seam geben.

        Fehlschläge werden als Zustand FESTGEHALTEN, nicht verschluckt: ein
        Gerät kann offline sein oder sein PIN-Speicher voll. Ohne den Zustand
        `fehlgeschlagen` würde niemand merken, dass ein Gast keinen Code hat
        — bis er vor der Tür steht.
        """
        zugang = load_scoped(
            self.db,
            "seam_zugang",
            zugang_id,
            tenant_id,
            columns=(
                "id, reservation_id, reservation_key, starts_at, ends_at, "
                "status, seam_grant_id"
            ),
            not_found=SchloesserFehler(
                "Diesen Zugang gibt es nicht.", status_code=404
            ),
        )
        if zugang.get("seam_grant_id"):
            # Schon angelegt — Retry darf keinen zweiten Grant erzeugen.
            return self.zugang_aktualisieren(tenant_id, zugang_id)

        buchung = self._buchung(tenant_id, str(zugang["reservation_id"]))
        geraete = self._geraete_fuer_buchung(tenant_id, buchung)
        if not geraete:
            raise SchloesserFehler(
                "Fuer dieses Objekt ist kein Schloss zugeordnet."
            )
        self._kapazitaet_pruefen(tenant_id, geraete)
        try:
            ergebnis = self._client.zugang_anlegen(
                geraete_ids=[str(g["seam_device_id"]) for g in geraete],
                beginn_iso=str(zugang["starts_at"]),
                ende_iso=str(zugang["ends_at"]),
                reservation_key=str(zugang["reservation_key"]),
                # Fehlt der Name (Eigennutzung ohne Angabe, OTA ohne Kontakt),
                # bleibt es bei „Gast": Seam braucht einen Anzeigenamen für
                # das Zugangsmittel, und das ist die ehrliche Bezeichnung —
                # kein erfundener Personenname (Wurzel 4).
                name=anzeigename(buchung) or "Gast",
            )
        except SeamNichtKonfiguriert:
            # Konfigurationsmangel: nicht als Buchungsfehler verbuchen, aber
            # LAUT melden und den Zustand ehrlich lassen (bleibt `geplant`,
            # der Tick versucht es erneut, sobald die Variable gesetzt ist).
            log.error(
                "schloesser.seam_api_key_fehlt",
                extra={"zugang_id": zugang_id},
            )
            raise
        except SeamFehler as exc:
            self.db.table("seam_zugang").update(
                {"status": "fehlgeschlagen", "status_grund": str(exc)}
            ).eq("id", zugang_id).eq("tenant_id", tenant_id).execute()
            log.warning(
                "schloesser.zugang_fehlgeschlagen",
                extra={"zugang_id": zugang_id, "grund": str(exc)},
            )
            raise

        aktualisiert = {
            "seam_grant_id": ergebnis.grant_id,
            # `angelegt`, NICHT `aktiv`: am Gerät ist der Code erst, wenn der
            # Webhook es bestätigt. Der HTTP-200 ist kein Beweis.
            "status": "angelegt",
            "status_grund": None,
            "angelegt_at": datetime.now(UTC).isoformat(),
        }
        if ergebnis.code:
            aktualisiert["code"] = ergebnis.code
        self.db.table("seam_zugang").update(aktualisiert).eq(
            "id", zugang_id
        ).eq("tenant_id", tenant_id).execute()
        return {**zugang, **aktualisiert}

    def _kapazitaet_pruefen(self, tenant_id: str, geraete: list[dict]) -> None:
        """Hat noch jedes beteiligte Schloss einen freien Code-Platz?

        WARUM ALS 422 UND NICHT ALS SEAM-FEHLER: igloohome fasst 199 Codes,
        und ein storniertes Offline-Code gibt seinen Platz nicht frei — er
        läuft bis zum Ablauf weiter. Ein Objekt mit viel Wechsel füllt den
        Speicher deshalb wirklich. Ohne diese Prüfung liefe das in einen
        Seam-Fehler mit einer Meldung, die dem Betrieb nichts sagt; hier steht
        im Klartext, was zu tun ist (Wurzel 8: harte Grenze mit klarer Meldung
        statt stiller Fehlschlag).

        Unbekannte Kapazität (`capacity_total is None`, etwa bei Nuki, wo sie
        von der Schloss-Generation abhängt) blockiert NICHT: wir wissen die
        Grenze nicht, und eine geratene wäre schlechter als keine (Wurzel 4).
        """
        for g in geraete:
            grenze = g.get("capacity_total")
            if not grenze:
                continue
            belegt = self._belegte_codes(tenant_id, str(g["id"]))
            if belegt < int(grenze):
                continue
            name = g.get("display_name") or "Dieses Schloss"
            raise SchloesserFehler(
                f"{name} hat keinen freien Code-Platz mehr "
                f"({belegt} von {grenze} belegt). Abgelaufene Codes geben "
                "ihren Platz nicht von selbst frei — sie muessen mit der "
                "Hersteller-App vom Schloss geloescht werden."
            )

    def zugang_aktualisieren(self, tenant_id: str, zugang_id: str) -> dict:
        """Den Code von Seam zurücklesen.

        Nötig, weil bei Salto und igloohome-offline das SCHLOSSSYSTEM den Wert
        erzeugt — er ist erst nach dem Anlegen bekannt. Wer den Code selbst
        würfelt und sofort verschickt, sendet dort einen falschen.
        """
        zugang = load_scoped(
            self.db,
            "seam_zugang",
            zugang_id,
            tenant_id,
            columns="id, seam_grant_id, status, code",
            not_found=SchloesserFehler(
                "Diesen Zugang gibt es nicht.", status_code=404
            ),
        )
        grant_id = zugang.get("seam_grant_id")
        if not grant_id:
            return zugang
        ergebnis = self._client.zugang_lesen(str(grant_id))
        aktualisiert: dict = {}
        if ergebnis.code and ergebnis.code != zugang.get("code"):
            aktualisiert["code"] = ergebnis.code
        if aktualisiert:
            self.db.table("seam_zugang").update(aktualisiert).eq(
                "id", zugang_id
            ).eq("tenant_id", tenant_id).execute()
        return {**zugang, **aktualisiert}

    def zugang_widerrufen(
        self, tenant_id: str, reservation_id: str
    ) -> dict | None:
        """Den Zugang einer Buchung zurückziehen — DER GEGENZUSTAND (Wurzel 1).

        Gerufen aus `cancel`, `update` (Terminänderung), `decline_request` und
        `expire_stale_requests`. Gibt `None` zurück, wenn es keinen Zugang
        gab.

        DIE EHRLICHKEIT DIESER METHODE IST IHR ZWECK: Bei Offline-Codes ist
        ein Widerruf physikalisch unmöglich. Dann wird `nicht_widerrufbar`
        gesetzt, mit Ablaufdatum im Klartext — und der Aufrufer kann das
        anzeigen, statt „zurückgezogen" zu behaupten.
        """
        zugaenge = (
            self.db.table("seam_zugang")
            .select("id, seam_grant_id, status, ends_at")
            .eq("reservation_id", reservation_id)
            .eq("tenant_id", tenant_id)
            .not_.in_("status", ["widerrufen", "abgelaufen"])
            .execute()
        ).data or []
        if not zugaenge:
            return None

        buchung = self._buchung(tenant_id, reservation_id)
        geraete = self._geraete_fuer_buchung(tenant_id, buchung)
        # Ein einziges nicht-widerrufbares Gerät genügt, damit der Code
        # weiterläuft — die Aussage muss sich am schlechtesten Fall
        # orientieren, nicht am besten.
        unwiderruflich = [
            g for g in geraete if g.get("can_revoke") is not True
        ]

        ergebnis: dict | None = None
        for zugang in zugaenge:
            ergebnis = self._einen_widerrufen(
                tenant_id, zugang, unwiderruflich
            )
        return ergebnis

    def _einen_widerrufen(
        self, tenant_id: str, zugang: dict, unwiderruflich: list[dict]
    ) -> dict:
        """Einen einzelnen Zugang zurückziehen."""
        zugang_id = str(zugang["id"])
        grant_id = zugang.get("seam_grant_id")

        # Noch nie an Seam gegeben: nichts zu widerrufen, der Zustand ist
        # sofort sauber.
        if not grant_id:
            self.db.table("seam_zugang").update(
                {
                    "status": "widerrufen",
                    "widerrufen_at": datetime.now(UTC).isoformat(),
                    "status_grund": None,
                }
            ).eq("id", zugang_id).eq("tenant_id", tenant_id).execute()
            return {"status": "widerrufen", "id": zugang_id}

        if unwiderruflich:
            namen = ", ".join(
                str(g.get("display_name") or g.get("seam_device_id"))
                for g in unwiderruflich
            )
            bis = self._datum_klartext(zugang.get("ends_at"))
            grund = (
                f"Der Code laeuft bis {bis} weiter und kann nicht vorzeitig "
                f"entzogen werden ({namen}). Solche Codes werden vom Schloss "
                "selbst berechnet; zum Loeschen muss man mit der Hersteller-App "
                "in Bluetooth-Reichweite sein oder eine Bridge betreiben."
            )
            self.db.table("seam_zugang").update(
                {"status": "nicht_widerrufbar", "status_grund": grund}
            ).eq("id", zugang_id).eq("tenant_id", tenant_id).execute()
            log.info(
                "schloesser.zugang_nicht_widerrufbar",
                extra={"zugang_id": zugang_id},
            )
            return {
                "status": "nicht_widerrufbar",
                "id": zugang_id,
                "grund": grund,
            }

        try:
            self._client.zugang_widerrufen(str(grant_id))
        except SeamFehler as exc:
            # NICHT als „widerrufen" verbuchen, wenn es fehlschlug — das wäre
            # die stille Falschaussage (Wurzel 5b).
            self.db.table("seam_zugang").update(
                {"status": "fehlgeschlagen", "status_grund": str(exc)}
            ).eq("id", zugang_id).eq("tenant_id", tenant_id).execute()
            log.warning(
                "schloesser.widerruf_fehlgeschlagen",
                extra={"zugang_id": zugang_id, "grund": str(exc)},
            )
            raise
        self.db.table("seam_zugang").update(
            {
                "status": "widerrufen",
                "widerrufen_at": datetime.now(UTC).isoformat(),
                "status_grund": None,
            }
        ).eq("id", zugang_id).eq("tenant_id", tenant_id).execute()
        return {"status": "widerrufen", "id": zugang_id}

    def zugang_zu_buchung(
        self, tenant_id: str, reservation_id: str
    ) -> dict | None:
        """Der Zugang einer Buchung, für Anzeige und Platzhalter."""
        zeilen = (
            self.db.table("seam_zugang")
            .select(
                "id, code, status, status_grund, starts_at, ends_at, "
                "angelegt_at, am_geraet_at, widerrufen_at"
            )
            .eq("reservation_id", reservation_id)
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data or []
        return zeilen[0] if zeilen else None

    # =====================================================================
    # Hilfsmittel
    # =====================================================================
    def _buchung(self, tenant_id: str, reservation_id: str) -> dict:
        """Die Buchung, tenant-gescoped (Wurzel 3).

        `guest_name` ist KEINE Spalte auf `reservations` — der Name steht in
        `guests` bzw. bei Eigennutzung in `owners`/`stay_name`. Deshalb werden
        die verknüpften Zeilen mitgeladen und über `anzeigename` aufgelöst,
        statt einen zweiten Namensweg zu erfinden (der eine Lesepfad würde
        sonst einen Namen zeigen und dieser hier nicht).
        """
        return load_scoped(
            self.db,
            "reservations",
            reservation_id,
            tenant_id,
            columns=(
                "id, property_id, unit_id, check_in, check_out, status, "
                # Policy-Uhrzeiten (0049, Strings wie „16:00"). Ohne sie
                # gälte der Code ab Mitternacht Ortszeit statt ab Check-in.
                "checkin_time, checkout_time, "
                "is_owner_stay, stay_name, guests(name), owners(name)"
            ),
            not_found=SchloesserFehler(
                "Diese Buchung gibt es nicht.", status_code=404
            ),
        )

    def _geraete_fuer_buchung(
        self, tenant_id: str, buchung: dict
    ) -> list[dict]:
        """Alle Geräte, die für diese Buchung öffnen müssen.

        Das sind ZWEI Gruppen, und beide gehören dazu:
          * die private Tür der gebuchten Einheit
          * jede Gemeinschaftstür des Gebäudes, in dem die Einheit liegt
        Ein Gast, der nur die Wohnungstür öffnen kann, aber nicht die Haustür,
        steht draußen.
        """
        einheit_id = buchung.get("unit_id")
        gebaeude_id = self._gebaeude_zu_objekt(
            tenant_id, str(buchung["property_id"])
        )
        ids: list[str] = []
        if einheit_id:
            ids.extend(
                self._geraete_ids(tenant_id, "unit_id", str(einheit_id))
            )
        if gebaeude_id:
            ids.extend(
                self._geraete_ids(tenant_id, "building_id", str(gebaeude_id))
            )
        if not ids:
            return []
        # Doppelte entfernen (ein Gerät kann an Einheit UND Gebäude hängen),
        # Reihenfolge stabil halten.
        eindeutig = list(dict.fromkeys(ids))
        zeilen = (
            self.db.table("seam_device")
            .select(
                "id, seam_device_id, display_name, can_revoke, "
                "is_offline_capable, time_granularity, connection_id"
            )
            .eq("tenant_id", tenant_id)
            .in_("id", eindeutig)
            .execute()
        ).data or []
        return self._nur_gebuchte_anbieter(tenant_id, zeilen)

    def _nur_gebuchte_anbieter(
        self, tenant_id: str, zeilen: list[dict]
    ) -> list[dict]:
        """Geräte wegfiltern, deren Hersteller-Modul nicht (mehr) gebucht ist.

        WARUM HIER UND NICHT NUR BEIM VERBINDEN: das Modul-Gate saß
        ausschließlich in `verbindung_starten` — also einmalig, beim Anmelden
        beim Hersteller. Wer danach kündigte, bekam für seine schon
        verbundenen Geräte WEITER Türcodes: Leistung ohne Abo, unbefristet
        (Wurzel 5, fail-open). `dynpricing` macht es richtig und prüft das
        Entitlement vor der Leistung, nicht vor der Einrichtung.

        DIESE EINE STELLE REICHT, weil jede Code-Erzeugung über
        `_geraete_fuer_buchung` läuft — ein Gate je Aufrufer wäre eine Stelle
        zu viel, die beim nächsten neuen Pfad vergessen wird.

        Fällt die Marke nicht zuzuordnen (kein Join-Ergebnis), wird das Gerät
        AUSGELASSEN und nicht durchgelassen: ein Zugang, dessen Abrechenbarkeit
        wir nicht belegen können, ist der Fall, der stillschweigend Leistung
        verschenkt.
        """
        if not zeilen:
            return []
        gebucht = set(self.gebuchte_anbieter(tenant_id))
        marken = self._marken_der_verbindungen(
            tenant_id,
            [str(z["connection_id"]) for z in zeilen if z.get("connection_id")],
        )
        erlaubt: list[dict] = []
        for z in zeilen:
            marke = marken.get(str(z.get("connection_id") or ""))
            if marke and marke in gebucht:
                erlaubt.append(z)
            else:
                log.info(
                    "schloesser.geraet_ohne_gebuchtes_modul",
                    tenant_id=tenant_id,
                    device_id=z.get("id"),
                    provider=marke,
                )
        return erlaubt

    def _marken_der_verbindungen(
        self, tenant_id: str, verbindungs_ids: list[str]
    ) -> dict[str, str]:
        """Marke je Verbindung — EINE Abfrage, kein N+1 und kein Join.

        Bewusst getrennt statt als PostgREST-Join (`seam_connection(provider)`)
        in der Geräte-Abfrage: der Join wäre live korrekt, aber die
        In-Memory-Fake-DB der Tests löst Select-Spalten nicht auf und liefert
        ihn als `None`. Ein Gate, das dort immer sperrt, hätte 15 Tests rot
        gemacht, ohne dass an der Fachlogik etwas falsch ist — und die
        naheliegende „Reparatur" wäre gewesen, das Gate wieder zu lockern.
        """
        if not verbindungs_ids:
            return {}
        zeilen = (
            self.db.table("seam_connection")
            .select("id, provider")
            .eq("tenant_id", tenant_id)
            .in_("id", list(dict.fromkeys(verbindungs_ids)))
            .execute()
        ).data or []
        return {
            str(z["id"]): str(z.get("provider") or "").strip()
            for z in zeilen
            if z.get("id")
        }

    def _geraete_ids(
        self, tenant_id: str, spalte: str, wert: str
    ) -> list[str]:
        zeilen = (
            self.db.table("seam_device_zuordnung")
            .select("device_id")
            .eq("tenant_id", tenant_id)
            .eq(spalte, wert)
            .execute()
        ).data or []
        return [str(z["device_id"]) for z in zeilen]

    def _gebaeude_zu_objekt(
        self, tenant_id: str, property_id: str
    ) -> str | None:
        zeilen = (
            self.db.table("properties")
            .select("building_id")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return str(zeilen[0]["building_id"]) if zeilen and zeilen[0].get(
            "building_id"
        ) else None

    def _gueltigkeit(
        self, buchung: dict, einstellungen: dict, geraete: list[dict]
    ) -> Gueltigkeit:
        """Den Zeitraum berechnen — in der ZONE DES OBJEKTS, dann runden.

        DIE ZEITZONE IST HIER KEIN DETAIL. `check_in`/`check_out` sind reine
        Datumsangaben, die Uhrzeiten stehen als Policy-Strings an der Buchung
        (`checkin_time`, „16:00"). Beides meint ORTSZEIT. Wer das Datum als
        Mitternacht UTC liest und den Puffer darauf rechnet, erzeugt für ein
        Objekt in Athen (UTC+3) einen Code, der am Abreisetag um 03:30
        Ortszeit ausläuft — der Gast kommt am letzten Morgen nicht mehr in die
        Wohnung. Dieselbe Fehlerklasse hat am 03.09.2026 die Aufgaben-Engine
        getroffen; Migration 0258 wurde dafür geschrieben.

        Fehlt die Uhrzeit, gilt der TAG (00:00 bis 24:00 Ortszeit) — keine
        erfundene Standard-Checkin-Zeit (Wurzel 4). Fehlt die Zone, wird UTC
        gerechnet und das im Log gesagt, statt eine Ortszeit zu raten.

        Die Rundung richtet sich nach dem GRÖBSTEN Gerät: hängt ein
        igloohome-Schloss dabei (nur ganze Stunden), muss der Zeitraum auch für
        die anderen passen. Beginn ab, Ende auf — der Code gilt dann etwas
        länger, aber NIE kürzer als der Aufenthalt.
        """
        zone = objekt_zone(self._objekt_zeitzone(buchung))
        beginn = als_ortszeit(
            buchung.get("check_in"), uhrzeit(buchung.get("checkin_time")), zone
        )
        # Ohne Checkout-Uhrzeit gilt der Abreisetag bis Mitternacht: ein Code,
        # der am Abreisetag um 00:00 endet, wäre für den Gast wertlos — er
        # reist an diesem Tag ja erst ab.
        auschecken = uhrzeit(buchung.get("checkout_time"))
        ende = als_ortszeit(buchung.get("check_out"), auschecken, zone)
        if beginn is None or ende is None:
            raise SchloesserFehler(
                "Diese Buchung hat kein lesbares An- oder Abreisedatum — "
                "ohne das kann kein Zugang erzeugt werden."
            )
        if auschecken is None:
            ende += timedelta(days=1)

        beginn -= timedelta(minutes=int(einstellungen["puffer_vor_min"]))
        ende += timedelta(minutes=int(einstellungen["puffer_nach_min"]))
        if ende <= beginn:
            raise SchloesserFehler(
                "Der Zugangszeitraum waere leer oder negativ — "
                "An- und Abreise pruefen."
            )
        # Wurzel 8: harte Obergrenze statt unbegrenztem Bereich.
        if (ende - beginn).days > _MAX_TAGE:
            raise SchloesserFehler(
                f"Der Zugangszeitraum darf hoechstens {_MAX_TAGE} Tage "
                "umfassen; die Schloss-Hersteller lehnen laengere ab."
            )

        # GERUNDET WIRD IN DER ORTSZEIT, nicht in UTC: „ganze Stunde" heißt für
        # das Schloss die volle Stunde vor Ort. In UTC gerundet läge die Grenze
        # bei einer Zone mit halber Stunde Versatz (Indien, Nepal) mitten in
        # der Ortsstunde.
        raster = {str(g.get("time_granularity") or "free") for g in geraete}
        if raster & {"day", "hour"}:
            beginn, ende = self._runden(beginn, ende, raster, zone)
        return Gueltigkeit(beginn=beginn, ende=ende)

    @staticmethod
    def _runden(
        beginn: datetime,
        ende: datetime,
        raster: set[str],
        zone: ZoneInfo | None,
    ) -> tuple[datetime, datetime]:
        """Auf Tag bzw. Stunde runden — Beginn ab, Ende auf, in der Ortszeit."""
        z = zone or UTC
        lok_beginn, lok_ende = beginn.astimezone(z), ende.astimezone(z)
        if "day" in raster:
            lok_beginn = lok_beginn.replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            if (
                lok_ende.hour
                or lok_ende.minute
                or lok_ende.second
                or lok_ende.microsecond
            ):
                lok_ende = (lok_ende + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
        else:  # "hour"
            lok_beginn = lok_beginn.replace(minute=0, second=0, microsecond=0)
            if lok_ende.minute or lok_ende.second or lok_ende.microsecond:
                lok_ende = lok_ende.replace(
                    minute=0, second=0, microsecond=0
                ) + timedelta(hours=1)
        return lok_beginn.astimezone(UTC), lok_ende.astimezone(UTC)

    def _objekt_zeitzone(self, buchung: dict) -> str | None:
        """Die IANA-Zone des Objekts dieser Buchung (0258).

        Eigene Abfrage statt Join in `_buchung`: die Zone wird nur beim
        Berechnen der Gültigkeit gebraucht, nicht bei jedem Lesen des Zugangs.
        """
        prop_id = buchung.get("property_id")
        if not prop_id:
            return None
        zeilen = (
            self.db.table("properties")
            .select("timezone")
            .eq("id", str(prop_id))
            .limit(1)
            .execute()
        ).data or []
        return zeilen[0].get("timezone") if zeilen else None

    def _zeitraum_nachziehen(
        self,
        tenant_id: str,
        zugang: dict,
        gueltig: Gueltigkeit,
        geraete: list[dict],
    ) -> dict:
        """Bei Terminänderung den Zeitraum eines bestehenden Zugangs anpassen.

        Ein Offline-Code kann NICHT geändert werden. Hostaways Lösung dafür
        ist die eleganteste im Feld: statt zu ändern, wird ein NEUER Code
        erzeugt und über den Auslöser „Code erzeugt" verschickt. Der alte
        läuft aus. Genau das passiert hier — der alte Zugang wird als
        `nicht_widerrufbar` markiert und ein neuer geplant.
        """
        neuer_beginn = gueltig.beginn.isoformat()
        neues_ende = gueltig.ende.isoformat()
        if (
            str(zugang.get("starts_at")) == neuer_beginn
            and str(zugang.get("ends_at")) == neues_ende
        ):
            return zugang
        unwiderruflich = any(
            g.get("can_revoke") is not True for g in geraete
        )
        if unwiderruflich and zugang.get("status") not in {
            "geplant",
            "fehlgeschlagen",
        }:
            # Alter Code läuft weiter; ehrlich benennen und neu erzeugen.
            bis = self._datum_klartext(zugang.get("ends_at"))
            self.db.table("seam_zugang").update(
                {
                    "status": "nicht_widerrufbar",
                    "status_grund": (
                        f"Termin geaendert. Der alte Code laeuft bis {bis} "
                        "weiter und kann nicht entzogen werden; ein neuer "
                        "Code wurde erzeugt."
                    ),
                }
            ).eq("id", zugang["id"]).eq("tenant_id", tenant_id).execute()
            return zugang

        # Ein bereits an Seam gegebener Grant wird VERSCHOBEN, nicht neu
        # geplant. Ihn auf `geplant` zurückzusetzen hätte den Tick einen
        # ZWEITEN Grant anlegen lassen — bei igloohome einer von drei
        # PIN-Slots des Tages, verbraucht für nichts. Seam materialisiert die
        # Codes beim Verschieben selbst neu.
        grant_id = zugang.get("seam_grant_id")
        neuer_status = zugang.get("status") or "geplant"
        if grant_id:
            self._client.zugang_verschieben(
                str(grant_id),
                beginn_iso=neuer_beginn,
                ende_iso=neues_ende,
            )
            # Zurück auf `angelegt`: der Code ist bei Seam, aber ob die neue
            # Gültigkeit am Gerät ankam, bestätigt erst der Webhook.
            neuer_status = "angelegt"
        else:
            neuer_status = "geplant"

        self.db.table("seam_zugang").update(
            {
                "starts_at": neuer_beginn,
                "ends_at": neues_ende,
                "status": neuer_status,
                "status_grund": None,
            }
        ).eq("id", zugang["id"]).eq("tenant_id", tenant_id).execute()
        return {
            **zugang,
            "starts_at": neuer_beginn,
            "ends_at": neues_ende,
            "status": neuer_status,
        }

    @staticmethod
    def _datum_klartext(wert: object) -> str:
        """Ein Datum für eine Nutzermeldung („10.09.2026, 11:00")."""
        zeit = als_zeitpunkt(wert)
        return zeit.strftime("%d.%m.%Y, %H:%M") if zeit else "unbekannt"

    @staticmethod
    def _reservation_key(reservation_id: str) -> str:
        """Unser Idempotenz-Anker gegenüber Seam.

        Stabil an der Reservierung, damit ein Retry denselben Grant findet.
        Bewusst mit Präfix: Seam sieht Schlüssel mehrerer Systeme, und eine
        rohe UUID wäre nicht als unsere erkennbar.
        """
        return f"nextdays-{reservation_id}"
