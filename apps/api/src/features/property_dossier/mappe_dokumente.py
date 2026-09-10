"""PDFs in der Gäste-/Hausmappe — hochladen, lesen lassen, bestätigen.

WARUM ES DAS GIBT: Was ein Betrieb real hat, ist ein PDF — die Hausordnung vom
Verwalter, das WLAN-Blatt des Providers, die Anfahrtsbeschreibung des
Vorbesitzers. Die Mappe verlangte bisher, alles abzutippen. Was niemand
abtippt, steht in der Mappe eben nicht, und der Gast fragt dann per Nachricht
nach dem WLAN-Passwort.

Der Ablauf ist bewusst zweistufig:

    hochladen  →  Gemini liest  →  Vorschlagsliste  →  MENSCH bestätigt  →  Feld

WARUM NICHT DIREKT SCHREIBEN: OCR liest falsch — eine gedrehte Seite, ein
Handscan, eine Tabelle mit zwei Spalten. Ein falsch erkannter Türcode fällt
nicht dem Betrieb auf, sondern dem GAST, der vor der Tür steht. Deshalb
schreibt hier nichts ohne einen Klick.

WARUM DIE VORSCHLÄGE NICHT GESPEICHERT WERDEN: Sie gehen als Antwort an die
Oberfläche und kommen mit dem Bestätigen zurück. Eine Zwischentabelle wäre ein
weiterer Zustand mit eigenem Gegenzustand (Wurzel 1): verwaiste Vorschläge, die
niemand aufräumt, weil jemand den Reiter geschlossen hat. Dieselbe Entscheidung
wie beim Wissens-Import (`inbox/ki_wissen_import.py`).

Das DOKUMENT dagegen bleibt: es ist die Quelle, in der man nachliest, wenn die
Zusammenfassung Fragen offenlässt.

Gemini liest PDFs direkt (`inlineData`). Eine PDF-Bibliothek im Backend wäre
eine zusätzliche Abhängigkeit für schlechtere Ergebnisse — Text aus einem
mehrspaltigen Scan zu holen ist genau das, worin ein Sprachmodell besser ist
als ein Parser.
"""
from __future__ import annotations

import base64
import json
import re
from collections.abc import Callable
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import uuid4

import nh3
from postgrest.exceptions import APIError
from supabase import Client

from src.core.ki import KiError, VertexClient
from src.core.logging import get_logger
from src.features.site_config.ki_nutzung import buchen, deckel_pruefen

from .mappe_felder import KATALOG, MAPPEN, NACH_KEY, SPRACHEN, laenge_fuer
from .schemas import (
    MappeDokument,
    MappeDokumentVorschau,
    MappeUebernahmeErgebnis,
    MappeVorschlag,
)

if TYPE_CHECKING:  # pragma: no cover — nur fuer die Typpruefung
    from .service import DossierError

log = get_logger("nextdays.property_dossier.mappe")

# Der Funktionsname für `site_ai_usage` (0619). MUSS hier UND im CHECK der
# Tabelle stehen — sonst steigt `_schreiben` still aus und der Tagesdeckel wird
# ausgerechnet beim teuersten Aufruf zur Attrappe. Genau das ist in diesem
# Projekt schon viermal passiert.
FUNKTION = "mappe_dokument"

BUCKET = "mappe-dokumente"

# 20 MB, wie der Bucket in 0619. Doppelt geprüft, und das mit Absicht: die
# Bucket-Grenze schützt den Speicher, diese hier den Vertex-Aufruf — ein 19-MB-
# PDF wäre als base64 ein 25-MB-Prompt.
MAX_BYTES = 20 * 1024 * 1024

# Wurzel 8: ohne Deckel schriebe ein 400-seitiges Dokument seinen halben Inhalt
# in die Mappe. Mehr als den Katalog kann es ohnehin nicht geben.
MAX_VORSCHLAEGE = len(KATALOG)
MAX_ANTWORT_TOKENS = 6_000

# Wie viele Dokumente eine Mappe fasst. Auch das ist ein unbegrenzter Bereich,
# der eine Grenze braucht — sonst wird die Mappe zur Ablage.
MAX_DOKUMENTE_JE_MAPPE = 50

