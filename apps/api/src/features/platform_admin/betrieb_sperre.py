"""Betrieb sperren, entsperren, loeschen (0405).

Eigenes Modul und nicht Teil von ``service.py``: der Slice-Service ist mit rund
1600 Zeilen die groesste Datei des Backoffice, und diese drei Vorgaenge haengen
inhaltlich zusammen, aber an nichts anderem dort. Freie Funktionen statt einer
zweiten Klasse — wie ``ereignis_erledigen``: sie brauchen keinen Zustand,
sondern den DB-Client und einen Weg, den Vorgang zu protokollieren.

DIE DREI RIEGEL (Wurzel 7), wie bei der Nutzer-Sperre (0356, siehe
``features/auth/aktiv_gate.py``):
  1. ``tenants.deactivated_at`` — die Wahrheit, die alle anderen lesen.
  2. GoTrue-``ban_duration`` je Nutzer — schliesst den Direktpfad
     ``POST /auth/v1/token`` mit anon-Key, der FastAPI komplett umgeht.
  3. ``aktiv_gate`` in ``core.security`` — killt bereits ausgestellte Tokens
     sofort statt erst nach bis zu einer Stunde Restlaufzeit.
Riegel 1 und 2 passieren hier, Riegel 3 liegt im Gate. Dazu kommt der
Marktplatz-Filter in ``booking_engine.list_listings``, damit ein gesperrter
Betrieb nicht buchbar bleibt.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol

from supabase import Client

from src.core.logging import get_logger
from src.core.security import PlatformContext

from .schemas import BetriebLoeschenResponse, BetriebSperreResponse

log = get_logger("nextdays.platform_admin.betrieb")

LOGIN_SPERRE_DAUER = "876000h"  # 100 Jahre — wie AccountService (0356)


class Protokoll(Protocol):  # pylint: disable=too-few-public-methods
    """Signatur von ``PlatformAdminService.log_action``.

    Als Protokoll statt Import, damit dieses Modul den Service nicht kennen
    muss (der Service kennt es) — sonst entstuende ein Zirkel.
    """

    def __call__(
        self,
        ctx: PlatformContext,
        action: str,
        *,
        target_type: str | None = None,
        target_id: str | None = None,
        tenant_id: str | None = None,
        detail: dict | None = None,
    ) -> None: ...


class BetriebNameFalsch(Exception):
    """Die Tippbestaetigung beim Loeschen passte nicht zum Betriebsnamen.

    Eigene Klasse statt HTTPException: dieses Modul kennt kein HTTP, und der
    Router entscheidet, dass daraus ein 422 wird.
    """

    def __init__(self, erwartet: str) -> None:
        super().__init__("Name stimmt nicht ueberein")
        self.erwartet = erwartet


# -- Sperren / Entsperren ----------------------------------------------------


def betrieb_sperren(
    db: Client,
    ctx: PlatformContext,
    tenant_id: str,
    *,
    reason: str,
    protokoll: Protokoll,
) -> BetriebSperreResponse | None:
    """Betrieb stilllegen: kein Login, keine Objekte auf dem Marktplatz.

    Gibt ``None`` zurueck, wenn es den Betrieb nicht gibt (der Router macht
    daraus 404). Ein bereits gesperrter Betrieb wird erneut geschrieben —
    idempotent (Wurzel 2): Doppelklick und Retry aktualisieren Grund und
    Zeitpunkt, statt zu scheitern.
    """
    row = _tenant_row(db, tenant_id)
    if row is None:
        return None
    jetzt = datetime.now(UTC).isoformat()
    db.table("tenants").update(
        {
            "deactivated_at": jetzt,
            "deactivated_by": ctx.user_id,
            "deactivation_reason": reason,
        }
    ).eq("id", tenant_id).execute()

    user_ids = _tenant_user_ids(db, tenant_id)
    gesperrt = sum(1 for uid in user_ids if _login_sperren(db, uid))
    protokoll(
        ctx,
        "tenant.sperren",
        target_type="tenant",
        target_id=tenant_id,
        tenant_id=tenant_id,
        detail={
            "reason": reason,
            "nutzer": len(user_ids),
            "login_gesperrt": gesperrt,
        },
    )
    return BetriebSperreResponse(
        id=tenant_id,
        deactivated_at=jetzt,
        deactivation_reason=reason,
        betroffene_nutzer=len(user_ids),
        login_gesperrt=gesperrt,
    )


def betrieb_entsperren(
    db: Client,
    ctx: PlatformContext,
    tenant_id: str,
    *,
    protokoll: Protokoll,
) -> BetriebSperreResponse | None:
    """Sperre aufheben — Login und Marktplatz-Sichtbarkeit kommen zurueck.

    Der Zustand der Objekte wurde beim Sperren NICHT angefasst (der Filter
    sitzt im booking_engine), deshalb steht danach wieder genau das, was der
    Betrieb selbst gesetzt hatte — nichts muss rekonstruiert werden.

    Nutzer, die der Betrieb selbst deaktiviert hat (0356), bleiben
    deaktiviert: ihr ``users.deactivated_at`` steht unabhaengig davon, und das
    aktiv_gate liest es weiter.
    """
    row = _tenant_row(db, tenant_id)
    if row is None:
        return None
    db.table("tenants").update(
        {
            "deactivated_at": None,
            "deactivated_by": None,
            "deactivation_reason": None,
        }
    ).eq("id", tenant_id).execute()

    user_ids = _tenant_user_ids(db, tenant_id)
    entsperrt = sum(1 for uid in user_ids if _login_entsperren(db, uid))
    protokoll(
        ctx,
        "tenant.entsperren",
        target_type="tenant",
        target_id=tenant_id,
        tenant_id=tenant_id,
        detail={"nutzer": len(user_ids), "login_entsperrt": entsperrt},
    )
    return BetriebSperreResponse(
        id=tenant_id,
        deactivated_at=None,
        deactivation_reason=None,
        betroffene_nutzer=len(user_ids),
        login_gesperrt=entsperrt,
    )


# -- Loeschen ----------------------------------------------------------------


def betrieb_loeschen(
    db: Client,
    ctx: PlatformContext,
    tenant_id: str,
    *,
    name_bestaetigung: str,
    protokoll: Protokoll,
) -> BetriebLoeschenResponse | None:
    """Betrieb endgueltig entfernen. Unumkehrbar.

    REIHENFOLGE IST PFLICHT, NICHT STIL: 154 der 155 Fremdschluessel auf
    ``tenants`` kaskadieren — aber ``reservations.property_id`` ist
    ON DELETE RESTRICT (0004). Ein direktes ``delete from tenants`` haengt
    damit an der Aufloesungsreihenfolge von Postgres. Deshalb erst
    Reservierungen, dann Objekte, dann der Betrieb — dieselbe Reihenfolge,
    die ``scripts/platform/golive_bereinigung.sql`` dokumentiert.

    WAS DIESE FUNKTION NICHT KANN und im Ergebnis benennt (Wurzel 5, kein
    stilles „done"):
      - Ein Stripe-Abo muss dort separat gekuendigt werden.
      - Objekte bleiben im Portal-Backend (Channex) als Waisen stehen.
      - Bilder im Storage haengen an keinem Fremdschluessel.
    """
    row = _tenant_row(db, tenant_id)
    if row is None:
        return None
    name = str(row.get("name") or "")
    # Tippbestaetigung gegen den Fehlgriff (nicht gegen Angreifer — wer hier
    # ankommt, ist Plattform-Admin). Exakt, nur Rand-Leerraum toleriert.
    if name_bestaetigung.strip() != name.strip():
        raise BetriebNameFalsch(name)

    property_ids = _property_ids(db, tenant_id)
    user_ids = _tenant_user_ids(db, tenant_id)

    reservierungen = 0
    objekte = 0
    if property_ids:
        res = (
            db.table("reservations")
            .delete(count="exact")
            .in_("property_id", property_ids)
            .execute()
        )
        reservierungen = res.count or 0
        res = (
            db.table("properties")
            .delete(count="exact")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        objekte = res.count or 0
    db.table("tenants").delete().eq("id", tenant_id).execute()

    # Auth-User zuletzt: ``public.users`` haengt per Kaskade am Tenant und ist
    # damit schon weg, der GoTrue-Zugang aber nicht — sonst bliebe ein
    # anmeldbarer Login ohne jede Zeile dahinter zurueck.
    geloeschte_nutzer = 0
    for uid in user_ids:
        try:
            db.auth.admin.delete_user(uid)
            geloeschte_nutzer += 1
        except Exception as exc:  # noqa: BLE001 — Teilerfolg melden, nicht kippen
            log.warning(
                "tenant_auth_user_delete_failed",
                user_id=uid,
                error=str(exc)[:200],
            )

    hinweise = _hinweise(
        offene_zugaenge=len(user_ids) - geloeschte_nutzer, objekte=objekte
    )
    protokoll(
        ctx,
        "tenant.loeschen",
        target_type="tenant",
        target_id=tenant_id,
        tenant_id=tenant_id,
        detail={
            "name": name,
            "reservierungen": reservierungen,
            "objekte": objekte,
            "nutzer": geloeschte_nutzer,
        },
    )
    return BetriebLoeschenResponse(
        id=tenant_id,
        name=name,
        reservierungen=reservierungen,
        objekte=objekte,
        nutzer=geloeschte_nutzer,
        hinweise=hinweise,
    )


def _hinweise(*, offene_zugaenge: int, objekte: int) -> list[str]:
    """Was NICHT mitgeloescht wurde — gehoert ins Ergebnis, nicht in ein Log."""
    hinweise: list[str] = []
    if offene_zugaenge > 0:
        hinweise.append(
            f"{offene_zugaenge} Anmeldezugang/-zugaenge konnten nicht "
            "entfernt werden."
        )
    hinweise.append("Ein Stripe-Abo muss in Stripe separat gekuendigt werden.")
    if objekte:
        hinweise.append(
            "Objekte im Portal-Backend (Channex) bleiben bestehen und muessen "
            "dort entfernt werden."
        )
        hinweise.append(
            "Bilder im Storage haengen an keinem Fremdschluessel und bleiben "
            "liegen."
        )
    return hinweise


# -- Helfer ------------------------------------------------------------------


def _tenant_row(db: Client, tenant_id: str) -> dict | None:
    """Rohzeile eines Betriebs oder ``None``."""
    res = (
        db.table("tenants")
        .select("id, name, deactivated_at")
        .eq("id", tenant_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def _tenant_user_ids(db: Client, tenant_id: str) -> list[str]:
    """Auth-User-IDs aller Nutzer dieses Betriebs."""
    res = db.table("users").select("id").eq("tenant_id", tenant_id).execute()
    return [str(r["id"]) for r in (res.data or []) if r.get("id")]


def _property_ids(db: Client, tenant_id: str) -> list[str]:
    """IDs aller Objekte dieses Betriebs."""
    res = db.table("properties").select("id").eq("tenant_id", tenant_id).execute()
    return [str(r["id"]) for r in (res.data or []) if r.get("id")]


def _login_sperren(db: Client, user_id: str) -> bool:
    """GoTrue-Bann setzen. ``True`` = der Anmeldedienst hat uebernommen.

    Kein Weiterwerfen: das Feld steht schon, und das aktiv_gate haelt den
    Zugang auch ohne Bann dicht. Ein harter Fehler hier wuerde einen wirksamen
    Vorgang als gescheitert melden. Der Rueckgabewert wird gezaehlt und in der
    Oberflaeche benannt — nicht verschluckt (Wurzel 5: best-effort ist erlaubt,
    stilles „done" nicht).
    """
    try:
        db.auth.admin.update_user_by_id(
            user_id, {"ban_duration": LOGIN_SPERRE_DAUER}
        )
        return True
    except Exception as exc:  # noqa: BLE001 — Teilerfolg melden, nicht kippen
        log.warning(
            "tenant_login_ban_failed", user_id=user_id, error=str(exc)[:200]
        )
        return False


def _login_entsperren(db: Client, user_id: str) -> bool:
    """GoTrue-Bann aufheben („none" ist der dokumentierte Aus-Wert)."""
    try:
        db.auth.admin.update_user_by_id(user_id, {"ban_duration": "none"})
        return True
    except Exception as exc:  # noqa: BLE001 — Teilerfolg melden, nicht kippen
        log.warning(
            "tenant_login_unban_failed", user_id=user_id, error=str(exc)[:200]
        )
        return False
