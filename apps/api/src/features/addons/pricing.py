"""Gemeinsame Add-on-Preisberechnung.

Eine Wahrheit für Buchungsstrecke, Nach-Buchung-Kauf und Pricing-Resolver:
Basis-Hochrechnung (Aufenthalt/Nacht/Gast/Einheit) + optionale Steuer. Kein
Doppel-Mechanismus, keine erfundenen Defaults.
"""
from __future__ import annotations


def addon_net(price: float, basis: str, *, nights: int, guests: int, qty: int) -> float:
    """Netto-Betrag eines Upsells nach Abrechnungsbasis.

    per_stay: einmal je Aufenthalt (× qty). per_night: × Nächte. per_guest:
    × Gäste. per_unit: × Menge. ``qty`` ist die vom Gast gewählte Stückzahl
    (mind. 1); bei per_unit ist qty die Einheit, sonst ein Mehrfach-Kauf.
    """
    units = max(int(qty), 1)
    base = float(price)
    if basis == "per_night":
        return base * nights * units
    if basis == "per_guest":
        return base * guests * units
    if basis == "per_unit":
        return base * units
    return base * units  # per_stay


def addon_tax(net: float, tax_rate: float | None) -> float:
    """Steuerbetrag auf den Netto-Betrag (Prozentsatz; None/0 = keine Steuer)."""
    if not tax_rate:
        return 0.0
    return float(net) * float(tax_rate) / 100.0


def addon_total(
    price: float,
    basis: str,
    tax_rate: float | None,
    *,
    nights: int,
    guests: int,
    qty: int,
) -> tuple[float, float]:
    """(Netto, Brutto) eines Upsells. Brutto = Netto + Steuer, auf 2 Stellen."""
    net = addon_net(price, basis, nights=nights, guests=guests, qty=qty)
    gross = net + addon_tax(net, tax_rate)
    return round(net, 2), round(gross, 2)