# Die Tags, die der Rich-Text-Editor der Mappe erzeugt (B/I/U/S + Link) plus
# Absatz und Liste. Alles andere fliegt beim Speichern raus.
#
# WARUM ÜBERHAUPT: `type_attributes` wird heute UNSANITISIERT gespeichert — das
# Feld ist ein ungetyptes `dict` und geht unverändert in die Spalte. Solange
# nur ein Mensch in den Editor tippt, ist das eine Altlast; sobald ein
# Sprachmodell HTML vorschlägt, das der Server speichert und die Oberfläche
# später rendert, ist es Wurzel 8. Hier wird deshalb sanitisiert, bevor
# irgendetwas in die Spalte geht.
_ERLAUBTE_TAGS = {"p", "br", "b", "strong", "i", "em", "u", "s", "a", "ul", "ol", "li"}
_ERLAUBTE_ATTRS = {"a": {"href", "title"}}

# Uhrzeit als HH:MM — für `checkInTime`/`checkOutTime`. Was das Modell sonst
# liefert („nachmittags", „ab 16 Uhr"), ist kein Uhrzeitfeld und wird
# verworfen, statt in einen Zeitwähler geschrieben zu werden, der ihn nicht
# darstellen kann (Wurzel 4).
_UHRZEIT = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _system_prompt() -> str:
    """Der Prompt mit dem Feldkatalog. Aus EINER Quelle gebaut.

    Der Katalog steht in `mappe_felder.py`; hier wird er nur vorgelesen. Eine
    zweite, handgepflegte Liste im Prompt wäre die klassische zweite Wahrheit —
    ein neues Feld erschiene in der Bestätigungsliste und würde nie erkannt.
    """
    zeilen = [f'- "{f.key}": {f.hinweis}' for f in KATALOG]
    return (
        "Du liest ein Dokument einer Ferienunterkunft (Hausordnung, "
        "Gästemappe, WLAN-Blatt, Anfahrtsbeschreibung) und ziehst daraus "
        "Angaben für die digitale Mappe.\n"
        "Regeln:\n"
        "- Übernimm NUR, was im Dokument STEHT. Erfinde nichts, ergänze nichts "
        "aus deinem Weltwissen, rate nicht.\n"
        "- Steht eine Angabe nicht im Dokument, lass das Feld WEG. Ein "
        "fehlendes Feld ist richtig; ein geratenes ist ein Schaden.\n"
        "- Gib jede Angabe so wieder, wie sie dasteht. Kürze nicht sinnentstellend.\n"
        "- Uhrzeiten als HH:MM (z. B. \"16:00\").\n"
        "- Für jede Angabe: `sicher` = wie gut sie lesbar war "
        "(\"hoch\" | \"mittel\" | \"niedrig\").\n"
        "- Nenne in `fundstelle` kurz, WO im Dokument die Angabe steht "
        "(z. B. \"Seite 2, Abschnitt WLAN\").\n"
        "- `sprache`: der ISO-Code der Sprache des Dokuments "
        f"({', '.join(SPRACHEN)}); eine andere Sprache → \"de\".\n"
        "Diese Felder gibt es:\n"
        + "\n".join(zeilen)
        + "\n\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Rahmentext "
        "und ohne Markdown-Zaun:\n"
        '{"sprache": "de", "seiten": 3, "felder": '
        '[{"key": "wifi_password", "wert": "…", "sicher": "hoch", '
        '"fundstelle": "Seite 1"}]}'
    )


def _json_objekt(roh: str) -> dict:
    """Die Antwort als Objekt lesen — auch mit Markdown-Zaun drumherum.

    Das Modell hält sich meistens an „nur JSON", aber nicht immer. Ein
    Zaun-Rest darf das Lesen nicht kippen; ein wirklich kaputtes Ergebnis
    dagegen schon, und zwar laut (Wurzel 5).
    """
    text = roh.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    try:
        daten = json.loads(text)
    except json.JSONDecodeError as exc:
        raise _fehler(
            "Das Dokument konnte nicht ausgewertet werden.", 502
        ) from exc
    if not isinstance(daten, dict):
        raise _fehler("Das Dokument konnte nicht ausgewertet werden.", 502)
    return daten


