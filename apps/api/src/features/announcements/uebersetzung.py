"""Ankündigungstexte in die 24 EU-Amtssprachen übersetzen (Google Cloud v2).

WARUM BEIM VERFASSEN UND NICHT BEIM LESEN: Eine Ankündigung wird einmal
geschrieben und danach von jedem Betrieb gelesen. Beim Lesen zu übersetzen
hieße, denselben Text tausendfach durch eine kostenpflichtige API zu schicken —
und, schwerer wiegend, der Redakteur bekäme die fremdsprachigen Fassungen nie zu
sehen. Der Text trägt rechtliche Aussagen und Geldbeträge; er muss vor dem
Veröffentlichen prüfbar sein. Also: übersetzen beim Speichern, ablegen, prüfbar
machen.

DER DIENST ist derselbe, den das Repo schon nutzt (`content/service.py`,
`channel_manager/bildtext_uebersetzung.py`): Google Cloud Translation v2 REST
mit `google_translate_api_key` aus den Settings. Bewusst kein zweiter Client und
keine zweite Auth-Variante — ein dritter Weg zum selben Dienst wäre eine dritte
Stelle, an der ein Schlüssel rotiert werden müsste.

WARUM `format=html` UND NICHT `format=text`: Der Inhalt IST HTML (TipTap:
Überschriften, Aufzählungen, Fettungen, Bilder). Mit `format=text` käme das
Markup als sichtbarer Text zurück („<p>Hallo</p>" statt Absatz Hallo) oder
zerfiele. Google behandelt bei `format=html` die Tags als Struktur, übersetzt
nur die Textknoten und gibt das Markup zurück — live geprüft, siehe
`test_uebersetzung.py` bzw. den Verifikationslauf in der Slice-Doku. Die
Formatierung überlebt damit die Übersetzung.

WARUM DIE ANTWORT ERNEUT GESÄUBERT WIRD: Was von Google zurückkommt, ist
Fremd-Input (Wurzel 8) — auch wenn wir selbst gefragt haben. Der Dienst kann
Entities umschreiben und Attribute umsortieren; verlassen wird sich auf nichts.
Jede zurückgegebene Fassung läuft deshalb durch dieselbe nh3-Allowlist wie das
Original (`schemas.sanitize_inhalt`), inklusive der Bild-Quellenprüfung.

FAIL-CLOSED (Wurzel 5): Fällt der Dienst aus, fehlt der Schlüssel oder kommt
eine unbrauchbare Antwort, wird KEINE Zeile geschrieben und der Fehler
propagiert. Es wird NIE der Ausgangstext als „Übersetzung" abgelegt — eine
deutsche Zeile unter `sv` wäre eine Lüge über den Datenbestand, die niemand
mehr als solche erkennt (Wurzel 4). Lieber keine schwedische Fassung als eine
deutsche, die sich als schwedische ausgibt.
"""
from __future__ import annotations

import hashlib

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger
from src.core.mail_sprache import SUPPORTED

log = get_logger("nextdays.announcements.uebersetzung")

TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2"

# Die Sprache, in der das Plattform-Team verfasst. Sie ist KEINE Übersetzung,
# sondern das Original — die `de`-Zeile wird deshalb direkt aus dem
# Ausgangstext geschrieben und nie an Google geschickt.
QUELLSPRACHE = "de"

# Die 24 EU-Amtssprachen, bezogen aus der EINEN Liste des Projekts
# (`buchhaltung.doc_i18n.SUPPORTED` über `core.mail_sprache`). Bewusst nicht als
# Literal wiederholt: eine zweite Liste läuft beim Hinzufügen der 25. Sprache
# auseinander, und das fällt erst auf, wenn ein Kunde eine leere Seite sieht.
ZIELSPRACHEN: frozenset[str] = SUPPORTED - {QUELLSPRACHE}

# Obergrenze je Feld (Wurzel 8: jeder unbegrenzte Bereich bekommt eine harte
# Grenze). Google lehnt Anfragen über ~30 kB selbst ab; wir schneiden nicht
# still zu, sondern lehnen vorher klar ab — ein gekappter Ankündigungstext wäre
# eine stille Verfälschung. 40 000 Zeichen sind mehr als jede reale Ankündigung
# (die längste bisher: rund 2 000) und deutlich unter dem Limit des Dienstes.
MAX_ZEICHEN = 40_000

