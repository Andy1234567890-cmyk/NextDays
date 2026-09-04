"""Der Haltungs-Katalog — zehn Fragen, die den Stil des Betriebs festhalten.

Was er löst: Ein Modell, das eine öffentliche Bewertung beantworten soll, kann
alles formulieren, aber nicht wissen, WIE dieser Betrieb redet. Ob er duzt. Ob
er sich für eine schlechte Bewertung entschuldigt oder widerspricht. Ob er
einen Gast, der die Hausordnung gebrochen hat, öffentlich beim Namen nennt.
Ohne diese Auskunft schreibt es das statistische Mittel aller Gastgeber im
Internet — höflich, austauschbar und erkennbar nicht vom Betrieb.

**Warum ein fester Katalog und kein Freitextfeld.** Ein leeres Feld
„Beschreibe deinen Stil" bleibt leer oder bekommt einen Satz. Zehn konkrete
Fragen bekommen zehn konkrete Antworten. Der zweite Grund wiegt schwerer: mit
Schlüsseln ist im Protokoll ablesbar, WELCHE Haltung eine schiefe Antwort
getragen hat (``verwendete_fragen``). Ein Freitext wäre nicht
diagnostizierbar — man rät zwischen „das Modell hat es erfunden" und „so steht
es da".

**Warum die Fragen hier stehen und nicht in der Datenbank.** Sie sind
Produkttext: übersetzbar, verbesserbar, für alle Betriebe gleich. In der
Datenbank steht nur, was der Betrieb geantwortet hat, adressiert über
:data:`frage_schluessel`. Eine bessere Formulierung der Frage ist damit eine
Code-Änderung und keine Migration — und die Antworten überleben sie.

**Die Auswahl je Note ist der Kern.** In den Prompt gehen nicht alle zehn
Antworten, sondern die, die zu DIESER Bewertung passen: bei fünf Sternen die
Haltung zu Lob, bei einem Stern die zu Kritik. Beides zugleich würde dem
Modell widersprechende Anweisungen geben („kurz und dankbar" neben
„ausführlich Stellung nehmen"), und es wählt dann selbst — womit der Katalog
wieder wirkungslos wäre.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Ab dieser Note gilt eine Bewertung als Lob, darunter als Kritik. Vier ist die
# Grenze, weil die Portale sie so ziehen: Booking.com und Airbnb führen 4+ als
# positiv, und ein Gast, der vier von fünf Sternen gibt, meint kein Problem.
NOTE_LOB = 4

# Wie viele Zeichen eine Antwort des Betriebs haben darf. Deckungsgleich mit
# dem CHECK in 0549 — hier als Konstante, damit die Grenze im 422 des Servers
# steht und nicht als 500 aus der Datenbank kommt (Wurzel 5).
MAX_ANTWORT_ZEICHEN = 1500


@dataclass(frozen=True)
class Frage:
    """Eine Katalogfrage.

    ``noten`` sagt, bei welchen Sternestufen die Antwort in den Prompt geht.
    Leer heisst: immer — das sind die Fragen zur Grundhaltung (Anrede,
    Unterschrift, Länge), die unabhängig von der Note gelten.
    """

    schluessel: str
    frage: str
    # Was der Betrieb hier hinschreiben soll. Steht in der Oberfläche unter
    # dem Feld; ein Beispiel beantwortet die Frage „was wollt ihr von mir?"
    # besser als jede Erklärung.
    beispiel: str
    noten: frozenset[int] = field(default_factory=frozenset)
    # Für welche Richtung die Frage zählt. Beide Richtungen teilen sich den
    # Katalog — es ist derselbe Betrieb, der redet —, aber nicht jede Frage
    # passt auf beide: „Wie geht ihr mit einer 1-Stern-Bewertung um?" hat beim
    # Bewerten des Gastes keinen Adressaten.
    richtungen: frozenset[str] = frozenset({"gast_bewerten", "antwort"})


# Die zehn Fragen. Reihenfolge = Reihenfolge in der Oberfläche: erst die
# Grundhaltung, dann die Notenstufen von gut nach schlecht, dann die Grenzen.
KATALOG: tuple[Frage, ...] = (
    Frage(
        schluessel="anrede",
        frage="Wie sprecht ihr Gäste an — per Du oder per Sie, mit Vornamen?",
        beispiel=(
            "Wir siezen und sprechen den Gast mit Vor- und Nachnamen an. "
            "Bei Gästen unter 30 duzen wir, wenn sie uns geduzt haben."
        ),
    ),
    Frage(
        schluessel="laenge_ton",
        frage="Wie lang und in welchem Ton soll ein Text sein?",
        beispiel=(
            "Zwei bis drei Sätze, herzlich, ohne Werbefloskeln. "
            "Keine Ausrufezeichen-Ketten, kein 'Wir freuen uns riesig'."
        ),
    ),
    Frage(
        schluessel="unterschrift_rolle",
        frage="Wer unterschreibt — eine Person, das Team, der Betrieb?",
        beispiel="Immer 'Familie Jensen, Feriehus Kornblomst' — nie nur 'Das Team'.",
    ),
    Frage(
        schluessel="lob_5_sterne",
        frage="Wie antwortet ihr auf eine 5-Sterne-Bewertung?",
        beispiel=(
            "Kurz danken, EIN konkretes Detail aus der Bewertung aufgreifen, "
            "zur Wiederkehr einladen. Nie denselben Satz wie beim letzten Gast."
        ),
        noten=frozenset({5}),
    ),
    Frage(
        schluessel="lob_4_sterne",
        frage="Wie antwortet ihr auf 4 Sterne — also gut, aber nicht perfekt?",
        beispiel=(
            "Danken und den genannten Kritikpunkt AUSDRÜCKLICH aufgreifen: "
            "was wir daran ändern oder warum es so ist. Nicht überhören."
        ),
        noten=frozenset({4}),
    ),
    Frage(
        schluessel="mittel_3_sterne",
        frage="Wie antwortet ihr auf 3 Sterne?",
        beispiel=(
            "Sachlich, ohne Rechtfertigung. Punkt für Punkt: was wir ändern, "
            "was wir nicht ändern können und warum. Um ein Gespräch bitten."
        ),
        noten=frozenset({3}),
    ),
    Frage(
        schluessel="kritik_1_2_sterne",
        frage="Wie geht ihr mit einer 1- oder 2-Sterne-Bewertung um?",
        beispiel=(
            "Ruhig bleiben, nie zurückschiessen. Bedauern aussprechen, den "
            "Sachverhalt aus unserer Sicht in einem Satz, Kontakt anbieten. "
            "Künftige Leser sind das eigentliche Publikum, nicht der Gast."
        ),
        noten=frozenset({1, 2}),
    ),
    Frage(
        schluessel="unwahre_kritik",
        frage="Was tut ihr, wenn eine Bewertung sachlich falsch ist?",
        beispiel=(
            "Sachlich richtigstellen, mit Datum und Beleg, ohne dem Gast "
            "Absicht zu unterstellen. Keine Diskussion in der Öffentlichkeit."
        ),
        noten=frozenset({1, 2, 3}),
        richtungen=frozenset({"antwort"}),
    ),
    Frage(
        schluessel="gast_bewerten_haltung",
        frage="Wie bewertet ihr Gäste — was muss ein Gast tun für 5 Sterne?",
        beispiel=(
            "5 Sterne, wenn sauber übergeben und angemeldet wie gebucht. "
            "Weniger nur bei echtem Schaden, nie wegen Kleinigkeiten."
        ),
        richtungen=frozenset({"gast_bewerten"}),
    ),
    Frage(
        schluessel="niemals",
        frage="Was darf in einem öffentlichen Text NIE stehen?",
        beispiel=(
            "Keine Namen anderer Gäste, keine Beträge, keine Zusage auf "
            "Erstattung oder Rabatt, keine Angaben zur Wohnungstechnik, "
            "keine Schuldzuweisung an Reinigung oder Nachbarn."
        ),
    ),
)

# Zugriff nach Schlüssel — der Server prüft damit, ob ein eingehender
# Schlüssel überhaupt existiert. Ein unbekannter wird abgewiesen (422) statt
# gespeichert: eine Antwort auf eine Frage, die es nicht gibt, landet in
# keinem Prompt und wäre stiller Datenverlust.
NACH_SCHLUESSEL: dict[str, Frage] = {f.schluessel: f for f in KATALOG}


def fragen_fuer(richtung: str, note: int | None) -> list[Frage]:
    """Die Fragen, die für diese Richtung und diese Note gelten.

    Ohne Note (``None``) kommen alle Fragen der Richtung — das ist der Fall im
    Formular, wo der Betrieb den ganzen Katalog ausfüllt. MIT Note wird
    ausgewählt: nur die Grundhaltung plus die Stufe, um die es geht.

    Warum die Auswahl und nicht alles: bei fünf Sternen die Anweisung „ruhig
    bleiben, nie zurückschiessen" mitzuschicken, gibt dem Modell einen
    Konflikt, den es selbst auflöst — und dann ist der Katalog wirkungslos.
    """
    passend = [f for f in KATALOG if richtung in f.richtungen]
    if note is None:
        return passend
    return [f for f in passend if not f.noten or note in f.noten]


def ist_lob(note: int | None) -> bool:
    """Gilt diese Note als Lob? Ohne Note: nein — nicht raten (Wurzel 4)."""
    return note is not None and note >= NOTE_LOB
