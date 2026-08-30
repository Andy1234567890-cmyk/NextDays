"""Der Antwortvorschlag an einen Gast — Prompt, Aufruf, Protokoll.

Die EINE Stelle, an der eine Gastantwort entsteht. Posteingang und WhatsApp
riefen bisher beide ``GroqClient.suggest_reply`` mit je eigenem Vorbau auf; der
Vorbau war zweimal geschrieben und lief bereits auseinander (der WhatsApp-Pfad
kannte die Objektzuordnung nicht und übergab ``objekt_id=None``, seine
Wissensauswahl lief also immer ins Betriebsweite).

Anbieter ist **Vertex AI in europe-west4**, nicht mehr Groq. Der Grund steht in
``src/core/ki/client.py``: in diesem Prompt stehen Türcode, WLAN-Passwort,
Anschrift und Gastname. Diese Daten verlassen die EU nicht.

Was dieses Modul NICHT tut: senden. Es liefert einen Vorschlag. Die
automatische Zustellung ist Etappe 2 und bekommt ihre eigene Entscheidung
(Regel, Zustellart, Sperren) — sie in denselben Aufruf zu legen hieße, dass ein
Vorschau-Knopf versehentlich eine Nachricht an einen Gast schickt.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from supabase import Client

from src.core.ki import KiAntwort, VertexClient
from src.core.languages import sprach_name
from src.core.logging import get_logger

from .ki_kontext import KiKontext, kontext_bauen
from .schemas import AiSettings, InboxMessage, ReservationDetail

log = get_logger("nextdays.inbox.ki_antwort")

# Der Funktionsname für `site_ai_usage` (0465). MUSS im check-Constraint der
# Tabelle stehen (0492) UND in `site_config.ki_nutzung.FUNKTIONEN` — sonst
# steigt `_schreiben` still aus und der Tagesdeckel wird zur Attrappe.
FUNKTION = "gast_antwort"

# Wie viele Nachrichten des Verlaufs mitgehen. Ein Thread mit 200 Nachrichten
# würde sonst allein den Prompt füllen (Wurzel 8). Die letzten 20 decken jede
# laufende Unterhaltung ab.
MAX_VERLAUF = 20

# Höchstlänge einer einzelnen Verlaufsnachricht im Prompt.
MAX_NACHRICHT_ZEICHEN = 1_500

MAX_ANTWORT_TOKENS = 600

# Antwortlänge (0497). Zwei Wirkungen je Stufe, und beide sind nötig:
# das Token-Budget deckelt, die Prompt-Zeile STEUERT. Nur zu deckeln hiesse,
# das Modell schreibt denselben langen Text und bricht mitten im Satz ab —
# eine abgeschnittene Antwort an einen Gast ist schlimmer als eine lange.
_LAENGEN: dict[str, tuple[int, str]] = {
    "kurz": (300, "Fasse dich sehr kurz: höchstens drei Sätze."),
    "standard": (600, "Halte die Antwort knapp, aber vollständig."),
    "ausfuehrlich": (
        1200,
        "Antworte ausführlich und erkläre die Zusammenhänge, "
        "solange sie im Kontext stehen.",
    ),
}


def _laenge(einstellungen: AiSettings | None) -> tuple[int, str]:
    """Token-Budget und Prompt-Zeile zur eingestellten Antwortlänge.

    Ein unbekannter Wert fällt auf 'standard' — nicht, weil ein Ersatzwert
    erfunden würde (Wurzel 4), sondern weil die DB den Wert per CHECK
    einschränkt: was hier ankommt, IST einer der drei. Der Rückfall deckt nur
    den Testpfad ohne DB ab."""
    stufe = getattr(einstellungen, "antwortlaenge", None) or "standard"
    return _LAENGEN.get(str(stufe), _LAENGEN["standard"])


# Die Zeile, mit der das Modell eine Wissenslücke meldet (System-Prompt).
# Sie steht am ANFANG der Antwort und wird vor der Anzeige entfernt: der Gast
# soll „[FEHLENDE ANGABE: …]" nie zu sehen bekommen.
_LUECKE = re.compile(
    r"^\s*\[\s*FEHLENDE\s+ANGABE\s*:\s*(?P<was>[^\]]{1,300})\]\s*",
    re.IGNORECASE,
)


# Die Zeile, mit der das Modell einen negativen Tenor meldet. Dieselbe Form wie
# die Wissenslücke oben — und aus demselben Grund KEIN JSON-Antwortschema: das
# Modell soll in erster Linie einen guten Antworttext schreiben, und eine
# JSON-Hülle drumherum verschlechtert messbar die Prosa darin. Zwei
# Markierungszeilen am Anfang kosten nichts und sind robust zu entfernen.
_STIMMUNG = re.compile(
    r"^\s*\[\s*STIMMUNG\s+NEGATIV\s*:\s*(?P<grund>[^\]]{1,300})\]\s*",
    re.IGNORECASE,
)


def stimmung_trennen(roh: str) -> tuple[str, str | None]:
    """Antworttext und gemeldeten negativen Tenor trennen.

    Kein zweiter Vertex-Aufruf je Gastnachricht: bei 556 Reservierungen wäre
    der auf der Rechnung spürbar, und die Latenz käme obendrauf. Der Preis
    dieser Wahl steht offen im Plan — die Stimmungsprüfung greift nur, wenn
    ohnehin eine Antwort erzeugt wird.
    """
    treffer = _STIMMUNG.match(roh or "")
    if not treffer:
        return (roh or "").strip(), None
    return roh[treffer.end() :].strip(), treffer.group("grund").strip()


def markierungen_trennen(roh: str) -> tuple[str, str | None, str | None]:
    """Beide Markierungszeilen entfernen, egal in welcher Reihenfolge sie stehen.

    Die EINE Stelle dafür. Der Gast darf weder „[FEHLENDE ANGABE: …]" noch
    „[STIMMUNG NEGATIV: …]" je zu sehen bekommen — und drei Aufrufer, die das
    jeweils selbst versuchen, laufen auseinander.
    """
    text, luecke = luecke_trennen(roh)
    text, stimmung = stimmung_trennen(text)
    if luecke is None:
        text, luecke = luecke_trennen(text)
    return text, luecke, stimmung


def luecke_trennen(roh: str) -> tuple[str, str | None]:
    """Antworttext und gemeldete Wissenslücke trennen.

    Die EINE Stelle dafür. Ohne sie stünde die Markierung entweder im Text an
    den Gast (peinlich) oder sie würde an drei Stellen unterschiedlich
    entfernt — und liefe auseinander, sobald jemand die Formulierung im
    System-Prompt anfasst.
    """
    treffer = _LUECKE.match(roh or "")
    if not treffer:
        return (roh or "").strip(), None
    return roh[treffer.end() :].strip(), treffer.group("was").strip()


@dataclass(frozen=True)
class Antwortvorschlag:
    """Der Vorschlag samt allem, was ihn nachvollziehbar macht.

    Die rohe :class:`KiAntwort` bleibt erhalten und wird nicht in Einzelfelder
    zerlegt: ``ki_nutzung.buchen`` nimmt genau sie entgegen. Ein Adapter, der
    sie aus Einzelfeldern wieder zusammensetzt, wäre eine zweite Stelle, die
    mitwandern muss, sobald das Protokoll ein Feld dazubekommt.
    """

    antwort: KiAntwort
    kontext: KiKontext

    @property
    def text(self) -> str:
        return self.antwort.text

    # Die letzte Gastfrage — der Aufrufer braucht sie fuer die Themensperre
    # und fuers Protokoll und soll sie nicht ein zweites Mal aus dem Verlauf
    # heraussuchen muessen (zwei Kopien derselben Regel laufen auseinander).
    frage: str = ""

    @property
    def quellen(self) -> list[str]:
        return list(self.kontext.quellen)


def _letzte_gastfrage(verlauf: list[InboxMessage]) -> str:
    """Die letzte Nachricht des Gastes — sie steuert die Abschnittsauswahl.

    Rückwärts gesucht, weil der Gastgeber nach der Gastfrage schon geantwortet
    haben kann; die Frage bleibt trotzdem die, um die es geht. Ist gar keine
    Gastnachricht da (neuer Thread), bleibt es leer, und der Kontextsammler
    liefert alle Abschnitte in fester Reihenfolge statt einer Auswahl auf
    Verdacht.
    """
    for m in reversed(verlauf):
        if m.sender == "guest" and (m.message or "").strip():
            return str(m.message).strip()
    return ""


def _verlauf_text(verlauf: list[InboxMessage]) -> str:
    letzte = [m for m in verlauf if (m.message or "").strip()][-MAX_VERLAUF:]
    if not letzte:
        return "(noch keine Nachrichten)"
    return "\n".join(
        f"{'Gast' if m.sender == 'guest' else 'Gastgeber'}: "
        f"{str(m.message).strip()[:MAX_NACHRICHT_ZEICHEN]}"
        for m in letzte
    )


def _buchungsblock(r: ReservationDetail) -> str:
    zeilen = [
        f"Unterkunft: {r.listing_name}" if r.listing_name else "",
        f"Gast: {r.guest_name}" if r.guest_name else "",
        f"Aufenthalt: {r.check_in} bis {r.check_out}"
        if r.check_in and r.check_out
        else "",
        f"Personen: {r.adults or 0} Erwachsene"
        + (f", {r.children} Kinder" if r.children else "")
        if r.adults or r.children
        else "",
        f"Status: {r.status}" if r.status else "",
        f"Portal: {r.ota_name}" if r.ota_name else "",
        f"Buchungsnummer: {r.ota_reservation_code}"
        if r.ota_reservation_code
        else "",
    ]
    return "\n".join(z for z in zeilen if z) or "Keine Buchungsdetails verfügbar."


def _sprachzeile(einstellungen: AiSettings | None, r: ReservationDetail) -> str:
    """In welcher Sprache geantwortet wird.

    „Automatisch" heißt: in der Sprache des Gastes — und die STEHT in der
    Buchung (``guest_language``, vom Portal). Sie hier zu benennen ist der
    Unterschied zwischen einer Anweisung, die das Modell erfüllen kann, und
    einer, die es raten muss: bei einer noch leeren Konversation gibt es keinen
    Text, aus dem sich eine Sprache ableiten ließe, und der Vorschlag kam
    deutsch heraus — auch für einen italienischen Gast.

    Fehlt das Feld, bleibt es beim allgemeinen Wortlaut: kein geratener
    Sprachcode (Wurzel 4).
    """
    sprache = getattr(einstellungen, "language", None) or "auto"
    if sprache != "auto":
        return f"auf {sprache.upper()}"
    name = sprach_name(getattr(r, "guest_language", None))
    return f"auf {name} (Sprache des Gastes)" if name else "in der Sprache des Gastes"


def _regelblock(regeln: list[dict] | None) -> str:
    """Die Regeln des Betriebs als nummerierte Anweisungen.

    Nummeriert, weil das Modell so einzeln auf sie Bezug nehmen kann und weil
    im Protokoll nachvollziehbar bleibt, welche Anweisung es gesehen hat.
    Eskalationsregeln bleiben AUSSEN VOR: sie beschreiben, wann ein Mensch
    übernehmen soll, nicht wie geantwortet wird — als Anweisung im Prompt
    würden sie das Modell dazu bringen, über die Eskalation zu schreiben.
    """
    echte = [r for r in (regeln or []) if not r.get("ist_eskalation")]
    if not echte:
        return ""
    zeilen = "\n".join(
        f"{i}. {str(r.get('anweisung') or '').strip()}"
        for i, r in enumerate(echte, start=1)
        if str(r.get("anweisung") or "").strip()
    )
    return f" Regeln des Betriebs, die du befolgen musst:\n{zeilen}" if zeilen else ""


def _system_prompt(
    einstellungen: AiSettings | None,
    r: ReservationDetail,
    regeln: list[dict] | None = None,
) -> str:
    ton = getattr(einstellungen, "tone", None) or "freundlich"
    signatur = getattr(einstellungen, "signature", None)
    zusatz = getattr(einstellungen, "extra_prompt", None)
    teile = [
        f"Du bist ein {ton}er, professioneller Gastgeber-Assistent für "
        "Ferienunterkünfte. Formuliere eine kurze, hilfreiche Antwort auf die "
        f"letzte Gastnachricht — {_sprachzeile(einstellungen, r)}, höflich und "
        "konkret.",
        # Das ist die Kernregel und der Grund, warum der Kontext oben so
        # sorgfältig gebaut wird: das Modell darf ausschließlich daraus
        # schöpfen.
        "Verwende AUSSCHLIESSLICH die Angaben aus dem Abschnitt Kontext. "
        "Erfinde nichts — keine Uhrzeiten, keine Passwörter, keine Preise, "
        "keine Adressen, keine Zusagen zur Verfügbarkeit.",
        # Wurzel 4 in Produktform: kein plausibler Ersatzwert, sondern lautes
        # Fehlschlagen. Das ist zugleich der Punkt, an dem sich die
        # Wissensdatenbank von selbst füllt — der Betrieb sieht im Vorschlag,
        # welche Angabe ihm fehlt.
        "Steht die Antwort NICHT im Kontext, dann erfinde sie nicht und "
        "schreibe auch keine Ausweichfloskel. Sage dem Gast in einem Satz, "
        "dass du das nachreichst, und beginne deine Nachricht mit der Zeile "
        "[FEHLENDE ANGABE: <was genau fehlt>]. Diese Zeile benennt die "
        "Angabe, die in den Objektdaten fehlt — nicht das Thema der Frage. "
        "Kannst du die Frage aus dem Kontext beantworten, lass die Zeile "
        "vollständig weg.",
        "Gib NUR den Antworttext zurück, ohne Anrede-Platzhalter und ohne "
        "Erklärungen über dich selbst.",
        # Die zweite Markierungszeile: negativer Tenor. Bewusst im SELBEN
        # Aufruf statt in einem eigenen — ein zweiter Vertex-Aufruf je
        # eingehender Gastnachricht wäre auf der Rechnung spürbar.
        "Ist der Gast erkennbar verärgert, beschwert er sich, meldet er einen "
        "Schaden oder droht er mit rechtlichen Schritten, dann beginne deine "
        "Nachricht zusätzlich mit der Zeile [STIMMUNG NEGATIV: <ein kurzer "
        "Satz, worüber>]. Bei sachlichen Fragen und normalem Ton lass diese "
        "Zeile vollständig weg.",
        _laenge(einstellungen)[1],
    ]
    if signatur:
        teile.append(f"Beende die Nachricht mit dieser Signatur: {signatur}.")
    if zusatz:
        teile.append(f"Zusätzliche Anweisung des Betriebs: {zusatz}")
    regelblock = _regelblock(regeln)
    if regelblock:
        teile.append(regelblock)
    return " ".join(teile)


def vorschlag_erzeugen(
    db: Client,
    tenant_id: str,
    *,
    prop: dict | None,
    verlauf: list[InboxMessage],
    reservierung: ReservationDetail,
    einstellungen: AiSettings | None = None,
    regeln: list[dict] | None = None,
    heute: date | None = None,
    client: VertexClient | None = None,
) -> Antwortvorschlag:
    """Einen Antwortvorschlag erzeugen. Kein Fallback, kein erfundener Text.

    Wirft :class:`src.core.ki.KiError` — der Aufrufer übersetzt das in seinen
    eigenen Fehlertyp mit demselben Statuscode. 503 heißt „nicht eingerichtet",
    502 „der Dienst hat nicht geliefert", 429 „Deckel erreicht".
    """
    ki = client or VertexClient()
    frage = _letzte_gastfrage(verlauf)
    kontext = kontext_bauen(
        db,
        tenant_id,
        prop=prop,
        frage=frage,
        sprache=getattr(reservierung, "guest_language", None),
        status=getattr(reservierung, "status", None),
        heute=heute,
    )
    user = (
        f"# Kontext\n\n## Buchung\n{_buchungsblock(reservierung)}\n\n"
        f"{kontext.text}\n\n"
        f"# Bisheriger Verlauf\n{_verlauf_text(verlauf)}\n\n"
        "# Auftrag\nSchreibe den Antwortvorschlag des Gastgebers."
    )
    system = _system_prompt(einstellungen, reservierung, regeln)

    antwort = ki.erzeuge(
        system=system,
        user=user,
        temperature=0.4,
        max_tokens=_laenge(einstellungen)[0],
    )
    log.info(
        "ki_antwort_erzeugt",
        tenant_id=tenant_id,
        zeichen_kontext=kontext.zeichen,
        quellen=kontext.quellen,
        weggelassen=kontext.weggelassen,
        tokens_ein=antwort.tokens_ein,
        tokens_aus=antwort.tokens_aus,
    )
    return Antwortvorschlag(antwort=antwort, kontext=kontext, frage=frage)
