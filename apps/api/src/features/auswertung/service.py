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
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.core.zeitraum import jahre_datumsgleich

from .schemas import (
    VERGLEICH_JAHRE,
    AuswertungResponse,
    Bezug,
    BuchungZeile,
    GaesteBericht,
    HerkunftZeile,
    KanalZeile,
    Kennzahlen,
    ObjektZeile,
    Punkt,
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

# Stornierte Buchungen zählen für die Quote, nicht für Umsatz/Nächte.
_STORNO = {"cancelled", "canceled", "declined", "expired"}
# Was als verkaufte Nacht zählt.
_GILT = {"confirmed", "checked_in", "checked_out", "completed", "pending"}


def _f(wert: Any) -> float:  # noqa: ANN401 - kommt roh aus der DB
    """Zahl aus der DB — None und Leerstring werden 0.0, nie ein Fehler."""
    try:
        return float(wert or 0)
    except (TypeError, ValueError):
        return 0.0


def _naechte(check_in: str, check_out: str) -> int:
    """Nächte einer Buchung. Ungültige Daten ergeben 0, keinen Absturz."""
    try:
        a = date.fromisoformat(str(check_in)[:10])
        b = date.fromisoformat(str(check_out)[:10])
    except (TypeError, ValueError):
        return 0
    return max((b - a).days, 0)


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


def _quote(zaehler: float, nenner: float) -> float | None:
    """Prozentwert oder None — ein Nenner von 0 ist keine 0, sondern nichts."""
    return round(zaehler * 100 / nenner, 2) if nenner else None


def _teil(zaehler: float, nenner: float) -> float | None:
    return round(zaehler / nenner, 2) if nenner else None


class AuswertungService:
    """Rechnet die Auswertung eines Zeitraums."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # ------------------------------------------------------------------
    # Einstieg
    # ------------------------------------------------------------------

    def auswerten(
        self,
        ctx: AuthContext,
        *,
        von: date,
        bis: date,
        bezug: Bezug = Bezug.ANREISE,
        property_ids: list[str] | None = None,
        channels: list[str] | None = None,
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
                vergleich=vergleich,
                jahre=jahre,
            )
        return antwort

    def _vorzeitraum(
        self,
        tenant_id: str,
        *,
        objekte: dict[str, str],
        von: date,
        bis: date,
        bezug: Bezug,
        channels: list[str] | None,
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
            # Die Einteilung des HAUPTzeitraums, nicht die eigene: sonst
            # trägt die eine Reihe Tage und die andere Monate.
            monatlich=(bis - von).days > 90,
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
            buchungen_gesamt=len(vorher.buchungen),
        )

    def _rechnen(
        self,
        tenant_id: str,
        *,
        objekte: dict[str, str],
        von: date,
        bis: date,
        bezug: Bezug,
        channels: list[str] | None,
        monatlich: bool | None = None,
    ) -> AuswertungResponse:
        """Der Rechenkern EINES Zeitraums — von Haupt- und Vorzeitraum geteilt.

        `monatlich` gibt dem Vorzeitraum die Auflösung des HAUPTzeitraums vor,
        damit beide Zeitreihen dieselbe Einteilung tragen (siehe `_verlauf`).
        """
        erlaubt = set(objekte)
        buchungen = self._buchungen(tenant_id, von, bis, bezug, erlaubt, channels)
        verfuegbar = self._verfuegbarkeit(von, bis, erlaubt)

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

        waehrungen = sorted({
            str(b["currency"]) for b in gueltig if b.get("currency")
        })
        # Mehrere Währungen: NICHT addieren (Wurzel 4). Die Oberfläche weist den
        # Zeitraum dann als uneindeutig aus, statt eine erfundene Summe zu zeigen.
        currency = waehrungen[0] if len(waehrungen) == 1 else None

        return AuswertungResponse(
            von=von.isoformat(),
            bis=bis.isoformat(),
            bezug=bezug,
            currency=currency,
            waehrungen=waehrungen,
            kennzahlen=self._kennzahlen(gueltig, storniert, verfuegbar, currency),
            verlauf=self._verlauf(gueltig, von, bis, bezug, monatlich),
            kanaele=self._kanaele(alle_gueltig),
            objekte=self._objektzeilen(gueltig, storniert, verfuegbar, objekte),
            buchungen=self._buchungszeilen(buchungen, objekte),
            gaeste=self._gaeste(gueltig),
        )

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

    def _buchungen(
        self,
        tenant_id: str,
        von: date,
        bis: date,
        bezug: Bezug,
        erlaubt: set[str],
        channels: list[str] | None,
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
                "is_owner_stay, guest_country, guest_email"
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
        rows = fetch_all_rows(q)
        return [r for r in rows if str(r.get("property_id")) in erlaubt]

    def _verfuegbarkeit(
        self, von: date, bis: date, erlaubt: set[str]
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
        # `availability` hat KEINE `tenant_id` — sie hängt über `property_id`
        # am Objekt. Der Mandanten-Scope kommt deshalb aus `erlaubt`, das
        # bereits gegen `properties.tenant_id` geladen wurde (Wurzel 3): ohne
        # `in_` läse die service_role hier tenant-übergreifend.
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
        # Jeder Tag der Spanne zählt — auch die ohne Kalenderzeile.
        spanne = (bis - von).days + 1
        summe: dict[str, dict[str, int]] = {
            pid: {"buchbar": spanne, "gebucht": 0, "gesperrt": 0, "stop_sell": 0}
            for pid in erlaubt
        }
        belegt: set[tuple[str, str]] = set()
        for r in rows:
            pid = str(r.get("property_id"))
            if pid not in summe:
                continue
            status = str(r.get("status"))
            if status == "blocked":
                # Nicht im Verkauf → raus aus dem Nenner.
                summe[pid]["gesperrt"] += 1
                summe[pid]["buchbar"] -= 1
            elif status == "booked":
                summe[pid]["gebucht"] += 1
                belegt.add((pid, str(r.get("date"))[:10]))

        for sp in sperren:
            pid = str(sp.get("property_id"))
            if pid not in summe or str(sp.get("scope") or "") != "all":
                continue
            tag = str(sp.get("date"))[:10]
            # Ein belegter Tag ist schon aus dem freien Bestand heraus — eine
            # Sperre darüber darf ihn nicht ein zweites Mal abziehen.
            if (pid, tag) in belegt:
                continue
            summe[pid]["stop_sell"] += 1
            summe[pid]["buchbar"] -= 1
        return summe

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
        werte: list[int] = []
        for b in buchungen:
            roh = b.get("booked_at")
            if not roh:
                continue
            try:
                gebucht = datetime.fromisoformat(str(roh).replace("Z", "+00:00")).date()
                anreise = date.fromisoformat(str(b.get("check_in"))[:10])
            except (TypeError, ValueError):
                continue
            tage = (anreise - gebucht).days
            if tage >= 0:
                werte.append(tage)
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
        feld = {
            Bezug.ANREISE: "check_in",
            Bezug.ABREISE: "check_out",
            Bezug.BUCHUNG: "booked_at",
            Bezug.UEBERNACHTUNG: "check_in",
        }[bezug]
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
        verfuegbar: dict[str, dict[str, int]],
        objekte: dict[str, str],
    ) -> list[ObjektZeile]:
        umsatz: dict[str, float] = defaultdict(float)
        naechte: dict[str, int] = defaultdict(int)
        anreisen: dict[str, int] = defaultdict(int)
        stornos: dict[str, int] = defaultdict(int)
        for b in gueltig:
            pid = str(b.get("property_id"))
            umsatz[pid] += _f(b.get("total_amount"))
            naechte[pid] += _naechte(b.get("check_in"), b.get("check_out"))
            anreisen[pid] += 1
        for b in storniert:
            stornos[str(b.get("property_id"))] += 1

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
    def _buchungszeilen(
        buchungen: list[dict[str, Any]], objekte: dict[str, str]
    ) -> list[BuchungZeile]:
        zeilen = [
            BuchungZeile(
                id=str(b["id"]),
                property_title=objekte.get(str(b.get("property_id"))),
                channel=str(b.get("channel") or ""),
                ota_name=b.get("ota_name"),
                check_in=str(b.get("check_in") or ""),
                check_out=str(b.get("check_out") or ""),
                naechte=_naechte(b.get("check_in"), b.get("check_out")),
                gaeste=b.get("num_guests"),
                status=str(b.get("status") or ""),
                umsatz=round(_f(b.get("total_amount")), 2),
                provision=(
                    round(_f(b["ota_commission"]), 2)
                    if b.get("ota_commission") is not None
                    else None
                ),
                currency=b.get("currency"),
                booked_at=str(b["booked_at"]) if b.get("booked_at") else None,
                is_owner_stay=bool(b.get("is_owner_stay")),
            )
            for b in buchungen
        ]
        zeilen.sort(key=lambda z: z.check_in, reverse=True)
        return zeilen[:MAX_BUCHUNGEN]

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
