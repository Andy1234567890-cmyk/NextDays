"""Service-Schicht für owner_statements (Owner-Statements + Auszahlungsformel).

Auszahlungsformel (mirror Hostaway), serverseitig in Decimal (kaufmännisch
gerundet, 2 Nachkommastellen):

    Total Price   = Σ reservations.total_amount  (Owner-Objekte, Zeitraum, Filter)
    Total Payout  = Σ (total_amount − channel_fee)
    Verrechnung   = Σ(Posten zugunsten) − Σ(Posten zulasten)   [1:1, s. u.]
    Owner Payout  = Σ (Buchungssatz × (1 − commission_pct/100)) + Verrechnung
    PM Payout     = Total Payout − Owner Payout
    Grand total   = Rental Revenue (Total Price) + Verrechnung; „Deduct
                    percentage" = commission_pct.

VERRECHNUNGSPOSTEN GEHEN 1:1 EIN — nicht provisioniert. Bis 09.08.2026 wurden
sie mit ``× (100 − eff)/100`` gekürzt, also wie Umsatz behandelt: für
„Glühbirnen für 200 DKK gekauft" bekam der Betrieb bei 20 % Provision nur
160 DKK zurück statt 200. Ein Verrechnungsposten ist aber kein Umsatz, an dem
die Verwaltung mitverdient, sondern eine ausgelegte Auslage bzw. eine
zugesagte Kompensation — er verschiebt die Auszahlung um genau seinen Betrag.
Die Provision bemisst sich weiterhin ausschließlich an den Buchungen.

CRUD/Erzeugung über Service-Role mit explizitem tenant-Scope (tenant_id aus dem
verifizierten JWT). Beträge nie als float gerechnet — float nur an der API-Grenze.
"""
# pylint: disable=too-many-lines  # kohärente Abrechnungs-Domäne (Aktivität/
# Summen/Steuer/Storno/Rechnungsnummer). Ein Schnitt entlang dieser Grenzen
# risse die Auszahlungsformel auseinander, die genau deshalb an EINER Stelle
# steht — dieselbe Begründung wie in calendar/service.py und payments/service.py.
from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.features.auth.guest_masking import GuestMask, load_guest_mask

from . import common
from .common import PayoutUnbekannt, buchungs_payout, effektive_provision_pct
from .currencies import currency_for_country
from .fx import FxError, FxService
from .gebuehren_quelle import gebuehren_der_buchung, klassifikation_laden
from .schemas import (
    AutoStatementRunResponse,
    CurrencyAmount,
    ExpenseCreate,
    ExpenseDirection,
    ExpenseReceiptUrlResponse,
    ExpenseResponse,
    ExpenseUpdate,
    ListingRow,
    RentalRow,
    SliceHealth,
    StatementFinalizeRequest,
    StatementGenerateRequest,
    StatementHeader,
    StatementListItem,
    StatementListResponse,
    StatementResponse,
    StatementSummary,
    StatementUpdate,
    TaxBreakdown,
)
from .tax import compute_tax

log = get_logger("nextdays.owner_statements")

_CENT = Decimal("0.01")

# Maske für die INTERNE Berechnung des Summen-Snapshots. `owner_statements`
# trägt die ungekürzten Zahlen für die Buchhaltung; die Maskierung nach §4.2
# greift beim AUSLIEFERN (`get`/`list`/`preview`), nicht beim Speichern.
#
# Das ist keine Umgehung des Daten-Splits, sondern seine Voraussetzung: würde
# hier die Maske des gerade anfragenden Nutzers gelten, hinge der GESPEICHERTE
# Buchhaltungswert davon ab, WER zufällig gespeichert hat — ein Eigentümer, der
# eine Ausgabe anlegt, schriebe den Gastpreis dauerhaft auf `None`. Genau daran
# scheiterte das Anlegen jeder Abrechnung mit 23502.
#
# Diese Maske verlässt den Service NIE: sie geht ausschließlich in
# `_refresh_summary`, dessen Ergebnis in die DB-Spalten fließt. Jeder Lesepfad
# lädt weiterhin `load_guest_mask(self._db, ctx.user_id)`.
_MASKE_INTERN = GuestMask(
    full_name=False,   # Gastnamen fließen nicht in den Summen-Snapshot
    contact=False,
    amounts=True,      # Beträge MÜSSEN hier vollständig sein
    source=False,
    id_docs=False,
)

# Beleg zum Verrechnungsposten: PRIVATER Bucket (0344), Zugriff ausschließlich
# über eine vom Backend signierte URL — ein Kaufbeleg trägt Adressen und
# Betragsdetails und gehört nicht in einen öffentlichen Bucket.
_BELEG_BUCKET = "owner-expense-receipts"
_BELEG_MAX_BYTES = 10 * 1024 * 1024  # 10 MB (deckt das Bucket-Limit ab)
_BELEG_URL_TTL = 3600  # Sekunden
_BELEG_EXT_MIME = {
    "pdf": "application/pdf",
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


def _sniff_beleg_ext(content: bytes) -> str | None:
    """Dateityp des Belegs aus den MAGIC-BYTES bestimmen (Wurzel 8).

    Der vom Client gemeldete ``content_type`` wird bewusst ignoriert: er ist
    frei wählbar und sagt nichts über den echten Inhalt. ``None`` heißt „kein
    erlaubter Belegtyp" — der Aufrufer lehnt mit 415 ab.
    """
    if content.startswith(b"%PDF-"):
        return "pdf"
    if content.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp"
    return None


def _d(value: object) -> Decimal:
    """In Decimal wandeln (über str, um Float-Artefakte zu vermeiden)."""
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _money(value: Decimal) -> float:
    """Kaufmännisch auf 2 Nachkommastellen runden, als float für die API."""
    return float(value.quantize(_CENT, rounding=ROUND_HALF_UP))


def _erster_grund(rows: list[RentalRow]) -> str:
    """Der Grund der ersten Zeile ohne ausweisbare Auszahlung.

    Die Zusammenfassung nennt EINEN Grund, weil ihre Meldung zum Handeln
    auffordert („trage X ein") und eine Liste von drei Handgriffen niemand
    abarbeitet. Sind mehrere Dinge offen, erscheint der nächste Grund nach dem
    ersten Handgriff — die Meldung führt den Betrieb also Schritt für Schritt.

    Der Rückfall ``"provision"`` ist der historische Grund: bis 11.08.2026 war er
    der einzige, den es geben konnte. Er greift nur, wenn eine Zeile ohne
    Auszahlung auch keinen Grund trägt — das wäre ein Programmierfehler und keine
    Datenlage, aber ein leerer Grund liesse die Maske ohne Erklärung zurück.
    """
    for r in rows:
        if r.owner_payout is None and r.payout_unbekannt:
            return r.payout_unbekannt
    return "provision"


def _kommission_anzeige(
    commission_display: Decimal | None, row: dict
) -> float | None:
    """Anzuzeigender Provisionssatz — oder `None`, wenn keiner feststeht.

    Reihenfolge: der frisch berechnete Anzeige-Satz (Vorschau/Live-Summe),
    sonst der gespeicherte Satz der Zeile. Ist beides leer, gibt es keinen
    Satz; `_d(None)` wäre hier 0 und behauptete „0 % Provision vereinbart",
    was dem Eigentümer die volle Auszahlung zuspricht (Wurzel 4).
    """
    if commission_display is not None:
        return _money(commission_display)
    gespeichert = row.get("commission_pct")
    return _money(_d(gespeichert)) if gespeichert is not None else None


def _negiert(value: object) -> float | None:
    """Betrag der Gegenbuchung: Vorzeichen drehen, NULL bleibt NULL.

    Gibt `float` zurueck, nicht `Decimal`. Die Storno-Nutzlast geht als JSON an
    PostgREST, und `Decimal` ist nicht JSON-serialisierbar — ein `-_d(...)`
    direkt im Payload liess `cancel()` gegen die echte DB mit `TypeError`
    abbrechen (die In-Memory-Fake-DB der Tests nimmt `Decimal` klaglos an, daher
    fiel es dort nie auf). Diese eine Stelle haelt Vorzeichen UND Serialisierung
    zusammen, damit nicht jede Zeile des Payloads es einzeln richtig machen
    muss.

    NULL bleibt NULL (0346): die Gegenbuchung einer unbekannten Zahl ist keine
    0, sondern wieder unbekannt (Wurzel 4).
    """
    if value is None:
        return None
    return _money(-_d(value))


def _negiert_pflicht(value: object) -> float:
    """Wie `_negiert`, aber fuer die `not null`-Betragsspalten.

    Diese Spalten sind immer belegt; ein fehlender Wert waere ein Datenfehler
    und keine 0. Statt still einen Ersatzwert zu setzen, faellt der Fall hier
    hart auf — sonst truege eine unveraenderbare Stornorechnung eine erfundene
    Null (Wurzel 4/5).
    """
    negiert = _negiert(value)
    if negiert is None:
        raise StatementError(
            "Der Beleg trägt keinen vollständigen Betrags-Snapshot und lässt "
            "sich daher nicht stornieren.",
            status_code=422,
        )
    return negiert


def _ist_zulasten(row: dict) -> bool:
    """Mindert dieser Verrechnungsposten die Auszahlung des Eigentümers?

    Liest AUSSCHLIESSLICH `direction` (0344), nie das Vorzeichen von `amount` —
    das ist seit 0344 per Check-Constraint immer positiv. Fehlt `direction`,
    ist die Zeile nicht interpretierbar; sie als „zugunsten" zu lesen zahlte
    dem Eigentümer eine Auslage aus, statt sie einzuziehen. Darum
    fail-closed auf `from_owner` — dieselbe Richtung wie der DB-Default.
    """
    return str(row.get("direction") or ExpenseDirection.from_owner) == (
        ExpenseDirection.from_owner.value
    )


def _signed_amount(row: dict) -> Decimal:
    """Wirkbetrag des Postens auf die Auszahlung: +amount bzw. −amount.

    Die EINE Stelle, an der aus Richtung + positivem Betrag ein Vorzeichen
    wird. Summe, Antwortmodell und PDF greifen alle hierauf zu, damit nicht
    drei Stellen dieselbe Regel unterschiedlich implementieren.
    """
    betrag = _d(row.get("amount")).copy_abs()
    return -betrag if _ist_zulasten(row) else betrag


def _richtungssummen(expenses: list[dict]) -> tuple[Decimal, Decimal, Decimal]:
    """Verrechnungsposten zu (netto, zugunsten, zulasten) verdichten.

    Die EINE Ableitung fuer beide Wege in den Snapshot: `_compute_summary`
    (Entwurf, live gerechnet) und `_snapshot_schreiben` (was in die Spalten
    faellt). Vorher stand die Aufteilung nur in `_compute_summary`; der
    Snapshot-Pfad kannte sie gar nicht und lieferte den Pydantic-Default 0.
    Genau dieses Auseinanderlaufen soll die gemeinsame Quelle verhindern.

    Das Vorzeichen kommt ausschliesslich aus `_signed_amount`; die beiden
    Richtungsbetraege bleiben — wie in der DB — POSITIV. netto ist damit
    zugunsten − zulasten und wird nicht getrennt gebildet, sonst koennten die
    drei Zahlen einander widersprechen.
    """
    zugunsten = sum(
        (_d(e.get("amount")).copy_abs() for e in expenses if not _ist_zulasten(e)),
        Decimal("0"),
    )
    zulasten = sum(
        (_d(e.get("amount")).copy_abs() for e in expenses if _ist_zulasten(e)),
        Decimal("0"),
    )
    netto = sum((_signed_amount(e) for e in expenses), Decimal("0"))
    return netto, zugunsten, zulasten


class StatementError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True, slots=True)
class _GebuehrenKontext:
    """Die je Abrechnung EINMAL geladenen Bezugsdaten der Gebührenrechnung.

    `stammdaten` ist je `property_id` abgelegt, weil eine Abrechnung mehrere
    Objekte umfasst — im Portal-Kalender ist es genau eines.
    """

    klassifikation: dict[tuple[str, str | None], tuple[str, bool]]
    stammdaten: dict[str, dict[str, Any]]
    payloads: dict[str, Any]