_TIMEOUT = httpx.Timeout(60.0)


class UebersetzungError(Exception):
    """Der Übersetzungsdienst konnte nicht liefern.

    Trägt einen HTTP-Status, damit der Router den Unterschied weitergeben kann:
    503 = Dienst nicht verfügbar/nicht konfiguriert (später erneut versuchen),
    422 = der Text selbst ist das Problem (zu lang) und ein Retry hilft nicht.
    """

    def __init__(self, message: str, *, status_code: int = 503) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def quelle_hash(titel: str, kurztext: str | None, inhalt_html: str) -> str:
    """Fingerabdruck des Ausgangstextes — die Grundlage der Idempotenz.

    Nur die drei ÜBERSETZBAREN Felder gehen ein. `als_popup`, `kategorie` oder
    `gueltig_bis` zu ändern ist keine Textänderung und darf keinen neuen
    (kostenpflichtigen) Übersetzungslauf auslösen. Genau deshalb wird hier
    gehasht und nicht `updated_at` verglichen: der Zeitstempel ändert sich bei
    jedem Speichern, der Hash nur bei echter Textänderung.

    Die Felder werden durch `\\x1f` (unit separator) getrennt, ein Zeichen, das
    in keinem der Texte vorkommt. Ohne Trenner ergäben Titel „AB"/Kurztext „C"
    und Titel „A"/Kurztext „BC" denselben Hash — eine Änderung bliebe damit
    unbemerkt und die Übersetzung veraltet still.
    """
    roh = "\x1f".join([titel or "", kurztext or "", inhalt_html or ""])
    return hashlib.sha256(roh.encode("utf-8")).hexdigest()


def laengen_pruefen(titel: str, kurztext: str | None, inhalt_html: str) -> None:
    """Harte Obergrenze, bevor irgendetwas an den Dienst geht (Wurzel 8).

    Geprüft wird vor dem ersten API-Aufruf: ein zu langer Text soll nicht 23-mal
    einen Fehler beim Dienst erzeugen, sondern sofort und einmal abgelehnt
    werden.
    """
    for name, wert in (
        ("Titel", titel),
        ("Kurztext", kurztext or ""),
        ("Inhalt", inhalt_html or ""),
    ):
        if len(wert) > MAX_ZEICHEN:
            raise UebersetzungError(
                f"{name} ist zu lang für die Übersetzung "
                f"({len(wert)} Zeichen, erlaubt sind {MAX_ZEICHEN}).",
                status_code=422,
            )


def _api_schluessel() -> str:
    """Der Schlüssel — oder ein klarer Fehler (Wurzel 4/5).

    Kein stilles Überspringen: ohne Schlüssel gibt es keine Übersetzungen, und
    das muss der Redakteur beim Speichern erfahren. Ein „ist halt nicht
    konfiguriert"-Log wäre genau die verschluckte Fehlermeldung, nach der
    hinterher niemand sucht.
    """
    schluessel = get_settings().google_translate_api_key.get_secret_value()
    if not schluessel:
        raise UebersetzungError(
            "Der Übersetzungsdienst ist nicht konfiguriert "
            "(GOOGLE_TRANSLATE_API_KEY fehlt).",
            status_code=503,
        )
    return schluessel


