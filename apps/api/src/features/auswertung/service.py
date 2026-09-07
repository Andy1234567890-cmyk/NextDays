"""Service der Auswertung — eine Abfrage, alle Reiter.

WARUM EIN ENDPUNKT UND NICHT FÜNF:
Alle Reiter teilen Zeitraum, Bezugszeitpunkt und Objektfilter, und ihre
Kennzahlen MÜSSEN übereinstimmen. Fünf Endpunkte mit je eigener Rechnung sind
genau der Fehler, den Hostaway im September 2025 nachbessern musste
(„Einheitliche Zahlen auf allen Seiten" — vorher rechneten Analytics,
Mietaktivität und Auslastung verschieden und niemand konnte die Ergebnisse
vergleichen).

DIE NENNER-ENTSCHEIDUNG (Auslastung):
Gebuchte Nächte / BUCHBARE Nächte, nicht / alle Kalendertage. Ein gesperrter
Tag (Wartung, Eigennutzung, Vertragsende) war nie im Verkauf und darf die
Auslastung nicht drücken. Guesty rechnet so, Hostaway gegen alle Tage
(`Nights booked * 100 / total nights`) — wir folgen Guesty.

WAS NICHT GERECHNET WIRD:
Fehlt eine Grundlage, ist das Ergebnis `None`, nicht `0.0`. „Kein ADR, weil
keine Nacht gebucht" ist etwas anderes als „ADR ist null" (Wurzel 4). Ebenso
die Provision: liefert das Portal sie nicht (Booking.com meist nicht), bleibt
sie leer. Hostaway empfiehlt an dieser Stelle eine Schätzung
(`Gesamtpreis * 0,15`) — ein erfundener Ersatzwert, den wir nicht übernehmen.

AUSBAU 05.09.2026 (Hostaway „Financial Reporting" in voller Tiefe):
Finanzfelder je Buchung aus der gespeicherten Portal-Zerlegung (0366),
Auslastung je Objekt UND Monat, Eigennutzungs-Nächte, Status-Filter,
Ausgaben & Extras aus den Verrechnungsposten, Verlauf je Kanal/Objekt, dazu
die Berichte, die SiteMinder führt und Hostaway nicht: Wochentag,
Buchungsfenster, Aufenthaltsdauer, Stornos, Pace. Alles aus DENSELBEN
geladenen Buchungen — kein Reiter rechnet mit eigenen Daten.
"""
# pylint: disable=too-many-lines  # EIN Bericht, ein Rechenweg: Kennzahlen, Verlauf,
# Kanaele, Finanzen, Ausgaben & Extras teilen dieselben gefilterten Buchungen.
# Getrennt rechneten sie auseinander (Hostaways 'unterschiedliche Zahlen auf
# verschiedenen Seiten').
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import HTTPException
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.core.zeitraum import jahre_datumsgleich

from .muster import (
    _DAUER_EIMER,
    _FENSTER_EIMER,
    _STORNO_EIMER,
    _storno_vorlauf_tage,
    _verteilung,
    _vorlauf_tage,
)
from .muster import (
    naechte as _naechte,
)
from .muster import (
    quote as _quote,
)
from .muster import (
    teil as _teil,
)
from .muster import (
    wochentage as _wochentage,
)
from .muster import (
    zahl as _f,
)
from .muster import (
    zeitpunkt as _zeitpunkt,
)
from .schemas import (
    VERGLEICH_JAHRE,
    Ansicht,
    AnsichtAnlegen,
    AusgabeGruppe,
    AusgabenBericht,
    AusgabePosten,
    AuswertungResponse,
    Bezug,
    BuchungZeile,
    GaesteBericht,
    HerkunftZeile,
    KanalZeile,
    Kennzahlen,
    ObjektFinanzZeile,
    ObjektMonatZeile,
    ObjektZeile,
    PaceBericht,
    PaceMonat,
    Punkt,
    StornoBericht,
    StornoGrundZeile,
    StornoKanalZeile,
    Vergleich,
    VergleichBericht,
)

log = get_logger("nextdays.auswertung")

# Harte Obergrenzen (Wurzel 8): ein offener Zeitraum wäre ein Vollscan.
MAX_TAGE = 1830          # 5 Jahre
# Mit Vergleich läuft der Bericht ZWEIMAL. 5 Jahre × 2 wäre der doppelte
# Vollscan; der Vergleich ist auf höchstens ein Jahr Zeitraum begrenzt.
MAX_TAGE_VERGLEICH = 366 # 1 Jahr (Schaltjahr eingerechnet)
MAX_BUCHUNGEN = 5_000    # Tabellenreiter
MAX_POSTEN = 2_000       # Ausgaben & Extras
# Kategorie-SCHLÜSSEL einer Zusatzleistung im Reiter „Ausgaben & Extras". Ein
# Schlüssel, kein Klartext: die Oberfläche übersetzt ihn (`analysis.expenses.
# category.addon`) — derselbe Weg wie `service` für bestellte Leistungen
# (tasks/abrechnung.py).
KATEGORIE_ZUSATZLEISTUNG = "addon"
MAX_ANSICHTEN = 50       # gespeicherte Ansichten je Nutzer und Reiter
# Pace blickt zwölf Monate voraus — weiter reicht kein Portal-Push (365 Tage).
PACE_MONATE = 12

# PostgREST-`in_` wandert in die URL; über ~100 UUIDs wird sie zu lang.
_IN_BLOCK = 100
# Welche Buchungsspalte den Zeitraum trägt — je Bezug. Übernachtung fällt auf
# die Anreise zurück, weil eine Nacht kein eigenes Datumfeld der Buchung ist.
_BEZUG_FELD: dict[Bezug, str] = {
    Bezug.ANREISE: "check_in",
    Bezug.ABREISE: "check_out",
    Bezug.BUCHUNG: "booked_at",
    Bezug.UEBERNACHTUNG: "check_in",
}

# Stornierte Buchungen zählen für die Quote, nicht für Umsatz/Nächte.
_STORNO = {"cancelled", "canceled", "declined", "expired"}
# Was als verkaufte Nacht zählt.
_GILT = {"confirmed", "checked_in", "checked_out", "completed", "pending"}

# Die Gebührenart der Reinigung im Kanon (`fee_classification.fee_type`).
_REINIGUNG = "cleaning_fee"

def _perioden(von: date, bis: date, monatlich: bool) -> list[str]:
    """Alle Perioden-Schlüssel des Zeitraums — lückenlos, in Reihenfolge.

    Bei Monatsauflösung „YYYY-MM", sonst „YYYY-MM-DD". Grundlage der
    lückenlosen Zeitreihe (siehe `_verlauf`).
    """
    if not monatlich:
        tage = (bis - von).days
        return [(von + timedelta(days=i)).isoformat() for i in range(tage + 1)]
    schluessel: list[str] = []
    jahr, monat = von.year, von.month
    while (jahr, monat) <= (bis.year, bis.month):
        schluessel.append(f"{jahr:04d}-{monat:02d}")
        monat += 1
        if monat > 12:
            jahr, monat = jahr + 1, 1
    return schluessel


def _monat_plus(jahr: int, monat: int, plus: int) -> tuple[int, int]:
    idx = jahr * 12 + (monat - 1) + plus
    return idx // 12, idx % 12 + 1


def _verlauf_normalisiert(punkte: list[Punkt], jahre: int) -> list[Punkt]:
    """Jedem Punkt des Vorzeitraums seinen Partner-Schlüssel der Gegenwart geben.

    „2025-08-03" (+1 Jahr) → `period_normal` „2026-08-03"; bei Monats-
    auflösung „2025-08" → „2026-08". Die Oberfläche verbindet die beiden
    Zeitreihen über DIESEN Wert.

    Der 29.02. bekommt in einem Nicht-Schaltjahr den 28.02. als Partner —
    dieselbe Regel wie `jahre_datumsgleich`, nur in die andere Richtung. Damit
    trifft er denselben Punkt, den die Hinrechnung erzeugt hätte.
    """
    fertig: list[Punkt] = []
    for p in punkte:
        roh = p.period
        try:
            if len(roh) == 7:  # Monat: YYYY-MM
                jahr, monat = roh.split("-")
                normal = f"{int(jahr) + jahre:04d}-{monat}"
            else:  # Tag: YYYY-MM-DD
                tag = date.fromisoformat(roh)
                try:
                    normal = tag.replace(year=tag.year + jahre).isoformat()
                except ValueError:
                    # 29.02. ohne Partner im Zieljahr.
                    normal = tag.replace(year=tag.year + jahre, day=28).isoformat()
        except (TypeError, ValueError):
            # Ein Schlüssel, den wir nicht deuten können, bekommt keinen
            # Partner — er wird dann NICHT gepaart, statt falsch gepaart.
            normal = None
        fertig.append(p.model_copy(update={"period_normal": normal}))
    return fertig






