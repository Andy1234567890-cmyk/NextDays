"""Den Portalzugang eines Eigentümers auflösen, wenn er gelöscht wird.

WARUM ES DIESEN WEG BRAUCHT: `owners.user_id` verweist auf einen echten Login
(`public.users` + `auth.users`) und auf dessen Portal-Sicht
(`owner_property_assignments`, 0058). Das Löschen des Eigentümers räumte
bislang nur die `owners`-Zeile weg — der Login blieb stehen. Zwei Folgen, beide
live aufgetreten (10.08.2026):

1. SICHERHEIT: Ein gelöschter Eigentümer konnte sich weiter anmelden und sah
   über seine gebliebenen Assignments weiter fremde Objekte.
2. KEINE EINLADUNGSMAIL: Wurde derselbe Eigentümer neu angelegt, fand
   `_portalzugang_einrichten` den übrig gebliebenen Login zu seiner Adresse
   und VERKNÜPFTE ihn nur, statt einzuladen (der Idempotenz-Zweig gegen
   Doppelklicks). Es ging keine Mail raus, und der Betrieb wartete auf eine
   Einladung, die nie kommen konnte.

REIHENFOLGE (wie `AccountService.delete_managed_user`): erst der Auth-Login,
dann die Zeilen. Scheitert etwas dazwischen, ist der Login schon weg — der
Vorgang ist wiederholbar und hinterlässt keinen Halbzustand, in dem sich
jemand noch anmelden kann.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.owners.portalzugang")


def portalzugang_entfernen(
    db: Client, tenant_id: str, user_id: str, *, fehler: type[Exception]
) -> None:
    """Login und Portal-Sicht dieses Eigentümers entfernen.

    Tenant-gescopt (Wurzel 3): beide Löschungen tragen `tenant_id`, der
    `user_id` stammt aus der bereits gescopten `owners`-Zeile.

    Der Auth-Login ist der EINZIGE Schritt, der hart fehlschlagen darf: bleibt
    er stehen, kann sich ein gelöschter Eigentümer weiter anmelden. Genau
    deshalb wird er zuerst und nicht best-effort gemacht (Wurzel 5:
    fail-closed, kein stilles „done").
    """
    try:
        db.auth.admin.delete_user(user_id)
    except Exception as exc:  # noqa: BLE001 — SDK-Fehler einheitlich melden
        log.warning(
            "owner_login_delete_failed",
            tenant_id=tenant_id,
            user_id=user_id,
            error=str(exc)[:200],
        )
        raise fehler(
            "Der Portalzugang des Eigentümers konnte nicht gelöscht werden.",
            status_code=502,
        ) from exc

    # Familienzugänge dieses Eigentümers ZUERST (0389), samt ihrer Sicht.
    #
    # Wurzel 1, und hier besonders heimtückisch: Die owner_family_members-Zeilen
    # verschwinden ohnehin per Cascade (FK owner_user_id). Ihre
    # owner_property_assignments tun das NICHT — und ein Login mit Objektsicht,
    # aber OHNE Familien-Zeile ist im ganzen Code die Definition von „das ist
    # der Eigentümer selbst": `_darf_berichte` gibt ihm die Finanzen frei,
    # `_freigabe_stufe` schickt seine Sperranträge ohne Stufe 1 direkt an die
    # Agentur. Löschen würde also RECHTE AUSWEITEN, statt sie zu entziehen.
    familie = (
        db.table("owner_family_members")
        .select("user_id")
        .eq("tenant_id", tenant_id)
        .eq("owner_user_id", user_id)
        .execute()
    ).data or []
    mitglieder = {str(r["user_id"]) for r in familie}
    for mitglied in mitglieder:
        db.table("owner_property_assignments").delete().eq(
            "tenant_id", tenant_id
        ).eq("user_id", mitglied).execute()
    if mitglieder:
        log.info(
            "owner_familie_mitentfernt",
            tenant_id=tenant_id,
            anzahl=len(mitglieder),
        )

    # Portal-Sicht (0058) zuerst: sie hängt am Login, nicht am Eigentümer, und
    # verschwindet daher nicht mit dessen Cascade. Bliebe sie stehen, trüge ein
    # später mit derselben Adresse angelegter Login die alte Objektsicht.
    sicht = (
        db.table("owner_property_assignments")
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .execute()
    ).data or []

    db.table("users").delete().eq("id", user_id).eq(
        "tenant_id", tenant_id
    ).execute()

    log.info(
        "owner_login_deleted",
        tenant_id=tenant_id,
        user_id=user_id,
        assignments=len(sicht),
    )
