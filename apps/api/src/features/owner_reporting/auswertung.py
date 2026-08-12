"""Auswertung eines Berichts-Scopes — die eine Stelle, die aus Buchungen Zahlen macht.

Aus ``service.py`` herausgelöst, weil hier zwei verschiedene Dinge passieren:
das LESEN der Bezugsdaten (Buchungen, Objekt-Stammdaten, OTA-Payloads, Kurse)
und das GRUPPIEREN des Ergebnisses (je Objekt, je Gebührenart, je Kanal). Beides
ist unabhängig von Berichts-CRUD, Zahlungen und Plänen — und nur so bleibt die
Rechenkette an einer Stelle prüfbar, statt zwischen Endpunkten verstreut.

Die Formel selbst steht NICHT hier, sondern in ``owner_statements.common``:
Portal-Abzug → provisionsfreie Gebühren raus → Verwaltungsprovision → Pauschale
→ Eigentümer-Gebühren zurück. Eine zweite Formel an dieser Stelle hieße, dass
Abrechnung und Bericht über denselben Zeitraum verschiedene Beträge zeigen.

MEHRWÄHRUNG: Ein Bericht hat GENAU EINE Währung. Buchungen in anderer Währung
werden mit dem ECB-Tageskurs am Check-out umgerechnet (``owner_statements.fx``,
derselbe Dienst und Cache wie die Abrechnung). Lässt sich ein Kurs nicht
beschaffen, fällt die Buchung mit einer BENANNTEN Warnung heraus — nie mit
Kurs 1,0 weitergerechnet (Wurzel 4).

WARNUNGEN STATT STILLER LÜCKEN (Wurzel 5): fehlender Provisionssatz, nicht
zugeordnete Gebühr, fehlender Kurs — die Buchung wird nicht kommentarlos
übersprungen, sondern erscheint in ``Auswertung.warnungen``. Ein stiller
Ausschluss ergäbe eine zu niedrige, aber nummerierte und damit unverdächtige
Summe.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows
from src.features.owner_billing.service import OwnerBillingService
from src.features.owner_statements import common
from src.features.owner_statements.common import PayoutUnbekannt
from src.features.owner_statements.fx import FxError, FxService
from src.features.owner_statements.gebuehren_quelle import (
    gebuehren_der_buchung,
    klassifikation_laden,
)
from src.features.properties.gebuehren import FEE_TYPE_LABEL

from .schemas import GebuehrZeile, KanalZeile, MietZeile, ZahlungsartZeile

log = get_logger("nextdays.owner_reporting.auswertung")

CENT = Decimal("0.01")
NULL = Decimal("0")

RES_COLUMNS = (
    "id, property_id, guest_id, channel, ota_name, check_in, check_out, "
    "status, total_amount, paid_amount, channel_fee, currency, num_guests, "
    "external_ref, source_channex_booking_id, ota_commission, "
    "payment_collect, payment_method_ota, ota_withheld_taxes, booked_at, pets"
)


def f(value: Decimal) -> float:
    """Auf den Cent gerundet an die API-Grenze. Gerechnet wird in Decimal."""
    return float(value.quantize(CENT, rounding=ROUND_HALF_UP))


def d(value: object) -> Decimal:
    return common.zu_decimal(value) or NULL


def iso(value: object) -> str | None:
    return str(value) if value else None


def naechte_zwischen(check_in: object, check_out: object) -> int:
    try:
        return max(
            (
                date.fromisoformat(str(check_out))
                - date.fromisoformat(str(check_in))
            ).days,
            0,
        )
    except (ValueError, TypeError):
        return 0


@dataclass(slots=True)
class Buchung:
    """Eine ausgewertete Buchung, bereits in die Berichtswährung umgerechnet.

    ``portal_provision``/``portal_zahlungsgebuehr``/``einnahmen`` sind ``None``,
    wenn der Portal-Abzug nicht bestimmbar ist (kein Satz hinterlegt und keine
    gemeldete Provision). Dann ist die Buchung mit allem, was FESTSTEHT, im
    Bericht — Miete, Gebühren, Extras, Steuern, Brutto —, und nur die
    abhängigen Größen bleiben leer. Eine 0 stünde hier für „das Portal hat
    nichts einbehalten" und schenkte dem Eigentümer den Portal-Anteil als
    Ertrag (Wurzel 4); die Buchung ganz weglassen hieße, ein
    Konfigurationsloch als leeren Monat auszugeben.
    """

    row: dict[str, Any]
    naechte: int
    gaeste: int
    miete: Decimal
    gebuehren: list[tuple[str, Decimal]]
    gebuehren_summe: Decimal
    addons: Decimal
    steuern: Decimal
    portal_provision: Decimal | None
    portal_zahlungsgebuehr: Decimal | None
    brutto: Decimal
    einnahmen: Decimal | None
    offen: Decimal
    auszahlung: common.Auszahlung | None

    @property
    def portal_abzug_gesamt(self) -> Decimal | None:
        """Was das Portal einbehält — ``None``, solange es unbekannt ist."""
        if self.portal_provision is None or self.portal_zahlungsgebuehr is None:
            return None
        return self.portal_provision + self.portal_zahlungsgebuehr


@dataclass(slots=True)
class Auswertung:
    currency: str
    buchungen: list[Buchung] = field(default_factory=list)
    warnungen: list[str] = field(default_factory=list)
    property_names: dict[str, str] = field(default_factory=dict)
    guest_names: dict[str, str] = field(default_factory=dict)
    # Kanäle, für die im Zeitraum kein Provisionssatz auflösbar war — als
    # ANZEIGBARE Namen (`ota_name`, sonst `channel`). Die UI braucht sie, um
    # nicht nur „unbekannt" zu melden, sondern zu sagen, WO die Einstellung
    # fehlt; ohne diese Liste müsste der Betrieb 19 Objekte durchklicken.
    kanaele_ohne_provision: list[str] = field(default_factory=list)


def summe_opt(werte: list[Decimal | None]) -> Decimal | None:
    """Summe, die zu ``None`` wird, sobald EIN Summand unbekannt ist.

    Der unbekannte Summand kommentarlos als 0 mitzunehmen ergäbe eine
    vollständig aussehende Summe, die zu hoch ist (bei Einnahmen) bzw. zu
    niedrig (bei Provisionen) — die gefährlichste Sorte Zahl, weil sie
    niemandem auffällt.
    """
    if any(w is None for w in werte):
        return None
    return sum((w for w in werte if w is not None), NULL)


def f_opt(value: Decimal | None) -> float | None:
    return None if value is None else f(value)


class Auswerter:
    """Liest die Bezugsdaten eines Scopes und rechnet sie in EINE Währung."""

    def __init__(self, service_client: Client) -> None:
        self._db = service_client
        self._billing = OwnerBillingService(service_client=service_client)
        self._fx = FxService(service_client=service_client)

    # ==================================================================
    # B) Auswertung — die eine Stelle, die aus Buchungen Zahlen macht
    # ==================================================================

    def reservations(
        self,
        tenant_id: str,
        property_ids: list[str],
        period_from: date,
        period_to: date,
        basis: str,
        statuses: list[str],
    ) -> list[dict[str, Any]]:
        """Buchungen im Scope. ``booked`` filtert über den QUELL-Zeitstempel.

        ``reservations.booked_at`` ist der Zeitpunkt der fremden Handlung
        (Wurzel 5b). Buchungen ohne diesen Wert erscheinen bei
        ``basis='booked'`` NICHT — sie mit ``created_at`` hineinzurechnen wäre
        die Behauptung, unser Feed-Eingang sei der Buchungszeitpunkt.
        """
        if not property_ids:
            return []
        spalte = {
            "check_in": "check_in",
            "check_out": "check_out",
            "booked": "booked_at",
        }[basis]
        bis = period_to.isoformat()
        if spalte == "booked_at":
            # `booked_at` ist ein Zeitstempel: `lte '2026-07-31'` schnitte
            # alles nach Mitternacht des letzten Tages ab.
            bis = (period_to + timedelta(days=1)).isoformat()
        query = (
            self._db.table("reservations")
            .select(RES_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("is_owner_stay", False)
            .in_("property_id", property_ids)
            .gte(spalte, period_from.isoformat())
            .order("id")
        )
        query = (
            query.lt(spalte, bis) if spalte == "booked_at" else query.lte(spalte, bis)
        )
        if statuses:
            query = query.in_("status", statuses)
        return fetch_all_rows(query)

    def kontext(
        self, tenant_id: str, reservations: list[dict[str, Any]]
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, str]]:
        """Objekt-Stammdaten, OTA-Payloads und Objektnamen für diese Auswertung."""
        property_ids = sorted(
            {str(r["property_id"]) for r in reservations if r.get("property_id")}
        )
        stammdaten: dict[str, Any] = {}
        namen: dict[str, str] = {}
        if property_ids:
            for row in fetch_all_rows(
                self._db.table("properties")
                .select("id, title, type_attributes")
                .eq("tenant_id", tenant_id)
                .in_("id", property_ids)
                .order("id")
            ):
                stammdaten[str(row["id"])] = row.get("type_attributes") or {}
                namen[str(row["id"])] = str(row.get("title") or "")
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
        return stammdaten, payloads, namen

    def addon_sums(self, reservation_ids: list[str]) -> dict[str, Decimal]:
        ids = [r for r in reservation_ids if r]
        if not ids:
            return {}
        try:
            rows = fetch_all_rows(
                self._db.table("reservation_addons")
                .select("id, reservation_id, total, status")
                .in_("reservation_id", ids)
                .order("id")
            )
        except Exception as exc:  # noqa: BLE001 — keine Tabelle = kein Extra-Umsatz
            log.warning("reporting_addons_unavailable", error=str(exc))
            return {}
        sums: dict[str, Decimal] = defaultdict(lambda: NULL)
        for a in rows:
            if (a.get("status") or "pending") == "cancelled":
                continue
            sums[str(a["reservation_id"])] += d(a.get("total"))
        return dict(sums)

    def guest_names(self, guest_ids: list[str]) -> dict[str, str]:
        ids = sorted({g for g in guest_ids if g})
        if not ids:
            return {}
        rows = fetch_all_rows(
            self._db.table("guests")
            .select("id, name")
            .in_("id", ids)
            .order("id")
        )
        return {str(r["id"]): str(r.get("name") or "") for r in rows}

    def stichtag(self, r: dict[str, Any], basis: str) -> date:
        """Der Tag, mit dem Kurs und Vertrag aufgelöst werden.

        Für alle Basen der CHECK-OUT — derselbe Stichtag wie in der Abrechnung
        (`owner_statements`). Ein anderer Stichtag hier ergäbe für dieselbe
        Buchung einen anderen Kurs und damit einen anderen Betrag als auf dem
        Beleg, den der Eigentümer bekommt.
        """
        del basis  # bewusst ungenutzt: der Stichtag folgt der Abrechnung.
        try:
            return date.fromisoformat(str(r.get("check_out")))
        except (ValueError, TypeError) as exc:
            raise PayoutUnbekannt(
                "naechte", "Buchung ohne Check-out — kein Stichtag bestimmbar."
            ) from exc

    def kurs(self, von: str, nach: str, stichtag: date) -> Decimal:
        if (von or "").upper() == (nach or "").upper():
            return Decimal("1")
        if not (von or "").strip():
            raise PayoutUnbekannt(
                "betrag", "Buchung ohne Währung — nicht umrechenbar."
            )
        try:
            return self._fx.get_rate(stichtag, von, nach)
        except FxError as exc:
            raise PayoutUnbekannt("kurs", str(exc)) from exc

    def steuern_der_buchung(self, r: dict[str, Any]) -> Decimal:
        """Was an Steuern in der Buchung steckt.

        Heute EINE belegte Quelle: ``ota_withheld_taxes`` — die Steuer, die das
        Portal einbehält und abführt. Objektsteuern (``property_taxes``) sind
        Teil des Gastpreises und stecken bereits in ``total_amount``; sie hier
        noch einmal aufzuschlagen zählte sie doppelt. Fehlt der Wert, ist das
        „keine einbehaltene Steuer", nicht „unbekannt": das Portal meldet ihn,
        wenn es welche einbehält.
        """
        return d(r.get("ota_withheld_taxes"))

    def auswerten(  # noqa: PLR0915 — die Kette hat viele benannte Schritte
        self,
        tenant_id: str,
        *,
        property_ids: list[str],
        period_from: date,
        period_to: date,
        basis: str,
        statuses: list[str],
        currency: str,
    ) -> Auswertung:
        """Alle Buchungen des Scopes auswerten und in die Berichtswährung bringen."""
        erg = Auswertung(currency=currency)
        reservations = self.reservations(
            tenant_id, property_ids, period_from, period_to, basis, statuses
        )
        if not reservations:
            return erg

        stammdaten, payloads, namen = self.kontext(tenant_id, reservations)
        erg.property_names = namen
        erg.guest_names = self.guest_names(
            [str(r.get("guest_id") or "") for r in reservations]
        )
        klassifikation = klassifikation_laden(self._db, tenant_id)
        addons = self.addon_sums([str(r["id"]) for r in reservations])
        owner_je_objekt = self.owner_je_objekt(property_ids)

        # Auflösungen einmal je (Objekt, Stichtag) statt je Buchung.
        vertrag_cache: dict[tuple[str, str], common.Vertragsregeln | None] = {}
        satz_cache: dict[tuple[str, str, str], dict[str, Any] | None] = {}

        for r in reservations:
            rid = str(r["id"])
            pid = str(r.get("property_id") or "")
            try:
                stichtag = self.stichtag(r, basis)
                naechte = naechte_zwischen(r.get("check_in"), r.get("check_out"))
                quelle = str(r.get("currency") or "").upper()
                kurs = self.kurs(quelle, currency, stichtag)

                befund = gebuehren_der_buchung(
                    raw=payloads.get(
                        str(r.get("source_channex_booking_id") or "")
                    ),
                    type_attributes=stammdaten.get(pid),
                    naechte=naechte,
                    klassifikation=klassifikation,
                    property_id=pid,
                    reservierung=r,
                )
                gebuehren = befund.gebuehren
                addon_total = addons.get(rid, NULL)
                geb_summe = sum((g.betrag for g in gebuehren), NULL)
                basis = befund.basisbetrag(r.get("total_amount"))
                brutto = common.gastpreis(
                    uebernachtung=basis,
                    gebuehren=gebuehren,
                    gebuehren_im_betrag=befund.im_gesamtpreis,
                    addon_total=addon_total,
                )
                # `miete` ist die BERICHTSZEILE „Übernachtung" und wird getrennt
                # von den Gebühren summiert; Miete + Gebühren + Extras muss das
                # Brutto ergeben. Bei Booking.com enthält der Basisbetrag die
                # Gebühren schon (siehe `GebuehrenBefund`) — sie müssen hier
                # herausgerechnet werden, sonst stünden sie im Bericht zweimal
                # und die Summe der Zeilen überstiege das Brutto.
                miete = d(basis)
                if befund.im_gesamtpreis:
                    miete -= geb_summe

                satz_key = (
                    str(r.get("channel") or "").lower(),
                    pid,
                    stichtag.isoformat(),
                )
                if satz_key not in satz_cache:
                    satz_cache[satz_key] = self._billing.portal_satz_aufloesen(
                        tenant_id, satz_key[0], pid, stichtag
                    )
                satz = satz_cache[satz_key] or {}
                # Der Portal-Abzug ist der EINZIGE Schritt, dessen Fehlen die
                # Buchung nicht verwirft: er hängt an einer Einstellung des
                # Betriebs (Kanalprovision), nicht an der Buchung selbst. Alles
                # andere — Stichtag, Kurs, Gebührenzuordnung — betrifft die
                # Buchung und macht sie unauswertbar.
                abzug: common.PortalAbzug | None = None
                try:
                    abzug = common.portal_abzug(
                        brutto=brutto,
                        gemeldete_provision=r.get("ota_commission"),
                        provision_pct=satz.get("provision_pct"),
                        zahlungsgebuehr_pct=satz.get("zahlungsgebuehr_pct"),
                        zieht_portal_ein=common.portal_zieht_ein(
                            r.get("channel"), r.get("payment_collect")
                        ),
                    )
                except PayoutUnbekannt as exc:
                    kanal_name = (
                        str(r.get("ota_name") or "").strip()
                        or str(r.get("channel") or "").strip()
                        or "unbekannt"
                    )
                    if kanal_name not in erg.kanaele_ohne_provision:
                        erg.kanaele_ohne_provision.append(kanal_name)
                    erg.warnungen.append(
                        f"{namen.get(pid) or pid} "
                        f"({r.get('check_in')}–{r.get('check_out')}, "
                        f"{kanal_name}): {exc.message}"
                    )

                # Der Abrechnungsvertrag ist NICHT Voraussetzung für den
                # Bericht: die Aufschlüsselung der Einnahmen steht auch ohne
                # ihn (sie hängt am Portal-Abzug, nicht an der Verwaltungs-
                # provision). Er wird nur für die Auszahlung gebraucht — fehlt
                # er ODER der Portal-Abzug, bleibt `auszahlung` None und die
                # Zahlung ist für diesen Eigentümer nicht erzeugbar. Eine
                # Auszahlung auf geschätzter Provision wäre ein Zahlbetrag,
                # den niemand belegen kann.
                auszahlung: common.Auszahlung | None = None
                owner_id = owner_je_objekt.get(pid)
                if owner_id and abzug is not None:
                    v_key = (pid, stichtag.isoformat())
                    if v_key not in vertrag_cache:
                        zeile = self._billing.vertrag_aufloesen(
                            tenant_id, owner_id, pid, stichtag
                        )
                        vertrag_cache[v_key] = (
                            common.vertragsregeln_aus_zeile(zeile)
                            if zeile
                            else None
                        )
                    regeln = vertrag_cache[v_key]
                    if regeln is not None:
                        auszahlung = common.auszahlung_berechnen(
                            uebernachtung=basis,
                            gebuehren=gebuehren,
                            gebuehren_im_betrag=befund.im_gesamtpreis,
                            addon_total=addon_total,
                            abzug=abzug,
                            regeln=regeln,
                            naechte=naechte,
                            currency=quelle,
                        )

                steuern = self.steuern_der_buchung(r)
                # Der Offenposten misst, was der GAST noch schuldet — Bezug ist
                # deshalb der Gastpreis, nicht `total_amount`. Bei Airbnb ist
                # `total_amount` die Auszahlung nach Portal-Provision und liegt
                # rund 15 % darunter; mit ihr gerechnet erschiene eine voll
                # bezahlte Buchung als überzahlt (und eine unbezahlte als zu
                # niedrig offen).
                offen = max(brutto - d(r.get("paid_amount")), NULL)

                erg.buchungen.append(
                    Buchung(
                        row=r,
                        naechte=naechte,
                        gaeste=int(r.get("num_guests") or 0),
                        miete=miete * kurs,
                        gebuehren=[(g.art, g.betrag * kurs) for g in gebuehren],
                        gebuehren_summe=geb_summe * kurs,
                        addons=addon_total * kurs,
                        steuern=steuern * kurs,
                        portal_provision=(
                            None if abzug is None else abzug.provision * kurs
                        ),
                        portal_zahlungsgebuehr=(
                            None if abzug is None else abzug.zahlungsgebuehr * kurs
                        ),
                        brutto=brutto * kurs,
                        einnahmen=(
                            None if abzug is None else (brutto - abzug.gesamt) * kurs
                        ),
                        offen=offen * kurs,
                        auszahlung=auszahlung,
                    )
                )
            except PayoutUnbekannt as exc:
                # Benannt melden, nicht still überspringen (Wurzel 5): eine
                # fehlende Zeile ergäbe eine zu niedrige, aber nummerierte
                # Summe, die niemandem auffällt.
                erg.warnungen.append(
                    f"{namen.get(pid) or pid} "
                    f"({r.get('check_in')}–{r.get('check_out')}): {exc.message}"
                )
        return erg

    def owner_je_objekt(self, property_ids: list[str]) -> dict[str, str]:
        if not property_ids:
            return {}
        rows = fetch_all_rows(
            self._db.table("owner_properties")
            .select("owner_id, property_id")
            .in_("property_id", sorted(set(property_ids)))
            .order("property_id")
        )
        return {str(r["property_id"]): str(r["owner_id"]) for r in rows}

    @staticmethod
    def miet_zeilen(erg: Auswertung) -> list[MietZeile]:
        je_objekt: dict[str, list[Buchung]] = defaultdict(list)
        for b in erg.buchungen:
            je_objekt[str(b.row["property_id"])].append(b)
        zeilen = [
            MietZeile(
                property_id=pid,
                property_name=erg.property_names.get(pid),
                bookings=len(bs),
                nights=sum(b.naechte for b in bs),
                guests=sum(b.gaeste for b in bs),
                rent=f(sum((b.miete for b in bs), NULL)),
                fees=f(sum((b.gebuehren_summe for b in bs), NULL)),
                addons=f(sum((b.addons for b in bs), NULL)),
                taxes=f(sum((b.steuern for b in bs), NULL)),
                channel=f_opt(summe_opt([b.portal_abzug_gesamt for b in bs])),
                income=f_opt(summe_opt([b.einnahmen for b in bs])),
            )
            for pid, bs in je_objekt.items()
        ]
        zeilen.sort(key=lambda z: (z.property_name or z.property_id).lower())
        return zeilen

    @staticmethod
    def gebuehr_zeilen(erg: Auswertung) -> list[GebuehrZeile]:
        summen: dict[str, Decimal] = defaultdict(lambda: NULL)
        anzahl: dict[str, int] = defaultdict(int)
        for b in erg.buchungen:
            for art, betrag in b.gebuehren:
                summen[art] += betrag
                anzahl[art] += 1
        zeilen = [
            GebuehrZeile(
                fee_type=art,
                label=FEE_TYPE_LABEL.get(art, art),
                count=anzahl[art],
                # Division nur, wenn es etwas zu teilen gibt — sonst stünde
                # hier eine ZeroDivisionError-Falle für den Fall „Art bekannt,
                # aber nirgends berechnet".
                average=f(summen[art] / anzahl[art]) if anzahl[art] else 0.0,
                total=f(summen[art]),
            )
            for art in sorted(summen, key=lambda a: -summen[a])
        ]
        return zeilen

    @staticmethod
    def kanal_zeilen(erg: Auswertung, *, nur_provision: bool) -> list[KanalZeile]:
        """Provisionen bzw. Nettoeinkommen je Kanal.

        Gruppiert wird über ``channel`` + ``ota_name``: unter ``channel='portal'``
        stehen Buchungen mehrerer Marktplätze, und eine Zeile „portal" wäre für
        den Eigentümer keine Auskunft (Wurzel 4 sinngemäß: kein Sammelbegriff,
        der eine Tatsache verdeckt).
        """
        je_kanal: dict[tuple[str, str | None], list[Buchung]] = defaultdict(list)
        for b in erg.buchungen:
            kanal = str(b.row.get("channel") or "")
            ota = str(b.row.get("ota_name") or "") or None
            je_kanal[(kanal, ota)].append(b)
        zeilen = [
            KanalZeile(
                channel=kanal,
                ota_name=ota,
                commission=f_opt(summe_opt([b.portal_abzug_gesamt for b in bs])),
                income=f_opt(summe_opt([b.einnahmen for b in bs])),
                outstanding=f(sum((b.offen for b in bs), NULL)),
            )
            for (kanal, ota), bs in je_kanal.items()
        ]
        # Unbekannte Beträge sortieren ans ENDE statt als 0 in die Mitte: eine
        # Zeile „—" zwischen zwei echten Zahlen läse sich als kleiner Kanal.
        def schluessel(z: KanalZeile) -> tuple[int, float]:
            wert = z.commission if nur_provision else z.income
            return (1, 0.0) if wert is None else (0, -wert)

        zeilen.sort(key=schluessel)
        return zeilen

    @staticmethod
    def zahlungsart_zeilen(erg: Auswertung) -> list[ZahlungsartZeile]:
        """Was der Gast über welchen Weg bezahlt hat.

        Quelle ist ``payment_method_ota`` (was das Portal meldet). Ist nichts
        gemeldet, steht die Zeile unter ``unbekannt`` — nicht unter „direkt".
        Ein geratener Weg wäre eine Aussage über fremdes Geld (Wurzel 4).
        """
        summen: dict[str, Decimal] = defaultdict(lambda: NULL)
        for b in erg.buchungen:
            methode = str(b.row.get("payment_method_ota") or "").strip() or "unbekannt"
            summen[methode] += d(b.row.get("paid_amount"))
        return [
            ZahlungsartZeile(method=m, total=f(summen[m]))
            for m in sorted(summen, key=lambda m: -summen[m])
        ]
