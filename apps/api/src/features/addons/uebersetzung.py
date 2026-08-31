"""Zusatzleistungen in die Sprachen der Gäste bringen.

WOFUER
======
``property_addons.name`` und ``.description`` sind Sprachkarten (``jsonb``),
konnten also immer 24 Sprachen tragen. Live gefuellt waren sie mit zwei: das
Formular hatte bis zum 31.08.2026 genau zwei feste Felder, ``de`` und ``en``.

Gemessen am 31.08.2026: 61 Zeilen, davon 20 mit leerem ``en`` — der Schluessel
stand da, weil der Startentwurf ihn anlegte, nicht weil jemand ihn gefuellt
haette. Ein leerer Wert ist keine Uebersetzung; er laesst die Zeile nur
gepflegt aussehen.

Der Leser ist hier ein anderer als bei den Aufgabenregeln (0511): dort das
Personal, hier der GAST. Er sieht den Namen auf der Buchungsstrecke, im
Gaesteportal und beim Check-in. Ein daenischer Gast, dem „Wäschepaket“
angeboten wird, kauft es nicht.

WARUM KEINE EIGENE TABELLE (anders als 0511)
============================================
Bei den Aufgabenregeln ist ``name`` EIN Freitext in EINER Sprache; die
Fassungen brauchten einen eigenen Ort. Hier ist das Feld bereits die
Sprachkarte — eine Tabelle daneben waere eine ZWEITE Wahrheit ueber denselben
Text, und der Lesepfad muesste bei jedem Zugriff entscheiden, welche gilt.
Die Fassung gehoert in die Karte, in der sie ohnehin gesucht wird.

WARUM KEINE ``quellsprache``-SPALTE (anders als 0511)
=====================================================
Bei den Regeln war die Ausgangssprache unbekannt und musste erfragt werden —
ein Betrieb fuehrte deutsche UND daenische Namen nebeneinander, ein Default
haette die Haelfte falsch etikettiert. Hier steht sie IM DATUM: der Schluessel
``"de"`` sagt, dass der Wert Deutsch ist. Eine Spalte daneben koennte davon
abweichen, und dann waere unklar, welche gilt.

Nachgeprueft, statt angenommen (31.08.2026): alle ``de``-Werte sind wirklich
Deutsch, alle ``en``-Werte wirklich Englisch. Die Ausgangssprache wird
trotzdem nicht geraten — sie wird uebergeben, und der Aufrufer nimmt sie aus
der Karte.

DER TEURE UNTERSCHIED: DIESELBE LEISTUNG STEHT n-MAL
====================================================
Zusatzleistungen werden auf Objekte VERTEILT (Bibliothek, „Zu anderen Objekten
hinzufuegen“). Dieselbe Leistung ist deshalb n eigene Zeilen — eine je Objekt.

Gemessen: 61 Zeilen, aber nur FUENF verschiedene Namen. „Babybett faltbar“
steht 20-mal, „Kinderhochstuhl“ 20-mal, „Wäschepaket“ 19-mal.

Zeile fuer Zeile uebersetzt waeren das 61 x 23 = 1403 bezahlte Modellaufrufe
fuer fuenf Woerter — 99,6 % davon Doppelarbeit, und jede Kopie duerfte
zufaellig anders ausfallen, sodass dasselbe Babybett auf zwanzig Objekten
zwanzig daenische Namen haette.

Deshalb wird ueber den TEXT gebuendelt, nicht ueber die Zeile: gleicher
Quelltext = ein Aufruf = dieselbe Fassung ueberall. Aus 1403 werden 115
(5 x 23). Das ist kein Feinschliff, das ist der Unterschied zwischen
brauchbar und unbezahlbar.
"""
from __future__ import annotations

import json
from collections.abc import Callable

from pydantic import BaseModel, Field
from supabase import Client

from src.core.ki import KiAntwort, KiError, VertexClient
from src.core.logging import get_logger
from src.features.site_config.ki_texte import ohne_umrandung, sprache_benennen

log = get_logger("nextdays.addons.uebersetzung")

