"""Projektweite Test-Fixtures.

Trennung:
- Unit-/Contract-Tests laufen immer (Supabase-Client gemockt).
- Integration-Tests (Marker `integration`) brauchen einen laufenden Supabase-Stack
  und werden übersprungen, wenn er nicht erreichbar ist.
"""
import os
import socket
from unittest.mock import MagicMock
from urllib.parse import urlparse

import pytest


def _supabase_reachable() -> bool:
    url = os.environ.get("SUPABASE_URL", "http://localhost:54321")
    parsed = urlparse(url)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except OSError:
        return False


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    if _supabase_reachable():
        return
    skip = pytest.mark.skip(reason="Supabase-Stack nicht erreichbar")
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip)


@pytest.fixture
def mock_supabase() -> MagicMock:
    """Fluent-Mock für supabase Client: table().insert().execute() etc."""
    client = MagicMock(name="supabase_client")
    return client
