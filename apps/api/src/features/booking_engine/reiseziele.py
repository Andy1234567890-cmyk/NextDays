"""Reiseziel-Vorschläge des Suchfelds: Städte und Länder aus dem echten Bestand.

Eigenes Modul (nicht im Service), weil es fachlich mit der Motiv-Wahl
(``reiseziel_motiv``) zusammengehört und der Service sonst über seine
Zeilengrenze wächst. Der Service bleibt der einzige Einstieg (er hält DB und
Sichtbarkeitsregeln), hier steht nur die Aggregation.

Der Bug, der dieses Modul nötig machte: das Suchfeld zeigte eine im Code
hartkodierte Liste (Paris, Barcelona, Bangkok, Tokio, Rom), in der kein einziges
Objekt lag, und verschwieg jeden real vorhandenen Ort.
"""
from src.core.countries import country_codes_matching, country_name, normalize_country

from .reiseziel_motiv import land_motiv, stadt_motiv
from .schemas import PublicDestination

# Motiv-Priorität, wenn ein Ort mehrere Objekttypen/Lagen hat: das spezifischere
# Landschaftsmotiv gewinnt über das neutrale. Feste Ordnung, damit derselbe Ort
# bei jedem Abruf dasselbe Bild bekommt (die Query-Reihenfolge ist nicht stabil
# und wäre hier eine stille Zufallsentscheidung).
_MOTIV_PRIORITAET = ("insel", "kueste", "berge", "see", "stadt", "land")


def _motiv_waehlen(kandidaten: set[str]) -> str:
    for motiv in _MOTIV_PRIORITAET:
        if motiv in kandidaten:
            return motiv
    return "land"


def land_treffer(needle: str) -> set[str]:
    """ISO-Codes, die zu einer Freitext-Eingabe passen.

    `properties.country` speichert „DK", der Gast tippt „Dänemark" — ohne diese
    Auflösung fand die Landessuche NIE etwas."""
    if not needle:
        return set()
    treffer = set(country_codes_matching(needle))
    voll = normalize_country(needle)
    if voll:
        treffer.add(voll)
    return treffer


def ziele_aus_objekten(
    rows: list[dict],
    *,
    q: str | None = None,
    limit: int = 8,
) -> list[PublicDestination]:
    """Objektzeilen (city/country/property_type/lat/lng) → Reiseziel-Vorschläge.

    Die Zeilen müssen bereits auf die sichtbaren Objekte gefiltert sein (der
    Service macht das mit denselben Regeln wie die Objektliste), damit kein Ziel
    vorgeschlagen wird, dessen Suche danach leer ausgeht.
    """
    needle = (q or "").strip().lower()
    laender_treffer = land_treffer(needle)

    staedte: dict[tuple[str, str | None], int] = {}
    # Ein Ort kann mehrere Objekttypen haben, das Bild muss aber stabil sein:
    # alle Kandidaten sammeln und danach nach fester Priorität wählen.
    motive: dict[tuple[str, str | None], set[str]] = {}
    laender: dict[str, int] = {}

    for r in rows:
        stadt = (r.get("city") or "").strip()
        code = (r.get("country") or "").strip().upper() or None
        if code and (not needle or code in laender_treffer) and country_name(code):
            laender[code] = laender.get(code, 0) + 1
        if not stadt:
            continue
        if needle and needle not in stadt.lower() and code not in laender_treffer:
            continue
        schluessel = (stadt, code)
        staedte[schluessel] = staedte.get(schluessel, 0) + 1
        motive.setdefault(schluessel, set()).add(
            stadt_motiv(r.get("property_type"), r.get("lat"), r.get("lng"))
        )

    ziele: list[PublicDestination] = []
    for (stadt, code), anzahl in staedte.items():
        land = country_name(code)
        ziele.append(
            PublicDestination(
                art="city",
                # Ohne bekannten Ländernamen NUR die Stadt — kein geratenes Land
                # und kein nackter ISO-Code im Gästetext (Wurzel 4).
                label=f"{stadt}, {land}" if land else stadt,
                query=stadt,
                city=stadt,
                country=code,
                country_name=land,
                count=anzahl,
                motiv=_motiv_waehlen(motive.get((stadt, code), set())),
            )
        )
    for code, anzahl in laender.items():
        land = country_name(code)
        if land is None:  # von der Zähl-Bedingung ausgeschlossen, defensiv
            continue
        ziele.append(
            PublicDestination(
                art="country",
                label=land,
                query=land,
                country=code,
                country_name=land,
                count=anzahl,
                motiv=land_motiv(code),
            )
        )
    # Länder zuerst bei Gleichstand (breiteres Ziel), dann nach Anzahl, dann
    # alphabetisch — stabile Reihenfolge ohne Zufall.
    ziele.sort(key=lambda z: (-z.count, z.art != "country", z.label))
    return ziele[:limit]
