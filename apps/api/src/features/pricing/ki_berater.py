"""KI-Regel-Berater für Dynamic Pricing — schlägt EINSTELLUNGEN vor, keine Preise.

DIE ARBEITSTEILUNG IST DER KERN
===============================
Der **Server rechnet** die Vorschläge aus den eigenen Buchungsdaten: Wochenend-
Auslastung, Auslastung je Belegungsband, Vorlaufzeit, Preisspanne. Jeder
Vorschlag ist eine Zahl, die aus einer nachvollziehbaren Abfrage stammt.

**Gemini formuliert nur die Begründung** — einen Satz, der die Zahlen erklärt.
Ein Sprachmodell, das die ZAHL liefert, liefert bei zweimal derselben Datenlage
zwei verschiedene Zahlen, und niemand könnte sagen, welche stimmt (dieselbe
Trennung wie in `personal.ki_planung`). Ohne Vertex-Konfiguration entstehen die
Vorschläge trotzdem, nur ohne den erklärenden Satz — das ist KEIN Fehler.

WARUM REGELN UND NICHT PREISE
=============================
Entscheidung vom 04.09.2026, gestützt durch den Marktvergleich: PriceLabs,
Wheelhouse und RateBoard setzen alle auf regelbasierte Preisfindung; die KI
liegt bei ihnen im Forecast und in der Beratung, nicht im einzelnen Tagespreis.
Für uns kommt hinzu: „hier muss alles nachvollziehbar sein" (Nutzer, 04.09.2026).
Ein KI-gesetzter Tagespreis hat keinen Rechenweg, den man zeigen könnte — die
Regel-Engine hat einen.

Der Betrieb nimmt jeden Vorschlag EINZELN an. Angenommen wird nicht ein Preis,
sondern eine Einstellung in `dp_settings` — danach rechnet die Engine
deterministisch weiter, und die Wirkung steht im Kalender.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.ki import KiError, VertexClient
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.site_config import ki_nutzung

from .resolver import PricingError

log = get_logger("nextdays.pricing.ki_berater")

# Betrachtungszeitraum für die Auswertung (Tage rückwärts). Ein Jahr, damit jede
# Saison einmal vorkommt — kürzer, und der Vorschlag spiegelt nur die letzte
# Hoch- oder Nebensaison.
_HISTORIE_TAGE = 365
# Ab wie vielen ausgewerteten Nächten ein Vorschlag überhaupt entsteht. Darunter
# ist die Datenlage zu dünn; ein Vorschlag aus drei Buchungen wäre geraten
# (Wurzel 4: lieber kein Vorschlag als ein erfundener).
_MIN_NAECHTE = 30
# Ab welcher Abweichung ein Vorschlag überhaupt gemacht wird. Ein Aufschlag von
# 15,4 statt 15,0 % ist kein Rat, sondern Rauschen.
_MIN_ABWEICHUNG_PCT = 3.0
# Wie stark sich ein abgelehnter Vorschlag ändern muss, damit er erneut gezeigt
# wird. Darunter ist es derselbe Rat in neuen Kleidern — und den hat der Betrieb
# schon einmal verworfen.
_WIEDERVORLAGE_ABWEICHUNG = 0.25
# Zeitraum der Wirkungsvorschau. Ein Jahr, damit jede Saison einmal vorkommt —
# genau der Horizont, den der Betrieb im Kalender durchblättert.
_WIRKUNG_TAGE = 365
# Zeitraum der Marktprüfung (Tage voraus). 90 Tage: dort liegt die Nachfrage,
# die sich noch beeinflussen lässt, und dort ist das Raster der
# Marktbeobachtung dicht (wöchentliche Stichtage, siehe `market.beobachtung`).
_MARKT_TAGE = 90
# Ab welchem Anteil der Tage AM DECKEL die Marktregel als „ausgebremst" gilt.
# Ein Deckel, der an jedem zweiten Tag greift, ist kein Schutz mehr, sondern
# die eigentliche Regel — dann soll der Betrieb das sehen und entscheiden.
_DECKEL_ANTEIL = 0.5
# Höchster Deckel, den der Berater vorschlägt. Darüber wäre die Marktregel
# stärker als jede andere; wer mehr will, stellt es bewusst von Hand ein.
_DECKEL_MAX_PCT = 60.0


@dataclass
class Pruefung:
    """Ergebnis EINER Prüfung — auch wenn sie nichts vorschlägt.

    Ohne diesen Eintrag ist ein schweigender Berater nicht von einem kaputten
    zu unterscheiden: die Oberfläche zeigte "keine Vorschläge" und nannte zwei
    mögliche Gründe, ohne zu sagen, welcher zutrifft. Jede Prüfung sagt jetzt,
    WAS sie gemessen hat und WARUM sie schweigt (Regel: Debugging einbauen).
    """

    name: str
    titel: str
    ergebnis: str  # 'vorschlag' | 'passt' | 'zu_wenig_daten' | 'ruht' | 'aus'
    grund: str
    belege: dict[str, Any] = field(default_factory=dict)


@dataclass
class Vorschlag:
    """Ein einzelner Regel-Vorschlag — annehmbar oder verwerfbar.

    `feld` ist der Schlüssel in `dp_settings`, `wert_neu` der vorgeschlagene
    Wert. `belege` sind die Zahlen, aus denen er entstand — sie stehen in der
    Oberfläche BEIM Vorschlag, damit man ihn prüfen kann, statt ihn glauben zu
    müssen.
    """

    feld: str
    titel: str
    wert_alt: Any
    wert_neu: Any
    belege: dict[str, Any] = field(default_factory=dict)
    begruendung: str | None = None
    # Was der Vorschlag mit den PREISEN macht — eine Regel allein sagt dem
    # Betrieb nichts ("ab 80 % → +10 %" heißt wie viele Kronen?). Erst der
    # Vergleich der Tageskurve vorher/nachher macht ihn entscheidbar.
    wirkung: dict[str, Any] | None = None


class DpKiBerater:
    """Wertet die eigenen Buchungsdaten aus und schlägt Regeln vor."""

    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client
        # Was die letzte Auswertung geprüft hat — auch die Prüfungen ohne
        # Vorschlag. Der Router gibt sie mit, damit "keine Vorschläge"
        # erklärbar ist statt nur behauptet.
        self.pruefungen: list[Pruefung] = []

    def _db(self) -> Client:
        if self._client is None:
            raise PricingError("Preis-DB nicht verfügbar.", status_code=500)
        return self._client

    # -- öffentlich ----------------------------------------------------------
    def vorschlaege(
        self, ctx: AuthContext, property_id: str, *, mit_begruendung: bool = True
    ) -> list[Vorschlag]:
        """Regel-Vorschläge für ein Objekt aus seiner Buchungshistorie.

        Leere Liste ist ein gültiges Ergebnis: entweder ist die Datenlage zu dünn
        (< `_MIN_NAECHTE` Nächte) oder die Einstellungen passen bereits. Beides
        ist besser als ein geratener Rat.
        """
        heute = datetime.now(UTC).date()
        von = heute - timedelta(days=_HISTORIE_TAGE)
        settings = self._settings(property_id)
        naechte = self._belegte_naechte(property_id, von, heute)
        gesamt = (heute - von).days

        # Die Prüfliste wird IMMER gefüllt, auch wenn nichts vorgeschlagen wird.
        # Sie ist das, was der Betrieb bei "keine Vorschläge" lesen kann.
        self.pruefungen = []
        vorschlaege: list[Vorschlag] = []
        for ergebnis in (
            self._wochenende_pruefen(settings, naechte, von, heute),
            self._stufen_pruefen(settings, naechte, gesamt),
            self._spanne_pruefen(property_id, settings, von, heute),
            self._markt_pruefen(property_id, settings, heute),
        ):
            if isinstance(ergebnis, Pruefung):
                self.pruefungen.append(ergebnis)
            elif ergebnis is not None:
                vorschlaege.append(ergebnis)
                self.pruefungen.append(
                    Pruefung(
                        name=ergebnis.feld,
                        titel=ergebnis.titel,
                        ergebnis="vorschlag",
                        grund="Es gibt einen Vorschlag.",
                        belege=ergebnis.belege,
                    )
                )
        # Was der Betrieb abgelehnt hat, ruht — bis sich die Zahl wesentlich
        # ändert. Ein Berater, der denselben verworfenen Rat wiederholt, wird
        # ignoriert, und mit ihm die guten Vorschläge daneben.
        vorher = {v.feld for v in vorschlaege}
        vorschlaege = self._abgelehnte_filtern(property_id, vorschlaege)
        for feld in vorher - {v.feld for v in vorschlaege}:
            for pr in self.pruefungen:
                if pr.name == feld:
                    pr.ergebnis = "ruht"
                    pr.grund = (
                        "Dieser Vorschlag wurde schon einmal abgelehnt und "
                        "ruht, bis sich die Zahlen deutlich ändern."
                    )
        for v in vorschlaege:
            v.wirkung = self._wirkung(property_id, settings, v)

        if vorschlaege and mit_begruendung:
            self._begruenden(ctx, vorschlaege, self._regel_kontext(settings))
        return vorschlaege

    @staticmethod
    def _nichts(
        name: str,
        titel: str,
        ergebnis: str,
        grund: str,
        belege: dict[str, Any] | None = None,
    ) -> Pruefung:
        """Eine Prüfung, die NICHTS vorschlägt — mit ihrem Grund.

        Statt `return None`: ein stilles None ist im Betrieb nicht von einem
        Fehler zu unterscheiden.
        """
        return Pruefung(
            name=name, titel=titel, ergebnis=ergebnis,
            grund=grund, belege=belege or {},
        )

    # -- Auswertung (SERVER rechnet) -----------------------------------------
    def _settings(self, property_id: str) -> dict:
        rows = (
            self._db()
            .table("dp_settings")
            .select("*")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else {}

    def _belegte_naechte(
        self, property_id: str, von: date, bis: date
    ) -> set[str]:
        """ISO-Tage, an denen das Objekt belegt war (aus `availability`).

        `availability` ist die gepflegte Wahrheit des Kalenders — sie enthält
        auch Portalbuchungen, die nie durch unsere Buchungsstrecke liefen.
        """
        rows = (
            self._db()
            .table("availability")
            .select("date, status")
            .eq("property_id", property_id)
            .gte("date", von.isoformat())
            .lt("date", bis.isoformat())
            .eq("status", "booked")
            .execute()
        ).data or []
        return {r["date"] for r in rows if r.get("date")}

    @staticmethod
    def _quote(naechte: set[str], tage: list[date]) -> float | None:
        """Belegungsquote über eine Tagesmenge. None bei zu dünner Grundlage."""
        if len(tage) < _MIN_NAECHTE:
            return None
        belegt = sum(1 for d in tage if d.isoformat() in naechte)
        return belegt / len(tage)

    def _wochenende_pruefen(
        self, settings: dict, naechte: set[str], von: date, bis: date
    ) -> Vorschlag | Pruefung | None:
        """Wochenend-Aufschlag gegen die tatsächliche Wochenend-Auslastung.

        Sind Fr/Sa deutlich besser gebucht als der Rest, ist der Aufschlag zu
        niedrig — und umgekehrt. Der Vorschlag bewegt ihn in Richtung der
        gemessenen Differenz, nicht auf einen erfundenen Idealwert.
        """
        alle = [von + timedelta(days=i) for i in range((bis - von).days)]
        we = [d for d in alle if d.weekday() in (4, 5)]
        rest = [d for d in alle if d.weekday() not in (4, 5)]
        q_we, q_rest = self._quote(naechte, we), self._quote(naechte, rest)
        if q_we is None or q_rest is None or q_rest <= 0:
            return self._nichts(
                "weekend_uplift_pct", "Wochenend-Aufschlag", "zu_wenig_daten",
                "Keine belegten Werktage im Auswertungszeitraum — ohne "
                "Vergleichswert lässt sich kein Aufschlag ableiten.",
            )
        # Wie viel stärker ist das Wochenende nachgefragt? 0,80 vs. 0,50 = +60 %.
        # Der Aufschlag folgt dieser Differenz gedämpft (halbe Wirkung): die
        # Nachfrage-Differenz ist eine Mengenaussage, kein Preisaufschlag —
        # sie 1:1 in Prozent zu übersetzen wäre ein Denkfehler.
        differenz_pct = (q_we / q_rest - 1) * 100
        empfohlen = round(max(0.0, min(60.0, differenz_pct / 2)), 1)
        aktuell = float(settings.get("weekend_uplift_pct") or 0.0)
        if abs(empfohlen - aktuell) < _MIN_ABWEICHUNG_PCT:
            return self._nichts(
                "weekend_uplift_pct", "Wochenend-Aufschlag", "passt",
                f"Der eingestellte Aufschlag ({aktuell:.0f} %) trifft die "
                f"gemessene Nachfrage ({empfohlen:.0f} %) bereits.",
                {
                    "auslastung_wochenende_pct": round(q_we * 100, 1),
                    "auslastung_werktags_pct": round(q_rest * 100, 1),
                },
            )
        # Kein Vorschlag "auf 0": dass Fr/Sa in der VERGANGENHEIT nicht besser
        # liefen, kann am zu hohen Aufschlag selbst gelegen haben — den Aufschlag
        # daraufhin ganz abzuschaffen wäre ein Kurzschluss. Bei Gleichstand
        # schweigt der Berater lieber (live gesehen: Stjerneskud 45,2 % vs.
        # 46,0 % → "15 % auf 0" wäre ein schlechter Rat gewesen).
        if empfohlen <= 0:
            return self._nichts(
                "weekend_uplift_pct", "Wochenend-Aufschlag", "passt",
                "Fr/Sa sind nicht besser gebucht als die Werktage. Den "
                "Aufschlag deshalb abzuschaffen wäre ein Kurzschluss — er "
                "kann selbst der Grund sein.",
                {
                    "auslastung_wochenende_pct": round(q_we * 100, 1),
                    "auslastung_werktags_pct": round(q_rest * 100, 1),
                },
            )
        return Vorschlag(
            feld="weekend_uplift_pct",
            titel="Wochenend-Aufschlag anpassen",
            wert_alt=aktuell,
            wert_neu=empfohlen,
            belege={
                "auslastung_wochenende_pct": round(q_we * 100, 1),
                "auslastung_werktags_pct": round(q_rest * 100, 1),
                "naechte_ausgewertet": len(alle),
            },
        )

    def _stufen_pruefen(
        self, settings: dict, naechte: set[str], gesamt: int
    ) -> Vorschlag | Pruefung | None:
        """Auslastungsstufen vorschlagen, wenn noch keine gepflegt sind.

        Die Stufenleiter ist ablesbar, die Empfindlichkeits-Kurve nicht — wer
        gute Auslastung hat, sollte sie nutzen. Vorgeschlagen wird eine
        maßvolle Leiter, die zur gemessenen Gesamtauslastung passt.
        """
        anzahl = len(settings.get("occupancy_steps") or [])
        if anzahl:
            return self._nichts(
                "occupancy_steps", "Auslastungsstufen", "passt",
                f"Es sind bereits {anzahl} Stufen gepflegt — der Berater "
                "überschreibt gepflegte Regeln nicht.",
                {"stufen_gepflegt": anzahl},
            )
        if gesamt < _MIN_NAECHTE:
            return self._nichts(
                "occupancy_steps", "Auslastungsstufen", "zu_wenig_daten",
                f"Nur {gesamt} auswertbare Tage — mindestens "
                f"{_MIN_NAECHTE} sind nötig.",
                {"tage_ausgewertet": gesamt},
            )
        quote = len(naechte) / gesamt
        # Unter 40 % Auslastung keine AUFSCHLAGS-Stufen vorschlagen: einem
        # schwach gebuchten Objekt fehlt die Nachfrage, die ein Aufschlag
        # abschöpfen könnte — er verkauft dann noch weniger. Solange die
        # Grundauslastung nicht steht, ist die Stufenleiter das falsche
        # Werkzeug (live: Kornblomst mit 21,4 % bekam Aufschläge vorgeschlagen).
        if quote < 0.40:
            return self._nichts(
                "occupancy_steps", "Auslastungsstufen", "passt",
                f"Auslastung nur {quote * 100:.1f} % — Aufschlagsstufen "
                "brauchen Nachfrage, die sie abschöpfen können. Ab 40 % "
                "schlägt der Berater eine Leiter vor.",
                {"auslastung_gesamt_pct": round(quote * 100, 1)},
            )
        # Gut gebuchte Objekte vertragen eine steilere Leiter als schwache.
        steil = quote >= 0.6
        leiter = (
            [
                {"ab_pct": 50, "adjust_pct": 5},
                {"ab_pct": 75, "adjust_pct": 12},
                {"ab_pct": 85, "adjust_pct": 20},
                {"ab_pct": 95, "adjust_pct": 30},
            ]
            if steil
            else [
                {"ab_pct": 60, "adjust_pct": 4},
                {"ab_pct": 80, "adjust_pct": 10},
                {"ab_pct": 90, "adjust_pct": 15},
            ]
        )
        return Vorschlag(
            feld="occupancy_steps",
            titel="Auslastungsstufen einrichten",
            wert_alt=[],
            wert_neu=leiter,
            belege={
                "auslastung_gesamt_pct": round(quote * 100, 1),
                "tage_ausgewertet": gesamt,
            },
        )

    def _spanne_pruefen(
        self, property_id: str, settings: dict, von: date, bis: date
    ) -> Vorschlag | Pruefung | None:
        """Mindestpreis gegen die berechneten Tagespreise prüfen.

        Liegt der Mindestpreis weit unter allem, was die Engine je errechnet,
        schützt er nichts.

        AUSDRÜCKLICH IN DIE ZUKUNFT: `dynamic_prices` ist der berechnete
        VORRAT (heute bis ~540 Tage voraus), keine Historie — die Engine
        schreibt keine vergangenen Tage. Die Prüfung lief ursprünglich über
        denselben Rückblick-Zeitraum wie die Auslastung und fand deshalb
        ausnahmslos null Zeilen: sie konnte nie einen Vorschlag machen, und
        weil ein stilles `return None` folgte, fiel es nicht auf.

        Nicht `reservations.total_amount`: das ist je Portal ein anderer
        Betrag (Airbnb = Payout NACH 15,5 % Provision) und als Untergrenze
        systematisch zu niedrig.
        """
        # `von`/`bis` beschreiben den Rückblick der Auslastungsprüfung; hier
        # zählt der gleich lange Zeitraum VORAUS.
        vorschau_bis = bis + timedelta(days=(bis - von).days)
        rows = (
            self._db()
            .table("dynamic_prices")
            .select("price")
            .eq("property_id", property_id)
            .gte("date", bis.isoformat())
            .lt("date", vorschau_bis.isoformat())
            .execute()
        ).data or []
        preise = [float(r["price"]) for r in rows if r.get("price") is not None]
        if len(preise) < _MIN_NAECHTE:
            return self._nichts(
                "min_price", "Mindestpreis", "zu_wenig_daten",
                f"Nur {len(preise)} berechnete Tagespreise im Vorrat — "
                f"mindestens {_MIN_NAECHTE} sind nötig, um eine Untergrenze "
                "zu belegen. Dynamic Pricing muss dafür einmal gerechnet "
                "haben.",
                {"tage_ausgewertet": len(preise)},
            )
        niedrigster = round(min(preise), 2)
        aktuell = settings.get("min_price")
        # Nur vorschlagen, wenn gar keiner gesetzt ist oder er deutlich darunter
        # liegt (mehr als 20 % Abstand) — sonst ist es Rauschen.
        if aktuell is not None and float(aktuell) >= niedrigster * 0.8:
            return self._nichts(
                "min_price", "Mindestpreis", "passt",
                f"Der Mindestpreis ({float(aktuell):.0f}) liegt nah genug am "
                f"niedrigsten berechneten Preis ({niedrigster:.0f}).",
                {
                    "min_price": float(aktuell),
                    "niedrigster_berechneter_preis": niedrigster,
                },
            )
        return Vorschlag(
            feld="min_price",
            titel="Mindestpreis setzen",
            wert_alt=float(aktuell) if aktuell is not None else None,
            wert_neu=niedrigster,
            belege={
                "niedrigster_berechneter_preis": niedrigster,
                "hoechster_berechneter_preis": round(max(preise), 2),
                "tage_ausgewertet": len(preise),
            },
        )

    def _markt_pruefen(
        self, property_id: str, settings: dict, heute: date
    ) -> Vorschlag | Pruefung | None:
        """Marktregel gegen die Marktbeobachtung prüfen — nur wenn sie AN ist.

        Zwei Fragen: (1) Bekommt die Regel überhaupt ein Signal? Live stand
        der Markt-Faktor ein halbes Jahr auf 1,0, ohne dass es jemand sah —
        der Berater muss das benennen, sonst berät er an einer Attrappe
        vorbei. (2) Bremst der Deckel `market_max_adjust_pct` die Regel aus?
        Liegt der eigene Preis weit unter dem Markt, drückt der Faktor an den
        Deckel; greift der an jedem zweiten Tag, ist der Deckel die eigentliche
        Regel. Dann wird ein höherer Deckel vorgeschlagen — nie mehr als
        `_DECKEL_MAX_PCT`, und nie der Basispreis selbst (den setzt der Betrieb).
        """
        titel = "Marktregel"
        if not settings.get("market_enabled"):
            return self._nichts(
                "market_max_adjust_pct", titel, "aus",
                "Die Marktregel ist für dieses Objekt nicht eingeschaltet.",
            )
        lage = self._markt_lage(property_id, settings, heute)
        if lage is None:
            return self._nichts(
                "market_max_adjust_pct", titel, "zu_wenig_daten",
                "Für die Umgebung dieses Objekts liegt noch kein Marktsignal "
                "vor — die Regel ist an, wirkt aber nicht. Die Beobachtung "
                "läuft einmal täglich.",
            )
        belege = {
            "markt_median": lage["markt_median"],
            "eigener_schnitt": lage["eigener_schnitt"],
            "abstand_zum_markt_pct": lage["abstand_pct"],
            "tage_am_deckel": int(lage["tage_am_deckel"]),
            "tage_mit_signal": int(lage["tage"]),
        }
        deckel = float(settings.get("market_max_adjust_pct") or 0.0)
        anteil = lage["tage_am_deckel"] / lage["tage"] if lage["tage"] else 0.0
        if anteil < _DECKEL_ANTEIL:
            return self._nichts(
                "market_max_adjust_pct", titel, "passt",
                f"Die Marktregel wirkt: Markt {lage['markt_median']:.0f}, "
                f"eigener Schnitt {lage['eigener_schnitt']:.0f} "
                f"({lage['abstand_pct']:+.0f} %). Der Deckel von {deckel:.0f} % "
                f"greift an {int(lage['tage_am_deckel'])} von {int(lage['tage'])} Tagen.",
                belege,
            )
        # Deckel, der die gemessene Abweichung durchliesse, auf 5 gerundet,
        # begrenzt — ein Sprung von 25 auf 60 in einem Schritt wäre zu grob.
        noetig = min(_DECKEL_MAX_PCT, max(deckel + 5.0, round(lage["noetig_pct"] / 5) * 5))
        if noetig - deckel < _MIN_ABWEICHUNG_PCT:
            return self._nichts(
                "market_max_adjust_pct", titel, "passt",
                f"Der Deckel ({deckel:.0f} %) liegt schon nahe an dem, was der "
                f"Markt verlangt ({lage['noetig_pct']:.0f} %).",
                belege,
            )
        return Vorschlag(
            feld="market_max_adjust_pct",
            titel="Markt-Deckel anheben",
            wert_alt=deckel,
            wert_neu=noetig,
            belege={**belege, "deckel_noetig_pct": round(lage["noetig_pct"], 1)},
        )

    def _markt_lage(
        self, property_id: str, settings: dict, heute: date
    ) -> dict[str, float] | None:
        """Markt gegen eigenen Preis über `_MARKT_TAGE` Tage — dieselbe Quelle
        und dieselbe Faktor-Rechnung wie der Lauf (`UmgebungProvider`,
        `engine._market_factor`), damit der Berater nichts behauptet, was der
        Recompute anders rechnet. None = kein Signal."""
        from .engine import DaySignals, DpSettings, _market_factor  # noqa: PLC0415
        from .market.umgebung import UmgebungProvider  # noqa: PLC0415
        from .recompute import DynamicPricingRecompute  # noqa: PLC0415

        tage = [heute + timedelta(days=i) for i in range(1, _MARKT_TAGE + 1)]
        try:
            signal = UmgebungProvider(self._db(), property_id).market_signal(
                None, [], tage
            )
            basis = DynamicPricingRecompute(self._db()).load_base_price(property_id)
        except Exception as exc:  # noqa: BLE001 — Marktprüfung darf den Berater nicht kippen
            log.warning("dp_ki_marktlage_nicht_lesbar", error=str(exc)[:200])
            return None
        if not signal or basis is None or basis <= 0:
            return None
        cfg = DpSettings.from_row(settings)
        eigene = self._eigene_preise(property_id, tage)
        mediane: list[float] = []
        am_deckel = 0
        noetig: list[float] = []
        cap = cfg.market_max_adjust_pct / 100.0
        for tag in tage:
            md = signal.get(tag.isoformat())
            if md is None or md.comp_price is None:
                continue
            mediane.append(md.comp_price)
            faktor = _market_factor(
                cfg.effective_base(basis),
                DaySignals(day=tag, comp_price=md.comp_price),
                cfg,
            )
            # Am Deckel = der Faktor steht exakt auf ±cap (die Klammer griff).
            if cap > 0 and abs(abs(faktor - 1.0) - cap) < 1e-6:
                am_deckel += 1
            # Was der Faktor UNGEDECKELT gewesen wäre — daraus der nötige Deckel.
            roh = abs(md.comp_price - cfg.effective_base(basis)) / cfg.effective_base(basis)
            noetig.append(roh * cfg.market_sensitivity / 100.0 * cfg.aggressiveness * 100.0)
        if not mediane:
            return None
        markt = sum(mediane) / len(mediane)
        eigen = (
            sum(eigene.values()) / len(eigene) if eigene else cfg.effective_base(basis)
        )
        return {
            "markt_median": round(markt, 2),
            "eigener_schnitt": round(eigen, 2),
            "abstand_pct": round((eigen - markt) / markt * 100.0, 1) if markt else 0.0,
            "tage": float(len(mediane)),
            "tage_am_deckel": float(am_deckel),
            "noetig_pct": max(noetig) if noetig else 0.0,
        }

    def _eigene_preise(self, property_id: str, tage: list[date]) -> dict[str, float]:
        """Eigene berechnete Tagespreise (dynamic_prices) für die Tage."""
        try:
            rows = (
                self._db()
                .table("dynamic_prices")
                .select("date, price")
                .eq("property_id", property_id)
                .gte("date", min(tage).isoformat())
                .lte("date", max(tage).isoformat())
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001
            log.warning("dp_ki_eigene_preise_nicht_lesbar", error=str(exc)[:200])
            return {}
        return {
            str(r["date"])[:10]: float(r["price"])
            for r in rows
            if r.get("price") is not None
        }

    @staticmethod
    def _regel_kontext(settings: dict) -> dict[str, Any]:
        """Welche Regeln für dieses Objekt AN sind — der Kontext für die
        Begründung. Nur eingeschaltete Regeln, nur ihre Parameter: das Modell
        soll wissen, was schon wirkt, nicht die ganze Zeile nachlesen."""
        kontext: dict[str, Any] = {
            "dynamic_pricing_aktiv": bool(settings.get("enabled")),
            "basispreis_modus": settings.get("base_mode"),
            "aggressivitaet": settings.get("base_rate_mode"),
            "mindestpreis": settings.get("min_price"),
            "hoechstpreis": settings.get("max_price"),
            "wochenend_aufschlag_pct": settings.get("weekend_uplift_pct"),
        }
        if settings.get("market_enabled"):
            kontext["marktregel"] = {
                "empfindlichkeit_pct": settings.get("market_sensitivity"),
                "deckel_pct": settings.get("market_max_adjust_pct"),
            }
        if settings.get("weather_enabled"):
            kontext["wetterregel"] = {
                "deckel_pct": settings.get("weather_max_adjust_pct"),
            }
        if settings.get("occupancy_steps"):
            kontext["auslastungsstufen"] = settings.get("occupancy_steps")
        else:
            kontext["auslastungs_empfindlichkeit_pct"] = settings.get(
                "occupancy_sensitivity"
            )
        if settings.get("last_minute"):
            kontext["last_minute"] = settings.get("last_minute")
        if settings.get("far_future"):
            kontext["fruehbucher_aufschlag"] = settings.get("far_future")
        if settings.get("rate_rules"):
            kontext["eigene_regeln"] = settings.get("rate_rules")
        return kontext

    def _wirkung(
        self, property_id: str, settings_row: dict, vorschlag: Vorschlag
    ) -> dict[str, Any] | None:
        """Die Tagespreise mit und ohne den Vorschlag rechnen und vergleichen.

        Nutzt dieselbe Engine wie der Autopilot (`_price_curve`, rechnet ohne zu
        speichern) — die Vorschau kann deshalb nicht von dem abweichen, was
        später wirklich passiert. Zwei Kurven über ein Jahr, verglichen:
        Durchschnitt vorher/nachher, betroffene Tage, Spanne.

        None, wenn sich nichts errechnen lässt (kein Basispreis, kein Signal).
        Dann steht die Regel allein da — immer noch besser als eine erfundene
        Wirkung (Wurzel 4).
        """
        # Lokaler Import: recompute importiert seinerseits aus diesem Slice.
        from .engine import DpSettings  # noqa: PLC0415
        from .recompute import DynamicPricingRecompute  # noqa: PLC0415

        heute = datetime.now(UTC).date()
        bis = heute + timedelta(days=_WIRKUNG_TAGE)
        try:
            rc = DynamicPricingRecompute(self._db())
            basis = rc.load_base_price(property_id)
            if basis is None:
                return None
            vorher_cfg = DpSettings.from_row(settings_row)
            nachher_cfg = DpSettings.from_row(
                {**settings_row, vorschlag.feld: vorschlag.wert_neu}
            )
            vorher = rc.preis_kurve(property_id, basis, vorher_cfg, heute, heute, bis)
            nachher = rc.preis_kurve(property_id, basis, nachher_cfg, heute, heute, bis)
        except Exception as exc:  # noqa: BLE001 — Vorschau darf den Rat nicht kippen
            log.warning("dp_ki_wirkung_nicht_berechenbar", error=str(exc)[:200])
            return None

        n = {d: r.price for d, r in nachher if r.price is not None}
        paare = [
            (r.price, n[d]) for d, r in vorher if r.price is not None and d in n
        ]
        if not paare:
            return None
        alt = [a for a, _ in paare]
        neu = [b for _, b in paare]
        geaendert = [(a, b) for a, b in paare if abs(b - a) >= 0.01]
        return {
            "tage": len(paare),
            "tage_geaendert": len(geaendert),
            "schnitt_vorher": round(sum(alt) / len(alt), 2),
            "schnitt_nachher": round(sum(neu) / len(neu), 2),
            # Grösste Bewegung nach oben/unten — zeigt die Bandbreite, die ein
            # Durchschnitt verdeckt.
            "max_plus": round(max((b - a for a, b in geaendert), default=0.0), 2),
            "max_minus": round(min((b - a for a, b in geaendert), default=0.0), 2),
        }

    # -- Lernen aus den Entscheidungen des Betriebs ---------------------------
    def _abgelehnte_filtern(
        self, property_id: str, vorschlaege: list[Vorschlag]
    ) -> list[Vorschlag]:
        """Zuvor abgelehnte Vorschläge aussortieren, solange sie sich nicht
        wesentlich geändert haben.

        Best-effort: fehlt die Tabelle (Migration noch nicht eingespielt), wird
        nichts gefiltert — der Berater arbeitet dann wie zuvor, statt auszufallen.
        """
        if not vorschlaege:
            return vorschlaege
        try:
            rows = (
                self._db()
                .table("dp_ki_entscheidungen")
                .select("feld, wert_neu, entscheidung, created_at")
                .eq("property_id", property_id)
                .eq("entscheidung", "abgelehnt")
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — beraten ist besser als ausfallen
            log.warning("dp_ki_entscheidungen_nicht_lesbar", error=str(exc)[:200])
            return vorschlaege
        # Je Feld zählt die JÜNGSTE Ablehnung (die Liste ist absteigend sortiert).
        zuletzt: dict[str, Any] = {}
        for r in rows:
            zuletzt.setdefault(r["feld"], r.get("wert_neu"))
        return [
            v
            for v in vorschlaege
            if v.feld not in zuletzt
            or self._wesentlich_anders(zuletzt[v.feld], v.wert_neu)
        ]

    @staticmethod
    def _wesentlich_anders(
        abgelehnt: float | list[dict] | None, neu: float | list[dict] | None
    ) -> bool:
        """Unterscheidet sich der neue Vorschlag deutlich vom abgelehnten?

        Zahlen: relative Abweichung über der Schwelle. Alles andere (Listen wie
        die Stufenleiter): Ungleichheit genügt — eine sinnvolle Abstandsmessung
        zwischen zwei Leitern gibt es nicht, und Gleichheit ist eindeutig.
        """
        if isinstance(abgelehnt, (int, float)) and isinstance(neu, (int, float)):
            if abgelehnt == 0:
                return neu != 0
            return abs(neu - abgelehnt) / abs(abgelehnt) >= _WIEDERVORLAGE_ABWEICHUNG
        return abgelehnt != neu

    def entscheidung_merken(
        self,
        ctx: AuthContext,
        property_id: str,
        vorschlag: Vorschlag,
        *,
        angenommen: bool,
    ) -> None:
        """Eine Entscheidung protokollieren — best-effort.

        Best-effort mit Bedacht: die Einstellung ist beim Annehmen bereits
        gespeichert. Ein verlorener Protokolleintrag heißt nur, dass derselbe
        Vorschlag noch einmal erscheint — eine verworfene, schon wirksame
        Änderung wäre schlimmer. Der Fehler wird aber LAUT geloggt (Wurzel 5).
        """
        if not ctx.tenant_id:
            return
        try:
            self._db().table("dp_ki_entscheidungen").insert(
                {
                    "tenant_id": ctx.tenant_id,
                    "property_id": property_id,
                    "feld": vorschlag.feld,
                    "entscheidung": "angenommen" if angenommen else "abgelehnt",
                    "wert_alt": vorschlag.wert_alt,
                    "wert_neu": vorschlag.wert_neu,
                    "belege": vorschlag.belege,
                    "entschieden_von": ctx.user_id,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Protokoll darf die Aktion nicht kippen
            log.warning(
                "dp_ki_entscheidung_nicht_gespeichert",
                property_id=property_id, feld=vorschlag.feld, error=str(exc)[:200],
            )

    # -- Begründung (KI formuliert) ------------------------------------------
    def _begruenden(
        self,
        ctx: AuthContext,
        vorschlaege: list[Vorschlag],
        kontext: dict[str, Any] | None = None,
    ) -> None:
        """Jeden Vorschlag um EINEN erklärenden Satz ergänzen — best-effort.

        Die Vorschläge stehen bereits fest; die KI ändert keine Zahl. Ist sie
        nicht eingerichtet, am Tagesdeckel oder liefert sie Unbrauchbares,
        bleiben die Begründungen leer und die Vorschläge trotzdem gültig.

        `kontext` sind die AKTIVEN Regeln des Objekts samt Marktlage (siehe
        `_regel_kontext`). Ohne ihn begründete das Modell einen Wochenend-
        Aufschlag, ohne zu wissen, dass daneben Marktregel, Wetter und
        Stufenleiter wirken — und riet dann Dinge, die eine andere Regel
        längst abdeckt.
        """
        client = VertexClient()
        if not client.is_configured or not ctx.tenant_id:
            return
        try:
            ki_nutzung.deckel_pruefen(self._db(), ctx.tenant_id)
        except KiError:
            # Deckel erreicht ist kein Fehler DIESER Funktion — die Vorschläge
            # gehen ohne Begründung raus.
            return
        auftrag = json.dumps(
            {
                "aktive_regeln": kontext or {},
                "vorschlaege": [
                    {
                        "feld": v.feld,
                        "titel": v.titel,
                        "bisher": v.wert_alt,
                        "vorschlag": v.wert_neu,
                        "belege": v.belege,
                    }
                    for v in vorschlaege
                ],
            },
            ensure_ascii=False,
        )
        try:
            antwort = client.erzeuge(
                system=(
                    "Du bist Revenue-Manager einer Ferienvermietung. Du bekommst "
                    "unter 'aktive_regeln' die eingeschalteten Preisregeln des "
                    "Objekts samt Marktlage und unter 'vorschlaege' fertig "
                    "berechnete Vorschläge für Preis-EINSTELLUNGEN samt der "
                    "Zahlen, aus denen sie stammen. Begründe JEDEN Vorschlag "
                    "in EINEM kurzen deutschen Satz, der die Zahlen nennt und "
                    "die aktiven Regeln berücksichtigt. "
                    "Ändere KEINE Zahl und erfinde keine hinzu. Antworte "
                    "ausschließlich als JSON-Array von Objekten "
                    '[{"feld": "...", "begruendung": "..."}] ohne weiteren Text.'
                ),
                user=auftrag,
                temperature=0.2,
                max_tokens=600,
            )
        except KiError as exc:
            log.warning("dp_ki_begruendung_fehlgeschlagen", grund=str(exc)[:200])
            return
        ki_nutzung.buchen(
            self._db(), ctx.tenant_id,
            user_id=ctx.user_id, funktion="dp_regel_berater", antwort=antwort,
        )
        self._begruendungen_zuordnen(antwort.text, vorschlaege)

    @staticmethod
    def _begruendungen_zuordnen(text: str, vorschlaege: list[Vorschlag]) -> None:
        """Die JSON-Antwort den Vorschlägen zuordnen — was nicht passt, bleibt leer.

        Gemini antwortet trotz Anweisung gelegentlich mit einem ```json-Block;
        die Zäune werden entfernt. Ist die Antwort unbrauchbar, behalten die
        Vorschläge ihre leere Begründung: lieber keine Erklärung als eine, die
        zu einem anderen Vorschlag gehört.
        """
        roh = text.strip()
        if roh.startswith("```"):
            roh = roh.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        try:
            daten = json.loads(roh)
        except json.JSONDecodeError:
            log.warning("dp_ki_begruendung_unlesbar")
            return
        if not isinstance(daten, list):
            return
        je_feld = {
            d.get("feld"): d.get("begruendung")
            for d in daten
            if isinstance(d, dict) and isinstance(d.get("begruendung"), str)
        }
        for v in vorschlaege:
            v.begruendung = je_feld.get(v.feld)
