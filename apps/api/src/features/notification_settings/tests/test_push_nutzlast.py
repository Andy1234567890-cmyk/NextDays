"""Die FCM-Nutzlast — das Gate, das vom 21.08. bis zum 15.09.2026 gefehlt hat.

In dieser Zeit ging KEINE einzige Push-Benachrichtigung hinaus: die Nachricht
adressierte das Geraet ueber `Message.fid` statt `Message.token`. Der Docstring
von firebase-admin laedt dazu ein („token: Deprecated. Use ``fid`` instead."),
aber die beiden sind nicht dasselbe — der Encoder serialisiert sie als zwei
verschiedene JSON-Felder und laesst nur EINES als Ziel zu. `fid` erwartet eine
Firebase-INSTALLATION-ID, unsere Apps melden ein Registrierungs-Token.

Warum es niemandem auffiel: FCM quittiert das mit INVALID_ARGUMENT, und dieser
Fall wird bewusst nicht als Token-Fehler gewertet (er ist meist ein Fehler in
UNSERER Nutzlast). Uebrig blieb eine Log-Zeile — kein Test, kein Verlaufs-
eintrag, keine Glocke. Gemeldet hat es der Nutzer, nicht das System.

Diese Tests pruefen deshalb die GEBAUTE Nutzlast, nicht den Versand: sie
brauchen kein Dienstkonto und kein Netz und laufen damit ueberall mit.
"""
from __future__ import annotations

from firebase_admin import _messaging_encoder  # type: ignore[attr-defined]

from src.features.notification_settings.push import _nachricht


def _kodiert(token: str = "ein-beispielwert") -> dict:  # noqa: S107 — kein Geheimnis, ein Testwert
    """Die Nachricht so, wie sie an FCM ginge."""
    return _messaging_encoder.MessageEncoder().default(
        _nachricht(token, "Titel", "Text", "/aufgaben/42")
    )


def test_geraet_wird_ueber_token_adressiert() -> None:
    """Das Registrierungs-Token steht im Feld `token`."""
    nutzlast = _kodiert("abc123")
    assert nutzlast.get("token") == "abc123"


def test_fid_bleibt_leer() -> None:
    """`fid` darf NICHT gesetzt sein — es ist ein anderer Identifier.

    Der eigentliche Regressionsschutz: wer `token=` wieder auf `fid=` dreht
    (etwa wegen der DeprecationWarning), faellt hier auf, statt monatelang
    still ins Leere zu senden.
    """
    assert "fid" not in _kodiert()


def test_genau_ein_ziel() -> None:
    """FCM erlaubt genau EINEN Ziel-Typ je Nachricht.

    `fid`, `token`, `topic` und `condition` schliessen einander aus; zwei
    davon gleichzeitig lehnt der Encoder ab.
    """
    nutzlast = _kodiert()
    ziele = [f for f in ("fid", "token", "topic", "condition") if f in nutzlast]
    assert ziele == ["token"]


def test_sprungziel_reist_als_datenfeld_mit() -> None:
    """Ohne `data.ziel` oeffnet der Tap die Startseite statt der Aufgabe."""
    assert _kodiert()["data"] == {"ziel": "/aufgaben/42"}
