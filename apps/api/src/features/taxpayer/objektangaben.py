"""§ 14 Abs. 4 PStTG — die objektbezogenen Angaben des Meldedatensatzes.

Was das Gesetz je inserierter Immobilieneinheit verlangt
(gesetze-im-internet.de/psttg/__14.html):

    Nr. 1  Anschrift                                    PFLICHT
    Nr. 2  Vergütung JE QUARTAL                         PFLICHT
    Nr. 3  Anzahl relevanter Tätigkeiten                PFLICHT
    Nr. 4  Art der Einheit          „sofern vorhanden"
    Nr. 5  Anzahl der Vermietungstage „sofern vorhanden"
    Nr. 6  Grundbuchnummer          „sofern vorhanden"

Drei Entwurfsentscheidungen, die hier zusammenhängen:

1. Nr. 2, 3 und 5 werden GERECHNET, nie gespeichert. Als Spalte wären sie ab
   der ersten Stornierung falsch — und eine falsche Zahl im Meldedatensatz ist
   schlimmer als gar keine (Wurzel 1/4).

2. Die AGGREGATION nach § 6 Abs. 7 PStTG ist der eigentliche Kern. Das Gesetz
   definiert eine „inserierte Immobilieneinheit" als ALLE Objekte, die an
   derselben Anschrift liegen, demselben Eigentümer gehören und von demselben
   Anbieter angeboten werden. Ein Hotel mit 12 Zimmern ist also EINE
   Meldeeinheit, obwohl es zwölf `properties`-Zeilen sind.

   Das ist KEIN Widerspruch zum Datenmodell (1 property = 1 buchbare Einheit).
   Das Modell bleibt richtig; die Zusammenfassung passiert ausschließlich auf
   dieser Melde-Ebene und ändert nichts an Kalender, Preisen oder Kapazität.

3. Nur Buchungen, die zu einer VERGÜTUNG geführt haben, zählen. Stornierte und
   abgelehnte Buchungen sind keine „relevante Tätigkeit" — sie mitzuzählen
   würde dem Finanzamt Einkünfte melden, die es nie gab.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows

log = get_logger("nextdays.taxpayer.objektangaben")

# Blockgröße für `in_`-Filter: eine Liste mit tausenden UUIDs würde die
# PostgREST-URL sprengen.
_ID_BLOCK = 200

# Buchungsstatus, die eine „relevante Tätigkeit" nach § 5 Abs. 1 Satz 1 Nr. 1
# darstellen. Bewusst eine ALLOWLIST: käme ein neuer Status dazu, fiele er
# heraus und würde auffallen — eine Blockliste würde ihn still mitzählen.
_VERGUETETE_STATUS = frozenset({"confirmed", "completed"})

# § 14 Abs. 4 Nr. 4 — Art der Einheit. Die Kategorien stehen NICHT im PStTG,
# sondern im technischen DPI-XML-Schema der OECD (DPIPropertyType_EnumType).
# Darum hier explizit abgebildet statt geraten: ein falscher Code wäre eine
# Falschmeldung.
_DPI_ART: dict[str, str] = {
    "ferienhaus": "DPI904",       # House
    "appartement": "DPI905",      # Apartment
    "tiny_house": "DPI904",       # House
    "hausboot": "DPI908",         # Boat
    "stellplatz": "DPI909",       # Parking space
    "glamping": "DPI907",         # Campground
    "einzelzimmer": "DPI902",     # Hotel room
    "doppelzimmer": "DPI902",
    "zweibettzimmer": "DPI902",
    "familienzimmer": "DPI902",
    "junior_suite": "DPI902",
    "suite": "DPI902",
}


def _quartal(tag: date) -> int:
    return (tag.month - 1) // 3 + 1


@dataclass
class Meldeeinheit:
    """Eine inserierte Immobilieneinheit nach § 6 Abs. 7 PStTG.

    `property_ids` kann mehrere Objekte enthalten — das ist der Normalfall bei
    einem Hotel. Die Beträge sind dann bereits über alle Zimmer summiert.
    """

    # Schlüssel der Zusammenfassung (Anschrift + Eigentümer).
    anschrift: str
    country: str | None
    property_ids: list[str] = field(default_factory=list)
    owner_id: str | None = None

    # Nr. 4 — leer, wenn die Objekte uneinheitliche Typen haben: dann ist
    # keine Art „vorhanden", und das Feld entfällt (statt einen zu erfinden).
    art: str | None = None
    # Nr. 6
    land_registration_number: str | None = None

    # Nr. 2 — Vergütung je Quartal (1..4). Fehlende Quartale sind 0.
    verguetung_je_quartal: dict[int, Decimal] = field(default_factory=dict)
    # Nr. 3
    anzahl_taetigkeiten: int = 0
    # Nr. 5
    vermietete_tage: int = 0
    # Ohne Währung ist der Betrag nicht meldefähig — nie ersetzen (Wurzel 4).
    currency: str | None = None
    # True, sobald Buchungen dieser Einheit in VERSCHIEDENEN Währungen
    # abgerechnet wurden. Die Quartalssumme wäre dann eine Addition über
    # Währungsgrenzen hinweg — fachlich falsch, also nicht meldefähig.
    waehrungen_gemischt: bool = False

    @property
    def verguetung_gesamt(self) -> Decimal:
        return sum(self.verguetung_je_quartal.values(), Decimal(0))

    @property
    def meldefaehig(self) -> bool:
        """Ob diese Einheit ohne Datenfehler gemeldet werden kann.

        Anschrift (Nr. 1) und Währung sind unverzichtbar. Die „sofern
        vorhanden"-Felder dürfen fehlen — das ist der Gesetzeswortlaut, kein
        Mangel. Gemischte Währungen machen die Summe unbrauchbar.
        """
        return (
            bool(self.anschrift)
            and bool(self.country)
            and bool(self.currency)
            and not self.waehrungen_gemischt
        )


class ObjektangabenService:
    """Erzeugt die objektbezogenen Angaben für einen Meldezeitraum."""

    def __init__(self, db: Client) -> None:
        self._db = db

    def fuer_jahr(self, ctx: AuthContext, jahr: int) -> list[Meldeeinheit]:
        """Alle Meldeeinheiten eines Betriebs für ein Kalenderjahr.

        Der Meldezeitraum ist nach § 6 Abs. 6 PStTG stets das Kalenderjahr.
        """
        tenant_id = self._tenant(ctx)
        objekte = self._objekte(tenant_id)
        if not objekte:
            return []

        einheiten = self._zusammenfassen(objekte)
        self._buchungen_zuordnen(tenant_id, jahr, objekte, einheiten)
        return sorted(einheiten.values(), key=lambda e: e.anschrift)

    # -- Schritt 1: Objekte laden ------------------------------------------

    def _objekte(self, tenant_id: str) -> dict[str, dict]:
        # fetch_all_rows statt .execute(): PostgREST cappt bei 1000 Zeilen. Ein
        # abgeschnittener Objektbestand meldet zu wenig Vergütung/Tätigkeiten,
        # ohne dass es auffällt — bei einer bußgeldbewehrten Meldung (§ 25
        # Abs. 1 Nr. 6 PStTG) inakzeptabel.
        rows = fetch_all_rows(
            self._db.table("properties")
            .select(
                "id, title, street, postal_code, city, country, property_type, "
                "land_registration_number, land_registration_unavailable"
            )
            .eq("tenant_id", tenant_id)
            .order("id")
        )
        eigentuemer = self._eigentuemer([r["id"] for r in rows])
        for r in rows:
            r["owner_id"] = eigentuemer.get(r["id"])
        return {r["id"]: r for r in rows}

    def _eigentuemer(self, property_ids: list[str]) -> dict[str, str]:
        """property_id → owner_id. Ein Objekt hat genau EINEN Eigentümer.

        Quelle ist `owner_properties` (das tatsächliche EIGENTUM), nicht
        `owner_property_assignments` — letzteres regelt nur, welcher Nutzer das
        Objekt im Eigentümerportal SIEHT. § 6 Abs. 7 PStTG stellt auf den
        Eigentümer ab, nicht auf einen Portalzugang.
        """
        if not property_ids:
            return {}
        # In Blöcken: eine `in_`-Liste mit tausenden UUIDs sprengt die URL-Länge,
        # und ohne Pagination cappt PostgREST die Antwort bei 1000 Zeilen —
        # fehlende Eigentümer wären ein stiller Fehler in der Steuermeldung.
        zuordnung: dict[str, str] = {}
        for i in range(0, len(property_ids), _ID_BLOCK):
            block = property_ids[i : i + _ID_BLOCK]
            rows = fetch_all_rows(
                self._db.table("owner_properties")
                .select("property_id, owner_id")
                .in_("property_id", block)
                .order("property_id")
            )
            zuordnung.update({r["property_id"]: r["owner_id"] for r in rows})
        return zuordnung

    # -- Schritt 2: § 6 Abs. 7 — zusammenfassen ----------------------------

    @staticmethod
    def _schluessel(objekt: dict) -> tuple[str, str, str]:
        """Die drei kumulativen Kriterien aus § 6 Abs. 7 PStTG.

        Die Anschrift wird normalisiert (klein, ohne Randleerzeichen), sonst
        trennte „Hauptstr. 1 " von „hauptstr. 1" zwei Meldeeinheiten, die das
        Gesetz als eine sieht.
        """
        anschrift = " ".join(
            str(objekt.get(feld) or "").strip()
            for feld in ("street", "postal_code", "city")
        ).strip().lower()
        return (
            anschrift,
            (objekt.get("country") or "").upper(),
            objekt.get("owner_id") or "",
        )

    def _zusammenfassen(self, objekte: dict[str, dict]) -> dict[tuple, Meldeeinheit]:
        einheiten: dict[tuple, Meldeeinheit] = {}
        for objekt in objekte.values():
            schluessel = self._schluessel(objekt)
            einheit = einheiten.get(schluessel)
            if einheit is None:
                einheit = Meldeeinheit(
                    anschrift=", ".join(
                        teil
                        for teil in (
                            objekt.get("street"),
                            " ".join(
                                t
                                for t in (
                                    objekt.get("postal_code"),
                                    objekt.get("city"),
                                )
                                if t
                            ).strip(),
                        )
                        if teil
                    ),
                    country=(objekt.get("country") or "").upper() or None,
                    owner_id=objekt.get("owner_id"),
                )
                einheiten[schluessel] = einheit
            erstes = not einheit.property_ids
            einheit.property_ids.append(objekt["id"])
            self._art_setzen(einheit, objekt, erstes=erstes)
            self._grundbuch_setzen(einheit, objekt)
        return einheiten

    @staticmethod
    def _art_setzen(
        einheit: Meldeeinheit, objekt: dict, *, erstes: bool
    ) -> None:
        """Nr. 4 — nur setzen, wenn alle Objekte der Einheit dieselbe Art
        haben. Bei gemischten Typen ist keine Art „vorhanden"."""
        art = _DPI_ART.get(objekt.get("property_type") or "")
        if erstes:
            einheit.art = art
        elif einheit.art != art:
            einheit.art = None

    @staticmethod
    def _grundbuch_setzen(einheit: Meldeeinheit, objekt: dict) -> None:
        """Nr. 6 — die erste vorhandene Nummer gilt für die Einheit.

        Bei einem Hotel tragen alle Zimmer dieselbe Nummer (dasselbe
        Grundstück). Widersprechen sie sich, gewinnt die erste — eine
        Zusammenführung widersprüchlicher Grundbuchnummern wäre erfunden.
        """
        if einheit.land_registration_number is None:
            einheit.land_registration_number = objekt.get(
                "land_registration_number"
            )

    # -- Schritt 3: Buchungen zuordnen -------------------------------------

    def _buchungen_zuordnen(
        self,
        tenant_id: str,
        jahr: int,
        objekte: dict[str, dict],
        einheiten: dict[tuple, Meldeeinheit],
    ) -> None:
        """Nr. 2, 3 und 5 aus den Buchungen des Meldezeitraums rechnen.

        Zuordnung über das ZAHLUNGSDATUM, nicht über den Anreisetag.
        Anhang V Abschnitt III.A.7 der RL (EU) 2021/514 stellt ausdrücklich
        auf den Zeitpunkt ab, zu dem die Vergütung „gezahlt oder
        gutgeschrieben" wurde. Bei einer Buchung, die im März bezahlt wird und
        im April stattfindet, wären das zwei verschiedene Quartale — die
        Anreise-Konvention lieferte dem Finanzamt die falsche Zeile.

        Ohne erfasste Zahlung gibt es keine Vergütung im Rechtssinn; die
        Buchung zählt dann in KEIN Quartal (statt sie zu raten, Wurzel 4).
        """
        # fetch_all_rows: ohne Pagination lieferte PostgREST höchstens 1000
        # Buchungen — die Jahressumme wäre still zu niedrig (s. _objekte).
        rows = fetch_all_rows(
            self._db.table("reservations")
            .select(
                "id, property_id, status, check_in, check_out, total_amount, "
                "currency"
            )
            .eq("tenant_id", tenant_id)
            # Der Zeitraum wird über die ZAHLUNG bestimmt, nicht über die
            # Anreise. Darum hier ein grosszuegiges Fenster (eine im Dezember
            # bezahlte Buchung kann im Februar des Folgejahres stattfinden)
            # und die scharfe Abgrenzung erst ueber das Zahlungsdatum.
            .gte("check_in", f"{jahr - 1}-01-01")
            .lte("check_in", f"{jahr + 1}-12-31")
            .in_("status", sorted(_VERGUETETE_STATUS))
            .order("id")
        )

        zahlungen = self._zahlungen_je_buchung(
            [r["id"] for r in rows], jahr
        )

        nach_property: dict[str, list[dict]] = defaultdict(list)
        for r in rows:
            nach_property[r["property_id"]].append(r)

        for einheit in einheiten.values():
            for property_id in einheit.property_ids:
                for buchung in nach_property.get(property_id, []):
                    self._buchung_verbuchen(
                        einheit, buchung, zahlungen.get(buchung["id"], [])
                    )

        # Nicht zuordenbare Buchungen wären ein stiller Datenverlust in einer
        # Steuermeldung — deshalb sichtbar machen (Wurzel 5).
        bekannt = set(objekte)
        verwaist = {r["property_id"] for r in rows} - bekannt
        if verwaist:
            log.warning(
                "dac7_buchung_ohne_objekt",
                tenant_id=tenant_id,
                jahr=jahr,
                property_ids=sorted(verwaist),
            )

        gemischt = [e.anschrift for e in einheiten.values() if e.waehrungen_gemischt]
        if gemischt:
            log.warning(
                "dac7_gemischte_waehrungen",
                tenant_id=tenant_id,
                jahr=jahr,
                anschriften=sorted(gemischt),
            )

    def _zahlungen_je_buchung(
        self, reservation_ids: list[str], jahr: int
    ) -> dict[str, list[dict]]:
        """reservation_id → Zahlungen DIESES Meldezeitraums.

        Nur erfolgreiche Zahlungen: eine erstattete Zahlung ist keine
        Vergütung, die dem Anbieter zugeflossen ist.
        """
        if not reservation_ids:
            return {}
        zahlungen: dict[str, list[dict]] = defaultdict(list)
        for i in range(0, len(reservation_ids), _ID_BLOCK):
            block = reservation_ids[i : i + _ID_BLOCK]
            rows = fetch_all_rows(
                self._db.table("payments")
                .select("reservation_id, amount, currency, created_at")
                .in_("reservation_id", block)
                .eq("status", "succeeded")
                .gte("created_at", f"{jahr}-01-01")
                .lt("created_at", f"{jahr + 1}-01-01")
                .order("id")
            )
            for r in rows:
                zahlungen[r["reservation_id"]].append(r)
        return zahlungen

    @staticmethod
    def _buchung_verbuchen(
        einheit: Meldeeinheit, buchung: dict, zahlungen: list[dict]
    ) -> None:
        """Eine Buchung mit ihren Zahlungen verbuchen.

        Ohne Zahlung im Meldezeitraum passiert NICHTS: Nr. 2 verlangt die
        „gezahlte oder gutgeschriebene" Vergütung. Eine bestätigte, aber
        unbezahlte Buchung ist keine.
        """
        if not zahlungen:
            return

        anreise = date.fromisoformat(buchung["check_in"])
        abreise = date.fromisoformat(buchung["check_out"])

        for zahlung in zahlungen:
            quartal = _quartal(
                datetime.fromisoformat(zahlung["created_at"]).date()
            )
            betrag = Decimal(str(zahlung["amount"]))
            einheit.verguetung_je_quartal[quartal] = (
                einheit.verguetung_je_quartal.get(quartal, Decimal(0)) + betrag
            )

            # Die Währung kommt aus der ZAHLUNG, nicht aus der Buchung —
            # Abschnitt III.A.6 verlangt die Meldung „in der Währung, in der
            # gezahlt oder gutgeschrieben wurde". Wich sie von der Buchung ab,
            # wäre das Label falsch. Gemischte Währungen an einer Anschrift
            # markieren die Einheit als nicht meldefähig, statt über
            # Währungsgrenzen zu summieren (Wurzel 4).
            waehrung = zahlung.get("currency")
            if not waehrung:
                continue
            if einheit.currency is None:
                einheit.currency = waehrung
            elif einheit.currency != waehrung:
                einheit.waehrungen_gemischt = True

        # Tätigkeit und Nächte hängen an der BUCHUNG, nicht an der Zahl der
        # Zahlungen: eine in zwei Raten bezahlte Buchung ist eine Tätigkeit.
        einheit.anzahl_taetigkeiten += 1
        einheit.vermietete_tage += (abreise - anreise).days

    # -- Intern ------------------------------------------------------------

    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            msg = "Kein Betrieb im Kontext."
            raise ValueError(msg)
        return ctx.tenant_id
