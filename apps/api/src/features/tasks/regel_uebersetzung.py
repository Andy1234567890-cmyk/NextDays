"""Regelnamen in die Sprachen der Leser bringen (0511).

WOFUER
======
``task_rules.name`` ist EIN Freitext in EINER Sprache — der, in der ihn jemand
eingetippt hat. Gelesen wird er von Menschen mit anderen Sprachen: der
Eigentuemer im Portal, die Reinigungskraft in der Zuweisungsmail, die Agentur
im Kalender.

Live gemessen (31.08.2026) fuehrt der Mandant AirSmil 26 Nutzer in zwei
Sprachen (``da`` und ``de``) und zwoelf Regeln mit GEMISCHTEN Namen:
„Anreisecheck" und „Endreinigung" neben „Vinduer 8-uger", „Vicevaertrunde hele
aaret", „Reng T" und „Velk J". Im deutschen Dashboard stehen die daenischen
Kuerzel, im daenischen Portal die deutschen Woerter. Beide Richtungen sind
gleichzeitig falsch.

Der Anlass war die Bestellliste aus 0510 — dort waehlt ein Eigentuemer eine
Leistung, die er bezahlt, und „Reng J" ist dafuer keine Beschriftung.

WIE DER LAUF ARBEITET
=====================
Ausgangssprache ist ``task_rules.quellsprache``. Sie ist bewusst NULLABLE:
ein Default waere an diesen Daten nachweislich falsch. Fehlt sie, wird die Regel
UEBERSPRUNGEN und gemeldet — nicht geraten. „Uebersetze aus dem Deutschen" auf
ein daenisches „Vinduer 4-uger" liefert kein Fehlersignal, sondern eine
plausible Falschuebersetzung, und das ist die teuerste Sorte Fehler (Wurzel 4).

Der ``quelle_hash`` entscheidet, was passiert:

* Hash unveraendert → NICHTS. Kein Modellaufruf (Wurzel 2: ein Doppelklick
  oder ein zweiter Lauf kostet nichts).
* Hash veraendert, Fassung NICHT geprueft → neu uebersetzen.
* Hash veraendert, Fassung GEPRUEFT → stehen lassen. Die Zeile behaelt ihren
  alten Hash und ist genau daran als veraltet erkennbar. Eine von Hand
  korrigierte Fassung lautlos zu ueberschreiben waere stiller Datenverlust.

Ein Aufruf je Sprache, nicht einer fuer alle — dieselbe Begruendung wie in
``site_config.seiten_uebersetzung``: bricht eine Antwort ab, kostet das nur ihre
eigene Sprache, nicht die 22 anderen. Bei zwei kurzen Feldern ist der
Preisunterschied Bruchteile eines Cents.
"""
from __future__ import annotations

import hashlib
import json
from collections.abc import Callable

from pydantic import BaseModel, Field
from supabase import Client

from src.core.ki import KiAntwort, KiError, VertexClient
from src.core.logging import get_logger
from src.core.mail_sprache import aufloesen
from src.features.site_config.ki_texte import (
    ohne_umrandung,
    sprache_benennen,
)

log = get_logger("nextdays.tasks.regel_uebersetzung")

#: Die uebersetzbaren Felder einer Regel.
#:
#: NUR der Name. `description` bleibt bewusst draussen: sie ist ein internes
#: Arbeitsdetail („Morten", „1.10.-31.3.", „linned, barnestol eller barneseng"),
#: das nirgends als Beschriftung erscheint — und live ist sie in einer ANDEREN
#: Sprache verfasst als der Name derselben Regel („Reng T" mit „Endreinigung",
#: 31.08.2026). Beide Felder aus einer Ausgangssprache zu uebersetzen hiesse,
#: die Haelfte falsch zu behandeln.
#:
#: Die Reihenfolge ist Teil des Hashes und darf sich NICHT aendern, ohne dass
#: jede Fassung als veraltet gilt. Ein neues Feld gehoert HINTEN angehaengt.
FELDER: tuple[str, ...] = ("name",)

#: Harte Obergrenze je Feld (Wurzel 8). Ein Regelname ist eine Zeile; ein Feld
#: darueber ist ein Datenfehler und kein Uebersetzungsauftrag.
MAX_FELD_ZEICHEN = 500

#: PostgREST bekommt `in_`-Listen ueber die URL — in Bloecken wie ueberall.
_BLOCK = 100


class TaskRegelUebersetzungError(Exception):
    """Der Lauf kann so nicht starten (kaputte Eingabe, fehlende Sprache)."""


