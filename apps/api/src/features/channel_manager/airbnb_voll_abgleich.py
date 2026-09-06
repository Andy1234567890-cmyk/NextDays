"""Voll-Abgleich am Airbnb-Kanal: erst ALLES aus Airbnb holen, dann schicken.

Eigenes Modul, weil `airbnb_objekt_abruf.py` an der 1500-Zeilen-Grenze steht —
der Abruf selbst (`airbnb_objekt_abrufen`) bleibt dort, hier steht nur die
Klammer, die ihn mit dem Voll-Push verbindet. Warum es die Klammer gibt, steht
am Einstieg unten.
"""
from __future__ import annotations

from typing import Any

from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import ChannelManagerError, log


class AirbnbVollAbgleichMixin:
    """Voll-Abgleich eines Airbnb-Objekts: Airbnb → wir → Portale."""

    def airbnb_voll_abgleich(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """„Voll-Abgleich" auf der Airbnb-Kanalseite: erst Airbnb → wir, dann
        wir → Portale — für GENAU dieses Objekt.

        Bis zum 06.09.2026 war der Knopf am Airbnb-Kanal derselbe wie bei
        Booking.com: ein reiner PUSH (Verfügbarkeit 500 Tage, Preise,
        Restriktionen) plus Buchungen und Gespräche zurück. Für ein frisch
        verbundenes Inserat kam dabei sichtbar „nichts": Fotos, Texte,
        Ausstattung, Zimmer und Regeln liegen bei Airbnb, und die holte nur der
        Knopf „Bei Airbnb abrufen" auf der Objektseite. Der Betrieb erwartet
        vom Voll-Abgleich beides — Airbnb ist der einzige Kanal, der Inhalte
        HERGIBT, also holt der Voll-Abgleich sie dort auch.

        Scheitert das Einreihen des Pushs, geht der Bericht über das Geholte
        nicht verloren: `push_eingereiht: false` + Grund im Hinweis (Wurzel 5).
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        try:
            ergebnis = self.airbnb_objekt_abrufen(ctx, property_id)
        except ChannexError as exc:
            # Der Abruf reicht Channex-Fehler roh weiter (z. B. 422 „Room type
            # photos limit exceeded") — auf der Kanalseite muss daraus eine
            # lesbare Antwort werden, kein 500.
            raise self._wrap_channex(exc) from exc  # type: ignore[attr-defined]
        try:
            self._voll_push_einreihen(db, tenant_id, property_id)  # type: ignore[attr-defined]
        except ChannelManagerError as exc:
            log.warning(
                "airbnb_voll_abgleich_push_nicht_eingereiht",
                tenant_id=tenant_id, property_id=property_id, fehler=exc.message,
            )
            hinweis = ergebnis.get("hinweis")
            return {
                **ergebnis,
                "push_eingereiht": False,
                "hinweis": f"{hinweis} {exc.message}" if hinweis else exc.message,
            }
        log.info(
            "airbnb_voll_abgleich_fertig",
            tenant_id=tenant_id, property_id=property_id,
            fotos=ergebnis.get("fotos_uebernommen"),
            felder=len(ergebnis.get("uebernommene_felder") or []),
            preis_uebernommen=ergebnis.get("preis_uebernommen"),
        )
        return {**ergebnis, "push_eingereiht": True}
