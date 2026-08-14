"""Gemeinsame Add-on-Preisberechnung.

Eine Wahrheit für Buchungsstrecke, Nach-Buchung-Kauf und Pricing-Resolver:
Basis-Hochrechnung (Aufenthalt/Nacht/Gast/Einheit) + optionale Steuer. Kein
Doppel-Mechanismus, keine erfundenen Defaults.
"""
from __future__ import annotations


def addon_net(price: float, basis: str, *, nights: int, qty: int) -> float:
    """Netto-Betrag eines Upsells nach Abrechnungsbasis.

    per_stay: einmal je Aufenthalt (× qty). per_night: × Nächte × qty.
    per_unit: × qty. per_guest: × qty — die Menge IST hier die Personenzahl.

    KEIN `guests`-Parameter mehr (14.08.2026): Seit `per_guest` die Menge als
    Personenzahl nimmt, geht die Gästezahl der Buchung in keine Rechnung mehr
    ein — sie ist nur noch die Vorbelegung (`vorbelegte_menge`). Einen
    Parameter zu behalten, den keine Basis liest, hieße zu behaupten, er
    beeinflusse etwas.

    WARUM `per_guest` NICHT mit `guests` multipliziert (geändert 14.08.2026):
    Die Gästezahl der Buchung ist eine Vorbelegung, keine Bestellmenge. Real
    kommt es laufend vor, dass eine Buchung über 4 Personen nur 2 Wäschepakete
    bestellt — der Rest bringt eigene Bettwäsche mit. Vorher rechnete diese
    Basis `preis × guests × qty`: Die Menge war ein Multiplikator OBENDRAUF, mit
    dem sich die Gästezahl nicht unterschreiten ließ (qty=2 ergab 4 × 2 = 8
    Pakete). Eine zu hohe Rechnung war damit nicht korrigierbar, ohne den
    Posten zu stornieren und mit einer Fantasie-Menge neu anzulegen.

    Der Aufrufer belegt `qty` mit der Gästezahl vor (`vorbelegte_menge`) und
    lässt sie überschreiben. `guests` bleibt in der Signatur, weil die
    Vorbelegung dieselbe Wahrheit braucht und der Parameter für künftige
    Basen offen ist.
    """
    units = max(int(qty), 1)
    base = float(price)
    if basis == "per_night":
        return base * nights * units
    return base * units  # per_stay | per_unit | per_guest


def vorbelegte_menge(basis: str, *, guests: int) -> int:
    """Welche Menge im Formular vorgeschlagen wird.

    `per_guest` schlägt die Gästezahl der Buchung vor — das ist der Normalfall
    („Wäsche für alle"). Jede andere Basis schlägt 1 vor. Der Vorschlag ist
    verbindlich, bis jemand ihn ändert: er wird als `qty` gespeichert, damit an
    der Zeile ablesbar bleibt, wie viele Einheiten berechnet wurden.
    """
    return max(int(guests), 1) if basis == "per_guest" else 1


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
    qty: int,
) -> tuple[float, float]:
    """(Netto, Brutto) eines Upsells. Brutto = Netto + Steuer, auf 2 Stellen."""
    net = addon_net(price, basis, nights=nights, qty=qty)
    gross = net + addon_tax(net, tax_rate)
    return round(net, 2), round(gross, 2)
