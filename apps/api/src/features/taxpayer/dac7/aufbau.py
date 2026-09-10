"""Baut aus den Daten eines Betriebs die Meldung.

MASSGEBLICH IST DIE AMTLICHE CSV-VORLAGE von Skattestyrelsen, sonst nichts.
Ihre Struktur ist:

    Message
      PO_Platform_Operator                      der meldende Betrieb
        RS_IND_Individual_Seller  (Person)      der Verkaeufer
          ACT_Immovable_Property                je vermietete Immobilie
          ACT_Immovable_Property                    eine Zeile
        RS_ENT_Entity_Seller      (Firma)
          ACT_Immovable_Property

Verknuepft wird ueber RS_DOC_REF_ID: Alle Zeilen eines Verkaeufers tragen
dieselbe Kennung. Genau so steht es im Beispielblatt der Vorlage.

Ein Verkaeufer ist laut Glossar der Vorlage "en bruger af en platform, der
saelger aktiviteter igennem denne" — ein Nutzer der Plattform, der ueber sie
Taetigkeiten verkauft. Die Vorlage kennt KEINEN Eigentuemer; das Wort kommt
in ihr nicht vor. Es wird deshalb auch hier nicht verwendet.

DER SCOPE WIRD HIER ERZWUNGEN. Der Service-Client umgeht RLS, deshalb trägt
jede Abfrage ihren `tenant_id`-Filter selbst. Eine Steuermeldung, die Daten
eines fremden Betriebs enthielte, wäre der denkbar schlimmste Fall.

ALLES ODER NICHTS. Fehlt eine Pflichtangabe, entsteht keine Datei — der
Prüfbericht sagt, wem welches Feld fehlt. Das ist Absicht: Eine Meldung mit
geratenen Werten ist gegenüber einer Behörde schlimmer als gar keine.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from .daenemark import cvr_aus_vat_id, steuernummer_pruefen
from .kanaele import Meldungsart
from .kennungen import anbieterkennung, nachrichtenkennung, satzkennung
from .modell import (
    Anbieter,
    Anschrift,
    DaenischerAnhang,
    Finanzkonto,
    Meldung,
    Plattformbetreiber,
    Pruefbericht,
    Steuernummer,
    Vermietung,
)
from .rechner import (
    VERGUETETE_STATUS,
    Buchungswerte,
    brutto_mieteinnahme,
    buchung_verbuchen,
    buchungen_auswaehlen,
)

log = get_logger("nextdays.dac7.aufbau")

# Blockgröße für `in_`-Filter: eine Liste mit tausenden Kennungen sprengt die
# Länge der PostgREST-Anfrage.
_ID_BLOCK = 200

# Abbildung unserer Objekttypen auf die OECD-Codes. Ein falscher Code wäre
# eine Falschmeldung, deshalb ausgeschrieben statt abgeleitet.
_OBJEKTART: dict[str, str] = {
    "ferienhaus": "DPI904",
    "tiny_house": "DPI904",
    "appartement": "DPI905",
    "hausboot": "DPI908",
    "stellplatz": "DPI909",
    "glamping": "DPI907",
    "einzelzimmer": "DPI902",
    "doppelzimmer": "DPI902",
    "zweibettzimmer": "DPI902",
    "familienzimmer": "DPI902",
    "junior_suite": "DPI902",
    "suite": "DPI902",
}

_OBJEKT_SPALTEN = (
    "id, title, street, postal_code, city, country, property_type, "
    "land_registration_number, land_registration_unavailable, bfe_number"
)

_BUCHUNG_SPALTEN = (
    "id, property_id, status, channel, check_in, check_out, booked_at, "
    "total_amount, paid_amount, currency, ota_commission, channel_fee"
)


@dataclass(frozen=True, slots=True)
class _Objektzeile:
    """Eine vermietete Immobilie — eine ACT_Immovable_Property-Zeile.

    Die Vorlage fuehrt je vermieteter Immobilie genau eine Zeile unter dem
    Verkaeufer (Beispielblatt: derselbe Seller, zwei Zeilen fuer
    Fredericia und Aarhus). Deshalb ein Objekt = eine Zeile, ohne
    Zusammenfassung.
    """

    property_id: str
    anschrift: Anschrift
    objektart: str | None
    # RS_ACT_LAND_REG_NUM — Matrikelnummer (Text).
    grundbuchnummer: str | None
    # RS_ACT_DK_REAL_PROP_REG_NUM — BFE-Nummer (Integer). Eigenes Feld:
    # die Anleitung fuehrt beide getrennt.
    bfe_nummer: str | None


def _als_datum(wert: object) -> date | None:
    """Ein Datum aus der Datenbank lesen, ohne bei Unsinn zu werfen.

    Gibt `None` zurueck statt zu raten — die Pruefung meldet das fehlende
    Geburtsdatum dann als das, was es ist.
    """
    if isinstance(wert, date):
        return wert
    if not isinstance(wert, str) or not wert:
        return None
    try:
        return date.fromisoformat(wert[:10])
    except ValueError:
        return None


def _namen_trennen(voller_name: str | None) -> tuple[str | None, str | None]:
    """Einen zusammenhängenden Namen in Vor- und Nachname zerlegen.

    Unsere `owners`-Tabelle führt EIN Namensfeld, die Meldung verlangt zwei.
    Getrennt wird am LETZTEN Leerzeichen: Vorname kann mehrteilig sein
    („Anna Maria Jensen" → „Anna Maria" / „Jensen"), ein Nachname ist in den
    hier vorkommenden Namen der letzte Bestandteil.

    Das ist eine Heuristik und als solche benannt. Sie ist der Grund, warum
    die Oberfläche den erkannten Vor- und Nachnamen ANZEIGT, bevor gemeldet
    wird — bei Doppelnachnamen liegt sie daneben, und das muss ein Mensch
    sehen können, statt es der Behörde zu überlassen.
    """
    if not voller_name:
        return None, None
    teile = voller_name.strip().split()
    if not teile:
        return None, None
    if len(teile) == 1:
        # Ein einzelner Name ist der Nachname; einen Vornamen zu erfinden
        # wäre schlimmer als das Feld leer zu lassen.
        return None, teile[0]
    return " ".join(teile[:-1]), teile[-1]


def _kontokennung(person: dict) -> Finanzkonto | None:
    """Die Kennung des Kontos, auf das die Vergütung fließt.

    Dänische Konten werden als Registriernummer plus Kontonummer geführt,
    international als IBAN. Beides ist zulässig; die Art wird mitgemeldet,
    damit die Behörde die Kennung deuten kann.
    """
    reg = (person.get("bank_reg_nr") or "").strip()
    konto = (person.get("bank_konto_nr") or "").strip()
    if reg and konto:
        return Finanzkonto(
            kennung=f"{reg}-{konto}",
            art="Reg.nr. og kontonr.",
            inhaber=person.get("account_holder"),
        )
    iban = (person.get("iban") or "").strip()
    if iban:
        return Finanzkonto(
            kennung=iban, art="IBAN", inhaber=person.get("account_holder")
        )
    return None


def _strasse_mit_hausnummer(profil: dict) -> str | None:
    """Strasse und Hausnummer des Rechnungsprofils zu einem Feld.

    Die Vorlage fuehrt `ADDR_STREET` und `ADDR_BUILDING` getrennt; das
    Rechnungsprofil ebenso. Diese Funktion bedient den Fall, in dem nur
    ein einzelnes Anschriftsfeld gefuellt werden kann.
    """
    teile = [
        (profil.get("company_street") or "").strip(),
        (profil.get("company_house_number") or "").strip(),
    ]
    return " ".join(t for t in teile if t) or None


def _anschrift_aus_objekt(objekt: dict) -> Anschrift:
    return Anschrift(
        land=(objekt.get("country") or "").upper(),
        strasse=objekt.get("street"),
        plz=objekt.get("postal_code"),
        ort=objekt.get("city"),
    )


class MeldungsAufbau:
    """Erzeugt eine Meldung aus dem Datenbestand eines Betriebs."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Öffentlich ---------------------------------------------------------

    def bauen(
        self,
        *,
        tenant_id: str,
        jahr: int,
        art: Meldungsart,
        behoerde_land: str = "DK",
        referenz: str,
    ) -> tuple[Meldung | None, Pruefbericht]:
        """Die Meldung eines Betriebs für ein Kalenderjahr.

        Gibt `(None, bericht)` zurück, wenn eine Pflichtangabe fehlt — der
        Bericht nennt dann Anbieter und Feld. Sonst `(meldung, bericht)`,
        wobei der Bericht die Hinweise und die Ausschlussgründe trägt.
        """
        bericht = Pruefbericht()

        betreiber_zeile = self._betrieb(tenant_id)
        if betreiber_zeile is None:
            bericht.fehler_melden(
                "Betrieb", "tenant", "Betrieb nicht gefunden"
            )
            return None, bericht

        betreiber = self._betreiber_bauen(
            tenant_id, betreiber_zeile, jahr, behoerde_land, referenz, bericht
        )
        if betreiber is None:
            return None, bericht

        anbieter = self._anbieter_bauen(
            tenant_id=tenant_id,
            jahr=jahr,
            art=art,
            behoerde_land=behoerde_land,
            betreiber_steuernummer=self._steuernummer_text(betreiber),
            bericht=bericht,
        )

        meldung = Meldung(
            melde_ref_id=nachrichtenkennung(
                behoerde_land, jahr, self._steuernummer_text(betreiber), referenz
            ),
            jahr=jahr,
            meldeart="DPI403" if not anbieter else "DPI401",
            betreiber=betreiber,
            anbieter=tuple(anbieter),
        )
        return meldung, bericht

    # -- Betreiber ----------------------------------------------------------

    def _betrieb(self, tenant_id: str) -> dict | None:
        antwort = (
            self._db.table("tenants")
            .select("id, name, country")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        return antwort.data[0] if antwort.data else None

    def _steuerangaben(self, tenant_id: str, land: str) -> dict | None:
        """Die Selbstauskunft des Betriebs für ein Land."""
        antwort = (
            self._db.table("taxpayer_info")
            .select(
                "country, kind, tin, legal_name, first_name, last_name, "
                "address_line1, postal_code, city, nexus"
            )
            .eq("tenant_id", tenant_id)
            .eq("country", land)
            .limit(1)
            .execute()
        )
        if antwort.data:
            return antwort.data[0]
        return self._steuerangaben_aus_rechnungsprofil(tenant_id, land)

    def _steuerangaben_aus_rechnungsprofil(
        self, tenant_id: str, land: str
    ) -> dict | None:
        """In Dänemark ersetzt die USt-IdNr. die separate Selbstauskunft.

        Ein dänischer Betrieb hat KEINE eigene Steuernummer neben seiner
        CVR-Nummer: CVR = SE = TIN, und die USt-IdNr. ist dieselbe Zahl mit
        vorangestelltem `DK`. Der Feldkommentar der Vorlage sagt es für
        beide Felder — `TIN`: „For danske virksomheder angives et CVR/SE
        nummer", `VAT`: „I Danmark er det tilsvarende
        momsregistreringsnummeret dvs. SE nummer" — und die echte Meldung
        im Blatt `Indberetning` trägt in `TIN` genau die CVR ohne Präfix
        (`44179377`), während das Feld `IN` leer bleibt.

        Deshalb wird die Nummer hier abgeleitet statt ein zweites Mal
        erfragt. Zwei Erfassungsorte für dieselbe Zahl liefen auseinander
        (Wurzel 4), und eine Pflichtangabe, die der Betrieb längst gemacht
        hat, darf die Meldung nicht blockieren.

        NUR für Dänemark: In anderen Ländern sind USt-IdNr. und
        Steuernummer verschiedene Dinge, dort bleibt die Selbstauskunft
        Pflicht.
        """
        if land.upper() != "DK":
            return None
        profil = self._rechnungsprofil(tenant_id)
        if profil is None:
            return None
        cvr = cvr_aus_vat_id(profil.get("vat_id"))
        if not cvr:
            return None
        return {
            "country": land,
            "kind": "entity",
            "tin": cvr,
            "legal_name": profil.get("legal_name"),
            "address_line1": _strasse_mit_hausnummer(profil),
            "postal_code": profil.get("company_postal_code"),
            "city": profil.get("company_city"),
            "herkunft": "tenant_billing_profile.vat_id",
        }

    def _rechnungsprofil(self, tenant_id: str) -> dict | None:
        """Das Rechnungsprofil — Quelle der USt-IdNr. und der Anschrift."""
        rows = (
            self._db.table("tenant_billing_profile")
            .select(
                "vat_id, legal_name, company_street, company_house_number, "
                "company_postal_code, company_city, company_country"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _betreiber_bauen(
        self,
        tenant_id: str,
        betrieb: dict,
        jahr: int,
        behoerde_land: str,
        referenz: str,
        bericht: Pruefbericht,
    ) -> Plattformbetreiber | None:
        """Den meldenden Plattformbetreiber aus den Stammdaten bilden.

        Ohne erfasste Steuerangaben kann nicht gemeldet werden — die
        Steuernummer des Betreibers steht in jeder Kennung der Datei.
        """
        angaben = self._steuerangaben(tenant_id, behoerde_land)
        if angaben is None:
            bericht.fehler_melden(
                f"Betrieb {betrieb.get('name') or tenant_id}",
                "taxpayer_info",
                f"keine Steuerangaben für {behoerde_land} erfasst — "
                "ohne sie kann keine Meldung erzeugt werden",
            )
            return None

        # Die Nummer des Betreibers steht in JEDER Kennung der Datei
        # (Nachricht, Betreibersatz, jeder Anbietersatz). Ein Fehler hier
        # macht die ganze Datei unbrauchbar, nicht nur eine Zeile —
        # deshalb wird sie ebenso geprüft wie die der Anbieter.
        ist_person = angaben.get("kind") == "individual"
        pruefung = steuernummer_pruefen(
            angaben.get("tin"), ist_person=ist_person
        )
        if not pruefung.gueltig:
            bericht.fehler_melden(
                f"Betrieb {betrieb.get('name') or tenant_id}",
                "TIN",
                f"{pruefung.art}-Nummer des Betriebs: {pruefung.grund}",
            )
            return None
        steuernummer = pruefung.wert or ""

        name = angaben.get("legal_name") or betrieb.get("name") or ""
        return Plattformbetreiber(
            doc_ref_id=satzkennung(behoerde_land, jahr, steuernummer, referenz),
            name=name,
            ansaessig_in=(behoerde_land,),
            steuernummern=(
                Steuernummer(wert=steuernummer, ausgestellt_von=behoerde_land),
            ),
            anschrift=Anschrift(
                land=behoerde_land,
                strasse=angaben.get("address_line1"),
                plz=angaben.get("postal_code"),
                ort=angaben.get("city"),
                # Der eingetragene Sitz — die Vorlage erwartet ihn hier.
                art="OECD304",
            ),
            # Der Grund der Meldepflicht kommt aus der Selbstauskunft. Nur
            # wenn er dort fehlt, gilt die Ansässigkeit im Meldeland
            # (RPONEX1) — sie ist der Regelfall und folgt daraus, dass die
            # Steuerangaben ueberhaupt fuer dieses Land erfasst wurden.
            nexus=(angaben.get("nexus") or "RPONEX1"),
        )

    @staticmethod
    def _steuernummer_text(betreiber: Plattformbetreiber) -> str:
        return betreiber.steuernummern[0].wert or ""

    # -- Anbieter und Tätigkeiten -------------------------------------------

    def _objekte(self, tenant_id: str) -> list[dict]:
        # fetch_all_rows statt execute(): PostgREST cappt bei 1000 Zeilen, und
        # ein abgeschnittener Objektbestand meldete zu wenig, ohne dass es
        # auffiele.
        return fetch_all_rows(
            self._db.table("properties")
            .select(_OBJEKT_SPALTEN)
            .eq("tenant_id", tenant_id)
            .order("id")
        )

    def _verkaeufer_je_objekt(
        self, property_ids: list[str], bericht: Pruefbericht
    ) -> dict[str, str]:
        """property_id -> Kennung des Verkaeufers.

        Der Verkaeufer ist nach dem Glossar der Vorlage der Nutzer der
        Plattform, der ueber sie vermietet. Bei uns ist das die Person oder
        Firma, in deren Namen das Objekt vermietet wird — gefuehrt in
        `owners`, verknuepft ueber `owner_properties`.

        Traegt ein Objekt mehrere solche Eintraege, laesst sich nicht
        bestimmen, wer der Verkaeufer ist; das meldet der Bericht, statt
        einen zu waehlen.
        """
        if not property_ids:
            return {}

        zeilen: list[dict] = []
        for start in range(0, len(property_ids), _ID_BLOCK):
            block = property_ids[start : start + _ID_BLOCK]
            zeilen.extend(
                fetch_all_rows(
                    self._db.table("owner_properties")
                    .select("property_id, owner_id")
                    .in_("property_id", block)
                    .order("property_id")
                )
            )

        je_objekt: dict[str, list[str]] = {}
        for zeile in zeilen:
            je_objekt.setdefault(zeile["property_id"], []).append(
                zeile["owner_id"]
            )

        zuordnung: dict[str, str] = {}
        for kennung, verkaeufer in je_objekt.items():
            eindeutig = sorted(set(verkaeufer))
            if len(eindeutig) == 1:
                zuordnung[kennung] = eindeutig[0]
                continue
            bericht.fehler_melden(
                f"Objekt {kennung}",
                "RS_DOC_REF_ID",
                f"{len(eindeutig)} Verkaeufer am Objekt hinterlegt — die "
                "Vorlage fuehrt jede Immobilie unter genau einem Verkaeufer",
            )
        return zuordnung

    def _verkaeufer_stammdaten(self, verkaeufer_ids: list[str]) -> dict[str, dict]:
        """Die Stammdaten der Verkaeufer, aus denen die RS-Zeile entsteht."""
        if not verkaeufer_ids:
            return {}
        stammdaten: dict[str, dict] = {}
        for start in range(0, len(verkaeufer_ids), _ID_BLOCK):
            block = verkaeufer_ids[start : start + _ID_BLOCK]
            for zeile in fetch_all_rows(
                self._db.table("owners")
                .select(
                    "id, name, company, email, street, house_number, "
                    "postal_code, city, country, tax_id, cpr_number, "
                    "date_of_birth, iban, bank_reg_nr, bank_konto_nr, "
                    "account_holder"
                )
                .in_("id", block)
                .order("id")
            ):
                stammdaten[zeile["id"]] = zeile
        return stammdaten

    def _buchungen(self, tenant_id: str, jahr: int) -> list[dict]:
        """Buchungen, deren Vergütung in das Meldejahr fallen kann.

        Das Fenster ist bewusst weit: Maßgeblich ist der Zeitpunkt der
        Zahlung, nicht die Anreise. Eine im Dezember bezahlte Buchung kann im
        Februar des Folgejahres stattfinden — die scharfe Abgrenzung macht
        der Rechner.
        """
        return fetch_all_rows(
            self._db.table("reservations")
            .select(_BUCHUNG_SPALTEN)
            .eq("tenant_id", tenant_id)
            .gte("check_in", f"{jahr - 1}-01-01")
            .lte("check_in", f"{jahr + 1}-12-31")
            .in_("status", sorted(VERGUETETE_STATUS))
            .order("id")
        )

    def _zahlungen(self, reservation_ids: list[str], jahr: int) -> dict[str, list[dict]]:
        """reservation_id → erfolgreiche Zahlungen des Meldejahres."""
        if not reservation_ids:
            return {}
        zahlungen: dict[str, list[dict]] = {}
        for start in range(0, len(reservation_ids), _ID_BLOCK):
            block = reservation_ids[start : start + _ID_BLOCK]
            for zeile in fetch_all_rows(
                self._db.table("payments")
                .select("reservation_id, amount, currency, created_at")
                .in_("reservation_id", block)
                .eq("status", "succeeded")
                .gte("created_at", f"{jahr}-01-01")
                .lt("created_at", f"{jahr + 1}-01-01")
                .order("id")
            ):
                zahlungen.setdefault(zeile["reservation_id"], []).append(zeile)
        return zahlungen

    def _objektzeilen_bilden(
        self, objekte: list[dict]
    ) -> dict[str, _Objektzeile]:
        """Je Objekt eine Zeile — so fuehrt es die Vorlage.

        Im Beispielblatt stehen unter EINEM Verkaeufer zwei
        ACT_Immovable_Property-Zeilen (Fredericia und Aarhus). Es gibt dort
        keine Zusammenfassung mehrerer Objekte zu einer Zeile.
        """
        zeilen: dict[str, _Objektzeile] = {}
        for objekt in objekte:
            zeilen[objekt["id"]] = _Objektzeile(
                property_id=objekt["id"],
                anschrift=_anschrift_aus_objekt(objekt),
                objektart=_OBJEKTART.get(objekt.get("property_type") or ""),
                grundbuchnummer=objekt.get("land_registration_number"),
                bfe_nummer=objekt.get("bfe_number"),
            )
        return zeilen

    def _anbieter_bauen(
        self,
        *,
        tenant_id: str,
        jahr: int,
        art: Meldungsart,
        behoerde_land: str,
        betreiber_steuernummer: str,
        bericht: Pruefbericht,
    ) -> list[Anbieter]:
        """Die Verkaeufer samt ihren Aktivitaetszeilen."""
        objekte = self._objekte(tenant_id)
        if not objekte:
            return []

        verkaeufer_je_objekt = self._verkaeufer_je_objekt(
            [o["id"] for o in objekte], bericht
        )
        objektzeilen = self._objektzeilen_bilden(objekte)

        alle_buchungen = self._buchungen(tenant_id, jahr)
        gewaehlt = buchungen_auswaehlen(alle_buchungen, art, bericht)
        zahlungen = self._zahlungen([b["id"] for b in gewaehlt], jahr)

        # Werte je OBJEKT sammeln — eine Zeile der Datei je Objekt.
        werte_je_objekt: dict[str, Buchungswerte] = {}
        for buchung in gewaehlt:
            property_id = buchung.get("property_id")
            if property_id not in objektzeilen:
                bericht.ausschluss_zaehlen(
                    "Buchung verweist auf ein Objekt ausserhalb des Betriebs"
                )
                continue
            werte = werte_je_objekt.setdefault(property_id, Buchungswerte())
            buchung_verbuchen(
                werte, buchung, jahr, bericht, zahlungen.get(buchung["id"], [])
            )

        # Objekte ihren Verkaeufern zuordnen.
        je_verkaeufer: dict[str, list[tuple[_Objektzeile, Buchungswerte]]] = {}
        for property_id, werte in werte_je_objekt.items():
            if not werte.hat_werte:
                continue
            verkaeufer_id = verkaeufer_je_objekt.get(property_id)
            if not verkaeufer_id:
                bericht.fehler_melden(
                    f"Objekt {property_id}",
                    "RS_DOC_REF_ID",
                    "kein Verkaeufer hinterlegt — die Vorlage verlangt zu "
                    "jeder Immobilie den Verkaeufer",
                )
                continue
            je_verkaeufer.setdefault(verkaeufer_id, []).append(
                (objektzeilen[property_id], werte)
            )

        stammdaten = self._verkaeufer_stammdaten(sorted(je_verkaeufer))

        anbieter: list[Anbieter] = []
        # Feste Reihenfolge: derselbe Lauf muss dieselbe Datei ergeben.
        for laufend, verkaeufer_id in enumerate(sorted(je_verkaeufer), start=1):
            person = stammdaten.get(verkaeufer_id)
            if person is None:
                bericht.fehler_melden(
                    f"Verkaeufer {verkaeufer_id}",
                    "owners",
                    "Stammdaten nicht gefunden",
                )
                continue
            gebaut = self._einen_anbieter_bauen(
                person=person,
                objekte_mit_werten=je_verkaeufer[verkaeufer_id],
                kennung=anbieterkennung(
                    behoerde_land, jahr, betreiber_steuernummer, laufend
                ),
                bericht=bericht,
            )
            if gebaut is not None:
                anbieter.append(gebaut)
        return anbieter

    def _einen_anbieter_bauen(
        self,
        *,
        person: dict,
        objekte_mit_werten: list[tuple[_Objektzeile, Buchungswerte]],
        kennung: str,
        bericht: Pruefbericht,
    ) -> Anbieter | None:
        vorname, nachname = _namen_trennen(person.get("name"))
        bezeichnung = person.get("company") or person.get("name") or person["id"]
        betrifft = f"Verkaeufer {bezeichnung}"

        land = (person.get("country") or "").upper()
        if not land:
            bericht.fehler_melden(
                betrifft, "RESIDENCE", "Ansässigkeitsstaat nicht erfasst"
            )
            return None

        ist_firma = bool(person.get("company"))

        # Welche Nummer gilt, entscheidet die ART des Anbieters, nicht das
        # Feld, in dem etwas steht: In Dänemark meldet eine Privatperson
        # ihre CPR-Nummer, eine Gesellschaft ihre CVR-/SE-Nummer. Die Nummer
        # wird dabei normalisiert (der Bindestrich einer CPR-Nummer gehört
        # nicht in die Datei) und auf Format bzw. Prüfziffer geprüft.
        # Eine Gesellschaft trägt ihre Nummer in `tax_id` (CVR/SE), eine
        # Person ihre in `cpr_number`. Steht bei einer Person nur `tax_id`,
        # wird sie als CPR gedeutet und geprüft — passt sie nicht, sagt der
        # Bericht das, statt eine Firmennummer für einen Menschen zu melden.
        roh = (
            person.get("tax_id")
            if ist_firma
            else (person.get("cpr_number") or person.get("tax_id"))
        )
        pruefung = steuernummer_pruefen(roh, ist_person=not ist_firma)
        if not pruefung.gueltig:
            bericht.fehler_melden(
                betrifft,
                "TIN",
                f"{pruefung.art}-Nummer: {pruefung.grund}",
            )
            return None
        steuernummer = pruefung.wert or ""

        taetigkeiten = self._taetigkeiten_bauen(
            objekte_mit_werten, betrifft, bericht
        )
        if not taetigkeiten:
            return None

        konto = _kontokennung(person)
        return Anbieter(
            doc_ref_id=kennung,
            ist_person=not ist_firma,
            ansaessig_in=(land,),
            steuernummern=(
                Steuernummer(wert=steuernummer, ausgestellt_von=land),
            ),
            anschrift=Anschrift(
                land=land,
                strasse=person.get("street"),
                hausnummer=person.get("house_number"),
                plz=person.get("postal_code"),
                ort=person.get("city"),
                art="OECD303" if ist_firma else "OECD302",
            ),
            vorname=None if ist_firma else vorname,
            nachname=None if ist_firma else nachname,
            geburtsdatum=None if ist_firma else _als_datum(
                person.get("date_of_birth")
            ),
            name=person.get("company") if ist_firma else None,
            finanzkonto=konto,
            taetigkeiten=tuple(taetigkeiten),
            quelle_id=person["id"],
        )

    @staticmethod
    def _taetigkeiten_bauen(
        objekte_mit_werten: list[tuple[_Objektzeile, Buchungswerte]],
        betrifft: str,
        bericht: Pruefbericht,
    ) -> list[Vermietung]:
        """Je Objekt eine ACT_Immovable_Property-Zeile."""
        taetigkeiten: list[Vermietung] = []
        # Feste Reihenfolge, damit derselbe Lauf dieselbe Datei ergibt.
        for zeile, werte in sorted(
            objekte_mit_werten, key=lambda paar: paar[0].property_id
        ):
            if werte.waehrungen_gemischt:
                bericht.fehler_melden(
                    f"{betrifft} / {zeile.anschrift.ort or '?'}",
                    "RS_ACT_CONS_Q1_CCY",
                    "Buchungen in verschiedenen Waehrungen — die "
                    "Quartalssumme waere eine Addition ueber Waehrungsgrenzen",
                )
                continue
            if not werte.waehrung:
                bericht.fehler_melden(
                    f"{betrifft} / {zeile.anschrift.ort or '?'}",
                    "RS_ACT_CONS_Q1_CCY",
                    "keine Waehrung an den Buchungen",
                )
                continue

            taetigkeiten.append(
                Vermietung(
                    anschrift=zeile.anschrift,
                    verguetung=werte.verguetung,
                    gebuehren=werte.gebuehren,
                    steuern=werte.steuern,
                    anzahl=werte.anzahl,
                    waehrung=werte.waehrung,
                    objektart=zeile.objektart,
                    vermietete_tage=werte.vermietete_tage,
                    grundbuchnummer=zeile.grundbuchnummer,
                    daenisch=_daenischer_anhang(zeile, werte),
                    property_ids=(zeile.property_id,),
                    belege=tuple(werte.belege),
                )
            )
        return taetigkeiten


def _daenischer_anhang(
    zeile: _Objektzeile, werte: Buchungswerte
) -> DaenischerAnhang | None:
    """Die dänischen Zusatzfelder, sofern die Werte in DKK vorliegen.

    Die Bruttomieteinnahme ist nach der amtlichen Anleitung zwingend in DKK
    zu melden. Rechnet ein Betrieb in einer anderen Währung ab, wird das Feld
    weggelassen statt umgerechnet: Ein selbst gewählter Umrechnungskurs wäre
    eine erfundene Zahl in einer Steuermeldung.

    Die BFE-Nummer bleibt LEER, solange sie nicht eigens erfasst ist. Sie
    aus der Matrikelnummer zu befuellen waere falsch: Die Anleitung fuehrt
    beide als verschiedene Felder, im Beispiel der Behoerde stehen dort
    "1234QJE" und "4560004".
    """
    if werte.waehrung != "DKK":
        return None
    return DaenischerAnhang(
        brutto_mieteinnahme=brutto_mieteinnahme(werte),
        brutto_mieteinnahme_waehrung="DKK",
        bfe_nummer=zeile.bfe_nummer,
    )
