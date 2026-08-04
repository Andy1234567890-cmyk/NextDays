#!/usr/bin/env python3
"""Backoffice-Passwort-Reset live prüfen — echte Server-DB, echter Mailversand.

Kein Mock, kein Testkonto: geprüft wird gegen `public.platform_admins` auf dem
Server und gegen den eigenen Mailcow-SMTP. Der Klartext-Token wird bewusst
NICHT ausgegeben — er steht nur in der Mail.

WAS DIESES SKRIPT MACHT
  1. Zeigt den vorhandenen Backoffice-Zugang (Adresse maskiert).
  2. Fordert einen Reset an → prüft, dass in der DB nur der SHA-256 landet,
     die Gültigkeit eine Stunde beträgt und `reset_requested_at` steht.
  3. Prüft die Sperrfrist: die zweite Anfrage direkt danach schreibt keinen
     neuen Token.
  4. Prüft die neutrale Antwort für eine Adresse ohne Backoffice-Zugang —
     Wort für Wort dieselbe wie im Erfolgsfall.
  5. Prüft, dass ein unbekannter Token mit 400 abgelehnt wird.
  6. Prüft, dass ein ABGELAUFENER Token abgelehnt wird (setzt die Gültigkeit
     der eigenen Zeile in die Vergangenheit — kein fremder Zustand).
  7. Prüft die Sitzungs-Widerruf-RPC (`host_revoke_other_sessions`, keep=NULL)
     gegen eine UUID ohne Sitzungen: beweist die Aufrufform, löscht nichts.
  8. Räumt die Reset-Spalten auf den Vorzustand zurück.

Das Passwort wird NICHT gesetzt: das macht der Mensch über den Link in seinem
Postfach. Genau dieser letzte Schritt ist deshalb der einzige, der nach dem Lauf
noch offen ist — mit `--mail-schicken` verschickt das Skript dafür am Ende eine
echte Mail und lässt den Token stehen.

AUSFÜHRUNG (vom Repo-Root, braucht apps/api/.env mit Server-DB + SMTP):
    apps/api/.venv/bin/python scripts/platform/verify_backoffice_passwort_reset.py
    apps/api/.venv/bin/python scripts/platform/verify_backoffice_passwort_reset.py --mail-schicken
"""
# pylint: disable=wrong-import-position,wrong-import-order,import-error
# pylint: disable=too-few-public-methods,too-many-locals,too-many-statements
# import-error: die src-Module liegen erst nach dem sys.path-Eintrag unten im
# Suchpfad — pylint löst das statisch nicht auf (wie scripts/channex/*).
# too-many-*: `main` ist ein LINEARER Prüfablauf — jeder Schritt baut auf dem
# Zustand des vorigen auf. In Hilfsfunktionen zerlegt, müsste man den halben
# Zustand als Parameter durchreichen und die Reihenfolge wäre nicht mehr
# ablesbar. Ein Diagnose-Skript soll von oben nach unten lesbar sein.
from __future__ import annotations

import hashlib
import os
import secrets
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = ROOT / "apps" / "api"
sys.path.insert(0, str(API))

