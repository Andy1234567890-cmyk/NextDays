"""Der verschluesselte Umschlag (`core/umschlag.py`).

Hier wird das VERFAHREN geprueft, nicht der Weg durch die Stelle (das tut
`test_umschlag_weg.py`). Jeder Test baut genau einen Fehler ein.

Diese Datei ist die Absicherung einer Zusage, die wir der Behoerde
gegenueber machen: „verschluesselt und wieder lesbar". Was hier gruen ist,
ist belegt — nicht behauptet.
"""
from __future__ import annotations

import base64
import json

import pytest

from src.core import umschlag

MELDUNG = (
    b"ROW_TYPE;MSG_MESSAGE_REF_ID\n"
    b"Message;DK2025DK39128454_DEMO\n"
    # Ein echt aussehender Personenbezug: Er darf im Umschlag NICHT
    # auffindbar sein, sonst ist die Verschluesselung wertlos.
    b"RS_IND_Individual_Seller;120385-4127 Lars Bak Nielsen\n"
)


@pytest.fixture(scope="module")
def paar() -> umschlag.Schluesselpaar:
    """Ein Schluesselpaar je Modul — RSA-4096 erzeugen ist teuer."""
    return umschlag.schluesselpaar_erzeugen()


def test_klartext_kommt_unveraendert_zurueck(
    paar: umschlag.Schluesselpaar,
) -> None:
    brief = umschlag.verschliessen(MELDUNG, paar.oeffentlich, dateiname="m.csv")
    auf = umschlag.oeffnen(brief, paar.privat)
    assert auf.klartext == MELDUNG
    assert auf.pruefsumme_stimmt


def test_kein_personenbezug_im_umschlag(paar: umschlag.Schluesselpaar) -> None:
    """Der eigentliche Zweck: Die CPR-Nummer ist nicht mehr lesbar."""
    brief = umschlag.verschliessen(MELDUNG, paar.oeffentlich, dateiname="m.csv")
    for verraeter in (b"120385-4127", b"Lars", b"Nielsen"):
        assert verraeter not in brief, f"im Klartext sichtbar: {verraeter!r}"


def test_kopf_bleibt_lesbar(paar: umschlag.Schluesselpaar) -> None:
    """Der Kopf MUSS lesbar sein — sonst weiss niemand, womit zu oeffnen ist.

    Er darf aber nur das Verfahren nennen, nie einen Feldwert.
    """
    brief = umschlag.verschliessen(
        MELDUNG, paar.oeffentlich, dateiname="m.csv", meldung_ref="REF1"
    )
    kopf = json.loads(brief)["umschlag"]
    assert kopf["format"] == umschlag.FORMAT
    assert "AES-256-GCM" in kopf["verfahren"]
    assert kopf["klartext_bytes"] == len(MELDUNG)
    assert kopf["schluessel_kennung"] == umschlag.schluesselkennung(
        paar.oeffentlich
    )


def test_fremder_schluessel_oeffnet_nicht(
    paar: umschlag.Schluesselpaar,
) -> None:
    fremd = umschlag.schluesselpaar_erzeugen()
    brief = umschlag.verschliessen(MELDUNG, paar.oeffentlich, dateiname="m.csv")
    with pytest.raises(umschlag.UmschlagError, match="anderen Empfaenger"):
        umschlag.oeffnen(brief, fremd.privat)


def test_verfaelschter_inhalt_faellt_auf(
    paar: umschlag.Schluesselpaar,
) -> None:
    """AES-GCM erkennt ein gekipptes Bit — CBC waere hier still geblieben."""
    brief = json.loads(
        umschlag.verschliessen(MELDUNG, paar.oeffentlich, dateiname="m.csv")
    )
    roh = bytearray(base64.b64decode(brief["inhalt"]))
    roh[5] ^= 0x01
    brief["inhalt"] = base64.b64encode(bytes(roh)).decode()
    with pytest.raises(umschlag.UmschlagError, match="veraendert"):
        umschlag.oeffnen(json.dumps(brief).encode(), paar.privat)


