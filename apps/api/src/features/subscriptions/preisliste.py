"""Die Preisliste — Beträge aus Stripe, für die UI und die Marketing-Seite.

Eigene Datei nach dem Muster von `provisionsdeckel.py`/`dynpricing.py`: eine
geschlossene Einheit (Stripe lesen → Tier-Liste → öffentliche Variante), die
`service.py` sonst über die 1500-Zeilen-Grenze schiebt.

WARUM ZWEI EINSTIEGE UND EINE QUELLE:
`get_pricing` bedient die eingeloggte Billing-UI, `get_public_pricing` die
Marketing-Preisseite ohne Login. Beide lesen DIESELBEN Stripe-Preise; die
öffentliche Variante legt nur die Konditionen dazu, die nicht in Stripe stehen
(Marktplatz-Provision, Portal-Provision, Monatsdeckel). Zwei getrennte
Ableitungen wären zwei Preislisten, die auseinanderlaufen (Wurzel 4).
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from stripe import StripeError as _StripeError

from .errors import SubscriptionsError
from .errors import field as _f
from .provisionsdeckel import COMMISSION_CAP_CURRENCY, COMMISSION_CAP_EUR
from .schemas import (
    COMMISSION_RATE_STANDARD,
    DYNPRICING_MODULE_KEY,
    DYNPRICING_RATE,
    GRUNDTARIF_LOOKUP_KEY,
    MARKETPLACE_FEE_BPS_STANDARD,
    ModulePrice,
    PriceTier,
    PricingResponse,
    PublicPricingResponse,
)

# Wie lange die ÖFFENTLICHE Preisliste zwischengehalten wird (Sekunden).
# Ohne Cache wäre `/subscriptions/public/pricing` ein Verstärker: jeder Aufruf
# der Marketing-Preisseite löst sechs Stripe-Abfragen aus, und die Seite ist
# nicht eingeloggt (Wurzel 8: teure öffentliche Endpunkte brauchen ein Dach).
# Preise sind in Stripe immutable — sie ändern sich nur, wenn wir einen neuen
# Preis anlegen; zehn Minuten Verzögerung sind dafür unkritisch.
PUBLIC_PRICING_TTL_SEKUNDEN = 600

# Prozess-lokale Ablage der öffentlichen Preisliste. Bewusst KEIN Redis: die
# Antwort ist für alle Besucher identisch (kein Tenant-Bezug), ein Cache je
# Container genügt, um die Stripe-Abfragen zu bündeln. Ein `dict` statt zweier
# Modul-Variablen, damit die Methode ohne `global` schreiben kann.
_PUBLIC_PRICING_CACHE: dict[str, Any] = {}

# module_key -> (lookup_key, per-unit-Label). Deckt alle im UI wählbaren Preise.
_MODULE_PRICE_VARIANTS: dict[str, tuple[str, str | None]] = {
    "modul3_buchhaltung": ("modul3_flat", None),
    "modul4_mitarbeiter": ("modul4_flat", None),
    "modul4_per_seat": ("modul4_per_seat", "Nutzer"),
    "modul6_hotel": ("modul6_flat", None),
    "modul6_per_room": ("modul6_per_room", "Zimmer"),
}


class PreislisteMixin:
    """Preisliste lesen (Stripe) — eingeloggt und öffentlich.

    Erwartet vom Host (`SubscriptionsService`): `self._stripe`, `self._stripe_err`.
    """

    def get_pricing(self) -> PricingResponse:
        """Liest die tatsächlichen Beträge aus Stripe (nie Frontend-Hardcode).
        Grundtarif als Tier-Liste, Module als Einzelpreise. Fehlt ein Preis,
        klar fehlschlagen (Preisliste nicht geseedet)."""
        try:
            res = self._stripe.v1.prices.list(
                params={
                    "lookup_keys": [GRUNDTARIF_LOOKUP_KEY],
                    "active": True,
                    "limit": 1,
                    "expand": ["data.tiers"],
                }
            )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        data = getattr(res, "data", None) or []
        if not data:
            raise SubscriptionsError(
                "Grundtarif-Preis nicht gefunden (Preisliste seeden).",
                status_code=503,
            )
        gt = data[0]
        currency = (_f(gt, "currency", "") or "").upper()
        tiers = [
            PriceTier(
                up_to=_f(t, "up_to"),
                flat_amount=_f(t, "flat_amount"),
                unit_amount=_f(t, "unit_amount"),
            )
            for t in (_f(gt, "tiers", []) or [])
        ]
        modules: list[ModulePrice] = []
        for mkey, (lookup, label) in _MODULE_PRICE_VARIANTS.items():
            try:
                mres = self._stripe.v1.prices.list(
                    params={
                        "lookup_keys": [lookup],
                        "active": True,
                        "limit": 1,
                        "expand": ["data.tiers"],
                    }
                )
            except _StripeError as exc:
                raise self._stripe_err(exc) from exc
            mdata = getattr(mres, "data", None) or []
            if not mdata:
                continue  # Modul-Preis fehlt → weglassen (nicht raten)
            mtiers = [
                PriceTier(
                    up_to=_f(t, "up_to"),
                    flat_amount=_f(t, "flat_amount"),
                    unit_amount=_f(t, "unit_amount"),
                )
                for t in (_f(mdata[0], "tiers", []) or [])
            ]
            modules.append(
                ModulePrice(
                    module_key=mkey,
                    lookup_key=lookup,
                    unit_amount=int(_f(mdata[0], "unit_amount", 0) or 0),
                    per_unit_label=label,
                    tiers=mtiers or None,
                )
            )
        # Nutzungsabhängige Module haben keinen Stripe-Preis (der Betrag
        # entsteht erst je Buchung im Ledger). Sie stehen trotzdem im Katalog,
        # damit die UI sie anbieten kann — mit Prozentsatz statt Betrag.
        modules.append(
            ModulePrice(
                module_key=DYNPRICING_MODULE_KEY,
                lookup_key="",
                unit_amount=0,
                per_unit_label=None,
                tiers=None,
                usage_percent=DYNPRICING_RATE * 100,
            )
        )
        return PricingResponse(
            currency=currency, grundtarif_tiers=tiers, modules=modules
        )

    def get_public_pricing(self) -> PublicPricingResponse:
        """Dieselbe Preisliste für die ÖFFENTLICHE Marketing-Preisseite.

        Zusätzlich zu den Stripe-Beträgen liefert sie die Konditionen, die die
        Preisseite nennen muss (Marktplatz-Provision, Portal-Provision,
        Monatsdeckel) — aus den benannten Konstanten dieses Slices, damit im
        Marketing-Frontend kein zweiter Satz Zahlen entsteht (Wurzel 4).

        Zwischengehalten für `PUBLIC_PRICING_TTL_SEKUNDEN`: der Endpunkt ist
        nicht eingeloggt und würde sonst je Seitenaufruf sechs Stripe-Abfragen
        auslösen (Wurzel 8). Ein Fehler wird NICHT zwischengehalten — sonst
        stünde die Seite zehn Minuten ohne Preise da, obwohl Stripe längst
        wieder antwortet.
        """
        jetzt = datetime.now(UTC)
        stand = _PUBLIC_PRICING_CACHE.get("stand")
        antwort = _PUBLIC_PRICING_CACHE.get("antwort")
        if (
            isinstance(stand, datetime)
            and isinstance(antwort, PublicPricingResponse)
            and (jetzt - stand).total_seconds() < PUBLIC_PRICING_TTL_SEKUNDEN
        ):
            return antwort
        preise = self.get_pricing()
        frisch = PublicPricingResponse(
            currency=preise.currency,
            grundtarif_tiers=preise.grundtarif_tiers,
            modules=preise.modules,
            # bps → Prozent (800 → 8.0). Der Satz steht in der DB je Tenant;
            # öffentlich beworben wird der Standard (schemas-Konstante).
            commission_marketplace_percent=MARKETPLACE_FEE_BPS_STANDARD / 100,
            commission_external_percent=COMMISSION_RATE_STANDARD * 100,
            commission_external_cap_amount=COMMISSION_CAP_EUR,
            commission_external_cap_currency=COMMISSION_CAP_CURRENCY,
        )
        _PUBLIC_PRICING_CACHE["stand"] = jetzt
        _PUBLIC_PRICING_CACHE["antwort"] = frisch
        return frisch
