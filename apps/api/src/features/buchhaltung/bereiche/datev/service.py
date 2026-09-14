"""Fachlogik des Bereichs »datev«: Einstellungen, Vorschau, EXTF-Export, Historie.

Regeln (alle serverseitig, nichts davon kommt vom Client):
  * Einstellungen ohne Ersatzwerte — fehlt ein Pflichtfeld, antwortet der
    Export mit 422 UND der Feldliste (`_settings_pflicht`, Wurzel 4).
  * Zeitraum ≤ 366 Tage, sonst 422 (Wurzel 8).
  * Konten: Debitor = `debitor_konto_start + Kundennummer`, Kreditor analog;
    Erlös-/Aufwands-/Finanzkonto aus den Einstellungen; das Aufwandskonto einer
    Ausgabe aus `expenses.booking_account`, wenn gesetzt. Sachkonten der
    Einstellungen werden gegen `booking_accounts` (0671) geprüft, sobald der
    Betrieb dort Konten hat — eine Nummer, die es im Kontenplan nicht gibt,
    ist ein Problem, kein stiller Durchlauf.
  * BU-Schlüssel je Steuersatz aus der Map der Einstellungen; ein Satz ohne
    Eintrag ist ein Problem (422), KEIN geratener Schlüssel.
  * Fremdwährung ohne Kurs kann DATEV nicht buchen → Problem (422).
  * Idempotenz (Wurzel 2): gleicher Zeitraum + Typ + Inhalts-Hash liefert den
    bestehenden Lauf; der Unique-Index 0686 fängt das Rennen (23505 → erneut
    lesen und zurückgeben).
  * Jede per-ID-Ladung über `load_scoped` (Wurzel 3), jede Liste auf tenant_id.

Belegarten des Stapels und ihre Buchungsform (Konto = Personenkonto):
  ausgangsrechnungen  Debitor  S  Erlöskonto (+BU)     je Steuersatz-Gruppe
  gutschriften        Debitor  H  Erlöskonto (+BU)     credit_note/storno
  zahlungen           Debitor  H  Finanzkonto          Rückzahlung → S
  ausgaben            Kreditor H  Aufwandskonto (+BU)
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import extf
from .schemas import (
    BELEGARTEN,
    MAX_ZEITRAUM_TAGE,
    DatevSettingsResponse,
    DatevSettingsUpdate,
    ExportAnfrage,
    ExportResponse,
    Vorschau,
)

log = get_logger("nextdays.buchhaltung.datev")

BUCKET = "datev-exports"
MIME_CSV = "text/csv"

# Rechnungsstatus, die einen AUSGESTELLTEN Beleg bedeuten. `draft` ist keine
# Buchung, `cancelled` wird über den Storno-Beleg abgebildet.
AUSGESTELLT: frozenset[str] = frozenset({"sent", "finalized", "paid", "overdue"})
TYP_RECHNUNG = "invoice"
TYPEN_GUTSCHRIFT: frozenset[str] = frozenset({"credit_note", "storno"})

# Pflichtfelder der Einstellungen (Spaltennamen 0685) — was der Export braucht.
PFLICHTFELDER: tuple[str, ...] = (
    "berater_nummer",
    "mandanten_nummer",
    "kontenrahmen",
    "sachkontenlaenge",
    "wirtschaftsjahr_beginn_monat",
    "standard_erloeskonto",
    "standard_aufwandskonto",
    "standard_finanzkonto",
    "debitor_konto_start",
    "kreditor_konto_start",
    "bu_schluessel_erloes",
    "bu_schluessel_aufwand",
    "festschreibung",
)
# Tabellen-Codes von PostgREST, wenn eine Nachbar-Tabelle noch nicht existiert.
_TABELLE_FEHLT = "42P01"
_UNIQUE_VERLETZT = "23505"
_ZWEI_STELLEN = Decimal("0.01")
_MAX_ROWS = 20000


def _q(betrag: Decimal) -> Decimal:
    return betrag.quantize(_ZWEI_STELLEN, rounding=ROUND_HALF_UP)


def _dec(wert: object) -> Decimal:
    if wert is None or wert == "":
        return Decimal("0")
    return Decimal(str(wert))


def _datum(wert: object) -> date | None:
    if wert is None or wert == "":
        return None
    if isinstance(wert, datetime):
        return wert.date()
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert)[:10])


def _satz(wert: object) -> str:
    """Steuersatz als Map-Schlüssel (`19` → `"19.00"`)."""
    return f"{float(_dec(wert)):.2f}"


class DatevError(Exception):
    def __init__(
        self, message: str, *, status_code: int = 400, details: dict | None = None
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def _nicht_gefunden(was: str) -> DatevError:
    return DatevError(f"{was} nicht gefunden.", status_code=404)


@dataclass
class _Sammlung:
    """Ergebnis des Sammelns: Buchungen + Zählung + Probleme + Warnungen."""

    buchungen: list[extf.Buchung] = field(default_factory=list)
    anzahl: dict[str, int] = field(default_factory=lambda: dict.fromkeys(BELEGARTEN, 0))
    probleme: list[str] = field(default_factory=list)
    warnungen: list[str] = field(default_factory=list)


class DatevService:
    """Alle Operationen sind auf `ctx.tenant_id` gescopet."""

    def __init__(self, db: Client, *, jetzt: Callable[[], datetime] | None = None) -> None:
        self._db = db
        self._jetzt = jetzt or (lambda: datetime.now(UTC))

    # ------------------------------------------------------------- Hilfen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise DatevError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    def _tenant_waehrung(self, tenant_id: str) -> str:
        rows = (
            self._db.table("tenants").select("currency").eq("id", tenant_id).limit(1).execute()
        ).data or []
        waehrung = str((rows[0] if rows else {}).get("currency") or "").strip()
        if not waehrung:
            raise DatevError(
                "Der Betrieb hat keine Währung hinterlegt — bitte unter Konto ergänzen.",
                status_code=422,
            )
        return waehrung

    # ------------------------------------------------------- Einstellungen
    def _settings_row(self, tenant_id: str) -> dict | None:
        rows = (
            self._db.table("datev_settings")
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    @staticmethod
    def _fehlende(row: dict | None) -> list[str]:
        if not row:
            return list(PFLICHTFELDER)
        return [f for f in PFLICHTFELDER if row.get(f) in (None, "", {})]

    def _settings_antwort(self, row: dict | None) -> DatevSettingsResponse:
        fehlend = self._fehlende(row)
        daten = {k: (row or {}).get(k) for k in PFLICHTFELDER}
        return DatevSettingsResponse(
            **daten,
            finanzkonten=(row or {}).get("finanzkonten") or {},
            configured=not fehlend,
            fehlende_felder=fehlend,
            updated_at=(row or {}).get("updated_at"),
        )

    def get_settings(self, ctx: AuthContext) -> DatevSettingsResponse:
        return self._settings_antwort(self._settings_row(self._tenant(ctx)))

    def put_settings(self, ctx: AuthContext, body: DatevSettingsUpdate) -> DatevSettingsResponse:
        tenant_id = self._tenant(ctx)
        zeile: dict[str, Any] = {"tenant_id": tenant_id, **body.model_dump(by_alias=False)}
        self._db.table("datev_settings").upsert(zeile, on_conflict="tenant_id").execute()
        log.info(
            "datev_einstellungen_gespeichert",
            tenant_id=tenant_id,
            kontenrahmen=body.kontenrahmen,
            berater_nummer=body.berater_nummer,
            mandanten_nummer=body.mandanten_nummer,
        )
        return self._settings_antwort(self._settings_row(tenant_id))

    def _settings_pflicht(self, tenant_id: str) -> dict:
        row = self._settings_row(tenant_id)
        fehlend = self._fehlende(row)
        if fehlend:
            log.warning("datev_einstellungen_fehlen", tenant_id=tenant_id, felder=fehlend)
            raise DatevError(
                "DATEV-Export nicht eingerichtet: es fehlen " + ", ".join(fehlend) + ".",
                status_code=422,
                details={"fehlende_felder": fehlend},
            )
        assert row is not None  # noqa: S101 — von _fehlende geprüft
        return row

    # ----------------------------------------------------------- Zeitraum
    @staticmethod
    def _zeitraum_pruefen(anfrage: ExportAnfrage) -> None:
        if anfrage.date_to < anfrage.date_from:
            raise DatevError("Das Enddatum liegt vor dem Startdatum.", status_code=422)
        if (anfrage.date_to - anfrage.date_from).days + 1 > MAX_ZEITRAUM_TAGE:
            raise DatevError(
                f"Der Zeitraum darf höchstens {MAX_ZEITRAUM_TAGE} Tage umfassen.", status_code=422
            )
        if anfrage.export_type == "buchungsstapel" and not anfrage.belegarten:
            raise DatevError("Bitte mindestens eine Belegart wählen.", status_code=422)

    @staticmethod
    def _wj_beginn(monat: int, datum_von: date) -> date:
        jahr = datum_von.year if datum_von.month >= monat else datum_von.year - 1
        return date(jahr, monat, 1)

    # ---------------------------------------------------------- Laden
    def _rows(self, tabelle: str, spalten: str, tenant_id: str, **filter_: object) -> list[dict]:
        """Tenant-gefilterte Liste; `von`/`bis` grenzen eine Datumsspalte ein.
        Fehlt die Tabelle (Nachbarbereich noch nicht eingespielt), ist das ein
        klarer 422 statt eines rohen 500."""
        query = self._db.table(tabelle).select(spalten).eq("tenant_id", tenant_id)
        datumsspalte = filter_.pop("datumsspalte", None)
        von, bis = filter_.pop("von", None), filter_.pop("bis", None)
        if datumsspalte and von and bis:
            query = query.gte(datumsspalte, von.isoformat()).lte(datumsspalte, bis.isoformat())
        for spalte, wert in filter_.items():
            query = query.in_(spalte, wert) if isinstance(wert, list) else query.eq(spalte, wert)
        try:
            return query.limit(_MAX_ROWS).execute().data or []
        except APIError as exc:
            if getattr(exc, "code", None) == _TABELLE_FEHLT:
                raise DatevError(
                    f"Die Tabelle '{tabelle}' ist noch nicht vorhanden — Modul nicht eingespielt.",
                    status_code=422,
                ) from exc
            raise

    def _kunden(self, tenant_id: str, ids: Iterable[str]) -> dict[str, dict]:
        ids = sorted({str(i) for i in ids if i})
        if not ids:
            return {}
        rows = self._rows(
            "customers",
            "id, name, customer_number, customer_type, is_supplier, vat_id, email, phone, address",
            tenant_id,
            id=ids,
        )
        return {str(r["id"]): r for r in rows}

    def _positionen(self, invoice_ids: list[str]) -> dict[str, list[dict]]:
        """`invoice_line_items` hat keine tenant_id — die Rechnungen sind
        bereits tenant-gefiltert, nur deren IDs werden gefragt."""
        if not invoice_ids:
            return {}
        rows = (
            self._db.table("invoice_line_items")
            .select("invoice_id, tax_rate, gross_amount")
            .in_("invoice_id", sorted(invoice_ids))
            .limit(_MAX_ROWS)
            .execute()
        ).data or []
        raus: dict[str, list[dict]] = defaultdict(list)
        for r in rows:
            raus[str(r["invoice_id"])].append(r)
        return raus

    def _kontenplan(self, tenant_id: str) -> set[str] | None:
        """Sachkontonummern des Betriebs aus `booking_accounts` (0671).
        `None`, wenn der Betrieb dort (noch) keine Konten führt oder die
        Tabelle fehlt — dann gibt es nichts, wogegen zu prüfen wäre."""
        try:
            rows = self._rows("booking_accounts", "number, active", tenant_id)
        except DatevError:
            return None
        nummern = {str(r["number"]) for r in rows if r.get("active", True)}
        return nummern or None

    # ---------------------------------------------------------- Konten
    @staticmethod
    def _personenkonto(
        kunde: dict | None, start: int, laenge: int, kontext: str, probleme: list[str]
    ) -> str | None:
        if not kunde:
            probleme.append(f"{kontext}: kein Kunde/Lieferant zugeordnet.")
            return None
        nummer = str(kunde.get("customer_number") or "").strip()
        ziffern = "".join(ch for ch in nummer if ch.isdigit())
        if not ziffern:
            probleme.append(f"{kontext}: '{kunde.get('name')}' hat keine numerische Kundennummer.")
            return None
        konto = start + int(ziffern)
        if len(str(konto)) != laenge + 1:
            probleme.append(
                f"{kontext}: Personenkonto {konto} für '{kunde.get('name')}' hat nicht "
                f"{laenge + 1} Stellen (Sachkontenlänge {laenge} + 1)."
            )
            return None
        return str(konto)

    @staticmethod
    def _bu(map_: dict, satz: str, kontext: str, probleme: list[str]) -> str | None:
        if satz not in map_:
            probleme.append(f"{kontext}: kein BU-Schlüssel für Steuersatz {satz} % hinterlegt.")
            return None
        return str(map_[satz])

    # -------------------------------------------------------- Sammeln
    def _rechnungen_sammeln(
        self, tenant_id: str, s: dict, anfrage: ExportAnfrage, waehrung: str, out: _Sammlung
    ) -> None:
        will_re = "ausgangsrechnungen" in anfrage.belegarten
        will_gs = "gutschriften" in anfrage.belegarten
        typen = ([TYP_RECHNUNG] if will_re else []) + (sorted(TYPEN_GUTSCHRIFT) if will_gs else [])
        rows = self._rows(
            "invoices",
            "id, invoice_number, customer_id, invoice_type, status, issue_date, due_date, "
            "gross_amount, tax_amount, tax_rate, currency, is_locked, deleted_at",
            tenant_id,
            datumsspalte="issue_date",
            von=anfrage.date_from,
            bis=anfrage.date_to,
            invoice_type=typen,
            status=sorted(AUSGESTELLT),
        )
        rows = [r for r in rows if not r.get("deleted_at")]
        kunden = self._kunden(tenant_id, (r.get("customer_id") for r in rows))
        positionen = self._positionen([str(r["id"]) for r in rows])
        laenge = int(s["sachkontenlaenge"])
        for r in rows:
            ist_gs = r.get("invoice_type") in TYPEN_GUTSCHRIFT
            art = "gutschriften" if ist_gs else "ausgangsrechnungen"
            nummer = str(r.get("invoice_number") or "")
            kontext = f"{'Gutschrift' if ist_gs else 'Rechnung'} {nummer or r['id']}"
            if not nummer:
                out.probleme.append(f"{kontext}: keine Belegnummer.")
                continue
            if str(r.get("currency") or "") != waehrung:
                out.probleme.append(
                    f"{kontext}: Währung {r.get('currency')} ≠ Betriebswährung {waehrung} "
                    "— ohne Kurs nicht exportierbar."
                )
                continue
            kunde = kunden.get(str(r.get("customer_id") or ""))
            debitor = self._personenkonto(
                kunde, int(s["debitor_konto_start"]), laenge, kontext, out.probleme
            )
            gruppen = self._steuergruppen(
                r, positionen.get(str(r["id"]), []), kontext, out.probleme
            )
            if debitor is None or gruppen is None:
                continue
            belegdatum = _datum(r.get("issue_date"))
            assert belegdatum is not None  # noqa: S101 — Filter auf issue_date
            kundenname = (kunde or {}).get("name", "")
            out.anzahl[art] += 1
            for satz, brutto in gruppen.items():
                bu = self._bu(s["bu_schluessel_erloes"], satz, kontext, out.probleme)
                if bu is None or brutto == 0:
                    continue
                out.buchungen.append(
                    extf.Buchung(
                        umsatz=_q(brutto),
                        soll_haben="H" if ist_gs else "S",
                        waehrung=waehrung,
                        konto=debitor,
                        gegenkonto=str(s["standard_erloeskonto"]),
                        bu_schluessel=bu,
                        belegdatum=belegdatum,
                        belegfeld1=nummer,
                        buchungstext=f"{'GS' if ist_gs else 'RE'} {nummer} {kundenname}",
                        faelligkeit=_datum(r.get("due_date")),
                        festschreibung=bool(r.get("is_locked")),
                        guid=str(r["id"]),
                    )
                )

    @staticmethod
    def _steuergruppen(
        rechnung: dict, positionen: list[dict], kontext: str, probleme: list[str]
    ) -> dict[str, Decimal] | None:
        """Bruttobetrag je Steuersatz — aus den Positionen, sonst aus dem Kopf."""
        if positionen:
            gruppen: dict[str, Decimal] = defaultdict(Decimal)
            for p in positionen:
                gruppen[_satz(p.get("tax_rate"))] += _dec(p.get("gross_amount"))
            return dict(gruppen)
        brutto = _dec(rechnung.get("gross_amount"))
        if rechnung.get("tax_rate") is None:
            if _dec(rechnung.get("tax_amount")) != 0:
                probleme.append(f"{kontext}: Steuerbetrag ohne Steuersatz und ohne Positionen.")
                return None
            return {"0.00": brutto}
        return {_satz(rechnung.get("tax_rate")): brutto}

    def _zahlungen_sammeln(
        self, tenant_id: str, s: dict, anfrage: ExportAnfrage, waehrung: str, out: _Sammlung
    ) -> None:
        rows = self._rows(
            "invoice_payments",
            "id, invoice_id, date, amount, currency, payment_account_id",
            tenant_id,
            datumsspalte="date",
            von=anfrage.date_from,
            bis=anfrage.date_to,
        )
        if not rows:
            return
        rechnungen = {
            str(r["id"]): r
            for r in self._rows(
                "invoices",
                "id, invoice_number, customer_id, currency",
                tenant_id,
                id=sorted({str(r["invoice_id"]) for r in rows}),
            )
        }
        kunden = self._kunden(tenant_id, (r.get("customer_id") for r in rechnungen.values()))
        finanzkonten: dict = s.get("finanzkonten") or {}
        laenge = int(s["sachkontenlaenge"])
        for z in rows:
            rechnung = rechnungen.get(str(z["invoice_id"]))
            nummer = str((rechnung or {}).get("invoice_number") or "")
            kontext = f"Zahlung zu Rechnung {nummer or z['invoice_id']}"
            if rechnung is None or not nummer:
                out.probleme.append(f"{kontext}: Rechnung oder Belegnummer fehlt.")
                continue
            if str(z.get("currency") or "") != waehrung:
                out.probleme.append(
                    f"{kontext}: Währung {z.get('currency')} ≠ Betriebswährung {waehrung}."
                )
                continue
            kunde = kunden.get(str(rechnung.get("customer_id") or ""))
            debitor = self._personenkonto(
                kunde, int(s["debitor_konto_start"]), laenge, kontext, out.probleme
            )
            if debitor is None:
                continue
            betrag = _dec(z.get("amount"))
            if betrag == 0:
                continue
            datum = _datum(z.get("date"))
            assert datum is not None  # noqa: S101 — Filter auf date
            out.anzahl["zahlungen"] += 1
            out.buchungen.append(
                extf.Buchung(
                    umsatz=_q(abs(betrag)),
                    soll_haben="H" if betrag > 0 else "S",
                    waehrung=waehrung,
                    konto=debitor,
                    gegenkonto=str(
                        finanzkonten.get(str(z.get("payment_account_id") or ""))
                        or s["standard_finanzkonto"]
                    ),
                    bu_schluessel="",
                    belegdatum=datum,
                    belegfeld1=nummer,
                    buchungstext=f"Zahlung RE {nummer} {(kunde or {}).get('name', '')}",
                    guid=str(z["id"]),
                )
            )

    def _ausgaben_sammeln(
        self, tenant_id: str, s: dict, anfrage: ExportAnfrage, waehrung: str, out: _Sammlung
    ) -> None:
        rows = self._rows(
            "expenses",
            "id, supplier_id, supplier_name, receipt_number, title, expense_date, due_date, "
            "gross_amount, tax_rate, currency, booking_account, payment_status, is_locked",
            tenant_id,
            datumsspalte="expense_date",
            von=anfrage.date_from,
            bis=anfrage.date_to,
        )
        rows = [r for r in rows if r.get("payment_status") != "cancelled"]
        kunden = self._kunden(tenant_id, (r.get("supplier_id") for r in rows))
        kontenplan = self._kontenplan(tenant_id) if rows else None
        laenge = int(s["sachkontenlaenge"])
        for a in rows:
            beleg = str(a.get("receipt_number") or "").strip()
            kontext = f"Ausgabe {beleg or a.get('title') or a['id']}"
            if str(a.get("currency") or "") != waehrung:
                out.probleme.append(
                    f"{kontext}: Währung {a.get('currency')} ≠ Betriebswährung {waehrung}."
                )
                continue
            kunde = kunden.get(str(a.get("supplier_id") or ""))
            kreditor = self._personenkonto(
                kunde, int(s["kreditor_konto_start"]), laenge, kontext, out.probleme
            )
            satz = _satz(a.get("tax_rate"))
            bu = self._bu(s["bu_schluessel_aufwand"], satz, kontext, out.probleme)
            aufwand = str(a.get("booking_account") or s["standard_aufwandskonto"])
            if kontenplan is not None and aufwand not in kontenplan:
                out.probleme.append(
                    f"{kontext}: Aufwandskonto {aufwand} steht nicht im Kontenplan."
                )
                continue
            if kreditor is None or bu is None:
                continue
            brutto = _dec(a.get("gross_amount"))
            if brutto == 0:
                continue
            datum = _datum(a.get("expense_date"))
            assert datum is not None  # noqa: S101 — Filter auf expense_date
            out.anzahl["ausgaben"] += 1
            lieferant = (kunde or {}).get("name") or a.get("supplier_name") or ""
            out.buchungen.append(
                extf.Buchung(
                    umsatz=_q(abs(brutto)),
                    soll_haben="H" if brutto > 0 else "S",
                    waehrung=waehrung,
                    konto=kreditor,
                    gegenkonto=aufwand,
                    bu_schluessel=bu,
                    belegdatum=datum,
                    belegfeld1=beleg or str(a["id"])[: extf.MAX_BELEGFELD1],
                    buchungstext=f"ER {beleg} {lieferant}",
                    faelligkeit=_datum(a.get("due_date")),
                    festschreibung=bool(a.get("is_locked")),
                    guid=str(a["id"]),
                )
            )

    def _sachkonten_pruefen(self, tenant_id: str, s: dict, probleme: list[str]) -> None:
        kontenplan = self._kontenplan(tenant_id)
        if kontenplan is None:
            return
        for feld in ("standard_erloeskonto", "standard_aufwandskonto", "standard_finanzkonto"):
            if str(s[feld]) not in kontenplan:
                probleme.append(f"Einstellungen: {feld} {s[feld]} steht nicht im Kontenplan.")

    def _sammeln(self, tenant_id: str, s: dict, anfrage: ExportAnfrage, waehrung: str) -> _Sammlung:
        out = _Sammlung()
        self._sachkonten_pruefen(tenant_id, s, out.probleme)
        if {"ausgangsrechnungen", "gutschriften"} & set(anfrage.belegarten):
            self._rechnungen_sammeln(tenant_id, s, anfrage, waehrung, out)
        if "zahlungen" in anfrage.belegarten:
            self._zahlungen_sammeln(tenant_id, s, anfrage, waehrung, out)
        if "ausgaben" in anfrage.belegarten:
            self._ausgaben_sammeln(tenant_id, s, anfrage, waehrung, out)
        out.buchungen.sort(key=lambda b: (b.belegdatum, b.belegfeld1, b.guid))
        return out

    def _personenkonten_sammeln(
        self, tenant_id: str, s: dict
    ) -> tuple[list[extf.Personenkonto], list[str]]:
        rows = self._rows(
            "customers",
            "id, name, customer_number, customer_type, is_supplier, vat_id, email, phone, "
            "address, deleted_at",
            tenant_id,
        )
        probleme: list[str] = []
        konten: list[extf.Personenkonto] = []
        laenge = int(s["sachkontenlaenge"])
        for k in rows:
            if k.get("deleted_at"):
                continue
            start = int(
                s["kreditor_konto_start"] if k.get("is_supplier") else s["debitor_konto_start"]
            )
            konto = self._personenkonto(k, start, laenge, f"Kunde {k.get('name')}", probleme)
            if konto is None:
                continue
            adresse = k.get("address") if isinstance(k.get("address"), dict) else {}
            ustid = str(k.get("vat_id") or "").replace(" ", "")
            konten.append(
                extf.Personenkonto(
                    konto=konto,
                    name=str(k.get("name") or ""),
                    ist_unternehmen=(k.get("customer_type") or "business") == "business",
                    eu_land=ustid[:2] if ustid[:2].isalpha() else "",
                    eu_ustid=ustid[2:] if ustid[:2].isalpha() else ustid,
                    strasse=" ".join(
                        str(adresse.get(x) or "").strip() for x in ("street", "house_number")
                    ).strip(),
                    plz=str(adresse.get("postal_code") or ""),
                    ort=str(adresse.get("city") or ""),
                    land=str(adresse.get("country_code") or adresse.get("country") or "")[
                        :2
                    ].upper(),
                    telefon=str(k.get("phone") or ""),
                    email=str(k.get("email") or ""),
                )
            )
        konten.sort(key=lambda p: p.konto)
        return konten, probleme

    # ---------------------------------------------------------- Vorschau
    def vorschau(self, ctx: AuthContext, anfrage: ExportAnfrage) -> Vorschau:
        """Zählt, was der Export enthalten würde, und listet die Probleme, an
        denen er mit 422 scheitern würde — ohne etwas zu schreiben."""
        tenant_id = self._tenant(ctx)
        self._zeitraum_pruefen(anfrage)
        row = self._settings_row(tenant_id)
        fehlend = self._fehlende(row)
        if fehlend:
            return Vorschau(
                export_type=anfrage.export_type,
                date_from=anfrage.date_from,
                date_to=anfrage.date_to,
                anzahl_gesamt=0,
                anzahl_je_belegart=dict.fromkeys(anfrage.belegarten, 0),
                probleme=["Einstellungen unvollständig: " + ", ".join(fehlend)],
            )
        assert row is not None  # noqa: S101
        waehrung = self._tenant_waehrung(tenant_id)
        if anfrage.export_type == "stammdaten":
            konten, probleme = self._personenkonten_sammeln(tenant_id, row)
            return Vorschau(
                export_type=anfrage.export_type,
                date_from=anfrage.date_from,
                date_to=anfrage.date_to,
                anzahl_gesamt=len(konten),
                anzahl_je_belegart={"personenkonten": len(konten)},
                probleme=probleme,
            )
        s = self._sammeln(tenant_id, row, anfrage, waehrung)
        anzahl = {a: s.anzahl[a] for a in anfrage.belegarten}
        return Vorschau(
            export_type=anfrage.export_type,
            date_from=anfrage.date_from,
            date_to=anfrage.date_to,
            anzahl_gesamt=sum(anzahl.values()),
            anzahl_je_belegart=anzahl,
            probleme=s.probleme,
            warnungen=s.warnungen,
        )

    # ------------------------------------------------------------ Export
    def _bestehender_lauf(
        self, tenant_id: str, anfrage: ExportAnfrage, content_hash: str
    ) -> dict | None:
        rows = (
            self._db.table("datev_exports")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("export_type", anfrage.export_type)
            .eq("date_from", anfrage.date_from.isoformat())
            .eq("date_to", anfrage.date_to.isoformat())
            .eq("content_hash", content_hash)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    @staticmethod
    def _antwort(row: dict, *, wiederverwendet: bool = False) -> ExportResponse:
        return ExportResponse(
            id=str(row["id"]),
            tenant_id=str(row["tenant_id"]),
            export_type=row["export_type"],
            date_from=_datum(row["date_from"]) or date.min,
            date_to=_datum(row["date_to"]) or date.min,
            belegarten=list(row.get("belegarten") or []),
            anzahl=int(row["anzahl"]),
            content_hash=row["content_hash"],
            dateiname=row["dateiname"],
            groesse=int(row["groesse"]),
            status=row["status"],
            kontenrahmen=row["kontenrahmen"],
            warnungen=list(row.get("warnungen") or []),
            wiederverwendet=wiederverwendet,
            created_by=str(row["created_by"]) if row.get("created_by") else None,
            created_at=row["created_at"],
        )

    def export(self, ctx: AuthContext, anfrage: ExportAnfrage) -> ExportResponse:
        tenant_id = self._tenant(ctx)
        self._zeitraum_pruefen(anfrage)
        s = self._settings_pflicht(tenant_id)
        waehrung = self._tenant_waehrung(tenant_id)
        jetzt = self._jetzt()
        kopf = extf.Kopf(
            berater_nummer=int(s["berater_nummer"]),
            mandanten_nummer=int(s["mandanten_nummer"]),
            wirtschaftsjahr_beginn=self._wj_beginn(
                int(s["wirtschaftsjahr_beginn_monat"]), anfrage.date_from
            ),
            sachkontenlaenge=int(s["sachkontenlaenge"]),
            datum_von=anfrage.date_from,
            datum_bis=anfrage.date_to,
            bezeichnung=(
                f"Stapel {anfrage.date_from:%d.%m.%Y}-{anfrage.date_to:%d.%m.%Y}"
                if anfrage.export_type == "buchungsstapel"
                else "Debitoren/Kreditoren"
            ),
            waehrung=waehrung,
            kontenrahmen=str(s["kontenrahmen"]),
            festschreibung=bool(s["festschreibung"]),
            erzeugt_am=jetzt,
            exportiert_von="myNextDays",
        )
        if anfrage.export_type == "stammdaten":
            konten, probleme = self._personenkonten_sammeln(tenant_id, s)
            warnungen: list[str] = []
            if probleme:
                self._probleme_werfen(tenant_id, probleme)
            ergebnis = extf.stammdaten(kopf, konten)
            praefix = "EXTF_Debitoren_Kreditoren"
        else:
            sammlung = self._sammeln(tenant_id, s, anfrage, waehrung)
            if sammlung.probleme:
                self._probleme_werfen(tenant_id, sammlung.probleme)
            warnungen = sammlung.warnungen
            ergebnis = extf.buchungsstapel(kopf, sammlung.buchungen)
            praefix = "EXTF_Buchungsstapel"
        if ergebnis.anzahl == 0:
            raise DatevError(
                "Im gewählten Zeitraum gibt es nichts zu exportieren.", status_code=422
            )
        warnungen = [*warnungen, *ergebnis.warnungen]

        bestehend = self._bestehender_lauf(tenant_id, anfrage, ergebnis.content_hash)
        if bestehend:
            log.info("datev_export_wiederverwendet", tenant_id=tenant_id, export_id=bestehend["id"])
            return self._antwort(bestehend, wiederverwendet=True)

        dateiname = (
            f"{praefix}_{anfrage.date_from:%Y%m%d}_{anfrage.date_to:%Y%m%d}"
            f"_{ergebnis.content_hash[:8]}.csv"
        )
        pfad = f"{tenant_id}/{anfrage.export_type}/{ergebnis.content_hash}.csv"
        self._db.storage.from_(BUCKET).upload(
            pfad, ergebnis.inhalt, {"content-type": MIME_CSV, "upsert": "true"}
        )
        zeile = {
            "tenant_id": tenant_id,
            "export_type": anfrage.export_type,
            "date_from": anfrage.date_from.isoformat(),
            "date_to": anfrage.date_to.isoformat(),
            "belegarten": list(anfrage.belegarten),
            "anzahl": ergebnis.anzahl,
            "content_hash": ergebnis.content_hash,
            "dateiname": dateiname,
            "storage_pfad": pfad,
            "groesse": len(ergebnis.inhalt),
            "status": "erstellt",
            "kontenrahmen": str(s["kontenrahmen"]),
            "warnungen": warnungen,
            "created_by": ctx.user_id,
        }
        try:
            res = self._db.table("datev_exports").insert(zeile).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VERLETZT:
                bestehend = self._bestehender_lauf(tenant_id, anfrage, ergebnis.content_hash)
                if bestehend:
                    log.info("datev_export_rennen", tenant_id=tenant_id, export_id=bestehend["id"])
                    return self._antwort(bestehend, wiederverwendet=True)
            raise
        neu = (res.data or [None])[0]
        if not neu:
            raise DatevError("Der Exportlauf konnte nicht gespeichert werden.", status_code=500)
        log.info(
            "datev_export_erstellt",
            tenant_id=tenant_id,
            export_id=neu["id"],
            export_type=anfrage.export_type,
            anzahl=ergebnis.anzahl,
            groesse=len(ergebnis.inhalt),
            warnungen=len(warnungen),
            content_hash=ergebnis.content_hash[:12],
        )
        return self._antwort(neu)

    @staticmethod
    def _probleme_werfen(tenant_id: str, probleme: list[str]) -> None:
        log.warning("datev_export_probleme", tenant_id=tenant_id, anzahl=len(probleme))
        raise DatevError(
            f"{len(probleme)} Beleg(e) können nicht exportiert werden: "
            + probleme[0]
            + (" …" if len(probleme) > 1 else ""),
            status_code=422,
            details={"probleme": probleme[:200]},
        )

    # ---------------------------------------------------------- Historie
    def list_exports(self, ctx: AuthContext, *, limit: int = 100) -> list[ExportResponse]:
        tenant_id = self._tenant(ctx)
        rows = (
            self._db.table("datev_exports")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(min(limit, 500))
            .execute()
        ).data or []
        return [self._antwort(r) for r in rows]

    def download(self, ctx: AuthContext, export_id: str) -> tuple[bytes, str]:
        """Dateiinhalt + Dateiname eines eigenen Laufs — der Bucket ist privat,
        der Server ist der einzige Weg zur Datei."""
        tenant_id = self._tenant(ctx)
        row = load_scoped(
            self._db, "datev_exports", export_id, tenant_id, not_found=_nicht_gefunden("Export")
        )
        inhalt = self._db.storage.from_(BUCKET).download(str(row["storage_pfad"]))
        if not inhalt:
            log.error("datev_export_datei_fehlt", tenant_id=tenant_id, export_id=export_id)
            raise DatevError("Die Exportdatei ist nicht mehr vorhanden.", status_code=410)
        log.info("datev_export_heruntergeladen", tenant_id=tenant_id, export_id=export_id)
        return bytes(inhalt), str(row["dateiname"])
