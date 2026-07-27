"""Welche Steuerregeln fuer ein Land gelten — aus der DB, nicht aus Konstanten.

Warum die Regeln in `tax_country_rules` stehen und nicht hier im Code:

Die US-Meldeschwelle hat sich in vier Jahren ZWEIMAL gesetzlich geaendert
(ARPA 2021 senkte sie auf 600 USD, der One Big Beautiful Bill Act vom
04.07.2025 stellte 20.000 USD + 200 Transaktionen rueckwirkend wieder her).
Eine Code-Konstante haette in dieser Zeit zweimal ein Deployment gebraucht —
und waere zwischendurch still falsch gewesen.

Die sechs Regime (belegt aus OECD DPI-MCAA Signatarliste Stand 01.04.2026,
IRC § 6050W, LISR Art. 113-A, ITA Sec. 194-O, CGST § 9(5), Minpaku-Gesetz,
Art. 73 MWSTG):

    oecd_dpi                   35 Staaten, EIN Datensatz, ein Meldeweg
    us_irs                     Formular-Zertifikat + Einbehalt statt Sperre
    national                   MX/IN: Einbehalt; AU: nur Meldung
    registration               JP: Registernummer pruefen und anzeigen
    id_collection_prohibited   CH: Erhebung der Personen-ID ist unzulaessig
    none                       keine Plattform-Meldepflicht

Der letzte Punkt ist wichtig: „Erhebung verboten" ist NICHT „optional". Ein
global gleiches TIN-Pflichtfeld baute in Japan und der Schweiz einen
Datenschutzverstoss ins Schema. Darum ein eigenes Regime, das die UI zwingt,
das Feld gar nicht erst zu zeigen.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.taxpayer.regime")


class Regime(StrEnum):
    OECD_DPI = "oecd_dpi"
    US_IRS = "us_irs"
    NATIONAL = "national"
    REGISTRATION = "registration"
    ID_COLLECTION_PROHIBITED = "id_collection_prohibited"
    NONE = "none"


class TaxIdKind(StrEnum):
    TIN = "tin"
    SSN = "ssn"
    ITIN = "itin"
    EIN = "ein"
    RFC = "rfc"
    CURP = "curp"
    PAN = "pan"
    GSTIN = "gstin"
    RUT = "rut"
    ABN = "abn"
    VAT = "vat"


class RegimeError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class Landesregel:
    """Die Regel eines Landes. Direkt aus tax_country_rules."""

    country: str
    regime: Regime
    reporting_authority: str | None
    required_ids: tuple[TaxIdKind, ...]
    # NUR im OECD-Raum: der Geburtsort darf die fehlende Steuer-ID ersetzen.
    # In den USA gilt das nicht — dort ist die TIN ohne Ersatz zwingend.
    birthplace_substitutes_id: bool
    host_tax_bps_with_id: int | None
    host_tax_bps_without_id: int | None
    threshold_amount_minor: int | None
    threshold_currency: str | None
    threshold_transactions: int | None
    valid_from: date
    legal_basis: str | None
    notes: str | None

    @property
    def erhebt_steuerangaben(self) -> bool:
        """Ob fuer dieses Land ueberhaupt Steuerangaben zu erheben sind."""
        return self.regime not in (
            Regime.NONE,
            Regime.ID_COLLECTION_PROHIBITED,
        )

    @property
    def id_erhebung_verboten(self) -> bool:
        return self.regime is Regime.ID_COLLECTION_PROHIBITED

    def host_steuer_bps(self, *, hat_id: bool) -> int | None:
        """Steuersatz, den der Gastgeber im Land schuldet — INFORMATION.

        Die Plattform behaelt nichts ein; der Satz dient dazu, dem Gastgeber
        die richtige Berechnung anzubieten (property_taxes). Der Name sagt das
        ausdruecklich: `einbehalt_bps` las sich wie ein Abzugsauftrag.

        Basispunkte, weil Indien 0,1 % ansetzt — als Prozent-Integer waere das
        nicht darstellbar und wuerde auf 0 gerundet.
        """
        return (
            self.host_tax_bps_with_id
            if hat_id
            else self.host_tax_bps_without_id
        )

    def schwelle_erreicht(
        self, *, betrag_minor: int, transaktionen: int
    ) -> bool:
        """Ob die Meldeschwelle gerissen ist.

        Ohne Schwelle ist JEDE Buchung meldepflichtig — so ist es im gesamten
        OECD-Raum bei Unterkunft. Die oft zitierte Grenze „30 Faelle und
        2.000 EUR" gilt ausschliesslich fuer WARENverkauf.

        Die US-Schwelle ist UND-verknuepft (IRC § 6050W i.d.F. P.L. 119-21):
        50.000 USD aus 150 Buchungen ist NICHT meldepflichtig.
        """
        if self.threshold_amount_minor is None:
            return True
        if betrag_minor <= self.threshold_amount_minor:
            return False
        if self.threshold_transactions is None:
            return True
        return transaktionen > self.threshold_transactions


class RegimeService:
    """Nachschlagedienst fuer Landesregeln."""

    def __init__(self, db: Client) -> None:
        self._db = db

    def regel(self, country: str) -> Landesregel:
        """Die Regel eines Landes.

        Fehlt sie, wird NICHT geraten (Wurzel 4): ein unbekanntes Land ohne
        geprueftes Regime waere ein Datenfehler, der still zur falschen
        Meldung fuehrt.
        """
        land = (country or "").upper()
        if len(land) != 2:
            raise RegimeError(f"Ungültiges Länderkürzel: {country!r}.")
        rows = (
            self._db.table("tax_country_rules")
            .select("*")
            .eq("country", land)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise RegimeError(
                f"Für {land} ist keine Steuerregel hinterlegt. Dieses Land "
                "muss geprüft und in tax_country_rules aufgenommen werden.",
                status_code=422,
            )
        return self._zu_regel(rows[0])

    def regeln(self, laender: set[str]) -> dict[str, Landesregel]:
        """Mehrere Regeln in EINER Abfrage."""
        codes = sorted({(c or "").upper() for c in laender if c})
        if not codes:
            return {}
        rows = (
            self._db.table("tax_country_rules")
            .select("*")
            .in_("country", codes)
            .execute()
        ).data or []
        return {r["country"]: self._zu_regel(r) for r in rows}

    def unterstuetzte_laender(self) -> list[Landesregel]:
        """Alle Länder mit hinterlegter Regel, für die Auswahl im Wizard."""
        rows = (
            self._db.table("tax_country_rules")
            .select("*")
            .order("country")
            .execute()
        ).data or []
        return [self._zu_regel(r) for r in rows]

    def staatsschwelle(
        self, country: str, state: str
    ) -> tuple[int, str, int | None] | None:
        """Subnationale Schwelle (Betrag, Währung, Transaktionen) oder None.

        Zweite, vom Bund UNABHAENGIGE Achse: 700 USD in Massachusetts loest
        eine Staatspflicht aus, aber keine Bundesmeldung. Ein einzelnes
        `schwelle_erreicht`-Flag waere darum falsch.
        """
        rows = (
            self._db.table("tax_state_rules")
            .select("threshold_amount_minor, threshold_currency, "
                    "threshold_transactions")
            .eq("country", (country or "").upper())
            .eq("state", (state or "").upper())
            .limit(1)
            .execute()
        ).data
        if not rows:
            return None
        r = rows[0]
        return (
            r["threshold_amount_minor"],
            r["threshold_currency"],
            r.get("threshold_transactions"),
        )

    @staticmethod
    def _zu_regel(row: dict) -> Landesregel:
        return Landesregel(
            country=row["country"],
            regime=Regime(row["regime"]),
            reporting_authority=row.get("reporting_authority"),
            required_ids=tuple(
                TaxIdKind(k) for k in (row.get("required_ids") or [])
            ),
            birthplace_substitutes_id=bool(row["birthplace_substitutes_id"]),
            host_tax_bps_with_id=row.get("host_tax_bps_with_id"),
            host_tax_bps_without_id=row.get("host_tax_bps_without_id"),
            threshold_amount_minor=row.get("threshold_amount_minor"),
            threshold_currency=row.get("threshold_currency"),
            threshold_transactions=row.get("threshold_transactions"),
            valid_from=date.fromisoformat(row["valid_from"]),
            legal_basis=row.get("legal_basis"),
            notes=row.get("notes"),
        )


def einbehalt_betrag(betrag: Decimal, bps: int | None) -> Decimal:
    """Quellensteuer aus Basispunkten. None = kein Einbehalt."""
    if not bps:
        return Decimal(0)
    return (betrag * Decimal(bps) / Decimal(10000)).quantize(Decimal("0.01"))
