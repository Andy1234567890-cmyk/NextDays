"""Zusatzleistungen uebersetzen — Teil von `AddonsService`.

Eigene Datei aus demselben Grund wie `verteilung.py` daneben: `service.py`
traegt bereits Katalog-CRUD, Medien, Verkauf und Storno. Ein fuenfter
Themenblock darin waere die Datei, die niemand mehr liest — sie lief mit dieser
Methode auf 1574 Zeilen und damit ueber die pylint-Grenze. Die Grenze ist
nicht der Grund fuer die Trennung, sie war der Anlass, sie zu bemerken.

Die eigentliche Uebersetzungsarbeit steht in `uebersetzung.py`; hier ist nur
die Verdrahtung: Scope, Sprachpruefung, Tagesdeckel, Nutzungsbuchung.
"""
from __future__ import annotations

from src.core.ki import KiError, VertexClient
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.site_config import ki_nutzung

from .schemas import AddonUebersetzenRequest
from .uebersetzung import (
    SPRACHEN,
    AddonUebersetzungError,
    addon_uebersetzen,
    gleiche_quelltexte,
)

log = get_logger("nextdays.addons.uebersetzung_mixin")


class UebersetzungMixin:
    """Der Uebersetzungslauf einer Zusatzleistung. Teil von `AddonsService`."""

    def uebersetzen(
        self, ctx: AuthContext, addon_id: str, req: AddonUebersetzenRequest
    ) -> dict:
        """Diese Zusatzleistung in weitere Sprachen bringen.

        Anders als `_regel_uebersetzen` bei den Aufgabenregeln ist das hier
        KEIN stiller Gegenzustand des Speicherns, sondern eine ausdrueckliche
        Handlung mit eigenem Knopf. Der Grund ist der Kostenunterschied: ein
        Regelname ist ein Wort, eine Zusatzleistung traegt eine Beschreibung
        von mehreren hundert Zeichen. Bei jedem Tastendruck auf „Speichern“
        23 Aufrufe zu starten waere Geld fuer nichts — der Bearbeiter tippt
        oft mehrfach, bevor der Text steht.

        WELCHE SPRACHEN: Standard sind alle 24. Auch das ist bewusst anders
        als bei den Regeln, wo nur die Sprachen der eigenen Nutzer uebersetzt
        werden — dort liest das PERSONAL, hier der GAST, und der Betrieb kennt
        seine kuenftigen Gaeste nicht. Ein Objekt, das auf myBestDays und den
        Portalen steht, kann von jedem EU-Bürger gefunden werden.
        """
        tenant_id = self._require_tenant(ctx)
        row = self._get_addon(tenant_id, addon_id)

        quelle = (req.quelle or "").strip().lower()
        if quelle not in SPRACHEN:
            raise self._fehler(
                f"„{req.quelle}“ ist keine der 24 EU-Amtssprachen.",
                status_code=422,
            )
        ziele = [z.strip().lower() for z in (req.ziele or []) if z and z.strip()]
        unbekannt = [z for z in ziele if z not in SPRACHEN]
        if unbekannt:
            # 422 statt stiller Uebersprung: eine Sprache, die niemand kennt,
            # ist ein Fehler des Aufrufers und keine leere Ergebnismenge
            # (Wurzel 4/5).
            raise self._fehler(
                f"Unbekannte Zielsprache(n): {', '.join(sorted(unbekannt))}.",
                status_code=422,
            )
        ziele = ziele or list(SPRACHEN)

        client = VertexClient()
        if not client.is_configured:
            # Laut, nicht still. Eine fehlende Konfiguration, die schweigt,
            # sieht fuer den Bearbeiter aus wie „es gab nichts zu tun“
            # (Wurzel 5) — er klickte weiter und wunderte sich.
            log.warning("addon_uebersetzung_ohne_vertex", extra={"addon_id": addon_id})
            raise self._fehler(
                "Die Übersetzung ist für dieses System nicht eingerichtet.",
                status_code=503,
            )

        geschwister: list[dict] = []
        if req.geschwister:
            geschwister = gleiche_quelltexte(self._db, tenant_id, row, quelle)

        def _deckel() -> None:
            """Vor JEDEM Modellaufruf, nicht einmal vorab.

            Ein Lauf ueber 23 Sprachen sind 23 Aufrufe; ein einmaliger Check
            am Anfang liesse 22 davon ueber den Deckel laufen.
            """
            ki_nutzung.deckel_pruefen(self._db, tenant_id)

        try:
            lauf, antworten = addon_uebersetzen(
                client,
                self._db,
                row,
                ziele,
                quelle=quelle,
                geschwister=geschwister,
                deckel=_deckel,
            )
        except AddonUebersetzungError as exc:
            raise self._fehler(str(exc), status_code=422) from exc
        except KiError as exc:
            if exc.status_code != 429:
                # 429 vom Tagesdeckel NICHT als fehlgeschlagenen Aufruf buchen:
                # es wurde nichts aufgerufen. Alles andere schon.
                ki_nutzung.fehler_buchen(
                    self._db,
                    tenant_id,
                    user_id=ctx.user_id,
                    funktion="addon_uebersetzen",
                    modell=client.modell,
                    region=client.region,
                    grund=str(exc),
                )
            raise self._fehler(str(exc), status_code=exc.status_code) from exc

        for antwort in antworten:
            ki_nutzung.buchen(
                self._db,
                tenant_id,
                user_id=ctx.user_id,
                funktion="addon_uebersetzen",
                antwort=antwort,
            )

        # Die Zeile NEU lesen: `addon_uebersetzen` hat sie geschrieben, und die
        # Oberflaeche soll den echten Stand bekommen, nicht den von vorher
        # (sonst zeigte sie nach dem Lauf noch die alten zwei Sprachen).
        frisch = self._get_addon(tenant_id, addon_id)
        return {
            "uebersetzt": lauf.uebersetzt,
            "vorhanden": lauf.vorhanden,
            "fehlgeschlagen": lauf.fehlgeschlagen,
            "zeilen": lauf.zeilen,
            "addon": self._zeile(frisch),
        }

    @staticmethod
    def _zeile(row: dict) -> dict:
        """Die DB-Zeile in die Katalog-Form bringen.

        Wie `_fehler` erst im Rumpf importiert (Zyklus, s. dort). Eine zweite
        Glaettung hier zu schreiben waere die zweite Stelle, an der entschieden
        wird, wie eine Zusatzleistung nach aussen aussieht.
        """
        from .service import _addon_row  # pylint: disable=import-outside-toplevel

        return _addon_row(row)

    @staticmethod
    def _fehler(message: str, *, status_code: int) -> Exception:
        """`AddonError` erst hier holen.

        Auf Modulebene importiert waere es ein Zyklus: `service` importiert
        dieses Mixin, um es in die Klasse zu mischen. Der Import im Rumpf ist
        kein Trick, sondern die uebliche Aufloesung — und er laeuft nur im
        Fehlerfall.
        """
        from .service import AddonError  # pylint: disable=import-outside-toplevel

        return AddonError(message, status_code=status_code)
