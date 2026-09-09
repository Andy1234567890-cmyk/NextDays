"""Den WhatsApp-Kanal eines Betriebs trennen — der Weg zurück.

Ohne diesen Weg war eine einmal verbundene Nummer endgültig: der Verbinden-
Knopf erscheint nur bei `!verbunden`, und es gab weder Endpunkt noch Schalter
zum Lösen. Wer beim Aufsetzen Metas Testnummer erwischte — sie entsteht mit
jedem neuen Business-Portfolio —, sah dauerhaft „+1 555…" statt der eigenen
Nummer und kam nicht mehr davon los. Live am 08.09.2026 genau so passiert.

Eigenes Modul aus demselben Grund wie `sendezustand.py`: `service.py` wächst
sonst über die 1500-Zeilen-Grenze.
"""
from __future__ import annotations

from collections.abc import Callable

from supabase import Client

from src.core.logging import get_logger

from .client import WhatsAppClient, WhatsAppError
from .fehler import WhatsAppServiceError
from .schemas import OnboardingStatus

log = get_logger("nextdays.whatsapp.trennen")

# Fehler, die das Trennen NICHT verhindern dürfen — abschließend aufgezählt,
# nicht als breites `except Exception` (Wurzel 5):
#   * WhatsAppError        Meta antwortet nicht mehr (Token widerrufen, WABA
#                          gelöscht, Drosselung).
#   * WhatsAppServiceError `client_holen` findet kein nutzbares Konto mehr
#                          (Modul abbestellt, Zeile halb entfernt).
# Beides beschreibt einen Kanal, den der Betrieb ohnehin nicht mehr benutzen
# kann. Daran zu scheitern hieße, ihn genau darin festzuhalten.
KEIN_GRUND_ZUM_ABBRUCH = (WhatsAppError, WhatsAppServiceError)


def kanal_trennen(
    db: Client,
    tenant_id: str,
    *,
    client_holen: Callable[[], WhatsAppClient],
) -> OnboardingStatus:
    """Kanal lösen: Webhook-Abo bei Meta abmelden, Zeile entfernen.

    Gegenzustände, die mitgepflegt werden (Wurzel 1):

    * Metas Webhook-Abo dieser WABA wird abgemeldet
      (`DELETE /{waba-id}/subscribed_apps`, dokumentiert). Bleibt es stehen,
      liefert Meta weiter Nachrichten eines Kontos, zu dem wir kein Token mehr
      haben — der Empfang läuft ins Leere statt sauber zu enden.
    * Die Zeile wird GELÖSCHT, nicht auf `status='disconnected'` gesetzt: sie
      trägt das Zugangstoken, und ein Token ohne Kanal ist ein Secret ohne
      Zweck (Wurzel 6). `whatsapp_account` hat genau eine Zeile je Tenant, das
      erneute Verbinden legt sie neu an.

    Das Abmelden ist best effort: schlägt es fehl (Token bereits widerrufen,
    WABA gelöscht), wird die Zeile trotzdem entfernt. Sonst bliebe der Betrieb
    an einem Kanal hängen, den er gar nicht mehr besitzt — genau der Zustand,
    den diese Funktion auflöst.
    """
    res = (
        db.table("whatsapp_account")
        .select("waba_id")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise WhatsAppServiceError(
            "Für diesen Betrieb ist keine WhatsApp-Nummer verbunden.",
            status_code=409,
        )
    waba_id = rows[0].get("waba_id")
    try:
        client = client_holen()
        if waba_id:
            client.unsubscribe_app_from_waba(
                str(waba_id), token=client.token_fuer_abfrage
            )
    except KEIN_GRUND_ZUM_ABBRUCH as exc:
        log.info(
            "whatsapp_webhook_abmeldung_fehlgeschlagen",
            tenant_id=tenant_id,
            waba_id=waba_id,
            grund=str(exc),
        )
    db.table("whatsapp_account").delete().eq("tenant_id", tenant_id).execute()
    log.info("whatsapp_kanal_getrennt", tenant_id=tenant_id, waba_id=waba_id)
    return OnboardingStatus(connected=False)
