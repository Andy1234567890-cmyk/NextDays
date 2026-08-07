"""Auslöser einer Nachrichten-Automatisierung — die EINE Wahrheit.

Ein Auslöser sagt ZWEI Dinge zugleich: an welchem Datum die Regel hängt (Anker)
und auf welcher Seite davon sie feuert (Richtung). Bis 0307 standen beide
zusätzlich als frei wählbare Felder in der Maske, ohne Kopplung an den Auslöser.
Live vorgefunden: eine Regel mit `trigger='before_checkin'` und
`anchor='departure'` — sie hieß „Vor Anreise" und feuerte vor der ABREISE.

Seither wird beides HIER abgeleitet. Wer einen Auslöser ergänzt, trägt ihn in
diese eine Tabelle ein; Schema, Prüfung, Planung und die DB-CHECKs (0307) lesen
daraus. Zwei Auslöser fehlten bis dahin ganz: „Nach Anreise" und „Vor Abreise".
"""

# trigger → (Anker, Vorzeichen des Versatzes). +1 = nach dem Anker, −1 = davor.
ANKER_UND_RICHTUNG: dict[str, tuple[str, int]] = {
    "booking_new": ("booking", 1),
    "before_checkin": ("arrival", -1),
    "after_checkin": ("arrival", 1),
    "before_checkout": ("departure", -1),
    "after_checkout": ("departure", 1),
}

# Auslöser, die an einem Datum der Reservierung hängen und deshalb im Voraus
# eingeplant werden. `message_received` gehört bewusst nicht dazu — er hängt am
# Eingang einer Gastnachricht (s. `schedule_message_received`).
DATUMS_TRIGGER: tuple[str, ...] = tuple(ANKER_UND_RICHTUNG)

ALLE_TRIGGER: tuple[str, ...] = (*DATUMS_TRIGGER, "message_received")


def anker_von(trigger: str) -> str:
    """Bezugsdatum des Auslösers. Für `message_received` bedeutungslos —
    normalisiert auf 'arrival', damit kein Restwert als Bedeutung durchgeht."""
    return ANKER_UND_RICHTUNG.get(trigger, ("arrival", 1))[0]


def richtung_von(trigger: str) -> int:
    """+1 = nach dem Anker, −1 = davor."""
    return ANKER_UND_RICHTUNG.get(trigger, ("arrival", 1))[1]


def versatz_normieren(trigger: str, wert: int) -> int:
    """Betrag aus der Maske auf das Vorzeichen des Auslösers bringen.

    Die Oberfläche fragt nur noch nach der ZAHL („3"), die Richtung steckt im
    Auslöser. Ein hereingereichtes Vorzeichen wird deshalb nicht geglaubt,
    sondern überschrieben — sonst hinge das Verhalten davon ab, welcher Client
    schreibt."""
    return richtung_von(trigger) * abs(int(wert))
