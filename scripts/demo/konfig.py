"""Zugriff auf Supabase (PostgREST, Storage, GoTrue) für den Demo-Seed.

Der Seed läuft mit dem Service-Role-Key und umgeht damit RLS — er ist ein
Betriebs-Werkzeug, kein Anwendungspfad. Genau deshalb schreibt er ausschließlich
in die beiden Demo-Tenants und identifiziert JEDE Zeile über eine deterministisch
aus dem Namen abgeleitete UUID (uuid5): ein zweiter Lauf trifft dieselben IDs,
legt also nichts doppelt an (Wurzel 2 — real kommt alles doppelt).

Zugangsdaten kommen NUR aus der Umgebung bzw. aus `apps/api/.env` — nie aus einer
Repo-Datei (siehe CLAUDE.md „Nicht tun").
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

# Fester Namensraum für alle Demo-IDs. Der Wert selbst ist beliebig, aber
# unveränderlich: er ist die Klammer, die „gleicher Name = gleiche Zeile" hält.
NAMESPACE = uuid.UUID("6f9d1f2e-3c8a-5b47-9d0e-2a1c4b6d8e05")

REPO_ROOT = Path(__file__).resolve().parents[2]
BUCKET = "property-images"


def demo_id(schluessel: str) -> str:
    """Deterministische UUID für einen fachlichen Schlüssel („objekt:sylt")."""
    return str(uuid.uuid5(NAMESPACE, f"nextdays-demo:{schluessel}"))


class Supabase:
    """Dünner Client für die drei Supabase-Schnittstellen, die der Seed braucht.

    Bewusst kein supabase-py: der Seed spricht neben PostgREST auch Storage und
    die GoTrue-Admin-API, und für alle drei ist derselbe httpx-Client mit
    denselben Headern das Einfachste, was funktioniert.
    """

    def __init__(self) -> None:
        load_dotenv(REPO_ROOT / "apps" / "api" / ".env")
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise SystemExit(
                "SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY fehlen "
                "(weder in der Umgebung noch in apps/api/.env)."
            )
        self.url = url.rstrip("/")
        self._key = key
        self._client = httpx.Client(timeout=60.0)

    # ── PostgREST ────────────────────────────────────────────────────────────
    @property
    def _rest_headers(self) -> dict[str, str]:
        return {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }

    def upsert(self, tabelle: str, zeilen: list[dict[str, Any]],
               konflikt: str = "id") -> list[dict[str, Any]]:
        """Idempotenter Insert: bei Kollision auf `konflikt` wird aktualisiert."""
        if not zeilen:
            return []
        antwort = self._client.post(
            f"{self.url}/rest/v1/{tabelle}",
            params={"on_conflict": konflikt},
            headers={
                **self._rest_headers,
                "Prefer": "return=representation,resolution=merge-duplicates",
            },
            json=zeilen,
        )
        self._pruefen(antwort, f"upsert {tabelle}")
        return antwort.json()

    def update(self, tabelle: str, werte: dict[str, Any], **filter_: str) -> None:
        """Teil-Update einer Zeile.

        Nicht über `upsert`: ein Insert mit nur zwei Spalten scheitert an den
        NOT-NULL-Spalten der Tabelle, bevor PostgREST überhaupt zum
        ON-CONFLICT-Zweig kommt.
        """
        antwort = self._client.patch(
            f"{self.url}/rest/v1/{tabelle}",
            params=filter_,
            headers=self._rest_headers,
            json=werte,
        )
        self._pruefen(antwort, f"update {tabelle}")

    def select(self, tabelle: str, **filter_: str) -> list[dict[str, Any]]:
        """Zeilen einer Tabelle lesen; Filter als PostgREST-Ausdrücke."""
        antwort = self._client.get(
            f"{self.url}/rest/v1/{tabelle}",
            params={"select": "*", **filter_},
            headers=self._rest_headers,
        )
        self._pruefen(antwort, f"select {tabelle}")
        return antwort.json()

    def delete(self, tabelle: str, **filter_: str) -> None:
        """Zeilen löschen; Filter als PostgREST-Ausdrücke."""
        antwort = self._client.delete(
            f"{self.url}/rest/v1/{tabelle}",
            params=filter_,
            headers=self._rest_headers,
        )
        self._pruefen(antwort, f"delete {tabelle}")

    def patch(self, tabelle: str, werte: dict[str, Any], **filter_: str) -> None:
        """Felder bestehender Zeilen setzen; Filter als PostgREST-Ausdrücke.

        Für Nachträge an schon geschriebenen Zeilen (etwa die Rückverknüpfung
        Buchung → Posteingang-Thread). Ein `upsert` taugt dafür nicht: es
        bräuchte die vollständige Zeile und überschriebe die übrigen Felder.
        """
        antwort = self._client.patch(
            f"{self.url}/rest/v1/{tabelle}",
            params=filter_,
            headers=self._rest_headers,
            json=werte,
        )
        self._pruefen(antwort, f"patch {tabelle}")

    def rpc(self, funktion: str, argumente: dict[str, Any]) -> Any:
        """Datenbankfunktion aufrufen (service_role)."""
        antwort = self._client.post(
            f"{self.url}/rest/v1/rpc/{funktion}",
            headers=self._rest_headers,
            json=argumente,
        )
        self._pruefen(antwort, f"rpc {funktion}")
        return antwort.json() if antwort.content else None

    # ── Storage ──────────────────────────────────────────────────────────────
    def upload(self, pfad: str, daten: bytes, content_type: str) -> str:
        """Legt eine Datei im Bucket ab (überschreibt) und liefert die Public-URL."""
        antwort = self._client.post(
            f"{self.url}/storage/v1/object/{BUCKET}/{pfad}",
            headers={
                "Authorization": f"Bearer {self._key}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            content=daten,
        )
        self._pruefen(antwort, f"upload {pfad}")
        return f"{self.url}/storage/v1/object/public/{BUCKET}/{pfad}"

    def storage_aufraeumen(self, praefix: str) -> int:
        """Löscht alle Objekte unterhalb von `praefix` (Ordner je Objekt)."""
        zu_loeschen: list[str] = []
        for ordner in self._storage_liste(praefix):
            unterordner = f"{praefix}/{ordner}"
            zu_loeschen += [
                f"{unterordner}/{name}" for name in self._storage_liste(unterordner)
            ]
        if not zu_loeschen:
            return 0
        antwort = self._client.request(
            "DELETE",
            f"{self.url}/storage/v1/object/{BUCKET}",
            headers={
                "Authorization": f"Bearer {self._key}",
                "Content-Type": "application/json",
            },
            json={"prefixes": zu_loeschen},
        )
        self._pruefen(antwort, "storage delete")
        return len(zu_loeschen)

    def _storage_liste(self, praefix: str) -> list[str]:
        antwort = self._client.post(
            f"{self.url}/storage/v1/object/list/{BUCKET}",
            headers={
                "Authorization": f"Bearer {self._key}",
                "Content-Type": "application/json",
            },
            json={"prefix": praefix, "limit": 1000, "offset": 0},
        )
        self._pruefen(antwort, "storage list")
        return [eintrag["name"] for eintrag in antwort.json()]

    # ── GoTrue (Auth) ────────────────────────────────────────────────────────
    def auth_user_sicherstellen(self, email: str, passwort: str,
                                app_metadata: dict[str, Any]) -> str:
        """Legt den Login an oder setzt das Passwort des bestehenden neu.

        `app_metadata` trägt tenant_id und Rolle: die API liest den Mandanten
        AUS DEM TOKEN (`core/security.py`), nicht aus der users-Tabelle. Ohne
        diese Claims meldet jeder Endpunkt „Kein Tenant im Konto".

        Der Weg über die Admin-API ist der EINZIGE korrekte: ein UPDATE auf
        `auth.users` von Hand leert Felder wie `aud` und macht den Account
        unbrauchbar.
        """
        vorhanden = self._client.get(
            f"{self.url}/auth/v1/admin/users",
            headers={"apikey": self._key, "Authorization": f"Bearer {self._key}"},
            params={"filter": email, "per_page": "50"},
        )
        self._pruefen(vorhanden, "auth list")
        for nutzer in vorhanden.json().get("users", []):
            if nutzer.get("email", "").lower() == email.lower():
                aktualisiert = self._client.put(
                    f"{self.url}/auth/v1/admin/users/{nutzer['id']}",
                    headers={
                        "apikey": self._key,
                        "Authorization": f"Bearer {self._key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "password": passwort,
                        "email_confirm": True,
                        "app_metadata": app_metadata,
                    },
                )
                self._pruefen(aktualisiert, "auth update")
                return nutzer["id"]

        angelegt = self._client.post(
            f"{self.url}/auth/v1/admin/users",
            headers={
                "apikey": self._key,
                "Authorization": f"Bearer {self._key}",
                "Content-Type": "application/json",
            },
            json={
                "email": email,
                "password": passwort,
                "email_confirm": True,
                "app_metadata": app_metadata,
            },
        )
        self._pruefen(angelegt, "auth create")
        return angelegt.json()["id"]

    def auth_user_loeschen(self, email: str) -> None:
        """Login entfernen, falls vorhanden — sonst nichts tun."""
        vorhanden = self._client.get(
            f"{self.url}/auth/v1/admin/users",
            headers={"apikey": self._key, "Authorization": f"Bearer {self._key}"},
            params={"filter": email, "per_page": "50"},
        )
        self._pruefen(vorhanden, "auth list")
        for nutzer in vorhanden.json().get("users", []):
            if nutzer.get("email", "").lower() == email.lower():
                geloescht = self._client.delete(
                    f"{self.url}/auth/v1/admin/users/{nutzer['id']}",
                    headers={
                        "apikey": self._key,
                        "Authorization": f"Bearer {self._key}",
                    },
                )
                self._pruefen(geloescht, "auth delete")

    # ── intern ───────────────────────────────────────────────────────────────
    @staticmethod
    def _pruefen(antwort: httpx.Response, was: str) -> None:
        """Fehler laut und mit Serverantwort melden — nie stillschweigend weiter.

        Ein verschluckter Fehler hier erzeugt einen halb geseedeten Tenant, der
        im Screenshot erst auffällt, wenn das Bild schon auf der Website ist
        (Wurzel 5 — nichts verschlucken).
        """
        if antwort.status_code >= 400:
            raise RuntimeError(
                f"{was} fehlgeschlagen ({antwort.status_code}): {antwort.text[:500]}"
            )