# .env laden, BEVOR die Settings-Klasse importiert wird.
for env_zeile in (API / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in env_zeile and not env_zeile.lstrip().startswith("#"):
        schluessel, _, wert = env_zeile.partition("=")
        os.environ.setdefault(schluessel.strip(), wert.strip().strip('"').strip("'"))

from src.core.config import get_settings  # noqa: E402
from src.core.logging import mask_email  # noqa: E402
from src.core.mail import MailService  # noqa: E402
from src.core.supabase import get_service_client  # noqa: E402
from src.features.platform_admin.schemas import (  # noqa: E402
    TeamPasswordResetConfirm,
    TeamPasswordResetRequest,
)
from src.features.platform_admin.team_service import (  # noqa: E402
    _RESET_ANTWORT,
    TeamError,
    TeamService,
)
from supabase import Client  # noqa: E402

OK = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"

RESET_SPALTEN = "reset_token_hash, reset_expires_at, reset_requested_at"

# Passwort für die Ablehnungs-Prüfungen. Zufällig statt fest im Skript: es wird
# nie gesetzt (beide Aufrufe MÜSSEN scheitern), und ein Literal hier wäre eine
# Passwort-Zeichenkette im Repo.
ABGELEHNT_PW = secrets.token_urlsafe(16)


class Pruefung:
    """Zählt Treffer und Fehlschläge, damit der Exit-Code die Wahrheit sagt."""

    def __init__(self) -> None:
        self.gut = 0
        self.schlecht = 0

    def wahr(self, name: str, bedingung: bool, detail: str = "") -> None:
        """Eine Prüfung verbuchen und sichtbar machen."""
        if bedingung:
            self.gut += 1
            print(f"  {OK} {name}{f': {detail}' if detail else ''}")
        else:
            self.schlecht += 1
            print(f"  {FAIL} {name}{f': {detail}' if detail else ''}")


def zugang(db: Client) -> dict:
    """Der (einzige) aktive Backoffice-Zugang inklusive GoTrue-Adresse."""
    rows = (
        db.table("platform_admins")
        .select(f"user_id, role, active, accepted_at, {RESET_SPALTEN}")
        .eq("active", True)
        .order("created_at")
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        sys.exit("Kein aktiver Backoffice-Zugang in platform_admins.")
    row = rows[0]
    res = db.auth.admin.get_user_by_id(row["user_id"])
    row["email"] = getattr(getattr(res, "user", None), "email", None)
    if not row["email"]:
        sys.exit(f"Zugang {row['user_id']} hat in GoTrue keine Adresse.")
    return row


def reset_zeile(db: Client, user_id: str) -> dict:
    """Die drei Reset-Spalten eines Zugangs, frisch aus der DB."""
    return (
        db.table("platform_admins")
        .select(RESET_SPALTEN)
        .eq("user_id", user_id)
        .single()
        .execute()
    ).data


def main() -> int:  # noqa: PLR0915  (ein linearer Prüfablauf, kein Zerlegen)
    """Den ganzen Reset-Weg gegen die Server-DB prüfen und aufräumen."""
    mail_schicken = "--mail-schicken" in sys.argv
    settings = get_settings()
    db = get_service_client()
    if db is None:
        sys.exit("Kein Service-Client — apps/api/.env prüfen.")
    if not settings.mail_configured:
        sys.exit("SMTP ist nicht konfiguriert — der Reset wäre kein echter Test.")
    print(
        f"SMTP {settings.smtp_host}:{settings.smtp_port} als "
        f"{mask_email(settings.smtp_user)}, Sandbox={settings.mail_sandbox}"
    )
    print(f"ADMIN_BASE_URL {settings.admin_base_url}")

    person = zugang(db)
    user_id, email = person["user_id"], person["email"]
    print(f"Zugang {mask_email(email)} ({person['role']})")
    vorher = {s: person.get(s) for s in RESET_SPALTEN.replace(" ", "").split(",")}

    svc = TeamService(db=db, settings=settings, mail=MailService(settings))
    p = Pruefung()
    try:
        print("\n1) Reset anfordern — Token nur als Hash, eine Stunde gültig")
        antwort = svc.passwort_reset_anfordern(
            TeamPasswordResetRequest(email=email)
        )
        p.wahr("Antwort ist die neutrale", antwort == _RESET_ANTWORT, antwort)
        zeile = reset_zeile(db, user_id)
        token_hash = zeile.get("reset_token_hash")
        p.wahr(
            "reset_token_hash ist ein SHA-256 (64 hex)",
            isinstance(token_hash, str) and len(token_hash) == 64,
            str(token_hash)[:16] + "…",
        )
        ablauf = datetime.fromisoformat(zeile["reset_expires_at"])
        rest = ablauf - datetime.now(UTC)
        p.wahr(
            "Gültigkeit ~1 Stunde",
            timedelta(minutes=55) < rest <= timedelta(hours=1),
            f"{int(rest.total_seconds() // 60)} min",
        )
        p.wahr("reset_requested_at gesetzt", bool(zeile.get("reset_requested_at")))

        print("\n2) Sperrfrist — die zweite Anfrage schickt keine neue Mail")
        svc.passwort_reset_anfordern(TeamPasswordResetRequest(email=email))
        p.wahr(
            "Token unverändert",
            reset_zeile(db, user_id).get("reset_token_hash") == token_hash,
        )

        print("\n3) Adresse ohne Backoffice-Zugang — Wort für Wort dieselbe Antwort")
        fremd = svc.passwort_reset_anfordern(
            # Existierende Betriebs-Adresse OHNE platform_admins-Zeile: genau der
            # Fall, den ein Angreifer zur Unterscheidung nutzen würde.
            TeamPasswordResetRequest(email="developer@mynextdays.de")
        )
        p.wahr("Antwort identisch", fremd == antwort, fremd)

        print("\n4) Unbekannter Token → 400")
        try:
            svc.passwort_neu_setzen(
                TeamPasswordResetConfirm(token="x" * 43, password=ABGELEHNT_PW)
            )
            p.wahr("abgelehnt", False, "durchgelassen")
        except TeamError as exc:
            p.wahr("abgelehnt", exc.status_code == 400, f"{exc.status_code}")

        print("\n5) Abgelaufener Token → 400 (kein Passwortwechsel)")
        # Die eigene Zeile künstlich altern lassen; danach wird sie ohnehin
        # aufgeräumt. Der Klartext-Token ist hier nicht bekannt, deshalb wird
        # der Hash-Vergleich über eine bekannte Zeichenkette geführt.
        bekannt = "z" * 43
        db.table("platform_admins").update(
            {
                "reset_token_hash": hashlib.sha256(
                    bekannt.encode("utf-8")
                ).hexdigest(),
                "reset_expires_at": (
                    datetime.now(UTC) - timedelta(minutes=1)
                ).isoformat(),
            }
        ).eq("user_id", user_id).execute()
        try:
            svc.passwort_neu_setzen(
                TeamPasswordResetConfirm(token=bekannt, password=ABGELEHNT_PW)
            )
            p.wahr("abgelehnt", False, "durchgelassen")
        except TeamError as exc:
            p.wahr("abgelehnt", exc.status_code == 400, f"{exc.status_code}")

        print("\n6) Sitzungs-Widerruf-RPC (keep=NULL) — Aufrufform gegen UUID ohne Sitzungen")
        res = db.rpc(
            "host_revoke_other_sessions",
            {
                "p_user_id": "00000000-0000-0000-0000-000000000000",
                "p_keep_session_id": None,
            },
        ).execute()
        p.wahr("RPC antwortet mit 0 gelöschten", res.data == 0, str(res.data))

        if mail_schicken:
            print("\n7) Echte Reset-Mail verschicken (Token bleibt stehen)")
            # Sperrfrist umgehen: sie ist gegen Fremdanfragen gedacht, hier will
            # der Betreiber die Mail bewusst.
            db.table("platform_admins").update(
                {"reset_requested_at": None}
            ).eq("user_id", user_id).execute()
            svc.passwort_reset_anfordern(TeamPasswordResetRequest(email=email))
            steht = reset_zeile(db, user_id)
            p.wahr(
                "Token liegt bereit",
                bool(steht.get("reset_token_hash")),
                f"gültig bis {steht.get('reset_expires_at')}",
            )
            print(f"  → Mail an {mask_email(email)}; Link führt auf "
                  f"{settings.admin_base_url}/passwort-neu")
    finally:
        if not mail_schicken:
            print("\n8) Aufräumen — Reset-Spalten auf den Vorzustand")
            db.table("platform_admins").update(vorher).eq(
                "user_id", user_id
            ).execute()
            print(f"  {OK} {vorher}")

    print(f"\n{p.gut} bestanden, {p.schlecht} fehlgeschlagen")
    return 1 if p.schlecht else 0


if __name__ == "__main__":
    sys.exit(main())
