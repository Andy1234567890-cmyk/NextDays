"""Steht die Gebühr WIRKLICH beim Portal? — zurücklesen statt glauben.

Der Push selbst ist gebaut (`tax_sync` → Channex-`taxes` im Tax-Set des
Objekts). Was fehlte, war der Beleg: ein „200" beim Anlegen der Steuer sagt
nichts darüber, ob das Portal den Betrag übernommen hat.

WARUM DAS KEIN LUXUS IST, sondern der Kern der Sache (live 11.08.2026, Konto
AirSmil, Objekt „FeWo *Stjerneskud*", Airbnb-Inserat 54087677):

  * bei uns stand eine Reinigungsgebühr von   795 DKK
  * am Airbnb-Inserat stand eine von        1.590 DKK
  * die Oberfläche zeigte beide Seiten ohne jeden Hinweis

Erst der Rückleseaufruf machte den Unterschied sichtbar. Nach einer Änderung
bei uns dauerte es ausserdem 15–45 Minuten, bis Airbnb den neuen Betrag trug —
Channex überträgt asynchron. Ein Status, der direkt nach dem Speichern „online"
behauptet, wäre also selbst dann falsch, wenn alles funktioniert.

WELCHE PORTALE HIER VORKOMMEN — und welche nicht:

  * **Airbnb** hat einen Leseweg für Gebühren:
    `GET channels/{cid}/mappings/{mid}/pricing_settings` → `standard_fees`.
    Nur dieses Portal kann deshalb „online" belegen.
  * **Booking.com** hat für Festbeträge WEDER einen Schreib- NOCH einen
    Leseweg (Channex-Mapping-Guide kennt keine Gebühren; unsere Regeltabelle:
    nur Prozent, im Zimmerpreis). Dort bleibt es beim Chip „Manuelle
    Synchronisierung" aus `abgaben_status` — ein „online bei Booking.com" wäre
    erfunden (Wurzel 4).

WAS VERGLICHEN WIRD, ist bewusst der Posten, den der Sync SENDET (aus
`ota_abgaben.abgaben_je_portal`), nicht die Rohgebühr: Airbnb bekommt je
Kategorie EINE Gebühr, mehrere gleichartige werden summiert. Verglichen wird
also `cat:cleaning = 795 + 795` gegen Airbnbs eine Reinigungsgebühr — und das
Ergebnis hängt danach an BEIDEN Zeilen der Oberfläche. Ein eigener Regelsatz
für den Vergleich wäre die zweite Wahrheit, an der `abgaben_status` schon
einmal fast gescheitert wäre.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.features.properties.gebuehren import fee_category

from .airbnb_gebuehren_import import KATEGORIE_AUF_AIRBNB, betrag_aus_airbnb
from .channex_client import ChannexError
from .common import ChannelManagerError, log
from .ota_abgaben import AIRBNB, abgaben_je_portal
from .tax_regime import STANDARD

# Rundungsschwelle des Vergleichs. Beträge gehen als Zeichenkette an Channex
# (`_fee_attrs`: `str(fee.amount)`) und kommen von Airbnb als Zahl zurück —
# ein Cent Abweichung ist Formatierung, kein Befund.
_TOLERANZ = 0.005

STATUS_ONLINE = "online"
STATUS_ABWEICHEND = "abweichend"
STATUS_FEHLT = "fehlt"


class GebuehrenStandMixin:
    """Ist-Stand der Gebühren beim Portal lesen und festhalten."""

    def gebuehren_stand_pruefen(
        self, tenant_id: str, property_id: str
    ) -> dict[str, Any]:
        """Airbnbs Gebühren zurücklesen und den Stand je Posten festhalten.

        Rein lesend gegenüber dem Portal. Geschrieben wird ausschliesslich
        unsere eigene Tabelle `ota_gebuehren_stand`.

        Wurzel 1: der Gegenzustand wird mitgepflegt — Posten, die es nicht mehr
        gibt (Gebühr gelöscht, Kategorie nicht mehr exportierbar), werden aus
        der Tabelle entfernt. Sonst bliebe ein „online" an einer Gebühr stehen,
        die niemand mehr führt.
        """
        db = self._require_db()  # type: ignore[attr-defined]
        prop = (
            db.table("properties")
            .select("id, currency, type_attributes")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not prop:
            raise ChannelManagerError("Objekt nicht gefunden.", status_code=404)
        soll = self._airbnb_soll_posten(db, tenant_id, property_id, prop[0])
        if soll is None:
            # Kein Airbnb, keine Währung oder nichts Exportierbares: dann gibt
            # es nichts zu belegen. Alte Zeilen müssen trotzdem weg (Wurzel 1).
            self._stand_schreiben(db, tenant_id, property_id, [])
            return {"geprueft": False, "posten": 0}

        try:
            ist = self._airbnb_ist_gebuehren(db, tenant_id, property_id)
        except ChannexError as exc:
            # Nicht lesbar heißt NICHT „steht dort nicht" — ein Ausfall des
            # Aggregators darf keine Falschaussage in die Oberfläche schreiben
            # (Wurzel 5). Der alte Stand bleibt mit seinem alten Zeitstempel
            # stehen; die Oberfläche sagt, wann zuletzt geprüft wurde.
            log.warning(
                "gebuehren_stand_unlesbar",
                property_id=property_id, error=exc.message,
            )
            raise self._wrap_channex(exc) from exc  # type: ignore[attr-defined]
        if ist is None:
            log.info("gebuehren_stand_ohne_mapping", property_id=property_id)
            return {"geprueft": False, "posten": 0}

        jetzt = datetime.now(UTC).isoformat()
        waehrung = str(prop[0].get("currency") or "").upper()
        zeilen = [
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                "portal": AIRBNB,
                "posten_key": schluessel,
                "status": status,
                "betrag_soll": betrag_soll,
                "betrag_ist": betrag_ist,
                "currency": waehrung,
                "geprueft_am": jetzt,
            }
            for schluessel, status, betrag_soll, betrag_ist in (
                _vergleich(schluessel, betrag, kategorie, ist)
                for schluessel, betrag, kategorie in soll
            )
        ]
        self._stand_schreiben(db, tenant_id, property_id, zeilen)
        log.info(
            "gebuehren_stand_geprueft",
            property_id=property_id,
            posten=len(zeilen),
            online=sum(1 for z in zeilen if z["status"] == STATUS_ONLINE),
            abweichend=sum(1 for z in zeilen if z["status"] == STATUS_ABWEICHEND),
            fehlt=sum(1 for z in zeilen if z["status"] == STATUS_FEHLT),
        )
        return {"geprueft": True, "posten": len(zeilen)}

    # Kein Einstieg aus der Oberfläche mehr: der Knopf „Beim Portal prüfen" ist
    # am 12.08.2026 aus der Preise-Maske entfernt worden, und mit ihm die Route
    # `POST /properties/{id}/gebuehren-stand/pruefen`. Der Stand wird weiter
    # gepflegt — aber ausschliesslich vom Hintergrund-Job
    # (`pruefe_ota_gebuehren` → `gebuehren_stand_pruefen`). Grund: Channex
    # reicht asynchron weiter (bei Airbnb 15–45 Minuten gemessen), ein Klick
    # direkt nach dem Speichern konnte also nur den alten Stand erneut
    # bestätigen und sah dabei wie eine Bestätigung des neuen aus.

    # --- Soll und Ist --------------------------------------------------------

    def _airbnb_soll_posten(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        prop: dict[str, Any],
    ) -> list[tuple[str, float, str | None]] | None:
        """Was an Airbnb GESENDET wird: (Schlüssel, Betrag, Kategorie).

        Dieselbe Rechnung wie im Sync (`abgaben_je_portal`) — nur Gebühren,
        keine Steuern: Steuern hängen bei Airbnb am Erhebungsszenario und
        stehen nicht in `standard_fees`, ihr Ist-Stand wäre über diesen Weg
        gar nicht lesbar.
        """
        portale = self._verbundene_portale(db, tenant_id, property_id)  # type: ignore[attr-defined]
        if AIRBNB not in portale:
            return None
        currency = str(prop.get("currency") or "").upper()
        if not currency:
            return None
        pricing = (prop.get("type_attributes") or {}).get("pricing") or {}
        fees = [f for f in (pricing.get("fees") or []) if isinstance(f, dict)]
        if not fees:
            return []
        regime = self.regime_je_portal(db, tenant_id, property_id)  # type: ignore[attr-defined]
        posten, _diagnose = abgaben_je_portal(
            portal=AIRBNB,
            taxes=[],
            fees=fees,
            currency=currency,
            objekt_inklusiv_erlaubt=regime.get(AIRBNB, STANDARD).senden,
            airbnb_steuern_erlaubt=True,
        )
        nach_id = {str(f.get("id") or ""): f for f in fees}
        ergebnis: list[tuple[str, float, str | None]] = []
        for abgabe in posten:
            if abgabe.attrs.get("type") != "fee":
                continue
            try:
                betrag = float(abgabe.attrs.get("rate") or 0)
            except (TypeError, ValueError):  # noqa: PERF203 — je Posten
                continue
            kategorie = (
                abgabe.schluessel.removeprefix("cat:")
                if abgabe.schluessel.startswith("cat:")
                else fee_category(nach_id.get(abgabe.schluessel) or {})
            )
            ergebnis.append((abgabe.schluessel, betrag, kategorie))
        return ergebnis

    def _airbnb_ist_gebuehren(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, float] | None:
        """Airbnbs Gebührenart → Betrag, wie das Inserat sie JETZT trägt.

        None = kein Mapping (dann ist „steht dort nicht" keine belegte Aussage).
        Prozentgebühren bleiben draußen: `standard_fees` führt Prozent und
        Festbetrag im selben Feld, ein Vergleich „25 % gegen 25 DKK" wäre eine
        Scheinübereinstimmung.
        """
        einstellungen = self._airbnb_pricing_settings(  # type: ignore[attr-defined]
            db, tenant_id, property_id
        )
        if einstellungen is None:
            return None
        ergebnis: dict[str, float] = {}
        for roh in einstellungen.get("standard_fees") or []:
            if not isinstance(roh, dict):
                continue
            if str(roh.get("amount_type") or "flat").lower() == "percent":
                continue
            art = str(roh.get("fee_type") or "").strip()
            betrag = betrag_aus_airbnb(roh)
            if not art or betrag is None:
                continue
            # Airbnb führt je Art höchstens eine Gebühr; kämen doch zwei,
            # zählt die Summe — das ist, was der Gast zahlt.
            ergebnis[art] = ergebnis.get(art, 0.0) + betrag
        return ergebnis

    # --- Ablage --------------------------------------------------------------

    @staticmethod
    def _stand_schreiben(
        db: Client,
        tenant_id: str,
        property_id: str,
        zeilen: list[dict[str, Any]],
    ) -> None:
        """Stand des Objekts ersetzen — inklusive Wegräumen alter Posten."""
        behalten = {(z["portal"], z["posten_key"]) for z in zeilen}
        alt = (
            db.table("ota_gebuehren_stand")
            .select("id, portal, posten_key")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []
        verwaist = [
            r["id"]
            for r in alt
            if (str(r.get("portal")), str(r.get("posten_key"))) not in behalten
        ]
        if verwaist:
            db.table("ota_gebuehren_stand").delete().in_("id", verwaist).execute()
        if zeilen:
            db.table("ota_gebuehren_stand").upsert(
                zeilen, on_conflict="property_id,portal,posten_key"
            ).execute()

    @staticmethod
    def gebuehren_stand_lesen(
        db: Client, tenant_id: str, property_id: str
    ) -> dict[str, list[dict[str, Any]]]:
        """Gespeicherter Stand je Posten-Schlüssel. Kein Portal-Aufruf.

        Die Oberfläche fragt das bei JEDEM Aufbau der Preise-Seite ab — ein
        Live-Call je Seitenaufbau wäre eine Channex-Anfrage pro Klick.
        """
        try:
            rows = (
                db.table("ota_gebuehren_stand")
                .select("portal, posten_key, status, betrag_soll, betrag_ist, "
                        "currency, geprueft_am")
                .eq("tenant_id", tenant_id)
                .eq("property_id", property_id)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — kein Stand ist besser als ein falscher
            log.warning(
                "gebuehren_stand_nicht_ladbar",
                property_id=property_id, error=str(exc)[:200],
            )
            return {}
        nach_key: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            nach_key.setdefault(str(row.get("posten_key") or ""), []).append(
                {
                    "portal": str(row.get("portal") or ""),
                    "status": str(row.get("status") or ""),
                    "amount": _zahl(row.get("betrag_ist")),
                    "expected": _zahl(row.get("betrag_soll")),
                    "currency": row.get("currency") or None,
                    "checked_at": row.get("geprueft_am"),
                }
            )
        return nach_key


def _vergleich(
    schluessel: str,
    betrag_soll: float,
    kategorie: str | None,
    ist: dict[str, float],
) -> tuple[str, str, float, float | None]:
    """Soll gegen Ist für EINEN gesendeten Posten."""
    art = KATEGORIE_AUF_AIRBNB.get(kategorie or "")
    betrag_ist = ist.get(art or "")
    if betrag_ist is None:
        return schluessel, STATUS_FEHLT, betrag_soll, None
    if abs(betrag_ist - betrag_soll) <= _TOLERANZ:
        return schluessel, STATUS_ONLINE, betrag_soll, betrag_ist
    return schluessel, STATUS_ABWEICHEND, betrag_soll, betrag_ist


def _zahl(wert: object) -> float | None:
    """Numeric aus der DB als Zahl. None bleibt None (kein 0-Ersatz, Wurzel 4)."""
    if wert is None:
        return None
    try:
        return float(wert)
    except (TypeError, ValueError):
        return None
