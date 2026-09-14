"""Der oeffentliche Schluessel der Empfangsstelle.

WOZU EIN ENDPUNKT UND NICHT EINE DATEI IM REPO
===============================================
Ein Absender muss wissen, mit welchem Schluessel er verschluesseln soll.
Den Schluessel von Hand zu kopieren ist der Weg, auf dem er veraltet: Bei
einem Schluesselwechsel verschluesselt der Absender weiter gegen den
alten, und die Stelle meldet „fuer einen anderen Empfaenger
verschluesselt" — ein Fehler, der wie ein Defekt aussieht und keiner ist.

Hier holt er ihn bei der Stelle selbst. Damit gibt es genau eine Quelle.

WARUM OHNE ANMELDUNG
====================
Ein oeffentlicher Schluessel ist oeffentlich; das ist seine Aufgabe. Wer
ihn hat, kann VERSCHLUESSELN, nicht entschluesseln. Ihn hinter das
gemeinsame Geheimnis zu legen wuerde nichts schuetzen und die Einrichtung
eines neuen Absenders unnoetig erschweren.

Der PRIVATE Schluessel verlaesst diesen Dienst nie — er steht in der
Umgebung (`EMPFAENGER_PRIVKEY`, in Coolify als Secret) und wird nirgends
ausgegeben, auch nicht gekuerzt.
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..core import umschlag
from ..core.config import get_settings

router = APIRouter(tags=["Schluessel"])


class SchluesselAusgabe(BaseModel):
    """Womit diese Stelle Umschlaege annimmt."""

    # False heisst: Die Stelle nimmt nur Klartext. Sie sagt das lieber
    # ausdruecklich, als einen Umschlag anzunehmen und daran zu scheitern.
    nimmt_verschluesselt_entgegen: bool
    verfahren: str = Field(
        default="RSA-4096-OAEP-SHA256 + AES-256-GCM",
        description="Das Hybridverfahren des Umschlags",
    )
    umschlag_format: str = umschlag.FORMAT
    # Kurzer Fingerabdruck. Er steht auch in jedem Umschlagkopf; stimmen
    # beide nicht ueberein, wurde gegen einen anderen Schluessel
    # verschluesselt — das ist dann der Grund, nicht ein kaputter Umschlag.
    schluessel_kennung: str | None = None
    oeffentlicher_schluessel: str | None = None


@router.get(
    "/schluessel",
    response_model=SchluesselAusgabe,
    summary="Der oeffentliche Schluessel fuer verschluesselte Einreichungen",
)
def schluessel() -> SchluesselAusgabe:
    """Den oeffentlichen Schluessel dieser Empfangsstelle ausgeben."""
    einstellungen = get_settings()
    pem = einstellungen.empfaenger_pubkey.strip()
    if not pem:
        return SchluesselAusgabe(
            nimmt_verschluesselt_entgegen=False,
        )
    return SchluesselAusgabe(
        nimmt_verschluesselt_entgegen=(
            einstellungen.nimmt_verschluesselt_entgegen()
        ),
        schluessel_kennung=umschlag.schluesselkennung(pem),
        oeffentlicher_schluessel=pem,
    )