def _aufrufen(
    schluessel: str, texte: list[str], ziel: str, *, als_html: bool
) -> list[str]:
    """Ein Aufruf, mehrere Texte, eine Zielsprache. Fehler → Exception.

    Alle Felder einer Sprache gehen in EINEM Request raus (Google nimmt bis zu
    128 `q`-Werte): drei Aufrufe je Sprache wären 72 statt 24 Roundtrips.

    `format` wird bewusst je Aufruf gesetzt: Titel und Kurztext sind reiner
    Text, der Inhalt ist HTML. Titel als HTML zu schicken hieße, ein `&` im
    Titel als Entity zurückzubekommen.

    Jeder Fehlerpfad wirft — keiner gibt einen Ersatzwert zurück. Der Aufrufer
    schreibt deshalb nur, was der Dienst wirklich geliefert hat.
    """
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            antwort = client.post(
                TRANSLATE_URL,
                params={"key": schluessel},
                data={
                    # httpx erwartet für mehrfaches `q` einen LISTEN-Wert im
                    # dict, keine Liste von Tupeln (das wirft erst beim Senden
                    # `TypeError` — in `bildtext_uebersetzung` live passiert).
                    "q": texte,
                    "source": QUELLSPRACHE,
                    "target": ziel,
                    "format": "html" if als_html else "text",
                },
            )
    except httpx.HTTPError as exc:
        log.warning(
            "ankuendigung_uebersetzung_netzfehler",
            ziel=ziel, error=str(exc)[:200],
        )
        raise UebersetzungError(
            f"Der Übersetzungsdienst ist nicht erreichbar ({ziel})."
        ) from exc

    if antwort.status_code != 200:
        log.warning(
            "ankuendigung_uebersetzung_kein_200",
            ziel=ziel,
            status=antwort.status_code,
            body=antwort.text[:200],
        )
        raise UebersetzungError(
            f"Der Übersetzungsdienst meldet einen Fehler für {ziel} "
            f"(HTTP {antwort.status_code})."
        )

    try:
        daten = antwort.json()
    except ValueError as exc:
        log.warning("ankuendigung_uebersetzung_kein_json", ziel=ziel)
        raise UebersetzungError(
            f"Der Übersetzungsdienst antwortete unlesbar für {ziel}."
        ) from exc

    treffer = ((daten.get("data") or {}).get("translations")) or []
    # Die Reihenfolge der Antwort entspricht der Anfrage (Google-Doku, live
    # geprüft) — Index zu Index. Weicht die ANZAHL ab, ist die Zuordnung nicht
    # mehr sicher: dann läge womöglich der Kurztext im Titel. Lieber gar keine
    # Fassung als eine mit vertauschten Feldern (Wurzel 4/5).
    if len(treffer) != len(texte):
        log.warning(
            "ankuendigung_uebersetzung_anzahl_abweichend",
            ziel=ziel, gesendet=len(texte), erhalten=len(treffer),
        )
        raise UebersetzungError(
            f"Der Übersetzungsdienst lieferte eine unerwartete Antwort für {ziel}."
        )
    return [str((t or {}).get("translatedText") or "") for t in treffer]


def fassung_erzeugen(
    *, titel: str, kurztext: str | None, inhalt_html: str, ziel: str
) -> tuple[str, str | None, str]:
    """Eine Sprache übersetzen → (titel, kurztext, inhalt_html).

    Zwei Aufrufe statt einem, und das ist Absicht: Titel/Kurztext gehen als
    `text`, der Inhalt als `html`. Ein gemeinsamer Aufruf müsste sich auf EIN
    Format festlegen und würde entweder das Markup des Inhalts zerlegen oder
    den Titel mit Entities anreichern.

    Der Rückgabewert ist ROH (noch nicht gesäubert) — das Säubern passiert im
    Service über `schemas.sanitize_inhalt`, damit es genau dieselbe Allowlist
    ist wie beim Original und nicht eine zweite, hier nachgebaute.
    """
    if ziel == QUELLSPRACHE:
        # Die Quellsprache ist keine Übersetzung. Sie hier durchzureichen wäre
        # ein sinnloser API-Aufruf, der obendrein den Originaltext verändern
        # könnte (Google normalisiert auch bei source == target).
        raise UebersetzungError(
            f"{QUELLSPRACHE} ist die Quellsprache und wird nicht übersetzt.",
            status_code=422,
        )
    if ziel not in ZIELSPRACHEN:
        raise UebersetzungError(
            f"Unbekannte Zielsprache: {ziel!r}.", status_code=422
        )

    schluessel = _api_schluessel()

    # Reiner Text: Titel und (falls vorhanden) Kurztext in einem Aufruf.
    klartexte = [titel] + ([kurztext] if kurztext else [])
    uebersetzt_klar = _aufrufen(schluessel, klartexte, ziel, als_html=False)
    neuer_titel = uebersetzt_klar[0]
    neuer_kurztext = uebersetzt_klar[1] if kurztext else None

    # HTML: nur wenn es überhaupt Inhalt gibt. Ein leerer String an den Dienst
    # wäre ein bezahlter Aufruf für nichts.
    neuer_inhalt = ""
    if (inhalt_html or "").strip():
        neuer_inhalt = _aufrufen(
            schluessel, [inhalt_html], ziel, als_html=True
        )[0]

    return neuer_titel, neuer_kurztext, neuer_inhalt
