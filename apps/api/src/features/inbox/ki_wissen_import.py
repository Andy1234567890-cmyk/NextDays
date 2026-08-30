"""PDF-Import in die Wissensdatenbank — zweistufig, nie ungeprüft.

WARUM ZWEISTUFIG, obwohl die Vorlage nur den Upload zeigt: Ein Dokument, das
ungeprüft in die Wissensdatenbank fliesst, macht die KI zur Sprecherin eines
Textes, den niemand gelesen hat — inklusive veralteter Preise und alter
Türcodes. Die Vorlage zeigt den Upload, nicht was danach passiert. Zwischen
beidem liegt der Unterschied zwischen einem Werkzeug und einer Haftungsfalle.

Der Ablauf ist deshalb:

    hochladen  →  Vertex liest  →  Vorschlagsliste  →  MENSCH wählt  →  Fakten

Die Vorschläge werden NICHT zwischengespeichert. Sie gehen als Antwort an die
Oberfläche und kommen mit dem Übernehmen zurück. Eine Zwischentabelle wäre ein
weiterer Zustand mit eigenem Gegenzustand (Wurzel 1): verwaiste Vorschläge, die
niemand aufräumt, weil der Betrieb den Reiter geschlossen hat.

Gemini liest PDFs direkt (`inlineData`). Eine PDF-Bibliothek im Backend wäre
eine zusätzliche Abhängigkeit für schlechtere Ergebnisse — Textextraktion aus
einem mehrspaltigen Layout ist genau das, worin ein Sprachmodell besser ist als
ein Parser.
"""
from __future__ import annotations

import base64
import json
import re
from typing import Any
from uuid import uuid4

from supabase import Client

from src.core.ki import KiError, VertexClient
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.site_config.ki_nutzung import buchen, deckel_pruefen

from .errors import InboxError
from .ki_wissen import KATEGORIEN
from .schemas import WissenImportVorschau, WissenImportVorschlag

log = get_logger("nextdays.inbox.ki_wissen_import")

# Der Funktionsname für `site_ai_usage` (0500). MUSS im CHECK der Tabelle UND
# in `ki_nutzung.FUNKTIONEN` stehen — sonst steigt `_schreiben` still aus und
# der Tagesdeckel wird ausgerechnet beim teuersten Aufruf zur Attrappe.
FUNKTION = "wissen_import"

BUCKET = "ki-wissen-dokumente"

# 20 MB, wie der Bucket in 0496. Doppelt geprüft, und das mit Absicht: die
# Bucket-Grenze schützt den Speicher, diese hier den Vertex-Aufruf — ein 19-MB-
# PDF wäre als base64 ein 25-MB-Prompt.
MAX_BYTES = 20 * 1024 * 1024

# Wurzel 8: ein 400-seitiges Dokument darf nicht 400 Fakten erzeugen.
MAX_VORSCHLAEGE = 40
MAX_UEBERNEHMEN = 40

MAX_ANTWORT_TOKENS = 4_000

# Ein Betrag oder eine Jahreszahl im Fakt ist der Hinweis, der am teuersten
# fehlt: ein alter Preis in der Wissensdatenbank ist eine falsche Zusage an
# einen Gast, und sie sieht genauso aus wie eine richtige.
_BETRAG = re.compile(r"\d[\d.,]*\s*(?:€|EUR|DKK|kr\.?|SEK|NOK|CHF|USD|\$)", re.I)
_JAHR = re.compile(r"\b(?:19|20)\d{2}\b")

_SYSTEM = (
    "Du liest ein Dokument einer Ferienunterkunft (Hausordnung, Gästemappe, "
    "Preisliste) und ziehst daraus einzelne FAKTEN, die einem Gast auf eine "
    "Frage antworten könnten.\n"
    "Regeln:\n"
    "- Ein Fakt ist EINE Aussage, in sich verständlich, ohne Bezug auf "
    "„siehe oben“ oder eine Seitenzahl.\n"
    "- Übernimm nur, was im Dokument STEHT. Erfinde nichts und ergänze nichts "
    "aus deinem Weltwissen.\n"
    "- Lass Fliesstext, Begrüssungen, Inhaltsverzeichnisse und Rechtsfloskeln "
    "weg. Es geht um beantwortbare Angaben.\n"
    "- Formuliere Titel und Text in der Sprache des Dokuments.\n"
    f"- Höchstens {MAX_VORSCHLAEGE} Fakten.\n"
    "Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Rahmentext und ohne "
    "Markdown-Zaun. Jedes Element: "
    '{"titel": "…", "text": "…", "kategorie": "…"}. '
    f"Erlaubte Kategorien: {', '.join(KATEGORIEN)}."
)


