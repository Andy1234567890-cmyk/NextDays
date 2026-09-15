"""KI-Antwortvorschlag für den Eigentümer-Chat (0611, Präfix ``eig:``).

WARUM EIN EIGENES MODUL und kein Zweig in ``ki_antwort.py``: Der dortige
Vorschlag ist eine GAST-Antwort. Sein Kontext ist die Reservierung, die
Gästemappe und die Wissensdatenbank, sein Prompt redet einen Gast an. Ein
Eigentümer ist die Gegenseite eines Geschäftsverhältnisses, kein Gast — ihm
„zu Ihrem Aufenthalt" zu schreiben wäre kein Formulierungsfehler, sondern die
falsche Rolle.

Der Anlass (15.09.2026): In der PMS-App endete der KI-Knopf auf einem
Eigentümer-Thread in „Kein Vorschlag — Konversation nicht gefunden". Der
Grund lag tiefer als die Meldung: ``ai_reply`` lud über ``_load_thread``, und
ein ``eig:``-Thread hat keine Zeile in ``channex_booking`` (404, Wurzel 5).

WAS HIER NICHT MITGEHT — und das ist kein Vergessen:

* **KEINE Finanzdaten** (Abrechnungen, Auszahlungen, Provisionen). Der Knopf
  steht im Posteingang, und den bedient auch ein Mitarbeiter ohne
  Finanzeinblick (§4.3). Käme die letzte Abrechnung in den Prompt, wäre die KI
  der Weg an der Rollentrennung vorbei — dieselbe Lücke, die Wurzel 3 für
  jeden anderen Lesepfad schließt. Fragt der Eigentümer nach Geld, sagt der
  Vorschlag die Klärung zu und nennt KEINE Zahl.
* **KEINE Gästedaten.** Wer bei ihm wohnt, geht den Eigentümer als Zahl an,
  nicht als Name — Namen und Kontakte stehen unter der Gast-Maske.
* **KEINE Wissensdatenbank.** Sie beantwortet Gastfragen („WLAN-Passwort"),
  keine Eigentümerfragen.

Der Tagesdeckel zählt getrennt (``eigentuemer_antwort``), aus demselben Grund
wie bei den übrigen Funktionsnamen: in einem Topf mit ``gast_antwort`` liesse
sich nicht sagen, welcher Knopf ihn gesprengt hat.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.ki import KiAntwort, VertexClient
from src.core.logging import get_logger

# BEWUSST wiederverwendet statt kopiert: Beide Helfer arbeiten auf
# `InboxMessage` und kennen die Seiten „guest"/„property". `eigentuemer.py`
# bildet den Eigentümer auf „guest" ab (die Gegenseite) und die Agentur auf
# „property" — die Zuordnung stimmt hier also unverändert. Eine zweite Kopie
# mit eigenen Obergrenzen würde auseinanderlaufen, sobald jemand eine davon
# anfasst.
from .ki_antwort import _letzte_gastfrage, _verlauf_text
from .ki_kontext import KiKontext
from .schemas import AiSettings, InboxMessage

log = get_logger("nextdays.inbox.ki_eigentuemer")

# Der Funktionsname für `site_ai_usage`. MUSS im check-Constraint der Tabelle
# stehen (0708) UND in `site_config.ki_nutzung.FUNKTIONEN` — sonst steigt
# `_schreiben` still aus und der Tagesdeckel wird zur Attrappe. Genau dieser
# Fehler ist in diesem Projekt schon viermal passiert.
FUNKTION = "eigentuemer_antwort"

# Wurzel 8: harte Obergrenzen für alles, was aus der Datenbank in den Prompt
# wandert. Ein Objekt mit 300 offenen Aufgaben würde sonst allein den Prompt
# füllen — und jeder dieser Aufrufe wird bezahlt.
MAX_AUFGABEN = 15
MAX_ANREISEN = 8
MAX_ANTWORT_TOKENS = 600

# Wie weit der Belegungsblick reicht. Zwei Monate decken die Frage ab, die ein
# Eigentümer wirklich stellt („wie sieht es demnächst aus"), ohne den halben
# Jahreskalender in den Prompt zu ziehen.
VORSCHAU_TAGE = 60

# Reservierungen, die keinen Verkauf darstellen, gehören nicht in die
# Belegungszahl — eine stornierte Buchung als „belegt" zu melden wäre eine
# Falschaussage gegenüber dem Eigentümer (Wurzel 4).
ZAEHLENDE_STATUS = ("confirmed", "checked_in", "checked_out", "new", "modified")


@dataclass(frozen=True)
class EigentuemerVorschlag:
    """Der Vorschlag samt allem, was ihn nachvollziehbar macht.

    Gleiche Form wie :class:`ki_antwort.Antwortvorschlag` — der Aufrufer
    protokolliert beide über denselben Weg, und ``ki_nutzung.buchen`` nimmt die
    rohe :class:`KiAntwort` entgegen.
    """

    antwort: KiAntwort
    kontext: KiKontext
    frage: str = ""

    @property
    def text(self) -> str:
        return self.antwort.text

    @property
    def quellen(self) -> list[str]:
        return list(self.kontext.quellen)


def _objektzeilen(zeile: dict, einheiten: int) -> str:
    """Was den Eigentümer an SEINEM Objekt angeht.

    Die Anschrift steht hier zu Recht: Sie ist sein Haus. Das ist der
    Unterschied zum Gastkontext, wo dieselbe Angabe erst bei bestätigter
    Buchung herausgeht.
    """
    teile = [f"Objekt: {zeile.get('title') or '(ohne Titel)'}"]
    if zeile.get("address"):
        teile.append(f"Anschrift: {zeile['address']}")
    if zeile.get("status"):
        teile.append(f"Status im System: {zeile['status']}")
    # Ein Objekt ist EIN Einheiten-Typ mit n Einheiten (Datenmodell). Die Zahl
    # gehört dazu, weil „ausgebucht" bei fünf Studios etwas anderes heißt als
    # bei einem.
    teile.append(f"Einheiten: {einheiten}")
    return "\n".join(teile)


def _objektblock(db: Client, tenant_id: str, property_id: str) -> tuple[str, str] | None:
    """(Titel, Block) des Objekts — oder ``None``, wenn es keines gibt.

    Load und Scope bleiben zusammen (Wurzel 3): ``tenant_id`` steht an der
    Abfrage, nicht als Vergleich danach.
    """
    zeilen = (
        db.table("properties")
        .select("id, title, address, status")
        .eq("tenant_id", tenant_id)
        .eq("id", property_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        return None
    einheiten = (
        db.table("property_units")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .execute()
    )
    return (
        str(zeilen[0].get("title") or ""),
        _objektzeilen(zeilen[0], einheiten.count or 0),
    )


def _eigentuemerblock(db: Client, property_id: str) -> str | None:
    """Mit WEM die Agentur hier spricht.

    Ein Objekt kann mehreren Menschen gehören (``owner_properties`` ist n:m,
    0601). Alle Miteigentümer lesen denselben Faden — der Vorschlag darf
    deshalb nicht einen einzelnen Namen als „den" Eigentümer anreden.
    """
    zuordnung = (
        db.table("owner_properties")
        .select("owner_id")
        .eq("property_id", property_id)
        .execute()
    ).data or []
    owner_ids = sorted({str(z["owner_id"]) for z in zuordnung if z.get("owner_id")})
    if not owner_ids:
        return None
    besitzer = (
        db.table("owners").select("id, name").in_("id", owner_ids).execute()
    ).data or []
    namen = sorted({str(z.get("name") or "").strip() for z in besitzer if z.get("name")})
    if not namen:
        return None
    if len(namen) == 1:
        return f"Eigentümer: {namen[0]}"
    return "Eigentümer (Miteigentum, alle lesen diesen Verlauf): " + ", ".join(namen)


def _aufgabenblock(db: Client, tenant_id: str, property_id: str) -> str | None:
    """Offene Aufgaben an diesem Objekt — der häufigste Eigentümer-Anlass.

    „Ist der Wasserschaden erledigt?" ist die Frage, die ohne diesen Block eine
    Rückfrage auslöst statt einer Antwort.
    """
    zeilen = (
        db.table("tasks")
        .select("title, status, due_at")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .neq("status", "done")
        .order("due_at")
        .limit(MAX_AUFGABEN)
        .execute()
    ).data or []
    if not zeilen:
        return "Keine offenen Aufgaben an diesem Objekt."
    eintraege = [
        f"- {z.get('title') or '(ohne Titel)'}"
        + (f" (fällig {str(z['due_at'])[:10]})" if z.get("due_at") else "")
        + f" — {z.get('status') or 'offen'}"
        for z in zeilen
    ]
    return "\n".join(eintraege)


def _belegungsblock(
    db: Client, tenant_id: str, property_id: str, heute: date
) -> str | None:
    """Belegung der kommenden Wochen — als ZAHL und Anreisedaten, ohne Gastnamen.

    Was der Eigentümer wissen darf: dass und wann belegt ist. Wer dort wohnt,
    steht unter der Gast-Maske und geht ihn nichts an.
    """
    bis = heute + timedelta(days=VORSCHAU_TAGE)
    zeilen = (
        db.table("reservations")
        .select("check_in, check_out, status")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .gte("check_in", heute.isoformat())
        .lte("check_in", bis.isoformat())
        .in_("status", list(ZAEHLENDE_STATUS))
        .order("check_in")
        .limit(MAX_ANREISEN)
        .execute()
    ).data or []
    if not zeilen:
        return f"Keine Anreisen in den nächsten {VORSCHAU_TAGE} Tagen."
    anreisen = [
        f"- {str(z.get('check_in'))[:10]} bis {str(z.get('check_out'))[:10]}"
        for z in zeilen
        if z.get("check_in") and z.get("check_out")
    ]
    kopf = f"{len(anreisen)} Anreisen in den nächsten {VORSCHAU_TAGE} Tagen:"
    return "\n".join([kopf, *anreisen])


def kontext_bauen(
    db: Client,
    tenant_id: str,
    property_id: str,
    *,
    heute: date | None = None,
) -> KiKontext:
    """Alles, worauf der Vorschlag fußen darf — frisch gelesen, nichts zwischengelagert.

    Frisch statt kopiert, aus demselben Grund wie in ``ki_kontext``: eine Kopie
    hat einen Gegenzustand, den niemand pflegt (Wurzel 1).
    """
    tag = heute or datetime.now(UTC).date()
    kontext = KiKontext()

    objekt = _objektblock(db, tenant_id, property_id)
    if objekt:
        kontext.bloecke.append(("Objekt", objekt[1]))
        kontext.quellen.append("Objektstammdaten")
    else:
        # Kein Ersatzwert, kein erfundener Objektname (Wurzel 4) — der Prompt
        # sagt dann schlicht nichts über das Objekt, und das Modell erfährt aus
        # der fehlenden Quelle, dass es nichts behaupten darf.
        kontext.weggelassen.append("Objektstammdaten nicht lesbar")

    besitzer = _eigentuemerblock(db, property_id)
    if besitzer:
        kontext.bloecke.append(("Eigentümer", besitzer))
        kontext.quellen.append("Eigentümerzuordnung")

    aufgaben = _aufgabenblock(db, tenant_id, property_id)
    if aufgaben:
        kontext.bloecke.append(("Offene Aufgaben", aufgaben))
        kontext.quellen.append("Aufgaben")

    belegung = _belegungsblock(db, tenant_id, property_id, tag)
    if belegung:
        kontext.bloecke.append(("Belegung", belegung))
        kontext.quellen.append("Belegung")

    # Ausdrücklich benannt, nicht stillschweigend ausgelassen: Der Mitarbeiter
    # soll am Vorschlag sehen, WARUM keine Zahl darin steht.
    kontext.weggelassen.append("Abrechnungen und Auszahlungen (Rollentrennung)")
    return kontext


def _system_prompt(einstellungen: AiSettings | None) -> str:
    ton = getattr(einstellungen, "tone", None) or "freundlich"
    signatur = getattr(einstellungen, "signature", None)
    teile = [
        f"Du schreibst für die Hausverwaltung eines Ferienobjekt-Betriebs an "
        f"den EIGENTÜMER des Objekts. Der Eigentümer ist Geschäftspartner, "
        f"nicht Gast: Er wohnt nicht dort, er besitzt es. Formuliere {ton}, "
        "sachlich und auf Augenhöhe.",
        # Die Kernregel — derselbe Grund wie bei der Gast-Antwort: Der Kontext
        # oben wird sorgfältig gebaut, damit das Modell ausschließlich daraus
        # schöpft.
        "Verwende AUSSCHLIESSLICH die Angaben aus dem Abschnitt Kontext. "
        "Erfinde nichts — keine Termine, keine Zusagen, keine Namen von "
        "Handwerkern, keine Belegungszahlen.",
        # Wurzel 4 in Produktform: lieber laut fehlen als plausibel erfinden.
        "Steht die Antwort NICHT im Kontext, dann erfinde sie nicht. Sage in "
        "einem Satz zu, dass du es klärst und nachreichst, und beginne deine "
        "Nachricht mit der Zeile [FEHLENDE ANGABE: <was genau fehlt>]. Kannst "
        "du die Frage aus dem Kontext beantworten, lass die Zeile vollständig "
        "weg.",
        # Die Finanzsperre gehört in den Prompt und nicht nur in den Kontext:
        # Ein Modell, dem die Zahlen fehlen, neigt sonst dazu, eine plausible
        # zu nennen. Hier steht ausdrücklich, was es stattdessen tun soll.
        "Zu Abrechnungen, Auszahlungen, Provisionen und Beträgen liegen dir "
        "KEINE Daten vor. Nenne niemals eine Summe, einen Prozentsatz oder "
        "eine Währung. Kündige stattdessen an, dass die Abrechnung geprüft "
        "und die Zahl nachgereicht wird.",
        # Gleiche Markierung wie beim Gastpfad, gleicher Nutzen: Ein
        # verärgerter Eigentümer ist genau das, was die Betriebsleitung sehen
        # muss, bevor es eskaliert.
        "Ist der Eigentümer erkennbar verärgert, beschwert er sich oder droht "
        "er mit Kündigung oder rechtlichen Schritten, dann beginne deine "
        "Nachricht zusätzlich mit der Zeile [STIMMUNG NEGATIV: <ein kurzer "
        "Satz, worüber>]. Bei sachlichem Ton lass diese Zeile vollständig weg.",
        "Gib NUR den Antworttext zurück, ohne Anrede-Platzhalter und ohne "
        "Erklärungen über dich selbst.",
    ]
    if signatur:
        teile.append(f"Beende die Nachricht mit dieser Signatur: {signatur}.")
    return " ".join(teile)


def vorschlag_erzeugen(
    db: Client,
    tenant_id: str,
    *,
    property_id: str,
    verlauf: list[InboxMessage],
    einstellungen: AiSettings | None = None,
    heute: date | None = None,
    client: VertexClient | None = None,
) -> EigentuemerVorschlag:
    """Einen Antwortvorschlag an den Eigentümer erzeugen.

    Kein Fallback, kein erfundener Text. Wirft :class:`src.core.ki.KiError` —
    der Aufrufer übersetzt das in seinen eigenen Fehlertyp mit demselben
    Statuscode.
    """
    ki = client or VertexClient()
    # Der Eigentümer sitzt in `eigentuemer.py` auf der Seite „guest" — die
    # Helfer greifen deshalb unverändert.
    frage = _letzte_gastfrage(verlauf)
    kontext = kontext_bauen(db, tenant_id, property_id, heute=heute)
    user = (
        f"# Kontext\n\n{kontext.text}\n\n"
        f"# Bisheriger Verlauf\n{_verlauf_text(verlauf)}\n\n"
        "# Auftrag\nSchreibe den Antwortvorschlag der Hausverwaltung an den "
        "Eigentümer."
    )
    antwort = ki.erzeuge(
        system=_system_prompt(einstellungen),
        user=user,
        temperature=0.4,
        max_tokens=MAX_ANTWORT_TOKENS,
    )
    log.info(
        "ki_eigentuemer_antwort_erzeugt",
        tenant_id=tenant_id,
        property_id=property_id,
        zeichen_kontext=kontext.zeichen,
        quellen=kontext.quellen,
        weggelassen=kontext.weggelassen,
        tokens_ein=antwort.tokens_ein,
        tokens_aus=antwort.tokens_aus,
    )
    return EigentuemerVorschlag(antwort=antwort, kontext=kontext, frage=frage)
