"""Newsletter-Anmeldung aus der Partner-Bewerbung heraus.

Die Bewerbung hat eine ZWEITE, freiwillige Ankreuzbox für den Newsletter
(getrennt von der Pflicht-Zustimmung zu den Partner-Bedingungen). Ist sie
gesetzt, läuft die Adresse durch DENSELBEN Weg wie das Marketing-Popup:
`NewsletterService.subscribe` → Zeile in `newsletter_subscribers` (Status
`pending`) → Bestätigungsmail mit Einmal-Token → erst nach dem Klick an Brevo.

Warum kein Direkteintrag (Entscheidung 03.09.2026, Variante A): der Nachweis
sieht dann überall gleich aus, und in der Liste stehen nur bestätigte
Adressen. Die Bewerbung selbst gilt unabhängig davon — sie ist eine
Geschäftsanbahnung, keine Werbeeinwilligung.

Warum eigenes Modul: der Newsletter ist ein FREMDER Slice. Der Import steht
hier an genau einer Stelle, statt die Service-Signatur des Partnerprogramms um
eine weitere Abhängigkeit zu verbreitern.
"""

from __future__ import annotations

from src.core.logging import get_logger, mask_email
from src.features.newsletter.schemas import SubscribeRequest
from src.features.newsletter.service import NewsletterError, NewsletterService

log = get_logger("nextdays.affiliates.newsletter")

# Kennzeichnung in Brevo (Attribut QUELLE) und in `newsletter_subscribers.source`:
# Partner-Bewerber sind ein anderes Publikum als Launch-Interessenten, auch wenn
# sie in derselben Liste landen.
QUELLE = "partner_bewerbung"


def anmelden(
    db: object,
    *,
    email: str,
    sprache: str,
    consent_text: str | None,
    ip: str | None,
    user_agent: str | None,
    service: NewsletterService | None = None,
) -> bool:
    """Double-Opt-in anstoßen. True = Bestätigungsmail ist unterwegs.

    Scheitert der Newsletter-Teil, bleibt die BEWERBUNG gültig: sie ist der
    Hauptzweck des Formulars, der Newsletter das freiwillige Beiwerk. Der
    Fehler wird geloggt, nicht verschluckt und nicht nach oben geworfen
    (Wurzel 5: best-effort-Nebenpfad, der den Hauptpfad nicht kippt).
    """
    dienst = service or NewsletterService(db=db)  # type: ignore[arg-type]
    try:
        dienst.subscribe(
            SubscribeRequest(
                email=email,
                locale=sprache,
                source=QUELLE,
                consent_text=consent_text,
            ),
            ip=ip,
            user_agent=user_agent,
        )
    except (NewsletterError, ValueError) as exc:  # noqa: BLE001 — s. Docstring
        log.warning(
            "partner_newsletter_anmeldung_fehlgeschlagen",
            email=mask_email(email),
            error=str(exc)[:200],
        )
        return False
    log.info("partner_newsletter_anmeldung", email=mask_email(email))
    return True
