"""Eine Vorlagen-/Regel-Fassung maschinell übersetzen (Google Cloud v2).

WARUM ES DAS BRAUCHT (gemessen 16.08.2026, Beta-Betrieb): Der Betrieb führt 18
Vorlagen und 4 Automail-Regeln und hat `de` und `da` als Sprachen verwaltet —
aber `message_template_text` und `message_automation_text` waren KOMPLETT LEER,
null Zeilen. Jede Fassung hätte von Hand abgetippt werden müssen, 22 Texte je
Sprache. Also wurde keine einzige gepflegt, und `fassung_waehlen` fiel für jeden
Gast auf die Grundfassung zurück. Ein englischer Booking.com-Gast (`en-gb`)
bekam am selben Tag die deutsche Buchungsbestätigung — bei 91 Threads sind nur
14 deutsch.

DER DIENST ist derselbe, den das Repo schon dreimal nutzt (`content/service.py`,
`announcements/uebersetzung.py`, `channel_manager/bildtext_uebersetzung.py`):
Google Cloud Translation v2 REST mit `google_translate_api_key` aus den
Settings. Kein zweiter Client, keine zweite Auth-Variante — ein vierter Weg zum
selben Dienst wäre eine vierte Stelle, an der ein Schlüssel rotiert werden muss.

WARUM DIE PLATZHALTER MASKIERT WERDEN — der Kern dieses Moduls:
Die Texte sind voller `{{guest_first_name}}`, `{{property_name}}`,
`{{door_instructions}}`. Google übersetzt Wörter, die es findet, und in
`{{guest_first_name}}` findet es welche. Live gemessen:

    q={{guest_first_name}} source=de target=en
    → „{{guest_first_name}}"          (hier heil)
    q=Liebe(r) {{guest_first_name}}, vielen Dank für Deine Buchung des
      {{property_name}}!  source=de target=it
    → „Caro/a {{nome_ospite}}, grazie mille per la tua prenotazione
      {{nome_proprietà}}!"            (zerstört)

Ein übersetzter Platzhalter löst NIE mehr auf — `rendern()` findet
`{{indirizzo_proprietà}}` nicht im Katalog und lässt ihn stehen. Der Gast bekäme
den Rohtext statt seiner Adresse in der Buchungsbestätigung.

WELCHE MARKE — live gemessen am 16.08.2026 gegen den Produktionsschlüssel, in
zwei Runden, weil die ersten beiden Kandidaten durchfielen:

    Ausgangstext (HTML, wie in den Vorlagen), Ziel en/it/da/el/pl/ja.

    OHNE Marke, format=text  → Platzhalter in 17 Sprachen unversehrt
    OHNE Marke, format=html  → in 4 von 7 ZERSTÖRT:
        it  {{property_address}} → {{indirizzo_proprietà}}
        da  {{property_address}} → {{ejendomsadresse}}
        el  {{property_address}} → {{διεύθυνση_ιδιοκτησίας}}
        pl  {{property_address}} → {{adres_własności}}
    Der HTML-Fall ist genau der der Vorlagen — Maskierung ist also Pflicht.

    Private-Use (U+E000 f.) → VERSCHLUCKT. Google entfernt die Zeichen, nur die
                              Ziffer bleibt („0"). Unbrauchbar.
    %0%                     → SCHEINBAR gut (alle 8 Sprachen ok bei EINER
                              Marke), aber mit fünf Marken im selben HTML frisst
                              Google das führende Prozentzeichen: `%3%` → `3%`,
                              `%4%` → `4%`; ja macht daraus `4％` (vollbreit).
                              Google liest es als Zahlenformat. Unbrauchbar.
    [[0]]                   → unversehrt in allen sechs geprüften Sprachen, bei
                              fünf Marken gleichzeitig, in HTML. Gewählt.
    <span translate="no">   → hält ebenfalls, hinterlässt aber Fremd-Markup im
    <code>                    Text; verworfen, weil der Klartext-Modus damit
                              sichtbares Markup an den Gast schicken würde.

Also `[[<index>]]`. Wird ein Platzhalter trotzdem beschädigt (Marke fehlt in der
Antwort), wird die Übersetzung VERWORFEN statt beschädigt geliefert (Wurzel 4/5)
— ein kaputter Platzhalter in einer Gastnachricht ist schlimmer als gar keine
Übersetzung.

FAIL-CLOSED (Wurzel 5): fehlender Schlüssel, Netzfehler, kein 200, unlesbare
Antwort, abweichende Anzahl oder verlorene Marke → Exception, keine Zeile. Es
wird NIE der Ausgangstext als „Übersetzung" zurückgegeben; das wäre eine
deutsche Fassung, die sich als italienische ausgibt.

NICHTS WIRD AUTOMATISCH GESPEICHERT: Dieses Modul liefert Text zurück, der
Aufrufer setzt ihn in den Editor. Der Betreiber prüft und speichert selbst. Ein
Automatismus, der Gasttexte ungesehen scharf schaltet, ist bei rechtlich
relevanten Inhalten (Hausregeln, Stornobedingungen, Preise) nicht vertretbar.
"""
from __future__ import annotations