# PostgREST meldet eine fehlende Tabelle mit diesem Code. Das ist KEIN
# Programmfehler, sondern eine nicht eingespielte Migration — und es ist die
# haeufigste Ursache, wenn ein frisch gebauter Bereich beim ersten Klick
# umfaellt. Ein roher 500 („unhandled_error") laesst den Nutzer raten; die
# Meldung sagt, was zu tun ist.
_PGRST_TABELLE_FEHLT = "PGRST205"


def _db_fehler(exc: APIError, was: str) -> DossierError:
    """Ein DB-Fehler als saubere Antwort statt als 500 (Wurzel 5).

    Spezifisch gefangen, nicht breit: nur die fehlende Tabelle bekommt eine
    eigene Erklaerung. Jeder andere DB-Fehler geht als 502 hinaus und bleibt
    im Log stehen — verschluckt wird nichts.
    """
    code = (getattr(exc, "code", "") or "").strip()
    if code == _PGRST_TABELLE_FEHLT:
        log.error("mappe_tabelle_fehlt", was=was, meldung=str(exc)[:300])
        return _fehler(
            "Die digitale Mappe ist noch nicht eingerichtet: Migration 0619 "
            "ist nicht eingespielt.",
            503,
        )
    log.error("mappe_db_fehler", was=was, code=code, meldung=str(exc)[:300])
    return _fehler("Die Mappe ist gerade nicht abrufbar.", 502)


def _fehler(nachricht: str, status: int) -> DossierError:
    """Die Fehlerklasse des Slices — lokal importiert.

    `service.py` importiert dieses Modul (das Mixin); ein Import in die andere
    Richtung auf Modulebene waere ein Zirkel. Zur Laufzeit steht die Klasse
    beim ersten Aufruf laengst bereit.
    """
    from .service import DossierError as _DossierError  # noqa: PLC0415

    return _DossierError(nachricht, status_code=status)


def _sauber(wert: str, *, key: str) -> str:
    """Ein erkannter Wert, so wie er gespeichert werden darf.

    Kurze Felder (Türcode, WLAN-Name, Uhrzeit) sind PLAINTEXT — dort hat kein
    Tag etwas zu suchen. Lange Blöcke dürfen die Auszeichnung tragen, die der
    Editor der Mappe auch erzeugt; alles andere entfernt der Parser.
    """
    feld = NACH_KEY.get(key)
    grenze = laenge_fuer(key)
    if feld is not None and feld.kurz:
        return nh3.clean(wert, tags=set(), attributes={}).strip()[:grenze]
    return nh3.clean(
        wert,
        tags=set(_ERLAUBTE_TAGS),
        attributes={k: set(v) for k, v in _ERLAUBTE_ATTRS.items()},
        # Nur echte Verweise: ein `javascript:` in einem href ist kein Link,
        # sondern Code.
        url_schemes={"http", "https", "mailto", "tel"},
    ).strip()[:grenze]


def _dateiname_saeubern(name: str) -> str:
    """Ein Anzeigename ohne Pfadanteile.

    Der Name kommt vom Client und wird später in der Oberfläche gezeigt. Er
    landet NICHT im Ablagepfad — der wird serverseitig aus einer UUID gebildet,
    damit kein `../` und kein fremder Tenant-Ordner erreichbar ist.
    """
    roh = (name or "").strip().replace("\\", "/").split("/")[-1]
    sauber = re.sub(r"[^\w .\-()äöüÄÖÜßæøåÆØÅ]", "", roh).strip()
    return (sauber or "Dokument.pdf")[:300]


