"""Sprachen des Betriebs und Auswahl der richtigen Fassung beim Versand.

DAS MODELL (0363) — Grundfassung + Sprachfassungen:
    Eine Vorlage/Regel hat EINE Grundfassung (`message_template.body` bzw.
    `message_automation.message`) und beliebig viele Sprachfassungen
    (`message_template_text` / `message_automation_text`, je mit `lang`).

    Welche Fassung an den Gast geht, entscheidet `fassung_waehlen`:
        1. Sprachfassung in der Sprache des Gastes,
        2. Sprachfassung in der Standardsprache des Betriebs,
        3. Grundfassung.

    Der Altbestand wurde bewusst KEINER Sprache zugeschrieben (siehe Migration
    0363): niemand hat die Sprache dieser Texte erfasst, und sie zu raten hätte
    dazu geführt, dass eine fehlende Fassung als vorhanden gilt.

WARUM DIE GASTSPRACHE HIER NORMIERT WIRD: Die Portale liefern sie in jeder
Schreibweise — „da", „DA", „de-AT", „pt_BR", Airbnb teils „nb" für Norwegisch.
Verglichen wird deshalb immer die Basissprache in Kleinschreibung, über
denselben Alias-Weg wie die Anzeige (`core.languages`). Ohne das trifft
`lang == gastsprache` bei „de-AT" nie, und der Gast bekommt still die
Standardfassung — der Fehler, den niemand sieht.
"""
from __future__ import annotations

from typing import Final

from supabase import Client

from src.core.languages import basis_sprache, ist_bekannte_sprache
from src.core.security import AuthContext

from .errors import InboxError
from .schemas import AutomationText, MessageLanguage, MessageLanguageList

# Wie viele Sprachen ein Betrieb pflegen darf. Jede Sprache vervielfacht die
# Pflege JEDER Vorlage; jenseits davon ist das keine Pflege mehr, sondern eine
# Halde (Wurzel 8: kein unbegrenzter Bereich).
MAX_SPRACHEN: Final[int] = 12


def _zeile(r: dict) -> MessageLanguage:
    return MessageLanguage(
        code=r["code"],
        is_default=bool(r.get("is_default")),
    )


def sprachen_laden(db: Client, tenant_id: str) -> MessageLanguageList:
    """Sprachen des Betriebs, Standardsprache zuerst, danach alphabetisch."""
    rows = (
        db.table("tenant_message_language")
        .select("code, is_default")
        .eq("tenant_id", tenant_id)
        .order("is_default", desc=True)
        .order("code")
        .execute()
    ).data or []
    return MessageLanguageList(items=[_zeile(r) for r in rows])


def standardsprache(db: Client, tenant_id: str) -> str | None:
    """Standardsprache des Betriebs oder None, wenn keine gepflegt ist.

    None ist ein gültiger Zustand und KEIN Fehler: solange der Betrieb keine
    Sprachen verwaltet, gibt es nur die Grundfassung — genau wie vor 0363.
    """
    rows = (
        db.table("tenant_message_language")
        .select("code")
        .eq("tenant_id", tenant_id)
        .eq("is_default", True)
        .limit(1)
        .execute()
    ).data or []
    return rows[0]["code"] if rows else None


def sprache_hinzufuegen(db: Client, tenant_id: str, code: str) -> MessageLanguageList:
    """Sprache aufnehmen. Die ERSTE Sprache wird automatisch die Standardsprache.

    Idempotent (Wurzel 2): ein zweiter Aufruf mit demselben Code ändert nichts —
    weder Reihenfolge noch Standard-Markierung. Ein Doppelklick auf „hinzufügen"
    darf die Standardsprache nicht verschieben.
    """
    basis = basis_sprache(code)
    if not basis or not ist_bekannte_sprache(basis):
        raise InboxError(f"Unbekannte Sprache: {code}", status_code=422)
    vorhanden = sprachen_laden(db, tenant_id).items
    if any(s.code == basis for s in vorhanden):
        return sprachen_laden(db, tenant_id)
    if len(vorhanden) >= MAX_SPRACHEN:
        raise InboxError(
            f"Höchstens {MAX_SPRACHEN} Sprachen je Betrieb.", status_code=422
        )
    db.table("tenant_message_language").insert(
        {
            "tenant_id": tenant_id,
            "code": basis,
            # Die erste Sprache MUSS der Standard sein: sonst hätte der Betrieb
            # Sprachen, aber keinen Rückfall — und `fassung_waehlen` fiele für
            # jeden Gast ohne passende Fassung auf die Grundfassung zurück,
            # obwohl eine gepflegte Fassung dasteht.
            "is_default": not vorhanden,
        }
    ).execute()
    return sprachen_laden(db, tenant_id)


