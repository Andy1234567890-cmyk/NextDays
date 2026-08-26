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

# Prozess-lokale Ablage der öffentlichen Preisliste, JE WÄHRUNG:
# `{"": (stand, antwort), "DKK": (stand, antwort), …}` — Schlüssel "" ist die
# Standardwährung. Bewusst KEIN Redis: die Antwort ist innerhalb einer Währung
# für alle Besucher identisch (kein Tenant-Bezug), ein Cache je Container
# genügt, um die Stripe-Abfragen zu bündeln.
#
# Der Schlüssel ist der Grund, warum das ein Dict von Tupeln ist und nicht zwei
# Modul-Variablen: mit EINEM Eintrag für alle Währungen hätte der erste
# Besucher entschieden, welche Währung die nächsten zehn Minuten alle sehen.
_PUBLIC_PRICING_CACHE: dict[str, Any] = {}

# module_key -> (lookup_key, per-unit-Label). Deckt alle im UI wählbaren Preise.
_MODULE_PRICE_VARIANTS: dict[str, tuple[str, str | None]] = {
    "modul3_buchhaltung": ("modul3_flat", None),
    "modul4_mitarbeiter": ("modul4_flat", None),
    "modul4_per_seat": ("modul4_per_seat", "Nutzer"),
    "modul6_hotel": ("modul6_flat", None),
    "modul6_per_room": ("modul6_per_room", "Zimmer"),
    "modul7_avatar": ("modul7_flat", None),
}


def waehrung_pruefen(code: str | None) -> str | None:
    """Angefragten Währungscode normalisieren — oder 422.

    Der Wert kommt aus einer öffentlichen Query. Er landet in einem
    Stripe-`expand`-Pfad, also darf hier nichts anderes durch als drei
    Buchstaben (Wurzel 8: Client-Input, der serverseitig weiterverwendet wird).
    Angreiferkontrollierter Unsinn ergibt einen klaren 422, keinen 500
    (Wurzel 5).
    """
    if code is None:
        return None
    roh = code.strip().upper()
    if not roh:
        return None
    if len(roh) != 3 or not roh.isalpha() or not roh.isascii():
        raise SubscriptionsError(
            "Währung muss ein dreibuchstabiger ISO-4217-Code sein.",
            status_code=422,
        )
    return roh


def _waehrungsoptionen(preis: object) -> dict[str, Any]:
    """`currency_options` eines Preises als Dict mit KLEIN geschriebenen Codes.

    Stripes `StripeObject` ist KEIN `dict`-Subtyp. Daran sind hintereinander
    zwei naheliegende Zugriffe gescheitert, beide live am 24.08.2026:

    · `dict(obj)` liest es als Folge von Paaren, greift auf Index 0 zu und
      stirbt mit `KeyError: 0`. Das hat die ganze Preisliste gekippt („Preise
      gerade nicht abrufbar") — ein Fehler in der Nebensache Währung, der den
      Hauptpfad mitgenommen hat.
    · `obj.keys()` wirft `AttributeError: keys`, weil JEDER Attributzugriff als
      Feldzugriff auf die Nutzdaten gedeutet wird. Das war schlimmer als ein
      Absturz: der Aufrufer fing die Ausnahme, sah „keine Währungsoptionen" und
      hätte damit AUCH NACH dem Stripe-Eintrag für immer EUR ausgeliefert —
      still, ohne Fehler, mit einer plausibel aussehenden Antwort.

    Was trägt, ist die öffentliche Methode `to_dict()`. Sie steht hier zuerst;
    ein echtes Dict geht direkt durch, und bleibt beides aus, sind es eben
    keine Währungsoptionen (leeres Dict, nie eine Ausnahme).
    """
    opts = _f(preis, "currency_options", None)
    if opts is None:
        return {}
    if isinstance(opts, dict):
        rein = dict(opts)
    else:
        umwandeln = getattr(opts, "to_dict", None)
        if not callable(umwandeln):
            return {}
        try:
            rein = dict(umwandeln())
        except (TypeError, ValueError):
            return {}
    return {str(k).lower(): v for k, v in rein.items()}


