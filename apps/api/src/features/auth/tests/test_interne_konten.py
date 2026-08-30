"""`tenants.is_internal` (0505) — interne Konten, getrennt von `is_demo`.

WARUM ES DIESE TESTS GIBT: die beiden Kennzeichnungen sehen einander ähnlich
und bedeuten das Gegenteil. `is_demo` sperrt (405 auf jede Änderung,
`/buchhaltung` gar nicht einsehbar), `is_internal` gibt frei. Wer sie
verwechselt, baut einen Riegel, der genau die falschen trifft — live am
30.08.2026 passiert, als die Buchhaltung an `is_demo` gehängt wurde und
daraufhin für NIEMANDEN sichtbar war, weil kein Mandant dieses Flag trägt.
"""

from src.features.auth.schemas import MeResponse


def test_getrennte_felder() -> None:
    """Ein internes Konto ist KEIN Vorführ-Mandant und umgekehrt.

    Fielen beide auf denselben Wert zusammen, wäre der Riegel wirkungslos:
    die Buchhaltung erschiene ausgerechnet dort, wo `demo_gate` sie sperrt.
    """
    intern = MeResponse(user_id="u", is_internal=True)
    assert intern.is_internal is True
    assert intern.is_demo is False

    vorfuehrung = MeResponse(user_id="u", is_demo=True)
    assert vorfuehrung.is_demo is True
    assert vorfuehrung.is_internal is False


def test_vorgabe_ist_gesperrt() -> None:
    """Ohne Angabe gilt „kein internes Konto" — fail-closed (Wurzel 5).

    Ein echter Betrieb darf ein unfertiges Modul nicht deshalb sehen, weil ein
    Feld fehlte. Die Vorgabe muss die restriktive sein, nicht die freizügige.
    """
    assert MeResponse(user_id="u").is_internal is False


def test_buchhaltung_bleibt_in_der_vorfuehrung_gesperrt() -> None:
    """Die Vorführung sperrt `/buchhaltung` — das hat 0505 nicht aufgeweicht.

    Hängt jemand die Sichtbarkeit später doch an `is_demo`, zeigt dieser Test,
    warum das nicht geht: die API verweigert den Bereich dort ohnehin.
    """
    from src.features.auth.demo_gate import GESPERRTE_PRAEFIXE

    assert "/buchhaltung" in GESPERRTE_PRAEFIXE