def _json_liste(roh: str) -> list[dict]:
    """Die Antwort als Liste lesen — auch wenn ein Markdown-Zaun drumherum steht.

    Das Modell hält sich meistens an „nur JSON“, aber nicht immer. Ein
    Zaun-Rest darf den ganzen Import nicht kippen; ein wirklich kaputtes
    Ergebnis dagegen schon, laut (Wurzel 5)."""
    text = roh.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    try:
        daten = json.loads(text)
    except json.JSONDecodeError as exc:
        raise InboxError(
            "Das Dokument konnte nicht ausgewertet werden.", status_code=502
        ) from exc
    if isinstance(daten, dict):
        # Manche Antworten packen die Liste in ein Objekt.
        for wert in daten.values():
            if isinstance(wert, list):
                daten = wert
                break
    if not isinstance(daten, list):
        raise InboxError(
            "Das Dokument konnte nicht ausgewertet werden.", status_code=502
        )
    return [d for d in daten if isinstance(d, dict)]


def _warnung(titel: str, text: str) -> str | None:
    zusammen = f"{titel} {text}"
    if _BETRAG.search(zusammen):
        return "betrag"
    if _JAHR.search(zusammen):
        return "jahr"
    return None


class KiWissenImportMixin:
    """PDF-Import. Teil von `InboxService`."""

    # Vom Service bzw. `KiWissenMixin` gestellt; hier nur deklariert. KEINE
    # Stub-Implementierungen: die stünden in der MRO vor den echten und würden
    # bei jedem Aufruf werfen.
    _db: Client | None

    # -- Schritt 1: hochladen und lesen ----------------------------------------
    def wissen_dokument_lesen(
        self,
        ctx: AuthContext,
        *,
        inhalt: bytes,
        dateiname: str,
        property_id: str | None,
        client: VertexClient | None = None,
    ) -> WissenImportVorschau:
        """Ein PDF ablegen und Faktenvorschläge daraus ziehen.

        Legt NOCH KEINE Fakten an — nur die Quelle. Erst `wissen_import_uebernehmen`
        schreibt, und zwar nur, was ein Mensch angehakt hat."""
        db, tenant_id = self._require(ctx)

        # Magic-Bytes, nicht der content_type des Clients (Wurzel 8): eine als
        # application/pdf deklarierte HTML-Datei bliebe eine HTML-Datei.
        if not inhalt.startswith(b"%PDF-"):
            raise InboxError("Nur PDF-Dateien werden gelesen.", status_code=422)
        if len(inhalt) > MAX_BYTES:
            raise InboxError(
                f"Die Datei ist zu groß (max. {MAX_BYTES // (1024 * 1024)} MB).",
                status_code=422,
            )
        if property_id:
            self._own_property(db, tenant_id, property_id)

        # VOR dem Upload: ein Deckel, der erst nach dem Ablegen prüft, hat die
        # Datei schon im Speicher und die Quelle schon in der DB.
        try:
            deckel_pruefen(db, tenant_id)
        except KiError as exc:
            raise InboxError(exc.message, status_code=exc.status_code) from exc

        name = _dateiname_saeubern(dateiname)
        pfad = f"{tenant_id}/{uuid4().hex}.pdf"
        try:
            db.storage.from_(BUCKET).upload(
                pfad, inhalt, {"content-type": "application/pdf"}
            )
        except Exception as exc:  # noqa: BLE001 — Storage-SDK wirft untypisiert
            log.error("ki_wissen_upload_fehlgeschlagen", error=str(exc))
            raise InboxError(
                "Die Datei konnte nicht abgelegt werden.", status_code=502
            ) from exc

        quelle = (
            db.table("ki_wissen_quelle")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "art": "dokument",
                    "datei_name": name,
                    "datei_pfad": pfad,
                    "datei_groesse_bytes": len(inhalt),
                    "hochgeladen_von": ctx.user_id if ctx.user_id != "cron" else None,
                }
            )
            .execute()
        ).data
        quelle_id = str(quelle[0]["id"])

        ki = client or VertexClient()
        try:
            antwort = ki.erzeuge_multimodal(
                system=_SYSTEM,
                teile=[
                    {
                        "inlineData": {
                            "mimeType": "application/pdf",
                            "data": base64.b64encode(inhalt).decode(),
                        }
                    },
                    {"text": "Ziehe die Fakten aus diesem Dokument."},
                ],
                temperature=0.1,
                max_tokens=MAX_ANTWORT_TOKENS,
            )
        except KiError as exc:
            # Die Quelle bleibt stehen: die Datei liegt, und ein zweiter Anlauf
            # soll sie nicht doppelt hochladen. Der Fehler geht LAUT hinaus,
            # samt Grund — „Fehler" allein hilft niemandem (Wurzel 5).
            raise InboxError(exc.message, status_code=exc.status_code) from exc

        vorschlaege = []
        for eintrag in _json_liste(antwort.text)[:MAX_VORSCHLAEGE]:
            titel = str(eintrag.get("titel") or "").strip()[:200]
            text = str(eintrag.get("text") or "").strip()[:2000]
            if not text:
                continue
            kategorie = str(eintrag.get("kategorie") or "sonstiges").strip()
            vorschlaege.append(
                WissenImportVorschlag(
                    titel=titel or None,
                    fact=text,
                    kategorie=kategorie if kategorie in KATEGORIEN else "sonstiges",
                    warnung=_warnung(titel, text),
                )
            )

        log.info(
            "ki_wissen_dokument_gelesen",
            tenant_id=tenant_id,
            datei=name,
            vorschlaege=len(vorschlaege),
            tokens_ein=antwort.tokens_ein,
            tokens_aus=antwort.tokens_aus,
        )
        buchen(
            db,
            tenant_id,
            user_id=ctx.user_id if ctx.user_id != "cron" else None,
            funktion=FUNKTION,
            antwort=antwort,
        )
        return WissenImportVorschau(
            quelle_id=quelle_id, datei_name=name, items=vorschlaege
        )

    # -- Schritt 2: übernehmen --------------------------------------------------
    def wissen_import_uebernehmen(
        self,
        ctx: AuthContext,
        *,
        quelle_id: str,
        items: list[WissenImportVorschlag],
        property_id: str | None,
    ) -> int:
        """Die angehakten Vorschläge als Fakten anlegen."""
        if not items:
            return 0
        if len(items) > MAX_UEBERNEHMEN:
            raise InboxError(
                f"Höchstens {MAX_UEBERNEHMEN} Fakten auf einmal.", status_code=422
            )
        db, tenant_id = self._require(ctx)

        # Wurzel 3: die Quelle muss dem Betrieb gehören. Ohne diese Prüfung
        # liesse sich ein fremder `quelle_id` unterschieben und die eigenen
        # Fakten fälschlich als „aus deren Hausordnung" ausweisen.
        eigen = (
            db.table("ki_wissen_quelle")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", quelle_id)
            .limit(1)
            .execute()
        ).data
        if not eigen:
            raise InboxError("Quelle nicht gefunden.", status_code=404)
        if property_id:
            self._own_property(db, tenant_id, property_id)

        zeilen: list[dict[str, Any]] = []
        for v in items:
            text = (v.fact or "").strip()
            if not text:
                continue
            zeilen.append(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "titel": (v.titel or "").strip() or None,
                    "fact": text[:2000],
                    "kategorie": v.kategorie if v.kategorie in KATEGORIEN else "sonstiges",
                    "source": "document",
                    "source_ref": None,
                    "quelle_id": quelle_id,
                    "created_by": ctx.user_id if ctx.user_id != "cron" else None,
                }
            )
        if not zeilen:
            return 0
        eingefuegt = db.table("inbox_knowledge_fact").insert(zeilen).execute().data
        return len(eingefuegt or [])


def _dateiname_saeubern(name: str) -> str:
    """Anzeigename ohne Pfadanteile und Steuerzeichen.

    Derselbe Grund wie bei den Anhängen: der Name landet in der Oberfläche und
    in Protokollen — `../../etc/passwd` hat dort so wenig zu suchen wie ein
    Zeilenumbruch."""
    roh = (name or "").replace("\\", "/").split("/")[-1].strip()
    sauber = re.sub(r"[^\w.\- ]+", "_", roh)[:120].strip(" .") or "dokument.pdf"
    if not sauber.lower().endswith(".pdf"):
        sauber = f"{sauber}.pdf"
    return sauber
