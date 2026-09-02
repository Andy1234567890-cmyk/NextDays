"""Videofreigabe je Beitrag (0523) — kein Link ohne geprüftes Video.

DIE REGEL: Ein Influencer lädt sein fertiges Video VOR der Veröffentlichung
hoch. Das Backoffice sieht es an und gibt frei. Erst danach baut
`beitraege.link_bauen` einen Link — den, mit dem er Geld verdient. Ohne
Freigabe kein Link.

WARUM DIE SPERRE IM LINK-BAU SITZT UND NICHT IN DER OBERFLÄCHE: Der Partner
spricht dieselbe API an wie sein Dashboard. Eine ausgegraute Schaltfläche hält
niemanden auf, der `GET /affiliates/posts` aufruft (Wurzel 3). Der Link
existiert deshalb schlicht nicht, solange `review_status != 'approved'` — es
gibt nichts zurückzuhalten, weil nichts gebaut wird.

WIDERRUF (Wurzel 1): `widerrufen` setzt den Beitrag auf `rejected`. Der Link
ist damit sofort tot — er wird nicht mehr gebaut, und `/p/CODE` mit diesem
utm_content führt ins Leere. Die bereits verdiente Provision bleibt bestehen:
sie stammt aus echten, zahlenden Kunden, und ein erfüllter Provisionsanspruch
wird nicht rückwirkend entzogen. Das ist eine bewusste Entscheidung, kein
vergessener Gegenzustand.

WURZEL 8 (Upload als Angriffsfläche): Magic-Byte-Prüfung statt Vertrauen in den
`content_type` des Clients, harte Größenobergrenze VOR dem Schreiben, erzeugter
Pfad statt Dateiname des Nutzers, privater Bucket mit kurzlebigen signierten
Adressen.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from .fehler import AffiliateError
from .schemas_reichweite import ABLEHNUNGSGRUENDE

if TYPE_CHECKING:
    from supabase import Client

log = get_logger("nextdays.affiliates.video_freigabe")

BUCKET = "affiliate-videos"
# 200 MB — dieselbe Zahl wie `file_size_limit` des Buckets in 0523. Die API
# weist früh und verständlich ab (413), der Bucket ist die Rückfallebene.
MAX_BYTES = 200 * 1024 * 1024
# Wie lange eine signierte Adresse gilt. Kurz, weil sie ein unveröffentlichtes
# Video zeigt; lang genug, dass ein Prüfer es in Ruhe ansehen kann.
SIGNATUR_SEKUNDEN = 60 * 30

_OFFEN = ("draft", "rejected")


# Erkennung über Magic Bytes: (Präfix, Offset) → (MIME, Endung). MP4/MOV teilen
# den ISO-BMFF-Container (`ftyp` ab Byte 4) und werden gesondert unterschieden.
_MAGIC: tuple[tuple[bytes, int, str, str], ...] = (
    (b"\x1a\x45\xdf\xa3", 0, "video/webm", "webm"),
    (b"\xff\xd8\xff", 0, "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", 0, "image/png", "png"),
    (b"%PDF-", 0, "application/pdf", "pdf"),
)


def dateityp(inhalt: bytes) -> tuple[str, str] | None:
    """Dateityp (Video, Bild, PDF) aus den Magic Bytes — nicht aus dem
    `content_type` des Clients.

    Der Client-Header ist eine Behauptung: eine als `video/mp4` deklarierte
    HTML-Datei wäre sonst im Bucket gelandet und würde beim Ansehen im Browser
    ausgeführt. Bild- und PDF-Beiträge seit 0526 (Master-Strategie: JEDER
    Beitrag wird vorab freigegeben, nicht nur Videos); kein SVG (Skripte),
    kein Office, kein ZIP.
    """
    if len(inhalt) < 12:
        return None
    if inhalt[4:8] == b"ftyp":
        return ("video/quicktime", "mov") if inhalt[8:12] == b"qt  " else ("video/mp4", "mp4")
    for praefix, offset, mime, endung in _MAGIC:
        if inhalt[offset : offset + len(praefix)] == praefix:
            return mime, endung
    return None


def _beitrag(db: Client, post_id: str, affiliate_id: str) -> dict[str, Any]:
    """Beitrag NUR im eigenen Scope laden (Wurzel 3/9): (id, affiliate_id) in
    EINER Abfrage — nie laden und danach vergleichen."""
    rows = (
        db.table("affiliate_posts")
        .select("*")
        .eq("id", post_id)
        .eq("affiliate_id", affiliate_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise AffiliateError("Beitrag nicht gefunden.", status_code=404)
    return rows[0]


def _protokoll(
    db: Client,
    *,
    post_id: str,
    affiliate_id: str,
    aktion: str,
    note: str | None = None,
    actor: str | None = None,
    reason_code: str | None = None,
) -> None:
    """Prüfschritt protokollieren. Best-effort: ein Protokollfehler darf die
    Freigabe nicht kippen — aber er wird LAUT geloggt, weil das Protokoll
    haftungsrelevant ist."""
    try:
        db.table("affiliate_post_reviews").insert(
            {
                "post_id": post_id,
                "affiliate_id": affiliate_id,
                "aktion": aktion,
                "note": note,
                "actor": actor,
                "reason_code": reason_code,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Protokoll ist Nebenpfad
        log.error(
            "affiliate_video_protokoll_fehlgeschlagen",
            post_id=post_id,
            aktion=aktion,
            error=str(exc)[:200],
        )


# --- Partner: hochladen und einreichen ---------------------------------------


def video_hochladen(
    db: Client,
    *,
    post_id: str,
    affiliate_id: str,
    inhalt: bytes,
    dateiname: str,
) -> dict[str, Any]:
    """Video zu einem Beitrag ablegen und ihn zur Prüfung einreichen.

    Reihenfolge: prüfen → Speicher → Zeile. Andersherum stünde am Beitrag ein
    Pfad, zu dem es keine Datei gibt, und das Backoffice bekäme beim Ansehen
    einen toten Link.

    Ein bereits freigegebener Beitrag kann NICHT überschrieben werden: sonst
    ließe sich ein geprüftes Video nach der Freigabe gegen ein beliebiges
    anderes tauschen und der Link liefe weiter. Wer nachbessern will, bekommt
    vom Backoffice eine Ablehnung oder einen Widerruf — dann ist der Beitrag
    wieder offen.
    """
    _ = dateiname  # Der Name des Nutzers landet NIE im Pfad (Wurzel 8).
    beitrag = _beitrag(db, post_id, affiliate_id)
    stand = str(beitrag.get("review_status") or "draft")
    if stand == "approved":
        raise AffiliateError(
            "Dieser Beitrag ist bereits freigegeben. Für ein neues Video "
            "wenden Sie sich an uns — die Freigabe muss zuerst widerrufen werden.",
            status_code=409,
        )
    if stand == "submitted":
        raise AffiliateError(
            "Das Video liegt bereits zur Prüfung vor.", status_code=409
        )
    if not inhalt:
        raise AffiliateError("Die Datei ist leer.", status_code=422)
    if len(inhalt) > MAX_BYTES:
        raise AffiliateError(
            f"Das Video ist größer als {MAX_BYTES // (1024 * 1024)} MB.",
            status_code=413,
        )
    typ = dateityp(inhalt)
    if not typ:
        raise AffiliateError(
            "Nur MP4, MOV und WebM sind möglich.", status_code=422
        )
    mime, endung = typ

    # Der Pfad wird ERZEUGT: Partner, Beitrag, Zufall. Der Zufall verhindert,
    # dass jemand die Adresse eines fremden, unveröffentlichten Videos errät,
    # falls die Signatur je entfiele.
    pfad = f"{affiliate_id}/{post_id}/{secrets.token_hex(16)}.{endung}"
    db.storage.from_(BUCKET).upload(
        pfad, inhalt, {"content-type": mime, "upsert": "false"}
    )

    # Gegenzustand (Wurzel 1): Das alte Video eines abgelehnten Anlaufs wird
    # entfernt — sonst sammeln sich verworfene Fassungen im Bucket an, die
    # niemand mehr zuordnen kann. Best-effort: schlägt es fehl, ist die neue
    # Fassung trotzdem gültig.
    alt = beitrag.get("video_path")
    if alt and alt != pfad:
        try:
            db.storage.from_(BUCKET).remove([alt])
        except Exception as exc:  # noqa: BLE001 — Aufräumen ist Nebenpfad
            log.warning(
                "affiliate_video_alt_nicht_geloescht", pfad=alt, error=str(exc)[:200]
            )

    jetzt = datetime.now(UTC).isoformat()
    db.table("affiliate_posts").update(
        {
            "video_path": pfad,
            "video_size": len(inhalt),
            "video_mime": mime,
            "video_uploaded_at": jetzt,
            "review_status": "submitted",
            "review_note": None,
            "review_runde": int(beitrag.get("review_runde") or 0) + 1,
            "updated_at": jetzt,
        }
    ).eq("id", post_id).eq("affiliate_id", affiliate_id).execute()

    _protokoll(db, post_id=post_id, affiliate_id=affiliate_id, aktion="submitted")
    log.info(
        "affiliate_video_eingereicht",
        post_id=post_id,
        affiliate_id=affiliate_id,
        groesse=len(inhalt),
        mime=mime,
        runde=int(beitrag.get("review_runde") or 0) + 1,
    )
    return _beitrag(db, post_id, affiliate_id)


def video_adresse(db: Client, *, post_id: str, affiliate_id: str) -> str | None:
    """Kurzlebige signierte Adresse des eigenen Videos (Vorschau im Dashboard).

    Gibt None zurück, wenn kein Video liegt — das ist kein Fehler, sondern der
    Normalzustand eines frisch angelegten Beitrags.
    """
    beitrag = _beitrag(db, post_id, affiliate_id)
    return _signieren(db, beitrag.get("video_path"))


def _signieren(db: Client, pfad: str | None) -> str | None:
    if not pfad:
        return None
    try:
        signiert = db.storage.from_(BUCKET).create_signed_url(pfad, SIGNATUR_SEKUNDEN)
    except Exception as exc:  # noqa: BLE001 — fehlende Datei darf die Liste nicht kippen
        log.warning("affiliate_video_signatur_fehlgeschlagen", pfad=pfad, error=str(exc)[:200])
        return None
    return (signiert or {}).get("signedURL") or (signiert or {}).get("signedUrl")


# --- Backoffice: prüfen -------------------------------------------------------


def _bo_beitrag(db: Client, post_id: str) -> dict[str, Any]:
    rows = (
        db.table("affiliate_posts").select("*").eq("id", post_id).limit(1).execute().data
        or []
    )
    if not rows:
        raise AffiliateError("Beitrag nicht gefunden.", status_code=404)
    return rows[0]


def bo_offene(db: Client, *, limit: int = 100) -> list[dict[str, Any]]:
    """Beiträge, die auf Prüfung warten — samt signierter Adresse zum Ansehen.

    Obergrenze fest (Wurzel 8): eine unbegrenzte Liste ist ein teurer Endpunkt,
    und jede Zeile erzeugt eine Signatur.
    """
    zeilen = fetch_all_rows(
        db.table("affiliate_posts")
        .select("*")
        .eq("review_status", "submitted")
        .order("video_uploaded_at", desc=False)
    )[: max(1, min(limit, 200))]
    if not zeilen:
        return []
    partner = {
        p["id"]: p
        for p in fetch_all_rows(
            db.table("affiliates")
            .select("id, full_name, company, email, status")
            .in_("id", sorted({z["affiliate_id"] for z in zeilen}))
        )
    }
    for z in zeilen:
        z["video_url"] = _signieren(db, z.get("video_path"))
        p = partner.get(z["affiliate_id"]) or {}
        z["partner_name"] = p.get("company") or p.get("full_name")
        z["partner_email"] = p.get("email")
    return zeilen


def bo_video_adresse(db: Client, post_id: str) -> str | None:
    """Signierte Adresse für das Backoffice (jeder Beitrag, nicht nur offene)."""
    return _signieren(db, _bo_beitrag(db, post_id).get("video_path"))


def freigeben(
    db: Client, post_id: str, *, admin_id: str, note: str | None = None
) -> dict[str, Any]:
    """Beitrag freigeben — ab jetzt baut `link_bauen` seinen Link.

    Nur aus 'submitted': eine Freigabe ohne eingereichtes Video wäre eine
    Freigabe ins Blaue. Aus 'rejected' geht es ebenfalls, weil ein Widerruf
    zurückgenommen werden können muss (das Video liegt ja noch).
    """
    beitrag = _bo_beitrag(db, post_id)
    stand = str(beitrag.get("review_status") or "draft")
    if stand == "approved":
        return beitrag  # idempotent (Wurzel 2): Doppelklick ändert nichts
    if stand == "draft" or not beitrag.get("video_path"):
        raise AffiliateError(
            "Für diesen Beitrag liegt kein Video vor.", status_code=409
        )
    jetzt = datetime.now(UTC).isoformat()
    db.table("affiliate_posts").update(
        {
            "review_status": "approved",
            "review_reason_code": None,
            "review_note": note,
            "reviewed_by": admin_id,
            "reviewed_at": jetzt,
            "updated_at": jetzt,
        }
    ).eq("id", post_id).execute()
    _protokoll(
        db,
        post_id=post_id,
        affiliate_id=beitrag["affiliate_id"],
        aktion="approved",
        note=note,
        actor=admin_id,
    )
    log.info("affiliate_video_freigegeben", post_id=post_id, by=admin_id)
    return _bo_beitrag(db, post_id)


def ablehnen(
    db: Client,
    post_id: str,
    *,
    admin_id: str,
    note: str,
    reason_code: str | None = None,
) -> dict[str, Any]:
    """Beitrag ablehnen. Grund UND Prüflisten-Kategorie sind PFLICHT (0526).

    Ohne Grund lädt der Partner dasselbe Video noch einmal hoch und wir prüfen
    es ein zweites Mal — eine Ablehnung ohne Begründung kostet beide Seiten
    Zeit und erzeugt keinen Lerneffekt. Ohne Kategorie ließe sich nicht
    auswerten, an welcher Content-Regel Beiträge scheitern.
    """
    if not (note or "").strip():
        raise AffiliateError(
            "Für die Ablehnung ist ein Grund erforderlich.", status_code=422
        )
    if reason_code not in ABLEHNUNGSGRUENDE:
        raise AffiliateError(
            "Für die Ablehnung ist eine Kategorie aus der Prüfliste erforderlich.",
            status_code=422,
        )
    beitrag = _bo_beitrag(db, post_id)
    jetzt = datetime.now(UTC).isoformat()
    db.table("affiliate_posts").update(
        {
            "review_status": "rejected",
            "review_reason_code": reason_code,
            "review_note": note.strip()[:2000],
            "reviewed_by": admin_id,
            "reviewed_at": jetzt,
            "updated_at": jetzt,
        }
    ).eq("id", post_id).execute()
    war_frei = str(beitrag.get("review_status") or "") == "approved"
    _protokoll(
        db,
        post_id=post_id,
        affiliate_id=beitrag["affiliate_id"],
        aktion="revoked" if war_frei else "rejected",
        note=note.strip()[:2000],
        reason_code=reason_code,
        actor=admin_id,
    )
    log.info(
        "affiliate_video_abgelehnt",
        post_id=post_id,
        by=admin_id,
        widerruf=war_frei,
    )
    return _bo_beitrag(db, post_id)


def link_erlaubt(beitrag: dict[str, Any]) -> bool:
    """Darf für diesen Beitrag ein Link gebaut werden?

    Die EINE Wahrheit dieser Regel. `beitraege.link_bauen` fragt sie, das
    Backoffice zeigt sie an, die Tests prüfen sie hier — damit die Antwort nicht
    an drei Stellen leicht verschieden ausfällt.
    """
    return str(beitrag.get("review_status") or "draft") == "approved"


def wartet_auf_video(beitrag: dict[str, Any]) -> bool:
    """True, solange der Partner am Zug ist (noch nichts eingereicht oder
    abgelehnt) — für die Anzeige „was muss ich tun"."""
    return str(beitrag.get("review_status") or "draft") in _OFFEN
