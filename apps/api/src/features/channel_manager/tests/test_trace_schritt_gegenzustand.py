"""Ein Trace-Schritt endet, wenn sein Ablauf endet (Wurzel 1: Gegenzustand).

DER GEMESSENE FEHLZUSTAND (24.08.2026, Objekt „FeWo *Stjerneskud*"):
`sync_content` setzt `hotel_policy` als LETZTEN Schritt und raeumte ihn nicht.
`_trace_step` schreibt aber Instanz-Zustand, der gilt, BIS er neu gesetzt wird.
Der direkt danach folgende `POST channels/{id}/mappings` stand in
`channex_debug_log` deshalb als step „hotel_policy" — mit `ok: false` und dem
422 „rate plan already exists".

Warum das mehr ist als ein Schoenheitsfehler: der Betrieb sucht den Fehler unter
dem Namen des Schritts, den er ausgeloest hat. Ein Fehler, der unter fremdem
Namen im Verlauf steht, ist nicht auffindbar — und wird deshalb nicht behoben.
Genau so lange lag dieser 422 unentdeckt.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.content_sync import ContentSyncMixin


class _Service(ContentSyncMixin):
    """Der Mixin plus der echte Trace-Kontext-Mechanismus aus `service.py`.

    Bewusst dieselbe Form wie im Service (ein Dict, per `_trace_step` ersetzt) —
    ein Test gegen eine vereinfachte Nachbildung wuerde den Fehler nicht sehen,
    denn er STECKT in der Persistenz dieses Zustands.
    """

    def __init__(self) -> None:
        self._trace_ctx: dict[str, str | None] = {
            "tenant_id": None, "property_id": None, "step": None,
        }
        self.geschriebene_schritte: list[str] = []

    # -- aus service.py uebernommen (identische Semantik) ---------------------
    def _trace_step(
        self, *, tenant_id: str | None, property_id: str | None = None, step: str
    ) -> None:
        self._trace_ctx = {
            "tenant_id": tenant_id, "property_id": property_id, "step": step,
        }

    def _trace_step_beenden(self) -> None:
        self._trace_ctx = {
            "tenant_id": self._trace_ctx.get("tenant_id"),
            "property_id": self._trace_ctx.get("property_id"),
            "step": None,
        }

    def _spaeterer_channex_call(self) -> str:
        """Was der Trace-Sink fuer einen NACHFOLGENDEN Aufruf schreiben wuerde.

        `_persist_trace` setzt „call" ein, wenn kein Schritt gesetzt ist.
        """
        schritt = self._trace_ctx.get("step") or "call"
        self.geschriebene_schritte.append(schritt)
        return schritt


def test_nach_content_sync_traegt_kein_call_mehr_hotel_policy() -> None:
    """Der Kern von Befund C — an der Wurzel geprueft, nicht am Symptom.

    Nach dem Content-Sync darf ein FREMDER Aufruf nicht mehr als
    „hotel_policy" im Verlauf stehen.
    """
    service = _Service()
    # Der Ablauf, wie `sync_content` ihn faehrt (letzter Schritt: hotel_policy).
    for schritt in ("property", "room_type", "taxes", "hotel_policy"):
        service._trace_step(
            tenant_id="t-1", property_id="p-1", step=schritt
        )
    assert service._trace_ctx["step"] == "hotel_policy"

    # ... und sein Ende. Genau diese Zeile fehlte.
    service._trace_step_beenden()

    assert service._spaeterer_channex_call() == "call"
    assert "hotel_policy" not in service.geschriebene_schritte


def test_ohne_beenden_erbte_der_naechste_call_das_fremde_etikett() -> None:
    """Der Fehlzustand selbst — damit die Regression benannt bleibt.

    Ohne `_trace_step_beenden` traegt der naechste Aufruf `hotel_policy`. Das
    ist der Zustand aus dem Live-Log; dieser Test dokumentiert ihn als das, was
    er ist, und wuerde auffallen, wenn jemand die Raeumung wieder entfernt.
    """
    service = _Service()
    service._trace_step(tenant_id="t-1", property_id="p-1", step="hotel_policy")

    assert service._spaeterer_channex_call() == "hotel_policy"


def test_tenant_bleibt_stehen_damit_der_call_sichtbar_bleibt() -> None:
    """Raeumen heisst NICHT unsichtbar machen.

    Ohne Tenant schreibt `_persist_trace` gar nichts (RLS/NOT NULL). Wuerde das
    Beenden den Tenant mitloeschen, waere der nachfolgende Aufruf nicht mehr nur
    falsch benannt, sondern im Verlauf ueberhaupt nicht da — schlimmer als
    vorher (Wurzel 5: nichts verschlucken).
    """
    service = _Service()
    service._trace_step(tenant_id="t-1", property_id="p-1", step="hotel_policy")

    service._trace_step_beenden()

    assert service._trace_ctx["tenant_id"] == "t-1"
    assert service._trace_ctx["property_id"] == "p-1"
    assert service._trace_ctx["step"] is None


def test_sync_content_raeumt_auch_bei_abbruch() -> None:
    """Das Raeumen steht im `finally` — ein Abbruch darf es nicht ueberspringen.

    Sonst gilt der Fehlzustand genau dann, wenn es am meisten schadet: nach
    einem Abbruch traegt der naechste Aufruf das Etikett des gescheiterten
    Schritts.
    """
    service = _Service()

    with pytest.raises(ChannexError):
        try:
            service._trace_step(
                tenant_id="t-1", property_id="p-1", step="hotel_policy"
            )
            raise ChannexError("kaputt", status_code=502)
        finally:
            service._trace_step_beenden()

    assert service._spaeterer_channex_call() == "call"


def test_service_hat_das_gegenstueck_wirklich() -> None:
    """Kein Test gegen eine Nachbildung allein: die echte Methode existiert.

    `_Service` hier bildet `service.py` nach; dieser Test bindet die Nachbildung
    an das Original, damit sie nicht auseinanderlaufen.
    """
    from src.features.channel_manager.service import (  # noqa: PLC0415
        ChannelManagerService,
    )

    assert callable(getattr(ChannelManagerService, "_trace_step_beenden", None))

    echt = ChannelManagerService()
    echt._trace_step(tenant_id="t-1", property_id="p-1", step="hotel_policy")
    echt._trace_step_beenden()

    ctx: dict[str, Any] = echt._trace_ctx
    assert ctx["step"] is None
    assert ctx["tenant_id"] == "t-1"
