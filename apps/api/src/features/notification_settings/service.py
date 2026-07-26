"""Benachrichtigungs-Einstellungen — Lesen, Ändern und die Versand-Entscheidung.

Genau EINE Zeile pro Nutzer in public.notification_settings. Fehlt sie, gelten
die Spalten-Defaults; ein Update legt sie lazy per Upsert an. Scope IMMER auf
user_id (Wurzel 3) — der Service-Client umgeht RLS.

Zwei Regeln, die hier (nicht in der UI) durchgesetzt werden:

1. PFLICHT-E-MAILS: Bei Buchungs-/Kontoaktivität und Richtlinien lässt sich die
   E-Mail nicht abschalten (Katalog: email_pflicht). Ein PATCH, der es versucht,
   wird still auf `true` korrigiert — nicht abgelehnt, weil die UI den Schalter
   ohnehin gesperrt zeigt und ein 422 hier nur verwirren würde.

2. SAMMEL-OPT-OUT: `marketing_unsubscribed_all=true` schaltet ALLE Marketing-
   Kanäle mit aus (Wurzel 1: der Gegenzustand wird mitgepflegt, sonst behauptet
   das Flag etwas, das die Einzelspalten nicht hergeben). Schaltet der Nutzer
   einen Marketing-Kanal später wieder an, fällt das Flag automatisch.
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .katalog import (
    KATALOG,
    MARKETING_SPALTEN,
    PFLICHT_EMAIL_SPALTEN,
    SPALTEN,
    Kanal,
)
from .schemas import (
    KanalInfo,
    KategorieInfo,
    NotificationOverview,
    NotificationSettings,
    NotificationSettingsUpdate,
)

log = get_logger("nextdays.notification_settings")

_SELECT = ", ".join(SPALTEN)


class NotificationSettingsService:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Lesen --------------------------------------------------------------

    def get(self, ctx: AuthContext) -> NotificationSettings:
        """Präferenzen des eingeloggten Nutzers (Defaults, falls keine Zeile)."""
        row = (
            self._db.table("notification_settings")
            .select(_SELECT)
            .eq("user_id", ctx.user_id)
            .limit(1)
            .execute()
        ).data
        return NotificationSettings(**row[0]) if row else NotificationSettings()

    def overview(self, ctx: AuthContext) -> NotificationOverview:
        """Die Sicht für den Konto-Tab: jede Kategorie mit ihren Kanälen und der
        Information, welcher Schalter gesperrt ist. Die UI rendert genau das."""
        settings = self.get(ctx)
        kategorien = [
            KategorieInfo(
                schluessel=k.schluessel,
                tab=k.tab.value,
                gruppe=k.gruppe,
                kanaele=[
                    KanalInfo(
                        kanal=kanal.value,
                        aktiv=getattr(settings, k.spalte(kanal)),
                        aenderbar=not (k.email_pflicht and kanal is Kanal.EMAIL),
                    )
                    for kanal in k.kanaele
                ],
            )
            for k in KATALOG
        ]
        return NotificationOverview(
            kategorien=kategorien,
            marketing_unsubscribed_all=settings.marketing_unsubscribed_all,
        )

    # -- Schreiben ----------------------------------------------------------

    def update(
        self, ctx: AuthContext, patch: NotificationSettingsUpdate
    ) -> NotificationSettings:
        """Nur gesetzte Felder ändern (PATCH). Legt die Zeile lazy an."""
        changed: dict[str, bool] = patch.model_dump(exclude_none=True)
        if not changed:
            return self.get(ctx)

        changed = self._erzwinge_pflicht_mails(changed)
        changed = self._pflege_sammel_optout(ctx, changed)

        self._db.table("notification_settings").upsert(
            {
                "user_id": ctx.user_id,
                "updated_at": datetime.now(UTC).isoformat(),
                **changed,
            },
            on_conflict="user_id",
        ).execute()
        log.info(
            "notification_settings_updated",
            user_id=ctx.user_id,
            fields=sorted(changed),
        )
        return self.get(ctx)

    @staticmethod
    def _erzwinge_pflicht_mails(changed: dict[str, bool]) -> dict[str, bool]:
        """E-Mail bei Richtlinien/Kontoaktivität bleibt an — auch wenn der Client
        etwas anderes schickt (die UI zeigt den Schalter gesperrt)."""
        korrigiert = {
            spalte: (True if spalte in PFLICHT_EMAIL_SPALTEN else wert)
            for spalte, wert in changed.items()
        }
        blockiert = sorted(
            s for s, w in changed.items()
            if s in PFLICHT_EMAIL_SPALTEN and not w
        )
        if blockiert:
            log.info("notification_pflicht_mail_erzwungen", fields=blockiert)
        return korrigiert

    def _pflege_sammel_optout(
        self, ctx: AuthContext, changed: dict[str, bool]
    ) -> dict[str, bool]:
        """Gegenzustand des Sammel-Opt-outs (Wurzel 1).

        - Flag AN gesetzt  → alle Marketing-Kanäle mit ausschalten.
        - Marketing-Kanal AN gesetzt → Flag fällt, sonst widerspräche es den
          Einzelspalten.
        - Flag AUS gesetzt → Einzelspalten NICHT automatisch anschalten: welche
          der elf Kategorien der Nutzer zurückwill, weiß nur er (kein erfundener
          Zustand, Wurzel 4). Die UI schaltet sie einzeln.
        """
        flag = changed.get("marketing_unsubscribed_all")
        if flag is True:
            changed.update(dict.fromkeys(MARKETING_SPALTEN, False))
            return changed

        marketing_an = any(
            changed.get(spalte) for spalte in MARKETING_SPALTEN
        )
        if marketing_an and flag is None and self.get(ctx).marketing_unsubscribed_all:
            changed["marketing_unsubscribed_all"] = False
        return changed

    # -- Versand-Entscheidung ----------------------------------------------

    def soll_senden(self, user_id: str, schluessel: str, kanal: Kanal) -> bool:
        """Darf für diesen Nutzer über diesen Kanal gesendet werden?

        Die EINE Stelle, die der Versand fragt. Fehlt die Zeile, gelten die
        Defaults — es wird also gesendet, was ein neuer Nutzer erwarten würde.

        Fail-OPEN ist hier bewusst und nur für Pflicht-Mails relevant: Eine
        Buchungsbestätigung darf nicht ausbleiben, weil eine Präferenzzeile
        fehlt. Für alles andere entscheidet der gespeicherte Wert.
        """
        from .katalog import NACH_SCHLUESSEL  # noqa: PLC0415 — Zyklus vermeiden

        kategorie = NACH_SCHLUESSEL.get(schluessel)
        if kategorie is None:
            msg = f"Unbekannte Benachrichtigungs-Kategorie: {schluessel}"
            raise ValueError(msg)
        if kanal not in kategorie.kanaele:
            return False
        if kategorie.email_pflicht and kanal is Kanal.EMAIL:
            return True

        spalte = kategorie.spalte(kanal)
        row = (
            self._db.table("notification_settings")
            .select(spalte)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            return bool(getattr(NotificationSettings(), spalte))
        return bool(row[0].get(spalte))
