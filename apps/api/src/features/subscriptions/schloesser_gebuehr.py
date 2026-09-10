"""Schloss-Gebühr — je verwaltetem Gerät und Monat.

WAS HIER ABGERECHNET WIRD: Der Aggregator Seam kostet uns 5 USD je aktivem
Gerät und Monat. Diese Kosten gehen an den Betrieb weiter, wie es die
Referenz-PMS auch tun (Lodgify 7 USD / 6 EUR je Gerät, Smoobu 4 EUR — beide
ausdrücklich zusätzlich zum Abo).

WARUM STÜCKZAHL UND NICHT UMSATZ, anders als bei „Dynamische Preise": Unsere
Kosten entstehen je GERÄT. Ein Betrieb mit fünf Schlössern und zwei Buchungen
kostet uns mehr als einer mit einem Schloss und dreißig Buchungen. Eine
umsatzabhängige Gebühr würde an der Kostenseite vorbeirechnen.

DIE WÄHRUNGSFALLE ist dieselbe wie in `dynpricing.py`, aber sie schlägt hier
anders zu: Unsere EINKAUFSWÄHRUNG ist USD, die Rechnungswährung des Betriebs
ist EUR/DKK/GBP. Ein Kurs wird hier NICHT geschätzt (Wurzel 4) — der Preis je
Gerät ist ein FESTGELEGTER Betrag in der Abrechnungswährung des Betriebs, kein
umgerechneter Einkaufspreis. Damit ist er stabil und nachvollziehbar; die
Kursdifferenz ist unser Risiko, nicht das des Kunden.

Eigene Datei aus demselben Grund wie `dynpricing.py`: die Abrechnung eines
Moduls ist eine geschlossene Einheit (Erfassen → Storno → Monatslauf), und
`service.py` soll nicht weiter wachsen.
"""
from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from stripe import StripeError as _StripeError
from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from . import abrechnungswaehrung
from .errors import SubscriptionsConfigError, SubscriptionsError
from .schemas import SCHLOSS_PREIS_JE_GERAET

log = get_logger("nextdays.subscriptions.schloesser")


def _monatsanfang(wann: date | None = None) -> date:
    """Der erste Tag des Monats — der Abrechnungsanker.

    Je Monat und Gerät entsteht genau eine Zeile. Ein tagesgenauer Anteil wäre
    genauer als unsere Kostenseite (Seam rechnet den Monat) und damit eine
    Scheingenauigkeit.
    """
    heute = wann or datetime.now(UTC).date()
    return heute.replace(day=1)


