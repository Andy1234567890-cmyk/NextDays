"""Eine ganze Website-Seite in ihre Sprachen uebersetzen (0476).

WOFUER
======
Die ABSCHNITTE einer Seite sind laengst mehrsprachig: ``site_blocks.content``
ist jsonb mit einer Sprachkarte je Feld. Die SEITE selbst war es nicht — Titel,
Meta-Titel, Meta-Beschreibung, Schlagwoerter, Anrisstext und Bild-Alternativtext
lagen einsprachig in ``site_pages``. Ein daenischer Gast las damit uebersetzte
Inhalte unter einem deutschen Menuepunkt, mit deutschem ``<title>``.

Das ist kein Schoenheitsfehler, sondern der Grund, warum die Sprachfassung kein
Ranking bekam: was in der Trefferliste steht, sind Titel und Beschreibung.

WIE DER LAUF ARBEITET
=====================
Ausgangssprache ist die Standardsprache der Website
(``tenant_site_config.default_language``), Zielsprachen sind die uebrigen
gefuehrten Sprachen. Je Zielsprache entsteht EINE Zeile in
``site_page_translations``.

Der ``quelle_hash`` entscheidet, was passiert — er ist der Fingerabdruck der
sechs Quellfelder:

* Hash unveraendert  → NICHTS. Kein Modellaufruf. Das ist die Idempotenz
  (Wurzel 2): Doppelklick auf Speichern, ein Retry nach Zeitueberschreitung
  oder ein zweiter Lauf ueber dieselbe Seite kosten nichts.
* Hash veraendert, Fassung NICHT geprueft → neu uebersetzen und ueberschreiben.
  Das ist der Auftrag „wenn jemand den Text aendert, wird ueberall
  aktualisiert".
* Hash veraendert, Fassung GEPRUEFT → stehen lassen. Die Zeile behaelt ihren
  alten ``quelle_hash``, und genau daran erkennt die Oberflaeche sie als
  veraltet. Eine von Hand korrigierte Fassung lautlos zu ueberschreiben waere
  stiller Datenverlust — derselbe Fehler wie ein verschluckter Exception
  (Wurzel 5), nur schwerer zu bemerken, weil das Ergebnis plausibel aussieht.

WARUM EIN AUFRUF JE SPRACHE UND NICHT EINER FUER ALLE
=====================================================
Ein einziger Aufruf mit 23 Zielsprachen waere billiger, aber er hat einen
Fehlermodus, der alles kostet: bricht die Antwort in der Mitte ab oder ist ihr
JSON schief, ist der ganze Lauf verloren. Je Sprache ein Aufruf heisst, dass
eine misslungene Sprache nur sich selbst kostet — die anderen 22 stehen. Bei
2776 Zeichen Gesamtinhalt (live gemessen am 26.08.2026) ist der Preisunterschied
Bruchteile eines Cents.

WAS HIER NICHT PASSIERT
=======================
Der ``slug`` wird NICHT uebersetzt. Er ist die Adresse, und eine uebersetzte
Adresse braucht den Gegenzustand, den es noch nicht gibt: eine Slug-Aenderung
legt heute keine Weiterleitung an (Wurzel 1). Die eigene URL je Sprache
entsteht ueber das Pfad-Praefix (``/da/kontakt``); fuer das Ranking genuegt das.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from datetime import UTC, datetime

from pydantic import BaseModel, Field
from supabase import Client

from src.core.ki import KiAntwort, KiError, VertexClient
from src.core.logging import get_logger

from .fehler import SiteConfigError
from .ki_profil import KiProfil
from .ki_texte import (
    ohne_umrandung,
    sprache_benennen,
    system_grundregeln,
)

log = get_logger(__name__)

#: Die uebersetzbaren Felder einer Seite, in fester Reihenfolge.
#:
#: Die Reihenfolge ist Teil des Hashes und darf sich deshalb NICHT aendern,
#: ohne dass jede Fassung als veraltet gilt. Wer ein Feld ergaenzt, haengt es
#: HINTEN an — dann veraltet nur, was das neue Feld wirklich fuellt.
FELDER: tuple[str, ...] = (
    "title",
    "seo_title",
    "seo_description",
    "seo_keywords",
    "excerpt",
    "og_image_alt",
)

#: Nur `title` ist Pflicht (er ist der Menuepunkt und die <h1>). Die uebrigen
#: duerfen fehlen; der Renderer faellt dann auf das Original zurueck, was bei
#: Metadaten zulaessig ist — Google bewertet den Hauptinhalt.
PFLICHTFELD = "title"

#: Harte Obergrenze je Feld. Dieselbe Groesse wie `ki_texte.MAX_EINGABE_ZEICHEN`
#: waere zu viel: ein Meta-Titel ist eine Zeile, kein Aufsatz. Ein Feld darueber
#: ist ein Datenfehler und kein Uebersetzungsauftrag (Wurzel 8: jeder
#: unbegrenzte Bereich bekommt eine Grenze).
MAX_FELD_ZEICHEN = 2_000


class SeitenFassung(BaseModel):
    """Eine Sprachfassung der Seitenfelder."""

    sprache: str
    title: str
    seo_title: str | None = None
    seo_description: str | None = None
    seo_keywords: str | None = None
    excerpt: str | None = None
    og_image_alt: str | None = None
    geprueft: bool = False
    #: True, wenn diese Fassung aus einem anderen Quelltext entstand als dem
    #: aktuellen. Nur bei geprueften Fassungen moeglich — ungepruefte werden
    #: neu uebersetzt statt markiert.
    veraltet: bool = False


class UebersetzungsLauf(BaseModel):
    """Was ein Lauf getan hat. Jede Zahl ist eine eigene Aussage."""

    uebersetzt: list[str] = Field(default_factory=list)
    unveraendert: list[str] = Field(default_factory=list)
    geschuetzt: list[str] = Field(default_factory=list)
    fehlgeschlagen: dict[str, str] = Field(default_factory=dict)


def quelle_hash(seite: dict) -> str:
    """Fingerabdruck der sechs Quellfelder einer Seite.

    ``json.dumps`` mit fester Reihenfolge und nicht etwa ein zusammengeklebter
    String: ``"a" + "bc"`` und ``"ab" + "c"`` waeren sonst derselbe Hash, und
    ein Feldwechsel bliebe unbemerkt.
    """
    werte = {f: (seite.get(f) or "") for f in FELDER}
    roh = json.dumps(werte, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(roh.encode("utf-8")).hexdigest()


def _felder_pruefen(seite: dict) -> None:
    """Quelle brauchbar? Sonst 422 statt eines Laufs, der nichts uebersetzt."""
    titel = (seite.get(PFLICHTFELD) or "").strip()
    if not titel:
        raise SiteConfigError(
            "Die Seite hat keinen Titel — es gibt nichts zu uebersetzen.",
            status_code=422,
        )
    for feld in FELDER:
        wert = seite.get(feld)
        if isinstance(wert, str) and len(wert) > MAX_FELD_ZEICHEN:
            raise SiteConfigError(
                f"Das Feld {feld} ist zu lang ({len(wert)} Zeichen, "
                f"erlaubt sind {MAX_FELD_ZEICHEN}).",
                status_code=422,
            )


def _antwort_lesen(roh: str, sprache: str) -> dict[str, str | None]:
    """Die Modellantwort in Felder verwandeln.

    Erwartet ein flaches JSON-Objekt. Ein Modell verpackt seine Antwort gern in
    einen Codeblock — ``_ohne_umrandung`` raeumt das ab, das ist das Entfernen
    einer Verpackung und keine Erfindung.

    Unbekannte Schluessel werden VERWORFEN und nicht durchgereicht: was hier
    zurueckkommt, ist Fremd-Input (Wurzel 8), auch wenn wir selbst gefragt
    haben.
    """
    text = ohne_umrandung(roh)
    try:
        daten = json.loads(text)
    except json.JSONDecodeError as exc:
        raise KiError(
            f"Die Uebersetzung nach {sprache} kam nicht als JSON zurueck.",
            status_code=502,
        ) from exc
    if not isinstance(daten, dict):
        raise KiError(
            f"Die Uebersetzung nach {sprache} war kein Objekt.",
            status_code=502,
        )
    aus: dict[str, str | None] = {}
    for feld in FELDER:
        wert = daten.get(feld)
        if wert is None:
            aus[feld] = None
            continue
        if not isinstance(wert, str):
            # Eine Zahl oder Liste, wo Text stehen soll: verwerfen statt
            # umzuwandeln. `str(3)` waere ein Titel „3".
            aus[feld] = None
            continue
        gekuerzt = wert.strip()[:MAX_FELD_ZEICHEN]
        aus[feld] = gekuerzt or None
    return aus


def _eine_sprache(
    client: VertexClient,
    seite: dict,
    quelle: str,
    ziel: str,
    profil: KiProfil,
) -> tuple[dict[str, str | None], KiAntwort]:
    """Die sechs Felder in EINE Zielsprache uebersetzen."""
    quelle_name = sprache_benennen(quelle)
    ziel_name = sprache_benennen(ziel)
    # Nur die gefuellten Felder mitschicken. Ein leeres Feld zu uebersetzen
    # kostet Tokens und liefert im besten Fall wieder nichts — im schlechteren
    # erfindet das Modell einen Meta-Titel, den niemand geschrieben hat
    # (Wurzel 4).
    eingabe = {
        f: seite[f]
        for f in FELDER
        if isinstance(seite.get(f), str) and seite[f].strip()
    }
    system = "\n".join(
        [
            system_grundregeln(ziel_name, profil),
            "",
            "Du uebersetzt die Kopfangaben EINER Seite einer Unterkunfts-"
            "Website. Der Inhalt gehoert dem Betrieb — du aenderst die "
            "Sprache, nicht die Aussage.",
            f"Ausgangssprache: {quelle_name}. Zielsprache: {ziel_name}.",
            "",
            "Zahlen, Eigennamen, Ortsnamen, Marken und Adressen bleiben "
            "unveraendert stehen.",
            "`seo_title` und `seo_description` sind Suchmaschinen-Angaben: "
            "halte sie so kurz wie das Original, nicht laenger.",
            "`seo_keywords` ist eine kommagetrennte Liste und bleibt eine.",
            "",
            "Antworte AUSSCHLIESSLICH mit einem flachen JSON-Objekt, das "
            "genau die Schluessel der Eingabe traegt. Kein Codeblock, keine "
            "Erklaerung. Ein Feld, fuer das dir die Uebersetzung fehlt, "
            "laesst du weg — erfinde nichts.",
        ]
    )
    user = json.dumps(eingabe, ensure_ascii=False, indent=2)
    # Budget grob aus der Eingabe (etwa vier Zeichen je Token), verdoppelt fuer
    # die Zielsprache und den JSON-Rahmen, gedeckelt.
    laenge = sum(len(v) for v in eingabe.values())
    # Boden 512 statt 256, Faktor 4 statt 3.
    #
    # Die Rechnung „vier Zeichen je Token" gilt für lateinische Schrift; für
    # Griechisch und Bulgarisch liegt das Verhältnis deutlich schlechter. Dazu
    # kostet der JSON-Rahmen selbst Tokens (sechs Schlüsselnamen, Klammern,
    # Escapes), die in `laenge` gar nicht stecken — dort stehen nur die Werte.
    # Ein zu knappes Budget erzeugt `MAX_TOKENS`, und das kostet den Aufruf
    # ganz; großzügiger zu rechnen kostet Bruchteile eines Cents.
    budget = min(4096, max(512, (laenge // 4) * 4))
    antwort = client.erzeuge(
        system=system, user=user, temperature=0.2, max_tokens=budget
    )
    return _antwort_lesen(antwort.text, ziel), antwort


def _fassungen_lesen(db: Client, page_id: str) -> dict[str, dict]:
    """Die vorhandenen Fassungen dieser Seite, je Sprache."""
    rows = (
        db.table("site_page_translations")
        .select(
            "sprache, title, seo_title, seo_description, seo_keywords, "
            "excerpt, og_image_alt, geprueft, quelle_hash"
        )
        .eq("page_id", page_id)
        .execute()
    ).data or []
    return {str(r["sprache"]): r for r in rows}


def seite_uebersetzen(  # noqa: PLR0913 — sieben Angaben, keine davon optional
    client: VertexClient,
    db: Client,
    tenant_id: str,
    seite: dict,
    quelle: str,
    ziele: list[str],
    profil: KiProfil,
    deckel: Callable[[], None] | None = None,
) -> tuple[UebersetzungsLauf, list[KiAntwort]]:
    """Die Kopfangaben einer Seite in alle Zielsprachen bringen.

    Gibt zurueck, was getan wurde, und die Modellantworten — die braucht der
    Router zum Buchen der Nutzung. Die Antworten tragen Modell und Region;
    beides bleibt im Protokoll und geht NICHT an den Kunden hinaus.

    Ein Fehler in EINER Sprache beendet den Lauf nicht: er wird in
    ``fehlgeschlagen`` vermerkt, die uebrigen Sprachen laufen weiter. Ein
    einzelner 502 vom Modell darf nicht 22 gelungene Uebersetzungen kosten —
    und er darf auch nicht verschluckt werden (Wurzel 5), deshalb steht er
    benannt in der Antwort.

    ``deckel`` wird VOR JEDEM Modellaufruf gerufen und darf werfen. Ein
    einmaliger Check vor dem Lauf reicht hier nicht: ein Lauf ueber 23 Sprachen
    sind 23 Aufrufe, und ein Deckel, der nur den ersten davon sieht, laesst 22
    darueber hinaus zu — er waere eine Attrappe. Wirft er mitten im Lauf, bleibt
    stehen, was schon uebersetzt ist (die Zeilen sind einzeln geschrieben), und
    der Rest zaehlt als fehlgeschlagen.
    """
    _felder_pruefen(seite)
    page_id = str(seite["id"])
    hash_jetzt = quelle_hash(seite)
    vorhanden = _fassungen_lesen(db, page_id)
    # Lokale Listen und erst am Ende ein Modell: in die Felder eines
    # Pydantic-Modells hineinzuschreiben geht, ist aber schlechter zu lesen —
    # und `pylint` kann `default_factory` nicht aufloesen, sieht dort ein
    # `FieldInfo` und meldet zu Recht, dass das kein `append` kennt.
    uebersetzt: list[str] = []
    unveraendert: list[str] = []
    geschuetzt: list[str] = []
    fehlgeschlagen: dict[str, str] = {}
    antworten: list[KiAntwort] = []

    for ziel in ziele:
        if ziel == quelle:
            # Die Ausgangssprache steht in `site_pages` selbst. Eine Fassung
            # dafuer waere eine zweite Wahrheit ueber denselben Text.
            continue
        alt = vorhanden.get(ziel)
        if alt and alt.get("quelle_hash") == hash_jetzt:
            # Nichts hat sich geaendert. Kein Modellaufruf (Wurzel 2).
            unveraendert.append(ziel)
            continue
        if alt and alt.get("geprueft"):
            # Von Hand verantwortet. Der `quelle_hash` bleibt der ALTE — daran
            # erkennt die Oberflaeche, dass das Original weitergezogen ist.
            geschuetzt.append(ziel)
            continue
        try:
            if deckel is not None:
                deckel()
            felder, antwort = _eine_sprache(client, seite, quelle, ziel, profil)
        except (KiError, SiteConfigError) as exc:
            # BEIDE Fehlerarten, und das ist kein breites `except`:
            #
            # `KiError` kommt vom Modell (502, Zeitüberschreitung) oder vom
            # Tagesdeckel (429). `SiteConfigError` kommt aus
            # `sprache_benennen()`, wenn ein Sprachcode nicht im Katalog steht
            # — und der Weg dorthin ist offen: `tenant_site_config.languages`
            # prüft gegen einen ANDEREN Katalog als `core.languages`.
            #
            # Vorher fing die Schleife nur `KiError`. Sprache 7 von 23 warf
            # dann, die Schleife brach ab, und der Router machte daraus eine
            # reine Fehlerantwort — obwohl SECHS Zeilen längst geschrieben
            # waren. Der Betrieb sah einen Fehlschlag und hatte in Wahrheit
            # sechs fertige Fassungen, von denen ihm niemand erzählte
            # (Wurzel 5: halber Zustand ohne Auskunft).
            fehlgeschlagen[ziel] = exc.message
            log.warning(
                "seiten_uebersetzung_fehler",
                extra={"page_id": page_id, "sprache": ziel, "grund": exc.message},
            )
            continue
        # Abgeschnitten? Dann NICHT speichern.
        #
        # `MAX_TOKENS` heißt: das Modell war mitten im Satz am Budget. Meistens
        # ist das JSON dann kaputt und `_antwort_lesen` wirft ohnehin — aber
        # nicht immer: liefert das Modell die Felder in günstiger Reihenfolge
        # und nur der letzte Wert bricht ab, kommt gültiges JSON mit einem
        # halben Satz zurück.
        #
        # Diese Zeile zu speichern wäre der schlimmere Fall: sie bekäme den
        # aktuellen `quelle_hash`, gälte damit beim nächsten Lauf als AKTUELL
        # und würde nie wieder angefasst. Die Idempotenz, die doppelte Kosten
        # verhindern soll, zementierte den Fehler dauerhaft.
        if antwort.abschlussgrund == "MAX_TOKENS":
            fehlgeschlagen[ziel] = "Die Übersetzung wurde abgeschnitten."
            log.warning(
                "seiten_uebersetzung_abgeschnitten",
                extra={"page_id": page_id, "sprache": ziel},
            )
            continue
        titel = felder.get(PFLICHTFELD)
        if not titel:
            # Ohne Titel keine Zeile: die NOT-NULL-Spalte wuerde werfen, und
            # eine Fassung ohne Menuepunkt waere ein unsichtbarer Link.
            fehlgeschlagen[ziel] = "Ohne Titel zurueckgekommen."
            continue
        antworten.append(antwort)
        try:
            db.table("site_page_translations").upsert(
                {
                    "page_id": page_id,
                    "tenant_id": tenant_id,
                    "sprache": ziel,
                    **{f: felder.get(f) for f in FELDER},
                    "title": titel,
                    "geprueft": False,
                    "quelle_hash": hash_jetzt,
                },
                on_conflict="page_id,sprache",
            ).execute()
        except Exception as exc:  # noqa: BLE001 — siehe Begründung
            # Ein DB-Fehler beim Schreiben EINER Sprache darf die übrigen 22
            # nicht kosten. Breit gefangen, weil der Supabase-Client je nach
            # Ursache verschiedene Typen wirft (APIError, httpx-Fehler) und ein
            # unvollständiger Katalog hier genau das Gegenteil bewirken würde.
            #
            # Das ist KEIN verschluckter Fehler: er steht benannt in
            # `fehlgeschlagen`, geht als Warnung ins Log, und der Modellaufruf
            # ist schon in `antworten` — er wird also gebucht und bezahlt, was
            # er auch wurde.
            fehlgeschlagen[ziel] = "Konnte nicht gespeichert werden."
            log.warning(
                "seiten_uebersetzung_schreibfehler",
                extra={
                    "page_id": page_id,
                    "sprache": ziel,
                    "grund": str(exc)[:200],
                },
            )
            continue
        uebersetzt.append(ziel)

    lauf = UebersetzungsLauf(
        uebersetzt=uebersetzt,
        unveraendert=unveraendert,
        geschuetzt=geschuetzt,
        fehlgeschlagen=fehlgeschlagen,
    )
    log.info(
        "seiten_uebersetzung",
        extra={
            "page_id": page_id,
            "uebersetzt": len(uebersetzt),
            "unveraendert": len(unveraendert),
            "geschuetzt": len(geschuetzt),
            "fehlgeschlagen": len(fehlgeschlagen),
        },
    )
    return lauf, antworten


def fassungen_fuer_seite(
    db: Client, page_id: str, seite: dict
) -> list[SeitenFassung]:
    """Alle Fassungen einer Seite — fuer die Oberflaeche des Baukastens.

    ``veraltet`` wird HIER berechnet und nicht gespeichert: es ist eine Aussage
    ueber das Verhaeltnis zweier Werte, und ein gespeichertes Flag muesste bei
    jeder Textaenderung der Seite mitgepflegt werden (Wurzel 1). Der Vergleich
    kostet nichts.
    """
    hash_jetzt = quelle_hash(seite)
    aus: list[SeitenFassung] = []
    for sprache, row in sorted(_fassungen_lesen(db, page_id).items()):
        aus.append(
            SeitenFassung(
                sprache=sprache,
                title=row["title"],
                seo_title=row.get("seo_title"),
                seo_description=row.get("seo_description"),
                seo_keywords=row.get("seo_keywords"),
                excerpt=row.get("excerpt"),
                og_image_alt=row.get("og_image_alt"),
                geprueft=bool(row.get("geprueft")),
                veraltet=row.get("quelle_hash") != hash_jetzt,
            )
        )
    return aus


def fassung_schreiben(
    db: Client,
    tenant_id: str,
    seite: dict,
    eingabe: dict,
    user_id: str | None,
) -> SeitenFassung:
    """Eine Sprachfassung von Hand setzen und damit SCHUETZEN.

    Der Gegenpol zum maschinellen Lauf: diese Zeile bekommt ``geprueft = true``
    und ist danach fuer jeden automatischen Lauf unerreichbar.

    Ohne diesen Weg waere `geprueft` eine Spalte, die nie `true` wird — der
    ganze Schutzmechanismus, seine Kommentare und der halbe Migrationskopf
    haetten dann keinen Auslöser gehabt.

    Der ``quelle_hash`` wird auf den AKTUELLEN Stand der Seite gesetzt: wer von
    Hand korrigiert, hat den Text vor sich, den es gerade gibt. Aendert sich
    das Original spaeter, weicht der Hash ab, und `fassungen_fuer_seite` meldet
    die Zeile als veraltet — sichtbar, aber unangetastet.
    """
    sprache = str(eingabe.get("sprache") or "")
    # Wirft 422 bei unbekanntem Code, KEIN Rueckfall (Wurzel 4).
    sprache_benennen(sprache)
    titel = (eingabe.get("title") or "").strip()
    if not titel:
        raise SiteConfigError(
            "Eine Fassung ohne Titel gibt es nicht — er ist der Menuepunkt.",
            status_code=422,
        )
    zeile = {
        "page_id": str(seite["id"]),
        "tenant_id": tenant_id,
        "sprache": sprache,
        **{
            f: ((eingabe.get(f) or "").strip() or None)
            for f in FELDER
            if f != PFLICHTFELD
        },
        "title": titel,
        "geprueft": True,
        "geprueft_von": user_id,
        # Echter Zeitstempel und nicht der String "now()": PostgREST wertet
        # "now()" zwar aus, aber `announcement_translations` — das
        # Schwestermodul mit demselben `geprueft`-Muster — schreibt einen
        # ISO-Wert. Zwei Schreibweisen für dieselbe Sache sind der Anfang von
        # zwei Verhaltensweisen.
        "geprueft_am": datetime.now(UTC).isoformat(),
        "quelle_hash": quelle_hash(seite),
    }
    db.table("site_page_translations").upsert(
        zeile, on_conflict="page_id,sprache"
    ).execute()
    log.info(
        "seiten_fassung_geprueft",
        extra={"page_id": str(seite["id"]), "sprache": sprache},
    )
    return SeitenFassung(
        sprache=sprache,
        title=titel,
        seo_title=zeile.get("seo_title"),
        seo_description=zeile.get("seo_description"),
        seo_keywords=zeile.get("seo_keywords"),
        excerpt=zeile.get("excerpt"),
        og_image_alt=zeile.get("og_image_alt"),
        geprueft=True,
        veraltet=False,
    )