import re
from typing import Final

import httpx

from src.core.config import get_settings
from src.core.languages import basis_sprache, ist_bekannte_sprache
from src.core.logging import get_logger

from .errors import InboxError

log = get_logger("nextdays.inbox.fassung_uebersetzen")

TRANSLATE_URL: Final[str] = "https://translation.googleapis.com/language/translate/v2"

# Obergrenze je Feld (Wurzel 8: kein unbegrenzter Bereich). Google lehnt über
# ~30 kB selbst ab; wir lehnen vorher klar ab statt still zu kappen — ein
# gekappter Vorlagentext wäre eine stille Verfälschung. Die längste reale
# Vorlage des Beta-Betriebs hat rund 2 600 Zeichen.
MAX_ZEICHEN: Final[int] = 20_000

_TIMEOUT = httpx.Timeout(60.0)

# Platzhalter im Text: `{{name}}`. Bewusst dieselbe Form, die `felder.rendern`
# auflöst — eine zweite, hier nachgebaute Syntax liefe beim nächsten neuen
# Feldtyp auseinander.
_PLATZHALTER = re.compile(r"\{\{\s*[a-zA-Z0-9_.]+\s*\}\}")

# `[[<index>]]` — live geprüft (siehe Modul-Kopf): überlebt in allen
# geprüften Zielsprachen unverändert, auch mit mehreren Marken in einem
# HTML-Text. Doppelte eckige Klammern um eine reine Ziffer kommen in den
# Vorlagentexten nicht vor; käme es doch so weit, schlägt die Prüfung in
# `demaskieren` an statt still zu vertauschen.
_MARKE_AUF: Final[str] = "[["
_MARKE_ZU: Final[str] = "]]"


# „Sieht aus wie eine unserer Marken" — nur Prozent + reine Ziffern + Prozent.
# Bewusst eng: „5 % Rabatt" oder „100 % Baumwolle" dürfen nicht darunterfallen.
_MARKE_MUSTER = re.compile(re.escape(_MARKE_AUF) + r"\s*\d+\s*" + re.escape(_MARKE_ZU))


def _marke(index: int) -> str:
    return f"{_MARKE_AUF}{index}{_MARKE_ZU}"


def maskieren(text: str) -> tuple[str, list[str]]:
    """`{{x}}` → Marke. Gibt (maskierter Text, Originale in Reihenfolge).

    Der Index zählt VORKOMMEN, nicht verschiedene Platzhalter: derselbe
    Platzhalter zweimal im Text bekommt zwei Marken. Anders wäre die Rückgabe
    nicht eindeutig prüfbar — bei „jede Marke muss zurückkommen" soll auch das
    zweite Vorkommen zählen.
    """
    originale: list[str] = []

    def ersetzen(treffer: re.Match[str]) -> str:
        originale.append(treffer.group(0))
        return _marke(len(originale) - 1)

    return _PLATZHALTER.sub(ersetzen, text), originale