class SchloesserGebuehrMixin:
    """Erfassung und Abrechnung der Schloss-Gebühr.

    Erwartet vom Host (`SubscriptionsService`): `self._db`, `self._stripe`,
    `self._load_row`, `self._stripe_err`.
    """

    # -- Erfassen ----------------------------------------------------------
    def erfasse_schloss_gebuehren(self, wann: date | None = None) -> dict[str, int]:
        """Für jedes verwaltete Gerät die Monatsgebühr erfassen.

        Läuft einmal je Monat über ALLE Betriebe. Idempotent (Wurzel 2): die
        UNIQUE-Bedingung `(seam_device_id, monat)` in 0574 sorgt dafür, dass ein
        zweiter Lauf keine zweite Zeile erzeugt. Das ist hier besonders
        wichtig, weil ein doppelter Lauf sonst direkt auf der Kundenrechnung
        landet — ein Fehler, den der Kunde vor uns sieht.

        Abgerechnet werden nur Geräte an einer VERBUNDENEN Verbindung: ein
        Gerät an einem getrennten Konto kostet uns bei Seam nichts mehr, also
        darf es auch den Betrieb nichts kosten.
        """
        if self._db is None:
            raise SubscriptionsError(
                "Subscriptions-DB nicht verfügbar.", status_code=500
            )
        db: Client = self._db
        monat = _monatsanfang(wann)

        verbindungen = fetch_all_rows(
            db.table("seam_connection")
            .select("id, tenant_id")
            .eq("status", "connected")
        )
        erlaubt = {str(v["id"]): str(v["tenant_id"]) for v in verbindungen}
        if not erlaubt:
            return {"geraete": 0, "erfasst": 0, "uebersprungen": 0}

        geraete = fetch_all_rows(
            db.table("seam_device").select("id, tenant_id, seam_device_id, connection_id")
        )
        bilanz = {"geraete": 0, "erfasst": 0, "uebersprungen": 0}
        for g in geraete:
            if str(g.get("connection_id")) not in erlaubt:
                bilanz["uebersprungen"] += 1
                continue
            bilanz["geraete"] += 1
            if self._eine_gebuehr(db, g, monat):
                bilanz["erfasst"] += 1
        if bilanz["erfasst"]:
            log.info("schloesser_gebuehr_erfasst", monat=monat.isoformat(), **bilanz)
        return bilanz

    def _eine_gebuehr(self, db: Client, geraet: dict, monat: date) -> bool:
        """Eine Ledger-Zeile anlegen. `False` = gab es schon (Redelivery/Retry).

        Der Preis wird in der ABRECHNUNGSWÄHRUNG des Betriebs bestimmt und als
        Tatsache in die Zeile geschrieben. Fehlt die Währung, entsteht KEINE
        Zeile: ein Betrag ohne Währung wäre wertlos, und ein angenommener Kurs
        wäre ein erfundener Wert (Wurzel 4).
        """
        tenant_id = str(geraet["tenant_id"])
        waehrung = self._abrechnungswaehrung(db, tenant_id)
        if not waehrung:
            log.warning(
                "schloesser_gebuehr_ohne_waehrung",
                tenant_id=tenant_id,
                geraet=str(geraet.get("seam_device_id")),
            )
            return False
        betrag = SCHLOSS_PREIS_JE_GERAET.get(waehrung)
        if betrag is None:
            # Keine Umrechnung aus einer anderen Währung (Wurzel 4). Ein
            # fehlender Preis ist ein Konfigurationsmangel und muss LAUT
            # gemeldet werden, statt still einen Ersatzwert zu nehmen.
            log.error(
                "schloesser_gebuehr_kein_preis",
                tenant_id=tenant_id,
                waehrung=waehrung,
                bekannt=sorted(SCHLOSS_PREIS_JE_GERAET),
            )
            return False
        try:
            db.table("schloesser_ledger").insert(
                {
                    "tenant_id": tenant_id,
                    "device_id": str(geraet["id"]),
                    "seam_device_id": str(geraet["seam_device_id"]),
                    "monat": monat.isoformat(),
                    "betrag": betrag,
                    "currency": waehrung,
                    "status": "pending",
                }
            ).execute()
            return True
        except Exception as exc:  # noqa: BLE001 - Konflikt ist der Normalfall
            if "23505" in str(exc) or "duplicate key" in str(exc).lower():
                return False
            raise

    @staticmethod
    def _abrechnungswaehrung(db: Client, tenant_id: str) -> str | None:
        """Die Währung, in der dieser Betrieb abgerechnet wird.

        Vom BETRIEB, nicht vom Objekt: die Gebühr ist eine Forderung gegen den
        Betrieb, keine Position einer Buchung. Fehlt sie, gibt es keinen
        Ersatzwert (Wurzel 4) — der Lauf meldet das laut und bucht nichts.

        Aus `tenants.currency`, NICHT aus `tenant_billing_profile`: dort gibt
        es die Spalte gar nicht, die Abfrage warf 42703 und riss den ganzen
        Gebührenlauf mit (gefunden 10.09.2026 per db-spalten-pruefen.py).

        Nicht zu verwechseln mit `abrechnungswaehrung.kunden_waehrung`: die
        beschreibt, in welcher Währung STRIPE fakturieren kann, und gehört
        dem Stripe-Kunden. Hier wird nur die Ledger-Zeile angelegt; welche
        Währung die spätere Rechnung trägt, entscheidet der Fakturierungslauf
        mit genau jenem Modul.
        """
        zeilen = (
            db.table("tenants")
            .select("currency")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        wert = zeilen[0].get("currency") if zeilen else None
        return str(wert).strip().upper() if wert else None

    # -- Zurücknehmen ------------------------------------------------------
    def storniere_schloss_gebuehr(
        self, tenant_id: str, *, seam_device_id: str, monat: date | None = None
    ) -> None:
        """Eine noch offene Gebühr zurücknehmen (Gegenzustand, Wurzel 1).

        Für den Fall, dass ein Gerät im laufenden Monat entfernt wird, bevor
        die Rechnung raus ist. Eine bereits FAKTURIERTE Zeile bleibt: sie steht
        auf einer gestellten Rechnung, und die nachträglich zu verändern wäre
        schlimmer als die Gebühr.
        """
        if self._db is None:
            return
        self._db.table("schloesser_ledger").update({"status": "cancelled"}).eq(
            "tenant_id", tenant_id
        ).eq("seam_device_id", seam_device_id).eq(
            "monat", (monat or _monatsanfang()).isoformat()
        ).eq("status", "pending").execute()

    # -- Fakturieren -------------------------------------------------------
    def bill_all_schloesser(self, *, period: str) -> dict[str, int]:
        """Monatslauf über alle Betriebe mit offenen Schloss-Gebühren.

        Je Betrieb isoliert: ein kaputter Datensatz darf die übrigen nicht
        stoppen (Wurzel 5). Ein fehlender Stripe-Schlüssel trifft dagegen ALLE
        und wird deshalb nicht wegisoliert, sondern durchgereicht.
        """
        if self._db is None:
            raise SubscriptionsError(
                "Subscriptions-DB nicht verfügbar.", status_code=500
            )
        offene = fetch_all_rows(
            self._db.table("schloesser_ledger")
            .select("tenant_id")
            .eq("status", "pending")
        )
        tenant_ids = sorted({r["tenant_id"] for r in offene if r.get("tenant_id")})
        bilanz = {
            "tenants": len(tenant_ids),
            "abgerechnet": 0,
            "zeilen": 0,
            "fehler": 0,
        }
        for tid in tenant_ids:
            try:
                anzahl = self.bill_pending_schloesser(tid, period=period)
            except SubscriptionsConfigError:
                log.error(
                    "schloesser_billing_nicht_konfiguriert",
                    period=period,
                    offene_tenants=len(tenant_ids),
                )
                raise
            except SubscriptionsError as exc:
                bilanz["fehler"] += 1
                log.warning(
                    "schloesser_billing_failed",
                    tenant_id=tid,
                    period=period,
                    error=exc.message,
                )
                continue
            if anzahl:
                bilanz["abgerechnet"] += 1
                bilanz["zeilen"] += anzahl
        if tenant_ids:
            log.info("schloesser_billing_run", period=period, **bilanz)
        return bilanz

    def bill_pending_schloesser(self, tenant_id: str, *, period: str) -> int:
        """Offene Schloss-Gebühren eines Betriebs fakturieren.

        JE WÄHRUNG ein eigenes Invoice-Item — eine Stripe-Rechnung trägt genau
        eine Währung. Umgerechnet wird nicht; `abrechnungswaehrung.fakturierbar`
        stellt sicher, dass das Item in einer Währung entsteht, die auf der
        Rechnung des Kunden landen KANN. Ohne diesen Schritt liegt das Item
        stumm herum und Stripe meldet nichts.

        Idempotent (Wurzel 2): der Stripe-idempotency_key enthält Tenant,
        Periode, Währung UND Betrag — sonst quittiert Stripe eine geänderte
        Summe mit HTTP 400 und der Lauf fällt still aus.
        """
        if self._db is None:
            raise SubscriptionsError(
                "Subscriptions-DB nicht verfügbar.", status_code=500
            )
        db = self._db
        pending = (
            db.table("schloesser_ledger")
            .select("id, betrag, currency")
            .eq("tenant_id", tenant_id)
            .eq("status", "pending")
            .execute()
        ).data
        if not pending:
            return 0
        sub_row = self._load_row(db, tenant_id)
        if not sub_row or not sub_row.get("stripe_customer_id"):
            raise SubscriptionsError(
                "Kein Stripe-Kunde/Abo — Schloss-Gebühr nicht abrechenbar.",
                status_code=409,
            )
        customer_id = sub_row["stripe_customer_id"]

        je_waehrung: dict[str, list[dict[str, Any]]] = {}
        for row in pending:
            je_waehrung.setdefault(row["currency"], []).append(row)

        abgerechnet = 0
        for currency, zeilen in sorted(je_waehrung.items()):
            total = round(sum(float(z["betrag"]) for z in zeilen), 2)
            if total <= 0:
                continue
            fakt_total, fakt_currency, kurs = abrechnungswaehrung.fakturierbar(
                db,
                self._stripe,
                self._stripe_err,
                customer_id=customer_id,
                betrag=total,
                quell_waehrung=currency,
                period=period,
            )
            idem = abrechnungswaehrung.idempotenz_schluessel(
                "schloss", tenant_id, f"{period}:{fakt_currency}", fakt_total
            )
            anzahl = len(zeilen)
            try:
                item = self._stripe.v1.invoice_items.create(
                    params={
                        "customer": customer_id,
                        "amount": int(round(fakt_total * 100)),
                        "currency": fakt_currency.lower(),
                        "description": (
                            f"Schlösser {period} · "
                            + (
                                "1 Gerät"
                                if anzahl == 1
                                else f"{anzahl} Geräte"
                            )
                        ),
                        "metadata": abrechnungswaehrung.herkunft_metadaten(
                            tenant_id, period, total, currency, kurs
                        ),
                    },
                    options={"idempotency_key": idem},
                )
            except _StripeError as exc:
                raise self._stripe_err(exc) from exc

            item_id = getattr(item, "id", None) or (
                item.get("id") if isinstance(item, dict) else None
            )
            jetzt = datetime.now(UTC).isoformat()
            for z in zeilen:
                db.table("schloesser_ledger").update(
                    {
                        "status": "invoiced",
                        "stripe_invoice_item_id": item_id,
                        "invoiced_at": jetzt,
                    }
                ).eq("id", z["id"]).eq("status", "pending").execute()
            abgerechnet += anzahl
        return abgerechnet
