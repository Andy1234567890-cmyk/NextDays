"""Monatsdeckel der OTA-Provision — 250 €, alles darüber ist 0 %.

Eigene Datei nach dem Muster von `dynpricing.py`: eine geschlossene Einheit
(Satz → Stichtag → Umrechnung), die `service.py` sonst über die
1500-Zeilen-Grenze schiebt.

WARUM EIN EURO-BETRAG UND KEINE ZAHL JE WÄHRUNG:
Die Provision wird in der WÄHRUNG DER BUCHUNG geführt — myNextDays verkauft in
24 Ländern, eine dänische Buchung ergibt eine DKK-Zeile. Ein Deckel von „250"
ohne Währung wäre je nach Land ein völlig anderer Betrag (250 DKK ≈ 33 €). Der
Deckel ist deshalb als EUR definiert und wird mit dem ECB-Tageskurs in die
Rechnungswährung umgerechnet — dieselbe Kursquelle wie die Eigentümer-
Abrechnung (`owner_statements.fx`, Tabelle `fx_rates`), nicht eine zweite.

Kein Kurs beschaffbar → FEHLER, kein geratener Deckel (Wurzel 4/5). In der
reinen Anzeige (`get_commission_summary`) wird dieser Fehler bewusst gefangen
und das Feld bleibt leer: eine Übersicht darf nicht kippen, eine Abrechnung
schon.
"""
from __future__ import annotations

from datetime import date

from supabase import Client

from src.core.logging import get_logger

from .errors import SubscriptionsError

log = get_logger("nextdays.subscriptions.provisionsdeckel")

# Deckel je Abrechnungsperiode. Mehr als das zahlt kein Betrieb im Monat.
COMMISSION_CAP_EUR = 250.0
COMMISSION_CAP_CURRENCY = "EUR"


class ProvisionsdeckelMixin:
    """Der 250-€-Monatsdeckel und seine Umrechnung.

    Erwartet vom Host (`SubscriptionsService`): nichts — beide Methoden bekommen
    den DB-Client übergeben.
    """

    @staticmethod
    def cap_stichtag(period: str) -> date:
        """Kurs-Stichtag des Deckels: der 1. des abgerechneten Monats.

        Fest aus der Periode abgeleitet, NICHT `heute` — sonst bekäme derselbe
        Monat bei einem Wiederholungslauf einen anderen Kurs und damit einen
        anderen Deckel (Wurzel 2: ein zweiter Lauf muss dasselbe ergeben).
        """
        jahr, monat = (int(t) for t in period.split("-")[:2])
        return date(jahr, monat, 1)

    def cap_for_currency(self, db: Client, currency: str, period: str) -> float:
        """Der 250-€-Monatsdeckel in `currency`.

        Gleiche Währung → unverändert; sonst über den ECB-Tageskurs. Kein Kurs
        beschaffbar → klar fehlschlagen (503) statt mit einem geratenen Deckel
        abzurechnen (Wurzel 4/5).
        """
        if currency.strip().upper() == COMMISSION_CAP_CURRENCY:
            return COMMISSION_CAP_EUR
        # Lazy-Import: der Kurs wird nur beim Fremdwährungs-Deckel gebraucht und
        # der subscriptions-Slice soll nicht beim Laden an owner_statements hängen.
        from src.features.owner_statements.fx import FxError, FxService

        try:
            kurs = FxService(db).get_rate(
                self.cap_stichtag(period), COMMISSION_CAP_CURRENCY, currency
            )
        except FxError as exc:
            raise SubscriptionsError(
                f"Provisionsdeckel nicht umrechenbar: {exc}", status_code=503
            ) from exc
        return round(COMMISSION_CAP_EUR * float(kurs), 2)
