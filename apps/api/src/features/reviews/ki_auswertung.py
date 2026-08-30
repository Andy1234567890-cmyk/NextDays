"""Die KI-Deutung zu Kennzahlen verdichten — Themen, Stimmungsverlauf, Bilanz.

Trennung zu :mod:`ki_deutung`: dort entsteht die Deutung EINER Bewertung
(ein Vertex-Aufruf), hier wird über viele gerechnet (kein Aufruf, nur SQL) —
mit der einen Ausnahme :func:`bilanz`, die den Text erzeugt, den kein
Aggregat liefern kann.

Warum das nicht im Dashboard mitläuft: die Themen-Rangliste ist eine reine
Zählung über gespeicherte Spalten und in Millisekunden da; die Bilanz ist ein
Modellaufruf über sechzig Texte und dauert Sekunden. Beides in einen Endpunkt
zu legen hieße, jeden Dashboard-Aufruf mit einem Vertex-Aufruf zu bezahlen —
für einen Text, den sich niemand jedes Mal neu durchliest.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.features.site_config.ki_nutzung import buchen, deckel_pruefen

from .ki_deutung import KiDeutungFehler, bilanz_ziehen
from .schemas import (
    AiBilanz,
    AiInsights,
    AiSentiment,
    AiSentimentPoint,
    AiThemeCount,
    AiThemeKey,
)

log = get_logger("nextdays.reviews.auswertung")

# Wie viele Bewertungen höchstens in EINE Auswertung eingehen. Über einem Jahr
# und mehreren hundert Bewertungen wird die Aussage nicht besser, die Antwort
# aber groß (Wurzel 8: jeder unbegrenzte Bereich bekommt eine Obergrenze).
_MAX_ZEILEN = 2_000

# Unter so vielen ausgewerteten Bewertungen wird gar keine Bilanz gezogen. Aus
# zwei Texten ein Muster abzuleiten wäre eine Behauptung, keine Auswertung —
# und der Betrieb würde danach handeln (Wurzel 4: lieber klar sagen, dass es
# nicht reicht, als eine plausible Aussage erfinden).
MIN_FUER_BILANZ = 5


def _zeilen(
    db: Client,
    tenant_id: str,
    eigene: list[str] | None,
    von: date,
    bis: date,
) -> list[dict]:
    """Beide Quellen auf eine flache Liste bringen: {tag, stimmung, themen}.

    ``ki_bewertet_at is null`` wird NICHT gefiltert — die ungedeuteten Zeilen
    werden mitgezählt, damit ``gesamt`` und ``ausgewertet`` nebeneinander
    stehen können. Eine Themen-Rangliste aus 12 von 400 Bewertungen ist keine
    Aussage über das Objekt, und das muss man sehen können.
    """
    ende = (bis + timedelta(days=1)).isoformat()
    zeilen: list[dict] = []

    markt = (
        db.table("reviews")
        .select(
            "created_at, ki_stimmung, ki_themen, ki_bewertet_at, property_id, "
            "properties!inner(tenant_id)"
        )
        .eq("properties.tenant_id", tenant_id)
        .gte("created_at", von.isoformat())
        .lt("created_at", ende)
        .limit(_MAX_ZEILEN)
    )
    if eigene is not None:
        markt = markt.in_("property_id", eigene)
    for row in (markt.execute().data or []):
        zeilen.append(
            {
                "tag": str(row["created_at"])[:10],
                "stimmung": row.get("ki_stimmung"),
                "themen": row.get("ki_themen"),
                "gedeutet": bool(row.get("ki_bewertet_at")),
            }
        )

    ota = (
        db.table("channex_review")
        .select(
            "received_at, created_at, ki_stimmung, ki_themen, ki_bewertet_at, "
            "property_id"
        )
        .eq("tenant_id", tenant_id)
        .eq("is_archived", False)
        .gte("received_at", von.isoformat())
        .lt("received_at", ende)
        .limit(_MAX_ZEILEN)
    )
    if eigene is not None:
        ota = ota.in_("property_id", eigene)
    for row in (ota.execute().data or []):
        zeilen.append(
            {
                "tag": str(row.get("received_at") or row["created_at"])[:10],
                "stimmung": row.get("ki_stimmung"),
                "themen": row.get("ki_themen"),
                "gedeutet": bool(row.get("ki_bewertet_at")),
            }
        )
    return zeilen


def _themen_zaehlen(zeilen: list[dict]) -> list[AiThemeCount]:
    """Themen nach Richtung getrennt zählen, häufigste zuerst.

    Die Trennung nach Richtung ist der Punkt: „Lage: 40-mal genannt" sagt
    nichts, „Lage: 38 positiv, 2 negativ" ist ein Befund. Sortiert wird nach
    Gesamtzahl, nicht nach negativen — sonst verschwindet die meistgenannte
    Stärke aus dem Bild, und das Dashboard zeigt nur noch Sorgen.
    """
    katalog = {e.value for e in AiThemeKey}
    richtungen = {e.value for e in AiSentiment}
    zaehler: dict[str, dict[str, int]] = defaultdict(
        lambda: {"positiv": 0, "neutral": 0, "negativ": 0}
    )
    for zeile in zeilen:
        roh = zeile.get("themen")
        if not isinstance(roh, list):
            continue
        for eintrag in roh:
            if not isinstance(eintrag, dict):
                continue
            thema = str(eintrag.get("thema") or "")
            if thema not in katalog:
                continue
            richtung = str(eintrag.get("richtung") or "neutral")
            zaehler[thema][
                richtung if richtung in richtungen else "neutral"
            ] += 1

    out = [
        AiThemeCount(
            thema=AiThemeKey(thema),
            positiv=werte["positiv"],
            neutral=werte["neutral"],
            negativ=werte["negativ"],
        )
        for thema, werte in zaehler.items()
    ]
    out.sort(key=lambda t: (t.gesamt, t.negativ), reverse=True)
    return out


def _verlauf(zeilen: list[dict], von: date, bis: date) -> list[AiSentimentPoint]:
    """Ein Punkt je Tag mit Bewertung. Tage ohne bleiben WEG, nicht auf null.

    Dieselbe Regel wie beim Notenverlauf (Wurzel 4): eine 0 an einem Tag ohne
    Bewertung wäre ein Einbruch, den es nicht gab. Die Anzeige zeichnet die
    Lücke, sie erfindet sie nicht.
    """
    je_tag: dict[str, dict[str, int]] = defaultdict(
        lambda: {"positiv": 0, "neutral": 0, "negativ": 0}
    )
    for zeile in zeilen:
        stimmung = zeile.get("stimmung")
        if stimmung not in {e.value for e in AiSentiment}:
            continue
        je_tag[zeile["tag"]][str(stimmung)] += 1

    punkte = []
    for tag in sorted(je_tag):
        try:
            tagesdatum = date.fromisoformat(tag)
        except ValueError:
            continue
        if not von <= tagesdatum <= bis:
            continue
        werte = je_tag[tag]
        punkte.append(
            AiSentimentPoint(
                date=tagesdatum,
                positiv=werte["positiv"],
                neutral=werte["neutral"],
                negativ=werte["negativ"],
            )
        )
    return punkte


def insights(
    db: Client,
    tenant_id: str,
    *,
    eigene: list[str] | None,
    von: date,
    bis: date,
) -> AiInsights:
    """Stimmungsverteilung, Themen-Rangliste und Verlauf über einen Zeitraum.

    Reines Rechnen über gespeicherte Spalten — kein Modellaufruf, keine
    Kosten. Der Aufrufer hat Zeitraum und Objekt-Scope bereits geprüft.
    """
    zeilen = _zeilen(db, tenant_id, eigene, von, bis)
    gedeutet = [z for z in zeilen if z["gedeutet"]]
    verteilung = {"positiv": 0, "neutral": 0, "negativ": 0}
    for zeile in gedeutet:
        stimmung = str(zeile.get("stimmung") or "")
        if stimmung in verteilung:
            verteilung[stimmung] += 1

    return AiInsights(
        from_date=von,
        to_date=bis,
        gesamt=len(zeilen),
        ausgewertet=len(gedeutet),
        positiv=verteilung["positiv"],
        neutral=verteilung["neutral"],
        negativ=verteilung["negativ"],
        themen=_themen_zaehlen(gedeutet),
        series=_verlauf(gedeutet, von, bis),
    )


def bilanz(
    db: Client,
    tenant_id: str,
    *,
    property_id: str,
    property_title: str | None,
    von: date,
    bis: date,
) -> AiBilanz:
    """Verbesserungs-Bilanz EINES Objekts. Ein Modellaufruf.

    Wirft :class:`ki_deutung.KiDeutungFehler`, wenn zu wenige Bewertungen mit
    Text vorliegen — kein „reicht schon", keine Aussage aus drei Texten. Der
    Betrieb handelt nach dem, was hier steht; eine Empfehlung aus zu dünner
    Grundlage ist schädlicher als keine (Wurzel 4).

    Die Bilanz wird NICHT gespeichert: anders als die Deutung einer einzelnen
    Bewertung ändert sie sich mit jeder neuen Bewertung und mit jedem
    gewählten Zeitraum. Ein Zwischenspeicher müsste beides als Schlüssel
    führen und würde beim ersten vergessenen Gegenzustand veralteten Rat
    ausliefern.
    """
    ende = (bis + timedelta(days=1)).isoformat()

    texte: list[dict] = []
    markt = (
        db.table("reviews")
        .select("text, rating, created_at, properties!inner(tenant_id)")
        .eq("properties.tenant_id", tenant_id)
        .eq("property_id", property_id)
        .not_.is_("text", "null")
        .gte("created_at", von.isoformat())
        .lt("created_at", ende)
        .order("created_at", desc=True)
        .limit(_MAX_ZEILEN)
    )
    for row in (markt.execute().data or []):
        texte.append(
            {
                "text": row.get("text"),
                "rating": row.get("rating"),
                "kanal": "myBestDays",
            }
        )

    ota = (
        db.table("channex_review")
        .select("content, overall_score, ota, received_at, created_at")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .eq("is_archived", False)
        .not_.is_("content", "null")
        .gte("received_at", von.isoformat())
        .lt("received_at", ende)
        .order("received_at", desc=True)
        .limit(_MAX_ZEILEN)
    )
    for row in (ota.execute().data or []):
        note = row.get("overall_score")
        texte.append(
            {
                "text": row.get("content"),
                # Auf 1..5 bringen, damit das Modell nicht eine 8 als
                # schlechte Note liest (Wurzel 4: die Skala gehört zum Kanal).
                "rating": round(float(note) / 2, 1) if note is not None else None,
                "kanal": row.get("ota"),
            }
        )

    if len(texte) < MIN_FUER_BILANZ:
        raise KiDeutungFehler(
            f"Zu wenige Bewertungen mit Text ({len(texte)}, nötig sind "
            f"{MIN_FUER_BILANZ})."
        )

    # VOR dem Aufruf, nicht danach: der Deckel soll den bezahlten Aufruf
    # verhindern, nicht ihn nachträglich beklagen.
    deckel_pruefen(db, tenant_id)
    ergebnis = bilanz_ziehen(bewertungen=texte, objektname=property_title)
    buchen(
        db,
        tenant_id,
        user_id=None,
        funktion="bewertung_bilanz",
        antwort=ergebnis.antwort,
    )
    log.info(
        "ki_bilanz_erzeugt",
        tenant_id=tenant_id,
        property_id=property_id,
        grundlage=ergebnis.grundlage,
        tokens_ein=ergebnis.antwort.tokens_ein,
        tokens_aus=ergebnis.antwort.tokens_aus,
    )
    return AiBilanz(
        property_id=property_id,
        property_title=property_title,
        grundlage=ergebnis.grundlage,
        staerken=ergebnis.staerken,
        schwaechen=ergebnis.schwaechen,
        empfehlungen=ergebnis.empfehlungen,
        zusammenfassung=ergebnis.zusammenfassung,
    )