class RegelFassung(BaseModel):
    """Eine Sprachfassung eines Regelnamens."""

    sprache: str
    name: str
    geprueft: bool = False
    #: True, wenn die Fassung aus einem anderen Quelltext entstand als dem
    #: aktuellen. Nur bei GEPRUEFTEN Fassungen moeglich — ungepruefte werden
    #: neu uebersetzt statt markiert.
    veraltet: bool = False


class RegelUebersetzungsLauf(BaseModel):
    """Was ein Lauf getan hat. Jede Zahl ist eine eigene Aussage —
    „12 uebersetzt" und „12 unveraendert" sind sehr verschiedene Ergebnisse."""

    uebersetzt: list[str] = Field(default_factory=list)
    unveraendert: list[str] = Field(default_factory=list)
    geschuetzt: list[str] = Field(default_factory=list)
    fehlgeschlagen: dict[str, str] = Field(default_factory=dict)


def quelle_hash(regel: dict) -> str:
    """Fingerabdruck der Quellfelder einer Regel.

    Bewusst NICHT ``updated_at``: der Zeitstempel aendert sich auch, wenn nur
    ein Trigger verstellt wurde — dann waeren alle 23 Fassungen grundlos
    veraltet und ein Lauf kostete 23 Aufrufe fuer nichts.
    """
    roh = "".join(str(regel.get(f) or "") for f in FELDER)
    return hashlib.sha256(roh.encode("utf-8")).hexdigest()


def _felder_pruefen(regel: dict) -> None:
    """Zu lange Felder sind ein Datenfehler, kein Uebersetzungsauftrag."""
    for feld in FELDER:
        wert = regel.get(feld)
        if isinstance(wert, str) and len(wert) > MAX_FELD_ZEICHEN:
            msg = (
                f"Feld „{feld}“ der Regel ist mit {len(wert)} Zeichen zu lang "
                f"(Grenze {MAX_FELD_ZEICHEN})."
            )
            raise TaskRegelUebersetzungError(msg)


def _antwort_lesen(text: str, ziel: str) -> dict[str, str | None]:
    """Die Modellantwort als flaches Objekt lesen.

    Ein Modell, das statt JSON eine Erklaerung schickt, ist ein Fehler dieser
    einen Sprache — er wird benannt und nicht verschluckt (Wurzel 5).
    """
    roh = ohne_umrandung(text or "")
    try:
        daten = json.loads(roh)
    except json.JSONDecodeError as exc:
        msg = f"Antwort fuer {ziel} ist kein JSON: {exc}"
        raise TaskRegelUebersetzungError(msg) from exc
    if not isinstance(daten, dict):
        msg = f"Antwort fuer {ziel} ist kein Objekt."
        raise TaskRegelUebersetzungError(msg)
    out: dict[str, str | None] = {}
    for feld in FELDER:
        wert = daten.get(feld)
        out[feld] = wert.strip() if isinstance(wert, str) and wert.strip() else None
    if not out.get("name"):
        # Ohne Namen ist die Fassung wertlos: die Oberflaeche zeigte eine leere
        # Beschriftung. Lieber diese Sprache als fehlgeschlagen fuehren.
        msg = f"Antwort fuer {ziel} enthaelt keinen Namen."
        raise TaskRegelUebersetzungError(msg)
    return out


