"""Steuerregime der verbundenen Portale — automatisch erkannt, nicht gepflegt.

Die Frage, die dieses Modul beantwortet: *Wie muss eine Steuer an DIESES Portal
gehen — im Preis enthalten, aufgeschlagen, oder gar nicht?*

Das ist bewusst KEINE Einstellung im Frontend. Der Betrieb kann nicht wissen,
dass Agoda „Inclusive With Commissions" kennt und Expedia „Total Amount
Excluding Tax"; er soll seine Kurtaxe einmal eintragen und sich darauf verlassen,
dass sie bei jedem Portal richtig ankommt. Die Information liegt vor:

1. **Channex-Kanal-Katalog** (`/channels/list`, live): jeder Kanal deklariert
   seine Steuer-Parameter. Live gemessen (03.08.2026):
   * `booking_tax_settings` — Agoda (Inclusive | Inclusive With Commissions |
     Exclusive), CTrip (Inclusive | Exclusive)
   * `booking_amount_settings` — AirBNB (Payout Amount | Total Paid Amount),
     Expedia (Collect Amount | Total Amount | Total Amount Excluding Tax),
     Ostrovok/Hostelworld (With/Without Commission), Goibibo
   Alle anderen Kanäle (u. a. Booking.com) deklarieren KEIN Steuerfeld.
2. **Die tatsächliche Kanal-Einstellung** des verbundenen Kanals
   (`GET /channels/:id` → `settings`): welcher der Werte gewählt ist.

Daraus leitet sich ab, wie unsere Steuern zu senden sind. Was NICHT ableitbar
ist, wird auch nicht erfunden (Wurzel 4): kennt ein Kanal kein Steuerfeld, gilt
das Standardverhalten (Steuer normal übertragen, `is_inclusive` wie beim Objekt
gepflegt) — das ist genau das, was wir vorher schon getan haben.
"""
from __future__ import annotations

from supabase import Client

from .channex_client import ChannexError
from .common import log

# Kanal-Parameter, die ein Steuerregime tragen. Live aus dem Katalog gelesen —
# hier stehen nur die NAMEN der Felder, nicht die Kanäle: welcher Kanal welches
# Feld hat, sagt der Katalog zur Laufzeit. So wandert ein neuer Kanal von
# Channex automatisch mit, ohne Code-Änderung.
_TAX_PARAM_KEYS = ("booking_tax_settings", "booking_amount_settings")

# Werte, die bedeuten: „der Betrag, den wir senden, ist OHNE Steuer" — die
# Steuer wird also zusätzlich erwartet und muss exklusiv übertragen werden.
_EXCLUSIVE_VALUES = frozenset(
    {
        "Exclusive",
        "Total Amount Excluding Tax",
    }
)
# Werte, die bedeuten: „der Betrag ist INKLUSIVE Steuer" — die Steuer steckt im
# Preis und darf nicht zusätzlich aufgeschlagen werden.
_INCLUSIVE_VALUES = frozenset(
    {
        "Inclusive",
        "Inclusive With Commissions",
        "Total Paid Amount",
        "Total Amount",
    }
)
# Werte, die einen Netto-/Auszahlungsbetrag beschreiben: das Portal rechnet die
# Steuer selbst zum Gastpreis. Eine zusätzlich übertragene Steuer würde beim
# Gast doppelt erscheinen.
_PORTAL_RECHNET_SELBST = frozenset(
    {
        "Payout Amount",
        "Collect Amount",
    }
)
# Werte, die gar keine Steueraussage treffen: Hostelworld und Ostrovok nutzen
# `booking_amount_settings` für die PROVISION („With/Without Commission"), nicht
# für die Steuer. Bekannt und bewusst ohne Wirkung — sonst stünde bei jedem Sync
# dieser Kanäle eine Warnung im Log, die niemand beheben kann (live gesehen).
_KEINE_STEUERAUSSAGE = frozenset({"With Commission", "Without Commission"})


class TaxRegime:
    """Wie eine Steuer an EIN Portal gehen muss.

    * `inclusive` — Steuer ist im gesendeten Preis enthalten (`is_inclusive`).
      `None` = keine Aussage aus dem Kanal, die Pflege am Objekt gilt.
    * `senden` — darf die Steuer überhaupt übertragen werden? `False`, wenn das
      Portal sie selbst zum Gastpreis rechnet (sonst doppelte Berechnung).
    * `quelle` — woraus das abgeleitet wurde (für Protokoll/Diagnose).
    """

    __slots__ = ("inclusive", "senden", "quelle")

    def __init__(
        self,
        *,
        inclusive: bool | None = None,
        senden: bool = True,
        quelle: str = "standard",
    ) -> None:
        self.inclusive = inclusive
        self.senden = senden
        self.quelle = quelle

    def __repr__(self) -> str:  # pragma: no cover — nur Diagnose
        return (
            f"TaxRegime(inclusive={self.inclusive}, senden={self.senden}, "
            f"quelle={self.quelle!r})"
        )


# Standardregime: übertragen, Inklusiv-Frage entscheidet das Objekt. Genau das
# Verhalten von vor dieser Erkennung — ein unbekannter Kanal wird also nicht
# schlechter behandelt, nur nicht besser.
STANDARD = TaxRegime()


