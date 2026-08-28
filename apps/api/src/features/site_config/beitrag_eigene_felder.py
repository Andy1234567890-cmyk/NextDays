"""EIGENE Beitragsfelder eines Betriebs (0485) — Framers Reiter „Fields".

Grundlage: `docs/FRAMER-CMS-ANALYSE.md` und der Abgleich vom 28.08.2026. Im
Vorbild listet der Reiter „Fields" über einem Trenner die Systemfelder (Titel,
Status, Bild, Schalter, Slug) und darunter die frei anlegbaren — jedes mit
Typsymbol, ziehbar, mit `+` zum Anlegen.

WAS DIESES MODUL IST — UND WAS NICHT
====================================
Es legt FELDER an einem Blogbeitrag an. Es legt KEINE Sammlung an: es gibt
weiterhin genau einen Inhaltstyp mit eigener Adresse (`/blog/<slug>`), eine
Übersicht und einen Renderer. Diese Grenze steht seit 0481 und bleibt.

Die Trennung zu `beitrag_felder.py` ist die zwischen KONFIGURIEREN und
ANLEGEN:

    beitrag_felder.py        wie ein EINGEBAUTES Feld heisst und sich verhält
    beitrag_eigene_felder.py welche ZUSÄTZLICHEN Felder es überhaupt gibt

Beide teilen dieselbe Einstellungsfläche (Name, Beschreibung, Platzhalter,
Maximallänge, Pflicht, mehrzeilig, versteckt). Das ist Absicht: zwei Sorten
Feld mit zwei Sorten Einstellungen wären für den Betrieb ein Unterschied ohne
Grund.

WO DIE WERTE LIEGEN
===================
In `site_pages.post_custom` (jsonb, 0485) — Schlüssel = `feld_key`. Warum kein
Entity-Attribute-Value-Tabellenpaar, steht in der Migration.

SCOPE (Wurzel 3)
================
Die Service-Rolle umgeht RLS. Jede Funktion hier trägt deshalb `tenant_id` in
JEDER Bedingung — auch beim Löschen, wo ein vergessener Scope die Felder jedes
anderen Betriebs mitnähme.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator
from supabase import Client

from .beitrag_felder import BEITRAG_FELDER

#: Wie viele eigene Felder ein Betrieb anlegen darf.
#:
#: Ein Deckel und kein „so viele wie du willst" (Wurzel 8: jeder unbegrenzte
#: Bereich bekommt eine harte Obergrenze). 30 ist grosszügig — das Vorbild
#: kommt in seiner Beispielsammlung mit 24 Feldern aus, und jedes zusätzliche
#: Feld ist eine weitere Spalte in einer Tabelle, die schon 5 400 px breit ist.
MAX_EIGENE_FELDER = 30

#: Die Feldarten. Deckungsgleich mit `FeldArt` in
#: `web/components/website/blog/felder.ts` und mit dem CHECK in 0485.
#:
#: `richtext` fehlt bewusst: ein zweiter Fliesstext neben dem Beitragstext wäre
#: ein zweiter Ort für denselben Inhalt, und der Renderer hätte keine Stelle,
#: ihn zu zeigen.
ERLAUBTE_ARTEN: frozenset[str] = frozenset(
    {"text", "zahl", "datum", "schalter", "liste", "link", "bild", "galerie"}
)

#: Schlüssel, die schon etwas anderes bedeuten. Ein eigenes Feld darf keinen
#: davon tragen — sonst stünden zwei Felder mit demselben Schlüssel in
#: derselben Maske, und welches gewinnt, entschiede die Reihenfolge einer
#: Liste (Wurzel 2).
#:
#: Neben den eingebauten Beitragsfeldern sind das die Spalten, die die Tabelle
#: selbst führt: Titel, Status, Adresse, Aufrufe, Erstellt, Zuletzt geändert.
GESPERRTE_SCHLUESSEL: frozenset[str] = BEITRAG_FELDER | frozenset(
    {"title", "status", "slug", "views", "created", "updated"}
)

_KEY_MUSTER = re.compile(r"^[a-z][a-z0-9_]{0,39}$")

_SPALTEN = (
    "id, feld_key, label, art, position, beschreibung, platzhalter, "
    "max_zeichen, pflicht, mehrzeilig, versteckt, standard_wert, standard_feld"
)

#: Feldarten OHNE Vorgabewert (0486) — dieselbe Regel wie bei den eingebauten
#: Feldern, nur nach ART statt nach Schlüssel: ein Schalter hat schon einen
#: Grundzustand, ein Bild und eine Liste sind keine Eingabe, die man
#: vorschreiben könnte. Eine Vorgabe daran wäre eine Attrappe.
ARTEN_OHNE_VORGABE: frozenset[str] = frozenset(
    {"schalter", "bild", "galerie", "liste"}
)


class EigenesFeldNeu(BaseModel):
    """Ein neues eigenes Feld: Schlüssel, Name, Art. Mehr braucht es nicht.

    Alles Weitere (Beschreibung, Platzhalter, Pflicht …) wird danach über
    dieselbe Maske eingestellt wie bei einem eingebauten Feld. Ein Anlegen-
    Formular mit acht Feldern hielte niemanden davon ab, sieben davon leer zu
    lassen — es verzögert nur.
    """

    feld_key: str = Field(max_length=40)
    label: str = Field(min_length=1, max_length=60)
    art: str

    @field_validator("feld_key")
    @classmethod
    def _schluessel(cls, v: str) -> str:
        """Form und Kollisionen prüfen — 422 statt stiller Umformung.

        Ein automatisch aus dem Namen erzeugter Schlüssel wäre bequem und
        falsch: der Schlüssel ist nach dem Anlegen unveränderlich (er steht in
        jeder Beitragszeile), also muss der Betrieb ihn sehen, bevor er gilt.
        """
        wert = v.strip().lower()
        if not _KEY_MUSTER.match(wert):
            raise ValueError(
                "Der Schlüssel muss mit einem Kleinbuchstaben beginnen und "
                "darf nur a–z, 0–9 und _ enthalten (höchstens 40 Zeichen)."
            )
        if wert in GESPERRTE_SCHLUESSEL:
            raise ValueError(
                f"'{wert}' ist schon der Schlüssel eines eingebauten Feldes. "
                "Bitte einen anderen wählen."
            )
        return wert

    @field_validator("art")
    @classmethod
    def _art(cls, v: str) -> str:
        if v not in ERLAUBTE_ARTEN:
            erlaubt = ", ".join(sorted(ERLAUBTE_ARTEN))
            raise ValueError(f"Unbekannte Feldart '{v}'. Erlaubt: {erlaubt}.")
        return v


class EigenesFeldPatch(BaseModel):
    """Was sich an einem eigenen Feld ändern lässt.

    `feld_key` und `art` stehen NICHT darin, und zwar aus verschiedenen
    Gründen:

      * Der SCHLÜSSEL ist die Adresse des Wertes in jeder Beitragszeile. Ihn zu
        ändern wäre ein Datenumzug über alle Beiträge — und ein misslungener
        Umzug hiesse: die Werte sind noch da, aber unter einem Namen, den
        niemand mehr liest.
      * Die ART entscheidet, wie der Wert gespeichert ist (Text, Zahl, Liste).
        Ein Wechsel von `liste` auf `zahl` liesse in jeder Zeile einen Wert
        stehen, den der neue Typ nicht lesen kann. Wer die Art ändern will,
        legt ein neues Feld an — dann sieht er, dass die alten Werte nicht
        mitkommen (Wurzel 4: kein plausibler Ersatz für Daten, die nicht
        passen).
    """

    label: str | None = Field(default=None, max_length=60)
    position: int | None = Field(default=None, ge=0, le=999)
    beschreibung: str | None = Field(default=None, max_length=300)
    platzhalter: str | None = Field(default=None, max_length=120)
    max_zeichen: int | None = Field(default=None, ge=1, le=10000)
    pflicht: bool | None = None
    mehrzeilig: bool | None = None
    versteckt: bool | None = None
    #: Fester Vorgabewert (0486).
    standard_wert: str | None = Field(default=None, max_length=500)
    #: Vorgabe abgeleitet aus einem anderen Feld (Framers „Based on"). Ob es
    #: dieses Feld gibt, prüft `feld_aendern` — die Feldliste steht teils im
    #: Code und teils in dieser Tabelle, ein Validator ohne DB kann sie nicht
    #: kennen.
    standard_feld: str | None = Field(default=None, max_length=40)

    @field_validator("label", "beschreibung", "platzhalter", "standard_wert")
    @classmethod
    def _leer_ist_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        sauber = v.strip()
        return sauber or None


class EigenesFeld(BaseModel):
    """Ein eigenes Feld, wie das Dashboard es liest."""

    id: str
    feld_key: str
    label: str
    art: str
    position: int = 0
    beschreibung: str | None = None
    platzhalter: str | None = None
    max_zeichen: int | None = None
    pflicht: bool = False
    mehrzeilig: bool = False
    versteckt: bool = False
    standard_wert: str | None = None
    standard_feld: str | None = None


class EigeneFeldListe(BaseModel):
    """Alle eigenen Felder eines Betriebs, in ihrer Reihenfolge."""

    felder: list[EigenesFeld] = Field(default_factory=list)


def _zeile(row: dict) -> EigenesFeld:
    return EigenesFeld(
        id=str(row["id"]),
        feld_key=row["feld_key"],
        label=row["label"],
        art=row["art"],
        position=int(row.get("position") or 0),
        beschreibung=row.get("beschreibung"),
        platzhalter=row.get("platzhalter"),
        max_zeichen=row.get("max_zeichen"),
        pflicht=bool(row.get("pflicht")),
        mehrzeilig=bool(row.get("mehrzeilig")),
        versteckt=bool(row.get("versteckt")),
        standard_wert=row.get("standard_wert"),
        standard_feld=row.get("standard_feld"),
    )


def felder_laden(db: Client, tenant_id: str) -> EigeneFeldListe:
    """Die eigenen Felder eines Betriebs, nach `position` sortiert.

    Sortiert in der DATENBANK und nicht im Frontend: die Reihenfolge ist eine
    Eigenschaft des Feldes, keine Ansichtssache — Tabelle, Dialog und Renderer
    müssen dieselbe sehen.
    """
    rows = (
        db.table("site_post_custom_fields")
        .select(_SPALTEN)
        .eq("tenant_id", tenant_id)
        .order("position")
        .order("created_at")
        .execute()
    ).data or []
    return EigeneFeldListe(felder=[_zeile(r) for r in rows])


def feld_anlegen(
    db: Client, tenant_id: str, req: EigenesFeldNeu
) -> EigenesFeld:
    """Ein eigenes Feld anlegen.

    Der Deckel wird VOR dem Schreiben geprüft und der Schlüssel auf Kollision:
    beides sind Zustände, die ein zweiter gleichzeitiger Aufruf verletzen kann.
    Der harte Backstop ist deshalb die UNIQUE-Bedingung aus 0485 — diese
    Prüfung hier ist die freundliche Antwort, nicht der Schutz (Wurzel 2).
    """
    vorhanden = felder_laden(db, tenant_id).felder
    if len(vorhanden) >= MAX_EIGENE_FELDER:
        raise ValueError(
            f"Mehr als {MAX_EIGENE_FELDER} eigene Felder sind nicht möglich."
        )
    if any(f.feld_key == req.feld_key for f in vorhanden):
        raise ValueError(
            f"Es gibt schon ein Feld mit dem Schlüssel '{req.feld_key}'."
        )
    # Ans Ende, mit Abstand: ganze Zahlen mit Lücken, damit ein späteres
    # Einschieben nicht die ganze Liste neu schreiben muss.
    naechste = (max((f.position for f in vorhanden), default=0)) + 10
    nutzlast = {
        "tenant_id": tenant_id,
        "feld_key": req.feld_key,
        "label": req.label.strip(),
        "art": req.art,
        "position": naechste,
    }
    rows = (
        db.table("site_post_custom_fields")
        .insert(nutzlast)
        .execute()
    ).data or []
    if not rows:
        # Kein erfundener Rückgabewert: kommt die eben geschriebene Zeile
        # nicht zurück, ist etwas anderes kaputt als diese Anfrage.
        raise ValueError("Das Feld liess sich nicht anlegen.")
    return _zeile(rows[0])


def _eigenes_feld(db: Client, tenant_id: str, feld_id: str) -> dict:
    """Eine Feldzeile GESCOPED laden — Laden und Scope in einem Zug.

    Nicht erst laden und danach `!= tenant_id` prüfen: genau diese Trennung ist
    die Stelle, an der der Scope vergessen wird (Wurzel 3).
    """
    rows = (
        db.table("site_post_custom_fields")
        .select(_SPALTEN)
        .eq("id", feld_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise LookupError("Dieses Feld gibt es nicht.")
    return rows[0]


def feld_aendern(
    db: Client, tenant_id: str, feld_id: str, req: EigenesFeldPatch
) -> EigenesFeld:
    """Ein eigenes Feld ändern — Name, Reihenfolge, Verhalten.

    `exclude_unset`: ein nicht gesendetes Feld bleibt, ein ausdrücklich als
    `null` gesendetes wird geleert. Ohne diese Unterscheidung löschte das
    Speichern des Namens die Beschreibung, weil das Formular sie nicht kennt.
    """
    alt = _eigenes_feld(db, tenant_id, feld_id)
    patch = req.model_dump(mode="json", exclude_unset=True)
    if "label" in patch and not patch["label"]:
        # Ein Feld ohne Namen ist in keiner Maske auffindbar. 422 statt eines
        # erfundenen Ersatznamens (Wurzel 4).
        raise ValueError("Ein Feld braucht einen Namen.")
    # Ein verstecktes Pflichtfeld ist ein Dialog, den man nicht abschicken
    # kann, ohne zu sehen warum — dieselbe Regel wie bei den eingebauten
    # Feldern (`beitrag_felder.konfig_setzen`).
    versteckt = patch.get("versteckt", alt.get("versteckt"))
    pflicht = patch.get("pflicht", alt.get("pflicht"))
    if versteckt and pflicht:
        raise ValueError(
            "Ein Pflichtfeld lässt sich nicht ausblenden. Erst die Pflicht "
            "aufheben, dann ausblenden."
        )
    # --- Vorgabewert (0486) --------------------------------------------------
    wert = patch.get("standard_wert", alt.get("standard_wert"))
    quelle = patch.get("standard_feld", alt.get("standard_feld"))
    if wert and quelle:
        raise ValueError(
            "Ein Feld hat entweder einen festen Vorgabewert ODER eine "
            "Ableitung aus einem anderen Feld — nicht beides."
        )
    if (wert or quelle) and alt["art"] in ARTEN_OHNE_VORGABE:
        raise ValueError(
            f"Ein Feld vom Typ '{alt['art']}' nimmt keinen Vorgabewert an."
        )
    if quelle:
        if quelle == alt["feld_key"]:
            raise ValueError(
                "Ein Feld kann seine Vorgabe nicht aus sich selbst beziehen."
            )
        # Das Quellfeld muss es geben — eingebaut ODER eigen. Eine Ableitung
        # aus einem Feld, das niemand kennt, greift nie, und weil sie still
        # nicht greift, sucht niemand den Fehler hier (Wurzel 5).
        eigene = {f.feld_key for f in felder_laden(db, tenant_id).felder}
        if quelle not in BEITRAG_FELDER and quelle != "title" and quelle not in eigene:
            raise ValueError(
                f"'{quelle}' ist kein Feld dieses Betriebs."
            )
    if not patch:
        return _zeile(alt)
    (
        db.table("site_post_custom_fields")
        .update(patch)
        .eq("id", feld_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    return _zeile(_eigenes_feld(db, tenant_id, feld_id))


def feld_loeschen(db: Client, tenant_id: str, feld_id: str) -> int:
    """Ein eigenes Feld löschen — SAMT seiner Werte. Gibt zurück, wie viele
    Beiträge dabei angefasst wurden.

    DER GEGENZUSTAND (Wurzel 1)
    ===========================
    Die Definition steht in `site_post_custom_fields`, die Werte in
    `site_pages.post_custom`. Nur die Definition zu löschen liesse in jeder
    Beitragszeile einen Wert unter einem Schlüssel stehen, den niemand mehr
    liest — und beim nächsten Feld mit demselben Schlüssel tauchten die alten
    Werte wieder auf, als wären sie eingegeben worden.

    Deshalb wird beides in einem Zug erledigt: erst die Werte aus den
    betroffenen Beiträgen nehmen, dann die Definition. In DIESER Reihenfolge —
    bricht es dazwischen ab, steht ein Feld ohne Werte da (sichtbar und
    reparierbar) statt Werte ohne Feld (unsichtbar).
    """
    zeile = _eigenes_feld(db, tenant_id, feld_id)
    key = zeile["feld_key"]

    betroffene = (
        db.table("site_pages")
        .select("id, post_custom")
        .eq("tenant_id", tenant_id)
        .eq("page_type", "post")
        .execute()
    ).data or []
    angefasst = 0
    for beitrag in betroffene:
        werte = beitrag.get("post_custom") or {}
        if key not in werte:
            continue
        rest = {k: v for k, v in werte.items() if k != key}
        (
            db.table("site_pages")
            .update({"post_custom": rest})
            .eq("id", beitrag["id"])
            .eq("tenant_id", tenant_id)
            .execute()
        )
        angefasst += 1

    (
        db.table("site_post_custom_fields")
        .delete()
        .eq("id", feld_id)
        # Der Tenant-Scope steht auch hier. Ohne ihn wäre es ein `delete` über
        # eine ID, die aus der Anfrage stammt — die Service-Rolle umgeht RLS.
        .eq("tenant_id", tenant_id)
        .execute()
    )
    return angefasst


def werte_pruefen(
    db: Client, tenant_id: str, werte: dict[str, object]
) -> dict[str, object]:
    """Die gesendeten Werte gegen die Felder DIESES Betriebs prüfen.

    Ein unbekannter Schlüssel ist ein 422 und kein stilles Verwerfen: ein Wert,
    der gespeichert wird und nie erscheint, schickt den Kunden auf die Suche an
    der falschen Stelle (Wurzel 4/5). Dasselbe gilt für einen Wert, dessen Typ
    nicht zur Feldart passt — `"ja"` in einem Schalterfeld wäre in JavaScript
    wahr und in Python auch, und niemand fände je heraus, warum das Häkchen
    nicht ausgeht.

    `None` bleibt erlaubt und heisst „leeren".
    """
    bekannt = {f.feld_key: f.art for f in felder_laden(db, tenant_id).felder}
    sauber: dict[str, object] = {}
    for key, wert in werte.items():
        art = bekannt.get(key)
        if art is None:
            raise ValueError(
                f"Unbekanntes Feld '{key}'. Es gehört nicht zu diesem Betrieb."
            )
        if wert is None:
            sauber[key] = None
            continue
        if art == "schalter":
            if not isinstance(wert, bool):
                raise ValueError(f"'{key}' erwartet ja/nein.")
        elif art == "zahl":
            # `bool` ist in Python eine Ganzzahl — ohne diese Ausnahme ginge
            # `true` als Zahl 1 durch.
            if isinstance(wert, bool) or not isinstance(wert, (int, float)):
                raise ValueError(f"'{key}' erwartet eine Zahl.")
        elif art in ("liste", "galerie"):
            if not isinstance(wert, list) or any(
                not isinstance(x, str) for x in wert
            ):
                raise ValueError(f"'{key}' erwartet eine Liste von Texten.")
            if len(wert) > 100:
                raise ValueError(f"'{key}': höchstens 100 Einträge.")
        elif not isinstance(wert, str):
            raise ValueError(f"'{key}' erwartet einen Text.")
        sauber[key] = wert
    return sauber