def _in_eine_sprache(
    client: VertexClient, regel: dict, quelle: str, ziel: str
) -> tuple[dict[str, str | None], KiAntwort]:
    """Den Regelnamen in EINE Zielsprache uebersetzen."""
    quelle_name = sprache_benennen(quelle)
    ziel_name = sprache_benennen(ziel)
    eingabe = {
        f: regel[f]
        for f in FELDER
        if isinstance(regel.get(f), str) and regel[f].strip()
    }
    system = "\n".join(
        [
            f"Du uebersetzt Beschriftungen aus einer Hausverwaltungs-Software "
            f"nach {ziel_name}.",
            f"Ausgangssprache: {quelle_name}. Zielsprache: {ziel_name}.",
            "",
            "Es sind Namen von Arbeitsauftraegen an Ferienunterkuenften: "
            "Reinigung, Anreisevorbereitung, Waeschewechsel, Gartenpflege, "
            "Handwerkerrunden.",
            "",
            # Die Kuerzel sind der eigentliche Grund fuer dieses Modul. „Reng
            # T ist keine Vokabel, sondern eine betriebsinterne Abkuerzung —
            # das Modell muss sie ausschreiben duerfen, sonst kaeme dieselbe
            # unverstaendliche Abkuerzung wieder heraus.
            "Viele Namen sind betriebsinterne ABKUERZUNGEN (etwa Reng fuer "
            "daenisch rengoering = Reinigung, Velk fuer velkomst = "
            "Willkommen/Anreise). Schreibe sie in der Zielsprache "
            "VERSTAENDLICH aus.",
            "",
            # Ohne diese Regel verschwinden die Objektgruppen-Kuerzel, und zwei
            # Regeln, die sich NUR darin unterscheiden (Reng T / Reng J),
            # bekaemen denselben Namen — die Auswahl waere nicht mehr eindeutig.
            "Anhaengsel, die nur eine Gruppe oder Nummer bezeichnen (einzelne "
            "Buchstaben wie T oder J, Zahlen, Zeitraeume wie 4-uger), bleiben "
            "ERHALTEN: zwei Regeln duerfen nicht denselben Namen bekommen.",
            "Eigennamen, Ortsnamen und Marken bleiben unveraendert.",
            "Halte die Laenge im Rahmen des Originals — es ist eine "
            "Beschriftung, kein Satz.",
            "",
            'Antworte AUSSCHLIESSLICH mit einem flachen JSON-Objekt der '
            'Form {"name": "..."}. Kein Codeblock, keine Erklaerung.',
        ]
    )
    user = json.dumps(eingabe, ensure_ascii=False, indent=2)
    # Grob vier Zeichen je Token, verdoppelt fuer Zielsprache und JSON-Rahmen.
    # Boden 256: zwei kurze Beschriftungen brauchen nicht mehr, und ein zu
    # knappes Budget erzeugt MAX_TOKENS, was den Aufruf ganz kostet.
    laenge = sum(len(v) for v in eingabe.values())
    budget = min(1024, max(256, (laenge // 4) * 6))
    antwort = client.erzeuge(
        system=system, user=user, temperature=0.2, max_tokens=budget
    )
    return _antwort_lesen(antwort.text, ziel), antwort


def _fassungen_lesen(db: Client, rule_id: str) -> dict[str, dict]:
    """Die vorhandenen Fassungen dieser Regel, je Sprache."""
    rows = (
        db.table("task_rule_translations")
        .select("sprache, name, geprueft, quelle_hash")
        .eq("rule_id", rule_id)
        .execute()
    ).data or []
    return {str(r["sprache"]): r for r in rows}


def regel_uebersetzen(
    client: VertexClient,
    db: Client,
    regel: dict,
    ziele: list[str],
    deckel: Callable[[], None] | None = None,
) -> tuple[RegelUebersetzungsLauf, list[KiAntwort]]:
    """Eine Regel in alle Zielsprachen bringen.

    Gibt zurueck, was getan wurde, und die Modellantworten — die braucht der
    Aufrufer zum Buchen der Nutzung.

    Ein Fehler in EINER Sprache beendet den Lauf nicht: er steht benannt in
    ``fehlgeschlagen``, die uebrigen laufen weiter. Ein einzelner 502 darf nicht
    22 gelungene Fassungen kosten — und er darf auch nicht verschluckt werden
    (Wurzel 5).

    ``deckel`` wird VOR JEDEM Modellaufruf gerufen und darf werfen. Ein
    einmaliger Check vor dem Lauf waere eine Attrappe: ein Lauf ueber 23
    Sprachen sind 23 Aufrufe.
    """
    _felder_pruefen(regel)
    rule_id = str(regel["id"])
    quelle = str(regel.get("quellsprache") or "").strip()
    if not quelle:
        # Kein Raten (siehe Modulkopf). Laut melden, damit es behebbar ist —
        # ein stiller Uebersprung sieht aus wie „nichts zu tun".
        log.warning(
            "regel_ohne_quellsprache",
            rule_id=rule_id,
            name=str(regel.get("name") or ""),
        )
        msg = (
            "Die Regel hat keine Ausgangssprache. Ohne sie waere jede "
            "Uebersetzung geraten — bitte die Sprache an der Regel angeben."
        )
        raise TaskRegelUebersetzungError(msg)

    hash_jetzt = quelle_hash(regel)
    vorhanden = _fassungen_lesen(db, rule_id)
    uebersetzt: list[str] = []
    unveraendert: list[str] = []
    geschuetzt: list[str] = []
    fehlgeschlagen: dict[str, str] = {}
    antworten: list[KiAntwort] = []

    for ziel in ziele:
        if ziel == quelle:
            # Die Ausgangssprache steht in `task_rules` selbst. Eine Fassung
            # dafuer waere eine zweite Wahrheit ueber denselben Text.
            continue
        alt = vorhanden.get(ziel)
        if alt and alt.get("quelle_hash") == hash_jetzt:
            unveraendert.append(ziel)
            continue
        if alt and alt.get("geprueft"):
            # Menschlich verantwortet: nicht anfassen. Sie behaelt ihren alten
            # Hash und ist genau daran als veraltet erkennbar.
            geschuetzt.append(ziel)
            continue
        if deckel is not None:
            deckel()
        try:
            felder, antwort = _in_eine_sprache(client, regel, quelle, ziel)
        except (KiError, TaskRegelUebersetzungError) as exc:
            # Genau die zwei erwartbaren Fehlerarten, spezifisch gefangen: ein
            # breites `except` verschluckte hier auch den Deckel (Wurzel 5).
            fehlgeschlagen[ziel] = str(exc)
            continue
        antworten.append(antwort)
        db.table("task_rule_translations").upsert(
            {
                "rule_id": rule_id,
                "sprache": ziel,
                "name": felder["name"],
                "geprueft": False,
                "quelle_hash": hash_jetzt,
            },
            on_conflict="rule_id,sprache",
        ).execute()
        uebersetzt.append(ziel)

    lauf = RegelUebersetzungsLauf(
        uebersetzt=uebersetzt,
        unveraendert=unveraendert,
        geschuetzt=geschuetzt,
        fehlgeschlagen=fehlgeschlagen,
    )
    log.info(
        "task_regel_uebersetzt",
        rule_id=rule_id,
        quelle=quelle,
        uebersetzt=len(uebersetzt),
        unveraendert=len(unveraendert),
        geschuetzt=len(geschuetzt),
        fehlgeschlagen=len(fehlgeschlagen),
    )
    return lauf, antworten


def lesersprache(db: Client, user_id: str, tenant_id: str | None) -> str:
    """In welcher Sprache DIESER Nutzer die Oberflaeche liest.

    Dieselbe Kette wie bei ausgehenden Mails (`core.mail_sprache`) und
    ausdruecklich derselbe Helfer — eine zweite Rangfolge daneben liefe beim
    naechsten Sonderfall auseinander:

      1. `users.preferred_language` — seine eigene Wahl.
      2. `tenants.default_language` — die Sprache des Betriebs.
      3. Englisch (nicht Deutsch: siehe `core.mail_sprache`).

    Es gibt bewusst KEINE Stufe „Accept-Language des Requests". Sie waere hier
    verlockend, weil der Leser ja gerade selbst am Rechner sitzt — aber der
    Browser einer geteilten Rezeptionsmaschine sagt nichts ueber die Person aus,
    und die Oberflaeche selbst richtet sich schon nach der gespeicherten Wahl.
    Zwei verschiedene Quellen fuer dieselbe Frage ergaeben eine Seite, deren
    Beschriftungen aus zwei Sprachen gemischt sind.
    """
    eigen = (
        db.table("users")
        .select("preferred_language")
        .eq("id", user_id)
        .limit(1)
        .execute()
    ).data or []
    betrieb: list[dict] = []
    if tenant_id:
        betrieb = (
            db.table("tenants")
            .select("default_language")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
    return aufloesen(
        eigen[0].get("preferred_language") if eigen else None,
        betrieb[0].get("default_language") if betrieb else None,
    )


def namen_in_sprache(
    db: Client, rule_ids: list[str], sprache: str
) -> dict[str, str]:
    """Die Regelnamen in EINER Sprache — der Lesepfad der Oberflaechen.

    Rueckgabe: ``{rule_id: name}``, aber NUR fuer Regeln, die eine Fassung in
    dieser Sprache haben. Wer keine hat, fehlt in der Karte — der Aufrufer
    faellt dann auf ``task_rules.name`` zurueck. Hier einen Ersatzwert
    einzusetzen hiesse, dem Aufrufer die Unterscheidung „uebersetzt" /
    „Original" zu nehmen (Wurzel 4).

    Gebuendelt fuer alle Regeln auf einmal: die Aufgabenliste zeigt Dutzende
    Zeilen, und eine Abfrage je Zeile waeren Dutzende Roundtrips.
    """
    if not rule_ids or not sprache:
        return {}
    out: dict[str, str] = {}
    ids = list(dict.fromkeys(str(r) for r in rule_ids if r))
    for start in range(0, len(ids), _BLOCK):
        block = ids[start : start + _BLOCK]
        rows = (
            db.table("task_rule_translations")
            .select("rule_id, name")
            .eq("sprache", sprache)
            .in_("rule_id", block)
            .execute()
        ).data or []
        for row in rows:
            name = str(row.get("name") or "").strip()
            if name:
                out[str(row["rule_id"])] = name
    return out
