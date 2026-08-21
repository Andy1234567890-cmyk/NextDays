"""Blättern und Zeiträume — mit harten Obergrenzen.

Entscheidung nach Recherche (20.08.2026): `limit`/`offset` mit `has_more`,
optional `total` nur auf Anfrage.

  * Hostaway liefert `{limit, offset, count, page, totalPages}` und zusätzlich
    ein `afterId` als Cursor — beides gleichzeitig, was Clients verwirrt.
  * Lodgify nimmt `page`/`size` und zählt nur bei `includeCount=true`.

Von Lodgify übernommen: das Zählen ist OPTIONAL. Ein `count(*)` über alle
Buchungen eines großen Betriebs kostet bei jedem Seitenabruf, obwohl fast kein
Client die Gesamtzahl braucht. Deshalb hier `include_total=true` als bewusste
Bestellung. Von Hostaway NICHT übernommen: zwei parallele Blätter-Modelle.

`has_more` gibt es bei keinem von beiden, ist aber das Feld, das ein Client
wirklich braucht: ohne es muss er raten, ob eine kürzere Seite das Ende ist,
oder eine Extra-Runde drehen. Umgesetzt über den +1-Trick (eine Zeile mehr
holen, als ausgeliefert wird).

Jede Obergrenze ist hart und endet in 422, nicht in stillem Kürzen (Wurzel 8:
jeder unbegrenzte Bereich bekommt eine Grenze — und Wurzel 4: ein stillschweigend
gekürzter Zeitraum wäre ein erfundener Ersatzwert).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from . import errors
from .config import get_settings


@dataclass(frozen=True)
class Blaettern:
    """Geprüfte Blätter-Angaben einer Anfrage."""

    limit: int
    offset: int
    include_total: bool

    @property
    def range_bis(self) -> int:
        """Obergrenze für PostgREST `.range()` — eine Zeile mehr als `limit`,
        damit `has_more` ohne zweiten Aufruf feststeht."""
        return self.offset + self.limit  # inklusive → das ist limit+1 Zeilen


def blaettern_pruefen(
    limit: int | None, offset: int | None, include_total: bool
) -> Blaettern:
    """Rohwerte aus der Query prüfen. Zu groß/negativ → 422."""
    settings = get_settings()
    max_limit = settings.max_page_size
    wert = 50 if limit is None else limit
    if wert < 1 or wert > max_limit:
        raise errors.ungueltige_anfrage(
            f"limit muss zwischen 1 und {max_limit} liegen.",
            extra={"max_limit": max_limit},
        )
    versatz = 0 if offset is None else offset
    if versatz < 0:
        raise errors.ungueltige_anfrage("offset darf nicht negativ sein.")
    return Blaettern(limit=wert, offset=versatz, include_total=include_total)


def seite_bauen(
    zeilen: list[dict], blatt: Blaettern, *, total: int | None = None
) -> dict:
    """Rohzeilen (limit+1 Stück) → Antwort-Umschlag.

    Der Umschlag ist bei JEDER Liste derselbe:

        {"data": [...], "pagination": {"limit", "offset", "has_more", "total"?}}

    Ein Umschlag, der je Endpunkt anders heißt, zwingt jeden Client zu
    Sonderfällen. `total` erscheint nur, wenn es bestellt wurde — nicht als
    `null`, das sonst wie „null Treffer" gelesen wird (Wurzel 4).
    """
    hat_mehr = len(zeilen) > blatt.limit
    daten = zeilen[: blatt.limit]
    seite: dict = {
        "limit": blatt.limit,
        "offset": blatt.offset,
        "has_more": hat_mehr,
    }
    if total is not None:
        seite["total"] = total
    return {"data": daten, "pagination": seite}


def zeitraum_pruefen(von: date, bis: date, *, max_tage: int | None = None) -> None:
    """Datums-Spanne prüfen: verdrehte Reihenfolge und Übergröße sind 422.

    Ohne diese Prüfung wäre `von=2000-01-01&bis=2100-01-01` ein Aufruf, der
    36 500 Tage aus der Datenbank zieht und den Service beschäftigt hält — die
    billigste Form, einen öffentlichen Dienst umzulegen (Wurzel 8).
    """
    if bis < von:
        raise errors.ungueltige_anfrage("'bis' liegt vor 'von'.")
    grenze = max_tage or get_settings().max_date_span_days
    tage = (bis - von).days + 1
    if tage > grenze:
        raise errors.ungueltige_anfrage(
            f"Der Zeitraum umfasst {tage} Tage; erlaubt sind höchstens {grenze}.",
            extra={"max_tage": grenze, "angefragte_tage": tage},
        )
