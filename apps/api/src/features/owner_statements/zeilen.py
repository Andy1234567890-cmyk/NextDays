"""Die Abrechnungszeilen — je Buchung die volle Kette als einzelne Posten.

Ausgezogen aus ``service.py`` am 02.09.2026, als die Zeilen um die
Einzelposten wuchsen (Gebühren, Zusatzleistungen, Vertragssatz je Zeile,
An-/Abreise). ``service.py`` stand da schon bei 2.800 Zeilen mit einer
``too-many-lines``-Ausnahme; die weiter auszureizen hieße, die Grenze
abzuschaffen. Der Schnitt liegt bewusst NICHT durch die Auszahlungsformel
(die bleibt in ``common.py``), sondern zwischen „Zeilen bauen" (hier) und
„Abrechnung verwalten" (Summen, Steuer, Storno, Nummer — dort).

Anlass für den Ausbau, wörtlich vom Betrieb: *„Jede Gebühr muss als
einzelner Posten aufgeschlüsselt werden auf der Abrechnung."* Vorher gab die
Zeile nur Summen heraus; „Gebühren +725,00" war eine Zahl ohne Herkunft.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows
from src.features.properties.gebuehren import FEE_TYPE_LABEL

from . import common, wiederkehrend
from .common import PayoutUnbekannt, buchungs_payout
from .fx import FxError
from .gebuehren_quelle import (
    GebuehrenBefund,
    gebuehren_der_buchung,
    klassifikation_laden,
)
from .payloads import csv_muster_je_objekt, payloads_laden
from .schemas import GebuehrZeile, RentalRow, WiederkehrenderPosten

if TYPE_CHECKING:
    from supabase import Client

    from src.features.auth.guest_masking import GuestMask

    from .fx import FxService
    from .service import StatementError

log = get_logger("nextdays.owner_statements.zeilen")

_CENT = Decimal("0.01")

# Sprache der Belegtexte. Das PDF ist heute durchgehend deutsch
# (`web/lib/statement-pdf.ts`); die Übersetzung des Belegs ist ein eigener
# Auftrag. Bis dahin gilt für mehrsprachige Namen (`reservation_addons.name`
# als jsonb) diese Sprache zuerst.
_BELEGSPRACHE = "de"


def _d(value: object) -> Decimal:
    return Decimal(str(value if value is not None else 0))


def _money(value: Decimal) -> float:
    return float(value.quantize(_CENT, rounding=ROUND_HALF_UP))


def _fehler(message: str, status_code: int) -> StatementError:
    """``StatementError`` ohne Import-Zyklus (``service`` importiert dieses Modul)."""
    from .service import StatementError  # noqa: PLC0415 — Zyklus vermeiden

    return StatementError(message, status_code=status_code)


@dataclass(frozen=True, slots=True)
class _GebuehrenKontext:
    """Die je Abrechnung EINMAL geladenen Bezugsdaten der Gebührenrechnung.

    `stammdaten` ist je `property_id` abgelegt, weil eine Abrechnung mehrere
    Objekte umfasst — im Portal-Kalender ist es genau eines.
    """

    klassifikation: dict[tuple[str, str | None], tuple[str, bool]]
    stammdaten: dict[str, dict[str, Any]]
    payloads: dict[str, Any]
    # Je Objekt gelerntes Portal-Verhalten für CSV-Buchungen ohne Zwilling
    # („im_betrag" | „obendrauf"), siehe `payloads.csv_muster_je_objekt`.
    csv_muster: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class _Zerlegung:
    """Schritt 1–2 der Kette EINER Buchung — alles, was OHNE Vertrag feststeht.

    Gebühren, Gastpreis und Portal-Abzug hängen an Buchung, Objekt und Kanal,
    nicht am Abrechnungsvertrag. Bis 02.09.2026 lief die Zerlegung trotzdem
    nur, wenn ein Vertrag am Stichtag galt: eine Buchung ohne Vertrag zeigte
    den nackten Übernachtungsbetrag als „Gastpreis" und darunter „Keine
    Gebühren oder Zusatzleistungen an dieser Buchung" — eine Falschaussage,
    denn Reinigung und Resort-Gebühr standen in den Stammdaten wie bei jeder
    anderen Buchung des Objekts. Die Zeile sah aus, als fehlten Gebühren, wo
    in Wahrheit der Vertrag fehlte.
    """

    befund: GebuehrenBefund
    basis: Decimal
    brutto: Decimal
    abzug: common.PortalAbzug
    naechte: int


@dataclass(frozen=True, slots=True)
class _Vertragslage:
    """Der Abrechnungsvertrag je Buchung — und wo keiner gilt, WARUM nicht.

    `regeln`: Buchungs-ID → geltender Vertrag am Stichtag (Check-out).
    `naechster_beginn`: Buchungs-ID → Beginn des ERSTEN Vertrags NACH dem
    Stichtag, nur für Buchungen ohne geltenden Vertrag. Damit unterscheidet
    die Zeile „kein Vertrag vorhanden" von „Vertrag beginnt erst später" —
    zwei verschiedene Handgriffe (Vertrag anlegen bzw. Beginn zurückdatieren),
    die bis 02.09.2026 unter derselben Meldung „kein Provisionssatz
    hinterlegt" liefen und den Betrieb in die Stammdaten schickten, wo nichts
    fehlte.
    """

    regeln: dict[str, common.Vertragsregeln]
    naechster_beginn: dict[str, date]


def addon_name(name: object) -> str:
    """Den Namen einer Zusatzleistung für den Beleg wählen.

    ``reservation_addons.name`` ist jsonb je Sprache. Erst die Belegsprache,
    sonst der ERSTE vorhandene Wert — nie ein erfundener Text. Ein leerer Name
    bleibt leer; der Aufrufer loggt den Datenmangel, damit er auffällt, statt
    ihn mit „Zusatzleistung" zu überdecken (Wurzel 4).
    """
    if isinstance(name, dict):
        bevorzugt = name.get(_BELEGSPRACHE)
        if isinstance(bevorzugt, str) and bevorzugt.strip():
            return bevorzugt.strip()
        for wert in name.values():
            if isinstance(wert, str) and wert.strip():
                return wert.strip()
        return ""
    if isinstance(name, str):
        return name.strip()
    return ""


def gebuehr_label(art: str, bezeichnungen: dict[str, str]) -> str:
    """Belegtext einer Gebühr: Portal-Originaltext vor Katalogname.

    Der Originaltext („Resortgebühr (Per night)") lässt den Betrieb den Posten
    im Extranet wiederfinden; der Katalogname (`FEE_TYPE_LABEL`) ist der
    Rückfall für Stammdaten-Gebühren. Fehlt beides, bleibt der interne
    Schlüssel stehen — sichtbar falsch statt still hübsch.
    """
    original = bezeichnungen.get(art)
    if isinstance(original, str) and original.strip():
        return original.strip()
    return FEE_TYPE_LABEL.get(art, art)


class ZeilenMixin:
    """Zeilen-Teil des ``OwnerStatementsService``: Reservierung → ``RentalRow``."""

    _db: Client
    _fx: FxService

    # --- Bezugsdaten ---------------------------------------------------------

    @staticmethod
    def _nights(check_in: str, check_out: str) -> int:
        try:
            return max(
                (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days,
                0,
            )
        except (TypeError, ValueError):
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
        return _GebuehrenKontext(
            klassifikation=klassifikation_laden(self._db, tenant_id),
            stammdaten=stammdaten,
            payloads=payloads_laden(self._db, tenant_id, reservations),
            csv_muster=csv_muster_je_objekt(self._db, tenant_id, property_ids),
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

    def _zerlegung_einer_buchung(
        self,
        r: dict,
        *,
        kontext: _GebuehrenKontext,
        portal_saetze: dict[str, dict[str, Any]],
    ) -> _Zerlegung:
        """Gebühren, Gastpreis und Portal-Abzug EINER Buchung — ohne Vertrag.

        Bewusst dieselbe Reihenfolge und dieselben Quellen wie
        `PublicPortalService._auszahlung_einer_buchung`; die Rechnung selbst
        liegt in `common`, damit beide Slices sie nicht auseinanderlaufen
        lassen können.

        Der ``GebuehrenBefund`` bleibt im Ergebnis: er trägt die Originaltexte
        des Portals je Gebührenart und die Quelle — beides braucht der Beleg,
        um jede Gebühr als eigenen Posten zu benennen.
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
            csv_muster=kontext.csv_muster.get(pid),
        )
        basis = befund.basisbetrag(r.get("total_amount"))
        # Der PORTAL-Gastpreis: ohne Zusatzleistungen, die kennt das Portal
        # nicht (`portal_brutto`). `addon_total` fließt nur als `extras` in die
        # Kette, damit die Zeile sie getrennt ausweisen kann.
        gast_brutto = common.portal_brutto(
            uebernachtung=basis,
            gebuehren=befund.gebuehren,
            gebuehren_im_betrag=befund.im_gesamtpreis,
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
        return _Zerlegung(
            befund=befund,
            basis=basis,
            brutto=gast_brutto,
            abzug=abzug,
            naechte=naechte,
        )

    @staticmethod
    def _kette_aus_zerlegung(
        zerlegung: _Zerlegung,
        *,
        regeln: common.Vertragsregeln,
        addon_total: Decimal,
        currency: str,
    ) -> common.Auszahlung:
        """Schritt 3–7 der Kette: die Zerlegung mit dem Vertrag zu Ende rechnen."""
        return common.auszahlung_berechnen(
            uebernachtung=zerlegung.basis,
            gebuehren=zerlegung.befund.gebuehren,
            gebuehren_im_betrag=zerlegung.befund.im_gesamtpreis,
            addon_total=addon_total,
            abzug=zerlegung.abzug,
            regeln=regeln,
            naechte=zerlegung.naechte,
            currency=currency,
        )

    def _auszahlung_einer_buchung(
        self,
        r: dict,
        *,
        regeln: common.Vertragsregeln,
        addon_total: Decimal,
        kontext: _GebuehrenKontext,
        portal_saetze: dict[str, dict[str, Any]],
        currency: str,
    ) -> tuple[common.Auszahlung, GebuehrenBefund]:
        """Die volle Kette für EINE Abrechnungszeile (Zerlegung + Vertrag)."""
        zerlegung = self._zerlegung_einer_buchung(
            r, kontext=kontext, portal_saetze=portal_saetze
        )
        ergebnis = self._kette_aus_zerlegung(
            zerlegung, regeln=regeln, addon_total=addon_total, currency=currency
        )
        return ergebnis, zerlegung.befund

    def _vertraege_je_buchung(
        self, tenant_id: str, reservations: list[dict]
    ) -> _Vertragslage:
        """Der geltende Abrechnungsvertrag JE BUCHUNG (0343, Umstiegsschritt 1).

        Stichtag ist der Check-out der Buchung — derselbe Stichtag, den
        ``_rental_rows`` schon für den Währungskurs benutzt. Ein im September
        erzeugtes Juli-Statement rechnet damit mit dem Juli-Vertrag; über
        ``date.today()`` ergäbe dieselbe Abrechnung je Erzeugungstag eine andere
        Zahl.

        Buchungen mit gleichem (Objekt, Check-out) teilen sich die Auflösung.
        Objekte ohne Eigentümer-Datensatz oder ohne Vertrag am Stichtag fehlen
        in ``regeln``; der Aufrufer fällt dann auf die Altspalten zurück.
        Fehlt der Vertrag am Stichtag, steht in ``naechster_beginn``, ob und
        wann NACH dem Stichtag einer beginnt — die Zeile nennt dann das Datum
        statt „kein Satz hinterlegt" (live 02.09.2026: Vertrag ab 12.08.,
        Abreise 09.08., Meldung zeigte auf die falsche Maske).
        """
        if not reservations:
            return _Vertragslage(regeln={}, naechster_beginn={})
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
        beginn_gecacht: dict[tuple[str, str], date | None] = {}
        out: dict[str, common.Vertragsregeln] = {}
        naechster_beginn: dict[str, date] = {}
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
                if zeile is None:
                    beginn_gecacht[schluessel] = billing.naechster_vertragsbeginn(
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
                    raise _fehler(
                        f"Ungültiger Abrechnungsvertrag für Objekt {pid}: "
                        f"{exc.message}",
                        422,
                    ) from exc
            regeln = gecacht[schluessel]
            if regeln is not None:
                out[str(r["id"])] = regeln
            elif beginn_gecacht.get(schluessel) is not None:
                naechster_beginn[str(r["id"])] = beginn_gecacht[schluessel]
        return _Vertragslage(regeln=out, naechster_beginn=naechster_beginn)

    # --- Zusatzleistungen ----------------------------------------------------

    def _addon_zeilen(self, reservation_ids: list[str]) -> dict[str, list[dict]]:
        """Zusatzleistungen je Reservierung — EINZELN, nicht als Summe.

        Zählt pending UND paid (ohne Stripe gilt „zahlbar bei Anreise" — der
        Umsatz ist dennoch entstanden); cancelled bleibt außen vor. Die Summe
        für die Kette (`addon_total`) bildet der Aufrufer aus diesen Zeilen,
        damit Liste und Summe nicht auseinanderlaufen können.

        Bis 02.09.2026 hieß diese Methode `_addon_sums` und verschluckte JEDEN
        Fehler („fehlende Tabelle = kein Extra-Umsatz"). Das war ein stiller
        Fehler auf einem geldbewegenden Pfad (Wurzel 5): eine Abrechnung ohne
        die Zusatzleistungen ist zu niedrig und sieht vollständig aus. Jetzt
        wird ein DB-Fehler als 502 gemeldet.
        """
        ids = [r for r in reservation_ids if r]
        if not ids:
            return {}
        try:
            # VOLLSTÄNDIG paginiert (fetch_all_rows) wie _reservations(): der
            # Add-on-Umsatz fließt in payout/owner_payout des finalisierten
            # Statements. Ein stiller 1000-Zeilen-Cap (PGRST_DB_MAX_ROWS) hätte
            # bei vielen Add-ons über viele Reservierungen einen zu niedrigen,
            # aber nummerierten Auszahlungsbetrag ergeben.
            rows = fetch_all_rows(
                self._db.table("reservation_addons")
                .select("id, reservation_id, name, qty, price, basis, total, status")
                .in_("reservation_id", ids)
                .order("id")
            )
        except APIError as exc:
            log.error("statement_addons_unavailable", error=str(exc))
            raise _fehler(
                "Die Zusatzleistungen der Buchungen konnten nicht geladen "
                "werden — die Abrechnung wäre ohne sie zu niedrig.",
                502,
            ) from exc
        out: dict[str, list[dict]] = {}
        for a in rows:
            if (a.get("status") or "pending") == "cancelled":
                continue
            out.setdefault(str(a["reservation_id"]), []).append(a)
        return out

    @staticmethod
    def _addon_gebuehr_zeilen(
        addons: list[dict], reservation_id: str, mask: GuestMask
    ) -> list[GebuehrZeile]:
        """Zusatzleistungen als Posten. Sie gehören dem BETRIEB (02.09.2026),
        ihr Betrag ist deshalb wie `total_price` maskiert."""
        out: list[GebuehrZeile] = []
        for a in addons:
            label = addon_name(a.get("name"))
            if not label:
                log.warning(
                    "abrechnung_addon_ohne_namen",
                    reservation_id=reservation_id,
                    addon_id=str(a.get("id") or ""),
                )
            qty = a.get("qty")
            out.append(
                GebuehrZeile(
                    art="addon",
                    label=label,
                    betrag=mask.amount(_money(_d(a.get("total")))),
                    gehoert_zu="betrieb",
                    provisionspflichtig=False,
                    quelle="addon",
                    menge=int(qty) if qty is not None else None,
                    einzelpreis=(
                        mask.amount(_money(_d(a.get("price"))))
                        if a.get("price") is not None
                        else None
                    ),
                    basis=(str(a.get("basis")) if a.get("basis") else None),
                )
            )
        return out

    @staticmethod
    def _gebuehr_zeilen(
        gebuehren: tuple[common.Gebuehr, ...],
        befund: GebuehrenBefund,
        mask: GuestMask,
    ) -> list[GebuehrZeile]:
        """Die Gebühren als Posten — genau die Liste, mit der gerechnet wurde
        (`kette.gebuehren`; ohne Vertrag die der Zerlegung), nicht eine zweite.

        Maske: Gebühren des BETRIEBS und Durchlauf-Posten (Kurtaxe, Kaution)
        sind Bestandteile des Gastpreises und laufen durch `mask.amount`; die
        des EIGENTÜMERS sind seine eigene Zahl und bleiben sichtbar.
        """
        out: list[GebuehrZeile] = []
        for g in gebuehren:
            betrag = _money(g.betrag)
            out.append(
                GebuehrZeile(
                    art=g.art,
                    label=gebuehr_label(g.art, befund.bezeichnungen),
                    betrag=(
                        betrag if g.gehoert_zu == "eigentuemer" else mask.amount(betrag)
                    ),
                    gehoert_zu=g.gehoert_zu,
                    provisionspflichtig=g.provisionspflichtig,
                    quelle=befund.quelle,
                )
            )
        return out

    # --- Wiederkehrende Posten (0365) ----------------------------------------

    def _wiederkehrende_posten(
        self,
        tenant_id: str,
        owner_id: str,
        rental_rows: list[RentalRow],
        owner_currency: str,
    ) -> list[WiederkehrenderPosten]:
        """Die Dauervereinbarungen des Eigentümers, ausgerechnet für DIESE Zeilen.

        Bis 02.09.2026 las nur der Bericht (`owner_reporting`) diese Tabelle;
        die Abrechnung kannte sie nicht — der Betrieb legte die 50 DKK je
        Buchung deshalb von Hand als Verrechnungsposten an, zusätzlich zur
        Vertragspauschale (doppelt abgezogen, 20.08.2026).

        Die Rechnung liegt in `wiederkehrend.posten_betraege` und ist dieselbe
        wie im Bericht. Die Bezugsmenge sind die Zeilen dieser Abrechnung —
        also genau die Buchungen, die `basis` und Zeitraum bestimmt haben.

        Währung: die Posten fließen UNUMGERECHNET in die Auszahlung (Owner-
        Währung), wie die Verrechnungsposten (`_pruefe_posten_waehrung`). Passt
        sie nicht, ist das ein 422 mit Postenname — kein Kurs 1,0.
        """
        rows = fetch_all_rows(
            self._db.table("owner_recurring_items")
            .select("id, label, abschnitt, modus, betrag, currency, property_id, aktiv")
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
            .eq("aktiv", True)
            .order("id")
        )
        if not rows:
            return []
        mengen = wiederkehrend.bezugsmenge(
            [(r.listing_id, r.nights) for r in rental_rows]
        )
        try:
            berechnet = wiederkehrend.posten_betraege(rows, mengen, owner_currency)
        except wiederkehrend.WiederkehrendFehler as exc:
            raise _fehler(exc.message, 422) from exc
        out: list[WiederkehrenderPosten] = []
        for zeile, anzahl, wert in berechnet:
            abschnitt = str(zeile.get("abschnitt") or "")
            vorzeichen = -1 if wiederkehrend.ist_abzug(abschnitt) else 1
            pid = zeile.get("property_id")
            out.append(
                WiederkehrenderPosten(
                    item_id=str(zeile["id"]),
                    label=str(zeile.get("label") or ""),
                    abschnitt=abschnitt,
                    modus=str(zeile.get("modus") or ""),
                    einzelbetrag=_money(_d(zeile.get("betrag"))),
                    anzahl=anzahl,
                    betrag=_money(wert * vorzeichen),
                    currency=str(zeile.get("currency") or "").upper(),
                    property_id=str(pid) if pid else None,
                )
            )
        log.info(
            "abrechnung_wiederkehrend_posten",
            tenant_id=tenant_id,
            owner_id=owner_id,
            anzahl=len(out),
            summe=_money(sum((_d(p.betrag) for p in out), Decimal("0"))),
            currency=owner_currency,
        )
        return out

    # --- Die Zeilen ----------------------------------------------------------

    def _rental_rows(  # noqa: PLR0913, PLR0912, PLR0915 — Bezugsdaten und Kette einer Zeile
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

        Seit 02.09.2026 trägt jede Zeile ihre Gebühren und Zusatzleistungen
        EINZELN (`gebuehren`), den Satz und Vertragsstichtag, mit dem sie
        gerechnet wurde, sowie An-/Abreise und den echten Portalnamen.
        """
        guest_names = self._guest_names(
            [str(r["guest_id"]) for r in reservations if r.get("guest_id")]
        )
        addons_je_buchung = self._addon_zeilen([str(r["id"]) for r in reservations])
        cmap = commission_map or {}
        # Abrechnungsvertrag (0343) je Buchung, Stichtag = Check-out. Er schlägt
        # die Altspalten, aber NICHT den manuellen Editor-Override: wer in der
        # Maske einen Satz einträgt, korrigiert bewusst diese eine Abrechnung.
        vertragslage = self._vertraege_je_buchung(tenant_id, reservations)
        vertraege = vertragslage.regeln
        # Gebühren-Bezugsdaten und Portal-Sätze EINMAL je Abrechnung laden —
        # dieselben Quellen wie im Eigentümer-Portal (0364).
        kontext = self._gebuehren_kontext(tenant_id, reservations)
        portal_saetze = self._portal_saetze_je_buchung(tenant_id, reservations)
        rows: list[RentalRow] = []
        gebuehren_gesamt = 0
        quellen: dict[str, int] = {}
        for r in reservations:
            rid = str(r["id"])
            listing_id = str(r["property_id"])
            src_currency = (r.get("currency") or owner_currency).upper()
            # Zusatzleistungen: die Summe für die Kette entsteht aus DENSELBEN
            # Zeilen, die der Beleg einzeln zeigt — Liste und Summe können so
            # nicht auseinanderlaufen.
            addons = addons_je_buchung.get(rid, [])
            addon_total = sum((_d(a.get("total")) for a in addons), Decimal("0"))
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
            regeln = vertraege.get(rid)
            pct = override if override is not None else cmap.get(listing_id)
            provision_quelle: str | None
            if override is not None:
                provision_quelle = "override"
            elif regeln is not None:
                provision_quelle = "vertrag"
            elif pct is not None:
                provision_quelle = "altspalten"
            else:
                provision_quelle = None
            # Warum eine Zeile ihre Auszahlung nicht ausweisen kann — als
            # maschinenlesbarer Grund, den die UI benennt.
            grund: str | None = None
            # WAS konkret fehlt, im Klartext des Servers (z. B. welche
            # Gebührenart). Läuft neben `grund`, weil der Grund nur die KLASSE
            # des Mangels nennt: bei 49 Gebührenarten hilft „eine Art ist nicht
            # zugeordnet" niemandem beim Suchen. Bis 03.09.2026 stand dieser
            # Text NUR im Log (`detail=exc.message`) — die Oberfläche bekam ihn
            # nie, und die Rückfrage „welche denn?" war nicht beantwortbar.
            detail: str | None = None
            # Die Kettenglieder der Auszahlung. `None` bleibt bestehen, wenn die
            # Kette nicht lief (Override, Altspalten) oder abbrach — nie 0.
            kette: common.Auszahlung | None = None
            # Schritt 1–2 (Gebühren, Gastpreis, Portal-Abzug) stehen auch OHNE
            # Vertrag fest und werden ausgewiesen; nur Schritt 3–7 brauchen ihn.
            zerlegung: _Zerlegung | None = None
            # Beginn des nächsten Vertrags, wenn am Stichtag keiner gilt — der
            # Handgriff heißt dann „Vertragsbeginn zurückdatieren".
            vertrag_beginnt_am: date | None = None
            # Auch die ALTSPALTE (Prozentsatz am Eigentümer/Objekt, kein
            # Vertrag) läuft durch die Zerlegung: sie ist ein Provisionssatz
            # ohne Mindestprovision und Pauschale, rechnerisch also ein
            # Vertrag mit nur einem Feld. Bis 02.09.2026 nahm sie den alten
            # Pfad (`common.owner_payout`), und die Zeile zeigte für eine
            # Live-Portalbuchung mit vollständiger Aufstellung „Keine Gebühren
            # an dieser Buchung" — Rævlingehuset 09.–13.09.: 4.415 DKK, davon
            # 100 Resort (Eigentümer) und 955 Reinigung (Betrieb) im Payload,
            # der Eigentümer bekam 80 % von allem, auch von der Reinigung.
            rechenregeln: common.Vertragsregeln | None = regeln
            if rechenregeln is None and pct is not None:
                rechenregeln = common.Vertragsregeln(provisions_pct=_d(pct))
            if override is None:
                # VOLLE Kette wie im Eigentümer-Portal (0364): Gebühren in den
                # Gastpreis, Portal-Abzug, provisionsfreie Gebühren aus der
                # Bemessung, die des Eigentümers zu 100 % zurück. Rechnete die
                # Abrechnung hier anders als der Kalender, stritten sich zwei
                # Zahlen über dasselbe Geld — genau was `common` verhindert.
                #
                # OHNE Vertrag (und ohne Altspalte) läuft die Zerlegung
                # trotzdem: Gastpreis, Gebühren und Portal-Abzug hängen nicht
                # am Vertrag. Bis 02.09.2026 zeigte eine solche Zeile den
                # nackten Übernachtungsbetrag als Gastpreis und „Keine
                # Gebühren an dieser Buchung" — obwohl Reinigung und Resort in
                # den Stammdaten standen. Nur der Eigentümer-Anteil ist ohne
                # Vertrag unbestimmt, und die Zeile sagt, WARUM: Vertrag fehlt
                # ganz („provision") oder beginnt erst nach der Abreise
                # („provision_zeitraum" + Datum).
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
                owner_payout = None
                if rechenregeln is None:
                    # Der Vertrag fehlt — das ist der ERSTE Handgriff, egal ob
                    # die Zerlegung darunter noch an etwas anderem scheitert.
                    # Ein „Portal-Satz fehlt" statt „Vertrag fehlt" schickte
                    # den Betrieb erst in die Abrechnungsregeln und dann doch
                    # zum Vertrag.
                    vertrag_beginnt_am = vertragslage.naechster_beginn.get(rid)
                    grund = (
                        "provision_zeitraum"
                        if vertrag_beginnt_am is not None
                        else "provision"
                    )
                    detail = (
                        f"Objekt {listing_id}: Abrechnungsvertrag beginnt erst am "
                        f"{vertrag_beginnt_am.isoformat()}."
                        if vertrag_beginnt_am is not None
                        else f"Objekt {listing_id}: kein Abrechnungsvertrag "
                        "und kein Provisionssatz hinterlegt."
                    )
                    log.warning(
                        "abrechnung_zeile_ohne_vertrag",
                        reservation_id=rid,
                        property_id=listing_id,
                        stichtag=r.get("check_out"),
                        naechster_vertragsbeginn=(
                            vertrag_beginnt_am.isoformat()
                            if vertrag_beginnt_am
                            else None
                        ),
                        grund=grund,
                    )
                try:
                    zerlegung = self._zerlegung_einer_buchung(
                        r,
                        kontext=kontext,
                        portal_saetze=portal_saetze,
                    )
                    # Der GASTPREIS ist der Bruttoumsatz inkl. Gebühren —
                    # vorher stand hier nur Übernachtung + Extras, also weniger
                    # als der Gast gezahlt hat.
                    price = zerlegung.brutto
                    if rechenregeln is not None:
                        kette = self._kette_aus_zerlegung(
                            zerlegung,
                            regeln=rechenregeln,
                            addon_total=addon_total,
                            currency=src_currency,
                        )
                except PayoutUnbekannt as exc:
                    if regeln is None and pct is not None:
                        # ALTSPALTE, Kette nicht rechenbar (kein Portal-Satz,
                        # Gebührenart nicht zugeordnet): Bestandsschutz — der
                        # Satz gilt wie vor 02.09.2026 auf den Payout, statt
                        # dass eine bis dahin berechenbare Zeile plötzlich leer
                        # steht. Ohne Portal-Satz gibt es auch keine Gebühren-
                        # Zerlegung; die Zeile zeigt dann, was sie zeigen kann.
                        owner_payout = common.owner_payout(payout, pct)
                        log.info(
                            "abrechnung_altspalte_ohne_kette",
                            reservation_id=rid,
                            grund=exc.grund,
                            detail=exc.message,
                        )
                    else:
                        # Ohne Vertrag bleibt der Vertrags-Grund stehen (erster
                        # Handgriff); der zweite Mangel steht im Log.
                        if grund is None:
                            grund = exc.grund
                            detail = exc.message
                        log.warning(
                            "abrechnung_zeile_unbestimmt",
                            reservation_id=rid,
                            grund=exc.grund,
                            detail=exc.message,
                            vertrag_fehlt=rechenregeln is None,
                        )
                else:
                    if kette is not None and rechenregeln is not None:
                        owner_payout = kette.netto
                        # Für die ANZEIGE (`commission_pct`) bleibt der Satz
                        # maßgeblich, mit dem GERECHNET wurde — Vertrag oder
                        # Altspalte; nie ein Satz aus einer anderen Spalte.
                        pct = rechenregeln.provisions_pct
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
                    raise _fehler(
                        "Reservierung ohne Check-out-Datum kann nicht in die "
                        "Owner-Währung umgerechnet werden.",
                        422,
                    )
                try:
                    rate = self._fx.get_rate(fx_date, src_currency, owner_currency)
                except FxError as exc:
                    raise _fehler(str(exc), 502) from exc
            owner_payout_conv = (
                owner_payout * rate if owner_payout is not None else None
            )
            # Herkunft der Gebühren: aus der GERECHNETEN Zerlegung, wenn sie
            # lief — sie kennt Stammdaten und Nächte, die die reine Auskunft
            # (`_gebuehren_herkunft`) absichtlich nicht hat. Sonst stünde bei
            # einer CSV-Buchung mit abgeleiteter Reinigung „Aufstellung fehlt".
            herkunft = (
                (zerlegung.befund.quelle, zerlegung.befund.grund)
                if zerlegung is not None
                else self._gebuehren_herkunft(r, kontext)
            )

            # JEDE Gebühr und JEDE Zusatzleistung als eigener Posten. Die
            # Gebühren kommen aus der Zerlegung (nur wenn sie lief — die Kette
            # rechnet mit GENAU dieser Liste weiter), die Zusatzleistungen
            # stehen unabhängig davon fest.
            gebuehr_zeilen: list[GebuehrZeile] = []
            gebuehren_liste: tuple[common.Gebuehr, ...] | None = None
            if kette is not None:
                gebuehren_liste = kette.gebuehren
            elif zerlegung is not None:
                gebuehren_liste = tuple(zerlegung.befund.gebuehren)
            if gebuehren_liste is not None and zerlegung is not None:
                gebuehr_zeilen.extend(
                    self._gebuehr_zeilen(gebuehren_liste, zerlegung.befund, mask)
                )
            gebuehr_zeilen.extend(self._addon_gebuehr_zeilen(addons, rid, mask))
            gebuehren_gesamt += len(gebuehr_zeilen)
            for z in gebuehr_zeilen:
                quellen[z.quelle] = quellen.get(z.quelle, 0) + 1
            log.debug(
                "abrechnung_zeile_gebuehren",
                reservation_id=rid,
                anzahl=len(gebuehr_zeilen),
                quelle=herkunft[0],
            )
            # Kontrollsummen zur Liste — aus der KETTE, nicht aus der Liste
            # nachgerechnet: ein Test erzwingt, dass beide übereinstimmen.
            geb_betrieb: Decimal | None = None
            geb_durchlauf: Decimal | None = None
            if gebuehren_liste is not None:
                geb_betrieb = sum(
                    (g.betrag for g in gebuehren_liste if g.gehoert_zu == "betrieb"),
                    Decimal("0"),
                )
                geb_durchlauf = sum(
                    (g.betrag for g in gebuehren_liste if g.gehoert_zu == "durchlauf"),
                    Decimal("0"),
                )
            # Portal-Abzug und Auszahlungsbasis stehen mit der Zerlegung fest —
            # auch ohne Vertrag. Der Eigentümer-Anteil dagegen erst mit Kette.
            abzug = zerlegung.abzug if zerlegung is not None else None

            check_in = r.get("check_in")
            rows.append(
                RentalRow(
                    reservation_id=rid,
                    guest=mask.name(guest_names.get(str(r.get("guest_id")))),
                    nights=self._nights(check_in, checkout),
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
                    payout_unbekannt_detail=(
                        None if owner_payout is not None else detail
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
                        mask.amount(_money(abzug.provision))
                        if abzug is not None
                        else None
                    ),
                    portal_zahlungsgebuehr=(
                        mask.amount(_money(abzug.zahlungsgebuehr))
                        if abzug is not None
                        else None
                    ),
                    # UNMASKIERT — bewusst. Der Eigentuemer sieht als
                    # Gesamtbetrag seiner Buchung den Betrag NACH Portal-Abzug
                    # (Entscheidung Betrieb 02.09.2026): weder Gastpreis noch
                    # die Portalabzuege einzeln, aber den Ausgangspunkt seiner
                    # Kette. Ohne ihn waere „− Provision … = Anteil" eine
                    # Rechnung ohne ersten Summanden.
                    auszahlungsbasis=(
                        _money(zerlegung.brutto - zerlegung.abzug.gesamt)
                        if zerlegung is not None
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
                    # --- Einzelposten (02.09.2026) ---
                    check_in=date.fromisoformat(check_in) if check_in else None,
                    check_out=date.fromisoformat(checkout) if checkout else None,
                    ota_name=(r.get("ota_name") or None),
                    gebuehren=gebuehr_zeilen,
                    gebuehren_betrieb=(
                        mask.amount(_money(geb_betrieb))
                        if geb_betrieb is not None
                        else None
                    ),
                    gebuehren_durchlauf=(
                        mask.amount(_money(geb_durchlauf))
                        if geb_durchlauf is not None
                        else None
                    ),
                    addon_total=mask.amount(_money(addon_total)),
                    provisions_pct=float(pct) if pct is not None else None,
                    provision_quelle=provision_quelle if pct is not None else None,
                    vertrag_gueltig_ab=(
                        regeln.gueltig_ab
                        if regeln is not None and provision_quelle == "vertrag"
                        else None
                    ),
                    vertrag_beginnt_am=vertrag_beginnt_am,
                    min_provision_angewandt=(
                        kette.min_provision_angewandt if kette is not None else False
                    ),
                )
            )
        log.info(
            "abrechnung_zeilen_gebaut",
            tenant_id=tenant_id,
            zeilen=len(rows),
            gebuehren_posten=gebuehren_gesamt,
            quellen=quellen,
        )
        return rows
