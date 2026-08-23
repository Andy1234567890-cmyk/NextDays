"""Preisvorschau: was kostet dieser Aufenthalt?

Der Endpunkt, der in der ersten Fassung dieser API fehlte und in der
Dokumentation unter „Grenzen von v1" stand. Der Grund für die Lücke war
richtig — eine zweite Preisberechnung hätte irgendwann einen anderen Betrag
geliefert als die Buchung — die Folgerung war es nicht: statt den Endpunkt
weglassen, wird die EINE Berechnung geteilt.

**Wie das geht, ohne zwei Wahrheiten:** `src/features/pricing/resolver.py` liegt
hier als SCHWESTERDATEI, byte-identisch zur Fassung in `apps/api`; der CI-Job
`public-api-konsistenz` bricht ab, sobald eine der beiden abweicht. Dieselbe
Rechnung, dieselben Saisons, Aktionen, Aufenthaltsregeln, Zusatzleistungen und
Abgaben — nur in einem eigenen Prozess, damit ein Lastausbruch eines
API-Kunden die Oberfläche des Betriebs nicht mitnimmt.

**Was dieser Endpunkt NICHT tut:** buchen. Er reserviert nichts und hält keinen
Preis. Zwischen Vorschau und Buchung kann sich der Preis ändern (eine Aktion
beginnt, ein Tagespreis wird gesetzt); verbindlich ist der Betrag, der beim
Anlegen der Buchung mitgeschickt und geprüft wird.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..core import errors
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import service_db, zeile_im_mandanten
from ..core.pagination import zeitraum_pruefen
from .schemas_verwalten import Preisvorschau, PreisvorschauPosten

router = APIRouter(tags=["Preise"])


@router.get(
    "/quote",
    response_model=Preisvorschau,
    summary="Preisvorschau für einen Aufenthalt",
    responses={
        404: {"description": "Das Objekt gibt es nicht oder der Zugang darf es nicht."},
        422: {
            "description": (
                "Der Zeitraum ist unmöglich oder zu lang, die Gästezahl "
                "übersteigt die Kapazität, oder das Objekt hat für diese Tage "
                "keinen Preis."
            )
        },
    },
)
def vorschau(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("rates:read"))],
    property_id: Annotated[str, Query(description="Objekt, für das gerechnet wird.")],
    check_in: Annotated[date, Query(description="Anreisetag.")],
    check_out: Annotated[
        date, Query(description="Abreisetag — die Nacht davor ist die letzte.")
    ],
    guests: Annotated[int, Query(ge=1, le=100, description="Zahl der Gäste.")] = 1,
    pets: Annotated[
        int,
        Query(
            ge=0,
            le=20,
            description=(
                "Mitgebrachte Tiere. Preiswirksam in zwei Richtungen: eine "
                "Gebühr „pro Tier und Aufenthalt“ multipliziert damit, und jede "
                "Haustiergebühr — auch eine Pauschale — entfällt ohne Tier."
            ),
        ),
    ] = 0,
    locale: Annotated[
        str,
        Query(
            max_length=10,
            description=(
                "Sprache der Bezeichnungen in der Aufschlüsselung (ISO 639-1, "
                "z. B. „da“). Reine Anzeige-Achse — die Beträge sind unberührt. "
                "Ohne Angabe Englisch; pflegt der Betrieb die Sprache an einem "
                "Posten nicht, greift ebenfalls Englisch."
            ),
        ),
    ] = "en",
    rate_plan_id: Annotated[
        str | None,
        Query(
            description=(
                "Der konkrete Rate-Plan. Beim Hotel entscheidend (BAR und B&B "
                "kosten verschieden); bei einem Ferienobjekt mit genau einem "
                "Rate-Plan kann er weggelassen werden."
            )
        ),
    ] = None,
    promo_code: Annotated[
        str | None,
        Query(
            description=(
                "Aktionscode des Gastes. Er ist nur ein FILTER auf die Aktionen "
                "des Objekts — der Rabatt wird serverseitig gerechnet, ein "
                "Betrag aus dem Aufruf wird nie übernommen."
            )
        ),
    ] = None,
) -> Preisvorschau:
    """Rechnet den Aufenthaltspreis mit allen Positionen.

    Der Kanal ist fest `direct`: über diese API angefragte Preise sind die des
    Betriebs. Ein Kanal-Markup, das nur ein Portal betrifft, hier wählbar zu
    machen, hiesse einem Client zu erlauben, sich den günstigsten Kanal
    auszurechnen.
    """
    # Lokal importiert wie in den Preis-Pfaden von `apps/api` — die Kopie bleibt
    # damit byte-identisch, und der Resolver wird nur geladen, wenn er gebraucht
    # wird.
    from src.features.pricing.resolver import PricingResolver  # noqa: PLC0415
    from src.features.pricing.schemas import QuoteRequest  # noqa: PLC0415

    ctx.objekt_pruefen(property_id)
    zeitraum_pruefen(check_in, check_out)

    db = service_db()
    objekt = zeile_im_mandanten(
        db, "properties", property_id, ctx.tenant_id,
        spalten="id, max_guests", was="Das Objekt",
    )

    max_gaeste = objekt.get("max_guests")
    if max_gaeste and guests > int(max_gaeste):
        raise errors.ungueltige_anfrage(
            f"Das Objekt nimmt höchstens {max_gaeste} Gäste.",
            extra={"max_guests": int(max_gaeste)},
        )
    # OB Tiere erlaubt sind, wird hier NICHT geprüft: das ist eine Buchungs-
    # regel und steckt in der Objekt-Konfiguration (Hausordnung, Ausstattung).
    # Die Vorschau rechnet, was ein Aufenthalt MIT dieser Zahl Tiere kosten
    # würde; ob er zustande kommt, entscheidet das Anlegen der Buchung. Diese
    # Prüfung hier zu wiederholen wäre eine zweite Regel darüber, was buchbar
    # ist — und die erste, die abweicht, verspricht einen Preis für einen
    # Aufenthalt, den die Buchung ablehnt.

    ergebnis = PricingResolver(service_client=db).quote(
        QuoteRequest(
            property_id=property_id,
            check_in=check_in,
            check_out=check_out,
            guests=guests,
            pets=pets,
            locale=locale,
            channel="direct",
            rate_plan_id=rate_plan_id,
            promo_code=promo_code,
        )
    )

    if ergebnis.priceless or ergebnis.unpriced_nights:
        # Ein Teil-Preis ist die gefährlichste Antwort: der Gast bucht sieben
        # Nächte und zahlt drei. Deshalb 422 mit der Zahl der unbepreisten
        # Nächte, nicht ein plausibler, zu niedriger Betrag (Wurzel 4).
        raise errors.ungueltige_anfrage(
            "Für diesen Zeitraum ist nicht jede Nacht bepreist.",
            extra={
                "unpriced_nights": ergebnis.unpriced_nights or ergebnis.nights,
                "nights": ergebnis.nights,
            },
        )

    return Preisvorschau(
        property_id=property_id,
        rate_plan_id=rate_plan_id,
        check_in=check_in,
        check_out=check_out,
        nights=ergebnis.nights,
        guests=guests,
        pets=pets,
        currency=ergebnis.currency,
        nightly_total=Decimal(str(ergebnis.nightly_total)),
        total_amount=Decimal(str(ergebnis.total)),
        promo_code_applied=ergebnis.promo_code_applied,
        items=[
            PreisvorschauPosten(
                kind=zeile.kind or "other",
                label=zeile.label,
                amount=Decimal(str(zeile.amount)),
            )
            for zeile in ergebnis.lines
        ],
    )
    # Zusatzleistungen sind hier bewusst NICHT wählbar: welche Leistungen ein
    # Objekt buchbar anbietet, entscheidet die Buchungsstrecke (Sichtbarkeit,
    # Mengenregeln, Pflicht-Leistungen). Eine eigene Auswahl an dieser Stelle
    # wäre eine zweite Regel darüber, was buchbar ist. Wer sie braucht, liest
    # sie über die Buchungsstrecke und schickt den Gesamtpreis beim Anlegen mit.