def standard_setzen(db: Client, tenant_id: str, code: str) -> MessageLanguageList:
    """Standardsprache umstellen (der Stern in „Sprachen verwalten").

    Reihenfolge: erst ALLE auf false, dann die eine auf true. Umgekehrt bräche
    der partielle Unique-Index (`tenant_message_language_default_idx`) mitten im
    Vorgang — der Index ist genau dafür da, dass es nie zwei Standardsprachen
    gibt (Wurzel 1: der Gegenzustand wird mitgepflegt).
    """
    basis = basis_sprache(code)
    vorhanden = sprachen_laden(db, tenant_id).items
    if not basis or not any(s.code == basis for s in vorhanden):
        raise InboxError("Sprache nicht gepflegt.", status_code=404)
    db.table("tenant_message_language").update({"is_default": False}).eq(
        "tenant_id", tenant_id
    ).eq("is_default", True).execute()
    db.table("tenant_message_language").update({"is_default": True}).eq(
        "tenant_id", tenant_id
    ).eq("code", basis).execute()
    return sprachen_laden(db, tenant_id)


def sprache_entfernen(db: Client, tenant_id: str, code: str) -> MessageLanguageList:
    """Sprache entfernen — samt ihrer Fassungen (Wurzel 1: Gegenzustand).

    Die Standardsprache kann nicht gelöscht werden, solange andere Sprachen
    daneben stehen: ohne Standard gäbe es keinen Rückfall mehr, und die
    gepflegten Fassungen der übrigen Sprachen erreichten nur noch Gäste, deren
    Sprache exakt passt. Wer sie loswerden will, setzt zuerst eine andere als
    Standard.

    Bleibende Fassungen wären Datenmüll mit Wirkung: die Sprache wäre in der
    Oberfläche weg, der Text ginge aber weiter an Gäste dieser Sprache hinaus.
    """
    basis = basis_sprache(code) or ""
    vorhanden = sprachen_laden(db, tenant_id).items
    treffer = next((s for s in vorhanden if s.code == basis), None)
    if not treffer:
        raise InboxError("Sprache nicht gepflegt.", status_code=404)
    if treffer.is_default and len(vorhanden) > 1:
        raise InboxError(
            "Die Standardsprache lässt sich nicht entfernen. Zuerst eine andere "
            "Sprache als Standard setzen.",
            status_code=422,
        )
    for tabelle in ("message_template_text", "message_automation_text"):
        db.table(tabelle).delete().eq("tenant_id", tenant_id).eq(
            "lang", basis
        ).execute()
    db.table("tenant_message_language").delete().eq("tenant_id", tenant_id).eq(
        "code", basis
    ).execute()
    return sprachen_laden(db, tenant_id)


def automation_texte(
    db: Client, tenant_id: str, automation_ids: list[str]
) -> dict[str, list[AutomationText]]:
    """Sprachfassungen mehrerer Regeln in EINER Abfrage (analog Vorlagen)."""
    if not automation_ids:
        return {}
    rows = (
        db.table("message_automation_text")
        .select("automation_id, lang, subject, message")
        .eq("tenant_id", tenant_id)
        .in_("automation_id", automation_ids)
        .order("lang")
        .execute()
    ).data or []
    nach_id: dict[str, list[AutomationText]] = {}
    for r in rows:
        nach_id.setdefault(str(r["automation_id"]), []).append(
            AutomationText(
                lang=r["lang"],
                subject=r.get("subject") or "",
                message=r.get("message") or "",
            )
        )
    return nach_id

