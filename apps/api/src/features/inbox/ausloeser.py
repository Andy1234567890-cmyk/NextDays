"""Auslöser einer Nachrichten-Automatisierung — die EINE Wahrheit.

Ein Auslöser sagt ZWEI Dinge zugleich: an welchem Datum die Regel hängt (Anker)
und auf welcher Seite davon sie feuert (Richtung). Bis 0307 standen beide
zusätzlich als frei wählbare Felder in der Maske, ohne Kopplung an den Auslöser.
Live vorgefunden: eine Regel mit `trigger='before_checkin'` und
`anchor='departure'` — sie hieß „Vor Anreise" und feuerte vor der ABREISE.

Seither wird beides HIER abgeleitet. Wer einen Auslöser ergänzt, trägt ihn in
diese eine Tabelle ein; Schema, Prüfung, Planung und die DB-CHECKs (0307) lesen
daraus. Zwei Auslöser fehlten bis dahin ganz: „Nach Anreise" und „Vor Abreise".

Seit 0515 gibt es eine dritte Richtung: 0 = AM Ankertag (`on_checkin`,
`on_checkout`). Sie ist kein Sonderfall von −1, sondern eine eigene Aussage —
„vor der Anreise" ist ein Abstand zu einem Datum, „am Anreisetag" IST das
Datum. Ein Feld, das mal das eine und mal das andere bedeutet, je nachdem ob
eine Null darin steht, ist keine Modellierung, sondern eine Falle.
"""

# trigger → (Anker, Vorzeichen des Versatzes).
# +1 = nach dem Anker, −1 = davor, 0 = AM Anker selbst (kein Abstand).
ANKER_UND_RICHTUNG: dict[str, tuple[str, int]] = {
    "booking_new": ("booking", 1),
    "before_checkin": ("arrival", -1),
    "on_checkin": ("arrival", 0),
    "after_checkin": ("arrival", 1),
    "before_checkout": ("departure", -1),
    "on_checkout": ("departure", 0),
    "after_checkout": ("departure", 1),
}

#: Auslöser, die AM Ankertag feuern statt in einem Abstand dazu (0515).
#:
#: Sie tragen Richtung 0, und das ist mehr als eine Zahl: `versatz_normieren`
#: zwingt damit jeden hereingereichten Betrag auf null. Ein Client, der
#: versehentlich „3" mitschickt, kann den Tag nicht verschieben — der Versatz
#: ist hier keine Eingabe, sondern eine Eigenschaft des Auslösers.
#:
#: Bis 0515 wurde dieser Fall als `before_checkin` mit Versatz 0 abgelegt. Ein
#: Abstand von null ist kein Abstand: die Zeile behauptete „vor der Anreise"
#: und meinte „an der Anreise". Beide Bestandsregeln trugen ihre wahre
#: Bedeutung deshalb im Namen („Anreisetag") — die Bedeutung musste am Modell
#: vorbei transportiert werden.
TAGES_TRIGGER: frozenset[str] = frozenset({"on_checkin", "on_checkout"})

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
    """+1 = nach dem Anker, −1 = davor, 0 = am Anker selbst.

    ACHTUNG bei der Anzeige: `richtung < 0` als „vor" und sonst „nach" zu
    lesen, wirft die 0 in den Nach-Zweig — dann stünde „0 Tage nach Anreise"
    statt „Am Anreisetag". Wer hier verzweigt, prüft `TAGES_TRIGGER` zuerst.
    """
    return ANKER_UND_RICHTUNG.get(trigger, ("arrival", 1))[1]


def versatz_normieren(trigger: str, wert: int) -> int:
    """Betrag aus der Maske auf das Vorzeichen des Auslösers bringen.

    Die Oberfläche fragt nur noch nach der ZAHL („3"), die Richtung steckt im
    Auslöser. Ein hereingereichtes Vorzeichen wird deshalb nicht geglaubt,
    sondern überschrieben — sonst hinge das Verhalten davon ab, welcher Client
    schreibt.

    Bei den Tages-Auslösern (Richtung 0) fällt jeder Betrag auf null — genau
    das ist gewollt: „am Anreisetag, aber 3 Tage später" ist kein gültiger
    Gedanke, und ein durchgereichter Rest verschöbe den Versand still.
    """
    return richtung_von(trigger) * abs(int(wert))