def demaskieren(text: str, originale: list[str]) -> str:
    """Marken → Originale. Fehlt eine Marke, ist der Text unbrauchbar.

    Google fügt bei `format=html` mitunter Leerzeichen um Fremdzeichen ein oder
    schreibt sie als Entity; beides wird toleriert, indem um die Ziffer herum
    flexibel gesucht wird. Was NICHT toleriert wird: eine Marke, die gar nicht
    mehr auftaucht — dann fehlt ein Platzhalter im Ergebnis, und der Text ginge
    ohne den Gastnamen raus. Das ist ein Fehler, kein Schönheitsfehler.
    """
    ergebnis = text
    for i, original in enumerate(originale):
        muster = re.compile(
            re.escape(_MARKE_AUF) + r"\s*" + str(i) + r"\s*" + re.escape(_MARKE_ZU)
        )
        ergebnis, anzahl = muster.subn(lambda _m, o=original: o, ergebnis)
        if anzahl == 0:
            raise InboxError(
                "Die Übersetzung hat einen Platzhalter beschädigt und wurde "
                "verworfen. Bitte erneut versuchen oder von Hand übersetzen.",
                status_code=502,
            )
    # Eine ÜBRIGE Marke (`[[7]]`, obwohl nur 3 Platzhalter maskiert wurden)
    # hieße, dass Google eine Ziffer verändert hat — dann stünde `[[7]]` beim
    # Gast. Geprüft wird nur auf die vollständige Marke, nicht auf `[[` allein:
    # eckige Klammern können in einem Vorlagentext legitim vorkommen.
    rest = _MARKE_MUSTER.search(ergebnis)
    if rest is not None:
        raise InboxError(
            "Die Übersetzung hat einen Platzhalter beschädigt und wurde "
            "verworfen. Bitte erneut versuchen oder von Hand übersetzen.",
            status_code=502,
        )
    return ergebnis


def _api_schluessel() -> str:
    """Der Schlüssel — oder ein klarer Fehler (Wurzel 4/5).

    Kein stilles Überspringen: ohne Schlüssel gibt es keine Übersetzung, und das
    muss der Betreiber beim Klick erfahren statt einen leeren Editor zu sehen.
    """
    schluessel = get_settings().google_translate_api_key.get_secret_value()
    if not schluessel:
        raise InboxError(
            "Der Übersetzungsdienst ist nicht konfiguriert "
            "(GOOGLE_TRANSLATE_API_KEY fehlt).",
            status_code=503,
        )
    return schluessel


