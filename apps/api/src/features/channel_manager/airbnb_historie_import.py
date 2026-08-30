"""Airbnb-Buchungen eines Objekts in unsere Tabellen übernehmen.

Trennung zu `airbnb_historie`: dort wird bei Airbnb GELESEN (Etappen, Cursor,
Seitengrenzen), hier wird bei uns GESCHRIEBEN (Gast, Reservierung, Kalender,
Nachrichten). Zwei Module, weil das Lesen bewiesenermaßen tückisch ist und für
sich testbar bleiben muss — ohne DB-Attrappe.

WARUM EIN EIGENER ÜBERSETZER UND NICHT `_project_booking_to_reservation`:
Der bestehende Pfad erwartet den CHANNEX-Payload (`booking_id`, `arrival_date`,
`property_id` = Channex-ID, `customer`-Objekt). Airbnb liefert etwas anderes:
`confirmation_code`, `start_date`, `listing_id`, `guest_details` mit Zahlen
statt Namen. Den bestehenden Pfad umzubiegen hieße, ihn für beide Formate
zuständig zu machen — und der trägt den Kalender-Gegenzustand (Wurzel 1) für
den laufenden Betrieb. Hier wird deshalb übersetzt und dann der GLEICHE
Reservierungs-Weg benutzt, nicht ein zweiter danebengestellt.

VERGANGENE BUCHUNGEN OHNE PROVISION (bewusste Festlegung): Historie wird
importiert, damit Belegung, Gästehistorie und Nachrichten stimmen — aber ohne
rückwirkende Provisions-/Auszahlungsbuchung. Ein Import darf die Buchhaltung
eines abgeschlossenen Geschäftsjahres nicht nachträglich verändern.

WAS AIRBNB NICHT LIEFERT (Wurzel 4 — nichts erfinden): keinen Gastnamen und
keine E-Mail im Reservierungs-Payload, nur `guest_id` und Personenzahlen. Der
Name steht im Nachrichten-Thread (`users[].first_name`) und wird von dort
geholt, wenn der Thread gelesen wird. Ohne Thread bleibt der Gast ein
Platzhalter mit `needs_review` — kein erfundener „Gast von Airbnb".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Final

from supabase import Client

from src.core.einheiten import AVAILABILITY_CONFLICT, freie_einheit, je_einheit
from src.features.guests.identity import (
    GuestContact,
    create_placeholder_guest,
    resolve_or_create_guest,
)
from src.features.guests.service import recompute_guest_aggregates

from .common import log, ota_buchungszeitpunkt, ota_uhrzeit

# Airbnbs `status_type` → unser Reservierungsstatus. Nur BEKANNTE Werte werden
# übersetzt; ein unbekannter Status wird übersprungen statt zu 'confirmed'
# geraten — sonst sperrte eine unbestätigte Anfrage echte Nächte (Wurzel 4/5).
_STATUS: Final[dict[str, str]] = {
    "accept": "confirmed",
    "accepted": "confirmed",
    "pending": "pending",
    "awaiting_payment": "pending",
    "cancelled": "cancelled",
    "canceled": "cancelled",
    "denied": "cancelled",
    "timedout": "cancelled",
    "checkpoint": "pending",
}

# Ein abgeschlossener Aufenthalt ist nicht mehr „bestätigt", sondern vorbei.
# Ohne das stünde die halbe Historie als laufende Buchung in der Übersicht.
_STATUS_VERGANGEN: Final = "completed"


@dataclass
class ImportErgebnis:
    """Was der Import bei UNS bewirkt hat — getrennt vom Lese-Ergebnis."""

    angelegt: int = 0
    aktualisiert: int = 0
    uebersprungen: int = 0
    nachrichten: int = 0
    gruende: list[str] = field(default_factory=list)

    def ueberspringen(self, grund: str) -> None:
        self.uebersprungen += 1
        # Gründe entdoppelt sammeln: bei 400 Buchungen will niemand 400-mal
        # „unbekannter Status" lesen, aber DASS es vorkam, muss sichtbar sein.
        if grund not in self.gruende:
            self.gruende.append(grund)


def _zahl(wert: object) -> float | None:
    """Airbnb liefert Beträge als Zeichenkette („8607.17"). None bleibt None."""
    if wert in (None, ""):
        return None
    try:
        return float(str(wert))
    except (TypeError, ValueError):
        return None


def _naechte(anreise: str, abreise: str) -> list[str]:
    """Belegte Nächte: Anreisetag bis Vortag der Abreise (Abreisetag ist frei)."""
    start = date.fromisoformat(anreise)
    ende = date.fromisoformat(abreise)
    return [
        (start + timedelta(days=i)).isoformat() for i in range((ende - start).days)
    ]


def status_uebersetzen(res: dict[str, Any], *, heute: date) -> str | None:
    """Airbnb-Status → unserer. None = unbekannt, also nicht importieren.

    Ein vergangener bestätigter Aufenthalt wird `completed`: er ist gelaufen.
    Eine Stornierung bleibt storniert, egal wie alt sie ist.
    """
    roh = str(res.get("status_type") or "").strip().lower()
    unser = _STATUS.get(roh)
    if unser is None:
        return None
    if unser == "confirmed":
        abreise = str(res.get("end_date") or "")
        if abreise and date.fromisoformat(abreise) <= heute:
            return _STATUS_VERGANGEN
    return unser


def gast_aus_thread(thread: dict[str, Any], host_id: str) -> GuestContact | None:
    """Gastname aus dem Nachrichten-Thread ziehen.

    Der Reservierungs-Payload trägt keinen Namen. Im Thread stehen beide
    Beteiligten unter `users[]`; der Gast ist der, der NICHT der Gastgeber ist.
    Ohne Thread gibt es keinen Namen — dann bewusst None statt einer Erfindung.
    """
    for nutzer in thread.get("users") or []:
        if str(nutzer.get("id") or "") == str(host_id):
            continue
        vorname = (nutzer.get("first_name") or "").strip()
        if not vorname:
            continue
        return GuestContact(
            first_name=vorname,
            last_name=(nutzer.get("last_name") or "").strip() or None,
            channel="ota",
            stable_external_ref=str(nutzer.get("id") or "") or None,
            language=(nutzer.get("preferred_locale") or "").strip() or None,
        )
    return None


class AirbnbHistorieImportMixin:
    """Gelesene Airbnb-Buchungen in reservations + Kalender + Gäste schreiben."""

    def airbnb_buchungen_uebernehmen(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        buchungen: list[dict[str, Any]],
        *,
        waehrung: str,
        heute: date | None = None,
    ) -> ImportErgebnis:
        """Buchungen EINES Objekts übernehmen. Idempotent über den Code.

        `waehrung` kommt vom Objekt und wird NICHT aus der Buchung geraten:
        Airbnb liefert `host_currency`, aber die Objektwährung ist unsere
        Wahrheit (Wurzel 4, zentrale properties.currency). Weichen beide ab,
        wird die Buchung übersprungen statt in fremder Währung gebucht.
        """
        stichtag = heute or datetime.now().date()
        ergebnis = ImportErgebnis()

        for res in buchungen:
            code = str(res.get("confirmation_code") or "")
            anreise = str(res.get("start_date") or "")
            abreise = str(res.get("end_date") or "")
            if not (code and anreise and abreise):
                ergebnis.ueberspringen("Buchung ohne Code oder Datum")
                continue

            status = status_uebersetzen(res, heute=stichtag)
            if status is None:
                ergebnis.ueberspringen(
                    f"Unbekannter Airbnb-Status „{res.get('status_type')}"
                )
                continue

            fremd = str(res.get("host_currency") or "").strip().upper()
            if fremd and fremd != waehrung.upper():
                ergebnis.ueberspringen(
                    f"Währung {fremd} passt nicht zur Objektwährung {waehrung}"
                )
                continue

            self._eine_buchung_uebernehmen(
                db, tenant_id, property_id, res,
                code=code, anreise=anreise, abreise=abreise,
                status=status, waehrung=waehrung, ergebnis=ergebnis,
            )

        log.info(
            "airbnb_buchungen_uebernommen",
            tenant_id=tenant_id, property_id=property_id,
            angelegt=ergebnis.angelegt, aktualisiert=ergebnis.aktualisiert,
            uebersprungen=ergebnis.uebersprungen,
        )
        return ergebnis

    def _eine_buchung_uebernehmen(  # pylint: disable=too-many-arguments
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        res: dict[str, Any],
        *,
        code: str,
        anreise: str,
        abreise: str,
        status: str,
        waehrung: str,
        ergebnis: ImportErgebnis,
    ) -> None:
        """Eine einzelne Buchung schreiben — Gast, Reservierung, Kalender."""
        alt = self._bestehende_buchung(db, tenant_id, code)

        gast_id = self._gast_der_buchung(db, tenant_id, res, alt is not None)
        details = res.get("guest_details") or {}
        zeile: dict[str, Any] = {
            "tenant_id": tenant_id,
            "property_id": property_id,
            "guest_id": gast_id,
            "channel": "airbnb",
            "ota_name": "Airbnb",
            "check_in": anreise,
            "check_out": abreise,
            "status": status,
            "currency": waehrung,
            "total_amount": _zahl(res.get("base_price")) or 0,
            "paid_amount": _zahl(res.get("payout_amount")) or 0,
            "source_channex_booking_id": code,
            "external_ref": code,
            # WANN der Gast wirklich gebucht hat (0291) — über den EINEN
            # Helfer, damit jeder Kanal dieselbe Regel benutzt und niemand
            # unseren Anlagezeitpunkt als Portal-Zeit ausgibt.
            "booked_at": ota_buchungszeitpunkt(res),
            # An-/Abreisezeit, wie das Inserat sie festlegt. Airbnb liefert sie
            # als vollen Zeitstempel mit Zonen-Anhang
            # (`'…T16:00+02:00[Europe/Copenhagen]'`) — der Helfer macht daraus
            # „16:00". Ohne das blieb die Spalte leer und jede Anreise-Vorlage
            # meldete „Feld ohne Wert: checkin_time".
            "checkin_time": ota_uhrzeit(res.get("check_in_datetime")),
            "checkout_time": ota_uhrzeit(res.get("check_out_datetime")),
            # Personenzahlen sind NOT NULL in der DB (Default 0 bzw. adults 1).
            # Ein `or None` bei 0 Kindern warf live einen 23502 — die Null IST
            # hier die Aussage („keine Kinder"), nicht das Fehlen einer Angabe.
            "adults": int(details.get("number_of_adults") or 0),
            "children": int(details.get("number_of_children") or 0),
            "infants": int(details.get("number_of_infants") or 0),
            "pets": int(details.get("number_of_pets") or 0),
            # Bewusst NICHT gesetzt: ota_commission/channel_fee. Historie wird
            # nicht rückwirkend abgerechnet (siehe Modul-Docstring).
        }
        # Mindestens ein Gast: die Spalte ist NOT NULL mit Default 1, und eine
        # Buchung über null Personen gibt es nicht. Liefert Airbnb keine Zahl,
        # bleibt 1 stehen — das ist die untere Schranke, kein geratener Wert.
        gaeste = sum(
            int(details.get(k) or 0)
            for k in ("number_of_adults", "number_of_children")
        )
        zeile["num_guests"] = gaeste or 1
        if not zeile["adults"]:
            zeile["adults"] = 1

        # Die Buchung belegt GENAU EINE Einheit (Datenmodell: 1 Objekt = 1 Typ
        # mit n Einheiten). Ohne diese Zuweisung sperrte `je_einheit` den Tag
        # auf ALLEN Einheiten — bei fünf gleichen Studios wären vier fälschlich
        # dicht. Bei einer Modifikation behält die Buchung ihre Einheit.
        if status != "cancelled":
            zeile["unit_id"] = (alt or {}).get("unit_id") or freie_einheit(
                db, property_id, anreise, abreise,
                tenant_id=tenant_id,
                eigene_unit=(alt or {}).get("unit_id"),
                eigene_naechte=_naechte(anreise, abreise) if alt else None,
            )
            if not zeile["unit_id"]:
                # Keine Einheit frei: die Buchung ist trotzdem real (das Portal
                # hat sie angenommen). Nicht verwerfen — anlegen und melden,
                # damit aus der Überbuchung keine stille Doppelbelegung wird.
                ergebnis.gruende.append(
                    f"{code}: keine freie Einheit im Zeitraum — bitte prüfen"
                )

        # KEIN Upsert mit `on_conflict` (live gescheitert, 42P10): der Index
        # `reservations_source_channex_uidx` ist PARTIELL
        # (`WHERE source_channex_booking_id IS NOT NULL`), und darauf lässt
        # PostgREST keine ON-CONFLICT-Klausel zu. Deshalb explizit: vorhandene
        # Zeile aktualisieren, sonst einfügen. Der Unique-Index bleibt der
        # Backstop gegen Doppelanlage bei zwei gleichzeitigen Läufen (Wurzel 2).
        if alt:
            # Über die ID der GEFUNDENEN Zeile, nicht über den Code: gefunden
            # wird unter zwei möglichen Spalten (`_bestehende_buchung`), und ein
            # Filter auf nur eine davon ginge bei einer Feed-Zeile ins Leere —
            # das Update liefe ohne Treffer durch und meldete trotzdem Erfolg.
            (
                db.table("reservations")
                .update(zeile)
                .eq("tenant_id", tenant_id)
                .eq("id", alt["id"])
                .execute()
            )
        else:
            db.table("reservations").insert(zeile).execute()

        # Gegenzustand (Wurzel 1): die Loyalty-Aggregate der Gaestekartei
        # (`stays_count`, `total_revenue`, `last_stay_at`) haengen an der
        # `guests`-Zeile und werden nicht von der DB gepflegt. Ohne diesen
        # Aufruf importiert der Historienlauf Buchungen, und die Kartei zeigt
        # weiter „0 Aufenthalte" — genau der Zustand, in dem der Beta-Betrieb
        # am 30.08.2026 stand (290 Gaeste mit Buchung, EINER mit Aggregaten).
        # Best-effort: die Funktion faengt intern breit und loggt.
        gast = zeile.get("guest_id")
        if gast:
            recompute_guest_aggregates(db, tenant_id, str(gast))

        if alt:
            ergebnis.aktualisiert += 1
            # Wurzel 1: verschiebt sich der Zeitraum, müssen die ALTEN Nächte
            # freigegeben werden, sonst bleibt eine Phantom-Belegung stehen.
            if (alt.get("check_in"), alt.get("check_out")) != (anreise, abreise):
                self._naechte_freigeben(
                    db, property_id,
                    str(alt.get("check_in") or ""), str(alt.get("check_out") or ""),
                    unit_id=alt.get("unit_id"),
                )
        else:
            ergebnis.angelegt += 1

        if status == "cancelled":
            # Eine Stornierung belegt nichts — und gibt frei, was sie belegte.
            self._naechte_freigeben(
                db, property_id, anreise, abreise,
                unit_id=(alt or {}).get("unit_id"),
            )
        else:
            self._naechte_sperren(
                db, property_id, anreise, abreise,
                unit_id=zeile.get("unit_id"),
            )

    @staticmethod
    def _bestehende_buchung(
        db: Client, tenant_id: str, code: str
    ) -> dict[str, Any] | None:
        """Kennen wir diese Portal-Buchung schon? — unter BEIDEN Schlüsseln.

        WARUM ZWEI: Dieselbe Airbnb-Buchung kommt auf zwei Wegen zu uns, und
        jeder legt sie unter einem anderen Schlüssel ab.

          * Der Feed (`bookings_sync`) schreibt in `source_channex_booking_id`
            die Channex-UUID und den Airbnb-Bestätigungscode in `external_ref`.
          * Dieser Historien-Import kennt Channex gar nicht — er liest direkt
            bei Airbnb und hat nur den Bestätigungscode.

        Suchte man nur nach einer Spalte, träfe der Import die Feed-Zeile nicht
        und legte die Buchung ein zweites Mal an: dieselbe Reservierung doppelt,
        die Nächte doppelt belegt, der Kalender kaputt. Der Bestätigungscode ist
        das einzige, was beide Wege gemeinsam haben (Wurzel 2 — real kommt alles
        doppelt, hier sogar über zwei verschiedene Türen).

        Reihenfolge: erst der eigene Schlüssel (der häufige Fall bei einem
        zweiten Historien-Lauf), dann `external_ref` (die Feed-Zeile).
        """
        for spalte in ("source_channex_booking_id", "external_ref"):
            treffer = (
                db.table("reservations")
                .select("id, status, check_in, check_out, unit_id, guest_id")
                .eq("tenant_id", tenant_id)
                .eq(spalte, code)
                .limit(1)
                .execute()
            ).data
            if treffer:
                return treffer[0]
        return None

    def _gast_der_buchung(
        self, db: Client, tenant_id: str, res: dict[str, Any], bestand: bool
    ) -> str:
        """Gast finden oder anlegen — über die stabile Airbnb-Gast-ID.

        `guest_id` bleibt über mehrere Buchungen desselben Gastes gleich; damit
        wird ein Stammgast wiedererkannt, obwohl Airbnb keine E-Mail liefert.
        """
        airbnb_gast = str(res.get("guest_id") or "").strip()
        code = str(res.get("confirmation_code") or "")
        if airbnb_gast:
            gefunden = resolve_or_create_guest(
                db, tenant_id,
                GuestContact(
                    channel="ota",
                    external_ref=code or None,
                    stable_external_ref=airbnb_gast,
                ),
            )
            if gefunden:
                return gefunden
        if not bestand:
            log.info("airbnb_buchung_ohne_gastmerkmal", code=code)
        return create_placeholder_guest(
            db, tenant_id, channel="ota", external_ref=code or None
        )

    @staticmethod
    def _naechte_sperren(
        db: Client, property_id: str, anreise: str, abreise: str,
        *, unit_id: str | None,
    ) -> None:
        """Belegte Nächte im Kalender setzen — auf DER Einheit der Buchung.

        Ohne `unit_id` fächert `je_einheit` bewusst auf alle Einheiten auf. Das
        ist hier nur richtig, wenn keine Einheit zugewiesen werden konnte (dann
        ist der Typ tatsächlich dicht) — sonst wäre es eine Falschsperre.
        """
        zeilen = [
            {
                "property_id": property_id,
                "date": tag,
                "status": "booked",
                "source": "airbnb",
            }
            for tag in _naechte(anreise, abreise)
        ]
        if zeilen:
            db.table("availability").upsert(
                je_einheit(db, property_id, zeilen, unit_id=unit_id),
                on_conflict=AVAILABILITY_CONFLICT,
            ).execute()

    @staticmethod
    def _naechte_freigeben(
        db: Client, property_id: str, anreise: str, abreise: str,
        *, unit_id: str | None,
    ) -> None:
        """Gegenzustand zu `_naechte_sperren` (Wurzel 1).

        Freigegeben wird nur, was zuvor als 'booked' stand — eine manuelle
        Sperre (`blocked`) oder eine Buchung aus einem anderen Kanal darf ein
        Historien-Import nicht aufreißen. Deshalb wird gezielt aktualisiert
        statt pauschal auf 'open' zu upserten.
        """
        if not (anreise and abreise):
            return
        tage = _naechte(anreise, abreise)
        if not tage:
            return
        frage = (
            db.table("availability")
            .update({"status": "open", "source": "airbnb"})
            .eq("property_id", property_id)
            .eq("status", "booked")
            .gte("date", tage[0])
            .lte("date", tage[-1])
        )
        if unit_id:
            frage = frage.eq("unit_id", unit_id)
        frage.execute()
