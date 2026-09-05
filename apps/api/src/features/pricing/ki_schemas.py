"""Schemas des KI-Regel-Beraters (Dynamic Pricing).

BEWUSST NICHT in `schemas.py`: die ist SCHWESTERDATEI und muss byte-identisch
mit `apps/public-api/src/features/pricing/schemas.py` bleiben. Der Berater ist
ein reines Dashboard-Feature und hat in der Partner-API nichts zu suchen — ihn
dort einzutragen hieße, die Kopie mitzuziehen, ohne dass sie ihn je nutzt.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field


class KiVorschlag(BaseModel):
    """Ein Regel-Vorschlag — eine EINSTELLUNG, kein Preis.

    `belege` sind die Zahlen, aus denen der Vorschlag entstand; sie stehen in
    der Oberfläche neben ihm, damit er prüfbar ist statt geglaubt werden zu
    müssen. `begruendung` ist der einzige Teil, der vom Sprachmodell stammt —
    fehlt er (KI nicht eingerichtet, Tagesdeckel erreicht), bleibt der
    Vorschlag gültig und annehmbar.
    """

    feld: str
    titel: str
    wert_alt: Any = None
    wert_neu: Any = None
    belege: dict[str, Any] = Field(default_factory=dict)
    begruendung: str | None = None
    # Was der Vorschlag mit den PREISEN macht (Durchschnitt vorher/nachher,
    # betroffene Tage, grösste Bewegung). None, wenn nicht berechenbar — dann
    # steht die Regel allein, statt eine erfundene Wirkung zu behaupten.
    wirkung: dict[str, Any] | None = None


class KiPruefung(BaseModel):
    """Was EINE Prüfung ergeben hat — auch wenn sie nichts vorschlägt.

    Ohne diese Liste ist "keine Vorschläge" nicht von einem defekten Berater
    zu unterscheiden. `ergebnis` sagt, ob geraten wurde ('vorschlag'), die
    Einstellung bereits passt ('passt'), die Datenlage zu dünn ist
    ('zu_wenig_daten'), ein abgelehnter Rat ruht ('ruht') oder die geprüfte
    Regel für das Objekt gar nicht eingeschaltet ist ('aus').
    """

    name: str
    titel: str
    ergebnis: str
    grund: str
    belege: dict[str, Any] = Field(default_factory=dict)


class KiVorschlaegeResponse(BaseModel):
    property_id: str
    vorschlaege: list[KiVorschlag]
    # Leere Liste ist ein gültiges Ergebnis (Datenlage zu dünn ODER die Regeln
    # passen bereits). `hinweis` sagt, welcher Fall vorliegt — eine leere Liste
    # ohne Erklärung sieht aus wie ein Fehler.
    hinweis: str | None = None
    # Jede einzelne Prüfung mit ihrem Grund — das eigentliche Debugging.
    pruefungen: list[KiPruefung] = Field(default_factory=list)


class KiVorschlagAnnehmen(BaseModel):
    """Genau EINEN Vorschlag übernehmen.

    Das Feld muss der Berater aktuell vorschlagen — sonst wäre dies ein
    zweiter, ungeprüfter Schreibweg in `dp_settings` an der regulären
    Validierung vorbei (Wurzel 3: der Anfrage nicht vertrauen).
    """

    feld: str
    wert: Any = None


class TagesmodusSetzen(BaseModel):
    """Modus für einen Datumsbereich setzen.

    `adjust_pct` nur bei 'anpassung', `preis` nur bei 'manuell'. Die
    Zusammengehörigkeit prüft der Service — hier stehen nur die Wertebereiche,
    deckungsgleich mit dem DB-CHECK aus 0554.
    """

    von: date
    bis: date
    modus: Literal["dynamisch", "anpassung", "manuell"]
    adjust_pct: float | None = Field(default=None, ge=-90, le=300)
    preis: float | None = Field(default=None, ge=0)


class TagesmodusEintrag(BaseModel):
    date: str
    modus: str
    adjust_pct: float | None = None


class TagesmodusAntwort(BaseModel):
    property_id: str
    tage: int
    modus: str


class FreigabeStand(BaseModel):
    """Wie viele berechnete Tage sind noch nicht an den Portalen?

    `offen` zählt ungestempelte Tage im Sende-Fenster. Was das BEDEUTET, hängt
    an `freigabe_noetig`: mit Freigabepflicht warten sie auf den Klick des
    Betriebs; ohne (Sofort-Modus) ist die Automatik dran — dann ist `sendet`
    gesetzt, weil der Abruf den Lauf bereits eingereiht hat. Ein Zähler ohne
    diese Unterscheidung fragte den Betrieb nach einer Freigabe, die er
    ausdrücklich abgeschaltet hatte (05.09.2026).
    """

    property_id: str
    freigabe_noetig: bool
    offen: int
    sendet: bool = False


class StufenVorschau(BaseModel):
    """Durchschnittlicher Tagespreis je Aggressivitäts-Stufe.

    None = kein Basispreis hinterlegt. Die Stufe „aggressiv" ohne Betrag
    daneben ist keine Entscheidungsgrundlage — deshalb rechnet der Server
    jede einmal durch.
    """

    property_id: str
    conservative: float | None = None
    recommended: float | None = None
    aggressive: float | None = None


class MarktPunkt(BaseModel):
    """Ein Tag der Marktkurve: was die Umgebung an diesem Tag verlangt.

    Bewusst OHNE Objektnamen und ohne Einzelpreise — nur der Median über
    mindestens `mindestens_noetig` Objekte. Eine Liste benannter Fremdinserate
    wäre eine Wettbewerber-Datenbank im Produkt; für die Preisfindung braucht
    der Betrieb das Niveau seiner Umgebung, nicht den Namen des Nachbarn.
    """

    tag: str
    markt_median: float
    # Streuung: wie einig sich die Umgebung ist. Weit auseinander = das eigene
    # Objekt hat Spielraum, eng = der Markt ist durchpreist.
    p25: float | None = None
    p75: float | None = None
    anzahl: int = 0
    # Eigener berechneter Preis am selben Tag — die Karte zeigt den Abstand.
    eigener_preis: float | None = None


class MarktAngebot(BaseModel):
    """Ein beobachteter Angebotspreis der Region — ein Punkt auf der Karte.

    Bewusst ein ANGEBOT und kein Gebiet mehr: das Feinraster mit Fünferschwelle
    liess in dünn besiedelten Ferienregionen fast alle Objekte unter die
    Gruppengrenze fallen, die Karte blieb an einzelnen Tagen leer (gemessen
    04.09.2026: 15 Objekte auf fünf Teilgebiete mit 4/3/3/3/2 Häusern, keines
    sichtbar). Entscheidung des Nutzers: „in der Region 50 km alle Objekte nur
    mit Preis" — jeder Preis ein Punkt, keine Schwelle.

    Weiterhin OHNE Namen, ID oder Link; der Ort ist auf ~100 m gerundet. Ein
    Punkt sagt „hier kostet eine Nacht X", nicht „das ist das Haus von Y".
    """

    # Für welchen Aufenthaltstag dieser Preis gilt — die Karte wechselt mit
    # dem gewählten Tag, sonst zeigte sie beim Umschalten weiter das alte Bild.
    tag: str
    lat: float
    lng: float
    preis: float


class MarktStand(BaseModel):
    """Gibt es überhaupt einen Markt für dieses Objekt?

    Der Schalter „Marktdaten nutzen" war bis 04.09.2026 eine Attrappe: an,
    aber ohne Quelle — der Faktor stand an allen 400 Tagen auf 1,0. Der
    Umkreis über die eigene Plattform konnte das nicht heilen: gemessen haben
    40 von 44 aktiven Objekten keinen einzigen Nachbarn eines fremden
    Betriebs. Seither trägt die tägliche Marktbeobachtung das Signal.
    """

    property_id: str
    # Vergleichbare Objekte in der Rasterzelle (Median-Basis des nächsten Tags).
    vergleichsobjekte: int = 0
    mindestens_noetig: int = 5
    # Kantenlänge des beobachteten Gebiets — der echte Wert kommt aus
    # `market.beobachtung._ZELLE_GRAD`, der Default ist nur der Schema-Platzhalter.
    radius_km: float = 50.0
    # Median der Nachbarpreise über die nächsten 30 Tage (None = kein Signal).
    markt_median: float | None = None
    # Währung der Marktwerte — nie annehmen (Wurzel 4).
    waehrung: str | None = None
    # Wann WIR zuletzt abgerufen haben (unsere Uhr, klar benannt — Wurzel 5b).
    stand_vom: str | None = None
    quelle: str | None = None
    # Standort des eigenen Objekts — die Karte braucht ihn, und er liegt hier
    # ohnehin vor. Ihn durch die Übersichtsliste zu schleifen hieße, ein
    # Listenschema für eine Detailansicht zu verbreitern.
    lat: float | None = None
    lng: float | None = None
    # Die Kurve für die Karte: ein Punkt je Tag mit Signal.
    verlauf: list[MarktPunkt] = Field(default_factory=list)
    # Alle beobachteten Angebotspreise der Region je Stichtag — die Punkte der
    # Karte. Je Tag gedeckelt (siehe `market.stand._MAX_ANGEBOTE_JE_TAG`).
    angebote: list[MarktAngebot] = Field(default_factory=list)
    # Warum es (noch) kein Signal gibt — leer, wenn eines vorliegt.
    hinweis: str | None = None


# --- 0562: Preisgrenzen, Portalstand, Verlauf, Vorschau, Forecast ---------------


class Preisgrenze(BaseModel):
    """Mindest-/Hoechstpreis fuer einen Zeitraum (SiteMinder „Floor and ceiling
    override"). Mindestens eine der beiden Grenzen ist gesetzt."""

    id: str
    property_id: str
    bezeichnung: str
    von: date
    bis: date
    # 0 = Montag … 6 = Sonntag; None = alle Tage.
    wochentage: list[int] | None = None
    jaehrlich: bool = False
    min_price: float | None = None
    max_price: float | None = None


class PreisgrenzeAnlegen(BaseModel):
    bezeichnung: str = Field(min_length=1, max_length=80)
    von: date
    bis: date
    wochentage: list[int] | None = Field(default=None, max_length=7)
    jaehrlich: bool = False
    min_price: float | None = Field(default=None, ge=0)
    max_price: float | None = Field(default=None, ge=0)


class PortalstandTag(BaseModel):
    """Soll/Ist eines Tages: was wir berechnet haben, was laut unserem Schatten
    (`channex_ari_shadow`) bei den Portalen steht."""

    date: date
    berechnet: float | None = None
    portal: float | None = None
    # berechnet - portal in Prozent vom Portalpreis; None ohne Vergleich.
    abweichung_pct: float | None = None
    # Greift an diesem Tag eine Aktion, ist `berechnet` bereits gesenkt —
    # hier steht um wie viel (z. B. -20.0), damit die Zahl erklärbar bleibt.
    aktion_pct: float | None = None


class Portalstand(BaseModel):
    property_id: str
    waehrung: str | None = None
    # Ratenplan, gegen dessen Schatten verglichen wird.
    rate_plan_id: str | None = None
    tage: list[PortalstandTag]
    # Wie viele Tage im Zeitraum weichen um mehr als die Toleranz ab?
    abweichend: int = 0
    # Wann UNSER Schatten zuletzt fortgeschrieben wurde (Wurzel 5b).
    schatten_stand: str | None = None
    hinweis: str | None = None


class VerlaufEintrag(BaseModel):
    id: str
    von: date
    bis: date
    ereignis: str
    details: dict[str, Any] = Field(default_factory=dict)
    # None = Automatik (Cron/Worker).
    user_id: str | None = None
    user_name: str | None = None
    created_at: str


class VorschauTag(BaseModel):
    """Ein Tag der Kurve, wie sie MIT eingeschaltetem Dynamic Pricing waere.
    Nichts davon wird gespeichert oder gesendet."""

    date: date
    price: float
    factors: dict[str, float] = Field(default_factory=dict)


class ForecastTag(BaseModel):
    date: date
    belegt: bool
    # Gelernte Erwartung, dass dieser Tag bei diesem Vorlauf belegt ist (0..1).
    # None = keine gelernte Zelle (Cold-Start) — kein erfundener Wert.
    erwartet: float | None = None
    # Freie Angebote der Umgebung an diesem Tag (markt_beobachtung.anzahl);
    # None = kein Stichtag in der Naehe.
    markt_angebote: int | None = None


class Forecast(BaseModel):
    property_id: str
    horizont_tage: int
    tage: list[ForecastTag]
    # Kennzahlen ueber den Horizont.
    belegt_pct: float
    erwartet_pct: float | None = None
    # „vor" = mehr belegt als gelernt erwartet, „hinter" = weniger, None ohne Modell.
    pace: Literal["vor", "im_plan", "hinter"] | None = None
    hinweis: str | None = None


class PreisberichtPunkt(BaseModel):
    """Ein Stichtag des Preisberichts: Markt, eigener Preis, Grundpreis."""

    tag: str
    markt_median: float
    p25: float | None = None
    p75: float | None = None
    anzahl: int = 0
    eigener_preis: float | None = None
    grundpreis: float | None = None
    # (eigener − Markt) / Markt in Prozent; None ohne eigenen Preis.
    abstand_pct: float | None = None


class Preisbericht(BaseModel):
    """Die Auswertung des Dynamic Pricing für ein Objekt (Seite „Preise & Markt")."""

    property_id: str
    waehrung: str | None = None
    stand_vom: str | None = None
    radius_km: float = 50.0
    hinweis: str | None = None
    verlauf: list[PreisberichtPunkt] = Field(default_factory=list)
    # Mittlerer Abstand zum Markt-Median über alle Stichtage mit eigenem Preis.
    abstand_schnitt_pct: float | None = None
    # Stichtage nach Lage: unter −8 %, zwischen, ab +8 % — dieselben Grenzen
    # wie die Farbskala der Karte.
    stichtage_unter_markt: int = 0
    stichtage_am_markt: int = 0
    stichtage_ueber_markt: int = 0
    grundpreis: float | None = None
    horizont_tage: int = 365
    tage_mit_preis: int = 0
    preis_schnitt: float | None = None
    preis_min: float | None = None
    preis_max: float | None = None
    # Summe der berechneten Preise gegen Grundpreis × Tage, in Prozent.
    uplift_pct: float | None = None
    ki_angenommen: int = 0
    ki_abgelehnt: int = 0
    ki_angenommen_90: int = 0
    ki_abgelehnt_90: int = 0
