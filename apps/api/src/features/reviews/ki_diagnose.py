"""Live-Diagnose der Bewertungs-KI — WARUM ist eine Bewertung noch offen?

Anlass (05.09.2026): Die Kennzahl „20 offen" stand da, und niemand konnte
sagen, warum. Die Antwort lag verteilt: zwölf Bewertungen hatten gar keinen
Text (reine Sternevergabe — seit demselben Tag beantwortet die KI auch die,
gestützt auf die Kategorienoten), zwei waren längst beantwortet, nur der
Spiegel hinkte, der Rest wartete auf den stündlichen
Worker-Tick, der lokal gar nicht lief. Jede dieser Ursachen sieht in der
Liste gleich aus: „Offen".

Dieses Modul nennt je offener Portal-Bewertung GENAU EINEN Grund
(`KiDiagnoseStufe`), in derselben Reihenfolge, in der der Lauf sie prüft
(`ki_lauf`). Es liest nur, schreibt nichts, und ist tenant-gescopt (Wurzel 3).
Realtime kommt nicht von hier: das Signal ist `review_ki_stand` (0568), auf
das die Oberfläche hört und danach diese Diagnose neu holt.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from supabase import Client

from .ki_lauf import _LOOKBACK_TAGE, TAKT_SEKUNDEN, _frist_vorbei, _note_auf_fuenf
from .ki_store import KiStore
from .ki_text import katalog_gepflegt, katalog_laden
from .schemas import (
    KiDiagnose,
    KiDiagnoseEintrag,
    KiDiagnoseStufe,
    KiRichtung,
    KiZustellart,
)

# Obergrenze der Liste (Wurzel 8). Mehr offene Bewertungen als das hat kein
# Betrieb, der die Seite noch bedienen kann.
MAX_OFFEN = 200

_REVIEW_SPALTEN = (
    "id, ota, guest_name, overall_score, content, received_at, "
    "reply_expires_at, is_hidden, property_id"
)


def _dt(wert: object) -> datetime | None:
    if not wert:
        return None
    if isinstance(wert, datetime):
        return wert if wert.tzinfo else wert.replace(tzinfo=UTC)
    try:
        d = datetime.fromisoformat(str(wert).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=UTC)


def _stufe_aus_warteschlange(q: dict) -> KiDiagnoseStufe:
    status = str(q.get("status") or "")
    if status == "gesendet":
        return KiDiagnoseStufe.gesendet
    if status == "geplant":
        return (
            KiDiagnoseStufe.entwurf_wartet
            if q.get("zustellart") == KiZustellart.entwurf.value
            else KiDiagnoseStufe.geplant
        )
    if status == "fehler":
        return KiDiagnoseStufe.fehler
    if status == "abgelaufen":
        return KiDiagnoseStufe.abgelaufen
    return KiDiagnoseStufe.uebersprungen


def _stufe_ohne_eintrag(  # noqa: PLR0913 — eine Entscheidung, alle Eingaben
    *,
    protokoll: dict | None,
    is_hidden: bool,
    frist_vorbei: bool,
    received_at: datetime | None,
    grenze: datetime,
    ki_aktiv: bool,
    gepflegt: bool,
) -> KiDiagnoseStufe:
    """Dieselbe Reihenfolge wie `ki_lauf._unbeantwortete_bewertungen` +
    `_eine_antwort` — sonst erklärt die Diagnose etwas anderes als der Lauf
    tut. Als Prüfliste (erster Treffer gewinnt), nicht als Kaskade."""
    pruefung: tuple[tuple[bool, KiDiagnoseStufe], ...] = (
        (protokoll is not None, KiDiagnoseStufe.ki_abgelehnt),
        (is_hidden, KiDiagnoseStufe.verdeckt),
        (frist_vorbei, KiDiagnoseStufe.frist_vorbei),
        (received_at is not None and received_at < grenze, KiDiagnoseStufe.zu_alt),
        (not ki_aktiv, KiDiagnoseStufe.ki_aus),
        (not gepflegt, KiDiagnoseStufe.katalog_leer),
    )
    return next(
        (stufe for trifft, stufe in pruefung if trifft), KiDiagnoseStufe.wartet_auf_lauf
    )


def diagnose(db: Client, tenant_id: str, *, jetzt: datetime | None = None) -> KiDiagnose:
    """Rahmen (Schalter, Katalog, letzter/nächster Lauf) + jede offene
    Portal-Bewertung mit ihrem Grund."""
    now = jetzt or datetime.now(UTC)
    store = KiStore(db)
    settings = store.settings(tenant_id)
    gepflegt = katalog_gepflegt(katalog_laden(db, tenant_id))
    stand = store.stand(tenant_id) or {}

    offen = (
        db.table("channex_review")
        .select(_REVIEW_SPALTEN)
        .eq("tenant_id", tenant_id)
        .eq("is_replied", False)
        .eq("is_expired", False)
        .order("received_at", desc=True)
        .limit(MAX_OFFEN)
        .execute()
    ).data or []
    ids = [str(r["id"]) for r in offen]

    schlange: dict[str, dict] = {}
    protokolle: dict[str, dict] = {}
    titel: dict[str, str | None] = {}
    if ids:
        for q in (
            db.table("guest_review_queue")
            .select("antwort_auf_id, status, zustellart, send_at, sent_at, error")
            .eq("tenant_id", tenant_id)
            .eq("richtung", KiRichtung.antwort.value)
            .in_("antwort_auf_id", ids)
            .execute()
        ).data or []:
            if q.get("antwort_auf_id"):
                schlange[str(q["antwort_auf_id"])] = q
        # Neueste zuerst → der erste Treffer je Bezug ist der jüngste Lauf.
        for p in (
            db.table("review_ki_protokoll")
            .select("bezug_id, grund, created_at")
            .eq("tenant_id", tenant_id)
            .eq("richtung", KiRichtung.antwort.value)
            .in_("bezug_id", ids)
            .order("created_at", desc=True)
            .execute()
        ).data or []:
            bezug = str(p.get("bezug_id") or "")
            if bezug and bezug not in protokolle:
                protokolle[bezug] = p
        objekt_ids = sorted({str(r["property_id"]) for r in offen if r.get("property_id")})
        if objekt_ids:
            titel = {
                str(p["id"]): p.get("title")
                for p in (
                    db.table("properties")
                    .select("id, title")
                    .eq("tenant_id", tenant_id)
                    .in_("id", objekt_ids)
                    .execute()
                ).data
                or []
            }

    grenze = now - timedelta(days=_LOOKBACK_TAGE)
    items: list[KiDiagnoseEintrag] = []
    for r in offen:
        rid = str(r["id"])
        hat_text = bool((r.get("content") or "").strip())
        received_at = _dt(r.get("received_at"))
        q = schlange.get(rid)
        p = protokolle.get(rid)
        stufe = (
            _stufe_aus_warteschlange(q)
            if q is not None
            else _stufe_ohne_eintrag(
                protokoll=p,
                is_hidden=bool(r.get("is_hidden")),
                frist_vorbei=_frist_vorbei(r.get("reply_expires_at"), now),
                received_at=received_at,
                grenze=grenze,
                ki_aktiv=settings.ki_aktiv,
                gepflegt=gepflegt,
            )
        )
        items.append(
            KiDiagnoseEintrag(
                review_id=rid,
                kanal=r.get("ota"),
                gast_name=r.get("guest_name"),
                objekt_titel=titel.get(str(r.get("property_id") or "")),
                note_5=_note_auf_fuenf(r.get("overall_score")),
                received_at=received_at,
                reply_expires_at=_dt(r.get("reply_expires_at")),
                hat_text=hat_text,
                stufe=stufe,
                warteschlange_status=(q or {}).get("status"),
                zustellart=(q or {}).get("zustellart"),
                send_at=_dt((q or {}).get("send_at")),
                sent_at=_dt((q or {}).get("sent_at")),
                fehler=(q or {}).get("error"),
                protokoll_grund=(p or {}).get("grund"),
                protokoll_at=_dt((p or {}).get("created_at")),
            )
        )

    letzter = _dt(stand.get("letzter_lauf_at"))
    return KiDiagnose(
        ki_aktiv=settings.ki_aktiv,
        katalog_gepflegt=gepflegt,
        zustellart_antwort=settings.zustellart_antwort,
        verzoegerung_minuten=settings.verzoegerung_minuten,
        rueckblick_tage=_LOOKBACK_TAGE,
        takt_minuten=TAKT_SEKUNDEN // 60,
        letzter_lauf_at=letzter,
        letzter_schritt=stand.get("letzter_schritt"),
        schritt_at=_dt(stand.get("schritt_at")),
        # Ohne einen ersten Lauf gibt es keinen „nächsten" — None, nicht
        # „jetzt + Takt" (Wurzel 4: kein erfundener Zeitpunkt).
        naechster_lauf_at=(letzter + timedelta(seconds=TAKT_SEKUNDEN)) if letzter else None,
        offen=len(items),
        items=items,
    )
