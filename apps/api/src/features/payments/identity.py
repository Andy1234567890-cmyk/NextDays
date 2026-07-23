"""Stripe Identity — Ausweis-/Selfie-Verifizierung für Gastgeber.

Marktplatz-eigene „Identität verifiziert"-Prüfung (Airbnb-Muster), unabhängig
vom Connect-KYC. Hosted-Redirect-Flow (Stripe hostet Upload/Kamera):

  1. POST /payments/identity/verification-session → erstellt eine
     VerificationSession (type=document, Selfie-Abgleich, Live-Capture),
     gibt NUR die `url` zurück (nie speichern/loggen — läuft nach 24 h ab).
  2. Frontend leitet auf diese url; Stripe leitet danach auf return_url zurück.
  3. Das Ergebnis kommt ASYNCHRON per Webhook (identity.verification_session.*)
     — NIE aus dem Redirect ableiten. Der Webhook setzt users.identity_status.

DSGVO/DE: Wir speichern KEINE Ausweisbilder/-nummern, nur Status + Session-ID.
Die Zuordnung zum Gastgeber läuft über metadata{user_id,tenant_id} (serverseitig
gesetzt, dem Client NICHT vertraut — Wurzel 3).
"""
from __future__ import annotations

import hashlib
import time
from urllib.parse import urlparse

from src.core.config import get_settings
from src.core.logging import get_logger

from .service import PaymentsError, PaymentsService, _stripe_errors

log = get_logger("nextdays.payments.identity")


def _validate_return_url(return_url: str) -> str:
    """Nur eine return_url zu einem erlaubten Frontend-Origin zulassen (kein
    offener Redirect). Der Origin muss in den konfigurierten CORS-Origins
    stehen — kein Hardcode einer Domain im Backend (Wurzel 4)."""
    parsed = urlparse(return_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise PaymentsError("Ungültige return_url.", status_code=422)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    allowed = get_settings().cors_origin_list
    if origin not in allowed:
        raise PaymentsError("return_url-Origin nicht erlaubt.", status_code=422)
    return return_url


class IdentityService(PaymentsService):
    """Erweitert PaymentsService um die Stripe-Identity-Verifizierung. Nutzt den
    gleichen StripeClient/Fehler-Übersetzer wie die übrigen Zahlungspfade."""

    def create_verification_session(
        self, *, user_id: str, tenant_id: str, email: str | None, return_url: str
    ) -> str:
        """Startet eine Ausweis-Verifizierung und gibt die Hosted-URL zurück.

        Idempotenz: pro (Nutzer, offener Versuch) ein stabiler idempotency_key,
        damit ein Doppelklick/Retry nicht zwei Sessions (= zwei Gebühren) erzeugt
        (Wurzel 2). return_url wird gegen die erlaubten Origins geprüft.
        """
        safe_return = _validate_return_url(return_url)
        params: dict = {
            "type": "document",
            "options": {
                "document": {
                    # Ausweis + Selfie-Abgleich (wie Airbnbs Identitätsprüfung).
                    "require_matching_selfie": True,
                    # nur Live-Kamera, keine Datei-Uploads (Anti-Fraud).
                    "require_live_capture": True,
                    "allowed_types": ["passport", "id_card", "driving_license"],
                }
            },
            # Zuordnung zum Gastgeber — serverseitig, dem Client NICHT vertraut.
            "metadata": {"user_id": user_id, "tenant_id": tenant_id},
            "return_url": safe_return,
        }
        if email:
            params["provided_details"] = {"email": email}

        # Idempotenz-Key gegen echten Doppelklick (Wurzel 2), ABER an ein grobes
        # Zeitfenster (10 min) gebunden: zwei Klicks in Sekunden treffen denselben
        # Key (eine Session, keine Doppel-Gebühr), ein bewusster NEUER Versuch
        # später bekommt einen neuen Key → neue Session. Ohne Zeitfenster würde
        # Stripe Wochen später dieselbe (evtl. schon verifizierte) Session
        # zurückgeben — dann käme kein neuer Event und `url` wäre null.
        window = int(time.time()) // 600
        idem = hashlib.sha256(
            f"{user_id}|{safe_return}|{window}".encode()
        ).hexdigest()[:32]
        with _stripe_errors():
            session = self._stripe.v1.identity.verification_sessions.create(
                params=params,
                options={"idempotency_key": f"idv:{idem}"},
            )

        # Session-ID am Nutzer vermerken (Rückmapping im Webhook, Status
        # „processing" sobald eingereicht — hier erst „unverified" bleibt bis
        # zum Webhook). Nur ID, KEINE Ausweisdaten.
        self._db.table("users").update(
            {"identity_session_id": session.id}
        ).eq("id", user_id).execute()

        log.info(
            "identity_session_created",
            user_id=user_id,
            session_id=session.id,
        )
        # NUR die url zurück (nicht speichern/loggen — 24 h gültig).
        return session.url
