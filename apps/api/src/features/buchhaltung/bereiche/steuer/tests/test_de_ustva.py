"""Kennzahlen-Mapping DE: Satz → Kz, Regeln → Kz, Sammelposten, Kleinunternehmer."""

from decimal import Decimal

from src.features.buchhaltung.bereiche.steuer import de_ustva
from src.features.buchhaltung.bereiche.steuer.schemas import InputTaxLine, SalesLine


def _s(cat: str, rate: str | None, net: str, tax: str = "0") -> SalesLine:
    return SalesLine(
        category=cat,
        tax_rate=Decimal(rate) if rate else None,  # type: ignore[arg-type]
        net=Decimal(net),
        tax=Decimal(tax),
        invoice_count=1,
    )


def _kz(figs, code: str) -> Decimal:  # noqa: ANN001
    return next(f.amount for f in figs if f.code == code)


def test_saetze_und_regeln() -> None:
    figs, warn = de_ustva.kennzahlen(
        [
            _s("taxable", "19", "100", "19"),
            _s("taxable", "7", "50", "3.5"),
            _s("taxable", "16", "10", "1.6"),
            _s("taxable", "0", "5"),
            _s("exempt", None, "7"),
            _s("intra_community_supply", None, "8"),
            _s("reverse_charge_domestic", None, "9"),
            _s("out_of_scope", None, "11"),
            _s("oss", None, "13"),
        ],
        [
            InputTaxLine(
                tax_rate=Decimal("19"), net=Decimal("200"), tax=Decimal("38"), expense_count=1
            )
        ],
        payable=Decimal("-13.90"),
        small_business=False,
    )
    assert _kz(figs, "81") == Decimal("100")
    assert _kz(figs, "86") == Decimal("50")
    assert _kz(figs, "35") == Decimal("10") and _kz(figs, "36") == Decimal("1.6")
    assert _kz(figs, "48") == Decimal("12")  # 0 % (5) + exempt (7) zusammengeführt
    assert _kz(figs, "41") == Decimal("8")
    assert _kz(figs, "60") == Decimal("9")
    assert _kz(figs, "45") == Decimal("24")  # out_of_scope + oss
    assert _kz(figs, "66") == Decimal("38")
    assert _kz(figs, "83") == Decimal("-13.90")
    assert [f.code for f in figs] == sorted((f.code for f in figs), key=int)
    assert any("Kz 48" in w for w in warn)


def test_kleinunternehmer_leer() -> None:
    figs, warn = de_ustva.kennzahlen(
        [_s("taxable", "0", "100")], [], payable=Decimal("0"), small_business=True
    )
    assert figs == [] and any("§ 19" in w for w in warn)


def test_undetermined_warnt_und_bleibt_draussen() -> None:
    figs, warn = de_ustva.kennzahlen(
        [_s("undetermined", None, "100", "19")], [], payable=Decimal("19"), small_business=False
    )
    assert [f.code for f in figs] == ["66", "83"]
    assert any("nicht zugeordnet" in w for w in warn)
