"""Datenzugriff der öffentlichen API.

Ein dünner Aufsatz auf `core/supabase.py` (Schwesterdatei der Haupt-API, die
Verbindungshärtung und `load_scoped` mitbringt). Hier steht nur, was für einen
ÖFFENTLICHEN Service zusätzlich gilt:

  * Fail-closed beim Start: fehlt der service_role-Key, liefert jeder Aufruf
    einen 503 statt einer Fehlermeldung aus der Bibliothek (Wurzel 5).
  * Jede Zeile wird per (id, tenant_id) geladen — service_role umgeht RLS,
    also erzwingt der Code den Mandanten (Wurzel 3). Es gibt hier bewusst
    keine Funktion, die ohne tenant_id lädt.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from . import errors
from .config import get_settings
from .supabase import get_service_client


def service_db() -> Client:
    """Supabase-Client mit service_role.

    RLS ist damit umgangen — jeder Aufruf MUSS selbst auf den Mandanten scopen.
    Ohne konfigurierten Key: 503, kein Client mit leerem Key (der würde erst
    tief in der Bibliothek scheitern, mit einer Meldung, die niemand versteht).
    """
    settings = get_settings()
    if not settings.supabase_service_role_key.get_secret_value():
        raise errors.nicht_konfiguriert(
            "Der Datenzugang ist auf diesem Server nicht eingerichtet."
        )
    return get_service_client()


def zeile_im_mandanten(
    db: Client,
    tabelle: str,
    row_id: str,
    tenant_id: str,
    *,
    spalten: str = "*",
    was: str = "Die angefragte Ressource",
) -> dict:
    """EINE Zeile per ID laden UND den Mandanten erzwingen — in einem Schritt.

    Wrapper um `supabase.load_scoped`, der den passenden problem+json-Fehler
    wirft. Getrennt in „laden, dann prüfen" lässt sich die Prüfung vergessen;
    deshalb gibt es hier keinen Weg, eine Zeile ohne tenant_id zu holen.

    Fremde Zeile und nicht existierende Zeile ergeben denselben 404 — ein 403
    für fremde Datensätze würde deren Existenz verraten.
    """
    from .supabase import load_scoped  # lokal: hält die Schwesterdatei unberührt

    return load_scoped(
        db,
        tabelle,
        row_id,
        tenant_id,
        columns=spalten,
        not_found=errors.nicht_gefunden(was),
    )


# Ein noch nicht ausgeführter PostgREST-Abfrage-Baukasten.
#
# `Any` mit Absicht und mit Namen: supabase-py exportiert die Builder-Typen
# nicht öffentlich (`SyncSelectRequestBuilder` liegt in einem privaten Modul und
# heißt je Version anders). Ein Import daraus wäre bei jedem Bibliotheks-Update
# ein Bruch. Der Alias hält wenigstens die ABSICHT lesbar — „hier kommt eine
# Abfrage" statt „hier kommt irgendwas".
Abfrage = Any
