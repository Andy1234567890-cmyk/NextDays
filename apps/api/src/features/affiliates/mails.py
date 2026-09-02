"""Alle Mails an Partner — EINE Stelle, 24 Sprachen über `core.mail_texte`.

Jede Mail ist Nebenpfad (Wurzel 5): Scheitert der Versand, wird das laut
geloggt, aber die Freigabe, die Zuordnung oder die Provisionsbuchung kippt
nicht. Deshalb fangen alle Methoden `MailError` und melden ihn — nie
verschlucken, nie weiterreichen.

Der Link ins Partner-Dashboard kommt aus `Settings.partner_base_url`. Fehlt
sie, geht die Mail OHNE Button hinaus und der Mangel steht als ERROR im Log
(Konfigurationsmangel wie APP_BASE_URL beim Worker, 25.08.2026) — nicht still
gekürzt.
"""

from __future__ import annotations

from src.core.config import Settings, get_settings
from src.core.logging import get_logger, mask_email
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_layout import Aktion, MailInhalt, mail_rendern
from src.core.mail_sprache import aufloesen
from src.core.mail_texte import text

log = get_logger("nextdays.affiliates.mails")

MARKE = "myNextDays"


class PartnerMails:
    def __init__(
        self,
        mail: MailService | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._mail = mail or MailService(self._settings)

    # --- Hilfen ---------------------------------------------------------------

    def _dashboard_aktion(self, sprache: str) -> Aktion | None:
        basis = (self._settings.partner_base_url or "").strip().rstrip("/")
        if not basis:
            log.error(
                "partner_base_url_fehlt",
                hinweis="PARTNER_BASE_URL setzen — Partner-Mails gehen ohne Link hinaus.",
            )
            return None
        return Aktion(text=text("partner.aktion_dashboard", sprache), url=f"{basis}/")

    def _senden(
        self,
        *,
        email: str,
        sprache: str,
        betreff: str,
        inhalt: MailInhalt,
        ereignis: str,
    ) -> bool:
        try:
            mail = mail_rendern(inhalt, settings=self._settings)
            self._mail.send(
                OutboundMessage(
                    to=email,
                    subject=betreff,
                    text=mail.text,
                    html=mail.html,
                    inline_bilder=mail.inline_bilder,
                )
            )
        except MailError as exc:
            log.error(
                "partner_mail_fehlgeschlagen",
                ereignis=ereignis,
                email=mask_email(email),
                sprache=sprache,
                error=str(exc),
            )
            return False
        log.info("partner_mail_gesendet", ereignis=ereignis, email=mask_email(email))
        return True

    # --- Ereignisse ----------------------------------------------------------

    def bewerbung_eingegangen(self, *, email: str, name: str, sprache: str) -> bool:
        s = aufloesen(sprache)
        return self._senden(
            email=email,
            sprache=s,
            betreff=text("partner.bewerbung.betreff", s, marke=MARKE),
            inhalt=MailInhalt(
                titel=text("partner.bewerbung.titel", s, name=name),
                absaetze=[
                    text("partner.bewerbung.absatz1", s, marke=MARKE),
                    text("partner.bewerbung.absatz2", s),
                ],
                aktion=self._dashboard_aktion(s),
                sprache=s,
            ),
            ereignis="bewerbung",
        )

    def freigegeben(self, *, email: str, name: str, sprache: str, code: str) -> bool:
        s = aufloesen(sprache)
        return self._senden(
            email=email,
            sprache=s,
            betreff=text("partner.freigabe.betreff", s, marke=MARKE),
            inhalt=MailInhalt(
                titel=text("partner.freigabe.titel", s, name=name),
                absaetze=[
                    text("partner.freigabe.absatz1", s, marke=MARKE),
                    text("partner.freigabe.absatz2", s, code=code),
                ],
                aktion=self._dashboard_aktion(s),
                hinweise=[text("partner.freigabe.hinweis_kennzeichnung", s)],
                sprache=s,
            ),
            ereignis="freigabe",
        )

    def abgelehnt(self, *, email: str, name: str, sprache: str, grund: str | None) -> bool:
        s = aufloesen(sprache)
        absaetze = [text("partner.ablehnung.absatz1", s, marke=MARKE)]
        if grund:
            absaetze.append(text("partner.ablehnung.absatz_grund", s, grund=grund))
        return self._senden(
            email=email,
            sprache=s,
            betreff=text("partner.ablehnung.betreff", s, marke=MARKE),
            inhalt=MailInhalt(
                titel=text("partner.ablehnung.titel", s, name=name),
                absaetze=absaetze,
                sprache=s,
            ),
            ereignis="ablehnung",
        )

    def neuer_kunde(self, *, email: str, name: str, sprache: str, kunde: str) -> bool:
        s = aufloesen(sprache)
        return self._senden(
            email=email,
            sprache=s,
            betreff=text("partner.neuer_kunde.betreff", s),
            inhalt=MailInhalt(
                titel=text("partner.neuer_kunde.titel", s, name=name),
                absaetze=[text("partner.neuer_kunde.absatz", s, kunde=kunde)],
                aktion=self._dashboard_aktion(s),
                sprache=s,
            ),
            ereignis="neuer_kunde",
        )

    def kunde_zahlt(
        self, *, email: str, name: str, sprache: str, kunde: str, satz_prozent: str
    ) -> bool:
        s = aufloesen(sprache)
        return self._senden(
            email=email,
            sprache=s,
            betreff=text("partner.kunde_zahlt.betreff", s),
            inhalt=MailInhalt(
                titel=text("partner.kunde_zahlt.titel", s, name=name),
                absaetze=[text("partner.kunde_zahlt.absatz", s, kunde=kunde, satz=satz_prozent)],
                aktion=self._dashboard_aktion(s),
                sprache=s,
            ),
            ereignis="kunde_zahlt",
        )

    def rang_erreicht(
        self,
        *,
        email: str,
        name: str,
        sprache: str,
        rang: str,
        satz_prozent: str,
        bonus: str | None = None,
    ) -> bool:
        s = aufloesen(sprache)
        absaetze = [text("partner.rang.absatz", s, rang=rang, satz=satz_prozent)]
        if bonus:
            # Aufstiegsbonus (0525): Betrag mit Währung, z. B. „50.00 EUR".
            absaetze.append(text("partner.rang.bonus", s, betrag=bonus))
        return self._senden(
            email=email,
            sprache=s,
            betreff=text("partner.rang.betreff", s, rang=rang),
            inhalt=MailInhalt(
                titel=text("partner.rang.titel", s, name=name),
                absaetze=absaetze,
                aktion=self._dashboard_aktion(s),
                sprache=s,
            ),
            ereignis="rang",
        )

    def auszahlung_erstellt(
        self,
        *,
        email: str,
        name: str,
        sprache: str,
        betrag: str,
        waehrung: str,
        nummer: str,
    ) -> bool:
        s = aufloesen(sprache)
        return self._senden(
            email=email,
            sprache=s,
            betreff=text("partner.auszahlung.betreff", s),
            inhalt=MailInhalt(
                titel=text("partner.auszahlung.titel", s, name=name),
                absaetze=[
                    text(
                        "partner.auszahlung.absatz",
                        s,
                        betrag=betrag,
                        waehrung=waehrung,
                        nummer=nummer,
                    )
                ],
                aktion=self._dashboard_aktion(s),
                hinweise=[text("partner.auszahlung.hinweis_gutschrift", s)],
                sprache=s,
            ),
            ereignis="auszahlung",
        )

    # --- Team (0520) --------------------------------------------------------------

    def team_neu(self, *, email: str, name: str, sprache: str, team_partner: str) -> bool:
        s = aufloesen(sprache)
        return self._senden(
            email=email,
            sprache=s,
            betreff=text("partner.team_neu.betreff", s),
            inhalt=MailInhalt(
                titel=text("partner.team_neu.titel", s, name=name),
                absaetze=[text("partner.team_neu.absatz", s, team_partner=team_partner or "—")],
                aktion=self._dashboard_aktion(s),
                hinweise=[text("partner.team_neu.hinweis", s)],
                sprache=s,
            ),
            ereignis="team_neu",
        )

    def team_provision(
        self, *, email: str, name: str, sprache: str, team_partner: str, satz_prozent: str
    ) -> bool:
        s = aufloesen(sprache)
        return self._senden(
            email=email,
            sprache=s,
            betreff=text("partner.team_provision.betreff", s),
            inhalt=MailInhalt(
                titel=text("partner.team_provision.titel", s, name=name),
                absaetze=[
                    text(
                        "partner.team_provision.absatz",
                        s,
                        team_partner=team_partner or "—",
                        satz=satz_prozent,
                    )
                ],
                aktion=self._dashboard_aktion(s),
                sprache=s,
            ),
            ereignis="team_provision",
        )