#: Die uebersetzbaren Felder. Anders als bei den Aufgabenregeln ist die
#: Beschreibung HIER dabei: sie ist kein internes Arbeitsdetail, sondern der
#: Text, an dem der Gast entscheidet, ob er kauft („1 Bettbezug, 1 Laken
#: 90x200 …“). Sie leer zu lassen hiesse, ihm die Kaufgrundlage vorzuenthalten.
FELDER: tuple[str, ...] = ("name", "description")

#: Harte Obergrenze je Feld (Wurzel 8). Die laengste live gemessene
#: Beschreibung hat rund 300 Zeichen (die Wäschepaket-Liste); 2000 laesst
#: reichlich Luft, faengt aber einen eingefuegten Roman ab, bevor er als
#: Uebersetzungsauftrag durchgeht.
MAX_FELD_ZEICHEN = 2000

#: Die 24 EU-Amtssprachen, deckungsgleich mit ``web/i18n/locales.ts``.
SPRACHEN: tuple[str, ...] = (
    "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
    "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
)


class AddonUebersetzungError(Exception):
    """Der Lauf kann so nicht starten (kaputte Eingabe, fehlende Sprache)."""


class UebersetzungsLauf(BaseModel):
    """Was ein Lauf getan hat.

    Jede Zahl ist eine eigene Aussage: „5 uebersetzt“ und „5 unveraendert“
    sind sehr verschiedene Ergebnisse, und ein Aufrufer, der nur eine
    Gesamtzahl bekommt, kann sie nicht unterscheiden.
    """

    #: Sprachen, die neu erzeugt wurden.
    uebersetzt: list[str] = Field(default_factory=list)
    #: Sprachen, die schon einen Wert trugen und nicht angefasst wurden.
    vorhanden: list[str] = Field(default_factory=list)
    #: Sprache -> Grund. Ein Fehler in einer Sprache beendet den Lauf nicht.
    fehlgeschlagen: dict[str, str] = Field(default_factory=dict)
    #: Wie viele Zeilen die Fassungen bekommen haben (Verteilung, s. Modulkopf).
    zeilen: int = 0


def _karte(wert: object) -> dict[str, str]:
    """Ein jsonb-Feld als Sprachkarte lesen.

    Alles andere als ein Objekt wird zur leeren Karte. Das ist kein
    stillschweigendes Wegwerfen: ``name`` ist ``not null`` und in der Praxis
    immer ein Objekt — die Pruefung faengt nur den Fall ab, dass jemand per
    DB-Direktpfad etwas anderes hineinschreibt, und verhindert einen 500.
    """
    if not isinstance(wert, dict):
        return {}
    return {
        str(k): v.strip()
        for k, v in wert.items()
        if isinstance(v, str) and v.strip()
    }


def _felder_pruefen(name: dict[str, str], beschreibung: dict[str, str]) -> None:
    """Zu lange Felder sind ein Datenfehler, kein Uebersetzungsauftrag."""
    for feld, karte in (("name", name), ("description", beschreibung)):
        for sprache, wert in karte.items():
            if len(wert) > MAX_FELD_ZEICHEN:
                msg = (
                    f"Feld „{feld}“ ({sprache}) ist mit {len(wert)} Zeichen "
                    f"zu lang (Grenze {MAX_FELD_ZEICHEN})."
                )
                raise AddonUebersetzungError(msg)


def _antwort_lesen(text: str, ziel: str, *, mit_beschreibung: bool) -> dict[str, str]:
    """Die Modellantwort als flaches Objekt lesen.

    Ein Modell, das statt JSON eine Erklaerung schickt, ist ein Fehler DIESER
    einen Sprache — er wird benannt und nicht verschluckt (Wurzel 5).
    """
    roh = ohne_umrandung(text or "")
    try:
        daten = json.loads(roh)
    except json.JSONDecodeError as exc:
        msg = f"Antwort fuer {ziel} ist kein JSON: {exc}"
        raise AddonUebersetzungError(msg) from exc
    if not isinstance(daten, dict):
        msg = f"Antwort fuer {ziel} ist kein Objekt."
        raise AddonUebersetzungError(msg)

    out: dict[str, str] = {}
    name = daten.get("name")
    if not isinstance(name, str) or not name.strip():
        # Ohne Namen ist die Fassung wertlos — der Gast saehe eine leere
        # Beschriftung. Lieber diese Sprache als fehlgeschlagen fuehren, als
        # sie halb zu speichern.
        msg = f"Antwort fuer {ziel} enthaelt keinen Namen."
        raise AddonUebersetzungError(msg)
    out["name"] = name.strip()

    if mit_beschreibung:
        beschreibung = daten.get("description")
        if isinstance(beschreibung, str) and beschreibung.strip():
            out["description"] = beschreibung.strip()
        # Fehlt sie, bleibt sie weg: eine Zusatzleistung OHNE Beschreibung ist
        # ein gueltiger Zustand (live hat die Haelfte keine). Einen Platzhalter
        # zu erfinden waere Wurzel 4.
    return out