class PreislisteMixin:
    """Preisliste lesen (Stripe) — eingeloggt und öffentlich.

    Erwartet vom Host (`SubscriptionsService`): `self._stripe`, `self._stripe_err`.
    """

    def get_pricing(self, currency: str | None = None) -> PricingResponse:
        """Liest die tatsächlichen Beträge aus Stripe (nie Frontend-Hardcode).
        Grundtarif als Tier-Liste, Module als Einzelpreise. Fehlt ein Preis,
        klar fehlschlagen (Preisliste nicht geseedet).

        `currency` ist ein WUNSCH, keine Zusage: liefert Stripe für diese
        Währung Beträge (`currency_options`), kommen sie; sonst antwortet die
        Liste in der Standardwährung des Preises. Das Feld `currency` der
        Antwort sagt immer, was tatsächlich drin ist — der Aufrufer muss nicht
        raten und darf nichts umrechnen (Wurzel 4).

        ALLES ODER NICHTS: fehlt die Wunschwährung an EINEM der Preise, gilt sie
        für die ganze Liste als nicht vorhanden. Genau so verhält sich Stripe
        Checkout auch — es fällt für den GESAMTEN Vorgang auf die
        Standardwährung zurück, wenn nicht jede Position die lokale Währung
        trägt. Eine gemischte Anzeige (Grundtarif in DKK, ein Modul in EUR)
        wäre eine Summe, die der Kunde nie zu zahlen bekommt.
        """
        wunsch = waehrung_pruefen(currency)
        try:
            res = self._stripe.v1.prices.list(
                params={
                    "lookup_keys": [GRUNDTARIF_LOOKUP_KEY],
                    "active": True,
                    "limit": 1,
                    "expand": ["data.tiers", "data.currency_options"],
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
        standard = (_f(gt, "currency", "") or "").upper()
        # Wunschwährung nur, wenn sie am Grundtarif überhaupt existiert. Die
        # Modul-Prüfung folgt weiter unten und kann sie noch verwerfen.
        gewuenscht = (
            wunsch
            if wunsch and wunsch != standard and wunsch.lower() in _waehrungsoptionen(gt)
            else None
        )
        if gewuenscht:
            # Die Staffel einer FREMDwährung kommt nur mit einem eigenen
            # expand-Pfad mit; `expand=currency_options` allein liefert
            # `tiers: null` (live geprüft 24.08.2026).
            try:
                gt = self._stripe.v1.prices.retrieve(
                    _f(gt, "id"),
                    params={
                        "expand": [
                            "tiers",
                            f"currency_options.{gewuenscht.lower()}.tiers",
                        ]
                    },
                )
            except _StripeError as exc:
                raise self._stripe_err(exc) from exc
        # Staffel der Wunschwährung, sonst die des Standardpreises.
        gt_optionen = _waehrungsoptionen(gt)
        rohstufen = (
            _f(gt_optionen.get(gewuenscht.lower()), "tiers", None)
            if gewuenscht
            else None
        ) or (_f(gt, "tiers", []) or [])
        tiers = [
            PriceTier(
                up_to=_f(t, "up_to"),
                flat_amount=_f(t, "flat_amount"),
                unit_amount=_f(t, "unit_amount"),
            )
            for t in rohstufen
        ]
        modules: list[ModulePrice] = []
        # Sammelt die Modulpreise ROH, damit erst NACH dem letzten Modul
        # entschieden wird, ob die Wunschwährung für die ganze Liste gilt.
        roh_module: list[tuple[str, str, str | None, object]] = []
        for mkey, (lookup, label) in _MODULE_PRICE_VARIANTS.items():
            try:
                mres = self._stripe.v1.prices.list(
                    params={
                        "lookup_keys": [lookup],
                        "active": True,
                        "limit": 1,
                        "expand": ["data.tiers", "data.currency_options"],
                    }
                )
            except _StripeError as exc:
                raise self._stripe_err(exc) from exc
            mdata = getattr(mres, "data", None) or []
            if not mdata:
                continue  # Modul-Preis fehlt → weglassen (nicht raten)
            roh_module.append((mkey, lookup, label, mdata[0]))
            if gewuenscht and gewuenscht.lower() not in _waehrungsoptionen(mdata[0]):
                # Ein Modul ohne die Wunschwährung verwirft sie für ALLES —
                # siehe „alles oder nichts" im Docstring.
                gewuenscht = None
                tiers = [
                    PriceTier(
                        up_to=_f(t, "up_to"),
                        flat_amount=_f(t, "flat_amount"),
                        unit_amount=_f(t, "unit_amount"),
                    )
                    for t in (_f(gt, "tiers", []) or [])
                ]
        for mkey, lookup, label, preis in roh_module:
            option = (
                _waehrungsoptionen(preis).get(gewuenscht.lower())
                if gewuenscht
                else None
            )
            quelle = option if option is not None else preis
            mtiers = [
                PriceTier(
                    up_to=_f(t, "up_to"),
                    flat_amount=_f(t, "flat_amount"),
                    unit_amount=_f(t, "unit_amount"),
                )
                for t in (_f(quelle, "tiers", []) or [])
            ]
            modules.append(
                ModulePrice(
                    module_key=mkey,
                    lookup_key=lookup,
                    unit_amount=int(_f(quelle, "unit_amount", 0) or 0),
                    per_unit_label=label,
                    tiers=mtiers or None,
                )
            )
        currency = gewuenscht or standard
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

    def get_public_pricing(
        self, currency: str | None = None
    ) -> PublicPricingResponse:
        """Dieselbe Preisliste für die ÖFFENTLICHE Marketing-Preisseite.

        Zusätzlich zu den Stripe-Beträgen liefert sie die Konditionen, die die
        Preisseite nennen muss (Marktplatz-Provision, Portal-Provision,
        Monatsdeckel) — aus den benannten Konstanten dieses Slices, damit im
        Marketing-Frontend kein zweiter Satz Zahlen entsteht (Wurzel 4).

        `currency` ist der Wunsch des Besuchers (die Marketing-Seite leitet ihn
        aus der gewählten Sprache ab). Antwortet Stripe für diese Währung nicht,
        kommt die Standardwährung — das Feld `currency` sagt, welche es wurde.

        DER PROVISIONSDECKEL BLEIBT IN EUR, auch in einer DKK-Antwort. Er ist
        keine Preisangabe, sondern eine vertragliche Grenze, die die Abrechnung
        in EUR rechnet (`provisionsdeckel.py`). Ihn mitzuwandeln hieße, eine
        Zahl zu nennen, die so nirgends gilt (Wurzel 4). Deshalb trägt er seine
        eigene Währung im eigenen Feld, und die UI zeigt sie mit.

        Zwischengehalten für `PUBLIC_PRICING_TTL_SEKUNDEN`, JE WÄHRUNG: der
        Endpunkt ist nicht eingeloggt und würde sonst je Seitenaufruf sechs
        Stripe-Abfragen auslösen (Wurzel 8). Ein Cache über alle Währungen
        hinweg hätte dem ersten Besucher seine Währung gegeben und allen
        folgenden dieselbe — zehn Minuten lang die falsche. Ein Fehler wird
        NICHT zwischengehalten, sonst stünde die Seite zehn Minuten ohne Preise
        da, obwohl Stripe längst wieder antwortet.
        """
        wunsch = waehrung_pruefen(currency)
        schluessel = wunsch or ""
        jetzt = datetime.now(UTC)
        eintrag = _PUBLIC_PRICING_CACHE.get(schluessel)
        if isinstance(eintrag, tuple) and len(eintrag) == 2:
            stand, antwort = eintrag
            if (
                isinstance(stand, datetime)
                and isinstance(antwort, PublicPricingResponse)
                and (jetzt - stand).total_seconds() < PUBLIC_PRICING_TTL_SEKUNDEN
            ):
                return antwort
        preise = self.get_pricing(wunsch)
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
        _PUBLIC_PRICING_CACHE[schluessel] = (jetzt, frisch)
        return frisch
