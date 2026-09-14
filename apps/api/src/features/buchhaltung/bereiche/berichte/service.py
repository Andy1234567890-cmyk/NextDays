"""Fachlogik des Bereichs »berichte«: Auswertungen aus dem Belegbestand.

Nichts hier schreibt. Jeder Bericht lädt die Belege des Mandanten im
Zeitraum und aggregiert sie in Decimal. Grundsätze:

  * Zeitpunkt eines Belegs ist sein BELEGDATUM (`issue_date`, `expense_date`,
    `due_date`) — nie `created_at`, das nur unsere Verarbeitung beschreibt
    (Wurzel 5b). Auch sortiert wird danach.
  * Ein Storno ist ein eigener Beleg mit negativen Beträgen (storno.py) und
    zählt NEGATIV in den Umsatz — die stornierte Rechnung (`cancelled`)
    bleibt drin, beide heben sich auf. Entwürfe (`draft`, ohne Nummer) sind
    keine Belege und fehlen überall.
  * Berichtswährung = Mandantenwährung (`tenants.currency`, fehlt → 422).
    Belege anderer Währung werden je Währung getrennt gezählt, nie addiert.
  * Zeitraum ist Pflicht und auf 366 Tage begrenzt (422), Zeilen auf
    `MAX_ZEILEN` (Wurzel 8).
  * Nachbarbereiche: `expenses` (0656: `expense_date`, `net_amount`,
    `payment_status` open|paid|cancelled, `booking_account` = KONTONUMMER als
    Text) und `booking_accounts` (0671: `number`, `name`, `type`
    INCOME|EXPENSE|ASSET|LIABILITY, `kontenrahmen` SKR03|SKR04). Sie
    entstehen parallel; ist die Tabelle noch nicht eingespielt (42P01),
    meldet der Bericht `*_verfuegbar=false` statt Nullen zu erfinden.
  * BWA-Gruppe eines Aufwands: aus der Kontonummer im Kontenrahmen des
    Kontos (SKR03: 3xxx Material, 41xx Personal, 42xx Raum; SKR04: 5xxx
    Material, 60xx/61xx Personal, 63xx Raum), sonst Schlagworte im
    Kontonamen, sonst „sonstige".
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from collections.abc import Callable, Iterable, Iterator
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import (
    BUCKETS,
    BWA_GRUPPEN,
    MAX_TAGE,
    Aufschluesselung,
    Berichtsart,
    Bucket,
    BucketSumme,
    BwaGruppe,
    BwaResponse,
    BwaZeile,
    Fremdwaehrung,
    Gruppierung,
    GuvMonat,
    GuvResponse,
    OffenerPosten,
    OpenItemsResponse,
    OverviewResponse,
    RevenueResponse,
    SusaResponse,
    SusaZeile,
    TopKunde,
    ZeitpunktWert,
    Zeitraum,
    Zeitreihe,
)

log = get_logger("nextdays.buchhaltung.berichte")

# Rechnungsstatus, in denen ein Beleg AUSGESTELLT ist (Entwurf zählt nicht).
AUSGESTELLT: frozenset[str] = frozenset({"sent", "finalized", "overdue", "paid", "cancelled"})
# Davon noch nicht bezahlt — die Grundlage der OP-Liste.
OFFEN: frozenset[str] = frozenset({"sent", "finalized", "overdue"})
# `expenses.payment_status`, in dem eine Ausgabe KEIN Aufwand ist (0656).
AUSGABEN_UNWIRKSAM: frozenset[str] = frozenset({"cancelled"})

# Seitengröße der PostgREST-Abfrage und harte Obergrenze je Bericht.
SEITE = 1000
MAX_ZEILEN = 20_000
# Höchstzahl Zeilen im CSV — der Export ist ein Stream, aber kein Endlosband.
CSV_MAX_ZEILEN = 10_000
TOP_KUNDEN = 5
_IN_BLOCK = 200

_ZWEI = Decimal("0.01")
_NULL = Decimal("0")

# Kontonummern-Bereiche je Kontenrahmen (0671 `kontenrahmen`), einschließlich.
_BWA_BEREICHE: dict[str, dict[BwaGruppe, tuple[tuple[int, int], ...]]] = {
    "SKR03": {
        "material": ((3000, 3999),),
        "personal": ((4100, 4199),),
        "raum": ((4200, 4299),),
    },
    "SKR04": {
        "material": ((5000, 5999),),
        "personal": ((6000, 6199),),
        "raum": ((6300, 6399),),
    },
}
# Schlagworte im Kontonamen — der Rückweg, wenn kein Kontenrahmen gesetzt ist.
_BWA_SCHLAGWORTE: dict[BwaGruppe, tuple[str, ...]] = {
    "material": ("material", "waren", "wareneinsatz", "einkauf", "fremdleist"),
    "personal": ("personal", "lohn", "gehalt", "gehälter", "sozial"),
    "raum": ("raum", "miete", "rent", "pacht", "nebenkosten", "strom", "heiz", "reinigung"),
}
_BWA_LABEL: dict[BwaGruppe, str] = {
    "material": "Materialaufwand",
    "personal": "Personalaufwand",
    "raum": "Raumkosten",
    "sonstige": "Sonstige Kosten",
}


def _q(wert: Decimal) -> Decimal:
    return wert.quantize(_ZWEI, rounding=ROUND_HALF_UP)


def _dec(wert: object) -> Decimal:
    if wert is None or wert == "":
        return _NULL
    return Decimal(str(wert))


def _datum(wert: object) -> date | None:
    if wert is None or wert == "":
        return None
    if isinstance(wert, datetime):
        return wert.date()
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert)[:10])


def _prozent(teil: Decimal, ganzes: Decimal) -> Decimal | None:
    if ganzes == 0:
        return None
    return (teil / ganzes * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def _veraenderung(aktuell: Decimal, vergleich: Decimal) -> Decimal | None:
    if vergleich == 0:
        return None
    return ((aktuell - vergleich) / abs(vergleich) * 100).quantize(
        Decimal("0.1"), rounding=ROUND_HALF_UP
    )


def periode_von(tag: date, gruppierung: Gruppierung) -> str:
    """Schlüssel der Periode eines Belegdatums: `2026-03`, `2026-Q1`, `2026`."""
    if gruppierung == "year":
        return f"{tag.year}"
    if gruppierung == "quarter":
        return f"{tag.year}-Q{(tag.month - 1) // 3 + 1}"
    return f"{tag.year}-{tag.month:02d}"


def perioden_im_zeitraum(von: date, bis: date, gruppierung: Gruppierung) -> list[str]:
    """Alle Perioden zwischen den Grenzen — auch leere, damit die Zeitreihe
    keine Monate verschluckt (ein fehlender Monat sieht wie eine Kurve aus)."""
    keys: list[str] = []
    tag = von.replace(day=1)
    while tag <= bis:
        key = periode_von(tag, gruppierung)
        if not keys or keys[-1] != key:
            keys.append(key)
        naechster_monat = tag.month % 12 + 1
        tag = tag.replace(year=tag.year + (1 if naechster_monat == 1 else 0), month=naechster_monat)
    return keys


def bwa_gruppe(konto: dict | None) -> BwaGruppe:
    """BWA-Gruppe eines Buchungskontos: Kontonummer im Kontenrahmen, sonst
    Schlagworte im Namen. Ohne Konto: sonstige."""
    if not konto:
        return "sonstige"
    rahmen = str(konto.get("kontenrahmen") or "").upper()
    nummer = str(konto.get("number") or "")
    if rahmen in _BWA_BEREICHE and nummer.isdigit():
        n = int(nummer[:4].ljust(4, "0"))
        for gruppe, bereiche in _BWA_BEREICHE[rahmen].items():
            if any(a <= n <= b for a, b in bereiche):
                return gruppe
    text = str(konto.get("name") or "").lower()
    for gruppe, worte in _BWA_SCHLAGWORTE.items():
        if any(w in text for w in worte):
            return gruppe
    return "sonstige"


def bucket_fuer(alter_tage: int | None) -> Bucket:
    if alter_tage is None:
        return "ohne_faelligkeit"
    if alter_tage < 0:
        return "nicht_faellig"
    if alter_tage <= 30:
        return "0-30"
    if alter_tage <= 60:
        return "31-60"
    if alter_tage <= 90:
        return "61-90"
    return ">90"


class BerichteError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def zeitraum_pruefen(von: date | None, bis: date | None) -> Zeitraum:
    """Pflicht-Zeitraum: beide Grenzen, `bis >= von`, höchstens 366 Tage."""
    if von is None or bis is None:
        raise BerichteError("Zeitraum fehlt: `from` und `to` sind Pflicht.", status_code=422)
    if bis < von:
        raise BerichteError("`to` liegt vor `from`.", status_code=422)
    tage = (bis - von).days + 1
    if tage > MAX_TAGE:
        raise BerichteError(
            f"Zeitraum zu groß: höchstens {MAX_TAGE} Tage, angefragt {tage}.", status_code=422
        )
    return Zeitraum(von=von, bis=bis, tage=tage)


class _Waehrungsteiler:
    """Trennt Belegzeilen in Berichtswährung und Fremdwährungen."""

    def __init__(self, currency: str) -> None:
        self.currency = currency
        self._fremd: dict[str, dict[str, Any]] = {}

    def passt(self, row: dict) -> bool:
        cur = str(row.get("currency") or "").upper()
        if not cur:
            # Ohne Währung ist der Beleg ein Datenfehler — er wird NICHT still
            # der Mandantenwährung zugeschlagen, sondern getrennt gezeigt.
            cur = "?"
        if cur == self.currency:
            return True
        eintrag = self._fremd.setdefault(cur, {"anzahl": 0, "netto": _NULL, "brutto": _NULL})
        eintrag["anzahl"] += 1
        eintrag["netto"] += _dec(row.get("net_amount"))
        eintrag["brutto"] += _dec(row.get("gross_amount"))
        return False

    def liste(self) -> list[Fremdwaehrung]:
        return [
            Fremdwaehrung(
                currency=c, anzahl=e["anzahl"], netto=_q(e["netto"]), brutto=_q(e["brutto"])
            )
            for c, e in sorted(self._fremd.items())
        ]


class BerichteService:
    """Alle Berichte sind auf `ctx.tenant_id` gescopet; kein Bericht schreibt."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------- Hilfen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise BerichteError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    @staticmethod
    def _heute() -> date:
        return datetime.now(UTC).date()

    def _waehrung(self, tenant_id: str) -> str:
        rows = (
            self._db.table("tenants").select("currency").eq("id", tenant_id).limit(1).execute()
        ).data or []
        cur = rows[0].get("currency") if rows else None
        if not cur:
            raise BerichteError(
                "Mandanten-Währung fehlt — bitte im Konto die Währung setzen.", status_code=422
            )
        return str(cur).upper()

    def _seiten(self, abfrage: Callable[[], Any]) -> list[dict]:
        """Alle Zeilen einer Abfrage in Seiten von `SEITE` — mit Deckel."""
        zeilen: list[dict] = []
        start = 0
        while True:
            teil = (abfrage().range(start, start + SEITE - 1).execute()).data or []
            zeilen.extend(teil)
            if len(teil) < SEITE:
                return zeilen
            start += SEITE
            if start >= MAX_ZEILEN:
                raise BerichteError(
                    f"Zu viele Belege im Zeitraum (über {MAX_ZEILEN}). "
                    "Bitte den Zeitraum verkleinern.",
                    status_code=422,
                )

    @staticmethod
    def _tabelle_fehlt(exc: APIError) -> bool:
        code = str(getattr(exc, "code", "") or "")
        text = str(getattr(exc, "message", "") or exc)
        return code == "42P01" or "does not exist" in text or code == "PGRST205"

    def _rechnungen(self, tenant_id: str, von: date, bis: date) -> list[dict]:
        """Ausgestellte Rechnungen (inkl. Storni) mit Belegdatum im Zeitraum."""
        rows = self._seiten(
            lambda: (
                self._db.table("invoices")
                .select(
                    "id, invoice_number, customer_id, reservation_id, invoice_type, status, "
                    "issue_date, due_date, currency, net_amount, tax_amount, gross_amount, "
                    "paid_amount, original_invoice_id"
                )
                .eq("tenant_id", tenant_id)
                .is_("deleted_at", "null")
                .neq("status", "draft")
                .gte("issue_date", von.isoformat())
                .lte("issue_date", bis.isoformat())
                .order("issue_date")
            )
        )
        return [r for r in rows if r.get("status") in AUSGESTELLT and r.get("invoice_number")]

    def _offene_rechnungen(self, tenant_id: str) -> list[dict]:
        rows = self._seiten(
            lambda: (
                self._db.table("invoices")
                .select(
                    "id, invoice_number, customer_id, status, issue_date, due_date, currency, "
                    "gross_amount, paid_amount, invoice_type"
                )
                .eq("tenant_id", tenant_id)
                .is_("deleted_at", "null")
                .in_("status", sorted(OFFEN))
                .order("due_date")
            )
        )
        return [r for r in rows if r.get("invoice_number")]

    def _ausgaben(self, tenant_id: str, von: date, bis: date) -> tuple[list[dict], bool]:
        """Ausgaben des Nachbarbereichs (0655). Fehlt die Tabelle: `([], False)`."""
        try:
            rows = self._seiten(
                lambda: (
                    self._db.table("expenses")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .gte("expense_date", von.isoformat())
                    .lte("expense_date", bis.isoformat())
                    .order("expense_date")
                )
            )
        except APIError as exc:
            if self._tabelle_fehlt(exc):
                log.warning("berichte_ausgaben_tabelle_fehlt", tenant_id=tenant_id)
                return [], False
            raise
        wirksam = [r for r in rows if str(r.get("payment_status") or "") not in AUSGABEN_UNWIRKSAM]
        return wirksam, True

    def _konten(self, tenant_id: str) -> tuple[dict[str, dict], bool]:
        """Buchungskonten des Nachbarbereichs (0671) je KONTONUMMER — die
        Ausgabe trägt die Nummer (`expenses.booking_account`), keine ID. Fehlt
        die Tabelle: `({}, False)`."""
        try:
            rows = self._seiten(
                lambda: self._db.table("booking_accounts").select("*").eq("tenant_id", tenant_id)
            )
        except APIError as exc:
            if self._tabelle_fehlt(exc):
                log.warning("berichte_konten_tabelle_fehlt", tenant_id=tenant_id)
                return {}, False
            raise
        return {str(r["number"]): r for r in rows if r.get("number")}, True

    def _namen(
        self, tabelle: str, tenant_id: str, ids: Iterable[str], spalten: str
    ) -> dict[str, dict]:
        """Zeilen per ID-Block laden — immer tenant-gescopet (Wurzel 3)."""
        rest = sorted({i for i in ids if i})
        ergebnis: dict[str, dict] = {}
        for i in range(0, len(rest), _IN_BLOCK):
            block = rest[i : i + _IN_BLOCK]
            rows = (
                self._db.table(tabelle)
                .select(spalten)
                .eq("tenant_id", tenant_id)
                .in_("id", block)
                .execute()
            ).data or []
            ergebnis.update({str(r["id"]): r for r in rows})
        return ergebnis

    # -------------------------------------------------------- Aggregation
    @staticmethod
    def _summen(rows: Iterable[dict]) -> tuple[Decimal, Decimal, int]:
        netto = brutto = _NULL
        anzahl = 0
        for r in rows:
            netto += _dec(r.get("net_amount"))
            brutto += _dec(r.get("gross_amount"))
            anzahl += 1
        return netto, brutto, anzahl

    def _aufwand_je_gruppe(
        self, ausgaben: list[dict], konten: dict[str, dict]
    ) -> dict[BwaGruppe, Decimal]:
        summen: dict[BwaGruppe, Decimal] = dict.fromkeys(BWA_GRUPPEN, _NULL)
        for a in ausgaben:
            konto = konten.get(str(a.get("booking_account") or ""))
            summen[bwa_gruppe(konto)] += _dec(a.get("net_amount"))
        return summen

    def _aufwand_zeilen(
        self,
        aktuell: dict[BwaGruppe, Decimal],
        vergleich: dict[BwaGruppe, Decimal],
        umsatz: Decimal,
    ) -> list[BwaZeile]:
        return [
            BwaZeile(
                key=g,
                label=_BWA_LABEL[g],
                aktuell=_q(aktuell[g]),
                vergleich=_q(vergleich[g]),
                veraenderung_prozent=_veraenderung(aktuell[g], vergleich[g]),
                prozent_vom_umsatz=_prozent(aktuell[g], umsatz),
            )
            for g in BWA_GRUPPEN
        ]

    # ------------------------------------------------------------ Berichte
    def overview(self, ctx: AuthContext, von: date | None, bis: date | None) -> OverviewResponse:
        tenant_id = self._tenant(ctx)
        zr = zeitraum_pruefen(von, bis)
        currency = self._waehrung(tenant_id)
        teiler = _Waehrungsteiler(currency)
        rechnungen = [r for r in self._rechnungen(tenant_id, zr.von, zr.bis) if teiler.passt(r)]
        ausgaben_alle, ausgaben_da = self._ausgaben(tenant_id, zr.von, zr.bis)
        ausgaben = [a for a in ausgaben_alle if teiler.passt(a)]
        netto, brutto, anzahl = self._summen(rechnungen)
        aus_netto, aus_brutto, aus_anzahl = self._summen(ausgaben)

        heute = self._heute()
        offen = ueberfaellig = _NULL
        ueberfaellig_anzahl = 0
        for r in self._offene_rechnungen(tenant_id):
            if str(r.get("currency") or "").upper() != currency:
                continue
            rest = _dec(r.get("gross_amount")) - _dec(r.get("paid_amount"))
            if rest <= 0:
                continue
            offen += rest
            faellig = _datum(r.get("due_date"))
            if faellig and faellig < heute:
                ueberfaellig += rest
                ueberfaellig_anzahl += 1

        kunden: dict[str | None, dict[str, Any]] = {}
        for r in rechnungen:
            k = kunden.setdefault(
                r.get("customer_id"), {"anzahl": 0, "netto": _NULL, "brutto": _NULL}
            )
            k["anzahl"] += 1
            k["netto"] += _dec(r.get("net_amount"))
            k["brutto"] += _dec(r.get("gross_amount"))
        top = sorted(kunden.items(), key=lambda kv: kv[1]["netto"], reverse=True)[:TOP_KUNDEN]
        namen = self._namen("customers", tenant_id, [k for k, _ in top if k], "id, name")
        top_kunden = [
            TopKunde(
                customer_id=k,
                name=str(namen.get(k or "", {}).get("name") or "") or "Ohne Kunde",
                anzahl=v["anzahl"],
                netto=_q(v["netto"]),
                brutto=_q(v["brutto"]),
            )
            for k, v in top
        ]
        log.info("berichte_overview", tenant_id=tenant_id, belege=anzahl, ausgaben=aus_anzahl)
        return OverviewResponse(
            zeitraum=zr,
            currency=currency,
            umsatz_netto=_q(netto),
            umsatz_brutto=_q(brutto),
            offene_forderungen=_q(offen),
            ueberfaellig=_q(ueberfaellig),
            ueberfaellig_anzahl=ueberfaellig_anzahl,
            ausgaben_netto=_q(aus_netto),
            ausgaben_brutto=_q(aus_brutto),
            ergebnis=_q(netto - aus_netto),
            anzahl_belege=anzahl,
            anzahl_storni=sum(1 for r in rechnungen if r.get("invoice_type") == "storno"),
            anzahl_ausgaben=aus_anzahl,
            top_kunden=top_kunden,
            fremdwaehrungen=teiler.liste(),
            ausgaben_verfuegbar=ausgaben_da,
        )

    def _reihen_schluessel(
        self, tenant_id: str, rechnungen: list[dict], by: Aufschluesselung | None
    ) -> dict[str, tuple[str, str]]:
        """Je Rechnungs-ID der Reihen-Schlüssel und sein Label."""
        if by is None:
            return {str(r["id"]): ("gesamt", "Gesamt") for r in rechnungen}
        if by == "customer":
            namen = self._namen(
                "customers", tenant_id, [r.get("customer_id") for r in rechnungen], "id, name"
            )
            return {
                str(r["id"]): (
                    str(r.get("customer_id") or "ohne"),
                    str(namen.get(str(r.get("customer_id") or ""), {}).get("name") or "Ohne Kunde"),
                )
                for r in rechnungen
            }
        reservierungen = self._namen(
            "reservations",
            tenant_id,
            [r.get("reservation_id") for r in rechnungen],
            "id, property_id, channel, ota_name",
        )
        if by == "property":
            objekte = self._namen(
                "properties",
                tenant_id,
                [v.get("property_id") for v in reservierungen.values()],
                "id, name",
            )
            ergebnis: dict[str, tuple[str, str]] = {}
            for r in rechnungen:
                res = reservierungen.get(str(r.get("reservation_id") or ""))
                pid = str(res.get("property_id") or "") if res else ""
                ergebnis[str(r["id"])] = (
                    pid or "ohne",
                    str(objekte.get(pid, {}).get("name") or "") or "Ohne Objekt",
                )
            return ergebnis
        ergebnis = {}
        for r in rechnungen:
            res = reservierungen.get(str(r.get("reservation_id") or ""))
            kanal = str(res.get("channel") or "") if res else ""
            label = str(res.get("ota_name") or "") if res else ""
            ergebnis[str(r["id"])] = (kanal or "ohne", label or kanal or "Ohne Buchung")
        return ergebnis

    def revenue(
        self,
        ctx: AuthContext,
        von: date | None,
        bis: date | None,
        gruppierung: Gruppierung,
        by: Aufschluesselung | None,
    ) -> RevenueResponse:
        tenant_id = self._tenant(ctx)
        zr = zeitraum_pruefen(von, bis)
        currency = self._waehrung(tenant_id)
        teiler = _Waehrungsteiler(currency)
        rechnungen = [r for r in self._rechnungen(tenant_id, zr.von, zr.bis) if teiler.passt(r)]
        perioden = perioden_im_zeitraum(zr.von, zr.bis, gruppierung)
        schluessel = self._reihen_schluessel(tenant_id, rechnungen, by)

        reihen: dict[str, dict[str, Any]] = {}
        for r in rechnungen:
            key, label = schluessel[str(r["id"])]
            reihe = reihen.setdefault(
                key,
                {"label": label, "punkte": {p: [_NULL, _NULL, 0] for p in perioden}},
            )
            tag = _datum(r.get("issue_date"))
            if tag is None:
                continue
            punkt = reihe["punkte"].setdefault(periode_von(tag, gruppierung), [_NULL, _NULL, 0])
            punkt[0] += _dec(r.get("net_amount"))
            punkt[1] += _dec(r.get("gross_amount"))
            punkt[2] += 1

        ergebnis = [
            Zeitreihe(
                key=key,
                label=reihe["label"],
                punkte=[
                    ZeitpunktWert(periode=p, netto=_q(w[0]), brutto=_q(w[1]), anzahl=w[2])
                    for p, w in sorted(reihe["punkte"].items())
                ],
                summe_netto=_q(sum((w[0] for w in reihe["punkte"].values()), _NULL)),
                summe_brutto=_q(sum((w[1] for w in reihe["punkte"].values()), _NULL)),
            )
            for key, reihe in reihen.items()
        ]
        ergebnis.sort(key=lambda z: z.summe_netto, reverse=True)
        return RevenueResponse(
            zeitraum=zr,
            currency=currency,
            gruppierung=gruppierung,
            aufschluesselung=by,
            perioden=perioden,
            reihen=ergebnis,
            fremdwaehrungen=teiler.liste(),
        )

    def bwa(self, ctx: AuthContext, von: date | None, bis: date | None) -> BwaResponse:
        tenant_id = self._tenant(ctx)
        zr = zeitraum_pruefen(von, bis)
        # Vergleichsperiode: gleich lang, unmittelbar davor.
        v_bis = zr.von - timedelta(days=1)
        v_von = v_bis - timedelta(days=zr.tage - 1)
        vzr = Zeitraum(von=v_von, bis=v_bis, tage=zr.tage)
        currency = self._waehrung(tenant_id)
        teiler = _Waehrungsteiler(currency)
        konten, konten_da = self._konten(tenant_id)

        def _periode(a: date, b: date) -> tuple[Decimal, dict[BwaGruppe, Decimal], bool]:
            rechnungen = [r for r in self._rechnungen(tenant_id, a, b) if teiler.passt(r)]
            ausgaben_alle, ausgaben_da = self._ausgaben(tenant_id, a, b)
            ausgaben = [x for x in ausgaben_alle if teiler.passt(x)]
            netto, _, _ = self._summen(rechnungen)
            return netto, self._aufwand_je_gruppe(ausgaben, konten), ausgaben_da

        umsatz, aufwand, ausgaben_da = _periode(zr.von, zr.bis)
        v_umsatz, v_aufwand, _ = _periode(v_von, v_bis)
        aufwand_summe = sum(aufwand.values(), _NULL)
        v_aufwand_summe = sum(v_aufwand.values(), _NULL)
        ergebnis = umsatz - aufwand_summe
        v_ergebnis = v_umsatz - v_aufwand_summe
        return BwaResponse(
            zeitraum=zr,
            vergleichszeitraum=vzr,
            currency=currency,
            erloese=BwaZeile(
                key="erloese",
                label="Umsatzerlöse",
                aktuell=_q(umsatz),
                vergleich=_q(v_umsatz),
                veraenderung_prozent=_veraenderung(umsatz, v_umsatz),
                prozent_vom_umsatz=_prozent(umsatz, umsatz),
            ),
            aufwand=self._aufwand_zeilen(aufwand, v_aufwand, umsatz),
            aufwand_gesamt=BwaZeile(
                key="aufwand",
                label="Gesamtkosten",
                aktuell=_q(aufwand_summe),
                vergleich=_q(v_aufwand_summe),
                veraenderung_prozent=_veraenderung(aufwand_summe, v_aufwand_summe),
                prozent_vom_umsatz=_prozent(aufwand_summe, umsatz),
            ),
            ergebnis=BwaZeile(
                key="ergebnis",
                label="Betriebsergebnis",
                aktuell=_q(ergebnis),
                vergleich=_q(v_ergebnis),
                veraenderung_prozent=_veraenderung(ergebnis, v_ergebnis),
                prozent_vom_umsatz=_prozent(ergebnis, umsatz),
            ),
            fremdwaehrungen=teiler.liste(),
            ausgaben_verfuegbar=ausgaben_da,
            konten_verfuegbar=konten_da,
        )

    def susa(self, ctx: AuthContext, von: date | None, bis: date | None) -> SusaResponse:
        """Summen- und Saldenliste: je Buchungskonto Soll (Aufwand aus Ausgaben)
        und Haben (Erlöse aus Rechnungen). Rechnungen tragen kein Konto und
        stehen in EINER Sammelzeile; Ausgaben ohne Konto ebenso. Schlüssel ist
        die Kontonummer (`expenses.booking_account`)."""
        tenant_id = self._tenant(ctx)
        zr = zeitraum_pruefen(von, bis)
        currency = self._waehrung(tenant_id)
        teiler = _Waehrungsteiler(currency)
        konten, konten_da = self._konten(tenant_id)
        rechnungen = [r for r in self._rechnungen(tenant_id, zr.von, zr.bis) if teiler.passt(r)]
        ausgaben_alle, ausgaben_da = self._ausgaben(tenant_id, zr.von, zr.bis)
        ausgaben = [a for a in ausgaben_alle if teiler.passt(a)]

        soll: dict[str, Decimal] = defaultdict(lambda: _NULL)
        haben: dict[str, Decimal] = defaultdict(lambda: _NULL)
        anzahl: dict[str, int] = defaultdict(int)
        for a in ausgaben:
            k = str(a.get("booking_account") or "") or "_ohne_aufwand"
            soll[k] += _dec(a.get("net_amount"))
            anzahl[k] += 1
        for r in rechnungen:
            # Rechnungen tragen (0023) kein Buchungskonto — Sammelzeile.
            k = str(r.get("booking_account") or "") or "_erloese"
            haben[k] += _dec(r.get("net_amount"))
            anzahl[k] += 1

        zeilen: list[SusaZeile] = []
        for k in sorted(set(soll) | set(haben), key=lambda x: (x.startswith("_"), x)):
            konto = konten.get(k)
            if k == "_erloese":
                name, nummer, typ = "Umsatzerlöse (ohne Kontozuordnung)", None, "INCOME"
            elif k == "_ohne_aufwand":
                name, nummer, typ = "Aufwand (ohne Kontozuordnung)", None, "EXPENSE"
            else:
                name = str((konto or {}).get("name") or "Konto nicht im Kontenplan")
                nummer = k
                typ = (konto or {}).get("type")
            zeilen.append(
                SusaZeile(
                    account_id=None if k.startswith("_") else (konto or {}).get("id"),
                    nummer=str(nummer) if nummer is not None else None,
                    name=name,
                    typ=str(typ) if typ else None,
                    soll=_q(soll[k]),
                    haben=_q(haben[k]),
                    saldo=_q(haben[k] - soll[k]),
                    anzahl=anzahl[k],
                )
            )
        zeilen.sort(key=lambda z: (z.nummer is None, z.nummer or "", z.name))
        s_soll = sum((z.soll for z in zeilen), _NULL)
        s_haben = sum((z.haben for z in zeilen), _NULL)
        return SusaResponse(
            zeitraum=zr,
            currency=currency,
            zeilen=zeilen,
            summe_soll=_q(s_soll),
            summe_haben=_q(s_haben),
            saldo=_q(s_haben - s_soll),
            fremdwaehrungen=teiler.liste(),
            ausgaben_verfuegbar=ausgaben_da,
            konten_verfuegbar=konten_da,
        )

    def guv(self, ctx: AuthContext, jahr: int) -> GuvResponse:
        tenant_id = self._tenant(ctx)
        zr = zeitraum_pruefen(date(jahr, 1, 1), date(jahr, 12, 31))
        currency = self._waehrung(tenant_id)
        teiler = _Waehrungsteiler(currency)
        konten, _ = self._konten(tenant_id)
        rechnungen = [r for r in self._rechnungen(tenant_id, zr.von, zr.bis) if teiler.passt(r)]
        ausgaben_alle, ausgaben_da = self._ausgaben(tenant_id, zr.von, zr.bis)
        ausgaben = [a for a in ausgaben_alle if teiler.passt(a)]

        erloese, _, _ = self._summen(rechnungen)
        aufwand = self._aufwand_je_gruppe(ausgaben, konten)
        aufwand_summe = sum(aufwand.values(), _NULL)

        monate: dict[str, list[Decimal]] = {f"{jahr}-{m:02d}": [_NULL, _NULL] for m in range(1, 13)}
        for r in rechnungen:
            tag = _datum(r.get("issue_date"))
            if tag:
                monate[periode_von(tag, "month")][0] += _dec(r.get("net_amount"))
        for a in ausgaben:
            tag = _datum(a.get("expense_date"))
            if tag:
                monate[periode_von(tag, "month")][1] += _dec(a.get("net_amount"))

        return GuvResponse(
            jahr=jahr,
            zeitraum=zr,
            currency=currency,
            erloese_netto=_q(erloese),
            aufwand=self._aufwand_zeilen(aufwand, dict.fromkeys(BWA_GRUPPEN, _NULL), erloese),
            aufwand_gesamt=_q(aufwand_summe),
            ergebnis=_q(erloese - aufwand_summe),
            monate=[
                GuvMonat(monat=m, erloese=_q(e), aufwand=_q(a), ergebnis=_q(e - a))
                for m, (e, a) in monate.items()
            ],
            fremdwaehrungen=teiler.liste(),
            ausgaben_verfuegbar=ausgaben_da,
        )

    def open_items(self, ctx: AuthContext) -> OpenItemsResponse:
        tenant_id = self._tenant(ctx)
        currency = self._waehrung(tenant_id)
        teiler = _Waehrungsteiler(currency)
        heute = self._heute()
        rows = self._offene_rechnungen(tenant_id)
        namen = self._namen(
            "customers", tenant_id, [r.get("customer_id") for r in rows], "id, name"
        )
        posten: list[OffenerPosten] = []
        buckets: dict[Bucket, list[Any]] = {b: [0, _NULL] for b in BUCKETS}
        for r in rows:
            offen = _dec(r.get("gross_amount")) - _dec(r.get("paid_amount"))
            if offen <= 0:
                continue
            if not teiler.passt(r):
                continue
            faellig = _datum(r.get("due_date"))
            alter = (heute - faellig).days if faellig else None
            bucket = bucket_fuer(alter)
            buckets[bucket][0] += 1
            buckets[bucket][1] += offen
            posten.append(
                OffenerPosten(
                    invoice_id=str(r["id"]),
                    invoice_number=r.get("invoice_number"),
                    customer_id=r.get("customer_id"),
                    customer_name=namen.get(str(r.get("customer_id") or ""), {}).get("name"),
                    issue_date=_datum(r.get("issue_date")),
                    due_date=faellig,
                    alter_tage=alter,
                    bucket=bucket,
                    gross_amount=_q(_dec(r.get("gross_amount"))),
                    paid_amount=_q(_dec(r.get("paid_amount"))),
                    offen=_q(offen),
                    currency=currency,
                    status=str(r.get("status") or ""),
                )
            )
        # Älteste Fälligkeit zuerst — nach Belegdatum, nie nach created_at.
        posten.sort(
            key=lambda p: (p.due_date is None, p.due_date or date.max, p.issue_date or date.max)
        )
        summe = sum((p.offen for p in posten), _NULL)
        return OpenItemsResponse(
            stichtag=heute,
            currency=currency,
            posten=posten,
            buckets=[
                BucketSumme(bucket=b, anzahl=w[0], offen=_q(w[1])) for b, w in buckets.items()
            ],
            summe_offen=_q(summe),
            anzahl=len(posten),
            fremdwaehrungen=teiler.liste(),
        )

    # ------------------------------------------------------------- Export
    def export_csv(
        self,
        ctx: AuthContext,
        report: Berichtsart,
        von: date | None,
        bis: date | None,
        gruppierung: Gruppierung,
        by: Aufschluesselung | None,
        jahr: int | None,
    ) -> Iterator[str]:
        """CSV-Zeilen eines Berichts als Generator (Semikolon, UTF-8 mit BOM,
        Beträge mit Punkt) — gedeckelt auf `CSV_MAX_ZEILEN`."""
        zeilen = self._csv_zeilen(ctx, report, von, bis, gruppierung, by, jahr)
        yield "﻿"
        puffer = io.StringIO()
        schreiber = csv.writer(puffer, delimiter=";", lineterminator="\n")
        for n, zeile in enumerate(zeilen):
            if n >= CSV_MAX_ZEILEN:
                schreiber.writerow([f"… gekürzt auf {CSV_MAX_ZEILEN} Zeilen"])
                yield puffer.getvalue()
                return
            schreiber.writerow(zeile)
            yield puffer.getvalue()
            puffer.seek(0)
            puffer.truncate(0)

    def _csv_zeilen(
        self,
        ctx: AuthContext,
        report: Berichtsart,
        von: date | None,
        bis: date | None,
        gruppierung: Gruppierung,
        by: Aufschluesselung | None,
        jahr: int | None,
    ) -> list[list[object]]:
        if report == "overview":
            o = self.overview(ctx, von, bis)
            zeilen: list[list[object]] = [["Kennzahl", "Wert", "Währung"]]
            zeilen += [
                ["Umsatz netto", o.umsatz_netto, o.currency],
                ["Umsatz brutto", o.umsatz_brutto, o.currency],
                ["Offene Forderungen", o.offene_forderungen, o.currency],
                ["Überfällig", o.ueberfaellig, o.currency],
                ["Ausgaben netto", o.ausgaben_netto, o.currency],
                ["Ergebnis", o.ergebnis, o.currency],
                ["Belege", o.anzahl_belege, ""],
                ["Storni", o.anzahl_storni, ""],
            ]
            return zeilen
        if report == "revenue":
            r = self.revenue(ctx, von, bis, gruppierung, by)
            zeilen = [["Reihe", "Periode", "Netto", "Brutto", "Belege", "Währung"]]
            for reihe in r.reihen:
                zeilen += [
                    [reihe.label, p.periode, p.netto, p.brutto, p.anzahl, r.currency]
                    for p in reihe.punkte
                ]
            return zeilen
        if report == "bwa":
            b = self.bwa(ctx, von, bis)
            zeilen = [
                ["Position", "Aktuell", "Vergleich", "Veränderung %", "% vom Umsatz", "Währung"]
            ]
            for z in [b.erloese, *b.aufwand, b.aufwand_gesamt, b.ergebnis]:
                zeilen.append(
                    [
                        z.label,
                        z.aktuell,
                        z.vergleich,
                        z.veraenderung_prozent,
                        z.prozent_vom_umsatz,
                        b.currency,
                    ]
                )
            return zeilen
        if report == "susa":
            s = self.susa(ctx, von, bis)
            zeilen = [
                ["Konto", "Bezeichnung", "Typ", "Soll", "Haben", "Saldo", "Belege", "Währung"]
            ]
            zeilen += [
                [
                    z.nummer or "",
                    z.name,
                    z.typ or "",
                    z.soll,
                    z.haben,
                    z.saldo,
                    z.anzahl,
                    s.currency,
                ]
                for z in s.zeilen
            ]
            return zeilen
        if report == "guv":
            if jahr is None:
                raise BerichteError("`year` ist Pflicht für die GuV.", status_code=422)
            g = self.guv(ctx, jahr)
            zeilen = [["Monat", "Erlöse", "Aufwand", "Ergebnis", "Währung"]]
            zeilen += [[m.monat, m.erloese, m.aufwand, m.ergebnis, g.currency] for m in g.monate]
            zeilen.append(["Gesamt", g.erloese_netto, g.aufwand_gesamt, g.ergebnis, g.currency])
            return zeilen
        op = self.open_items(ctx)
        zeilen = [
            [
                "Rechnung",
                "Kunde",
                "Belegdatum",
                "Fällig",
                "Alter (Tage)",
                "Bucket",
                "Brutto",
                "Bezahlt",
                "Offen",
                "Währung",
            ]
        ]
        zeilen += [
            [
                p.invoice_number or "",
                p.customer_name or "",
                p.issue_date.isoformat() if p.issue_date else "",
                p.due_date.isoformat() if p.due_date else "",
                "" if p.alter_tage is None else p.alter_tage,
                p.bucket,
                p.gross_amount,
                p.paid_amount,
                p.offen,
                p.currency,
            ]
            for p in op.posten
        ]
        return zeilen
