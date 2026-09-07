"""Gemeinsame Bausteine des booking_offers-Slices: Fehler, Zustände, Token.

Die Zustandsliste MUSS mit dem CHECK-Constraint aus Migration 0586
(`booking_offers_status_check`) deckungsgleich sein. Nimmt die API einen Wert
an, den die DB ablehnt, endet das in einem rohen 500 statt einer 422 — dieselbe
Lehre wie beim `stripe`-Literal im Payments-Schema.
"""
from __future__ import annotations

import hashlib
import secrets
from typing import Literal

OfferStatus = Literal[
    "draft", "sent", "viewed", "accepted", "paid", "declined", "expired", "cancelled"
]
OFFER_STATUSES: tuple[str, ...] = (
    "draft",
    "sent",
    "viewed",
    "accepted",
    "paid",
    "declined",
    "expired",
    "cancelled",
)

# Zustände, in denen der Gast noch zusagen kann. Alles andere ist entschieden.
# Als Menge und nicht als Bedingung an jeder Prüfstelle: sonst hätte die
# Annahme irgendwann eine andere Vorstellung davon als die Anzeige.
ANNEHMBAR: frozenset[str] = frozenset({"sent", "viewed"})

# Zustände, die der Ablaufjob noch beenden darf. `draft` gehört dazu: ein
# Angebot, das nie verschickt wurde, soll nicht ewig in der Liste stehen.
ABLAUFBAR: frozenset[str] = frozenset({"draft", "sent", "viewed"})

# Endzustände — ab hier ändert sich nichts mehr von selbst.
ENDZUSTAENDE: frozenset[str] = frozenset(
    {"paid", "declined", "expired", "cancelled"}
)

# Grund, warum nicht angenommen werden kann. Als Schlüssel, den die
# Annahmeseite in der Gastsprache ausgibt — nie ein fertiger deutscher Satz aus
# dem Backend (das Produkt läuft in 27 Ländern).
GRUND_ABGELAUFEN = "expired"
GRUND_ZURUECKGEZOGEN = "cancelled"
GRUND_ABGELEHNT = "declined"
GRUND_BEZAHLT = "paid"
GRUND_IN_ZAHLUNG = "in_payment"
GRUND_NICHT_VERSCHICKT = "not_sent"


class BookingOfferError(RuntimeError):
    """Fachlicher Fehler des Slices, mit HTTP-Status.

    Eigene Klasse statt `HTTPException` im Service: der Service wird auch aus
    dem Stripe-Webhook aufgerufen, wo eine FastAPI-Exception nichts zu suchen
    hat. Der Router setzt sie in HTTP um.
    """

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# Länge des Zugangstokens in Bytes. 32 Byte = 256 Bit, als URL-sicherer Text
# rund 43 Zeichen. Der Token ist der GANZE Zugang zur Annahmeseite (keine
# Anmeldung), also wird er nicht kürzer: ein erratbarer Token wäre eine fremde
# Buchung auf Kosten des Gastes.
TOKEN_BYTES = 32


def neuer_token() -> tuple[str, str]:
    """Ein Zugangstoken erzeugen: (Klartext für die Mail, Hash für die DB).

    Der Klartext verlässt diese Funktion genau einmal — er steht im Mail-Link
    und wird NICHT gespeichert (Wurzel 3). Wer die Tabelle liest, kann daraus
    kein Angebot annehmen.
    """
    klartext = secrets.token_urlsafe(TOKEN_BYTES)
    return klartext, token_hash(klartext)


def token_hash(klartext: str) -> str:
    """SHA-256 des Tokens als Hex — die Form, in der die DB ihn kennt.

    Ohne Salt und ohne Passwort-KDF, und das ist hier richtig: der Token ist
    ein 256-Bit-Zufallswert, kein vom Menschen gewähltes Geheimnis. Gegen
    Wörterbuch- oder Regenbogen-Angriffe gibt es nichts zu härten, und ein
    langsames Hashing würde nur den Aufruf der Annahmeseite verzögern.
    """
    return hashlib.sha256(klartext.encode("utf-8")).hexdigest()