class OwnerStatementsService:
    slice_name = "owner_statements"

    def __init__(self, service_client: Client) -> None:
        self._db = service_client
        self._fx = FxService(service_client)

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise StatementError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    # --- Owner-Scope (§4.2) ---------------------------------------------------
    # Die owner-Rolle BESITZT Permission.OWNER_REPORTING (sie soll ihre eigenen
    # Abrechnungen sehen). Die API läuft aber mit Service-Role (RLS umgangen) —
    # ohne explizite Selbst-Zuordnung sähe ein Eigentümer die Abrechnungen ALLER
    # Eigentümer des Tenants. Deshalb: user_id → eigene owners-Zeile auflösen
    # und jede Lese-Query darauf einschränken; Schreiben ist für Eigentümer
    # komplett gesperrt (read-only laut Lastenheft §4.2).

    def _is_owner(self, ctx: AuthContext) -> bool:
        """Eingeloggter Immobilien-Eigentümer (read-only, nur eigene Daten)."""
        return ctx.role == "owner"

    def _owner_self_id(self, ctx: AuthContext, tenant_id: str) -> str:
        """owner_id des eingeloggten Eigentümers über den owners.user_id-Link.

        Fail-closed: Owner-Rolle ohne verknüpfte owners-Zeile sieht nichts."""
        rows = (
            self._db.table("owners")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", ctx.user_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise StatementError(
                "Keine Eigentümer-Zuordnung für dieses Konto.", status_code=404
            )
        return str(rows[0]["id"])

    def _forbid_owner_writes(self, ctx: AuthContext) -> None:
        """Erzeugen/Ändern/Finalisieren/Stornieren/Löschen ist der Agentur
        vorbehalten — Eigentümer haben nur Lesezugriff (§4.2)."""
        if self._is_owner(ctx):
            raise StatementError(
                "Eigentümer haben nur Lesezugriff auf Abrechnungen.",
                status_code=403,
            )

    # Dem Eigentümer wird NUR der fertige, gültige Beleg gezeigt: `finalized`
    # UND `kind='invoice'`. Alles andere ist Werkstatt der Agentur.
    #   * `draft`        — unfertig, Beträge ändern sich noch.
    #   * `cancelled`    — zurückgezogene Rechnung.
    #   * `cancellation` — der Storno-Gegenbeleg dazu.
    # Das Storno-PAAR (beide Zeilen) bleibt bewusst unsichtbar: eine Rechnung,
    # die es nie zum Eigentümer geschafft hat, soll auch nicht als „storniert"
    # erklärt werden müssen. Entscheidung vom 30.08.2026.
    #
    # GRENZE dieser Regel: sie trägt nur, solange der Eigentümer die Rechnung
    # noch NIE gesehen hat. Wird künftig ein Versand (Mail/PDF) gebaut, ist ein
    # nachträglich verschwindender Beleg eine Falschaussage — dann muss das
    # Storno-Paar für bereits zugestellte Rechnungen sichtbar WERDEN.
    _OWNER_SICHTBAR_STATUS = "finalized"
    _OWNER_SICHTBAR_KIND = "invoice"

    def _fuer_owner_sichtbar(self, row: dict) -> bool:
        """Ist dieser Beleg einem Eigentümer zumutbar? (Siehe Kommentar oben.)"""
        return (
            row.get("status") == self._OWNER_SICHTBAR_STATUS
            and (row.get("kind") or self._OWNER_SICHTBAR_KIND) == self._OWNER_SICHTBAR_KIND
        )

    def _require_statement_visible(
        self, ctx: AuthContext, tenant_id: str, row: dict
    ) -> None:
        """Eigentümer dürfen nur die EIGENE Abrechnung lesen (sonst 404 wie
        nicht vorhanden — keine Existenz fremder Belege verraten)."""
        if not self._is_owner(ctx):
            return
        if str(row["owner_id"]) != self._owner_self_id(ctx, tenant_id):
            raise StatementError("Statement nicht gefunden.", status_code=404)
        # Wurzel 9: derselbe Filter wie in der Liste — sonst holt ein Direktruf
        # auf /{id}, was die Liste gerade verbirgt.
        if not self._fuer_owner_sichtbar(row):
            raise StatementError("Statement nicht gefunden.", status_code=404)

    # --- Owner + Objekte ----------------------------------------------------

    def _owner(self, tenant_id: str, owner_id: str) -> dict:
        rows = (
            self._db.table("owners")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", owner_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise StatementError("Eigentümer nicht gefunden.", status_code=404)
        return rows[0]

    def _owner_property_ids(self, owner_id: str) -> list[str]:
        rows = (
            self._db.table("owner_properties")
            .select("property_id")
            .eq("owner_id", owner_id)
            .execute()
        ).data or []
        return [str(r["property_id"]) for r in rows]

    def _gebuehren_kontext(
        self, tenant_id: str, reservations: list[dict]
    ) -> _GebuehrenKontext:
        """Zuordnungen, Objekt-Gebühren und OTA-Payloads für DIESE Abrechnung.

        Anders als im Portal-Kalender umfasst eine Abrechnung MEHRERE Objekte,
        darum sind die Gebühren-Stammdaten je `property_id` abgelegt.
        """
        property_ids = sorted(
            {str(r["property_id"]) for r in reservations if r.get("property_id")}
        )
        stammdaten: dict[str, dict[str, Any]] = {}
        if property_ids:
            for row in (
                self._db.table("properties")
                .select("id, type_attributes")
                .eq("tenant_id", tenant_id)
                .in_("id", property_ids)
                .execute()
            ).data or []:
                stammdaten[str(row["id"])] = row.get("type_attributes") or {}
        codes = sorted(
            {
                str(r["source_channex_booking_id"])
                for r in reservations
                if r.get("source_channex_booking_id")
            }
        )
        payloads: dict[str, Any] = {}
        if codes:
            for row in fetch_all_rows(
                self._db.table("channex_booking")
                .select("channex_booking_id, raw")
                .eq("tenant_id", tenant_id)
                .in_("channex_booking_id", codes)
                .order("channex_booking_id")
            ):
                code = str(row.get("channex_booking_id") or "")
                if code:
                    payloads[code] = row.get("raw")
        return _GebuehrenKontext(
            klassifikation=klassifikation_laden(self._db, tenant_id),
            stammdaten=stammdaten,
            payloads=payloads,
        )

    def _portal_saetze_je_buchung(
        self, tenant_id: str, reservations: list[dict]
    ) -> dict[str, dict[str, Any]]:
        """Der geltende Portal-Abzugssatz je Buchung (0364).

        Stichtag ist der Check-out — dieselbe Zeitachse wie beim
        Abrechnungsvertrag und derselbe Stichtag, den `_rental_rows` schon für
        den Währungskurs benutzt.
        """
        from src.features.owner_billing.service import (  # noqa: PLC0415
            OwnerBillingService,
        )

        billing = OwnerBillingService(service_client=self._db)
        gecacht: dict[tuple[str, str, str], dict[str, Any] | None] = {}
        out: dict[str, dict[str, Any]] = {}
        for r in reservations:
            kanal = str(r.get("channel") or "").strip().lower()
            pid = str(r.get("property_id") or "")
            checkout = str(r.get("check_out") or "")
            if not (kanal and pid and checkout):
                continue
            schluessel = (kanal, pid, checkout)
            if schluessel not in gecacht:
                try:
                    stichtag = date.fromisoformat(checkout)
                except (ValueError, TypeError):
                    continue
                gecacht[schluessel] = billing.portal_satz_aufloesen(
                    tenant_id, kanal, pid, stichtag
                )
            satz = gecacht[schluessel]
            if satz is not None:
                out[str(r["id"])] = satz
        return out

    @staticmethod
    def _gebuehren_herkunft(
        r: dict, kontext: _GebuehrenKontext
    ) -> tuple[str | None, str | None]:
        """``(quelle, grund)`` der Gebühren dieser Buchung — nur zur AUSKUNFT.

        Beantwortet die häufigste Rückfrage der Buchhaltung: „warum steht bei
        dieser Buchung keine Reinigung?" Am 11.08.2026 kostete genau die einen
        halben Tag Suche beim Mapping, beim Tax Set und im Rechencode — die
        Antwort lag im Eingangsweg der Buchung (Channex-Import ohne Aufstellung).

        Bewusst OHNE Klassifikation und ohne Rechnung: die Herkunft steht schon
        am Payload fest, und eine fehlende Gebühren-Zuordnung darf hier nicht
        werfen. Die Auskunft „Portal hat nichts geliefert" muss auch dann noch
        erscheinen, wenn die Zeile ihre Auszahlung nicht rechnen kann — sonst
        fehlt genau in dem Fall der Hinweis, der ihn erklärt.
        """
        raw = kontext.payloads.get(str(r.get("source_channex_booking_id") or ""))
        try:
            befund = gebuehren_der_buchung(
                raw=raw,
                type_attributes=None,
                naechte=0,
                klassifikation={},
                property_id=str(r.get("property_id") or ""),
                reservierung=r,
            )
        except PayoutUnbekannt:
            return None, None
        return befund.quelle, befund.grund

    def _auszahlung_einer_buchung(
        self,
        r: dict,
        *,
        regeln: common.Vertragsregeln,
        addon_total: Decimal,
        kontext: _GebuehrenKontext,
        portal_saetze: dict[str, dict[str, Any]],
        currency: str,
    ) -> common.Auszahlung:
        """Die volle Kette für EINE Abrechnungszeile.

        Bewusst dieselbe Reihenfolge und dieselben Quellen wie
        `PublicPortalService._auszahlung_einer_buchung`; die Rechnung selbst
        liegt in `common`, damit beide Slices sie nicht auseinanderlaufen
        lassen können.
        """
        pid = str(r["property_id"])
        naechte = self._nights(r.get("check_in"), r.get("check_out"))
        befund = gebuehren_der_buchung(
            raw=kontext.payloads.get(
                str(r.get("source_channex_booking_id") or "")
            ),
            type_attributes=kontext.stammdaten.get(pid),
            naechte=naechte,
            klassifikation=kontext.klassifikation,
            property_id=pid,
            reservierung=r,
        )
        basis = befund.basisbetrag(r.get("total_amount"))
        gast_brutto = common.gastpreis(
            uebernachtung=basis,
            gebuehren=befund.gebuehren,
            gebuehren_im_betrag=befund.im_gesamtpreis,
            addon_total=addon_total,
        )
        satz = portal_saetze.get(str(r["id"])) or {}
        abzug = common.portal_abzug(
            brutto=gast_brutto,
            gemeldete_provision=r.get("ota_commission"),
            provision_pct=satz.get("provision_pct"),
            zahlungsgebuehr_pct=satz.get("zahlungsgebuehr_pct"),
            zieht_portal_ein=common.portal_zieht_ein(
                r.get("channel"), r.get("payment_collect")
            ),
        )
        return common.auszahlung_berechnen(
            uebernachtung=basis,
            gebuehren=befund.gebuehren,
            gebuehren_im_betrag=befund.im_gesamtpreis,
            addon_total=addon_total,
            abzug=abzug,
            regeln=regeln,
            naechte=naechte,
            currency=currency,
        )

    def _vertraege_je_buchung(
        self, tenant_id: str, reservations: list[dict]
    ) -> dict[str, common.Vertragsregeln]:
        """Der geltende Abrechnungsvertrag JE BUCHUNG (0343, Umstiegsschritt 1).

        Stichtag ist der Check-out der Buchung — derselbe Stichtag, den
        ``_rental_rows`` schon für den Währungskurs benutzt. Ein im September
        erzeugtes Juli-Statement rechnet damit mit dem Juli-Vertrag; über
        ``date.today()`` ergäbe dieselbe Abrechnung je Erzeugungstag eine andere
        Zahl.

        Buchungen mit gleichem (Objekt, Check-out) teilen sich die Auflösung.
        Objekte ohne Eigentümer-Datensatz oder ohne Vertrag am Stichtag fehlen
        in der Karte; der Aufrufer fällt dann auf die Altspalten zurück.
        """
        if not reservations:
            return {}
        property_ids = sorted(
            {str(r["property_id"]) for r in reservations if r.get("property_id")}
        )
        owner_je_objekt: dict[str, str] = {}
        for row in (
            self._db.table("owner_properties")
            .select("owner_id, property_id")
            .in_("property_id", property_ids)
            .execute()
        ).data or []:
            owner_je_objekt[str(row["property_id"])] = str(row["owner_id"])

        from src.features.owner_billing.service import (  # noqa: PLC0415
            OwnerBillingService,
        )

        billing = OwnerBillingService(service_client=self._db)
        gecacht: dict[tuple[str, str], common.Vertragsregeln | None] = {}
        out: dict[str, common.Vertragsregeln] = {}
        for r in reservations:
            pid = str(r.get("property_id") or "")
            owner_id = owner_je_objekt.get(pid)
            checkout = str(r.get("check_out") or "")
            if not (owner_id and checkout):
                continue
            schluessel = (pid, checkout)
            if schluessel not in gecacht:
                try:
                    stichtag = date.fromisoformat(checkout)
                except (ValueError, TypeError):
                    continue
                zeile = billing.vertrag_aufloesen(
                    tenant_id, owner_id, pid, stichtag
                )
                try:
                    gecacht[schluessel] = (
                        common.vertragsregeln_aus_zeile(zeile) if zeile else None
                    )
                except PayoutUnbekannt as exc:
                    # Ein ungültiger Satz IM VERTRAG ist ein echter
                    # Eingabefehler und bleibt ein harter 422 — anders als im
                    # Kalender, der nur eine Zelle leer lässt. Eine Abrechnung
                    # ist ein Dokument über Geld; sie darf nicht mit einem
                    # stillschweigend ignorierten Vertrag entstehen.
                    raise StatementError(
                        f"Ungültiger Abrechnungsvertrag für Objekt {pid}: "
                        f"{exc.message}",
                        status_code=422,
                    ) from exc
            regeln = gecacht[schluessel]
            if regeln is not None:
                out[str(r["id"])] = regeln
        return out

    def _commission_map(self, owner: dict) -> dict[str, Decimal]:
        """Effektive Provision je Objekt aus den Stammdaten.

        Pro Objekt gilt ``owner_properties.commission_override_pct``; ist kein
        Override gesetzt, der ``owners.default_commission_pct``. So fließt die in
        den Stammdaten je Objekt konfigurierte Provision in die Abrechnung —
        nicht ein pauschaler Owner-Default.

        Die Ableitung selbst steht im GETEILTEN Helfer
        ``common.effektive_provision_pct`` — dieselbe Regel nutzt der
        Eigentümer-Kalender im public_portal (Etappe B). Läge sie hier als
        Kopie, könnten Kalender und Abrechnung verschiedene Sätze anwenden.

        Fehlt BEIDES (kein Override, kein Default), steht für dieses Objekt
        KEIN Satz fest — das Objekt fehlt dann in der Rückgabe. Bis 09.08.2026
        stand hier ein `pct = Decimal("0")`: der fehlende Satz wurde zu 0 %
        geglättet, der Eigentümer bekam 100 % der Auszahlung und der Betrieb
        nichts. Live belegt am Betrieb AirSmil (8 Booking-Buchungen):
        Gesamt-Auszahlung 32.120,45 DKK, Verwaltungs-Auszahlung 0,00 DKK.
        Das ist keine Rundung, sondern eine Falschaussage über Geld (Wurzel 4)
        — und sie sah plausibel aus, weil 0,00 eine gültige Zahl ist.

        Ein fehlender Satz lässt die Abrechnung NICHT scheitern: die Buchungen
        des Objekts bleiben in der Aufstellung, nur die davon abhängigen
        Auszahlungs-Zahlen werden als unbekannt ausgewiesen („—") statt
        erfunden. So sieht der Betreiber genau, welches Objekt ihm fehlt.
        """
        default = owner.get("default_commission_pct")
        rows = (
            self._db.table("owner_properties")
            .select("property_id, commission_override_pct")
            .eq("owner_id", str(owner["id"]))
            .execute()
        ).data or []
        out: dict[str, Decimal] = {}
        for r in rows:
            try:
                pct = effektive_provision_pct(
                    r.get("commission_override_pct"), default
                )
            except PayoutUnbekannt as exc:
                # Ein Satz AUSSERHALB 0–100 % ist ein echter Eingabefehler und
                # bleibt ein harter 422: ihn stillschweigend zu verwerfen
                # zahlte dem Eigentümer den vollen Betrag aus, obwohl jemand
                # 120 % eingetragen hat (Wurzel 4/5).
                if exc.grund == "provision_ungueltig":
                    raise StatementError(
                        f"Ungültiger Provisionssatz am Objekt "
                        f"{r['property_id']}: {exc.message}",
                        status_code=422,
                    ) from exc
                # FEHLENDER Satz: das Objekt kommt NICHT in die Karte. Die
                # Aufrufer erkennen daran „für dieses Objekt ist die Provision
                # offen" und weisen die abhängigen Beträge als „—" aus, statt
                # eine 0 zu erfinden.
                continue
            out[str(r["property_id"])] = pct
        return out

    @staticmethod
    def _effective_pct(
        commission_map: dict[str, Decimal], rental_rows: list[RentalRow]
    ) -> Decimal | None:
        """Anzuzeigender Provisionssatz: sind alle betroffenen Objekte gleich,
        dieser Satz; bei gemischten Sätzen der gewichtete Schnitt über den Payout.
        Nur für die Anzeige (commission_pct im Response) — die Rechnung selbst
        läuft pro Objekt über die commission_map.

        `None`, sobald für EIN betroffenes Objekt kein Satz feststeht. Bis
        09.08.2026 zählte ein fehlender Satz hier als 0 % und zog den
        angezeigten Schnitt nach unten — die Maske behauptete einen
        Provisionssatz, den niemand vereinbart hatte (Wurzel 4).
        """
        if not rental_rows:
            return None
        raten = [commission_map.get(r.listing_id) for r in rental_rows]
        if any(p is None for p in raten):
            return None
        eindeutig = set(raten)
        if len(eindeutig) == 1:
            return next(iter(eindeutig))
        base = sum((_d(r.total_payout) for r in rental_rows), Decimal("0"))
        if base == 0:
            return None
        weighted = sum(
            (
                _d(r.total_payout) * commission_map[r.listing_id]
                for r in rental_rows
            ),
            Decimal("0"),
        )
        return (weighted / base).quantize(Decimal("0.01"))

    # `_effective_rate_from_rows` gab es hier bis 09.08.2026: den über den
    # Payout gewichteten Provisionssatz, EINZIG dazu da, die Verrechnungsposten
    # zu kürzen. Mit der 1:1-Verrechnung (Modul-Docstring) hat er keinen
    # Aufrufer mehr und ist ersatzlos entfallen — er stehenzulassen lüde ein,
    # den Fehler wieder anzuschließen.

    def _owner_currency(self, owner: dict, tenant_id: str) -> str:
        """Zielwährung des Owners aus seinem Herkunftsland; fehlt das Land oder
        ist es unbekannt, die Tenant-Währung (kein stiller EUR-Fallback)."""
        return currency_for_country(owner.get("country")) or self._tenant_currency(
            tenant_id
        )

    def _property_titles(self, property_ids: list[str]) -> dict[str, str]:
        if not property_ids:
            return {}
        rows = (
            self._db.table("properties")
            .select("id, title")
            .in_("id", property_ids)
            .execute()
        ).data or []
        return {str(r["id"]): r.get("title") or "" for r in rows}

    def _tenant_name(self, tenant_id: str) -> str | None:
        rows = (
            self._db.table("tenants")
            .select("name, currency")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("name") if rows else None

    def _tenant_currency(self, tenant_id: str) -> str:
        rows = (
            self._db.table("tenants")
            .select("currency")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        currency = rows[0].get("currency") if rows else None
        if not currency:
            raise StatementError(
                "Mandanten-Währung fehlt — bitte im Konto die Währung setzen.",
                status_code=422,
            )
        return currency

    def _tenant_tax_profile(self, tenant_id: str) -> dict:
        """Steuerprofil des Mandanten (Aussteller). Quelle ist das vorhandene
        Buchhaltungs-Profil (tenant_billing_profile aus 0023) plus das Land aus
        tenants.country. Vereinheitlicht zu: tax_scheme, default_tax_rate, vat_id,
        tax_number, country, e_invoice_format."""
        billing = (
            self._db.table("tenant_billing_profile")
            .select(
                "tax_number, vat_id, is_kleinunternehmer, default_tax_rate, "
                "e_invoice_format, company_country"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        tenant = (
            self._db.table("tenants")
            .select("country")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        b = billing[0] if billing else {}
        # Aussteller-Land bevorzugt aus dem Firmenprofil (/konto), sonst Tenant.
        country = b.get("company_country") or (tenant[0].get("country") if tenant else None)
        return {
            "country": country,
            "tax_scheme": (
                "small_business" if b.get("is_kleinunternehmer") else "vat"
            ),
            "default_tax_rate": b.get("default_tax_rate"),
            "vat_id": b.get("vat_id"),
            "tax_number": b.get("tax_number"),
            "e_invoice_format": b.get("e_invoice_format"),
        }

    # --- Reservierungen + Rental activity -----------------------------------

    def _reservations(
        self,
        tenant_id: str,
        property_ids: list[str],
        period_from: date,
        period_to: date,
        basis: str,
        statuses: list[str],
    ) -> list[dict]:
        """Reservierungen der Owner-Objekte im Zeitraum (nach basis gefiltert)."""
        if not property_ids:
            return []
        basis_col = "check_in" if basis == "check_in" else "check_out"
        query = (
            self._db.table("reservations")
            .select(
                "id, property_id, guest_id, channel, check_in, check_out, "
                "status, total_amount, channel_fee, currency, "
                # Für die Gebühren-/Portal-Kette (0364): der Payload-Schlüssel,
                # der gemeldete Portal-Abzug und wer das Geld eingezogen hat.
                "source_channex_booking_id, ota_commission, payment_collect, "
                # `pets` entscheidet, ob die Haustiergebühr des Objekts anfiel.
                "pets"
            )
            .eq("tenant_id", tenant_id)
            # Eigentümer-Aufenthalte (0241) gehören NICHT in die Abrechnung: der
            # Eigentümer hat sein eigenes Objekt genutzt, das ist weder Erlös
            # noch Auszahlung. Ohne diesen Filter stünden sie mit 0,00 als Zeile
            # im Statement — eine „Buchung", für die er nichts bekommt, und die
            # Belegungsquote der Abrechnung wäre verfälscht.
            .eq("is_owner_stay", False)
            .in_("property_id", property_ids)
            .gte(basis_col, period_from.isoformat())
            .lte(basis_col, period_to.isoformat())
            # Stabile Sortierung für die Pagination (id ist eindeutig).
            .order("id")
        )
        if statuses:
            query = query.in_("status", statuses)
        # VOLLSTÄNDIG paginiert: das finalisierte Owner-Statement summiert
        # total_amount/Payout über ALLE Reservierungen des Zeitraums. Ein stiller
        # 1000-Zeilen-Cap (PGRST_DB_MAX_ROWS) würde bei vielen kurzen OTA-Aufenthalten
        # zu einem dauerhaft zu niedrigen, aber nummerierten Abrechnungsbetrag führen.
        return fetch_all_rows(query)

    @staticmethod
    def _nights(check_in: str, check_out: str) -> int:
        try:
            d_in = date.fromisoformat(check_in)
            d_out = date.fromisoformat(check_out)
            return max((d_out - d_in).days, 0)
        except (ValueError, TypeError):
            return 0

    def _guest_names(self, guest_ids: list[str]) -> dict[str, str]:
        ids = [g for g in guest_ids if g]
        if not ids:
            return {}
        rows = (
            self._db.table("guests")
            .select("id, name")
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]): r.get("name") or "" for r in rows}

    def _addon_sums(self, reservation_ids: list[str]) -> dict[str, Decimal]:
        """Extra-Umsatz (Zusatzleistungen) je Reservierung → in den Owner-Split.

        Zählt pending UND paid (ohne Stripe gilt „zahlbar bei Anreise" — der
        Umsatz ist dennoch entstanden); cancelled bleibt außen vor. Add-ons sind
        provisionsfrei am OTA vorbei verkauft, fließen aber wie Mietumsatz in den
        Provisions-/Auszahlungs-Split der Hausverwaltung."""
        ids = [r for r in reservation_ids if r]
        if not ids:
            return {}
        try:
            # VOLLSTÄNDIG paginiert (fetch_all_rows) wie _reservations(): der Add-on-
            # Umsatz fließt in payout/owner_payout des finalisierten Statements. Ein
            # stiller 1000-Zeilen-Cap (PGRST_DB_MAX_ROWS) hätte bei vielen Add-ons
            # (Endreinigung, Kurtaxe, Frühstück …) über viele Reservierungen einen zu
            # niedrigen, aber nummerierten Auszahlungsbetrag ergeben.
            rows = fetch_all_rows(
                self._db.table("reservation_addons")
                .select("id, reservation_id, total, status")
                .in_("reservation_id", ids)
                .order("id")
            )
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = kein Extra-Umsatz
            log.warning("statement_addons_unavailable", error=str(exc))
            return {}
        sums: dict[str, Decimal] = {}
        for a in rows:
            if (a.get("status") or "pending") == "cancelled":
                continue
            rid = str(a["reservation_id"])
            sums[rid] = sums.get(rid, Decimal("0")) + _d(a.get("total"))
        return sums

    def _rental_rows(  # noqa: PLR0913 — Bezugsdaten einer Abrechnungszeile
        self,
        tenant_id: str,
        reservations: list[dict],
        titles: dict[str, str],
        owner_currency: str,
        override: Decimal | None,
        commission_map: dict[str, Decimal] | None,
        mask: GuestMask,
    ) -> list[RentalRow]:
        """Rental-Activity-Zeilen inkl. Buchungssatz und Währungsumrechnung.

        Je Reservierung: Auszahlung = total_amount − channel_fee (Quellwährung);
        Owner-Auszahlung (Buchungssatz) = Auszahlung × (1 − Provision); die
        Provision ist der manuelle Override, sonst der Objekt-Satz aus der Map.
        Der Buchungssatz wird mit dem ECB-Tageskurs am CHECK-OUT in die
        Owner-Währung umgerechnet (kein Fallback — FxError bricht ab).

        Der Gastname läuft durch die zentrale Maske (Daten-Split §4): ein
        Eigentümer (OWNER_REPORTING, aber ohne VIEW_GUEST_NAME) sieht nur den
        Vornamen — nie den vollen Gast-PII.
        """
        guest_names = self._guest_names(
            [str(r["guest_id"]) for r in reservations if r.get("guest_id")]
        )
        addon_sums = self._addon_sums([str(r["id"]) for r in reservations])
        cmap = commission_map or {}
        # Abrechnungsvertrag (0343) je Buchung, Stichtag = Check-out. Er schlägt
        # die Altspalten, aber NICHT den manuellen Editor-Override: wer in der
        # Maske einen Satz einträgt, korrigiert bewusst diese eine Abrechnung.
        vertraege = self._vertraege_je_buchung(tenant_id, reservations)
        # Gebühren-Bezugsdaten und Portal-Sätze EINMAL je Abrechnung laden —
        # dieselben Quellen wie im Eigentümer-Portal (0364).
        kontext = self._gebuehren_kontext(tenant_id, reservations)
        portal_saetze = self._portal_saetze_je_buchung(tenant_id, reservations)
        rows: list[RentalRow] = []
        for r in reservations:
            listing_id = str(r["property_id"])
            src_currency = (r.get("currency") or owner_currency).upper()
            # Extra-Umsatz aus Zusatzleistungen fließt in Preis + Auszahlung
            # (provisionsfrei verkauft → keine channel_fee darauf).
            addon_total = addon_sums.get(str(r["id"]), Decimal("0"))
            price = _d(r.get("total_amount")) + addon_total
            # Payout und Owner-Split über den GETEILTEN Helfer — dieselbe
            # Formel, die der Eigentümer-Kalender je Nacht anwendet.
            try:
                payout = buchungs_payout(
                    r.get("total_amount"), r.get("channel_fee"), addon_total
                )
            except PayoutUnbekannt:
                # Bestandsschutz wie bei der Provision: eine Altzeile ohne
                # total_amount galt hier bisher als 0 und darf die ganze
                # Abrechnung nicht scheitern lassen. Der Kalender ist strenger.
                payout = addon_total - _d(r.get("channel_fee"))
            # Steht für dieses Objekt kein Satz fest, ist die Auszahlung dieser
            # Zeile NICHT berechenbar. Bis 09.08.2026 sprang hier ein
            # `Decimal("0")` ein und machte daraus „Eigentümer bekommt alles,
            # Betrieb nichts" (Wurzel 4). Ein manueller Override sticht den
            # fehlenden Stammdatensatz weiterhin — dann ist der Satz ja gesetzt.
            # Vorrang: Editor-Override → Vertrag → Altspalten. Der Override
            # steht ganz vorn, weil er eine bewusste Einzelfall-Korrektur der
            # Agentur ist; der Vertrag ist die Regel, die Altspalte der Rest.
            regeln = vertraege.get(str(r["id"]))
            pct = override if override is not None else cmap.get(listing_id)
            # Warum eine Zeile ihre Auszahlung nicht ausweisen kann — als
            # maschinenlesbarer Grund, den die UI benennt.
            grund: str | None = None
            # Die Kettenglieder der Auszahlung. `None` bleibt bestehen, wenn die
            # Kette nicht lief (Override, kein Vertrag) oder abbrach — nie 0.
            kette: common.Auszahlung | None = None
            if override is None and regeln is not None:
                # VOLLE Kette wie im Eigentümer-Portal (0364): Gebühren in den
                # Gastpreis, Portal-Abzug, provisionsfreie Gebühren aus der
                # Bemessung, die des Eigentümers zu 100 % zurück. Rechnete die
                # Abrechnung hier anders als der Kalender, stritten sich zwei
                # Zahlen über dasselbe Geld — genau was `common` verhindert.
                #
                # EINE UNBERECHENBARE ZEILE DARF DIE ABRECHNUNG NICHT KIPPEN
                # (Wurzel 5): fehlt der Portal-Satz für einen Kanal oder ist eine
                # Gebührenart nicht zugeordnet, warf die Kette bis hierher durch
                # bis in den Router — `POST /owner-statements/preview` antwortete
                # mit 500, und der Betrieb sah eine kaputte Seite statt der
                # Auskunft, welche Einstellung fehlt. Live am 11.08.2026
                # ausgelöst, weil `portal_abzugssaetze` noch leer ist.
                #
                # Die Zeile bleibt deshalb mit allem drin, was FESTSTEHT (Nächte,
                # Gastpreis, Kanal); nur die abhängige Auszahlung wird `None` und
                # trägt ihren Grund. Dasselbe Verhalten wie im Bericht
                # (`owner_reporting.auswertung`), damit nicht zwei Ansichten
                # denselben Datenmangel verschieden behandeln. Eine 0 stünde für
                # „der Eigentümer bekommt nichts", die Zeile weglassen ergäbe
                # eine zu niedrige, aber unverdächtige Summe (Wurzel 4).
                try:
                    ergebnis = self._auszahlung_einer_buchung(
                        r,
                        regeln=regeln,
                        addon_total=addon_total,
                        kontext=kontext,
                        portal_saetze=portal_saetze,
                        currency=src_currency,
                    )
                except PayoutUnbekannt as exc:
                    grund = exc.grund
                    owner_payout = None
                    log.warning(
                        "abrechnung_zeile_unbestimmt",
                        reservation_id=str(r["id"]),
                        grund=exc.grund,
                        detail=exc.message,
                    )
                else:
                    kette = ergebnis
                    owner_payout = ergebnis.netto
                    # Der GASTPREIS ist jetzt der Bruttoumsatz inkl. Gebühren —
                    # vorher stand hier nur Übernachtung + Extras, also weniger
                    # als der Gast gezahlt hat.
                    price = ergebnis.brutto
                    # Für die ANZEIGE (`commission_pct`) bleibt der Satz des
                    # Vertrags maßgeblich — sonst behauptete die Abrechnung einen
                    # Satz aus einer Spalte, mit der sie nicht gerechnet hat.
                    pct = regeln.provisions_pct
            else:
                owner_payout = (
                    common.owner_payout(payout, pct) if pct is not None else None
                )
                if owner_payout is None:
                    grund = "provision"

            # Buchungssatz in Owner-Währung umrechnen (Stichtag = Check-out).
            checkout = r.get("check_out")
            rate = Decimal("1")
            fx_date: date | None = None
            if src_currency != owner_currency:
                fx_date = date.fromisoformat(checkout) if checkout else None
                if fx_date is None:
                    raise StatementError(
                        "Reservierung ohne Check-out-Datum kann nicht in die "
                        "Owner-Währung umgerechnet werden.",
                        status_code=422,
                    )
                try:
                    rate = self._fx.get_rate(fx_date, src_currency, owner_currency)
                except FxError as exc:
                    raise StatementError(str(exc), status_code=502) from exc
            owner_payout_conv = (
                owner_payout * rate if owner_payout is not None else None
            )
            herkunft = self._gebuehren_herkunft(r, kontext)

            rows.append(
                RentalRow(
                    reservation_id=str(r["id"]),
                    guest=mask.name(guest_names.get(str(r.get("guest_id")))),
                    nights=self._nights(r.get("check_in"), checkout),
                    listing_id=listing_id,
                    listing=titles.get(listing_id),
                    channel=r.get("channel") or "direct",
                    # DER GAST-BRUTTOPREIS läuft durch dieselbe Maske wie der
                    # Gastname eine Zeile darüber. Er stand hier ungefiltert und
                    # landete über `web/lib/statement-pdf.ts` im PDF, das der
                    # Eigentümer selbst aus seinem Portal herunterlädt — genau
                    # die Zahl, die §4.2 ihm verwehrt. `mask.amount` gibt einem
                    # Nutzer ohne Betrags-Sicht `None`; die UI rendert dann „—",
                    # nie eine 0 (Wurzel 4).
                    total_price=mask.amount(_money(price)),
                    total_payout=_money(payout),
                    currency=src_currency,
                    owner_payout=(
                        _money(owner_payout) if owner_payout is not None else None
                    ),
                    owner_payout_converted=(
                        _money(owner_payout_conv)
                        if owner_payout_conv is not None
                        else None
                    ),
                    fx_rate=float(rate),
                    fx_date=fx_date,
                    # Der ECHTE Grund, nicht pauschal „provision": ein fehlender
                    # Portal-Satz (`portal_abzug`) und eine nicht zugeordnete
                    # Gebührenart (`gebuehr_nicht_zugeordnet`) verlangen ganz
                    # verschiedene Handgriffe. Beides „Provision fehlt" zu nennen
                    # schickte den Betrieb an die falsche Maske.
                    payout_unbekannt=(
                        None if owner_payout is not None else (grund or "provision")
                    ),
                    # Nur AUSKUNFT, keine Rechnung: woher die Gebühren dieser
                    # Zeile kommen. Steht auch dann noch da, wenn die Auszahlung
                    # nicht berechenbar war — dort ist der Hinweis am nötigsten.
                    gebuehren_quelle=herkunft[0],
                    gebuehren_grund=herkunft[1],
                    # DIE KETTE, die zum `owner_payout` fuehrt. Ohne sie ist der
                    # Endbetrag eine Behauptung — genau der Grund, aus dem die
                    # Vertragspauschale ein zweites Mal von Hand angelegt wurde.
                    #
                    # `portal_provision` und `bemessungsgrundlage` maskiert wie
                    # `total_price`: sie legen offen, was das Portal einbehaelt,
                    # und gehoeren damit zur Betriebs-, nicht zur
                    # Eigentuemersicht (§4.2).
                    portal_provision=(
                        mask.amount(_money(kette.portal_provision))
                        if kette is not None
                        else None
                    ),
                    bemessungsgrundlage=(
                        mask.amount(_money(kette.bemessungsgrundlage))
                        if kette is not None
                        else None
                    ),
                    verwaltungsprovision=(
                        _money(kette.verwaltungsprovision)
                        if kette is not None
                        else None
                    ),
                    pauschale=(
                        _money(kette.pauschale) if kette is not None else None
                    ),
                    gebuehren_an_eigentuemer=(
                        _money(kette.gebuehren_an_eigentuemer)
                        if kette is not None
                        else None
                    ),
                )
            )
        return rows

    @staticmethod
    def _listing_rows(
        rental_rows: list[RentalRow], titles: dict[str, str]
    ) -> list[ListingRow]:
        """Aktivität je Objekt aus den (bereits maskierten) Buchungszeilen.

        `total_price` bleibt `None`, sobald EINE Zeile maskiert ist: eine
        Aggregation über die sichtbaren Zeilen wäre für einen Eigentümer immer
        0,00 € und damit eine glatte Falschaussage — und für einen teilweise
        maskierten Blick eine zu kleine Summe (Wurzel 4). Die Maskierung an der
        Zeile darf nicht durch die Summenzeile umgangen werden.
        """
        agg: dict[str, dict] = {}
        for row in rental_rows:
            a = agg.setdefault(
                row.listing_id,
                {
                    "nights": 0,
                    "reservations": 0,
                    "price": Decimal("0"),
                    "price_sichtbar": True,
                    "payout": Decimal("0"),
                },
            )
            a["nights"] += row.nights
            a["reservations"] += 1
            if row.total_price is None:
                a["price_sichtbar"] = False
            else:
                a["price"] += _d(row.total_price)
            a["payout"] += _d(row.total_payout)
        return [
            ListingRow(
                listing_id=lid,
                listing=titles.get(lid),
                nights=a["nights"],
                reservations=a["reservations"],
                total_price=_money(a["price"]) if a["price_sichtbar"] else None,
                total_payout=_money(a["payout"]),
            )
            for lid, a in agg.items()
        ]

    # --- Expenses ------------------------------------------------------------

    def _expenses_for_statement(
        self, tenant_id: str, statement_id: str
    ) -> list[dict]:
        """Posten einer Abrechnung — geladen UND gescopet in EINEM Aufruf.

        Der `tenant_id`-Filter ist nicht redundant, auch wenn jeder heutige
        Aufrufer die Abrechnung vorher über `_statement_row` gescopet hat: die
        Service-Role umgeht RLS, ein Load per Fremd-ID ohne eigenen Scope ist
        also nur so lange harmlos, wie der Aufrufer daran denkt (Wurzel 3).
        """
        return (
            self._db.table("owner_expenses")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("statement_id", statement_id)
            .order("date")
            .execute()
        ).data or []

    def _visible_expenses(
        self, ctx: AuthContext, expenses: list[dict]
    ) -> list[dict]:
        """Ausgaben aus Owner-Sicht filtern: als `hidden_from_owner` markierte
        Positionen werden dem Eigentümer weder gelistet noch (bei Live-Summen)
        eingerechnet. Die Agentur (admin/co_admin) sieht sie unverändert."""
        if not self._is_owner(ctx):
            return expenses
        return [e for e in expenses if not e.get("hidden_from_owner")]

    @staticmethod
    def _pruefe_posten_waehrung(
        expenses: list[dict], owner_currency: str
    ) -> None:
        """Verrechnungsposten müssen in der Auszahlungswährung stehen.

        Seit 0344 trägt JEDER Posten seine eigene Währung. Die Auszahlung
        entsteht aber in der Währung des Eigentümers (`owner_payout_converted`
        ist bereits dorthin umgerechnet), und die Posten fließen 1:1 ohne
        Umrechnung hinein. Ein DKK-Posten in einer EUR-Abrechnung würde also
        stellenweise addiert, als wären 200 DKK gleich 200 EUR — eine
        Verschiebung um den ganzen Wechselkurs, die niemand als Fehler sieht,
        weil das Ergebnis plausibel aussieht (Wurzel 4).

        Es wird bewusst NICHT still umgerechnet: ein Kurs zum Erfassungstag
        wäre eine erfundene Zahl in einer Abrechnung, die auch zur Rechnung
        wird. Stattdessen klar fehlschlagen (422), damit der Posten in der
        richtigen Währung erfasst wird.

        Posten ohne Währung (Altbestand vor 0344, dort wo weder Objekt noch
        Betrieb eine hergab) werden NICHT beanstandet — für sie gilt weiterhin
        die Abrechnungswährung, und ein 422 würde eine bestehende Abrechnung
        unlesbar machen, ohne dass jemand die alte Zeile noch korrigieren kann.
        """
        abweichend = sorted(
            {
                waehrung
                for e in expenses
                if (waehrung := str(e.get("currency") or "").strip().upper())
                and waehrung != owner_currency.strip().upper()
            }
        )
        if abweichend:
            raise StatementError(
                "Verrechnungsposten in "
                f"{', '.join(abweichend)} lassen sich nicht in eine Abrechnung "
                f"in {owner_currency} einrechnen. Bitte die Posten in der "
                "Abrechnungswährung erfassen.",
                status_code=422,
            )

    def _owner_unbound_expenses(
        self, tenant_id: str, owner_id: str, period_from: date, period_to: date
    ) -> list[dict]:
        """Owner-Ausgaben im Zeitraum, die (noch) an KEINE Abrechnung gebunden
        sind — für die Live-Vorschau der Owner-Seite."""
        return (
            self._db.table("owner_expenses")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
            .is_("statement_id", "null")
            .gte("date", period_from.isoformat())
            .lte("date", period_to.isoformat())
            .order("date")
            .execute()
        ).data or []

    # --- Auszahlungsformel ---------------------------------------------------

    def _compute_summary(  # noqa: PLR0913 — Summen brauchen ihre Bezugsgrößen
        self,
        rental_rows: list[RentalRow],
        expenses: list[dict],
        owner_id: str,
        currency: str,
        owner_currency: str,
        mask: GuestMask | None = None,
    ) -> StatementSummary:
        """Summen aus den (bereits provisioniert + umgerechnet) Rental-Zeilen.

        Owner-Payout = Σ owner_payout_converted (in Owner-Währung) + die
        Verrechnungsposten, VOLL (1:1, siehe Modul-Docstring). Verwaltungs-
        Auszahlung bleibt je QUELLWÄHRUNG getrennt (= total_payout − owner_payout
        je Reservierung), da Beträge verschiedener Währungen nicht addiert werden
        dürfen. total_payout (Anzeige) ebenfalls je Quellwährung.

        DATEN-SPLIT (§4.2): `mask` entscheidet über die beiden Zahlen, die dem
        Eigentümer nicht gehören — die Gast-Mieteinnahmen (`total_price`) und
        den Ertrag der Verwaltung (`pm_payout` samt Aufschlüsselung). Ohne
        `mask` (interne Neuberechnung ohne anfragenden Nutzer) bleiben sie
        stehen; ausgeliefert wird die Summe nur über `get`/`preview`, und die
        geben ihre Maske mit.
        """
        # Sobald EINE Zeile maskiert ist, gibt es keine Mieteinnahmen-Summe:
        # aus den sichtbaren Zeilen zu summieren ergäbe für den Eigentümer
        # glatte 0,00 € — eine Zahl, die aussieht wie „nichts eingenommen"
        # (Wurzel 4). Dann lieber `None` und in der UI ein „—".
        preis_sichtbar = all(r.total_price is not None for r in rental_rows)
        total_price = sum(
            (_d(r.total_price) for r in rental_rows if r.total_price is not None),
            Decimal("0"),
        )
        total_payout = sum((_d(r.total_payout) for r in rental_rows), Decimal("0"))
        # Die Posten werden UNUMGERECHNET zur Auszahlung addiert; das ist nur
        # zulässig, wenn sie in derselben Einheit stehen (siehe
        # `_pruefe_posten_waehrung`).
        self._pruefe_posten_waehrung(expenses, owner_currency)
        # Wirkbetrag je Posten: +amount zugunsten, −amount zulasten. EINE
        # Ableitung (`_richtungssummen` über `_signed_amount`) für Summe,
        # Snapshot-Spalten, Antwortmodell und PDF.
        expenses_total, zugunsten, zulasten = _richtungssummen(expenses)
        owner_expenses = sum(
            (
                _signed_amount(e)
                for e in expenses
                if str(e.get("owner_id")) == owner_id
            ),
            Decimal("0"),
        )

        # Owner-Payout: umgerechnete Buchungssätze (in Owner-Währung) + die
        # Verrechnungsposten VOLL. Bis 09.08.2026 stand hier
        # `owner_expenses * ((100 − eff) / 100)` — der Posten wurde also mit dem
        # Provisionssatz gekürzt, als wäre er Umsatz. Für eine ausgelegte
        # Auslage über 200 DKK bekam der Betrieb bei 20 % nur 160 DKK zurück.
        # Ein Verrechnungsposten ist kein Umsatz: er verschiebt die Auszahlung
        # um genau seinen Betrag, die Provision hängt allein an den Buchungen.
        # Steht für EINE Zeile der Provisionssatz nicht fest, gibt es keine
        # Eigentümer-Auszahlung für diesen Zeitraum: die fehlende Zeile
        # einfach zu überspringen ergäbe eine zu kleine Summe, die wie eine
        # vollständige aussieht (Wurzel 4). Dann ist die Zahl `None` und die
        # UI zeigt „—" samt Grund, bis der Satz gepflegt ist.
        provision_offen = any(r.owner_payout_converted is None for r in rental_rows)
        owner_payout = (
            None
            if provision_offen
            else owner_expenses
            + sum((_d(r.owner_payout_converted) for r in rental_rows), Decimal("0"))
        )

        # Verwaltungs-Auszahlung + Roh-Summen je Quellwährung gruppieren.
        # Bei offener Provision gibt es den Verwaltungsanteil nicht: er ist
        # genau die Differenz, die ohne Satz unbekannt ist. Die Roh-Summe je
        # Währung (`tot_by`) bleibt davon unberührt — sie hängt nicht an der
        # Provision und ist weiterhin eine wahre Zahl.
        pm_by: dict[str, Decimal] = {}
        tot_by: dict[str, Decimal] = {}
        for r in rental_rows:
            if not provision_offen:
                pm_by[r.currency] = pm_by.get(r.currency, Decimal("0")) + (
                    _d(r.total_payout) - _d(r.owner_payout)
                )
            tot_by[r.currency] = tot_by.get(r.currency, Decimal("0")) + _d(r.total_payout)
        # Single-Currency UND Owner-Währung == Quellwährung: die Owner-Expense
        # fließt in den Verwaltungsanteil (pm = total_payout − owner_payout, beide
        # in derselben Währung). Sonst (Mehrwährung oder abweichende Owner-Währung)
        # bleibt der PM-Anteil je Quellwährung roh, da owner_payout in einer
        # ANDEREN Währung steht und nicht abgezogen werden darf.
        same_unit = (
            not provision_offen
            and len(pm_by) == 1
            and next(iter(pm_by)) == owner_currency
        )
        if same_unit:
            only = next(iter(pm_by))
            pm_by[only] = total_payout - owner_payout
        pm_by_list = [
            CurrencyAmount(currency=c, amount=_money(a)) for c, a in pm_by.items()
        ]
        tot_by_list = [
            CurrencyAmount(currency=c, amount=_money(a)) for c, a in tot_by.items()
        ]
        # pm_payout (Skalar): nur bei gleicher Einheit der korrekte
        # Verwaltungsanteil. Bei gemischten Währungen gibt es diese eine Zahl
        # NICHT — eine Mischsumme aus DKK und EUR wäre bedeutungslos. Hier
        # stand bis 09.08.2026 ein `Decimal("0")`: ein erfundener Ersatzwert
        # (Wurzel 4), der eine Agentur-Auszahlung von „0,00" behauptete, wo in
        # Wahrheit mehrere Beträge in mehreren Währungen anfielen. Die
        # Aufschlüsselung steht in `pm_payout_by_currency`; der Skalar ist dann
        # `None` und die UI zeigt „—".
        pm_payout = (total_payout - owner_payout) if same_unit else None

        # Beide Zahlen gehören nicht dem Eigentümer (siehe Docstring). `mask`
        # ist die BESTEHENDE Maske — keine zweite Sichtbarkeitslogik daneben.
        darf_fremde_betraege = mask is None or mask.amounts
        return StatementSummary(
            total_price=(
                _money(total_price) if preis_sichtbar and darf_fremde_betraege
                else None
            ),
            total_payout=_money(total_payout),
            expenses_total=_money(expenses_total),
            expenses_to_owner=_money(zugunsten),
            expenses_from_owner=_money(zulasten),
            owner_payout=(
                _money(owner_payout) if owner_payout is not None else None
            ),
            pm_payout=(
                _money(pm_payout)
                if pm_payout is not None and darf_fremde_betraege
                else None
            ),
            currency=currency,
            booking_count=len(rental_rows),
            owner_currency=owner_currency,
            pm_payout_by_currency=pm_by_list if darf_fremde_betraege else [],
            totals_by_currency=tot_by_list,
            # Der Grund, warum Auszahlungs-Zahlen fehlen. Ohne ihn stünde in
            # der Maske ein „—" ohne Erklärung, und der Betreiber wüsste nicht,
            # welche Einstellung fehlt (Wurzel 5: ein Fehlschlag muss sagen, was
            # zu tun ist).
            #
            # Der ECHTE Grund der ersten betroffenen Zeile, nicht pauschal
            # „provision": ein fehlender Portal-Abzugssatz und eine nicht
            # zugeordnete Gebührenart werden woanders gepflegt als ein fehlender
            # Provisionssatz. Beides „Provision fehlt" zu nennen schickte den
            # Betrieb an die falsche Maske. Die ERSTE genügt, weil die Meldung zum
            # Handeln auffordert — sind mehrere Dinge offen, erscheint der nächste
            # Grund nach dem ersten Handgriff.
            payout_unbekannt=_erster_grund(rental_rows) if provision_offen else None,
        )

    # --- Erzeugen / Lesen / Aktualisieren -----------------------------------

    def preview(
        self, ctx: AuthContext, req: StatementGenerateRequest
    ) -> StatementResponse:
        """Live-Auswertung für Owner + Zeitraum + Filter OHNE DB-Insert. Liefert
        dieselbe Struktur wie eine Abrechnung (Aktivität, Ausgaben, Summen), aber
        mit id='' (nicht gespeichert). Die Owner-Seite zeigt damit den Umsatz-
        Überblick; eine echte Abrechnung entsteht erst über generate()."""
        tenant_id = self._require_tenant(ctx)
        # Owner-Scope: Eigentümer dürfen nur die EIGENE Auswertung ziehen.
        if self._is_owner(ctx) and req.owner_id != self._owner_self_id(ctx, tenant_id):
            raise StatementError("Eigentümer nicht gefunden.", status_code=404)
        owner = self._owner(tenant_id, req.owner_id)
        # Expliziter Editor-Override gewinnt; sonst Provision je Objekt aus Stammdaten.
        override = _d(req.commission_pct) if req.commission_pct is not None else None
        commission_map = self._commission_map(owner)
        currency = self._tenant_currency(tenant_id)
        owner_currency = self._owner_currency(owner, tenant_id)
        header = self._header_from_stammdaten(tenant_id, owner)

        property_ids = self._owner_property_ids(req.owner_id)
        titles = self._property_titles(property_ids)
        reservations = self._reservations(
            tenant_id,
            property_ids,
            req.period_from,
            req.period_to,
            req.basis.value,
            req.reservation_statuses,
        )
        rental_rows = self._rental_rows(
            tenant_id, reservations, titles, owner_currency, override,
            commission_map, load_guest_mask(self._db, ctx.user_id),
        )
        listing_rows = self._listing_rows(rental_rows, titles)
        # Nicht an eine Abrechnung gebundene Owner-Ausgaben im Zeitraum einbeziehen.
        # Für den Owner die hidden_from_owner-Positionen aus Anzeige UND Summe raus.
        expenses = self._visible_expenses(
            ctx,
            self._owner_unbound_expenses(
                tenant_id, req.owner_id, req.period_from, req.period_to
            ),
        )
        summary = self._compute_summary(
            rental_rows, expenses, req.owner_id, currency, owner_currency,
            load_guest_mask(self._db, ctx.user_id),
        )
        # Für die Anzeige: effektiver Satz (einheitlich → dieser Satz, sonst gemischt).
        commission = override if override is not None else self._effective_pct(
            commission_map, rental_rows
        )
        # Zusammengesetzte, NICHT gespeicherte Statement-Antwort (id='').
        row = {
            "id": "",
            "tenant_id": tenant_id,
            "owner_id": req.owner_id,
            "period_from": req.period_from.isoformat(),
            "period_to": req.period_to.isoformat(),
            "basis": req.basis.value,
            "reservation_statuses": req.reservation_statuses,
            "status": "draft",
            "kind": "invoice",
            # None, solange für ein Objekt kein Satz feststeht — die Vorschau
            # ist nicht gespeichert, hier steht also nur die Anzeige-Zahl.
            "commission_pct": float(commission) if commission is not None else None,
            "currency": currency,
            **header.model_dump(),
        }
        return _to_response(
            row, summary, rental_rows, listing_rows, expenses, commission
        )

    def generate(
        self, ctx: AuthContext, req: StatementGenerateRequest
    ) -> StatementResponse:
        tenant_id = self._require_tenant(ctx)
        self._forbid_owner_writes(ctx)

        owner = self._owner(tenant_id, req.owner_id)
        # NULL = Provision je Objekt aus Stammdaten; Zahl = manueller Override.
        commission = (
            float(_d(req.commission_pct))
            if req.commission_pct is not None
            else None
        )
        currency = self._tenant_currency(tenant_id)
        header = self._header_from_stammdaten(tenant_id, owner)

        row = {
            "tenant_id": tenant_id,
            "owner_id": req.owner_id,
            "period_from": req.period_from.isoformat(),
            "period_to": req.period_to.isoformat(),
            "basis": req.basis.value,
            "reservation_statuses": req.reservation_statuses,
            "status": "draft",
            "commission_pct": commission,
            "currency": currency,
            **header.model_dump(),
        }
        res = self._db.table("owner_statements").insert(row).execute()
        if not res.data:
            raise StatementError("Statement konnte nicht angelegt werden.", status_code=500)
        statement_id = str(res.data[0]["id"])
        self._refresh_summary(tenant_id, statement_id)
        log.info(
            "owner_statement_generated",
            tenant_id=tenant_id,
            owner_id=req.owner_id,
            statement_id=statement_id,
        )
        return self.get(ctx, statement_id)

    def _header_from_stammdaten(self, tenant_id: str, owner: dict) -> StatementHeader:
        owner_addr = ", ".join(
            p
            for p in [
                " ".join(
                    x for x in [owner.get("street"), owner.get("house_number")] if x
                ).strip(),
                " ".join(
                    x for x in [owner.get("postal_code"), owner.get("city")] if x
                ).strip(),
                owner.get("country"),
            ]
            if p
        ) or None
        # PM/Agentur-Daten aus dem Buchhaltungs-Firmenprofil (0023 + 0026).
        billing = (
            self._db.table("tenant_billing_profile")
            .select(
                "legal_name, tax_number, vat_id, email, phone_number, "
                "company_street, company_house_number, company_postal_code, "
                "company_city, company_country, company_logo_url"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        b = billing[0] if billing else {}
        pm_addr = ", ".join(
            p
            for p in [
                " ".join(
                    x
                    for x in [b.get("company_street"), b.get("company_house_number")]
                    if x
                ).strip(),
                " ".join(
                    x
                    for x in [b.get("company_postal_code"), b.get("company_city")]
                    if x
                ).strip(),
                b.get("company_country"),
            ]
            if p
        ) or None
        return StatementHeader(
            pm_name=b.get("legal_name") or self._tenant_name(tenant_id),
            pm_email=b.get("email"),
            pm_phone=b.get("phone_number"),
            pm_address=pm_addr,
            pm_tax_id=b.get("vat_id") or b.get("tax_number"),
            pm_logo_url=b.get("company_logo_url"),
            owner_name=owner.get("name"),
            owner_email=owner.get("email"),
            owner_phone=owner.get("phone"),
            owner_address=owner_addr,
            owner_tax_id=owner.get("tax_id"),
        )

    def _statement_row(self, tenant_id: str, statement_id: str) -> dict:
        rows = (
            self._db.table("owner_statements")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", statement_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise StatementError("Statement nicht gefunden.", status_code=404)
        return rows[0]

    def _build_activity(
        self, tenant_id: str, row: dict, mask: GuestMask
    ) -> tuple[list[RentalRow], list[ListingRow], dict[str, str]]:
        """Aktivitätszeilen einer gespeicherten Abrechnung unter EINER Maske.

        Die Maske kommt vom Aufrufer, nicht aus einer `user_id` in dieser
        Methode. Der Unterschied ist der Kern des 23502-Fehlers: der interne
        Refresh hat hier `user_id=None` durchgereicht, was
        `load_guest_mask` fail-closed zur VOLL maskierten Maske auflöste
        (`amounts=False`). Damit war jede `RentalRow.total_price` `None` und
        die persistierte Summe ebenfalls — obwohl der Snapshot fachlich
        gerade die UNGEKÜRZTEN Zahlen tragen muss. Wer speichert, gibt
        `_MASKE_INTERN` mit; wer ausliefert, die Maske des Anfragenden.
        """
        owner = self._owner(tenant_id, str(row["owner_id"]))
        owner_currency = self._owner_currency(owner, tenant_id)
        override, cmap = self._commission_for_row(tenant_id, row)
        property_ids = self._owner_property_ids(str(row["owner_id"]))
        titles = self._property_titles(property_ids)
        reservations = self._reservations(
            tenant_id,
            property_ids,
            date.fromisoformat(row["period_from"]),
            date.fromisoformat(row["period_to"]),
            row.get("basis") or "check_in",
            list(row.get("reservation_statuses") or []),
        )
        rental_rows = self._rental_rows(
            tenant_id, reservations, titles, owner_currency, override, cmap, mask
        )
        listing_rows = self._listing_rows(rental_rows, titles)
        return rental_rows, listing_rows, titles

    def _commission_for_row(
        self, tenant_id: str, row: dict
    ) -> tuple[Decimal | None, dict[str, Decimal] | None]:
        """Provisions-Eingang für _compute_summary aus einer Statement-Zeile.

        commission_pct gesetzt → (Override, None); NULL → (None, Stammdaten-Map
        je Objekt). So gilt für gespeicherte Abrechnungen dieselbe Per-Objekt-
        Logik wie in der Vorschau.
        """
        pct = row.get("commission_pct")
        if pct is not None:
            return _d(pct), None
        owner = self._owner(tenant_id, str(row["owner_id"]))
        return None, self._commission_map(owner)

    def _refresh_summary(self, tenant_id: str, statement_id: str) -> StatementSummary:
        """Summen aus aktueller Aktivität + Expenses neu berechnen und im draft
        persistieren. Finalisierte Statements werden NICHT verändert."""
        row = self._statement_row(tenant_id, statement_id)
        # UNGEKÜRZT rechnen (siehe `_MASKE_INTERN`): der Snapshot ist der
        # Buchhaltungswert, nicht die Sicht des gerade Anfragenden. Gastnamen
        # bleiben trotzdem maskiert — sie fließen nicht in Summen.
        rental_rows, _listings, _titles = self._build_activity(
            tenant_id, row, _MASKE_INTERN
        )
        expenses = self._expenses_for_statement(tenant_id, statement_id)
        owner = self._owner(tenant_id, str(row["owner_id"]))
        owner_currency = self._owner_currency(owner, tenant_id)
        summary = self._compute_summary(
            rental_rows,
            expenses,
            str(row["owner_id"]),
            row.get("currency") or self._tenant_currency(tenant_id),
            owner_currency,
            _MASKE_INTERN,
        )
        if row.get("status") != "finalized":
            self._db.table("owner_statements").update(
                {
                    "total_price": summary.total_price,
                    "total_payout": summary.total_payout,
                    "expenses_total": summary.expenses_total,
                    # Die beiden Richtungen gehören MIT in den Snapshot. Ohne
                    # sie trüge die Zeile nur die Nettozahl, und der Lesepfad
                    # für finalisierte Belege fiel auf den Default 0 zurück
                    # (0348).
                    "expenses_to_owner": summary.expenses_to_owner,
                    "expenses_from_owner": summary.expenses_from_owner,
                    "owner_payout": summary.owner_payout,
                    "pm_payout": summary.pm_payout,
                    "owner_currency": summary.owner_currency,
                }
            ).eq("tenant_id", tenant_id).eq("id", statement_id).execute()
        return summary

    def _snapshot_summary(  # noqa: PLR0913 — der Snapshot braucht seine Bezüge
        self,
        row: dict,
        rental_rows: list[RentalRow],
        mask: GuestMask,
        tenant_id: str,
        owner_currency_fallback: str,
    ) -> StatementSummary:
        """Eingefrorene Summen aus der GESPEICHERTEN Zeile (finalized,
        cancelled, Storno).

        Der Snapshot ist die gespeicherte Zeile — die Maske greift beim
        AUSLIEFERN, nicht beim Speichern: `owner_statements` trägt die
        ungekürzten Summen für die Buchhaltung, aber der Eigentümer bekommt
        Gastpreis und Verwaltungs-Ertrag daraus nicht zu sehen (§4.2). Das ist
        genau der Pfad, über den das Portal sein PDF holt.

        Ein NULL in der Spalte heißt „diese Zahl gibt es nicht" (0346) und muss
        NULL bleiben. `_d(None)` ergäbe 0 und machte daraus die Aussage „0,00
        eingenommen" bzw. „keine Provision" (Wurzel 4).

        JEDES Feld der Summary wird hier gesetzt. Ein weggelassenes Feld fällt
        still auf seinen Pydantic-Default zurück und liefert eine erfundene,
        plausibel aussehende 0 bzw. eine leere Liste — genau so meldeten
        `expenses_to_owner`/`expenses_from_owner` bei jeder finalisierten
        Abrechnung 0, obwohl Posten vorlagen (0348).
        """
        currency = row.get("currency") or self._tenant_currency(tenant_id)
        owner_currency = row.get("owner_currency") or owner_currency_fallback
        # Die Aufschlüsselung je Quellwährung wird aus den EINGEFRORENEN
        # Skalaren gebildet, nicht aus den live nachgeladenen Rental-Zeilen:
        # sonst stünde neben der Snapshot-Summe eine heute berechnete
        # Aufschlüsselung, die ihr widersprechen kann. Zulässig ist das, weil
        # `finalize` gemischte Quellwährungen mit 422 ablehnt — ein
        # finalisierter Beleg hat genau EINE Währung, und der Skalar IST damit
        # bereits die vollständige Aufschlüsselung.
        pm_payout = _d(row["pm_payout"]) if row.get("pm_payout") is not None else None
        darf_fremde_betraege = mask.amounts
        return StatementSummary(
            total_price=(
                mask.amount(_money(_d(row["total_price"])))
                if row.get("total_price") is not None
                else None
            ),
            total_payout=_money(_d(row.get("total_payout"))),
            expenses_total=_money(_d(row.get("expenses_total"))),
            expenses_to_owner=_money(_d(row.get("expenses_to_owner"))),
            expenses_from_owner=_money(_d(row.get("expenses_from_owner"))),
            # NULL im Snapshot heißt „war nicht berechenbar" (kein
            # Provisionssatz). `_d(None)` wäre 0 und machte daraus wieder eine
            # Auszahlung von 0,00 — genau der Ersatzwert, den 0349 beseitigt.
            owner_payout=(
                _money(_d(row["owner_payout"]))
                if row.get("owner_payout") is not None
                else None
            ),
            pm_payout=(
                mask.amount(_money(pm_payout)) if pm_payout is not None else None
            ),
            currency=currency,
            booking_count=len(rental_rows),
            owner_currency=owner_currency,
            pm_payout_by_currency=(
                [CurrencyAmount(currency=owner_currency, amount=_money(pm_payout))]
                if pm_payout is not None and darf_fremde_betraege
                else []
            ),
            totals_by_currency=[
                CurrencyAmount(
                    currency=owner_currency,
                    amount=_money(_d(row.get("total_payout"))),
                )
            ],
            # Der Snapshot trägt den Grund nicht als eigene Spalte; er ist aus
            # der fehlenden Auszahlung eindeutig ableitbar.
            payout_unbekannt=(
                None if row.get("owner_payout") is not None else "provision"
            ),
        )

    def get(self, ctx: AuthContext, statement_id: str) -> StatementResponse:
        tenant_id = self._require_tenant(ctx)
        row = self._statement_row(tenant_id, statement_id)
        self._require_statement_visible(ctx, tenant_id, row)
        rental_rows, listing_rows, _titles = self._build_activity(
            tenant_id, row, load_guest_mask(self._db, ctx.user_id)
        )
        # Owner sieht als hidden_from_owner markierte Ausgaben weder gelistet noch
        # (bei Live-Summen) eingerechnet. Finalisierte Summen bleiben Snapshot.
        expenses = self._visible_expenses(
            ctx, self._expenses_for_statement(tenant_id, statement_id)
        )
        override, cmap = self._commission_for_row(tenant_id, row)
        owner = self._owner(tenant_id, str(row["owner_id"]))
        owner_currency = self._owner_currency(owner, tenant_id)
        # Anzuzeigender Satz: Override, sonst effektiver Satz aus den Stammdaten.
        commission_display = (
            override
            if override is not None
            else self._effective_pct(cmap or {}, rental_rows)
        )
        mask = load_guest_mask(self._db, ctx.user_id)
        if row.get("status") != "draft":
            # Eingefrorene Summen aus dem Snapshot (finalized, cancelled, Storno).
            # Der Snapshot ist die gespeicherte Zeile — die Maske greift beim
            # AUSLIEFERN, nicht beim Speichern: `owner_statements` trägt die
            # ungekürzten Summen für die Buchhaltung, aber der Eigentümer
            # bekommt Gastpreis und Verwaltungs-Ertrag daraus nicht zu sehen
            # (§4.2). Das ist genau der Pfad, über den das Portal sein PDF holt.
            # Ein NULL in der Spalte heißt „diese Zahl gibt es nicht" (0346) und
            # muss NULL bleiben. `_d(None)` ergäbe 0 und machte daraus die
            # Aussage „0,00 eingenommen" bzw. „keine Provision" (Wurzel 4).
            summary = self._snapshot_summary(
                row, rental_rows, mask, tenant_id, owner_currency
            )
        else:
            summary = self._compute_summary(
                rental_rows,
                expenses,
                str(row["owner_id"]),
                row.get("currency") or self._tenant_currency(tenant_id),
                owner_currency,
                mask,
            )
        return _to_response(
            row, summary, rental_rows, listing_rows, expenses, commission_display
        )

    def list(self, ctx: AuthContext, owner_id: str | None = None) -> StatementListResponse:
        tenant_id = self._require_tenant(ctx)
        # Owner-Scope: Eigentümer sehen ausschließlich die EIGENEN Abrechnungen —
        # ein client-übergebener owner_id-Filter wird dafür überschrieben.
        if self._is_owner(ctx):
            owner_id = self._owner_self_id(ctx, tenant_id)
        query = (
            self._db.table("owner_statements")
            .select(
                "id, owner_id, period_from, period_to, status, kind, owner_payout, "
                "pm_payout, currency, invoice_number, owner_name, created_at"
            )
            .eq("tenant_id", tenant_id)
        )
        if owner_id:
            query = query.eq("owner_id", owner_id)
        # Derselbe Filter wie im Detail (`_fuer_owner_sichtbar`): Entwürfe,
        # stornierte Rechnungen und Storno-Belege sind Werkstatt der Agentur.
        # Gefiltert wird in der DB, nicht erst beim Bauen der Items — sonst
        # stünde `total` für eine andere Menge als `items`.
        if self._is_owner(ctx):
            query = query.eq("status", self._OWNER_SICHTBAR_STATUS).eq(
                "kind", self._OWNER_SICHTBAR_KIND
            )
        rows = query.order("created_at", desc=True).execute().data or []
        # Dieselbe Maske wie im Detail: der Verwaltungs-Ertrag ist auch in der
        # LISTE nicht die Zahl des Eigentümers. Ohne sie hätte die Liste
        # ausgeliefert, was das Detail gerade verbirgt.
        mask = load_guest_mask(self._db, ctx.user_id)
        items = [
            StatementListItem(
                id=str(r["id"]),
                owner_id=str(r["owner_id"]),
                owner_name=r.get("owner_name"),
                period_from=date.fromisoformat(r["period_from"]),
                period_to=date.fromisoformat(r["period_to"]),
                status=r.get("status") or "draft",
                # NULL bleibt NULL — wie im Detail (0349): eine 0,00 in der
                # Liste läse sich als „nichts auszuzahlen", wo in Wahrheit nur
                # der Provisionssatz fehlt.
                owner_payout=(
                    _money(_d(r["owner_payout"]))
                    if r.get("owner_payout") is not None
                    else None
                ),
                # NULL bleibt NULL (0346) — wie im Detail, sonst zeigte die
                # Liste eine 0,00, wo es die Zahl gar nicht gibt.
                pm_payout=(
                    mask.amount(_money(_d(r["pm_payout"])))
                    if r.get("pm_payout") is not None
                    else None
                ),
                currency=r.get("currency") or self._tenant_currency(tenant_id),
                invoice_number=r.get("invoice_number"),
                created_at=str(r["created_at"]) if r.get("created_at") else None,
            )
            for r in rows
        ]
        return StatementListResponse(items=items, total=len(items))

    def update(
        self, ctx: AuthContext, statement_id: str, req: StatementUpdate
    ) -> StatementResponse:
        tenant_id = self._require_tenant(ctx)
        self._forbid_owner_writes(ctx)
        row = self._statement_row(tenant_id, statement_id)
        if row.get("status") != "draft":
            raise StatementError(
                "Nur Entwürfe können geändert werden. Finalisierte/stornierte "
                "Belege sind unveränderbar.",
                status_code=409,
            )
        changes: dict = {}
        if req.header is not None:
            changes.update(req.header.model_dump(exclude_unset=True))
        if req.commission_pct is not None:
            changes["commission_pct"] = req.commission_pct
        if req.basis is not None:
            changes["basis"] = req.basis.value
        if req.reservation_statuses is not None:
            changes["reservation_statuses"] = req.reservation_statuses
        if req.period_from is not None:
            changes["period_from"] = req.period_from.isoformat()
        if req.period_to is not None:
            changes["period_to"] = req.period_to.isoformat()
        if changes:
            self._db.table("owner_statements").update(changes).eq(
                "tenant_id", tenant_id
            ).eq("id", statement_id).execute()
        self._refresh_summary(tenant_id, statement_id)
        return self.get(ctx, statement_id)

    def _next_invoice_number(self, tenant_id: str, doc_type: str, prefix: str) -> str:
        """Fortlaufende Rechnungsnummer atomar über die VORHANDENE Buchhaltungs-
        Funktion next_document_number (0025, Row-Lock) vergeben — gemeinsamer
        Nummernkreis-Mechanismus, kein Parallelsystem."""
        res = self._db.rpc(
            "next_document_number",
            {"p_tenant_id": tenant_id, "p_doc_type": doc_type, "p_prefix": prefix},
        ).execute()
        row = (res.data or [{}])[0]
        number = row.get("formatted_number")
        if not number:
            raise StatementError(
                "Rechnungsnummer konnte nicht vergeben werden.", status_code=500
            )
        return str(number)

    def _pruefe_bestaetigung(
        self,
        bestaetigung: StatementFinalizeRequest | None,
        summary: StatementSummary,
        waehrung: str,
    ) -> None:
        """Doppelbestätigung: die vom Nutzer gesehene Zahl muss dem Serverstand
        entsprechen.

        Finalisieren ist unumkehrbar UND stellt den Beleg dem Eigentümer zu.
        Deshalb genügt kein „wirklich?"-Haken: bestätigt wird der BETRAG. Hat
        sich die Abrechnung zwischen Anzeigen und Klicken geändert (nachgetragene
        Buchung, geänderter Verrechnungsposten, neuer Kurs), galt die
        Bestätigung einem anderen Betrag → 409, der Nutzer sieht den neuen Stand
        und bestätigt erneut.
        """
        if bestaetigung is None:
            raise StatementError(
                "Zum Festschreiben fehlt die Bestätigung der Auszahlung. "
                "Die Rechnung bekommt eine unveränderbare Nummer und wird dem "
                "Eigentümer sichtbar — bitte den Betrag bestätigen.",
                status_code=428,
            )
        if summary.owner_payout is None:
            raise StatementError(
                "Diese Abrechnung hat noch keine Eigentümer-Auszahlung "
                "(fehlender Provisionssatz). Sie kann nicht bestätigt werden.",
                status_code=422,
            )
        # Cent-genau vergleichen: beide Seiten auf zwei Stellen, damit ein
        # Float-Rundungsrest keine korrekte Bestätigung abweist.
        gesehen = _money(_d(bestaetigung.bestaetigte_auszahlung))
        steht = _money(_d(summary.owner_payout))
        if gesehen != steht:
            raise StatementError(
                f"Die Abrechnung hat sich geändert: bestätigt wurden "
                f"{gesehen} {bestaetigung.bestaetigte_waehrung}, aktuell sind es "
                f"{steht} {waehrung}. Bitte den neuen Stand prüfen und erneut "
                f"bestätigen.",
                status_code=409,
            )
        if bestaetigung.bestaetigte_waehrung.upper() != (waehrung or "").upper():
            raise StatementError(
                f"Die Währung hat sich geändert: bestätigt wurde "
                f"{bestaetigung.bestaetigte_waehrung}, aktuell ist es {waehrung}. "
                f"Bitte erneut prüfen und bestätigen.",
                status_code=409,
            )

    def finalize(
        self,
        ctx: AuthContext,
        statement_id: str,
        bestaetigung: StatementFinalizeRequest | None = None,
    ) -> StatementResponse:
        """Beleg festschreiben: fortlaufende Rechnungsnummer vergeben (§14 UStG /
        Art. 226 RL 2006/112), Steuer aus den drei Ländern berechnen, Summen +
        Steuerwerte einfrieren. Danach unveränderbar UND für den Eigentümer
        sichtbar — deshalb nur mit Doppelbestätigung des Betrags."""
        tenant_id = self._require_tenant(ctx)
        self._forbid_owner_writes(ctx)
        row = self._statement_row(tenant_id, statement_id)
        if row.get("status") == "finalized":
            return self.get(ctx, statement_id)
        if row.get("status") == "cancelled":
            raise StatementError(
                "Stornierter Beleg kann nicht finalisiert werden.", status_code=409
            )
        # Summen vor dem Einfrieren auf den letzten Stand bringen.
        summary = self._refresh_summary(tenant_id, statement_id)

        # Erst JETZT die Bestätigung prüfen — gegen den frisch berechneten
        # Stand, nicht gegen den beim Anzeigen gespeicherten. Genau dieser
        # Unterschied ist der Zweck der Prüfung.
        self._pruefe_bestaetigung(
            bestaetigung,
            summary,
            row.get("currency") or self._tenant_currency(tenant_id),
        )

        # Ohne darstellbaren PM-Payout gibt es keine Bemessungsgrundlage. Das
        # passiert bei gemischten Quellwährungen (siehe `_compute_summary`).
        # `_d(None)` wäre hier 0 — dann trüge eine fortlaufend nummerierte,
        # unveränderbare Rechnung 0,00 Steuer auf einen Umsatz, den es real
        # gibt. Lieber klar fehlschlagen (Wurzel 4/5) als still falsch
        # festschreiben.
        if summary.pm_payout is None:
            raise StatementError(
                "Die Abrechnung enthält Buchungen in mehreren Währungen — "
                "daraus lässt sich keine einzelne Bemessungsgrundlage für die "
                "Rechnung bilden. Bitte je Währung getrennt abrechnen.",
                status_code=422,
            )

        # Steuer auf den Provisions-/PM-Payout (steuerbarer Umsatz der Agentur).
        profile = self._tenant_tax_profile(tenant_id)
        owner = self._owner(tenant_id, str(row["owner_id"]))
        tax = compute_tax(
            taxable_base=_d(summary.pm_payout),
            tenant_tax_scheme=profile.get("tax_scheme") or "vat",
            tenant_default_rate=_d(profile.get("default_tax_rate")),
            seller_country=profile.get("country"),
            buyer_country=owner.get("country"),
            buyer_vat_id=owner.get("vat_id"),
        )

        today = date.today()
        number = self._next_invoice_number(tenant_id, "owner_statement", "RE-")
        self._db.table("owner_statements").update(
            {
                "status": "finalized",
                "invoice_number": number,
                "invoice_date": today.isoformat(),
                "supply_country": profile.get("country"),
                "buyer_vat_id": owner.get("vat_id"),
                "tax_category": tax.category,
                "tax_rate": float(tax.rate),
                "net_amount": float(tax.net),
                "tax_amount": float(tax.tax),
                "gross_amount": float(tax.gross),
                "tax_exemption_reason": tax.exemption_reason,
            }
        ).eq("tenant_id", tenant_id).eq("id", statement_id).execute()
        log.info(
            "owner_statement_finalized",
            tenant_id=tenant_id,
            statement_id=statement_id,
            invoice_number=number,
            tax_category=tax.category,
        )
        return self.get(ctx, statement_id)

    def cancel(self, ctx: AuthContext, statement_id: str) -> StatementResponse:
        """Storniert einen finalisierten Beleg GoBD-konform: erzeugt eine NEUE
        Stornorechnung (eigene Nummer, negierte Beträge, Verweis aufs Original)
        und markiert das Original als 'cancelled'. Das Original bleibt unverändert
        erhalten; die neue Stornorechnung wird zurückgegeben."""
        tenant_id = self._require_tenant(ctx)
        self._forbid_owner_writes(ctx)
        row = self._statement_row(tenant_id, statement_id)
        if row.get("status") != "finalized":
            raise StatementError(
                "Nur finalisierte Belege können storniert werden.", status_code=409
            )
        if row.get("cancelled_by_statement_id"):
            raise StatementError("Beleg ist bereits storniert.", status_code=409)

        today = date.today()
        number = self._next_invoice_number(
            tenant_id, "owner_statement_storno", "ST-"
        )
        orig_no = row.get("invoice_number")
        reason = (
            f"Stornorechnung – hebt Rechnung {orig_no} vom "
            f"{row.get('invoice_date')} vollständig auf."
        )
        # Storno-Beleg = Kopie des Originals mit negierten Beträgen.
        storno = {
            "tenant_id": tenant_id,
            "owner_id": row["owner_id"],
            "period_from": row["period_from"],
            "period_to": row["period_to"],
            "basis": row.get("basis") or "check_in",
            "reservation_statuses": list(row.get("reservation_statuses") or []),
            "status": "finalized",
            "kind": "cancellation",
            "cancels_statement_id": statement_id,
            "commission_pct": row.get("commission_pct") or 0,
            "currency": row.get("currency") or self._tenant_currency(tenant_id),
            "invoice_number": number,
            "invoice_date": today.isoformat(),
            "supply_country": row.get("supply_country"),
            "buyer_vat_id": row.get("buyer_vat_id"),
            "tax_category": row.get("tax_category") or "S",
            "tax_rate": row.get("tax_rate") or 0,
            # Beträge negiert (Gegenbuchung). Was im Original NULL ist, bleibt
            # im Storno NULL (0346): die Gegenbuchung einer unbekannten Zahl
            # ist keine 0, sondern wieder unbekannt (Wurzel 4).
            "total_price": _negiert(row.get("total_price")),
            "total_payout": _negiert_pflicht(row.get("total_payout")),
            "expenses_total": _negiert_pflicht(row.get("expenses_total")),
            # Die beiden Richtungen werden MITGESPIEGELT. Ohne sie stünde im
            # Storno-Beleg eine negierte Nettozahl neben zwei Nullen — die
            # Gegenbuchung behauptete dann, es habe nie Verrechnungsposten
            # gegeben (Wurzel 4). Das Vorzeichen dreht wie bei jedem anderen
            # Betrag der Gegenbuchung.
            "expenses_to_owner": _negiert_pflicht(row.get("expenses_to_owner")),
            "expenses_from_owner": _negiert_pflicht(row.get("expenses_from_owner")),
            "owner_payout": _negiert_pflicht(row.get("owner_payout")),
            "pm_payout": _negiert(row.get("pm_payout")),
            "net_amount": _negiert_pflicht(row.get("net_amount")),
            "tax_amount": _negiert_pflicht(row.get("tax_amount")),
            "gross_amount": _negiert_pflicht(row.get("gross_amount")),
            "tax_exemption_reason": row.get("tax_exemption_reason"),
            "notes": reason,
            # Kopf-Snapshot übernehmen.
            "pm_name": row.get("pm_name"),
            "pm_email": row.get("pm_email"),
            "pm_phone": row.get("pm_phone"),
            "pm_address": row.get("pm_address"),
            "pm_tax_id": row.get("pm_tax_id"),
            "pm_logo_url": row.get("pm_logo_url"),
            "owner_name": row.get("owner_name"),
            "owner_email": row.get("owner_email"),
            "owner_phone": row.get("owner_phone"),
            "owner_address": row.get("owner_address"),
            "owner_tax_id": row.get("owner_tax_id"),
        }
        res = self._db.table("owner_statements").insert(storno).execute()
        if not res.data:
            raise StatementError(
                "Stornorechnung konnte nicht angelegt werden.", status_code=500
            )
        storno_id = str(res.data[0]["id"])
        # Original als storniert markieren + Rückverweis setzen.
        self._db.table("owner_statements").update(
            {"status": "cancelled", "cancelled_by_statement_id": storno_id}
        ).eq("tenant_id", tenant_id).eq("id", statement_id).execute()
        log.info(
            "owner_statement_cancelled",
            tenant_id=tenant_id,
            statement_id=statement_id,
            storno_id=storno_id,
            invoice_number=number,
        )
        return self.get(ctx, storno_id)

    def delete(self, ctx: AuthContext, statement_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._forbid_owner_writes(ctx)
        row = self._statement_row(tenant_id, statement_id)
        if row.get("status") != "draft":
            # Finalisierte/stornierte Belege sind unveränderbar (GoBD) und dürfen
            # nicht gelöscht werden — nur Entwürfe.
            raise StatementError(
                "Nur Entwürfe können gelöscht werden. Finalisierte Rechnungen "
                "müssen storniert werden.",
                status_code=409,
            )
        res = (
            self._db.table("owner_statements")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("id", statement_id)
            .execute()
        )
        if not res.data:
            raise StatementError("Statement nicht gefunden.", status_code=404)
        log.info(
            "owner_statement_deleted", tenant_id=tenant_id, statement_id=statement_id
        )

    # --- Expenses CRUD ------------------------------------------------------

    def _require_own_fk(
        self, tenant_id: str, table: str, fk_id: object, label: str
    ) -> None:
        """Sicherstellen, dass ein optionaler Fremdschlüssel demselben Tenant
        gehört. Der Service läuft mit service_role (RLS umgangen), sonst ließe sich
        eine Expense mit tenant-fremder statement_id/owner_id/listing_id anlegen
        (Fremd-FK-Injektion / verwaiste Datensätze)."""
        if not fk_id:
            return
        owned = (
            self._db.table(table)
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", str(fk_id))
            .limit(1)
            .execute()
        ).data
        if not owned:
            raise StatementError(f"{label} nicht gefunden.", status_code=404)

    def _validate_expense_fks(self, tenant_id: str, data: dict) -> None:
        self._require_own_fk(
            tenant_id, "owner_statements", data.get("statement_id"), "Statement"
        )
        self._require_own_fk(tenant_id, "owners", data.get("owner_id"), "Eigentümer")
        self._require_own_fk(
            tenant_id, "properties", data.get("listing_id"), "Objekt"
        )
        self._require_own_fk(
            tenant_id, "reservations", data.get("reservation_id"), "Reservierung"
        )

    def _expense_owner_id(self, tenant_id: str, data: dict) -> str | None:
        """Der Eigentümer, zu dem dieser Verrechnungsposten gehört.

        Zwei Wege, weil das Formular beide schickt: ausdrücklich als
        `owner_id`, oder mittelbar über die Abrechnung (`statement_id`), die
        ihren Eigentümer trägt. Ohne beides gibt es keinen Eigentümer-Bezug —
        dann greift die Objekt-Prüfung unten nicht, und der Posten bleibt ein
        reiner Tenant-Posten (das ist ein gültiger Fall, siehe
        `_pruefe_objekt_gehoert_eigentuemer`).
        """
        owner_id = data.get("owner_id")
        if owner_id:
            return str(owner_id)
        statement_id = data.get("statement_id")
        if not statement_id:
            return None
        rows = (
            self._db.table("owner_statements")
            .select("owner_id")
            .eq("tenant_id", tenant_id)
            .eq("id", str(statement_id))
            .limit(1)
            .execute()
        ).data or []
        return str(rows[0]["owner_id"]) if rows else None

    def _pruefe_objekt_gehoert_eigentuemer(self, tenant_id: str, data: dict) -> None:
        """Objekt UND Reservierung müssen zum Eigentümer des Postens gehören.

        Wurzel 3/9: `_validate_expense_fks` prüft nur den MANDANTEN. Damit ließ
        sich ein Posten auf ein Objekt buchen, das diesem Eigentümer gar nicht
        gehört — live nachgestellt mit einem direkten Aufruf: Objekt eines
        fremden Eigentümers, Antwort 201. Fachlich ist das eine Verrechnung
        fremder Kosten mit dieser Auszahlung, und über
        `_expense_currency` zieht das fremde Objekt zusätzlich seine Währung in
        die Abrechnung.

        Das Objekt ist bewusst OPTIONAL (die Auswahl hat einen „—"-Eintrag):
        Posten wie eine Jahrespauschale oder eine Gutschrift betreffen den
        Eigentümer als Ganzes, nicht ein einzelnes Objekt. Geprüft wird
        deshalb nur, WENN ein Objekt angegeben ist.

        Ohne Eigentümer-Bezug (weder `owner_id` noch `statement_id`) gibt es
        nichts zu prüfen — der Tenant-Scope aus `_validate_expense_fks` bleibt
        die Grenze.

        404 statt 403: der Aufrufer darf nicht erfahren, ob die fremde ID
        existiert (dieselbe Antwort wie für „gibt es nicht").
        """
        listing_id = data.get("listing_id")
        reservation_id = data.get("reservation_id")
        if not listing_id and not reservation_id:
            return
        owner_id = self._expense_owner_id(tenant_id, data)
        if not owner_id:
            return
        erlaubt = set(self._owner_property_ids(owner_id))
        if listing_id and str(listing_id) not in erlaubt:
            raise StatementError("Objekt nicht gefunden.", status_code=404)
        if reservation_id:
            # Die Reservierung hängt über ihr Objekt am Eigentümer. Ohne diese
            # Prüfung ließe sich ein Posten an die Buchung eines fremden
            # Objekts hängen, obwohl das Objekt-Feld jetzt gesperrt ist.
            rows = (
                self._db.table("reservations")
                .select("property_id")
                .eq("tenant_id", tenant_id)
                .eq("id", str(reservation_id))
                .limit(1)
                .execute()
            ).data or []
            gehoert = rows and str(rows[0].get("property_id") or "") in erlaubt
            if not gehoert:
                raise StatementError(
                    "Reservierung nicht gefunden.", status_code=404
                )

    def _expense_currency(self, tenant_id: str, data: dict) -> str:
        """Währung des Verrechnungspostens — aus den Daten, nie geraten.

        Reihenfolge: ausdrücklich mitgegebene Währung → Währung des bezogenen
        Objekts → Währung des Betriebs. Das OBJEKT geht vor: ein dänisches
        Objekt unter einem EUR-Betrieb verrechnet in DKK, und ein
        untergeschobenes EUR verschöbe den Betrag um den Wechselkurs, ohne dass
        es jemand als Fehler sähe.

        Gibt auch der Betrieb nichts her, wirft `_tenant_currency` selbst 422
        („Mandanten-Währung fehlt") — genau der klare Fehler statt eines
        erfundenen „EUR" (Wurzel 4). Darum steht hier bewusst kein eigener
        Fallback-Zweig hinter dem Aufruf.
        """
        angegeben = str(data.get("currency") or "").strip().upper()
        if angegeben:
            return angegeben
        listing_id = data.get("listing_id")
        if listing_id:
            rows = (
                self._db.table("properties")
                .select("currency")
                .eq("tenant_id", tenant_id)
                .eq("id", str(listing_id))
                .limit(1)
                .execute()
            ).data or []
            objekt_waehrung = str((rows[0].get("currency") if rows else "") or "").strip()
            if objekt_waehrung:
                return objekt_waehrung.upper()
        return self._tenant_currency(tenant_id).strip().upper()

    @staticmethod
    def _pruefe_sichtbarkeit(data: dict) -> None:
        """Ein Posten ZULASTEN des Eigentümers darf nicht ausgeblendet werden.

        Sonst sähe er eine geminderte Auszahlung, ohne die Zeile zu sehen, die
        sie mindert — seine Abrechnung wäre nicht prüfbar. Die DB hält das per
        Check-Constraint (0344); hier steht die verständliche Meldung, damit
        der Nutzer keinen rohen 23514 bekommt.
        """
        if (
            data.get("direction") == ExpenseDirection.from_owner.value
            and data.get("hidden_from_owner")
        ):
            raise StatementError(
                "Ein Posten zulasten des Eigentümers muss für ihn sichtbar "
                "bleiben — sonst ist die Abrechnung nicht nachvollziehbar.",
                status_code=422,
            )

    def _erfasser(self, ctx: AuthContext) -> dict:
        """Wer legt den Posten an — für die Nachvollziehbarkeit an der Zeile.

        Der Name wird als SNAPSHOT mitgeschrieben: wird der Mitarbeiter später
        gelöscht, setzt der FK `created_by` auf null, aber die Abrechnung
        bleibt lesbar („erfasst von …"). Findet sich kein Name, bleibt das Feld
        leer — kein erfundenes „System" (Wurzel 4).
        """
        rows = (
            self._db.table("users")
            .select("id, full_name, email")
            .eq("id", ctx.user_id)
            .limit(1)
            .execute()
        ).data or []
        user = rows[0] if rows else {}
        name = str(user.get("full_name") or user.get("email") or "").strip()
        return {
            "created_by": ctx.user_id if user else None,
            "created_by_name": name or None,
        }

    def add_expense(self, ctx: AuthContext, req: ExpenseCreate) -> ExpenseResponse:
        tenant_id = self._require_tenant(ctx)
        self._forbid_owner_writes(ctx)
        payload = req.model_dump(mode="json")
        # Alle Fremdschlüssel müssen DIESEM Tenant gehören (kein Fremd-FK).
        self._validate_expense_fks(tenant_id, payload)
        # ... und Objekt/Reservierung zusätzlich zum EIGENTÜMER des Postens
        # (Wurzel 3/9 — der Tenant-Scope allein erlaubte fremde Objekte).
        self._pruefe_objekt_gehoert_eigentuemer(tenant_id, payload)
        self._pruefe_sichtbarkeit(payload)
        payload["tenant_id"] = tenant_id
        payload["currency"] = self._expense_currency(tenant_id, payload)
        payload.update(self._erfasser(ctx))
        res = self._db.table("owner_expenses").insert(payload).execute()
        if not res.data:
            raise StatementError("Position konnte nicht angelegt werden.", status_code=500)
        if req.statement_id:
            self._refresh_summary(tenant_id, req.statement_id)
        log.info(
            "owner_expense_added",
            tenant_id=tenant_id,
            expense_id=str(res.data[0]["id"]),
            direction=payload["direction"],
        )
        return _expense(res.data[0])

    def update_expense(
        self, ctx: AuthContext, expense_id: str, req: ExpenseUpdate
    ) -> ExpenseResponse:
        tenant_id = self._require_tenant(ctx)
        self._forbid_owner_writes(ctx)
        existing = (
            self._db.table("owner_expenses")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", expense_id)
            .limit(1)
            .execute()
        ).data or []
        if not existing:
            raise StatementError("Position nicht gefunden.", status_code=404)
        changes = req.model_dump(mode="json", exclude_unset=True)
        # Neu gesetzte Fremdschlüssel müssen ebenfalls DIESEM Tenant gehören.
        self._validate_expense_fks(tenant_id, changes)
        # Eigentümer-Scope am ERGEBNIS prüfen, nicht am Fragment: wer nur die
        # `listing_id` ändert, schickt keine `owner_id` mit — gegen das
        # Fragment allein fiele die Prüfung mangels Eigentümer-Bezug aus und
        # das fremde Objekt käme genau hier durch (Wurzel 9).
        self._pruefe_objekt_gehoert_eigentuemer(
            tenant_id, {**existing[0], **changes}
        )
        # Sichtbarkeit am ERGEBNIS prüfen, nicht am Änderungs-Fragment: wer nur
        # `direction` auf `from_owner` dreht, während `hidden_from_owner` schon
        # true in der Zeile steht, käme sonst an der Regel vorbei.
        self._pruefe_sichtbarkeit({**existing[0], **changes})
        if "currency" in changes:
            changes["currency"] = self._expense_currency(tenant_id, changes)
        if changes:
            self._db.table("owner_expenses").update(changes).eq(
                "tenant_id", tenant_id
            ).eq("id", expense_id).execute()
        statement_id = existing[0].get("statement_id")
        if statement_id:
            self._refresh_summary(tenant_id, str(statement_id))
        updated = (
            self._db.table("owner_expenses")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", expense_id)
            .limit(1)
            .execute()
        ).data
        return _expense(updated[0] if updated else existing[0])

    def delete_expense(self, ctx: AuthContext, expense_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._forbid_owner_writes(ctx)
        existing = (
            self._db.table("owner_expenses")
            .select("statement_id, storage_path")
            .eq("tenant_id", tenant_id)
            .eq("id", expense_id)
            .limit(1)
            .execute()
        ).data or []
        if not existing:
            raise StatementError("Position nicht gefunden.", status_code=404)
        self._db.table("owner_expenses").delete().eq("tenant_id", tenant_id).eq(
            "id", expense_id
        ).execute()
        # Beleg erst NACH dem Löschen der Zeile entfernen: schlüge das Löschen
        # fehl, zeigte storage_path sonst auf eine schon entfernte Datei.
        self._beleg_entfernen(existing[0].get("storage_path"))
        statement_id = existing[0].get("statement_id")
        if statement_id:
            self._refresh_summary(tenant_id, str(statement_id))

    # --- Beleg zum Verrechnungsposten (privater Bucket) ----------------------

    def _own_expense(self, tenant_id: str, expense_id: str) -> dict:
        """Einen Posten per ID laden UND scopen in einem Schritt (Wurzel 3)."""
        rows = (
            self._db.table("owner_expenses")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", expense_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise StatementError("Position nicht gefunden.", status_code=404)
        return rows[0]

    def _beleg_entfernen(self, storage_path: object) -> None:
        """Beleg-Datei best-effort aus dem Bucket räumen.

        Bewusst best-effort (`# noqa: BLE001`): eine verwaiste Datei im privaten
        Bucket ist ein Aufräum-Rückstand, kein Grund, dem Nutzer das Löschen
        oder Ersetzen des Postens zu verweigern.
        """
        if not storage_path:
            return
        try:
            self._db.storage.from_(_BELEG_BUCKET).remove([str(storage_path)])
        except Exception as exc:  # noqa: BLE001 — Aufräumen darf den Hauptpfad nie kippen
            log.warning("owner_expense_receipt_cleanup_failed", error=str(exc))

    def upload_receipt(
        self,
        ctx: AuthContext,
        expense_id: str,
        content: bytes,
        file_name: str | None,
    ) -> ExpenseResponse:
        """Beleg/Nachweis an einen Verrechnungsposten hängen.

        Der Dateityp kommt aus den ECHTEN Anfangsbytes, nicht aus dem
        Client-`content_type` (Wurzel 8) — sonst lüde ein als `image/png`
        deklariertes HTML in einen Bucket, dessen Inhalte wir später signiert
        ausliefern.
        """
        tenant_id = self._require_tenant(ctx)
        self._forbid_owner_writes(ctx)
        posten = self._own_expense(tenant_id, expense_id)
        ext = _sniff_beleg_ext(content)
        if not ext:
            raise StatementError(
                "Nur PDF, JPEG, PNG oder WebP erlaubt.", status_code=415
            )
        if len(content) > _BELEG_MAX_BYTES:
            raise StatementError("Beleg ist zu groß (max. 10 MB).", status_code=413)
        path = f"{tenant_id}/{expense_id}/{secrets.token_hex(8)}.{ext}"
        try:
            self._db.storage.from_(_BELEG_BUCKET).upload(
                path, content, {"content-type": _BELEG_EXT_MIME[ext]}
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich als 502
            log.warning(
                "owner_expense_receipt_upload_failed", expense_id=expense_id, error=str(exc)
            )
            raise StatementError("Upload fehlgeschlagen.", status_code=502) from exc
        # ERST die Zeile auf die neue Datei zeigen lassen, DANN die alte
        # aufräumen (sonst zeigte storage_path bei einem Update-Fehler auf eine
        # bereits gelöschte Datei — der Beleg wäre weg).
        res = (
            self._db.table("owner_expenses")
            .update({"storage_path": path, "file_name": file_name})
            .eq("tenant_id", tenant_id)
            .eq("id", expense_id)
            .execute()
        )
        if not res.data:
            raise StatementError("Speichern fehlgeschlagen.", status_code=500)
        self._beleg_entfernen(posten.get("storage_path"))
        log.info("owner_expense_receipt_uploaded", expense_id=expense_id)
        return _expense(res.data[0])

    def receipt_url(
        self, ctx: AuthContext, expense_id: str
    ) -> ExpenseReceiptUrlResponse:
        """Signierte, zeitlich begrenzte Download-URL für den Beleg.

        Der Eigentümer darf seinen eigenen Beleg sehen (er soll den Abzug ja
        prüfen können) — aber nur an einem Posten, der IHM zugeordnet und für
        ihn nicht ausgeblendet ist. Derselbe Scope wie in `_visible_expenses`,
        an der Einzelressource erneut geprüft (Wurzel 9).
        """
        tenant_id = self._require_tenant(ctx)
        posten = self._own_expense(tenant_id, expense_id)
        if self._is_owner(ctx):
            eigener = self._owner_self_id(ctx, tenant_id)
            if not eigener or str(posten.get("owner_id")) != eigener:
                raise StatementError("Position nicht gefunden.", status_code=404)
            if posten.get("hidden_from_owner"):
                raise StatementError("Position nicht gefunden.", status_code=404)
        path = posten.get("storage_path")
        if not path:
            raise StatementError("Kein Beleg hinterlegt.", status_code=404)
        try:
            signed = self._db.storage.from_(_BELEG_BUCKET).create_signed_url(
                str(path), _BELEG_URL_TTL
            )
        except Exception as exc:  # noqa: BLE001 — Storage-Fehler einheitlich als 502
            log.warning(
                "owner_expense_receipt_sign_failed", expense_id=expense_id, error=str(exc)
            )
            raise StatementError("Download nicht möglich.", status_code=502) from exc
        url = None
        if isinstance(signed, dict):
            # supabase-py benennt den Key je nach Version unterschiedlich.
            url = signed.get("signedURL") or signed.get("signedUrl")
        if not url:
            raise StatementError("Download nicht möglich.", status_code=502)
        return ExpenseReceiptUrlResponse(url=str(url), expires_in=_BELEG_URL_TTL)

    # --- Auto-Statements -----------------------------------------------------

    @staticmethod
    def _rhythmus_fuer_zeitraum(period_from: date, period_to: date) -> str:
        """Welcher Rhythmus zu diesem Zeitraum gehört: 'monthly' | 'yearly'.

        Der Cron ruft denselben Endpunkt für beide; ohne diese Unterscheidung
        bekäme ein Jahres-Eigentümer zwölf Jahresberichte (einmal je
        Monatslauf) und ein Monats-Eigentümer beim Jahreslauf einen zweiten,
        überlappenden Beleg. Die Länge des Zeitraums entscheidet: alles, was
        über einen Monat hinausgeht, ist der Jahreslauf.

        Bewusst aus dem ZEITRAUM abgeleitet und nicht als Parameter: der
        Aufrufer ist ein Cron ohne Fachwissen, und ein zusätzlicher Schalter
        wäre eine zweite Wahrheit, die dem Zeitraum widersprechen könnte.
        """
        return "yearly" if (period_to - period_from).days > 31 else "monthly"

    def run_auto_statements(self, period_from: date, period_to: date) -> AutoStatementRunResponse:
        """Für jeden Owner mit passendem Rhythmus ein Statement je Zeitraum
        erzeugen — sofern für diesen Zeitraum noch keines existiert.

        'monthly' läuft für Monats-Zeiträume, 'yearly' für längere (0331);
        welcher gemeint ist, sagt die Länge des Zeitraums. Expenses werden nach
        Datum+Listing/Owner automatisch dem Statement zugeordnet. Änderungen
        wirken nur auf KÜNFTIGE Statements (bestehende werden nie angefasst).
        """
        rhythmus = self._rhythmus_fuer_zeitraum(period_from, period_to)
        owners = (
            self._db.table("owners")
            .select("id, tenant_id, default_commission_pct, name, email, phone, "
                    "street, house_number, postal_code, city, country, tax_id")
            .eq("statement_frequency", rhythmus)
            .execute()
        ).data or []
        generated = 0
        for owner in owners:
            tenant_id = str(owner["tenant_id"])
            owner_id = str(owner["id"])
            existing = (
                self._db.table("owner_statements")
                .select("id")
                .eq("owner_id", owner_id)
                .eq("period_from", period_from.isoformat())
                .eq("period_to", period_to.isoformat())
                .limit(1)
                .execute()
            ).data or []
            if existing:
                continue  # 1/Monat — bestehendes nie überschreiben.
            currency = self._tenant_currency(tenant_id)
            header = self._header_from_stammdaten(tenant_id, owner)
            ins = (
                self._db.table("owner_statements")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "owner_id": owner_id,
                        "period_from": period_from.isoformat(),
                        "period_to": period_to.isoformat(),
                        "basis": "check_in",
                        "reservation_statuses": ["confirmed", "completed"],
                        "status": "draft",
                        # NULL bleibt NULL: ohne vereinbarten Satz trägt der
                        # Entwurf keinen — die Summen weisen die Auszahlung
                        # dann als „—" aus, statt 100 % an den Eigentümer zu
                        # buchen (Wurzel 4).
                        "commission_pct": (
                            float(_d(owner["default_commission_pct"]))
                            if owner.get("default_commission_pct") is not None
                            else None
                        ),
                        "currency": currency,
                        **header.model_dump(),
                    }
                )
                .execute()
            ).data
            if not ins:
                continue
            statement_id = str(ins[0]["id"])
            self._auto_assign_expenses(tenant_id, owner_id, statement_id, period_from, period_to)
            self._refresh_summary(tenant_id, statement_id)
            generated += 1
        log.info("owner_statements_auto_run", generated=generated, owners=len(owners))
        return AutoStatementRunResponse(generated=generated, owners=len(owners))

    def _auto_assign_expenses(
        self,
        tenant_id: str,
        owner_id: str,
        statement_id: str,
        period_from: date,
        period_to: date,
    ) -> None:
        """Noch nicht zugeordnete Expenses im Zeitraum, die per Owner ODER per
        Listing des Owners passen, diesem Statement zuordnen (Datum+Owner/Listing)."""
        property_ids = set(self._owner_property_ids(owner_id))
        rows = (
            self._db.table("owner_expenses")
            .select("id, owner_id, listing_id")
            .eq("tenant_id", tenant_id)
            .is_("statement_id", "null")
            .gte("date", period_from.isoformat())
            .lte("date", period_to.isoformat())
            .execute()
        ).data or []
        for e in rows:
            matches = str(e.get("owner_id")) == owner_id or (
                e.get("listing_id") and str(e["listing_id"]) in property_ids
            )
            if matches:
                self._db.table("owner_expenses").update(
                    {"statement_id": statement_id}
                ).eq("id", e["id"]).execute()


def _expense(r: dict) -> ExpenseResponse:
    return ExpenseResponse(
        id=str(r["id"]),
        tenant_id=str(r["tenant_id"]),
        statement_id=str(r["statement_id"]) if r.get("statement_id") else None,
        concept=r["concept"],
        date=date.fromisoformat(r["date"]) if isinstance(r["date"], str) else r["date"],
        direction=ExpenseDirection(
            str(r.get("direction") or ExpenseDirection.from_owner.value)
        ),
        category=r.get("category"),
        listing_id=str(r["listing_id"]) if r.get("listing_id") else None,
        reservation_id=str(r["reservation_id"]) if r.get("reservation_id") else None,
        owner_id=str(r["owner_id"]) if r.get("owner_id") else None,
        amount=_money(_d(r.get("amount")).copy_abs()),
        signed_amount=_money(_signed_amount(r)),
        # Die Währung kommt aus der Zeile. Fehlt sie (Altbestand ohne Objekt-
        # und Tenant-Währung), bleibt sie leer — die UI rendert dann symbollos,
        # statt ein „EUR" zu erfinden (Wurzel 4).
        currency=(str(r["currency"]).strip().upper() or None) if r.get("currency") else None,
        attachment_url=r.get("attachment_url"),
        hidden_from_owner=bool(r.get("hidden_from_owner")),
        created_by=str(r["created_by"]) if r.get("created_by") else None,
        created_by_name=r.get("created_by_name"),
        file_name=r.get("file_name"),
        has_receipt=bool(r.get("storage_path")),
        created_at=str(r["created_at"]) if r.get("created_at") else None,
        updated_at=str(r["updated_at"]) if r.get("updated_at") else None,
    )


def _to_response(
    row: dict,
    summary: StatementSummary,
    rental_rows: list[RentalRow],
    listing_rows: list[ListingRow],
    expenses: list[dict],
    commission_display: Decimal | None = None,
) -> StatementResponse:
    header = StatementHeader(
        pm_name=row.get("pm_name"),
        pm_email=row.get("pm_email"),
        pm_phone=row.get("pm_phone"),
        pm_address=row.get("pm_address"),
        pm_tax_id=row.get("pm_tax_id"),
        pm_logo_url=row.get("pm_logo_url"),
        owner_name=row.get("owner_name"),
        owner_email=row.get("owner_email"),
        owner_phone=row.get("owner_phone"),
        owner_address=row.get("owner_address"),
        owner_tax_id=row.get("owner_tax_id"),
        invoice_number=row.get("invoice_number"),
        notes=row.get("notes"),
    )
    tax = TaxBreakdown(
        category=row.get("tax_category") or "S",
        rate=_money(_d(row.get("tax_rate"))),
        net=_money(_d(row.get("net_amount"))),
        tax=_money(_d(row.get("tax_amount"))),
        gross=_money(_d(row.get("gross_amount"))),
        exemption_reason=row.get("tax_exemption_reason"),
    )
    return StatementResponse(
        id=str(row["id"]),
        tenant_id=str(row["tenant_id"]),
        owner_id=str(row["owner_id"]),
        period_from=date.fromisoformat(row["period_from"]),
        period_to=date.fromisoformat(row["period_to"]),
        basis=row.get("basis") or "check_in",
        reservation_statuses=list(row.get("reservation_statuses") or []),
        status=row.get("status") or "draft",
        kind=row.get("kind") or "invoice",
        # Kein Satz vereinbart → kein angezeigter Satz. `_d(None)` wäre 0 und
        # behauptete „0 % Provision" (Wurzel 4); die UI zeigt stattdessen „—".
        commission_pct=_kommission_anzeige(commission_display, row),
        header=header,
        summary=summary,
        invoice_date=(
            date.fromisoformat(row["invoice_date"]) if row.get("invoice_date") else None
        ),
        due_date=date.fromisoformat(row["due_date"]) if row.get("due_date") else None,
        supply_country=row.get("supply_country"),
        buyer_vat_id=row.get("buyer_vat_id"),
        tax=tax,
        cancels_statement_id=(
            str(row["cancels_statement_id"])
            if row.get("cancels_statement_id")
            else None
        ),
        cancelled_by_statement_id=(
            str(row["cancelled_by_statement_id"])
            if row.get("cancelled_by_statement_id")
            else None
        ),
        rental_rows=rental_rows,
        listing_rows=listing_rows,
        expenses=[_expense(e) for e in expenses],
        created_at=str(row["created_at"]) if row.get("created_at") else None,
        updated_at=str(row["updated_at"]) if row.get("updated_at") else None,
    )