def _aufrufen(
    schluessel: str,
    texte: list[str],
    *,
    quelle: str | None,
    ziel: str,
    als_html: bool,
) -> list[str]:
    """Ein Aufruf, mehrere Texte, eine Zielsprache. Jeder Fehler wirft.

    `quelle=None` lässt Google die Sprache erkennen. Das ist hier der Normalfall:
    die Grundfassung trägt bewusst KEINE Sprachangabe (Migration 0363), und beim
    Beta-Betrieb stehen dort Texte in gemischten Sprachen. Eine geratene
    Quellsprache anzugeben wäre schlechter als keine — Google erkennt sie
    zuverlässiger als wir sie raten.
    """
    daten: dict[str, object] = {
        "q": texte,
        "target": ziel,
        "format": "html" if als_html else "text",
    }
    if quelle:
        daten["source"] = quelle
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            antwort = client.post(
                TRANSLATE_URL, params={"key": schluessel}, data=daten
            )
    except httpx.HTTPError as exc:
        log.warning(
            "fassung_uebersetzung_netzfehler", ziel=ziel, error=str(exc)[:200]
        )
        raise InboxError(
            f"Der Übersetzungsdienst ist nicht erreichbar ({ziel}).",
            status_code=503,
        ) from exc

    if antwort.status_code != 200:
        log.warning(
            "fassung_uebersetzung_kein_200",
            ziel=ziel,
            status=antwort.status_code,
            body=antwort.text[:200],
        )
        raise InboxError(
            f"Der Übersetzungsdienst meldet einen Fehler für {ziel} "
            f"(HTTP {antwort.status_code}).",
            status_code=503,
        )

    try:
        nutzlast = antwort.json()
    except ValueError as exc:
        log.warning("fassung_uebersetzung_kein_json", ziel=ziel)
        raise InboxError(
            f"Der Übersetzungsdienst antwortete unlesbar für {ziel}.",
            status_code=503,
        ) from exc

    treffer = ((nutzlast.get("data") or {}).get("translations")) or []
    # Reihenfolge der Antwort = Reihenfolge der Anfrage (Google-Doku, im Repo
    # bereits zweimal live bestätigt). Weicht die ANZAHL ab, ist die Zuordnung
    # unsicher: dann läge womöglich der Betreff im Text (Wurzel 4/5).
    if len(treffer) != len(texte):
        log.warning(
            "fassung_uebersetzung_anzahl_abweichend",
            ziel=ziel,
            gesendet=len(texte),
            erhalten=len(treffer),
        )
        raise InboxError(
            f"Der Übersetzungsdienst lieferte eine unerwartete Antwort für {ziel}.",
            status_code=503,
        )
    return [str((t or {}).get("translatedText") or "") for t in treffer]


def fassung_uebersetzen(
    *,
    body: str,
    subject: str | None,
    ziel: str,
    format: str = "html",  # noqa: A002 — spiegelt das Feld der Editoren
    # pylint: disable=redefined-builtin
) -> tuple[str, str | None]:
    """Grundfassung → Zielsprache. Gibt (body, subject) zurück.

    `format` entspricht dem der Editoren (`sprach-fassungen.tsx`):
      `"html"` für Vorlagen (`body_html`), `"text"` für Automail-Regeln.
    Titel/Betreff geht IMMER als `text` raus — als HTML käme ein `&` im Betreff
    als Entity zurück.

    Es wird nichts gespeichert und nichts gekürzt; der Aufrufer setzt das
    Ergebnis in den Editor.
    """
    basis = basis_sprache(ziel)
    if not basis or not ist_bekannte_sprache(basis):
        raise InboxError(f"Unbekannte Zielsprache: {ziel!r}", status_code=422)

    roh_body = body or ""
    roh_subject = subject or ""
    if not roh_body.strip() and not roh_subject.strip():
        raise InboxError(
            "Die Grundfassung ist leer — es gibt nichts zu übersetzen.",
            status_code=422,
        )
    for name, wert in (("Text", roh_body), ("Betreff", roh_subject)):
        if len(wert) > MAX_ZEICHEN:
            raise InboxError(
                f"{name} ist zu lang für die Übersetzung "
                f"({len(wert)} Zeichen, erlaubt sind {MAX_ZEICHEN}).",
                status_code=422,
            )

    schluessel = _api_schluessel()

    neuer_body = ""
    if roh_body.strip():
        maskiert, originale = maskieren(roh_body)
        uebersetzt = _aufrufen(
            schluessel,
            [maskiert],
            quelle=None,
            ziel=basis,
            als_html=(format == "html"),
        )[0]
        neuer_body = demaskieren(uebersetzt, originale)

    neuer_subject: str | None = None
    if roh_subject.strip():
        maskiert_s, originale_s = maskieren(roh_subject)
        uebersetzt_s = _aufrufen(
            schluessel, [maskiert_s], quelle=None, ziel=basis, als_html=False
        )[0]
        neuer_subject = demaskieren(uebersetzt_s, originale_s)

    log.info(
        "fassung_uebersetzt",
        ziel=basis,
        format=format,
        zeichen=len(roh_body),
        platzhalter=len(_PLATZHALTER.findall(roh_body)),
    )
    return neuer_body, neuer_subject