def automation_texte_schreiben(
db: Client,
    tenant_id: str,
    automation_id: str,
    texte: list[AutomationText] | None,
) -> list[AutomationText]:
    """Sprachfassungen einer Regel setzen — Alt/Neu-Diff wie bei Vorlagen.

    `None` = nicht mitgeschickt, bleibt unangetastet. Eine Liste ist der
    vollständige Sollzustand; was fehlt, wird entfernt. Sonst ginge eine im
    Editor gelöschte Fassung weiter an Gäste dieser Sprache hinaus (Wurzel 1).

    Leere Fassungen (kein Text, kein Betreff) werden nicht gespeichert: sie
    gälten in `fassung_waehlen` sonst als gepflegt und verdrängten die
    Grundfassung durch eine leere Nachricht.
    """
    if texte is None:
        return automation_texte(db, tenant_id, [automation_id]).get(
            automation_id, []
        )
    soll: dict[str, dict] = {}
    for t in texte:
        lang = (t.lang or "").strip().lower()
        if not (t.message or "").strip() and not (t.subject or "").strip():
            continue
        soll[lang] = {
            "automation_id": automation_id,
            "tenant_id": tenant_id,
            "lang": lang,
            "subject": t.subject,
            "message": t.message,
        }
    vorhanden = (
        db.table("message_automation_text")
        .select("lang")
        .eq("tenant_id", tenant_id)
        .eq("automation_id", automation_id)
        .execute()
    ).data or []
    for r in vorhanden:
        if r["lang"] not in soll:
            db.table("message_automation_text").delete().eq(
                "tenant_id", tenant_id
            ).eq("automation_id", automation_id).eq("lang", r["lang"]).execute()
    if soll:
        db.table("message_automation_text").upsert(
            list(soll.values()), on_conflict="automation_id,lang"
        ).execute()
    return automation_texte(db, tenant_id, [automation_id]).get(
        automation_id, []
    )


class SprachenMixin:
    """Die vier Sprach-Endpunkte am Service. Teil von `InboxService`.

    Nur Hülle: die Arbeit machen die Funktionen oben, damit die Planung sie ohne
    Service-Instanz nutzen kann (`standardsprache`, `fassung_waehlen`).
    """

    def _require(self, ctx: AuthContext) -> tuple[Client, str]:  # vom Service
        raise NotImplementedError

    def list_message_languages(self, ctx: AuthContext) -> MessageLanguageList:
        db, tenant_id = self._require(ctx)
        return sprachen_laden(db, tenant_id)

    def add_message_language(self, ctx: AuthContext, code: str) -> MessageLanguageList:
        db, tenant_id = self._require(ctx)
        return sprache_hinzufuegen(db, tenant_id, code)

    def set_default_message_language(self, ctx: AuthContext, code: str) -> MessageLanguageList:
        db, tenant_id = self._require(ctx)
        return standard_setzen(db, tenant_id, code)

    def remove_message_language(self, ctx: AuthContext, code: str) -> MessageLanguageList:
        db, tenant_id = self._require(ctx)
        return sprache_entfernen(db, tenant_id, code)


def fassung_waehlen(
    fassungen: dict[str, str],
    grundfassung: str | None,
    *,
    gastsprache: str | None,
    standard: str | None,
) -> tuple[str | None, str | None]:
    """(Text, verwendete Sprache) für DIESEN Gast.

    `fassungen` ist `lang -> Text`; leere Texte gelten als nicht vorhanden (eine
    angelegte, aber nie ausgefüllte Sprachfassung darf keine leere Nachricht
    verschicken). Die verwendete Sprache ist `None`, wenn die Grundfassung
    greift — der Aufrufer kann das protokollieren, statt eine Sprache zu
    behaupten (Wurzel 4).
    """
    gepflegt = {k: v for k, v in fassungen.items() if (v or "").strip()}
    basis = basis_sprache(gastsprache)
    if basis and basis in gepflegt:
        return gepflegt[basis], basis
    if standard and standard in gepflegt:
        return gepflegt[standard], standard
    grund = (grundfassung or "").strip()
    return (grund or None), None