class AuswertungService:
    """Rechnet die Auswertung eines Zeitraums."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------------
    # Einstieg
    # ------------------------------------------------------------------

    def auswerten(  # noqa: PLR0913 — die Filterleiste, eins zu eins
        self,
        ctx: AuthContext,
        *,
        von: date,
        bis: date,
        bezug: Bezug = Bezug.ANREISE,
        property_ids: list[str] | None = None,
        channels: list[str] | None = None,
        status: list[str] | None = None,
        vergleich: Vergleich = Vergleich.KEINER,
    ) -> AuswertungResponse:
        """Die ganze Auswertung. Wurzel 3: alles auf den Tenant gescopet.

        `vergleich` rechnet denselben Bericht ein zweites Mal für den
        datumsgleichen Zeitraum vor 1/2/5 Jahren und hängt ihn als `vorher` an.
        Beide Durchläufe teilen sich `_rechnen` — eine zweite Rechenlogik für
        den Vorwert wäre genau der Fehler, den Hostaway 09/2025 nachbessern
        musste (Kennzahlen, die je Ansicht anders zustande kommen).
        """
        tenant_id = ctx.tenant_id
        objekte = self._objekte(tenant_id, property_ids)
        antwort = self._rechnen(
            tenant_id,
            objekte=objekte,
            von=von,
            bis=bis,
            bezug=bezug,
            channels=channels,
            status=status,
        )
        jahre = VERGLEICH_JAHRE.get(vergleich)
        if jahre is not None:
            antwort.vorher = self._vorzeitraum(
                tenant_id,
                objekte=objekte,
                von=von,
                bis=bis,
                bezug=bezug,
                channels=channels,
                status=status,
                vergleich=vergleich,
                jahre=jahre,
            )
        return antwort

    def _vorzeitraum(  # noqa: PLR0913 — dieselben Filter wie der Hauptlauf
        self,
        tenant_id: str,
        *,
        objekte: dict[str, str],
        von: date,
        bis: date,
        bezug: Bezug,
        channels: list[str] | None,
        status: list[str] | None,
        vergleich: Vergleich,
        jahre: int,
    ) -> VergleichBericht:
        """Derselbe Bericht für den datumsgleichen Zeitraum vor `jahre` Jahren.

        DIE OBJEKTMENGE IST DIE VON HEUTE, nicht die von damals. Wer heute drei
        Objekte auswertet, will die Zahlen DIESER drei Objekte im Vorjahr sehen
        — nicht die eines vierten, das inzwischen weg ist. Objekte, die es
        damals noch nicht gab, tragen im Vorwert schlicht nichts bei.
        """
        v_von = jahre_datumsgleich(von, jahre)
        v_bis = jahre_datumsgleich(bis, jahre)
        vorher = self._rechnen(
            tenant_id,
            objekte=objekte,
            von=v_von,
            bis=v_bis,
            bezug=bezug,
            channels=channels,
            status=status,
            # Die Einteilung des HAUPTzeitraums, nicht die eigene: sonst
            # trägt die eine Reihe Tage und die andere Monate.
            monatlich=(bis - von).days > 90,
            # Der Vorzeitraum braucht weder Buchungsliste noch Posten — er
            # liefert Summen. Das spart den größten Teil der zweiten Rechnung.
            schlank=True,
        )
        return VergleichBericht(
            vergleich=vergleich,
            von=v_von.isoformat(),
            bis=v_bis.isoformat(),
            currency=vorher.currency,
            waehrungen=vorher.waehrungen,
            kennzahlen=vorher.kennzahlen,
            verlauf=_verlauf_normalisiert(vorher.verlauf, jahre),
            kanaele=vorher.kanaele,
            objekte=vorher.objekte,
            gaeste=vorher.gaeste,
            buchungen_gesamt=vorher.kennzahlen.buchungen + vorher.kennzahlen.stornos,
            wochentage=vorher.wochentage,
            buchungsfenster=vorher.buchungsfenster,
            aufenthaltsdauer=vorher.aufenthaltsdauer,
            stornos=vorher.stornos,
        )

    def _rechnen(  # noqa: PLR0913, PLR0914 — der Rechenkern trägt alle Reiter
        self,
        tenant_id: str,
        *,
        objekte: dict[str, str],
        von: date,
        bis: date,
        bezug: Bezug,
        channels: list[str] | None,
        status: list[str] | None = None,
        monatlich: bool | None = None,
        schlank: bool = False,
    ) -> AuswertungResponse:
        """Der Rechenkern EINES Zeitraums — von Haupt- und Vorzeitraum geteilt.

        `monatlich` gibt dem Vorzeitraum die Auflösung des HAUPTzeitraums vor,
        damit beide Zeitreihen dieselbe Einteilung tragen (siehe `_verlauf`).
        `schlank` lässt Buchungsliste, Finanzfelder und Posten weg — der
        Vorzeitraum braucht nur Summen.
        """
        erlaubt = set(objekte)
        buchungen = self._buchungen(tenant_id, von, bis, bezug, erlaubt, channels, status)
        kalender = self._kalender(von, bis, erlaubt)
        verfuegbar = self._verfuegbarkeit(kalender, von, bis, erlaubt)

        alle_gueltig = [b for b in buchungen if str(b.get("status")) in _GILT]
        storniert = [b for b in buchungen if str(b.get("status")) in _STORNO]
        # EIGENNUTZUNG ZÄHLT NICHT ALS VERKAUF (Wurzel 4).
        #
        # Sie trägt 0 Umsatz, aber echte Nächte. In den Kennzahlen mitgezählt
        # verdürbe sie jede Verhältniszahl: der Ø Nachtpreis fiele, weil der
        # Nenner Nächte enthält, für die nie jemand zahlte, und die
        # Aufenthaltsdauer verschöbe sich zu den langen Eigenaufenthalten.
        # Live bei AirSmil sind das 39 Buchungen mit zusammen 187 Nächten.
        #
        # Die Kanaltabelle führt sie weiterhin — dort als eigene Zeile, damit
        # sichtbar bleibt, dass die Nächte belegt waren.
        gueltig = [b for b in alle_gueltig if not b.get("is_owner_stay")]
        eigennutzung = [b for b in alle_gueltig if b.get("is_owner_stay")]

        waehrungen = sorted({
            str(b["currency"]) for b in gueltig if b.get("currency")
        })
        # Mehrere Währungen: NICHT addieren (Wurzel 4). Die Oberfläche weist den
        # Zeitraum dann als uneindeutig aus, statt eine erfundene Summe zu zeigen.
        currency = waehrungen[0] if len(waehrungen) == 1 else None

        antwort = AuswertungResponse(
            von=von.isoformat(),
            bis=bis.isoformat(),
            bezug=bezug,
            currency=currency,
            waehrungen=waehrungen,
            kennzahlen=self._kennzahlen(gueltig, storniert, verfuegbar, currency),
            verlauf=self._verlauf(gueltig, von, bis, bezug, monatlich),
            kanaele=self._kanaele(alle_gueltig),
            objekte=self._objektzeilen(gueltig, storniert, eigennutzung, verfuegbar, objekte),
            gaeste=self._gaeste(gueltig),
            wochentage=_wochentage(gueltig, kalender, von, bis, erlaubt),
            buchungsfenster=_verteilung(gueltig, _FENSTER_EIMER, _vorlauf_tage),
            aufenthaltsdauer=_verteilung(
                gueltig,
                _DAUER_EIMER,
                lambda b: _naechte(b.get("check_in"), b.get("check_out")) or None,
            ),
            stornos=self._stornos(storniert, len(gueltig)),
        )
        if schlank:
            return antwort

        finanzen = self._finanzen(tenant_id, buchungen)
        antwort.buchungen = self._buchungszeilen(buchungen, objekte, finanzen)
        antwort.objekte_finanzen = self._objekt_finanzen(gueltig, objekte, finanzen)
        antwort.objekte_monatlich = self._objekte_monatlich(
            gueltig, storniert, eigennutzung, kalender, objekte, von, bis, bezug
        )
        antwort.verlauf_je_kanal = self._verlauf_gruppen(
            gueltig, von, bis, bezug, monatlich, lambda b: str(b.get("channel") or "?")
        )
        antwort.verlauf_je_objekt = self._verlauf_gruppen(
            gueltig, von, bis, bezug, monatlich, lambda b: str(b.get("property_id"))
        )
        antwort.ausgaben = self._ausgaben(tenant_id, von, bis, erlaubt, objekte, gueltig, bezug)
        return antwort

    # ------------------------------------------------------------------
    # Laden
    # ------------------------------------------------------------------

    def _objekte(
        self, tenant_id: str, property_ids: list[str] | None
    ) -> dict[str, str]:
        """{property_id: Titel} des Betriebs — der Scope aller weiteren Abfragen."""
        q = (
            self._db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .is_("archived_at", "null")
        )
        if property_ids:
            q = q.in_("id", property_ids)
        return {str(r["id"]): str(r.get("title") or "") for r in fetch_all_rows(q)}

    def _buchungen(  # noqa: PLR0913 — jeder Filter der Leiste ist ein Argument
        self,
        tenant_id: str,
        von: date,
        bis: date,
        bezug: Bezug,
        erlaubt: set[str],
        channels: list[str] | None,
        status: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Buchungen des Zeitraums — der Bezugszeitpunkt entscheidet WELCHE.

        `UEBERNACHTUNG` lädt jede Buchung, die den Zeitraum ÜBERLAPPT; die
        anteilige Zuordnung passiert beim Rechnen. Die anderen drei filtern auf
        genau ein Datum.
        """
        q = (
            self._db.table("reservations")
            .select(
                "id, property_id, guest_id, channel, ota_name, check_in, "
                "check_out, status, total_amount, currency, num_guests, "
                "ota_commission, channel_fee, booked_at, created_at, "
                "is_owner_stay, guest_country, guest_email, "
                "cancelled_at, cancel_reason"
            )
            .eq("tenant_id", tenant_id)
            .is_("archived_at", "null")
        )
        a, b = von.isoformat(), bis.isoformat()
        if bezug is Bezug.ANREISE:
            q = q.gte("check_in", a).lte("check_in", b)
        elif bezug is Bezug.ABREISE:
            q = q.gte("check_out", a).lte("check_out", b)
        elif bezug is Bezug.BUCHUNG:
            # Wurzel 5b: der ECHTE Buchungszeitpunkt der Quelle. Fehlt er, fällt
            # die Buchung hier heraus — lieber sie fehlt, als sie mit unserem
            # Import-Zeitstempel in einen fremden Monat zu schieben.
            q = q.gte("booked_at", a).lte("booked_at", f"{b}T23:59:59")
        else:  # UEBERNACHTUNG — Überlappung
            q = q.lt("check_in", (bis + timedelta(days=1)).isoformat()).gt("check_out", a)
        if channels:
            q = q.in_("channel", channels)
        if status:
            q = q.in_("status", status)
        rows = fetch_all_rows(q)
        return [r for r in rows if str(r.get("property_id")) in erlaubt]

    def _kalender(
        self, von: date, bis: date, erlaubt: set[str]
    ) -> dict[str, dict[str, set[str]]]:
        """Je Objekt die TAGE, die belegt, gesperrt oder verkaufsgesperrt waren.

        Als Mengen von ISO-Daten, nicht als Summen: Monats- und Wochentags-
        Berichte schneiden dieselben Tage nur anders — eine zweite Ladung
        wäre eine zweite Wahrheit.

        `availability` hat KEINE `tenant_id` — sie hängt über `property_id`
        am Objekt. Der Mandanten-Scope kommt deshalb aus `erlaubt`, das
        bereits gegen `properties.tenant_id` geladen wurde (Wurzel 3): ohne
        `in_` läse die service_role hier tenant-übergreifend.
        """
        if not erlaubt:
            return {}
        rows = fetch_all_rows(
            self._db.table("availability")
            .select("property_id, date, status")
            .in_("property_id", sorted(erlaubt))
            .gte("date", von.isoformat())
            .lte("date", bis.isoformat())
        )
        # Stop-Sell liegt in einer EIGENEN Tabelle, nicht in `availability`.
        # Nur `scope='all'` zählt: eine Sperre für einzelne Kanäle lässt die
        # anderen Verkaufswege offen.
        sperren = fetch_all_rows(
            self._db.table("stop_sell")
            .select("property_id, date, scope")
            .in_("property_id", sorted(erlaubt))
            .gte("date", von.isoformat())
            .lte("date", bis.isoformat())
        )
        kal: dict[str, dict[str, set[str]]] = {
            pid: {"gebucht": set(), "gesperrt": set(), "stop_sell": set()}
            for pid in erlaubt
        }
        for r in rows:
            pid = str(r.get("property_id"))
            if pid not in kal:
                continue
            tag = str(r.get("date"))[:10]
            status = str(r.get("status"))
            if status == "blocked":
                kal[pid]["gesperrt"].add(tag)
            elif status == "booked":
                kal[pid]["gebucht"].add(tag)
        for sp in sperren:
            pid = str(sp.get("property_id"))
            if pid not in kal or str(sp.get("scope") or "") != "all":
                continue
            tag = str(sp.get("date"))[:10]
            # Ein belegter Tag ist schon aus dem freien Bestand heraus — eine
            # Sperre darüber darf ihn nicht ein zweites Mal abziehen.
            if tag in kal[pid]["gebucht"] or tag in kal[pid]["gesperrt"]:
                continue
            kal[pid]["stop_sell"].add(tag)
        return kal

    @staticmethod
    def _verfuegbarkeit(
        kalender: dict[str, dict[str, set[str]]],
        von: date,
        bis: date,
        erlaubt: set[str],
    ) -> dict[str, dict[str, int]]:
        """Je Objekt: wie viele Nächte im Zeitraum frei, belegt, gesperrt waren.

        DER NENNER (Entscheidung des Betreibers, 30.08.2026):
        > „Die Tage, die frei im Kalender sind, sind buchbar und somit frei.
        >  Wenn ein Haus belegt ist — egal ob OTA oder Eigentümer, Webseiten-
        >  buchung oder selbst angelegt — ist es nicht frei."

        Also: jeder Tag des Zeitraums zählt, entweder als frei oder als belegt.
        Der Nenner ist damit die SPANNE × Objekte, nicht die Zahl der
        Kalenderzeilen — ein Tag ohne Eintrag ist ein freier Tag, kein
        unbekannter. Live gemessen: für 42 von 558 Objekttagen gibt es gar
        keine Zeile; sie stillschweigend wegzulassen ließe die Quote zu hoch
        aussehen (71,2 % statt 65,7 %).

        AUSGENOMMEN sind zwei Fälle, in denen das Objekt NICHT im Verkauf war:

        * `availability.status='blocked'` — live ausschließlich
          `contract_end`, also gekündigte Objekte. Sie als „nicht verkauft" zu
          zählen bestrafte den Betrieb für Häuser, die er nicht mehr hat.
        * **Stop-Sell** (eigene Tabelle `stop_sell`, Migration 0145) — eine
          bewusste Verkaufssperre. Sie ist etwas Drittes: der Tag war weder
          belegt noch verkaufbar. Ihn im Nenner zu lassen hieße, den Betrieb
          für eine Sperre zu bestrafen, die er selbst gesetzt hat.
          Berücksichtigt werden nur Sperren mit `scope='all'`; eine Sperre für
          einzelne Kanäle lässt die anderen Wege offen, das Objekt war also
          weiter verkaufbar. Liegt Stop-Sell auf einem bereits belegten Tag
          (live 7 von 23), zählt die Belegung — nicht doppelt abziehen.

        BELEGT IST BELEGT: Eigennutzung steht als `booked` im Kalender
        (`source='direct'`, live 74 Tage) und zählt mit. Sie erzeugt keinen
        Umsatz, aber der Tag war weg — für die Auslastung ist das dasselbe.
        In den GELD-Kennzahlen bleibt sie draußen (siehe `auswerten`).
        """
        spanne = (bis - von).days + 1
        summe: dict[str, dict[str, int]] = {}
        for pid in erlaubt:
            k = kalender.get(pid, {"gebucht": set(), "gesperrt": set(), "stop_sell": set()})
            gesperrt = len(k["gesperrt"])
            stop = len(k["stop_sell"])
            summe[pid] = {
                "buchbar": spanne - gesperrt - stop,
                "gebucht": len(k["gebucht"]),
                "gesperrt": gesperrt,
                "stop_sell": stop,
            }
        return summe

    def _finanzen(
        self, tenant_id: str, buchungen: list[dict[str, Any]]
    ) -> dict[str, dict[str, Any]]:
        """Die gespeicherte Portal-Zerlegung je Buchung (0366) samt Gebühren-
        posten und die gebuchten Zusatzleistungen.

        Ergebnis je reservation_id: {uebernachtung, brutto, provision,
        provision_gemeldet, zahlungsgebuehr, quelle, gebuehren: {art: betrag},
        zusatzleistungen}. Buchungen ohne Zerlegung fehlen im Dict — die
        Zeile zeigt dann `None`, nie eine Rückrechnung aus dem Gesamtpreis.
        """
        ids = [str(b["id"]) for b in buchungen if b.get("id")]
        if not ids:
            return {}
        finanzen: dict[str, dict[str, Any]] = {}
        gebuehren: dict[str, dict[str, float]] = defaultdict(dict)
        addons: dict[str, float] = defaultdict(float)
        wollen = set(ids)
        for i in range(0, len(ids), _IN_BLOCK):
            block = ids[i : i + _IN_BLOCK]
            for r in fetch_all_rows(
                self._db.table("reservation_portal_finanzen")
                .select(
                    "reservation_id, uebernachtung, brutto, provision, "
                    "provision_gemeldet, zahlungsgebuehr, quelle, currency"
                )
                .eq("tenant_id", tenant_id)
                .in_("reservation_id", block)
            ):
                rid = str(r.get("reservation_id"))
                if rid in wollen:
                    finanzen[rid] = dict(r)
            for r in fetch_all_rows(
                self._db.table("reservation_portal_gebuehren")
                .select("reservation_id, art, betrag")
                .eq("tenant_id", tenant_id)
                .in_("reservation_id", block)
            ):
                rid = str(r.get("reservation_id"))
                if rid not in wollen:
                    continue
                art = str(r.get("art") or "other")
                gebuehren[rid][art] = round(gebuehren[rid].get(art, 0.0) + _f(r.get("betrag")), 2)
            for r in fetch_all_rows(
                self._db.table("reservation_addons")
                .select("reservation_id, price, qty, cancelled_at")
                .eq("tenant_id", tenant_id)
                .in_("reservation_id", block)
            ):
                rid = str(r.get("reservation_id"))
                # Stornierte Zusatzleistungen (0397) sind kein Umsatz.
                if rid not in wollen or r.get("cancelled_at"):
                    continue
                addons[rid] += _f(r.get("price")) * max(int(r.get("qty") or 1), 1)
        for rid in wollen:
            eintrag = finanzen.get(rid)
            if eintrag is None and rid not in addons:
                continue
            if eintrag is None:
                # Nur Zusatzleistungen bekannt — die Zerlegung fehlt weiter.
                finanzen[rid] = {"zusatzleistungen": round(addons[rid], 2)}
                continue
            eintrag["gebuehren"] = gebuehren.get(rid, {})
            eintrag["zusatzleistungen"] = round(addons[rid], 2) if rid in addons else None
        return finanzen

    # ------------------------------------------------------------------
    # Rechnen
    # ------------------------------------------------------------------

    def _kennzahlen(
        self,
        gueltig: list[dict[str, Any]],
        storniert: list[dict[str, Any]],
        verfuegbar: dict[str, dict[str, int]],
        currency: str | None,
    ) -> Kennzahlen:
        umsatz = sum(_f(b.get("total_amount")) for b in gueltig) if currency else 0.0
        naechte = sum(_naechte(b.get("check_in"), b.get("check_out")) for b in gueltig)
        # Kein Kalender gepflegt → 0 buchbare Nächte → Auslastung/RevPAR bleiben
        # `None`. Kein Ersatznenner (Objekte × Tage) — der wäre geraten und
        # ergäbe eine Auslastung, die nie jemand gepflegt hat (Wurzel 4).
        buchbar = sum(v["buchbar"] for v in verfuegbar.values())
        gaeste = sum(int(b.get("num_guests") or 0) for b in gueltig)
        vorlauf = self._vorlauf(gueltig)
        gesamt = len(gueltig) + len(storniert)
        return Kennzahlen(
            currency=currency,
            umsatz=round(umsatz, 2),
            naechte=naechte,
            buchungen=len(gueltig),
            gaeste=gaeste,
            naechte_buchbar=buchbar,
            auslastung_pct=_quote(
                sum(v["gebucht"] for v in verfuegbar.values()), buchbar
            ),
            adr=_teil(umsatz, naechte) if currency else None,
            revpar=_teil(umsatz, buchbar) if currency else None,
            aufenthalt_schnitt=_teil(naechte, len(gueltig)),
            vorlauf_tage=vorlauf,
            # Stornoquote nach Hostaways Nenner: storniert / (gültig + storniert).
            # Guesty rechnet storniert / alle. Bei 10 gültigen und 5 stornierten
            # ergibt das 33 % gegen 50 % — wir nennen den Nenner in der UI.
            stornoquote_pct=_quote(len(storniert), gesamt),
            stornos=len(storniert),
        )

    @staticmethod
    def _vorlauf(buchungen: list[dict[str, Any]]) -> float | None:
        """Tage zwischen Buchung und Anreise — nur wo `booked_at` echt ist.

        Wurzel 5b: `created_at` ist UNSER Eingang, nicht der Buchungszeitpunkt.
        Bei Bestandsimporten liegt er ein Jahr daneben. Buchungen ohne echten
        Wert fallen aus dem Mittel, statt es zu verfälschen.
        """
        werte = [t for t in (_vorlauf_tage(b) for b in buchungen) if t is not None]
        return round(sum(werte) / len(werte), 1) if werte else None

    @staticmethod
    def _verlauf(
        buchungen: list[dict[str, Any]],
        von: date,
        bis: date,
        bezug: Bezug,
        monatlich: bool | None = None,
    ) -> list[Punkt]:
        """Zeitreihe. Über 90 Tage nach Monaten, darunter nach Tagen.

        Dieselbe Schwelle wie Hostaway („Nach mehr als 90 Tagen entspricht der
        Zeitraum vollen Monaten").

        `monatlich` wird vom VERGLEICHSFALL vorgegeben. Warum es nicht jeder
        Zeitraum selbst entscheiden darf (gemessen 03.09.2026): der
        datumsgleiche Jahressprung kann die Spanne um einen Tag ändern, wenn ein
        29. Februar dazwischenliegt. In 90 geprüften Zeitraum/Jahre-Kombinationen
        fiel der eine Zeitraum dadurch über die 90-Tage-Schwelle und der andere
        darunter — etwa 01.01.–01.04.2020 (91 Tage, monatlich) gegen
        01.01.–01.04.2019 (90 Tage, täglich). Die Vorjahreslinie bestünde dann
        aus TAGESwerten und die Hauptlinie aus MONATSsummen, auf einer Achse mit
        derselben Skala: ein scheinbarer Einbruch um über 90 %, den niemand als
        Darstellungsfehler erkennt.

        DIE REIHE IST LÜCKENLOS: jeder Tag (bzw. Monat) des Zeitraums bekommt
        einen Punkt, auch wenn an ihm nichts gebucht wurde. Vorher entstanden
        nur Eimer, in denen etwas lag — und weil eine Diagramm-Kategorieachse
        ihre Punkte GLEICH BREIT verteilt, war die Zeitachse verzerrt: im
        Zeitraum 31.08.–29.09.2026 fehlten 12 von 30 Tagen, und der Sprung vom
        20.09. auf den 25.09. (fünf Tage) sah genauso breit aus wie der vom
        01.09. auf den 02.09. (ein Tag). Die Kurve zeigte damit einen Verlauf,
        den es so nie gab (gemessen 03.09.2026).

        Ein Tag ohne Buchung trägt `0.0` und nicht `None`: null Umsatz an einem
        Tag ohne Buchung ist die WAHRE Aussage, keine erfundene (anders als bei
        einem Tag, der außerhalb des Zeitraums liegt — der taucht gar nicht
        erst auf).
        """
        if monatlich is None:
            monatlich = (bis - von).days > 90
        feld = _BEZUG_FELD[bezug]
        # Erst das lückenlose Gerüst, dann die Buchungen hineinlegen.
        eimer: dict[str, Punkt] = {
            key: Punkt(period=key) for key in _perioden(von, bis, monatlich)
        }
        for b in buchungen:
            roh = str(b.get(feld) or "")[:10]
            if not roh:
                continue
            key = roh[:7] if monatlich else roh
            p = eimer.setdefault(key, Punkt(period=key))
            p.umsatz = round(p.umsatz + _f(b.get("total_amount")), 2)
            p.naechte += _naechte(b.get("check_in"), b.get("check_out"))
            p.buchungen += 1
        return [eimer[k] for k in sorted(eimer)]

    def _verlauf_gruppen(  # noqa: PLR0913 — Verlauf plus Gruppenschlüssel
        self,
        buchungen: list[dict[str, Any]],
        von: date,
        bis: date,
        bezug: Bezug,
        monatlich: bool | None,
        schluessel: Any,  # noqa: ANN401 - Callable auf rohe Zeilen
    ) -> dict[str, list[Punkt]]:
        """Dieselbe Zeitreihe, je Gruppe (Kanal oder Objekt) — Hostaways
        „Gruppieren nach". Jede Gruppe läuft durch `_verlauf`, damit die
        Gruppenreihen sich exakt zur Gesamtreihe summieren."""
        gruppen: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for b in buchungen:
            gruppen[schluessel(b)].append(b)
        return {
            key: self._verlauf(rows, von, bis, bezug, monatlich)
            for key, rows in sorted(gruppen.items())
        }

    @staticmethod
    def _kanaele(buchungen: list[dict[str, Any]]) -> list[KanalZeile]:
        """Umsatz je Portal.

        Der Kern der Anforderung. Hostaway löst das NICHT automatisch — dort
        baut der Kunde je Kanal eine eigene Formel, weil „each OTA calculates
        totals differently". Wir gruppieren fest, weil unsere Buchungen den
        Kanal schon tragen.

        GRUPPIERT WIRD NACH `channel`, NICHT nach `ota_name`. Der Portalname
        kommt roh aus der Quelle und ist NICHT normiert: live stehen für
        denselben Kanal vier Schreibweisen nebeneinander (gemessen 30.08.2026
        bei AirSmil: „Airbnb" 149 × und „AirBNB" 30 ×, „BookingCom" 86 × und
        „Booking.com" 18 ×). Nach `ota_name` gruppiert erschien Airbnb zweimal
        in der Tabelle, mit geteiltem Umsatz und zwei Prozentanteilen — eine
        Aufstellung, die man nur bemerkt, wenn man die Zeilen zusammenzählt.

        `channel` ist dagegen ein DB-Enum und damit die einzige verlässliche
        Achse. Der Portalname wird nur noch als Beschriftung mitgeführt, und
        zwar die HÄUFIGSTE Schreibweise je Kanal — nicht die erstbeste.
        """
        namen: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        eimer: dict[str, KanalZeile] = {}
        for b in buchungen:
            # EIGENNUTZUNG IST KEIN VERTRIEBSKANAL — eigene Zeile.
            #
            # Sie trägt zwar `channel='direct'`, meint aber etwas ganz anderes:
            # „Direkt" ist eine selbst angelegte Buchung mit echtem Gast und
            # echtem Umsatz, Eigennutzung ist der Hauseigentümer im eigenen
            # Objekt. Beides in einer Zeile ergab „Direkt · 7 Buchungen ·
            # 123 Nächte · 0,00 DKK" — eine Zeile, die aussieht wie ein Kanal,
            # der nichts einbringt.
            #
            # Live bei AirSmil sind ALLE 39 direct-Buchungen Eigennutzung, und
            # Eigennutzung kommt in keinem anderen Kanal vor. Die Trennung
            # verändert deshalb keinen Kanalumsatz, sie macht nur sichtbar,
            # was da steht.
            key = "owner_stay" if b.get("is_owner_stay") else str(b.get("channel") or "?")
            if not b.get("is_owner_stay") and (roh_name := b.get("ota_name")):
                namen[key][str(roh_name)] += 1
            z = eimer.setdefault(key, KanalZeile(channel=key))
            z.buchungen += 1
            z.naechte += _naechte(b.get("check_in"), b.get("check_out"))
            z.umsatz = round(z.umsatz + _f(b.get("total_amount")), 2)
            if b.get("is_owner_stay"):
                z.eigennutzung += 1
            # Provision NUR wo das Portal sie liefert. Kein Schätzwert.
            roh = b.get("ota_commission")
            if roh is not None:
                z.provision = round((z.provision or 0.0) + _f(roh), 2)
        # Bezugsgröße für den Anteil ist der Umsatz der VERTRIEBSKANÄLE.
        # Eigennutzung zählt nicht mit — sie trägt zwar 0 und verzerrte damit
        # rechnerisch nichts, aber „0 %" wäre eine Aussage über einen Anteil
        # am Verkauf, den es gar nicht gibt.
        gesamt = sum(
            z.umsatz for z in eimer.values() if z.channel != "owner_stay"
        )
        # Eigennutzung ganz nach unten: sie ist kein Kanal und soll die
        # Rangfolge nach Umsatz nicht anführen, wenn sie (wie immer) 0 trägt.
        zeilen = sorted(
            eimer.values(),
            key=lambda z: (z.channel == "owner_stay", -z.umsatz),
        )
        for z in zeilen:
            if z.channel == "owner_stay":
                z.anteil_pct = 0.0  # kein Verkaufsanteil; die UI zeigt „—"
            else:
                z.anteil_pct = round(z.umsatz * 100 / gesamt, 2) if gesamt else 0.0
            if z.provision is not None:
                z.netto = round(z.umsatz - z.provision, 2)
            # Häufigste Schreibweise als Beschriftung. Die Oberfläche fällt auf
            # den übersetzten Kanalnamen zurück, wenn keine vorliegt.
            if varianten := namen.get(z.channel):
                z.ota_name = max(varianten.items(), key=lambda p: p[1])[0]
        return zeilen

    @staticmethod
    def _objektzeilen(
        gueltig: list[dict[str, Any]],
        storniert: list[dict[str, Any]],
        eigennutzung: list[dict[str, Any]],
        verfuegbar: dict[str, dict[str, int]],
        objekte: dict[str, str],
    ) -> list[ObjektZeile]:
        umsatz: dict[str, float] = defaultdict(float)
        naechte: dict[str, int] = defaultdict(int)
        anreisen: dict[str, int] = defaultdict(int)
        stornos: dict[str, int] = defaultdict(int)
        eigen: dict[str, int] = defaultdict(int)
        for b in gueltig:
            pid = str(b.get("property_id"))
            umsatz[pid] += _f(b.get("total_amount"))
            naechte[pid] += _naechte(b.get("check_in"), b.get("check_out"))
            anreisen[pid] += 1
        for b in storniert:
            stornos[str(b.get("property_id"))] += 1
        for b in eigennutzung:
            eigen[str(b.get("property_id"))] += _naechte(b.get("check_in"), b.get("check_out"))

        zeilen: list[ObjektZeile] = []
        for pid, titel in objekte.items():
            v = verfuegbar.get(
                pid, {"buchbar": 0, "gebucht": 0, "gesperrt": 0, "stop_sell": 0}
            )
            u = round(umsatz[pid], 2)
            zeilen.append(
                ObjektZeile(
                    property_id=pid,
                    title=titel,
                    naechte_buchbar=v["buchbar"],
                    naechte_gebucht=v["gebucht"],
                    naechte_gesperrt=v["gesperrt"],
                    naechte_stop_sell=v["stop_sell"],
                    naechte_eigennutzung=eigen[pid],
                    auslastung_pct=_quote(v["gebucht"], v["buchbar"]),
                    anreisen=anreisen[pid],
                    umsatz=u,
                    adr=_teil(u, naechte[pid]),
                    revpar=_teil(u, v["buchbar"]),
                    stornos=stornos[pid],
                )
            )
        return sorted(zeilen, key=lambda z: z.umsatz, reverse=True)

    @staticmethod
    def _objekte_monatlich(  # noqa: PLR0913, PLR0914 — Objekt × Monat, alle Spalten
        gueltig: list[dict[str, Any]],
        storniert: list[dict[str, Any]],
        eigennutzung: list[dict[str, Any]],
        kalender: dict[str, dict[str, set[str]]],
        objekte: dict[str, str],
        von: date,
        bis: date,
        bezug: Bezug,
    ) -> list[ObjektMonatZeile]:
        """Eine Zeile je Objekt und Monat — Hostaways „By month".

        Der Kalender wird nach Monat geschnitten; die Buchungen nach dem
        Bezugsfeld (Anreise/Abreise/Buchungsdatum). Bei „Übernachtung" zählt
        die Buchung in dem Monat, in dem ihre Anreise liegt — eine anteilige
        Verteilung des Betrags über Monate wäre eine zweite Rechnung, die
        sich nicht mehr zur Objektzeile summiert.
        """
        feld = _BEZUG_FELD[bezug]
        monate = _perioden(von, bis, True)
        # Tage je Monat innerhalb des Zeitraums (der erste und letzte Monat
        # können angeschnitten sein).
        tage_je_monat: dict[str, int] = defaultdict(int)
        tag = von
        while tag <= bis:
            tage_je_monat[tag.isoformat()[:7]] += 1
            tag += timedelta(days=1)

        def _monat(b: dict[str, Any]) -> str | None:
            roh = str(b.get(feld) or "")[:7]
            return roh if len(roh) == 7 else None

        umsatz: dict[tuple[str, str], float] = defaultdict(float)
        naechte: dict[tuple[str, str], int] = defaultdict(int)
        anreisen: dict[tuple[str, str], int] = defaultdict(int)
        stornos: dict[tuple[str, str], int] = defaultdict(int)
        eigen: dict[tuple[str, str], int] = defaultdict(int)
        for b in gueltig:
            m = _monat(b)
            if m is None:
                continue
            key = (str(b.get("property_id")), m)
            umsatz[key] += _f(b.get("total_amount"))
            naechte[key] += _naechte(b.get("check_in"), b.get("check_out"))
            anreisen[key] += 1
        for b in storniert:
            m = _monat(b)
            if m is not None:
                stornos[(str(b.get("property_id")), m)] += 1
        for b in eigennutzung:
            m = _monat(b)
            if m is not None:
                eigen[(str(b.get("property_id")), m)] += _naechte(
                    b.get("check_in"), b.get("check_out")
                )

        zeilen: list[ObjektMonatZeile] = []
        for pid, titel in objekte.items():
            k = kalender.get(pid, {"gebucht": set(), "gesperrt": set(), "stop_sell": set()})
            for m in monate:
                gebucht = sum(1 for t in k["gebucht"] if t[:7] == m)
                gesperrt = sum(1 for t in k["gesperrt"] if t[:7] == m)
                stop = sum(1 for t in k["stop_sell"] if t[:7] == m)
                buchbar = tage_je_monat.get(m, 0) - gesperrt - stop
                u = round(umsatz[(pid, m)], 2)
                zeilen.append(
                    ObjektMonatZeile(
                        property_id=pid,
                        title=titel,
                        monat=m,
                        naechte_buchbar=buchbar,
                        naechte_gebucht=gebucht,
                        naechte_gesperrt=gesperrt,
                        naechte_stop_sell=stop,
                        naechte_eigennutzung=eigen[(pid, m)],
                        auslastung_pct=_quote(gebucht, buchbar),
                        anreisen=anreisen[(pid, m)],
                        umsatz=u,
                        adr=_teil(u, naechte[(pid, m)]),
                        revpar=_teil(u, buchbar),
                        stornos=stornos[(pid, m)],
                    )
                )
        return zeilen

    @staticmethod
    def _stornos(storniert: list[dict[str, Any]], gueltig_anzahl: int) -> StornoBericht:
        """Der Storno-Bericht: je Kanal, nach Grund, nach Vorlauf."""
        kanaele: dict[str, StornoKanalZeile] = {}
        namen: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        vorlaeufe: dict[str, list[int]] = defaultdict(list)
        gruende: dict[str | None, int] = defaultdict(int)
        alle_vorlaeufe: list[int] = []
        naechte = 0
        umsatz = 0.0
        for b in storniert:
            key = str(b.get("channel") or "?")
            z = kanaele.setdefault(key, StornoKanalZeile(channel=key))
            n = _naechte(b.get("check_in"), b.get("check_out"))
            z.stornos += 1
            z.naechte += n
            z.umsatz_entgangen = round(z.umsatz_entgangen + _f(b.get("total_amount")), 2)
            naechte += n
            umsatz += _f(b.get("total_amount"))
            if roh_name := b.get("ota_name"):
                namen[key][str(roh_name)] += 1
            v = _storno_vorlauf_tage(b)
            if v is not None:
                vorlaeufe[key].append(v)
                alle_vorlaeufe.append(v)
            grund = str(b.get("cancel_reason") or "").strip() or None
            gruende[grund] += 1
        for key, z in kanaele.items():
            if vorlaeufe[key]:
                z.vorlauf_tage = round(sum(vorlaeufe[key]) / len(vorlaeufe[key]), 1)
            if varianten := namen.get(key):
                z.ota_name = max(varianten.items(), key=lambda p: p[1])[0]
        gesamt = gueltig_anzahl + len(storniert)
        # Die Quote je Kanal braucht die gültigen Buchungen je Kanal — die
        # stehen in `kanaele` des Hauptberichts; hier bleibt sie leer, die
        # Oberfläche rechnet sie aus beiden Tabellen.
        return StornoBericht(
            stornos=len(storniert),
            naechte=naechte,
            umsatz_entgangen=round(umsatz, 2),
            stornoquote_pct=_quote(len(storniert), gesamt),
            vorlauf_tage=(
                round(sum(alle_vorlaeufe) / len(alle_vorlaeufe), 1) if alle_vorlaeufe else None
            ),
            mit_zeitpunkt=len(alle_vorlaeufe),
            kanaele=sorted(kanaele.values(), key=lambda z: -z.stornos),
            gruende=sorted(
                (StornoGrundZeile(grund=g, anzahl=n) for g, n in gruende.items()),
                key=lambda z: -z.anzahl,
            ),
            vorlauf=_verteilung(storniert, _STORNO_EIMER, _storno_vorlauf_tage),
        )

    @staticmethod
    def _buchungszeilen(
        buchungen: list[dict[str, Any]],
        objekte: dict[str, str],
        finanzen: dict[str, dict[str, Any]],
    ) -> list[BuchungZeile]:
        zeilen: list[BuchungZeile] = []
        for b in buchungen:
            rid = str(b["id"])
            fin = finanzen.get(rid, {})
            gebuehren: dict[str, float] = fin.get("gebuehren", {}) or {}
            hat_zerlegung = "brutto" in fin
            brutto = round(_f(fin["brutto"]), 2) if hat_zerlegung else None
            provision_roh = b.get("ota_commission")
            provision = (
                round(_f(provision_roh), 2) if provision_roh is not None
                else (round(_f(fin["provision"]), 2) if hat_zerlegung else None)
            )
            zahlungsgebuehr = round(_f(fin.get("zahlungsgebuehr")), 2) if hat_zerlegung else None
            netto = (
                round(brutto - (provision or 0.0) - (zahlungsgebuehr or 0.0), 2)
                if brutto is not None
                else None
            )
            reinigung = gebuehren.get(_REINIGUNG)
            sonstige = round(
                sum(v for art, v in gebuehren.items() if art != _REINIGUNG), 2
            ) if hat_zerlegung else None
            zeilen.append(
                BuchungZeile(
                    id=rid,
                    property_title=objekte.get(str(b.get("property_id"))),
                    channel=str(b.get("channel") or ""),
                    ota_name=b.get("ota_name"),
                    check_in=str(b.get("check_in") or ""),
                    check_out=str(b.get("check_out") or ""),
                    naechte=_naechte(b.get("check_in"), b.get("check_out")),
                    gaeste=b.get("num_guests"),
                    status=str(b.get("status") or ""),
                    umsatz=round(_f(b.get("total_amount")), 2),
                    provision=provision,
                    currency=b.get("currency"),
                    booked_at=str(b["booked_at"]) if b.get("booked_at") else None,
                    is_owner_stay=bool(b.get("is_owner_stay")),
                    uebernachtung=round(_f(fin["uebernachtung"]), 2) if hat_zerlegung else None,
                    reinigung=round(reinigung, 2) if reinigung is not None else None,
                    sonstige_gebuehren=sonstige,
                    gebuehren_je_art=gebuehren,
                    zusatzleistungen=fin.get("zusatzleistungen"),
                    brutto=brutto,
                    provision_gemeldet=(
                        bool(fin.get("provision_gemeldet")) if hat_zerlegung else None
                    ),
                    zahlungsgebuehr=zahlungsgebuehr,
                    netto=netto,
                    finanz_quelle=(
                        str(fin["quelle"]) if hat_zerlegung and fin.get("quelle") else None
                    ),
                    cancelled_at=str(b["cancelled_at"]) if b.get("cancelled_at") else None,
                    cancel_reason=b.get("cancel_reason"),
                )
            )
        zeilen.sort(key=lambda z: z.check_in, reverse=True)
        return zeilen[:MAX_BUCHUNGEN]

    @staticmethod
    def _objekt_finanzen(
        gueltig: list[dict[str, Any]],
        objekte: dict[str, str],
        finanzen: dict[str, dict[str, Any]],
    ) -> list[ObjektFinanzZeile]:
        """Finanzfelder je Objekt summiert — Hostaways „Per listing".

        Eine Summe steht nur, wenn mindestens eine Buchung des Objekts eine
        Zerlegung trägt; `ohne_zerlegung` sagt, wie viele fehlen. Eine Summe
        über die Hälfte der Buchungen ohne diesen Hinweis wäre eine
        plausible, falsche Zahl.
        """
        zeilen = {
            pid: ObjektFinanzZeile(property_id=pid, title=titel)
            for pid, titel in objekte.items()
        }
        summen: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        hat: dict[str, bool] = defaultdict(bool)
        for b in gueltig:
            pid = str(b.get("property_id"))
            z = zeilen.get(pid)
            if z is None:
                continue
            z.buchungen += 1
            z.naechte += _naechte(b.get("check_in"), b.get("check_out"))
            z.umsatz = round(z.umsatz + _f(b.get("total_amount")), 2)
            fin = finanzen.get(str(b["id"]), {})
            if "brutto" not in fin:
                z.ohne_zerlegung += 1
                if fin.get("zusatzleistungen") is not None:
                    summen[pid]["zusatzleistungen"] += _f(fin["zusatzleistungen"])
                continue
            hat[pid] = True
            s = summen[pid]
            geb: dict[str, float] = fin.get("gebuehren", {}) or {}
            s["uebernachtung"] += _f(fin.get("uebernachtung"))
            s["reinigung"] += _f(geb.get(_REINIGUNG))
            s["sonstige"] += sum(v for art, v in geb.items() if art != _REINIGUNG)
            s["zusatzleistungen"] += _f(fin.get("zusatzleistungen"))
            s["brutto"] += _f(fin.get("brutto"))
            prov = b.get("ota_commission")
            s["provision"] += _f(prov) if prov is not None else _f(fin.get("provision"))
            s["zahlungsgebuehr"] += _f(fin.get("zahlungsgebuehr"))
        for pid, z in zeilen.items():
            s = summen[pid]
            if s.get("zusatzleistungen"):
                z.zusatzleistungen = round(s["zusatzleistungen"], 2)
            if not hat[pid]:
                continue
            z.uebernachtung = round(s["uebernachtung"], 2)
            z.reinigung = round(s["reinigung"], 2)
            z.sonstige_gebuehren = round(s["sonstige"], 2)
            z.brutto = round(s["brutto"], 2)
            z.provision = round(s["provision"], 2)
            z.zahlungsgebuehr = round(s["zahlungsgebuehr"], 2)
            z.netto = round(s["brutto"] - s["provision"] - s["zahlungsgebuehr"], 2)
        return sorted(zeilen.values(), key=lambda z: z.umsatz, reverse=True)

    def _ausgaben(
        self,
        tenant_id: str,
        von: date,
        bis: date,
        erlaubt: set[str],
        objekte: dict[str, str],
        buchungen: list[dict[str, Any]],
        bezug: Bezug,
    ) -> AusgabenBericht:
        """Hostaways „Expenses & Extras" aus ZWEI Quellen.

        1. Verrechnungsposten (`owner_expenses`). Zeitraum ist das DATUM DES
           POSTENS, nicht der Bezug der Buchungen — eine Reinigungsrechnung
           vom 3. gehört in den Monat des 3., egal wann die Buchung anreiste.
           Posten ohne Objekt (Konto-Posten) bleiben drin, sofern die
           Auswertung nicht auf Objekte eingeschränkt ist.
        2. Gebuchte Zusatzleistungen (`reservation_addons`) der gültigen
           Buchungen im Zeitraum — Hostaways „Extras": was der Gast obendrauf
           gekauft hat (Wäschepaket, Endreinigung …). Sie hängen an der
           Buchung und folgen deshalb deren Bezug (Anreise/Abreise/Buchung),
           genau wie Umsatz und Kanäle. Bis 07.09.2026 las der Reiter nur
           Quelle 1 — bei AirSmil fehlten so 1.050 DKK bezahlte Wäschepakete
           an drei September-Anreisen, der Reiter stand auf „Keine Posten".
        """
        posten: list[AusgabePosten] = []
        kategorien: dict[str | None, AusgabeGruppe] = {}
        je_objekt: dict[str | None, AusgabeGruppe] = {}
        waehrungen: set[str] = set()
        ausgaben = extras = 0.0

        def aufnehmen(p: AusgabePosten, pid: str | None, kategorie: str | None) -> None:
            nonlocal ausgaben, extras
            if p.currency:
                waehrungen.add(p.currency)
            posten.append(p)
            for gruppe, key, titel in (
                (kategorien, kategorie, None),
                (je_objekt, pid, objekte.get(pid) if pid else None),
            ):
                g = gruppe.setdefault(key, AusgabeGruppe(schluessel=key, title=titel))
                g.anzahl += 1
                if p.art == "ausgabe":
                    g.ausgaben = round(g.ausgaben + p.betrag, 2)
                else:
                    g.extras = round(g.extras + p.betrag, 2)
                g.saldo = round(g.extras - g.ausgaben, 2)
            if p.art == "ausgabe":
                ausgaben += p.betrag
            else:
                extras += p.betrag

        rows = fetch_all_rows(
            self._db.table("owner_expenses")
            .select(
                "id, date, concept, category, listing_id, reservation_id, "
                "direction, amount, currency, storage_path"
            )
            .eq("tenant_id", tenant_id)
            .gte("date", von.isoformat())
            .lte("date", bis.isoformat())
        )
        nur_objekte = len(erlaubt) < len(self._alle_objekt_ids(tenant_id, objekte))
        for r in rows:
            pid = str(r["listing_id"]) if r.get("listing_id") else None
            if pid is not None and pid not in erlaubt:
                continue
            if pid is None and nur_objekte:
                continue
            art = "ausgabe" if str(r.get("direction") or "") == "from_owner" else "extra"
            kategorie = r.get("category") or None
            aufnehmen(
                AusgabePosten(
                    id=str(r["id"]),
                    date=str(r.get("date") or "")[:10],
                    name=str(r.get("concept") or ""),
                    kategorie=kategorie,
                    property_id=pid,
                    property_title=objekte.get(pid) if pid else None,
                    reservation_id=str(r["reservation_id"]) if r.get("reservation_id") else None,
                    art=art,
                    betrag=round(_f(r.get("amount")), 2),
                    currency=str(r["currency"]) if r.get("currency") else None,
                    hat_beleg=bool(r.get("storage_path")),
                ),
                pid,
                kategorie,
            )

        # Quelle 2: Zusatzleistungen. `buchungen` ist bereits nach Bezug,
        # Zeitraum, Objekt-Scope und Status gefiltert — Datum, Objekt und
        # WÄHRUNG kommen von der Buchung (die Addon-Zeile trägt keine Währung;
        # ein Ersatzwert wäre Wurzel 4). Stornierte Zusatzleistungen (0397)
        # sind kein Umsatz — dieselbe Regel wie in `_finanzen`.
        je_buchung = {str(b["id"]): b for b in buchungen if b.get("id")}
        ids = list(je_buchung)
        for i in range(0, len(ids), _IN_BLOCK):
            block = ids[i : i + _IN_BLOCK]
            for r in fetch_all_rows(
                self._db.table("reservation_addons")
                .select("id, reservation_id, name, total, cancelled_at")
                .eq("tenant_id", tenant_id)
                .in_("reservation_id", block)
            ):
                b = je_buchung.get(str(r.get("reservation_id")))
                if b is None or r.get("cancelled_at"):
                    continue
                pid = str(b["property_id"]) if b.get("property_id") else None
                namen = r.get("name") if isinstance(r.get("name"), dict) else {}
                namen = {str(k): str(v) for k, v in namen.items() if v}
                aufnehmen(
                    AusgabePosten(
                        id=str(r["id"]),
                        date=str(b.get(_BEZUG_FELD[bezug]) or "")[:10],
                        # Ersatzname ohne Locale: der englische Snapshot, sonst der
                        # erste vorhandene — beides echte Werte aus der Zeile.
                        name=namen.get("en") or next(iter(namen.values()), ""),
                        name_i18n=namen or None,
                        kategorie=KATEGORIE_ZUSATZLEISTUNG,
                        property_id=pid,
                        property_title=objekte.get(pid) if pid else None,
                        reservation_id=str(b["id"]),
                        art="extra",
                        betrag=round(_f(r.get("total")), 2),
                        currency=str(b["currency"]) if b.get("currency") else None,
                    ),
                    pid,
                    KATEGORIE_ZUSATZLEISTUNG,
                )
        posten.sort(key=lambda p: p.date, reverse=True)
        return AusgabenBericht(
            currency=next(iter(waehrungen)) if len(waehrungen) == 1 else None,
            waehrungen=sorted(waehrungen),
            anzahl=len(posten),
            ausgaben=round(ausgaben, 2),
            extras=round(extras, 2),
            saldo=round(extras - ausgaben, 2),
            kategorien=sorted(kategorien.values(), key=lambda g: -(g.ausgaben + g.extras)),
            objekte=sorted(je_objekt.values(), key=lambda g: -(g.ausgaben + g.extras)),
            posten=posten[:MAX_POSTEN],
        )

    def _alle_objekt_ids(self, tenant_id: str, objekte: dict[str, str]) -> set[str]:
        """Ob die Auswertung auf Objekte eingeschränkt ist, entscheidet sich am
        Vergleich mit dem ganzen Bestand. Einmal je Bericht geladen."""
        alle = fetch_all_rows(
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .is_("archived_at", "null")
        )
        ids = {str(r["id"]) for r in alle}
        return ids or set(objekte)

    @staticmethod
    def _gaeste(buchungen: list[dict[str, Any]]) -> GaesteBericht:
        """Der Gäste-Teil — Herkunft, Wiederkehrer, Aufenthaltsdauer.

        Wiederkehrer über `guest_id`, ersatzweise über die Mailadresse: ein Gast
        kann über zwei Portale kommen und dann zwei Gastdatensätze haben.
        """
        herkunft: dict[str | None, HerkunftZeile] = {}
        zaehler: dict[str, int] = defaultdict(int)
        naechte_gesamt = 0
        gaeste_gesamt = 0
        for b in buchungen:
            land = b.get("guest_country") or None
            z = herkunft.setdefault(land, HerkunftZeile(land=land))
            n = _naechte(b.get("check_in"), b.get("check_out"))
            g = int(b.get("num_guests") or 0)
            z.buchungen += 1
            z.naechte += n
            z.gaeste += g
            naechte_gesamt += n
            gaeste_gesamt += g
            kennung = str(b.get("guest_id") or b.get("guest_email") or "")
            if kennung:
                zaehler[kennung] += 1

        gesamt_b = len(buchungen)
        for z in herkunft.values():
            z.anteil_pct = round(z.buchungen * 100 / gesamt_b, 2) if gesamt_b else 0.0
        personen = len(zaehler)
        wieder = sum(1 for n in zaehler.values() if n > 1)
        return GaesteBericht(
            gaeste_gesamt=gaeste_gesamt,
            wiederkehrer=wieder,
            wiederkehrer_pct=_quote(wieder, personen),
            personen_zuordenbar=personen,
            buchungen_zuordenbar=sum(zaehler.values()),
            aufenthalt_schnitt=_teil(naechte_gesamt, gesamt_b),
            gaeste_je_buchung=_teil(gaeste_gesamt, gesamt_b),
            herkunft=sorted(
                herkunft.values(), key=lambda z: z.buchungen, reverse=True
            ),
        )

    # ------------------------------------------------------------------
    # Pace — Buchungsstand der nächsten Monate gegen denselben Stichtag im Vorjahr
    # ------------------------------------------------------------------

    def pace(
        self,
        ctx: AuthContext,
        *,
        property_ids: list[str] | None = None,
        channels: list[str] | None = None,
        heute: date | None = None,
    ) -> PaceBericht:
        """SiteMinders „Pace": wie viel für die nächsten zwölf Monate HEUTE
        gebucht ist, gegen das, was vor einem Jahr am selben Kalendertag für
        dieselben Monate gebucht WAR — und was daraus am Ende wurde.

        Der Vorjahres-Stichtag braucht den echten Buchungszeitpunkt
        (`booked_at`). Buchungen ohne ihn fehlen im Stichtagswert und werden
        gezählt (`vorjahr_ohne_zeitstempel`), statt still zu fehlen (Wurzel 5b).
        Im Endwert des Vorjahres zählen sie mit — dort ist der Zeitpunkt egal.
        """
        heute = heute or date.today()
        tenant_id = ctx.tenant_id
        objekte = self._objekte(tenant_id, property_ids)
        erlaubt = set(objekte)
        von = heute.replace(day=1)
        j, m = _monat_plus(von.year, von.month, PACE_MONATE)
        bis = date(j, m, 1) - timedelta(days=1)
        jetzt = [
            b for b in self._buchungen(tenant_id, von, bis, Bezug.ANREISE, erlaubt, channels)
            if str(b.get("status")) in _GILT and not b.get("is_owner_stay")
        ]
        v_von, v_bis = jahre_datumsgleich(von, 1), jahre_datumsgleich(bis, 1)
        v_stichtag = datetime.combine(jahre_datumsgleich(heute, 1), datetime.max.time())
        vorjahr = [
            b for b in self._buchungen(tenant_id, v_von, v_bis, Bezug.ANREISE, erlaubt, channels)
            if str(b.get("status")) in _GILT and not b.get("is_owner_stay")
        ]
        waehrungen = sorted({str(b["currency"]) for b in jetzt + vorjahr if b.get("currency")})
        currency = waehrungen[0] if len(waehrungen) == 1 else None

        monate = {key: PaceMonat(monat=key) for key in _perioden(von, bis, True)}
        for b in jetzt:
            key = str(b.get("check_in") or "")[:7]
            p = monate.get(key)
            if p is None:
                continue
            p.jetzt_buchungen += 1
            p.jetzt_naechte += _naechte(b.get("check_in"), b.get("check_out"))
            if currency:
                p.jetzt_umsatz = round(p.jetzt_umsatz + _f(b.get("total_amount")), 2)
        ohne_zeitstempel = 0
        for b in vorjahr:
            roh = str(b.get("check_in") or "")[:7]
            if len(roh) != 7:
                continue
            key = f"{int(roh[:4]) + 1:04d}-{roh[5:7]}"
            p = monate.get(key)
            if p is None:
                continue
            n = _naechte(b.get("check_in"), b.get("check_out"))
            p.vorjahr_ende_naechte += n
            if currency:
                p.vorjahr_ende_umsatz = round(p.vorjahr_ende_umsatz + _f(b.get("total_amount")), 2)
            gebucht = _zeitpunkt(b.get("booked_at"))
            if gebucht is None:
                ohne_zeitstempel += 1
                continue
            if gebucht.replace(tzinfo=None) <= v_stichtag:
                p.vorjahr_stichtag_buchungen += 1
                p.vorjahr_stichtag_naechte += n
                if currency:
                    p.vorjahr_stichtag_umsatz = round(
                        p.vorjahr_stichtag_umsatz + _f(b.get("total_amount")), 2
                    )
        for p in monate.values():
            if p.vorjahr_stichtag_naechte:
                p.delta_naechte_pct = round(
                    (p.jetzt_naechte - p.vorjahr_stichtag_naechte)
                    * 100 / p.vorjahr_stichtag_naechte,
                    1,
                )
        return PaceBericht(
            stichtag=heute.isoformat(),
            currency=currency,
            waehrungen=waehrungen,
            monate=[monate[k] for k in sorted(monate)],
            vorjahr_ohne_zeitstempel=ohne_zeitstempel,
        )

    # ------------------------------------------------------------------
    # Gespeicherte Ansichten (Hostaway „Custom Views")
    # ------------------------------------------------------------------

    def ansichten(self, ctx: AuthContext, reiter: str | None = None) -> list[Ansicht]:
        """Die Ansichten DIESES Nutzers. Wurzel 3: tenant UND user."""
        q = (
            self._db.table("auswertung_ansichten")
            .select("id, name, reiter, filter, spalten, optionen, created_at")
            .eq("tenant_id", ctx.tenant_id)
            .eq("user_id", ctx.user_id)
            .order("name")
        )
        if reiter:
            q = q.eq("reiter", reiter)
        return [self._ansicht(r) for r in fetch_all_rows(q)]

    def ansicht_anlegen(self, ctx: AuthContext, req: AnsichtAnlegen) -> Ansicht:
        """Anlegen oder — bei gleichem Namen im selben Reiter — ersetzen.

        Idempotent (Wurzel 2): ein Doppelklick auf „Speichern" erzeugt keine
        zweite Ansicht, sondern überschreibt die erste. Der UNIQUE-Index
        (user_id, reiter, name) ist der Backstop.
        """
        vorhanden = self.ansichten(ctx, req.reiter)
        gleich = next((a for a in vorhanden if a.name == req.name.strip()), None)
        payload = {
            "tenant_id": ctx.tenant_id,
            "user_id": ctx.user_id,
            "name": req.name.strip(),
            "reiter": req.reiter,
            "filter": req.filter,
            "spalten": req.spalten,
            "optionen": req.optionen,
        }
        if gleich is not None:
            res = (
                self._db.table("auswertung_ansichten")
                .update({k: payload[k] for k in ("filter", "spalten", "optionen")})
                .eq("id", gleich.id)
                .eq("tenant_id", ctx.tenant_id)
                .eq("user_id", ctx.user_id)
                .execute()
            )
        else:
            if len(vorhanden) >= MAX_ANSICHTEN:
                raise HTTPException(
                    422, f"Höchstens {MAX_ANSICHTEN} Ansichten je Reiter — bitte eine löschen."
                )
            res = self._db.table("auswertung_ansichten").insert(payload).execute()
        rows = list(getattr(res, "data", None) or [])
        if not rows:
            raise HTTPException(500, "Die Ansicht konnte nicht gespeichert werden.")
        return self._ansicht(rows[0])

    def ansicht_loeschen(self, ctx: AuthContext, ansicht_id: str) -> None:
        """Löschen — nur die eigene. Fehlt sie, ist das kein Fehler (Wurzel 2)."""
        (
            self._db.table("auswertung_ansichten")
            .delete()
            .eq("id", ansicht_id)
            .eq("tenant_id", ctx.tenant_id)
            .eq("user_id", ctx.user_id)
            .execute()
        )

    @staticmethod
    def _ansicht(r: dict[str, Any]) -> Ansicht:
        return Ansicht(
            id=str(r["id"]),
            name=str(r.get("name") or ""),
            reiter=str(r.get("reiter") or ""),
            filter=dict(r.get("filter") or {}),
            spalten=[str(s) for s in (r.get("spalten") or [])],
            optionen=dict(r.get("optionen") or {}),
            created_at=str(r["created_at"]) if r.get("created_at") else None,
        )