def _regime_aus_wert(wert: str, *, feld: str, portal: str) -> TaxRegime:
    """Einen konkreten Kanal-Einstellungswert in ein Regime übersetzen."""
    if wert in _PORTAL_RECHNET_SELBST:
        return TaxRegime(
            senden=False, quelle=f"{portal}.{feld}={wert}"
        )
    if wert in _EXCLUSIVE_VALUES:
        return TaxRegime(inclusive=False, quelle=f"{portal}.{feld}={wert}")
    if wert in _INCLUSIVE_VALUES:
        return TaxRegime(inclusive=True, quelle=f"{portal}.{feld}={wert}")
    if wert in _KEINE_STEUERAUSSAGE:
        return TaxRegime(quelle=f"{portal}.{feld}={wert} (Provision, keine Steuer)")
    # Unbekannter Wert: NICHT raten. Standardverhalten und protokollieren, damit
    # ein neuer Channex-Wert auffällt, statt still falsch behandelt zu werden.
    log.warning(
        "channex_steuerregime_unbekannter_wert",
        portal=portal,
        feld=feld,
        wert=wert,
    )
    return STANDARD


class TaxRegimeMixin:
    """Erkennt das Steuerregime der verbundenen Portale eines Objekts."""

    def regime_je_portal(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, TaxRegime]:
        """Portal-Code → Steuerregime für alle verbundenen Kanäle des Objekts.

        Liest die tatsächlichen Kanal-Einstellungen bei Channex. Fällt der Abruf
        aus, bleibt es beim Standardregime — der Steuer-Sync darf nicht
        blockieren, weil eine Kanal-Abfrage hakt (die Steuer würde sonst gar
        nicht mehr übertragen, was schlimmer ist als ohne die Feinsteuerung).
        """
        verbindungen = (
            db.table("channex_channel_connection")
            .select("ota_portal_code, channex_channel_id, is_active")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []

        regime: dict[str, TaxRegime] = {}
        katalog = self._steuer_parameter_katalog()
        for verbindung in verbindungen:
            portal = verbindung.get("ota_portal_code")
            if not portal or not verbindung.get("is_active"):
                continue
            felder = katalog.get(portal)
            if not felder:
                # Kanal deklariert kein Steuerfeld (z. B. Booking.com) →
                # Standardverhalten, keine Abfrage nötig.
                regime[portal] = STANDARD
                continue
            regime[portal] = self._regime_des_kanals(
                portal, verbindung.get("channex_channel_id"), felder
            )
        return regime

    def _steuer_parameter_katalog(self) -> dict[str, list[str]]:
        """Portal-Code → seine steuerrelevanten Parameter-Namen (live).

        Aus `/channels/list`. Ohne erreichbaren Katalog ein leeres Dict: dann
        gilt überall das Standardregime (fail-soft, siehe regime_je_portal).
        """
        # getattr statt Direktaufruf: der Katalog ist für die Steuer-Feinsteuerung
        # eine KÜR, nicht die Pflicht. Ein Client ohne diese Methode (schlanke
        # Doubles, künftige Teil-Implementierungen) soll das Standardregime
        # bekommen — nicht einen AttributeError, der den ganzen Steuer-Sync
        # kippt und damit die Steuer gar nicht mehr überträgt.
        laden = getattr(self._channex, "list_channel_catalog", None)
        if not callable(laden):
            return {}
        try:
            roh = laden().get("data") or []
        except ChannexError as exc:
            log.warning("channex_katalog_nicht_ladbar", error=str(exc))
            return {}
        katalog: dict[str, list[str]] = {}
        for eintrag in roh:
            attrs = eintrag.get("attributes") or eintrag
            code = attrs.get("code") or eintrag.get("code")
            params = attrs.get("params") or {}
            if not code or not isinstance(params, dict):
                continue
            felder = [k for k in _TAX_PARAM_KEYS if k in params]
            if felder:
                katalog[str(code)] = felder
        return katalog

    def _regime_des_kanals(
        self, portal: str, channex_channel_id: str | None, felder: list[str]
    ) -> TaxRegime:
        """Regime eines konkreten verbundenen Kanals aus seinen Einstellungen."""
        if not channex_channel_id:
            return STANDARD
        holen = getattr(self._channex, "get_channel", None)
        if not callable(holen):
            return STANDARD
        try:
            kanal = holen(channex_channel_id)
        except ChannexError as exc:
            log.warning(
                "channex_kanal_einstellungen_nicht_ladbar",
                portal=portal,
                error=str(exc),
            )
            return STANDARD
        attrs = (kanal.get("data") or {}).get("attributes") or {}
        settings = attrs.get("settings")
        if not isinstance(settings, dict):
            return STANDARD
        # Das erste deklarierte Steuerfeld mit gesetztem Wert entscheidet.
        # Mehr als eines hat live kein Kanal — träte es auf, gewinnt die
        # Reihenfolge aus _TAX_PARAM_KEYS (booking_tax_settings ist
        # spezifischer als booking_amount_settings).
        for feld in felder:
            wert = settings.get(feld)
            if isinstance(wert, str) and wert:
                return _regime_aus_wert(wert, feld=feld, portal=portal)
        return STANDARD


# Angewendet wird das Regime in `tax_sync._sync_taxes`: `senden` steuert die
# Set-Zusammenstellung (`posten_fuer`), `inclusive` wird per `update_tax` an der
# Steuer gesetzt. Channex führt `is_inclusive` an der STEUER, nicht am Set —
# deshalb gibt es hier bewusst keine Helferfunktion, die ein Set-Attribut
# umschreibt: das wäre eine Abstraktion über etwas, das Channex nicht anbietet.
