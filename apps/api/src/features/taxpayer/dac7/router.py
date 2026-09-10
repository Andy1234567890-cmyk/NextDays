"""Router für die DAC7-Meldung. Gemountet unter /api/v1/taxpayer/dac7.

Alle Endpunkte verlangen `manage_billing`: Eine Steuermeldung enthält
Steuer-IDs, Geburtsdaten und Kontokennungen der Verkaeufer. Sie gehoert nicht
in die Hand von staff oder cleaner (Rollen-Datensplit).

Der Scope liegt im Service (`ctx.tenant_id`), nicht in der DB-Rolle: Der
Service-Client umgeht RLS.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from src.core.security import CurrentUser
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dateipruefung import datei_pruefen
from .dependencies import Dac7ServiceDep
from .kanaele import Meldungsart
from .modell import (
    Anschrift,
    Meldung,
    Pruefbericht,
    Quartalswerte,
    Vermietung,
)
from .schemas import (
    AnbieterAusgabe,
    BefundAusgabe,
    DateibefundAusgabe,
    DateipruefungAusgabe,
    ErzeugenAnfrage,
    MeldelaufAusgabe,
    MeldungVorschau,
    PruefberichtAusgabe,
    QuartalswerteAusgabe,
    TaetigkeitAusgabe,
)
from .service import Dac7Error, LaufErgebnis

router = APIRouter(prefix="/taxpayer/dac7", tags=["taxpayer", "dac7"])

# Wurzel 8: kein unbegrenzter Bereich.
_MELDEJAHR_MIN = 2023
_MELDEJAHR_MAX = 2100


def _fehler(exc: Dac7Error) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


def _steuernummer_maskieren(nummer: str | None) -> str | None:
    """Nur die letzten beiden Stellen zeigen.

    Die Vorschau dient der Kontrolle „ist eine Nummer hinterlegt", nicht der
    Weitergabe. Wer die vollständige Nummer braucht, lädt die Datei.
    """
    if not nummer:
        return None
    if len(nummer) <= 2:
        return "•" * len(nummer)
    return "•" * (len(nummer) - 2) + nummer[-2:]


def _quartalswerte(werte: Quartalswerte) -> QuartalswerteAusgabe:
    """Betraege als Zeichenkette ausgeben.

    Nicht als Fliesskommazahl: JSON kennt nur `double`, und ein Cent, der
    beim Serialisieren verlorengeht, ist in einer Steueranzeige ein Fehler.
    """
    return QuartalswerteAusgabe(
        q1=str(werte.q1),
        q2=str(werte.q2),
        q3=str(werte.q3),
        q4=str(werte.q4),
        summe=str(werte.summe),
    )


def _bericht_ausgeben(bericht: Pruefbericht) -> PruefberichtAusgabe:
    return PruefberichtAusgabe(
        fehler=[
            BefundAusgabe(betrifft=b.betrifft, feld=b.feld, grund=b.grund)
            for b in bericht.fehler
        ],
        hinweise=[
            BefundAusgabe(betrifft=b.betrifft, feld=b.feld, grund=b.grund)
            for b in bericht.hinweise
        ],
        einbezogene_buchungen=bericht.einbezogene_buchungen,
        ausgeschlossene_buchungen=bericht.ausgeschlossene_buchungen,
        darf_melden=bericht.darf_melden,
    )


def _anschrift_zeile(anschrift: Anschrift) -> str:
    ort = " ".join(x for x in (anschrift.plz, anschrift.ort) if x)
    return ", ".join(t for t in (anschrift.strasse, ort) if t)


def _objekt_ausgeben(taetigkeit: Vermietung) -> TaetigkeitAusgabe:
    """Ein Objekt = eine Zeile der Meldedatei.

    Die Vorlage verlangt fuer Immobilien eine Zeile je Objekt. Diese
    Ausgabe bildet genau diese Zeile ab, damit der Kunde vor der Abgabe
    sieht, was fuer sein Objekt uebermittelt wird.
    """
    dk = taetigkeit.daenisch
    return TaetigkeitAusgabe(
        anschrift=_anschrift_zeile(taetigkeit.anschrift),
        land=taetigkeit.anschrift.land,
        objektart=taetigkeit.objektart,
        vermietete_tage=taetigkeit.vermietete_tage,
        grundbuchnummer=taetigkeit.grundbuchnummer,
        bfe_nummer=dk.bfe_nummer if dk else None,
        brutto_mieteinnahme=(
            str(dk.brutto_mieteinnahme)
            if dk and dk.brutto_mieteinnahme is not None
            else None
        ),
        brutto_waehrung=dk.brutto_mieteinnahme_waehrung if dk else None,
        waehrung=taetigkeit.waehrung,
        verguetung=_quartalswerte(taetigkeit.verguetung),
        gebuehren=_quartalswerte(taetigkeit.gebuehren),
        steuern=_quartalswerte(taetigkeit.steuern),
        anzahl_buchungen=taetigkeit.anzahl.summe,
        property_ids=list(taetigkeit.property_ids),
    )


def _meldung_ausgeben(meldung: Meldung) -> list[AnbieterAusgabe]:
    ausgabe: list[AnbieterAusgabe] = []
    for anbieter in meldung.anbieter:
        nummer = (
            anbieter.steuernummern[0].wert if anbieter.steuernummern else None
        )
        ausgabe.append(
            AnbieterAusgabe(
                doc_ref_id=anbieter.doc_ref_id,
                ist_person=anbieter.ist_person,
                anzeigename=anbieter.name
                or " ".join(
                    t for t in (anbieter.vorname, anbieter.nachname) if t
                ),
                ansaessig_in=list(anbieter.ansaessig_in),
                steuernummer_maskiert=_steuernummer_maskieren(nummer),
                taetigkeiten=[
                    _objekt_ausgeben(t) for t in anbieter.taetigkeiten
                ],
            )
        )
    return ausgabe


def _dateipruefung_ausgeben(inhalt: str | None) -> DateipruefungAusgabe | None:
    """Die fertige Datei gegen die Regeln der Vorlage messen.

    Das ist der Unterschied zwischen "unser Code meint, alles sei gut" und
    "die Datei haelt den Regeln stand": Hier wird der erzeugte Text
    zurueckgelesen, als kaeme er von aussen.
    """
    if not inhalt:
        return None
    bericht = datei_pruefen(inhalt)
    return DateipruefungAusgabe(
        besteht=bericht.besteht,
        zeilen=bericht.zeilen,
        zeilentypen=bericht.zeilentypen,
        fehler=[
            DateibefundAusgabe(
                zeile=b.zeile,
                zeilentyp=b.zeilentyp,
                spalte=b.spalte,
                regel=b.regel,
                grund=b.grund,
                wert=b.wert,
            )
            for b in bericht.fehler
        ],
        hinweise=[
            DateibefundAusgabe(
                zeile=b.zeile,
                zeilentyp=b.zeilentyp,
                spalte=b.spalte,
                regel=b.regel,
                grund=b.grund,
                wert=b.wert,
            )
            for b in bericht.hinweise
        ],
    )


# Wie viele Zeilen der Datei die Probelauf-Vorschau zeigt. Genug, um Kopf,
# Nachricht, Betreiber und die ersten Anbieter zu sehen; nicht so viel,
# dass Steuernummern eines ganzen Bestands durch die Antwort wandern.
_VORSCHAU_ZEILEN = 12


def _dateivorschau(datei: str | None) -> tuple[str | None, int | None]:
    """Die ersten Zeilen der Datei samt Gesamtzahl.

    Nur für den Probelauf: Dort gibt es keine Kennung zum Herunterladen,
    und ohne einen Blick in die Datei bliebe „es hat geklappt" eine
    Behauptung.
    """
    if not datei:
        return None, None
    zeilen = datei.rstrip("\n").split("\n")
    return "\n".join(zeilen[:_VORSCHAU_ZEILEN]), len(zeilen)


def _vorschau(
    ergebnis: LaufErgebnis, jahr: int, *, probelauf: bool = False
) -> MeldungVorschau:
    meldung = ergebnis.meldung
    anfang, zeilen = (
        _dateivorschau(ergebnis.datei) if probelauf else (None, None)
    )
    # Die vollstaendige Datei geht nur beim Probelauf mit: Dort gibt es
    # keine Kennung zum Herunterladen, und der Kunde soll VOR der Abgabe
    # sehen, was uebermittelt wird. Beim echten Lauf holt er sie ueber
    # `/laeufe/{id}/datei` — dann steht sie auch unter Zugriffskontrolle.
    return MeldungVorschau(
        jahr=jahr,
        probelauf=probelauf,
        datei_anfang=anfang,
        datei_zeilen=zeilen,
        datei_inhalt=ergebnis.datei if probelauf else None,
        dateipruefung=_dateipruefung_ausgeben(ergebnis.datei),
        meldeart=meldung.meldeart if meldung else "",
        melde_ref_id=meldung.melde_ref_id if meldung else "",
        betreiber_name=meldung.betreiber.name if meldung else "",
        anbieter=_meldung_ausgeben(meldung) if meldung else [],
        bericht=_bericht_ausgeben(ergebnis.bericht),
        lauf_id=ergebnis.lauf_id,
        datei_verfuegbar=ergebnis.erfolgreich,
    )


@router.post(
    "/erzeugen",
    response_model=MeldungVorschau,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def erzeugen(
    anfrage: ErzeugenAnfrage,
    ctx: CurrentUser,
    service: Dac7ServiceDep,
) -> MeldungVorschau:
    """Die Meldung eines Jahres berechnen.

    Mit `probelauf: true` wird nur gerechnet und geprüft, nichts abgelegt —
    der Weg, um vor der ersten echten Meldung zu sehen, ob die Daten
    tragen. Sonst entsteht ein Entwurf.

    Fehlt eine Pflichtangabe, entsteht KEINE Datei; die Antwort enthält dann
    im Prüfbericht, wem welches Feld fehlt. Das ist kein Fehlerfall der
    Schnittstelle, sondern das Ergebnis — deshalb 200 und nicht 422.
    """
    try:
        ergebnis = service.erzeugen(
            ctx,
            jahr=anfrage.jahr,
            art=Meldungsart(anfrage.art),
            speichern=not anfrage.probelauf,
        )
    except Dac7Error as exc:
        raise _fehler(exc) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail=f"Unbekannte Meldungsart: {anfrage.art}"
        ) from exc
    return _vorschau(ergebnis, anfrage.jahr, probelauf=anfrage.probelauf)


@router.get(
    "/laeufe",
    response_model=list[MeldelaufAusgabe],
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def laeufe(
    ctx: CurrentUser,
    service: Dac7ServiceDep,
    jahr: int | None = Query(
        default=None, ge=_MELDEJAHR_MIN, le=_MELDEJAHR_MAX
    ),
) -> list[MeldelaufAusgabe]:
    """Die gespeicherten Meldeläufe des Betriebs."""
    try:
        return [MeldelaufAusgabe(**zeile) for zeile in service.laeufe(ctx, jahr)]
    except Dac7Error as exc:
        raise _fehler(exc) from exc


@router.get(
    "/laeufe/{lauf_id}/datei",
    response_class=PlainTextResponse,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def datei(
    lauf_id: str,
    ctx: CurrentUser,
    service: Dac7ServiceDep,
) -> PlainTextResponse:
    """Die CSV eines Laufs zum Hochladen bei der Behörde.

    Die Datei wird bei jedem Abruf neu erzeugt statt gespeichert: Die
    Erzeugung ist reproduzierbar, und eine abweichende Prüfsumme zeigt an,
    dass sich die zugrunde liegenden Daten geändert haben — das soll
    auffallen, nicht verborgen bleiben.
    """
    try:
        inhalt = service.datei_neu_erzeugen(ctx, lauf_id)
    except Dac7Error as exc:
        raise _fehler(exc) from exc
    return PlainTextResponse(
        content=inhalt,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="dac7-{lauf_id}.csv"'
        },
    )


@router.get(
    "/laeufe/{lauf_id}/anbieter",
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def lauf_anbieter(
    lauf_id: str,
    ctx: CurrentUser,
    service: Dac7ServiceDep,
) -> list[dict]:
    """Die gemeldeten Anbieter eines Laufs — die Auskunft an die Behörde."""
    try:
        return service.lauf_anbieter(ctx, lauf_id)
    except Dac7Error as exc:
        raise _fehler(exc) from exc


@router.post(
    "/laeufe/{lauf_id}/abgeben",
    response_model=MeldelaufAusgabe,
    dependencies=[Depends(require_permission(Capability.MANAGE_BILLING))],
)
def abgeben(
    lauf_id: str,
    ctx: CurrentUser,
    service: Dac7ServiceDep,
) -> MeldelaufAusgabe:
    """Einen Lauf als abgegeben kennzeichnen.

    Bestätigt, dass die Datei bei der Behörde hochgeladen wurde — wir laden
    nicht selbst hoch. Ab dann ist der Lauf unveränderlich.
    """
    try:
        return MeldelaufAusgabe(**service.abgeben(ctx, lauf_id))
    except Dac7Error as exc:
        raise _fehler(exc) from exc
