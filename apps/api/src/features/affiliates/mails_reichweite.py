"""Mails der Reichweiten-Etappe (0521) — erweitert `PartnerMails` um den
Widerruf einer Kanalverbindung. Eigene Datei, damit der Mail-Kern des Slice
unberührt bleibt; dieselbe Infrastruktur (`_senden`, `_dashboard_aktion`).
"""

from __future__ import annotations

from src.core.mail_layout import MailInhalt
from src.core.mail_sprache import aufloesen
from src.core.mail_texte import text

from .mails import PartnerMails

PLATTFORM_NAMEN = {
    "youtube": "YouTube",
    "instagram": "Instagram",
    "facebook": "Facebook",
    "tiktok": "TikTok",
}


class ReichweiteMails(PartnerMails):
    def kanal_widerrufen(
        self, *, email: str, name: str, sprache: str, plattform: str, konto: str
    ) -> bool:
        """Die Plattform hat den Zugriff entzogen — der Partner soll wissen, dass
        sein Kanal wieder als Selbstauskunft zählt und er neu verbinden kann."""
        s = aufloesen(sprache)
        anzeige = PLATTFORM_NAMEN.get(plattform, plattform)
        return self._senden(
            email=email,
            sprache=s,
            betreff=text("partner.kanal_widerrufen.betreff", s, plattform=anzeige),
            inhalt=MailInhalt(
                titel=text("partner.kanal_widerrufen.titel", s, name=name, plattform=anzeige),
                absaetze=[
                    text("partner.kanal_widerrufen.absatz", s, plattform=anzeige, konto=konto)
                ],
                aktion=self._dashboard_aktion(s),
                hinweise=[text("partner.kanal_widerrufen.hinweis", s)],
                sprache=s,
            ),
            ereignis="kanal_widerrufen",
        )
