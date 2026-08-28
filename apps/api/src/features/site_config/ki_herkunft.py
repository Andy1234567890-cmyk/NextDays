"""Herkunft eines Textes und die Freigabe vor der Veröffentlichung (0463).

Das ist der Teil, in dem wir Hostaway schlagen. Hostaway ist ein White-Label
von Duda; Duda kennzeichnet nichts und schiebt die Pflicht per AGB auf den
Kunden. Seit dem 02.08.2026 gilt der EU AI Act in seinen Transparenzpflichten,
und nach Art. 3(3) sind WIR Anbieter des KI-Systems — wir bieten es unter
eigenem Namen an. „Wir nutzen nur die API von Google“ befreit nicht.

Drei Werte, drei Folgen:

===============  ===================  ==========================  =============
content_origin   Kennzeichnung HTML   Freigabe vor Publish        Fußhinweis
===============  ===================  ==========================  =============
human            nein                 nein                        nein
ai_rewritten     nein                 nein                        nein
ai_generated     ja (meta-Tag)        JA                          nur Blog
===============  ===================  ==========================  =============

**Warum Umschreiben nicht kennzeichnungspflichtig ist.** Erwägungsgrund 133
nimmt Systeme aus, die „eine unterstützende Funktion für die Standardbearbeitung
ausüben oder die vom Betreiber bereitgestellten Eingabedaten […] nicht wesentlich
verändern". Kürzen, Verlängern, Ton ändern, Rechtschreibung, Übersetzen fällt
darunter: der Mensch hat den Text geschrieben, die Maschine hat ihn bearbeitet.
Wir führen den Wert trotzdem — die Frage „hat hier je eine Maschine
mitgeschrieben?" soll beantwortbar sein, ohne sie zu einer Kennzeichnung
aufzublasen, die niemand verlangt.

**Warum die Freigabe kein Haken zur Beruhigung ist.** Art. 50 Abs. 4 nimmt
Inhalt aus, „der einem Verfahren der menschlichen Überprüfung oder der
redaktionellen Kontrolle unterzogen wurde und bei dem eine natürliche oder
juristische Person die redaktionelle Verantwortung trägt". Die FAQ der
Kommission stellt ausdrücklich klar, dass reines Rechtschreib-Lektorat dafür
NICHT genügt — es muss eine inhaltliche Prüfung sein. Deshalb verlangt die UI
eine ausdrückliche Bestätigung („geprüft und übernommen“) und nicht den
Nebeneffekt eines Speicherns, und deshalb speichert die Freigabe eine PERSON:
ohne Person trägt niemand die Verantwortung, und die Ausnahme greift nicht.

**Warum kein Gast-Banner bei Objekttexten.** Eine Objektbeschreibung ist
Werbung für die eigene Unterkunft — kein „Thema von öffentlichem Interesse“.
Ein Banner darüber wäre kein Rechtsgehorsam, sondern ein Verkaufsschaden ohne
Rechtsgrund. Bei BLOGBEITRÄGEN sieht es anders aus: ein Beitrag über die neue
Kurtaxe oder über lokale Umweltauflagen kann die Grenze reißen, und man sieht
es dem Beitrag beim Schreiben nicht an.

**Warum nicht SynthID.** SynthID ist für Bilder belegt. Ob Vertex AI Text
wasserzeichnet, ist widersprüchlich dokumentiert, und ein öffentliches
Prüfwerkzeug für Text gibt es nicht. Auf etwas, das niemand nachprüfen kann,
lässt sich keine Rechtspflicht stützen. Unser eigenes Feld ist die Wahrheit.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel
from supabase import Client

from src.core.logging import get_logger

from .fehler import SiteConfigError

log = get_logger("nextdays.site_config.ki_herkunft")

# Nur diese beiden Tabellen tragen Herkunft an einem TEXT. `site_media` trägt
# `alt_text_origin` und wird bewusst getrennt behandelt: ein Alt-Text löst
# keine Kennzeichnung aus (er beschreibt ein echtes Foto).
_TABELLEN = frozenset({"site_pages", "site_blocks"})


class Herkunft(StrEnum):
    """Die drei Werte aus 0463. Ein vierter gehört in die Migration UND hierher
    UND in die Tabelle oben im Modul-Docstring — sonst driftet die Bedeutung."""

    human = "human"
    ai_rewritten = "ai_rewritten"
    ai_generated = "ai_generated"


class Freigabestand(BaseModel):
    """Was einer Veröffentlichung im Weg steht — und was nicht.

    ``offene_abschnitte`` ist die Liste der Abschnitts-IDs, die neu erzeugt und
    noch nicht freigegeben sind. Sie wird an die UI ausgeliefert, damit der
    Betrieb nicht suchen muss, welcher der vierzehn Abschnitte gemeint ist.
    """

    seite_offen: bool = False
    offene_abschnitte: list[str] = []
    # Enthält die Seite überhaupt erzeugten Text? Entscheidet über das
    # Meta-Tag im gerenderten HTML — unabhängig davon, ob freigegeben wurde.
    # Die Freigabe hebt die KENNZEICHNUNG nicht auf; sie hebt die
    # OFFENLEGUNGSPFLICHT des Betreibers auf. Das sind zwei verschiedene
    # Absätze desselben Artikels, und sie werden gern verwechselt.
    enthaelt_erzeugten_text: bool = False

    @property
    def blockiert(self) -> bool:
        return self.seite_offen or bool(self.offene_abschnitte)


def _jetzt() -> str:
    """Unsere Uhr — und hier ist sie richtig (Wurzel 5b): erfasst wird, wann
    WIR erzeugt bzw. wann bei UNS freigegeben wurde. Kein Fremdereignis."""
    return datetime.now(UTC).isoformat()


def herkunft_setzen(
    db: Client,
    tenant_id: str,
    *,
    tabelle: str,
    zeilen_id: str,
    herkunft: Herkunft,
    modell: str | None = None,
) -> None:
    """Die Herkunft einer Zeile setzen — tenant-gescoped.

    Der Gegenzustand wird MITGEPFLEGT (Wurzel 1): wird ein Text NEU erzeugt,
    ist eine frühere Freigabe hinfällig. Sie stehen zu lassen wäre der
    gefährlichste Zustand des ganzen Moduls — ein freigegebener Haken über
    einem Text, den nie jemand gelesen hat, und die Rechtsgrundlage für die
    fehlende Offenlegung wäre eine Behauptung.

    ``ai_rewritten`` löscht die Freigabe ebenfalls: ein umgeschriebener Text
    ist ein anderer Text. Er braucht keine Kennzeichnung, aber wenn die Seite
    vorher wegen eines erzeugten Abschnitts freigegeben war, gilt diese
    Freigabe nicht für den neuen Wortlaut.

    ``human`` räumt die KI-Felder ab: der Mensch hat übernommen.
    """
    if tabelle not in _TABELLEN:
        # Kein stiller Durchlauf: ein falscher Tabellenname hieße, dass eine
        # Herkunft nirgends landet und der Text als „von Hand“ gilt.
        raise SiteConfigError(
            f"Unbekannte Tabelle für die Herkunft: {tabelle}", status_code=422
        )
    daten: dict[str, object | None] = {"content_origin": herkunft.value}
    if herkunft is Herkunft.human:
        daten.update(
            {
                "ai_model": None,
                "ai_generated_at": None,
                "ai_reviewed_at": None,
                "ai_reviewed_by": None,
            }
        )
    else:
        daten.update(
            {
                "ai_model": modell,
                "ai_generated_at": _jetzt(),
                # Gegenzustand, siehe Docstring.
                "ai_reviewed_at": None,
                "ai_reviewed_by": None,
            }
        )
    (
        db.table(tabelle)
        .update(daten)
        .eq("id", zeilen_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    log.info(
        "ki_herkunft_gesetzt",
        tenant_id=tenant_id,
        tabelle=tabelle,
        zeilen_id=zeilen_id,
        herkunft=herkunft.value,
        modell=modell,
    )


def alt_text_herkunft_setzen(
    db: Client, tenant_id: str, *, medium_id: str, herkunft: Herkunft
) -> None:
    """Herkunft eines Alt-Textes. Eigene Funktion, weil eigene Spalte.

    ``site_media.alt_text`` selbst gehört der Mediathek (0460) und wird von
    dort geschrieben; hier steht nur, WOHER der Text kam.
    """
    (
        db.table("site_media")
        .update({"alt_text_origin": herkunft.value})
        .eq("id", medium_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )


def freigeben(
    db: Client,
    tenant_id: str,
    *,
    tabelle: str,
    zeilen_id: str,
    user_id: str,
) -> None:
    """„Geprüft und übernommen.“ Setzt Zeitpunkt UND Person.

    Nur sinnvoll auf ``ai_generated``. Auf einer Zeile mit ``human`` wäre es
    eine Freigabe von nichts — das wird abgewiesen statt stillschweigend
    gespeichert, sonst füllt sich das Feld mit bedeutungslosen Haken und die
    Frage „was ist hier tatsächlich geprüft worden?“ ist nicht mehr
    beantwortbar.
    """
    if tabelle not in _TABELLEN:
        raise SiteConfigError(
            f"Unbekannte Tabelle für die Freigabe: {tabelle}", status_code=422
        )
    zeilen = (
        db.table(tabelle)
        .select("id, content_origin")
        .eq("id", zeilen_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        raise SiteConfigError("Gehört nicht zu diesem Konto.", status_code=404)
    if zeilen[0].get("content_origin") != Herkunft.ai_generated.value:
        raise SiteConfigError(
            "Freigeben lässt sich nur neu erzeugter Text.", status_code=422
        )
    (
        db.table(tabelle)
        .update({"ai_reviewed_at": _jetzt(), "ai_reviewed_by": user_id})
        .eq("id", zeilen_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    log.info(
        "ki_freigabe",
        tenant_id=tenant_id,
        tabelle=tabelle,
        zeilen_id=zeilen_id,
        user_id=user_id,
    )


def freigabestand(db: Client, tenant_id: str, page_id: str) -> Freigabestand:
    """Was diese Seite an Freigaben schuldet — Seite UND Abschnitte.

    Die Abschnitts-Bedingung lässt sich NICHT als check-Constraint bauen: sie
    geht über Zeilen (die Seite darf nicht live sein, WENN ein Abschnitt
    darunter offen ist). Ein Trigger wäre der andere Weg und wird hier bewusst
    nicht gegangen — ein Trigger, der beim Auswerten seiner eigenen Bedingung
    wirft, legt jede Änderung an seiner Tabelle lahm (0418→0424, live erlebt).
    Die Seiten-Bedingung dagegen IST ein Constraint (0463), weil sie eine
    einzelne Zeile betrifft.
    """
    seiten = (
        db.table("site_pages")
        .select("content_origin, ai_reviewed_at")
        .eq("id", page_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not seiten:
        raise SiteConfigError("Seite gehört nicht zu diesem Konto.", status_code=404)
    seite = seiten[0]
    seite_erzeugt = seite.get("content_origin") == Herkunft.ai_generated.value
    seite_offen = seite_erzeugt and not seite.get("ai_reviewed_at")

    bloecke = (
        db.table("site_blocks")
        .select("id, content_origin, ai_reviewed_at")
        .eq("page_id", page_id)
        .eq("tenant_id", tenant_id)
        .eq("content_origin", Herkunft.ai_generated.value)
        # Deckel (Wurzel 8): eine Seite hat höchstens 50 Abschnitte, aber die
        # Abfrage soll auch bei einer kaputten Zeile nicht unbegrenzt lesen.
        .limit(200)
        .execute()
    ).data or []
    offen = [str(b["id"]) for b in bloecke if not b.get("ai_reviewed_at")]

    return Freigabestand(
        seite_offen=seite_offen,
        offene_abschnitte=offen,
        enthaelt_erzeugten_text=seite_erzeugt or bool(bloecke),
    )


def veroeffentlichung_pruefen(db: Client, tenant_id: str, page_id: str) -> None:
    """Fail-closed vor jedem Veröffentlichen. Wirft 422 mit einer Zahl.

    Die Zahl ist wichtig: „Es fehlt noch eine Freigabe“ schickt den Betrieb auf
    die Suche. „3 Abschnitte sind noch nicht freigegeben“ sagt ihm, wie weit er
    ist. Welche es sind, steht im Freigabestand, den die UI ohnehin lädt.
    """
    stand = freigabestand(db, tenant_id, page_id)
    if not stand.blockiert:
        return
    anzahl = len(stand.offene_abschnitte) + (1 if stand.seite_offen else 0)
    log.info(
        "ki_veroeffentlichung_blockiert",
        tenant_id=tenant_id,
        page_id=page_id,
        offen=anzahl,
    )
    raise SiteConfigError(
        f"Diese Seite enthält {anzahl} neu erzeugte Textstellen ohne Freigabe. "
        "Bitte inhaltlich prüfen und übernehmen, bevor sie veröffentlicht wird.",
        status_code=422,
    )


def kennzeichnung_fuer_renderer(
    page: dict, bloecke: list[dict]
) -> dict[str, object] | None:
    """Was der Renderer über die Herkunft dieser Seite in die Ausgabe schreibt.

    Rückgabe ``None`` heißt: kein erzeugter Text, kein Meta-Tag, kein Hinweis.
    Das ist der Normalfall und darf nichts kosten.

    Sonst:
      ``{"erzeugt": True, "modell": "gemini-2.5-flash", "fusshinweis": bool}``

    ``fusshinweis`` ist NUR bei Blogbeiträgen wahr. Die Unterscheidung läuft
    über ``page_type == 'post'`` — die einzige, die sich ohne Inhaltsprüfung
    treffen lässt. Eine Objektseite oder eine Startseite ist Werbung; ein
    Beitrag kann alles sein.
    """
    erzeugt = page.get("content_origin") == Herkunft.ai_generated.value
    modelle: list[str] = []
    if erzeugt and page.get("ai_model"):
        modelle.append(str(page["ai_model"]))
    for block in bloecke:
        if block.get("content_origin") == Herkunft.ai_generated.value:
            erzeugt = True
            if block.get("ai_model"):
                modelle.append(str(block["ai_model"]))
    if not erzeugt:
        return None
    # Ein Modellname, mehrfach genannt, ist eine Nennung. Mehrere verschiedene
    # (weil zwischendurch umgestellt wurde) werden alle genannt — kein „das
    # erste gewinnt", das wäre wieder eine Behauptung über die anderen.
    eindeutig = sorted(set(modelle))
    return {
        "erzeugt": True,
        "modell": ", ".join(eindeutig) if eindeutig else None,
        "fusshinweis": page.get("page_type") == "post",
    }
