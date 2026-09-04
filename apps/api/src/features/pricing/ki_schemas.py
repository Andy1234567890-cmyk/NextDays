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
    """Wie viele berechnete Tage warten auf die Freigabe?"""

    property_id: str
    freigabe_noetig: bool
    offen: int


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
