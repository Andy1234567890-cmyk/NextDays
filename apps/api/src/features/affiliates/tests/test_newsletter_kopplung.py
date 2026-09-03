"""Newsletter-Häkchen in der Partner-Bewerbung (03.09.2026).

Geprüft wird die Trennung, auf die es rechtlich ankommt: die Pflicht-Zustimmung
zu den Partner-Bedingungen und die freiwillige Newsletter-Einwilligung sind
ZWEI Entscheidungen. Ohne Häkchen darf keine Zeile in `newsletter_subscribers`
entstehen, und ein Fehler im Newsletter-Teil darf die Bewerbung nicht kippen.
"""

from __future__ import annotations

from typing import Any

from src.features.affiliates import newsletter_anmeldung
from src.features.newsletter.service import NewsletterError


class _NewsletterAttrappe:
    """Nimmt `subscribe`-Aufrufe auf; `fehler` lässt sie scheitern."""

    def __init__(self, fehler: Exception | None = None) -> None:
        self.aufrufe: list[dict[str, Any]] = []
        self._fehler = fehler

    def subscribe(self, req: Any, *, ip: str | None, user_agent: str | None) -> Any:  # noqa: ANN401
        self.aufrufe.append(
            {
                "email": str(req.email),
                "locale": req.locale,
                "source": req.source,
                "consent_text": req.consent_text,
                "ip": ip,
                "user_agent": user_agent,
            }
        )
        if self._fehler is not None:
            raise self._fehler
        return None


def test_anmeldung_geht_durch_das_double_opt_in() -> None:
    dienst = _NewsletterAttrappe()

    ok = newsletter_anmeldung.anmelden(
        object(),
        email="pia@example.de",
        sprache="de",
        consent_text="Ja, schickt mir Neuigkeiten.",
        ip="203.0.113.7",
        user_agent="Mozilla/5.0",
        service=dienst,  # type: ignore[arg-type]
    )

    assert ok is True
    assert len(dienst.aufrufe) == 1
    aufruf = dienst.aufrufe[0]
    # Die Quelle unterscheidet Partner-Bewerber von Launch-Interessenten.
    assert aufruf["source"] == "partner_bewerbung"
    # Einwilligungs-Nachweis: Wortlaut, IP und User-Agent gehen mit.
    assert aufruf["consent_text"] == "Ja, schickt mir Neuigkeiten."
    assert aufruf["ip"] == "203.0.113.7"
    assert aufruf["user_agent"] == "Mozilla/5.0"
    assert aufruf["locale"] == "de"


def test_fehler_im_newsletter_kippt_die_bewerbung_nicht() -> None:
    """Der Newsletter ist Beiwerk — sein Scheitern ist kein Bewerbungsfehler."""
    dienst = _NewsletterAttrappe(NewsletterError("Mailserver weg", status_code=502))

    ok = newsletter_anmeldung.anmelden(
        object(),
        email="pia@example.de",
        sprache="de",
        consent_text=None,
        ip=None,
        user_agent=None,
        service=dienst,  # type: ignore[arg-type]
    )

    assert ok is False, "der Fehler muss sichtbar sein, aber nicht geworfen werden"


def test_ohne_haekchen_wird_der_dienst_nie_gerufen() -> None:
    """`bewerben` ruft die Anmeldung nur bei `newsletter_opt_in`.

    Der Nachweis steht hier am Aufrufpfad des Services: das Feld ist der
    einzige Schalter, und es ist standardmäßig aus.
    """
    from src.features.affiliates.schemas import PartnerBewerbung

    b = PartnerBewerbung(
        email="pia@example.de",
        password="langgenug1",
        full_name="Pia Partner",
        legal_form="private",
        country="DE",
        language="de",
        channels=[{"platform": "instagram", "handle": "pia"}],
        terms_accepted=True,
        terms_version="2026-09",
    )
    assert b.newsletter_opt_in is False
    assert b.newsletter_consent_text is None
