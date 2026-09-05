"""Die Bewertungs-KI am Service — Katalog, Einstellungen, Probe, Takt.

Ein Mixin und keine Methoden in ``service.py``: der Service hat die
1500-Zeilen-Grenze erreicht, und dieser Block hängt an keiner seiner
Abfragen — er reicht nur den Scope (``_require`` / ``_require_write``) an
:class:`KiStore` durch. Genau dafür ist ein Mixin da: die Scope-Prüfung bleibt
EINE Stelle, der Rest zieht um.

Warum der Scope hier und nicht im Store: ``_require_write`` weiss, dass
Eigentümer read-only sind (§4.2). Der Store kennt nur einen ``tenant_id``. Die
Prüfung dort zu wiederholen hiesse, sie zweimal zu pflegen — und die zweite
Kopie vergisst irgendwann den Eigentümer-Fall.
"""

from __future__ import annotations

from collections.abc import Callable

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .ki_store import KiStore
from .queue import ReviewQueue
from .schemas import (
    KiDiagnose,
    KiKatalogAntwort,
    KiKatalogSpeichern,
    KiLaufErgebnis,
    KiProtokollList,
    KiSettings,
    KiTestAntwort,
    KiTestFrage,
)

log = get_logger("nextdays.reviews.ki_mixin")


class BewertungsKiMixin:
    """Katalog, Einstellungen, Probe und Takt. Teil von `ReviewsService`.

    Die drei Namen unten liefert der Service. Sie hier zu deklarieren ist
    keine Zierde: ohne sie liest jedes Werkzeug (und jeder Mensch) das Mixin
    als eigenständige Klasse mit fehlenden Methoden.
    """

    _db: Callable[[], Client]
    _require: Callable[[AuthContext], tuple[Client, str]]
    _require_write: Callable[[AuthContext], tuple[Client, str]]
    queue: Callable[[], ReviewQueue]

    def _ki(self, db: Client) -> KiStore:
        return KiStore(db)

    def ki_katalog(self, ctx: AuthContext) -> KiKatalogAntwort:
        """Der Haltungs-Katalog. Lesen darf, wer Bewertungen sehen darf."""
        db, tenant_id = self._require(ctx)
        return self._ki(db).katalog(tenant_id)

    def ki_katalog_speichern(self, ctx: AuthContext, req: KiKatalogSpeichern) -> KiKatalogAntwort:
        """Eine Katalogantwort setzen oder löschen. Eigentümer sind read-only
        (§4.2): der Katalog steuert, was im Namen des Betriebs öffentlich
        geschrieben wird."""
        db, tenant_id = self._require_write(ctx)
        return self._ki(db).katalog_speichern(tenant_id, req)

    def ki_settings(self, ctx: AuthContext) -> KiSettings:
        db, tenant_id = self._require(ctx)
        return self._ki(db).settings(tenant_id)

    def ki_settings_speichern(self, ctx: AuthContext, req: KiSettings) -> KiSettings:
        db, tenant_id = self._require_write(ctx)
        return self._ki(db).settings_speichern(tenant_id, req)

    def ki_testen(self, ctx: AuthContext, req: KiTestFrage) -> KiTestAntwort:
        """Die Probe. SENDET NICHTS — sie zeigt, was im Ernstfall passieren
        würde. `_require_write`, weil sie einen bezahlten Vertex-Aufruf
        auslöst: das ist eine Aktion, keine Ansicht (Wurzel 9)."""
        db, tenant_id = self._require_write(ctx)
        return self._ki(db).testen(tenant_id, req)

    def ki_protokoll(
        self, ctx: AuthContext, *, richtung: str | None = None, limit: int = 50
    ) -> KiProtokollList:
        db, tenant_id = self._require(ctx)
        return self._ki(db).protokoll(tenant_id, richtung=richtung, limit=limit)

    def ki_diagnose(self, ctx: AuthContext) -> KiDiagnose:
        """Warum jede offene Portal-Bewertung offen ist — lesend, gescopt."""
        from .ki_diagnose import diagnose

        db, tenant_id = self._require(ctx)
        return diagnose(db, tenant_id)

    def ki_lauf_jetzt(self, ctx: AuthContext) -> KiLaufErgebnis:
        """Den KI-Lauf für den EIGENEN Betrieb sofort fahren — statt auf den
        stündlichen Worker-Tick zu warten. Danach gehen fällige automatische
        Einträge dieses Betriebs im selben Zug raus (der Worker täte dasselbe).

        `_require_write`: bis zu 15 bezahlte Modellaufrufe und öffentliche
        Texte — eine Aktion, keine Ansicht (Wurzel 9). Eigener Rate-Limit-
        Eimer (`/reviews/ki/lauf`, Wurzel 8).
        """
        from .ki_lauf import BewertungsKiLauf

        db, tenant_id = self._require_write(ctx)
        antworten, bewertungen = BewertungsKiLauf(db).run(only_tenant=tenant_id)
        gesendet = self.queue().send_due(self, only_tenant=tenant_id)  # type: ignore[arg-type]
        return KiLaufErgebnis(antworten=antworten, gastbewertungen=bewertungen, gesendet=gesendet)

    def _ki_texte(self) -> int:
        """Den KI-Takt fahren. Best effort — kippt den Tick nie.

        Rückgabe: wie viele Entwürfe entstanden sind (beide Richtungen
        zusammen); sie zählen zu `queued`, weil es aus Sicht des Betriebs
        dasselbe ist: etwas steht neu in der Warteschlange.

        Ein nicht erreichbares Vertex oder ein erschöpfter Tagesdeckel darf
        Veröffentlichung, Spiegelung und Versand nicht verhindern (Wurzel 5).
        Der Fehler wird aber LAUT geloggt — eine KI, die still nichts tut,
        sieht aus wie eine, die nichts zu tun hatte.
        """
        try:
            antworten, bewertungen = self.ki_lauf()
        except Exception as exc:  # noqa: BLE001 — best effort, siehe Docstring
            log.warning(
                "review_tick_ki_lauf_fehlgeschlagen",
                grund=type(exc).__name__,
                fehler=str(exc)[:200],
            )
            return 0
        return antworten + bewertungen

    def ki_lauf(self) -> tuple[int, int]:
        """Den KI-Takt fahren (Worker/Cron, mandantenübergreifend).

        Rückgabe: (Antworten auf Gastbewertungen, Bewertungen über Gäste).
        """
        from .ki_lauf import BewertungsKiLauf

        return BewertungsKiLauf(self._db()).run()