class MappeDokumenteMixin:
    """Upload, Auswertung und Übernahme. Teil von `PropertyDossierService`."""

    # Vom Service gestellt; hier nur DEKLARIERT, nicht implementiert. Kein
    # Methodenrumpf mit `...`: der stuende in der MRO vor der echten Methode
    # und wuerde bei jedem Aufruf `None` liefern. Als Attribut-Annotation
    # existiert zur Laufzeit nichts davon — der Service bringt die echten mit.
    _ctx: Any
    _db: Callable[[], Client]
    _require_tenant: Callable[[str | None], str]
    _require_own_property: Callable[[str, str], None]

    # -- Katalog ---------------------------------------------------------------
    def mappe_felder_pruefen(self, tenant_id: str | None, property_id: str) -> None:
        """Nur der Scope-Test fuer den Katalog-Endpunkt.

        Der Katalog selbst haengt an keinem Objekt — geprueft wird trotzdem,
        weil ein Endpunkt unter `/{property_id}/` ohne Objektpruefung ein
        Muster ist, das beim naechsten Kopieren zur Luecke wird (Wurzel 9).
        """
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)

    # -- Liste -----------------------------------------------------------------
    def mappe_dokumente(
        self, tenant_id: str | None, property_id: str, mappe: str
    ) -> list[MappeDokument]:
        """Was in dieser Mappe liegt, neueste zuerst."""
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        if mappe not in MAPPEN:
            raise _fehler("Unbekannte Mappe.", 422)
        zeilen = (
            self._db()
            .table("mappe_dokument")
            .select("*")
            .eq("tenant_id", tid)
            .eq("property_id", property_id)
            .eq("mappe", mappe)
            .order("created_at", desc=True)
            .limit(MAX_DOKUMENTE_JE_MAPPE)
            .execute()
        ).data or []
        return [MappeDokument(**_zeile(z)) for z in zeilen]

    # -- Betrachten ------------------------------------------------------------
    def mappe_dokument_url(
        self, tenant_id: str | None, property_id: str, dokument_id: str
    ) -> str:
        """Eine kurzlebige, signierte Adresse zum Ansehen des PDFs.

        Der Bucket ist privat (0619) — es gibt keinen öffentlichen Pfad. Die
        Adresse gilt zehn Minuten: lange genug zum Lesen, kurz genug, dass ein
        weitergegebener Link nicht zum Dauerzugang wird.
        """
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        zeile = self._eigenes_dokument(tid, property_id, dokument_id)
        try:
            antwort = self._db().storage.from_(BUCKET).create_signed_url(
                zeile["datei_pfad"], 600
            )
        except Exception as exc:  # noqa: BLE001 — Storage-SDK wirft untypisiert
            log.error("mappe_signierte_url_fehlgeschlagen", error=str(exc)[:300])
            raise _fehler("Das Dokument ist gerade nicht abrufbar.", 502) from exc
        url = (antwort or {}).get("signedURL") or (antwort or {}).get("signedUrl")
        if not url:
            # Kein Ersatzlink und kein leerer String: ein Knopf, der ins Leere
            # führt, ist schlimmer als eine ehrliche Fehlermeldung (Wurzel 4).
            raise _fehler("Das Dokument ist gerade nicht abrufbar.", 502)
        return str(url)

    def _eigenes_dokument(
        self, tenant_id: str, property_id: str, dokument_id: str
    ) -> dict:
        """Eine Dokumentzeile — gescopet auf Tenant UND Objekt (Wurzel 3/9).

        Beides, nicht nur der Tenant: der List-Pfad filtert nach Objekt, also
        muss jeder Einzelzugriff denselben Scope prüfen. Sonst liest ein
        Eigentümer mit einer fremden `dokument_id` die Hausordnung eines
        Objekts, das ihm nicht gehört — samt Türcode.
        """
        zeilen = (
            self._db()
            .table("mappe_dokument")
            .select("*")
            .eq("id", dokument_id)
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            raise _fehler("Dokument nicht gefunden.", 404)
        return zeilen[0]

    # -- Schritt 1: hochladen und lesen ----------------------------------------
    def mappe_dokument_lesen(
        self,
        tenant_id: str | None,
        *,
        property_id: str,
        mappe: str,
        inhalt: bytes,
        dateiname: str,
        user_id: str | None,
        client: VertexClient | None = None,
    ) -> MappeDokumentVorschau:
        """Ein PDF ablegen und Vorschläge für die Mappenfelder ziehen.

        Schreibt NICHTS in die Mappe — nur die Datei und ihre Zeile. Erst
        `mappe_dokument_uebernehmen` füllt Felder, und nur die angehakten.
        """
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        if mappe not in MAPPEN:
            raise _fehler("Unbekannte Mappe.", 422)

        # Magic-Bytes, nicht der content_type des Clients (Wurzel 8): eine als
        # application/pdf deklarierte HTML-Datei bliebe eine HTML-Datei.
        if not inhalt.startswith(b"%PDF-"):
            raise _fehler("Nur PDF-Dateien werden gelesen.", 422)
        if len(inhalt) > MAX_BYTES:
            raise _fehler(
                f"Die Datei ist zu groß (max. {MAX_BYTES // (1024 * 1024)} MB).",
                422,
            )
        self._mappe_nicht_voll(tid, property_id, mappe)

        # VOR dem Upload: ein Deckel, der erst danach prüft, hat die Datei
        # schon im Speicher und die Zeile schon in der DB.
        try:
            deckel_pruefen(self._db(), tid)
        except KiError as exc:
            raise _fehler(exc.message, exc.status_code) from exc

        name = _dateiname_saeubern(dateiname)
        pfad = f"{tid}/{property_id}/{uuid4().hex}.pdf"
        try:
            self._db().storage.from_(BUCKET).upload(
                pfad, inhalt, {"content-type": "application/pdf"}
            )
        except Exception as exc:  # noqa: BLE001 — Storage-SDK wirft untypisiert
            log.error("mappe_upload_fehlgeschlagen", error=str(exc)[:300])
            raise _fehler("Die Datei konnte nicht abgelegt werden.", 502) from exc

        zeile = (
            self._db()
            .table("mappe_dokument")
            .insert(
                {
                    "tenant_id": tid,
                    "property_id": property_id,
                    "mappe": mappe,
                    "datei_name": name,
                    "datei_pfad": pfad,
                    "datei_groesse_bytes": len(inhalt),
                    "hochgeladen_von": user_id,
                }
            )
            .execute()
        ).data
        dokument_id = str(zeile[0]["id"])

        vorschlaege, sprache, seiten = self._lesen_lassen(
            tid, dokument_id, inhalt=inhalt, name=name, user_id=user_id,
            client=client,
        )
        return MappeDokumentVorschau(
            dokument=MappeDokument(
                **_zeile(self._eigenes_dokument(tid, property_id, dokument_id))
            ),
            sprache=sprache,
            seiten=seiten,
            items=vorschlaege,
        )

    def _mappe_nicht_voll(self, tid: str, property_id: str, mappe: str) -> None:
        vorhanden = (
            self._db()
            .table("mappe_dokument")
            .select("id", count="exact")
            .eq("tenant_id", tid)
            .eq("property_id", property_id)
            .eq("mappe", mappe)
            .limit(1)
            .execute()
        ).count or 0
        if vorhanden >= MAX_DOKUMENTE_JE_MAPPE:
            raise _fehler(
                f"In dieser Mappe liegen bereits {MAX_DOKUMENTE_JE_MAPPE} "
                "Dokumente. Bitte zuerst eines entfernen.",
                422,
            )

    def _lesen_lassen(
        self,
        tid: str,
        dokument_id: str,
        *,
        inhalt: bytes,
        name: str,
        user_id: str | None,
        client: VertexClient | None,
    ) -> tuple[list[MappeVorschlag], str | None, int | None]:
        """Gemini lesen lassen und das Ergebnis am Dokument vermerken."""
        ki = client or VertexClient()
        try:
            antwort = ki.erzeuge_multimodal(
                system=_system_prompt(),
                teile=[
                    {
                        "inlineData": {
                            "mimeType": "application/pdf",
                            "data": base64.b64encode(inhalt).decode(),
                        }
                    },
                    {"text": "Ziehe die Mappen-Angaben aus diesem Dokument."},
                ],
                temperature=0.1,
                max_tokens=MAX_ANTWORT_TOKENS,
            )
        except KiError as exc:
            # Die Datei BLEIBT liegen und wird als Fehlschlag markiert: sie ist
            # hochgeladen, ein zweiter Anlauf soll sie nicht doppelt ablegen.
            # Der Grund steht an der Zeile, damit die Mappe zeigen kann, WARUM
            # nichts gefunden wurde — „Fehler" allein hilft niemandem (Wurzel 5).
            self._auswertung_setzen(tid, dokument_id, "fehler", exc.message)
            raise _fehler(exc.message, exc.status_code) from exc

        daten = _json_objekt(antwort.text)
        sprache = str(daten.get("sprache") or "").strip().lower()
        sprache = sprache if sprache in SPRACHEN else None
        seiten = daten.get("seiten")
        seiten = int(seiten) if isinstance(seiten, int) and seiten > 0 else None

        vorschlaege: list[MappeVorschlag] = []
        gesehen: set[str] = set()
        for eintrag in daten.get("felder") or []:
            if not isinstance(eintrag, dict):
                continue
            key = str(eintrag.get("key") or "").strip()
            feld = NACH_KEY.get(key)
            if feld is None or key in gesehen:
                continue
            wert = _sauber(str(eintrag.get("wert") or "").strip(), key=key)
            if not wert:
                continue
            if key in ("checkInTime", "checkOutTime") and not _UHRZEIT.match(wert):
                # Eine Uhrzeit, die keine ist, gehört nicht in ein Zeitfeld.
                continue
            gesehen.add(key)
            sicher = str(eintrag.get("sicher") or "").strip().lower()
            vorschlaege.append(
                MappeVorschlag(
                    key=key,
                    titel=feld.titel,
                    wert=wert,
                    sicher=sicher if sicher in ("hoch", "mittel", "niedrig") else None,
                    fundstelle=str(eintrag.get("fundstelle") or "").strip()[:200]
                    or None,
                    heikel=feld.heikel,
                )
            )
            if len(vorschlaege) >= MAX_VORSCHLAEGE:
                break

        self._auswertung_setzen(
            tid,
            dokument_id,
            "gelesen" if vorschlaege else "ohne_treffer",
            None
            if vorschlaege
            else "Im Dokument stand nichts, was in ein Mappenfeld passt.",
            seiten=seiten,
        )
        log.info(
            "mappe_dokument_gelesen",
            tenant_id=tid,
            datei=name,
            vorschlaege=len(vorschlaege),
            seiten=seiten,
            tokens_ein=antwort.tokens_ein,
            tokens_aus=antwort.tokens_aus,
        )
        buchen(
            self._db(), tid, user_id=user_id, funktion=FUNKTION, antwort=antwort
        )
        return vorschlaege, sprache, seiten

    def _auswertung_setzen(
        self,
        tid: str,
        dokument_id: str,
        stand: str,
        hinweis: str | None,
        *,
        seiten: int | None = None,
    ) -> None:
        werte: dict[str, Any] = {
            "auswertung": stand,
            "auswertung_hinweis": (hinweis or None),
            "ausgewertet_am": datetime.now(UTC).isoformat(),
        }
        if seiten is not None:
            werte["seiten"] = seiten
        (
            self._db()
            .table("mappe_dokument")
            .update(werte)
            .eq("id", dokument_id)
            .eq("tenant_id", tid)
            .execute()
        )

    # -- Schritt 2: übernehmen -------------------------------------------------
    def mappe_dokument_uebernehmen(
        self,
        tenant_id: str | None,
        *,
        property_id: str,
        dokument_id: str,
        items: list[MappeVorschlag],
        sprache: str,
        ueberschreiben: bool = False,
    ) -> MappeUebernahmeErgebnis:
        """Die BESTÄTIGTEN Werte in die Mappenfelder schreiben.

        `sprache` sagt, welche Sprachfassung der Gästemappe gefüllt wird —
        die Blöcke sind dreisprachig (de/en/da). Übersetzt wird hier NICHT: das
        Dokument steht in einer Sprache, und eine maschinell nebenbei erzeugte
        zweite Fassung wäre ein Text, den niemand gelesen hat.

        `ueberschreiben=False` (der Normalfall) füllt nur LEERE Felder. Ein
        gepflegter Türcode ist die Wahrheit des Betriebs; ihn durch einen
        gelesenen zu ersetzen, weil jemand ein altes PDF hochlädt, wäre
        Datenverlust ohne Rückfrage (Wurzel 1). Wer bewusst ersetzen will,
        setzt das Kennzeichen — dann steht in der Antwort, was ersetzt wurde.
        """
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        if sprache not in SPRACHEN:
            raise _fehler("Unbekannte Sprachfassung.", 422)
        if len(items) > MAX_VORSCHLAEGE:
            raise _fehler(
                f"Höchstens {MAX_VORSCHLAEGE} Felder auf einmal.", 422
            )
        # Wurzel 3/9: das Dokument muss dem Tenant UND dem Objekt gehören.
        # Ohne diese Prüfung liesse sich eine fremde `dokument_id`
        # unterschieben und ein Wert als „aus deren Hausordnung" ausweisen.
        self._eigenes_dokument(tid, property_id, dokument_id)

        prop = self._objekt_attribute(tid, property_id)
        attrs: dict[str, Any] = dict(prop.get("type_attributes") or {})
        messaging: dict[str, Any] = dict(attrs.get("messaging") or {})
        policies: dict[str, Any] = dict(attrs.get("policies") or {})
        portal = self._gastportal(tid, property_id)
        portal_neu: dict[str, Any] = {}

        gesetzt: list[str] = []
        uebersprungen: list[str] = []
        spuren: list[dict[str, Any]] = []

        for v in items:
            feld = NACH_KEY.get(v.key)
            if feld is None:
                continue
            wert = _sauber((v.wert or "").strip(), key=v.key)
            if not wert:
                continue
            if v.key in ("checkInTime", "checkOutTime") and not _UHRZEIT.match(wert):
                uebersprungen.append(feld.titel)
                continue

            geschrieben = False
            for ziel in feld.ziele:
                if ziel.art == "messaging":
                    block = dict(messaging.get(ziel.feld) or {})
                    if (block.get(sprache) or "").strip() and not ueberschreiben:
                        continue
                    block[sprache] = wert
                    messaging[ziel.feld] = block
                    geschrieben = True
                    spuren.append(
                        {
                            "tenant_id": tid,
                            "dokument_id": dokument_id,
                            "ziel": "messaging",
                            "feld": ziel.feld,
                            "sprache": sprache,
                        }
                    )
                elif ziel.art == "policies":
                    if str(policies.get(ziel.feld) or "").strip() and not ueberschreiben:
                        continue
                    policies[ziel.feld] = wert
                    geschrieben = True
                    spuren.append(
                        {
                            "tenant_id": tid,
                            "dokument_id": dokument_id,
                            "ziel": "policies",
                            "feld": ziel.feld,
                            "sprache": None,
                        }
                    )
                else:  # guest_portal
                    alt = str(portal.get(ziel.feld) or "").strip()
                    if alt and not ueberschreiben:
                        continue
                    portal_neu[ziel.feld] = wert
                    geschrieben = True
                    spuren.append(
                        {
                            "tenant_id": tid,
                            "dokument_id": dokument_id,
                            "ziel": "guest_portal",
                            "feld": ziel.feld,
                            "sprache": None,
                        }
                    )
            (gesetzt if geschrieben else uebersprungen).append(feld.titel)

        if not gesetzt:
            # Nichts geschrieben heißt nichts geschrieben — kein „erfolgreich"
            # auf eine Änderung, die nicht stattfand (Wurzel 5).
            return MappeUebernahmeErgebnis(
                gesetzt=[], uebersprungen=uebersprungen, ueberschrieben=ueberschreiben
            )

        attrs["messaging"] = messaging
        if policies:
            attrs["policies"] = policies
        (
            self._db()
            .table("properties")
            .update({"type_attributes": attrs})
            .eq("id", property_id)
            .eq("tenant_id", tid)
            .execute()
        )
        if portal_neu:
            self._gastportal_schreiben(tid, property_id, portal_neu)

        # Die Spur, WOHER der Wert kam. `upsert` statt `insert`: dieselbe
        # Bestätigung zweimal abgeschickt (Doppelklick, Retry) darf nicht an
        # der Eindeutigkeit scheitern — der Seiteneffekt ist derselbe
        # (Wurzel 2).
        if spuren:
            (
                self._db()
                .table("mappe_dokument_uebernahme")
                .upsert(spuren, on_conflict="dokument_id,ziel,feld,sprache")
                .execute()
            )
        self._auswertung_setzen(
            tid,
            dokument_id,
            "uebernommen",
            f"{len(gesetzt)} Feld(er) aus diesem Dokument übernommen.",
        )
        log.info(
            "mappe_dokument_uebernommen",
            tenant_id=tid,
            property_id=property_id,
            dokument_id=dokument_id,
            gesetzt=len(gesetzt),
            uebersprungen=len(uebersprungen),
            ueberschrieben=ueberschreiben,
        )
        return MappeUebernahmeErgebnis(
            gesetzt=gesetzt,
            uebersprungen=uebersprungen,
            ueberschrieben=ueberschreiben,
        )

    # -- Löschen ---------------------------------------------------------------
    def mappe_dokument_loeschen(
        self, tenant_id: str | None, property_id: str, dokument_id: str
    ) -> None:
        """Ein Dokument aus der Mappe nehmen — Datei UND Zeile.

        Die ÜBERNOMMENEN WERTE bleiben. Sie stehen in `properties` bzw.
        `property_guest_portal` und gehören dem Betrieb, nicht der Datei; ein
        Türcode verschwindet nicht, weil jemand das PDF aufräumt. Die
        Herkunftszeilen fallen per `on delete cascade` mit — „aus Datei X" ist
        ohne die Datei gegenstandslos (0619).
        """
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        zeile = self._eigenes_dokument(tid, property_id, dokument_id)
        try:
            self._db().storage.from_(BUCKET).remove([zeile["datei_pfad"]])
        except Exception as exc:  # noqa: BLE001 — Storage-SDK wirft untypisiert
            # Best-effort: die Zeile geht trotzdem. Eine verwaiste Datei im
            # privaten Bucket ist ärgerlich, eine Zeile ohne Datei wäre ein
            # Eintrag, der beim Anklicken 502 liefert.
            log.warning("mappe_datei_nicht_geloescht", error=str(exc)[:300])
        (
            self._db()
            .table("mappe_dokument")
            .delete()
            .eq("id", dokument_id)
            .eq("tenant_id", tid)
            .eq("property_id", property_id)
            .execute()
        )

    # -- Datenzugriffe ---------------------------------------------------------
    def _objekt_attribute(self, tid: str, property_id: str) -> dict:
        zeilen = (
            self._db()
            .table("properties")
            .select("id, type_attributes")
            .eq("id", property_id)
            .eq("tenant_id", tid)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            raise _fehler("Objekt nicht gefunden.", 404)
        return zeilen[0]

    def _gastportal(self, tid: str, property_id: str) -> dict:
        zeilen = (
            self._db()
            .table("property_guest_portal")
            .select("*")
            .eq("property_id", property_id)
            .eq("tenant_id", tid)
            .limit(1)
            .execute()
        ).data or []
        return zeilen[0] if zeilen else {}

    def _gastportal_schreiben(
        self, tid: str, property_id: str, werte: dict[str, Any]
    ) -> None:
        """Die strukturierten Felder setzen — Zeile anlegen, falls es keine gibt.

        `upsert` auf `property_id`: ein Objekt hat genau eine Portalzeile, und
        ein zweiter Aufruf darf keine zweite anlegen (Wurzel 2).
        """
        (
            self._db()
            .table("property_guest_portal")
            .upsert(
                {"tenant_id": tid, "property_id": property_id, **werte},
                on_conflict="property_id",
            )
            .execute()
        )


def _zeile(z: dict) -> dict:
    """Eine DB-Zeile auf die Felder des Schemas."""
    return {
        "id": str(z["id"]),
        "mappe": z["mappe"],
        "datei_name": z["datei_name"],
        "datei_groesse_bytes": z["datei_groesse_bytes"],
        "seiten": z.get("seiten"),
        "auswertung": z["auswertung"],
        "auswertung_hinweis": z.get("auswertung_hinweis"),
        "ausgewertet_am": z.get("ausgewertet_am"),
        "created_at": z["created_at"],
    }