def test_manipulierter_kopf_faellt_auf(paar: umschlag.Schluesselpaar) -> None:
    """Der Kopf geht als authentifizierte Daten mit.

    Ohne das waere er frei aenderbar, obwohl die Nutzdaten geschuetzt
    sind — jemand koennte den Dateinamen oder die Meldungskennung
    austauschen, und der Inhalt ginge unveraendert durch.
    """
    brief = json.loads(
        umschlag.verschliessen(MELDUNG, paar.oeffentlich, dateiname="m.csv")
    )
    brief["umschlag"]["dateiname"] = "harmlos.txt"
    with pytest.raises(umschlag.UmschlagError):
        umschlag.oeffnen(json.dumps(brief).encode(), paar.privat)


def test_zweimal_verschliessen_ergibt_anderen_geheimtext(
    paar: umschlag.Schluesselpaar,
) -> None:
    """Frischer Nonce je Umschlag.

    Wichtig fuer mehr als die Kryptographie: Deshalb greift die
    Dublettensperre der Empfangsstelle am KLARTEXT und nicht an den
    empfangenen Bytes.
    """
    a = json.loads(umschlag.verschliessen(MELDUNG, paar.oeffentlich, dateiname="m"))
    b = json.loads(umschlag.verschliessen(MELDUNG, paar.oeffentlich, dateiname="m"))
    assert a["inhalt"] != b["inhalt"]
    assert a["nonce"] != b["nonce"]


def test_leere_datei_wird_abgewiesen(paar: umschlag.Schluesselpaar) -> None:
    with pytest.raises(umschlag.UmschlagError, match="nichts zu verschluesseln"):
        umschlag.verschliessen(b"", paar.oeffentlich, dateiname="leer.csv")


def test_zu_kurzer_schluessel_wird_abgewiesen() -> None:
    """Ein 2048-Bit-Schluessel genuegt fuer Steuerdaten nicht.

    Fail-closed: Lieber keine Verschluesselung als eine, die schwaecher
    ist als zugesagt.
    """
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    schwach = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = (
        schwach.public_key()
        .public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    with pytest.raises(umschlag.UmschlagError, match="2048 Bit"):
        umschlag.verschliessen(MELDUNG, pem, dateiname="m.csv")


def test_unlesbarer_schluessel_wird_benannt() -> None:
    with pytest.raises(umschlag.UmschlagError, match="unlesbar"):
        umschlag.verschliessen(MELDUNG, "kein PEM", dateiname="m.csv")


def test_kein_json_wird_benannt(paar: umschlag.Schluesselpaar) -> None:
    with pytest.raises(umschlag.UmschlagError, match="kein lesbares JSON"):
        umschlag.oeffnen(b"ROW_TYPE;MSG_MESSAGE_REF_ID", paar.privat)


def test_fremdes_format_wird_abgewiesen(paar: umschlag.Schluesselpaar) -> None:
    """Eine kuenftige Fassung soll auffallen, nicht still anders gelesen werden."""
    brief = json.loads(
        umschlag.verschliessen(MELDUNG, paar.oeffentlich, dateiname="m.csv")
    )
    brief["umschlag"]["format"] = "irgendwas/9"
    with pytest.raises(umschlag.UmschlagError, match="unbekanntes Umschlagformat"):
        umschlag.oeffnen(json.dumps(brief).encode(), paar.privat)


def test_schluesselwechsel_wird_erkannt(paar: umschlag.Schluesselpaar) -> None:
    """Der Zwischenspeicher der Schluessel darf nichts vortaeuschen.

    `_privkey_laden` ist `lru_cache`-gepuffert (396 ms je PEM-Parse,
    gemessen). Der Cache-Schluessel ist der PEM-TEXT — ein gewechselter
    Schluessel hat anderen Text und wird neu geladen. Waere er es nicht,
    oeffnete der alte Schluessel weiterhin und der Wechsel waere
    unwirksam.
    """
    zweit = umschlag.schluesselpaar_erzeugen()
    brief = umschlag.verschliessen(MELDUNG, zweit.oeffentlich, dateiname="m.csv")
    assert umschlag.oeffnen(brief, zweit.privat).klartext == MELDUNG
    with pytest.raises(umschlag.UmschlagError):
        umschlag.oeffnen(brief, paar.privat)