def _in_eine_sprache(
    client: VertexClient,
    *,
    name: str,
    beschreibung: str | None,
    quelle: str,
    ziel: str,
) -> tuple[dict[str, str], KiAntwort]:
    """Eine Zusatzleistung in EINE Zielsprache uebersetzen.

    Ein Aufruf je Sprache, nicht einer fuer alle — dieselbe Begruendung wie in
    ``site_config.seiten_uebersetzung`` und ``tasks.regel_uebersetzung``:
    bricht eine Antwort ab, kostet das nur ihre eigene Sprache, nicht die 22
    anderen.
    """
    quelle_name = sprache_benennen(quelle)
    ziel_name = sprache_benennen(ziel)
    eingabe: dict[str, str] = {"name": name}
    if beschreibung:
        eingabe["description"] = beschreibung

    system = "\n".join(
        [
            f"Du uebersetzt Angebotstexte einer Ferienunterkunft nach "
            f"{ziel_name}.",
            f"Ausgangssprache: {quelle_name}. Zielsprache: {ziel_name}.",
            "",
            "Es sind ZUSATZLEISTUNGEN, die ein Gast zu seiner Buchung "
            "dazukaufen kann: Waeschepakete, Babybetten, Hochstuehle, "
            "Reinigung, Fruehstueck, Transfer, frueher Check-in.",
            "",
            # Der Gast entscheidet an diesem Text, ob er kauft. Eine woertliche
            # Uebersetzung, die im Zielland niemand so nennt, kostet den Verkauf.
            "Verwende die im Zielland UEBLICHE Bezeichnung, nicht die "
            "woertliche Uebersetzung. Es ist ein Verkaufstext, den ein Gast "
            "wiedererkennen muss.",
            "",
            # Mengen und Masse sind der Inhalt der Leistung, nicht ihre Sprache.
            # Wird aus „1 Laken (90x200)“ ein anderes Mass, ist die Zusage falsch.
            "Zahlen, Mengen, Masse und Groessenangaben (etwa 90x200) bleiben "
            "EXAKT erhalten — sie beschreiben, was geliefert wird.",
            "Zeilenumbrueche und Aufzaehlungen bleiben erhalten.",
            "Eigennamen, Ortsnamen und Marken bleiben unveraendert.",
            "Der Name ist eine Beschriftung, kein Satz — halte ihn kurz.",
            "",
            "Antworte AUSSCHLIESSLICH mit einem flachen JSON-Objekt mit den "
            "Schluesseln, die in der Eingabe stehen. Kein Codeblock, keine "
            "Erklaerung.",
        ]
    )
    user = json.dumps(eingabe, ensure_ascii=False, indent=2)
    # Grob vier Zeichen je Token, verdreifacht fuer Zielsprache und JSON-Rahmen.
    # Boden 256: ein kurzer Name braucht nicht mehr, und ein zu knappes Budget
    # erzeugt MAX_TOKENS — der Aufruf kostet dann, ohne etwas zu liefern.
    # Deckel 1500: die laengste Beschreibung live liegt weit darunter.
    laenge = sum(len(v) for v in eingabe.values())
    budget = min(1500, max(256, (laenge // 4) * 6))
    antwort = client.erzeuge(
        system=system, user=user, temperature=0.2, max_tokens=budget
    )
    return (
        _antwort_lesen(antwort.text, ziel, mit_beschreibung=bool(beschreibung)),
        antwort,
    )


def addon_uebersetzen(
    client: VertexClient,
    db: Client,
    addon: dict,
    ziele: list[str],
    *,
    quelle: str,
    geschwister: list[dict] | None = None,
    deckel: Callable[[], None] | None = None,
) -> tuple[UebersetzungsLauf, list[KiAntwort]]:
    """Eine Zusatzleistung in alle Zielsprachen bringen.

    ``quelle`` ist der Sprachschluessel, aus dem uebersetzt wird — er kommt aus
    der Karte selbst (siehe Modulkopf), wird also nicht geraten.

    ``geschwister`` sind die Zeilen MIT DEMSELBEN QUELLTEXT auf anderen
    Objekten. Sie bekommen dieselbe Fassung geschrieben, ohne einen zweiten
    Modellaufruf: 61 Zeilen tragen live nur fuenf verschiedene Namen, und
    dasselbe Babybett darf nicht zwanzig verschiedene daenische Namen haben.

    Eine schon gefuellte Sprache wird NICHT ueberschrieben. Sie kann von Hand
    eingetragen worden sein, und eine menschliche Fassung lautlos durch eine
    maschinelle zu ersetzen waere stiller Datenverlust — derselbe Riegel, den
    ``geprueft`` bei den Aufgabenregeln zieht, nur hier ohne eigene Spalte:
    „vorhanden“ IST hier die menschliche Entscheidung.

    ``deckel`` wird VOR JEDEM Modellaufruf gerufen und darf werfen. Ein
    einmaliger Check vor dem Lauf waere eine Attrappe — ein Lauf ueber 23
    Sprachen sind 23 Aufrufe.
    """
    name_karte = _karte(addon.get("name"))
    beschr_karte = _karte(addon.get("description"))
    _felder_pruefen(name_karte, beschr_karte)

    quell_name = name_karte.get(quelle)
    if not quell_name:
        msg = (
            f"Die Zusatzleistung hat in der Ausgangssprache „{quelle}“ keinen "
            "Namen. Ohne Quelltext waere jede Uebersetzung geraten."
        )
        raise AddonUebersetzungError(msg)
    quell_beschr = beschr_karte.get(quelle)

    uebersetzt: list[str] = []
    vorhanden: list[str] = []
    fehlgeschlagen: dict[str, str] = {}
    antworten: list[KiAntwort] = []
    neue_namen: dict[str, str] = {}
    neue_beschr: dict[str, str] = {}

    for ziel in ziele:
        if ziel == quelle:
            continue
        if name_karte.get(ziel):
            vorhanden.append(ziel)
            continue
        if deckel is not None:
            deckel()
        try:
            felder, antwort = _in_eine_sprache(
                client,
                name=quell_name,
                beschreibung=quell_beschr,
                quelle=quelle,
                ziel=ziel,
            )
        except (KiError, AddonUebersetzungError) as exc:
            # Genau die zwei erwartbaren Fehlerarten, spezifisch gefangen: ein
            # breites `except` verschluckte hier auch den Deckel (Wurzel 5).
            fehlgeschlagen[ziel] = str(exc)
            continue
        # Abgeschnitten? Dann NICHT speichern.
        #
        # `MAX_TOKENS` heisst: das Modell war mitten im Satz am Budget. Meist
        # ist das JSON dann kaputt und `_antwort_lesen` wirft ohnehin — aber
        # nicht immer: kommt der Name zuerst und bricht nur die Beschreibung ab,
        # liegt gueltiges JSON mit einem halben Satz vor.
        #
        # Hier waere das Speichern schlimmer als bei den Seiten (0476): dort
        # markiert ein abweichender `quelle_hash` die Fassung noch als veraltet.
        # HIER ist der Riegel „die Sprache ist gefuellt" — ein halber Satz
        # gaelte damit als menschliche Entscheidung und wuerde NIE wieder
        # angefasst. Der Gast bekaeme ihn dauerhaft zu lesen.
        if antwort.abschlussgrund == "MAX_TOKENS":
            fehlgeschlagen[ziel] = "Die Uebersetzung wurde abgeschnitten."
            log.warning(
                "addon_uebersetzung_abgeschnitten",
                addon_id=str(addon.get("id") or ""),
                sprache=ziel,
            )
            continue
        antworten.append(antwort)
        neue_namen[ziel] = felder["name"]
        if felder.get("description"):
            neue_beschr[ziel] = felder["description"]
        uebersetzt.append(ziel)

    zeilen = 0
    if neue_namen:
        zeilen = _fassungen_schreiben(
            db,
            [addon, *(geschwister or [])],
            neue_namen=neue_namen,
            neue_beschr=neue_beschr,
        )

    lauf = UebersetzungsLauf(
        uebersetzt=uebersetzt,
        vorhanden=vorhanden,
        fehlgeschlagen=fehlgeschlagen,
        zeilen=zeilen,
    )
    log.info(
        "addon_uebersetzt",
        addon_id=str(addon.get("id") or ""),
        quelle=quelle,
        uebersetzt=len(uebersetzt),
        vorhanden=len(vorhanden),
        fehlgeschlagen=len(fehlgeschlagen),
        zeilen=zeilen,
    )
    return lauf, antworten


def _fassungen_schreiben(
    db: Client,
    zeilen: list[dict],
    *,
    neue_namen: dict[str, str],
    neue_beschr: dict[str, str],
) -> int:
    """Die neuen Fassungen in die Sprachkarten schreiben.

    Je Zeile wird die VORHANDENE Karte gelesen und ergaenzt, nicht ersetzt.
    Ein pauschales Ueberschreiben verloere jede Sprache, die auf DIESER Zeile
    schon stand — die Geschwister sind nur beim Quelltext gleich, nicht
    zwingend im Rest ihrer Karte (Wurzel 1).
    """
    geschrieben = 0
    for zeile in zeilen:
        zeilen_id = str(zeile.get("id") or "")
        if not zeilen_id:
            continue
        name = {**_karte(zeile.get("name"))}
        beschreibung = {**_karte(zeile.get("description"))}
        geaendert = False
        for sprache, wert in neue_namen.items():
            if not name.get(sprache):
                name[sprache] = wert
                geaendert = True
        for sprache, wert in neue_beschr.items():
            # Die Beschreibung nur dort ergaenzen, wo die Zeile in der
            # Ausgangssprache ueberhaupt eine hat: sonst bekaeme eine Zeile
            # ohne Beschreibung ploetzlich die des Geschwisters.
            if beschreibung and not beschreibung.get(sprache):
                beschreibung[sprache] = wert
                geaendert = True
        if not geaendert:
            continue
        db.table("property_addons").update(
            {"name": name, "description": beschreibung}
        ).eq("id", zeilen_id).execute()
        geschrieben += 1
    return geschrieben


def gleiche_quelltexte(
    db: Client, tenant_id: str, addon: dict, quelle: str
) -> list[dict]:
    """Die Zeilen anderer Objekte MIT DEMSELBEN Quelltext.

    Der Grund steht im Modulkopf: dieselbe Leistung ist n Zeilen, eine je
    Objekt. Ohne dieses Buendeln kostete ein Lauf das 12-fache und lieferte je
    Objekt eine andere Uebersetzung desselben Wortes.

    Verglichen wird der Quelltext, NICHT der Preis oder die Abrechnungsbasis:
    „Wäschepaket“ zu 15 EUR und „Wäschepaket“ zu 18 EUR heissen in beiden
    Faellen auf Daenisch gleich.

    Der Tenant-Scope ist Pflicht (Wurzel 3): ohne ihn schriebe ein Lauf in die
    Zusatzleistungen fremder Betriebe, nur weil sie zufaellig dasselbe Wort
    verwenden.
    """
    quell_name = _karte(addon.get("name")).get(quelle)
    if not quell_name:
        return []
    quell_beschr = _karte(addon.get("description")).get(quelle)
    eigene_id = str(addon.get("id") or "")

    objekte = (
        db.table("properties").select("id").eq("tenant_id", tenant_id).execute()
    ).data or []
    objekt_ids = [str(o["id"]) for o in objekte]
    if not objekt_ids:
        return []

    treffer: list[dict] = []
    block = 100
    for start in range(0, len(objekt_ids), block):
        rows = (
            db.table("property_addons")
            .select("id, name, description")
            .in_("property_id", objekt_ids[start : start + block])
            .execute()
        ).data or []
        for row in rows:
            if str(row["id"]) == eigene_id:
                continue
            if _karte(row.get("name")).get(quelle) != quell_name:
                continue
            if _karte(row.get("description")).get(quelle) != quell_beschr:
                continue
            treffer.append(row)
    return treffer
