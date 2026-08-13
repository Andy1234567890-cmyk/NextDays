"""Vergangene Tage gehen nie an Channex — zentral, für alle Sendewege.

DER BEFUND (13.08.2026, live aus `channex_debug_log`): 356 Aufrufe zwischen dem
05.08. und 13.08. wurden von Channex quittiert mit

    "warnings": ["Past date is not allowed.
                  `date_from` was changed from 2026-08-12 to 2026-08-13"]

343 davon `restrictions`, 13 `availability`. Ursache war nicht ein einzelner
Fehler, sondern eine ASYMMETRIE: drei der fünf Sendewege klemmten auf heute, die
zwei Retry-Pfade nicht — und die bauen ihre Nutzlast aus der rohen Outbox-Zeile
neu auf (`date_from = check_in`, bei laufender Buchung also gestern).

Diese Tests halten die zentrale Klemmung fest.
"""

from __future__ import annotations

from datetime import date, timedelta

from src.features.channel_manager.channex_client import ohne_vergangenheit

HEUTE = date(2026, 8, 13)


def test_spanne_beginnt_bei_heute_statt_gestern() -> None:
    """Die echte Live-Nutzlast, die die Warnung auslöste (Feriehus Line)."""
    gesendet = ohne_vergangenheit(
        [
            {
                "date_from": "2026-08-12",
                "date_to": "2026-08-13",
                "property_id": "b02f3d49-568a-40a5-bbaa-8eb1c2273d11",
                "availability": 0,
                "room_type_id": "83f1cb64-7f56-476b-8f91-966f70694dc8",
            }
        ],
        heute=HEUTE,
    )
    assert len(gesendet) == 1
    assert gesendet[0]["date_from"] == "2026-08-13", (
        "genau dieses `date_from` verschob Channex 356× stillschweigend"
    )
    assert gesendet[0]["date_to"] == "2026-08-13", "das Ende bleibt unangetastet"
    # Die übrigen Felder dürfen sich nicht verändern.
    assert gesendet[0]["availability"] == 0
    assert gesendet[0]["room_type_id"] == "83f1cb64-7f56-476b-8f91-966f70694dc8"


def test_komplett_vergangene_spanne_faellt_heraus() -> None:
    """Eine abgelaufene Nacht braucht Channex nicht mehr zu sehen."""
    assert (
        ohne_vergangenheit(
            [{"date_from": "2026-07-01", "date_to": "2026-07-08", "availability": 0}],
            heute=HEUTE,
        )
        == []
    )


def test_einzeltag_wird_ebenso_behandelt() -> None:
    """Channex kennt zwei Formen: `date` und `date_from`/`date_to` — beide zählen.

    Die Rate-Zeile mit `date` war live dabei (`{"date": "2026-07-17",
    "rate": 67500}`). Hätte die Klemmung nur Spannen behandelt, wäre die halbe
    Ursache offen geblieben.
    """
    werte = [
        {"date": "2026-07-17", "rate": 67500},  # Vergangenheit
        {"date": "2026-08-13", "rate": 67500},  # heute
        {"date": "2026-09-01", "rate": 67500},  # Zukunft
    ]
    behalten = ohne_vergangenheit(werte, heute=HEUTE)
    assert [w["date"] for w in behalten] == ["2026-08-13", "2026-09-01"]


def test_heute_selbst_bleibt_drin() -> None:
    """Heute ist NICHT Vergangenheit — die heutige Nacht wird noch verkauft."""
    assert ohne_vergangenheit([{"date": "2026-08-13"}], heute=HEUTE)
    assert ohne_vergangenheit(
        [{"date_from": "2026-08-13", "date_to": "2026-08-13"}], heute=HEUTE
    )


def test_zukunft_bleibt_unveraendert() -> None:
    """Was in der Zukunft liegt, wird nicht angefasst (kein stiller Umbau)."""
    wert = {
        "date_from": "2027-06-07",
        "date_to": "2027-06-10",
        "rate": 98125,
        "stop_sell": True,
    }
    assert ohne_vergangenheit([wert], heute=HEUTE) == [wert]


def test_werte_ohne_datum_gehen_durch() -> None:
    """Hier wird beschnitten, nicht validiert (Wurzel 4: nichts erfinden)."""
    wert = {"property_id": "abc", "availability": 3}
    assert ohne_vergangenheit([wert], heute=HEUTE) == [wert]


def test_leere_liste_bleibt_leer() -> None:
    assert ohne_vergangenheit([], heute=HEUTE) == []


def test_ohne_argument_gilt_der_echte_heute() -> None:
    """Der Standardwert muss der laufende Tag sein, nicht ein Testdatum."""
    gestern = (date.today() - timedelta(days=1)).isoformat()
    morgen = (date.today() + timedelta(days=1)).isoformat()
    assert ohne_vergangenheit([{"date": gestern}]) == []
    assert ohne_vergangenheit([{"date": morgen}]) == [{"date": morgen}]


def test_der_client_klemmt_wirklich_beide_endpunkte() -> None:
    """Die Umkehrprobe: die Klemmung muss IM Sendeweg sitzen, nicht daneben.

    Ohne diesen Test bliebe alles grün, wenn jemand `ohne_vergangenheit` aus
    `update_availability`/`update_restrictions` entfernt — die Funktion für sich
    wäre weiter korrekt und völlig wirkungslos. Genau diese Lücke hatte der
    ursprüngliche Fehler.
    """
    from src.features.channel_manager.channex_client import ChannexClient

    gesendet: list[dict[str, object]] = []

    class _Client(ChannexClient):
        def post(self, path: str, **kwargs: object) -> dict[str, object]:  # type: ignore[override]
            gesendet.append({"path": path, "json": kwargs.get("json")})
            return {"meta": {"message": "Success"}}

    client = _Client()
    gestern = (date.today() - timedelta(days=1)).isoformat()
    heute_iso = date.today().isoformat()

    # Spanne über die Tagesgrenze: wird beschnitten und gesendet.
    client.update_availability(
        [{"date_from": gestern, "date_to": heute_iso, "availability": 0}]
    )
    assert gesendet[0]["path"] == "availability"
    werte = gesendet[0]["json"]["values"]  # type: ignore[index]
    assert werte[0]["date_from"] == heute_iso, (
        "update_availability sendet noch Vergangenheit — die Klemmung fehlt im "
        "Sendeweg"
    )

    # Nur Vergangenheit: gar kein Aufruf (kein leeres `values` verschicken).
    client.update_restrictions([{"date": gestern, "rate": 1000}])
    assert len(gesendet) == 1, (
        "eine Nutzlast, von der nichts übrig bleibt, darf keinen Round-Trip und "
        "kein Portal-Budget kosten"
    )


def test_nur_vergangenheit_kostet_keinen_aufruf() -> None:
    """Die Antwort bleibt erfolgsförmig, damit kein Aufrufer einen Sonderfall braucht."""
    from src.features.channel_manager.channex_client import ChannexClient

    gesendet: list[str] = []

    class _Client(ChannexClient):
        def post(self, path: str, **kwargs: object) -> dict[str, object]:  # type: ignore[override]
            gesendet.append(path)
            return {"meta": {"message": "Success"}}

    gestern = (date.today() - timedelta(days=1)).isoformat()
    antwort = _Client().update_availability([{"date": gestern, "availability": 0}])
    assert gesendet == []
    assert antwort["data"] == []
    assert "meta" in antwort
