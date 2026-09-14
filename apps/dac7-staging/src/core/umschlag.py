"""Der verschluesselte Umschlag einer DAC7-Meldung.

SCHWESTERDATEI: apps/api/src/features/taxpayer/dac7/umschlag.py ==
apps/dac7-staging/src/core/umschlag.py == apps/dac7-API/src/core/umschlag.py
(byte-identisch ab der naechsten Zeile).

WARUM HIER EINE KOPIE RICHTIG IST — und bei den Pruefregeln nicht:
Die Pruefregeln sind eine FACHLICHE Lesung der amtlichen Vorlage, und die
muss auf beiden Seiten unabhaengig entstehen, sonst prueft unsere Datei
gegen unsere eigene Vorstellung von ihr. Ein Verschluesselungsformat ist
das Gegenteil: Es MUSS auf beiden Seiten identisch sein, sonst geht kein
Umschlag auf. Zwei unabhaengige Lesungen desselben Formats waeren hier
kein Kreuztest, sondern ein Fehler.

WOZU
====
Eine DAC7-Meldung traegt CPR-Nummern, Namen, Anschriften und
Kontokennungen von Dritten. TLS schuetzt sie auf der Leitung — aber nur
dort. Sobald die Datei liegt (im Arbeitsspeicher der Gegenstelle, in einem
Zwischenspeicher, in einem Fehlerbericht), ist sie Klartext.

Dieser Umschlag verschluesselt die NUTZDATEN. Er bleibt verschluesselt,
bis die Behoerde ihn mit ihrem privaten Schluessel oeffnet — unabhaengig
davon, wie viele Zwischenstationen die Uebertragung hat.

DAS VERFAHREN: HYBRID
=====================
    Datei  --AES-256-GCM-->  Geheimtext   (symmetrisch, schnell, beliebig gross)
    AES-Schluessel --RSA-4096-OAEP-->  verpackter Schluessel

Warum nicht RSA allein: RSA kann nur wenige hundert Byte verschluesseln,
eine Meldedatei ist megabytegross. Warum nicht AES allein: Dann muessten
beide Seiten vorher denselben geheimen Schluessel haben, und den muesste
jemand uebertragen — genau das Problem, das hier geloest werden soll.

Warum GCM und nicht CBC: GCM ist AEAD, es erkennt VERAENDERUNGEN. Ein
gekippter Geheimtext faellt beim Entschluesseln auf, statt zu plausiblem
Muell zu werden. Bei einer Steuermeldung ist eine unbemerkte Verfaelschung
schlimmer als ein Fehlschlag.

Warum OAEP und nicht PKCS#1 v1.5: Letzteres ist gegen Bleichenbacher-
Angriffe anfaellig. OAEP ist der Nachfolger und Stand der Technik.

WAS MITGESCHRIEBEN WIRD — UND WARUM ES NICHT VERSCHLUESSELT IST
===============================================================
Der Kopf (`umschlag`-Block) nennt Verfahren, Zeitpunkt, Pruefsumme des
KLARTEXTS und die Kennung des verwendeten Schluessels. Er ist bewusst
lesbar: Die Gegenstelle muss wissen, WOMIT sie oeffnen soll, bevor sie
oeffnen kann. Er enthaelt keinen Feldwert der Meldung.

Die Pruefsumme ist die des Klartexts, nicht des Geheimtexts. Damit laesst
sich nach dem Entschluesseln beweisen, dass genau die Datei ankam, die
losgeschickt wurde — eine Pruefsumme ueber den Geheimtext koennte das
nicht, weil jede Verschluesselung derselben Datei anders aussieht (neuer
Zufalls-IV).

DER SCHLUESSEL DER BEHOERDE
============================
Skattestyrelsen hat uns bisher keinen oeffentlichen Schluessel genannt.
Bis dahin gilt das hier festgelegte Verfahren mit einem Schluesselpaar der
Teststufe. Es ist austauschbar: Kommt der echte Schluessel, wird
`DAC7_BEHOERDE_PUBKEY` gesetzt, und nichts anderes aendert sich.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Kennzeichnung des Formats. Sie steht im Umschlag, damit eine spaetere
# Fassung erkennbar ist, statt still anders gelesen zu werden.
FORMAT = "nextdays-dac7-umschlag/1"

_RSA_BITS = 4096
_AES_BITS = 256
# GCM verlangt einen Nonce, der sich unter demselben Schluessel NIE
# wiederholt. 96 Bit ist die vom Standard empfohlene Laenge; der Schluessel
# ist hier ohnehin je Meldung neu, eine Wiederholung also ausgeschlossen.
_NONCE_BYTES = 12


class UmschlagError(Exception):
    """Der Umschlag liess sich nicht bilden oder nicht oeffnen."""


@dataclass(frozen=True, slots=True)
class Schluesselpaar:
    """Ein RSA-Paar in PEM-Form."""

    oeffentlich: str
    privat: str


def schluesselpaar_erzeugen() -> Schluesselpaar:
    """Ein neues RSA-4096-Paar.

    Fuer die Teststufe, solange die Behoerde keinen eigenen Schluessel
    genannt hat. Der private Teil gehoert NIE ins Repo und nie in ein Log.
    """
    privat = rsa.generate_private_key(public_exponent=65537, key_size=_RSA_BITS)
    return Schluesselpaar(
        oeffentlich=privat.public_key()
        .public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode(),
        privat=privat.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode(),
    )


def schluesselkennung(oeffentlich_pem: str) -> str:
    """Ein kurzer Fingerabdruck des oeffentlichen Schluessels.

    Er steht im Umschlag, damit die Gegenstelle erkennt, mit welchem
    Schluessel verschluesselt wurde — bei einem Schluesselwechsel ist sonst
    nicht unterscheidbar, ob der falsche Schluessel oder ein kaputter
    Geheimtext vorliegt.
    """
    roh = _pubkey_laden(oeffentlich_pem).public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return hashlib.sha256(roh).hexdigest()[:16]


# Das Einlesen eines PEM-Schluessels ist teuer — GEMESSEN am 11.09.2026:
# 396 ms je Aufruf fuer RSA-4096, gegen 6,9 ms fuer die eigentliche
# Entschluesselung. Ohne diesen Zwischenspeicher steckten also 98 % der
# Zeit im Parsen desselben Schluessels, und das Schrittprotokoll wies
# 400 ms fuer die „Entschluesselung" aus, die keine war.
#
# Der Schluessel ist ueber die Laufzeit des Prozesses konstant (er kommt
# aus der Umgebung), deshalb ist das Zwischenspeichern hier richtig und
# nicht bloss schnell. `maxsize` klein: es gibt einen Schluessel je
# Gegenstelle, nicht je Einreichung.
#
# Der PEM-TEXT ist der Schluessel des Caches, nicht ein Dateiname: Ein
# gewechselter Schluessel hat anderen Text und wird damit neu geladen,
# statt still den alten weiterzuverwenden.
@lru_cache(maxsize=8)
def _pubkey_laden(pem: str) -> rsa.RSAPublicKey:
    try:
        schluessel = serialization.load_pem_public_key(pem.encode())
    except Exception as exc:  # noqa: BLE001 — fremde Eingabe, benannt melden
        msg = f"der oeffentliche Schluessel ist unlesbar: {exc}"
        raise UmschlagError(msg) from exc
    if not isinstance(schluessel, rsa.RSAPublicKey):
        msg = "es wird ein RSA-Schluessel erwartet"
        raise UmschlagError(msg)
    if schluessel.key_size < _RSA_BITS:
        msg = (
            f"der Schluessel hat {schluessel.key_size} Bit, "
            f"verlangt sind mindestens {_RSA_BITS}"
        )
        raise UmschlagError(msg)
    return schluessel


@lru_cache(maxsize=8)
def _privkey_laden(pem: str) -> rsa.RSAPrivateKey:
    try:
        schluessel = serialization.load_pem_private_key(pem.encode(), password=None)
    except Exception as exc:  # noqa: BLE001
        msg = f"der private Schluessel ist unlesbar: {exc}"
        raise UmschlagError(msg) from exc
    if not isinstance(schluessel, rsa.RSAPrivateKey):
        msg = "es wird ein RSA-Schluessel erwartet"
        raise UmschlagError(msg)
    return schluessel


_OAEP = padding.OAEP(
    mgf=padding.MGF1(algorithm=hashes.SHA256()),
    algorithm=hashes.SHA256(),
    label=None,
)


def verschliessen(
    klartext: bytes,
    empfaenger_pubkey_pem: str,
    *,
    dateiname: str,
    meldung_ref: str | None = None,
) -> bytes:
    """Eine Meldedatei in einen verschluesselten Umschlag legen.

    Gibt JSON zurueck, nicht Rohbytes: Der Umschlag muss seinen eigenen
    Kopf tragen (Verfahren, Schluesselkennung, Nonce), und ein selbst
    erfundenes Binaerformat waere ohne Not schwerer zu pruefen. Die
    Nutzdaten sind base64 — das kostet ein Drittel mehr Bytes und spart
    eine ganze Klasse von Kodierungsfehlern.
    """
    if not klartext:
        msg = "es gibt nichts zu verschluesseln"
        raise UmschlagError(msg)

    pubkey = _pubkey_laden(empfaenger_pubkey_pem)
    sitzungsschluessel = AESGCM.generate_key(bit_length=_AES_BITS)
    nonce = os.urandom(_NONCE_BYTES)

    # Der Kopf geht als zusaetzliche authentifizierte Daten mit: Wer ihn
    # nachtraeglich aendert (etwa den Dateinamen), macht den Geheimtext
    # unlesbar. Ohne das waere der Kopf frei manipulierbar, obwohl die
    # Nutzdaten geschuetzt sind.
    kopf = {
        "format": FORMAT,
        "verfahren": "RSA-4096-OAEP-SHA256 + AES-256-GCM",
        "erstellt_am": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dateiname": dateiname,
        "meldung_ref": meldung_ref,
        "klartext_bytes": len(klartext),
        "klartext_sha256": hashlib.sha256(klartext).hexdigest(),
        "schluessel_kennung": schluesselkennung(empfaenger_pubkey_pem),
    }
    kopf_roh = json.dumps(kopf, sort_keys=True, separators=(",", ":")).encode()

    geheim = AESGCM(sitzungsschluessel).encrypt(nonce, klartext, kopf_roh)
    verpackt = pubkey.encrypt(sitzungsschluessel, _OAEP)

    return json.dumps(
        {
            "umschlag": kopf,
            "schluessel": base64.b64encode(verpackt).decode(),
            "nonce": base64.b64encode(nonce).decode(),
            "inhalt": base64.b64encode(geheim).decode(),
        },
        ensure_ascii=False,
        indent=1,
    ).encode()


@dataclass(frozen=True, slots=True)
class Geoeffnet:
    """Was aus einem geoeffneten Umschlag kam."""

    klartext: bytes
    kopf: dict
    # Ob die Pruefsumme im Kopf zum entschluesselten Inhalt passt. Sie
    # MUSS passen — GCM haette eine Veraenderung schon abgewiesen. Der
    # Vergleich ist der Guertel zum Hosenträger und macht die Aussage
    # „unveraendert angekommen" belegbar statt geglaubt.
    pruefsumme_stimmt: bool


def oeffnen(umschlag_roh: bytes, privkey_pem: str) -> Geoeffnet:
    """Einen Umschlag mit dem privaten Schluessel oeffnen."""
    try:
        daten = json.loads(umschlag_roh.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        msg = f"der Umschlag ist kein lesbares JSON: {exc}"
        raise UmschlagError(msg) from exc

    kopf = daten.get("umschlag")
    if not isinstance(kopf, dict):
        msg = "dem Umschlag fehlt der Kopf"
        raise UmschlagError(msg)
    if kopf.get("format") != FORMAT:
        msg = f"unbekanntes Umschlagformat: {kopf.get('format')!r}"
        raise UmschlagError(msg)

    try:
        verpackt = base64.b64decode(daten["schluessel"], validate=True)
        nonce = base64.b64decode(daten["nonce"], validate=True)
        geheim = base64.b64decode(daten["inhalt"], validate=True)
    except Exception as exc:  # noqa: BLE001
        msg = f"der Umschlag ist unvollstaendig oder falsch kodiert: {exc}"
        raise UmschlagError(msg) from exc

    privkey = _privkey_laden(privkey_pem)
    try:
        sitzungsschluessel = privkey.decrypt(verpackt, _OAEP)
    except Exception as exc:  # noqa: BLE001
        msg = (
            "der Sitzungsschluessel liess sich nicht entpacken — der "
            "Umschlag wurde fuer einen anderen Empfaenger verschluesselt"
        )
        raise UmschlagError(msg) from exc

    kopf_roh = json.dumps(kopf, sort_keys=True, separators=(",", ":")).encode()
    try:
        klartext = AESGCM(sitzungsschluessel).decrypt(nonce, geheim, kopf_roh)
    except Exception as exc:  # noqa: BLE001
        msg = (
            "der Inhalt liess sich nicht entschluesseln — Umschlag oder "
            "Kopf wurden nach dem Verschliessen veraendert"
        )
        raise UmschlagError(msg) from exc

    return Geoeffnet(
        klartext=klartext,
        kopf=kopf,
        pruefsumme_stimmt=(
            hashlib.sha256(klartext).hexdigest() == kopf.get("klartext_sha256")
        ),
    )
