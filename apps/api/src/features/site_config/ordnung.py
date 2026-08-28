"""Die REIHENFOLGE einer Seite ausrechnen — ohne Datenbank (0479).

Seit 0472 ist eine Seite ein Baum (`section > column > widget`), der Editor
schickt aber eine FLACHE Liste in der Reihenfolge, in der die Bausteine
untereinander stehen sollen. Aus dieser Liste die Positionen im Baum zu machen,
ist reine Rechnerei — und genau deshalb steht sie hier und nicht mitten im
Schreibpfad: sie ist die Stelle, an der man sich verrechnet, und sie ist ohne
Datenbank prüfbar.

**Was vorher fehlte.** Die Reihenfolge stand AUSSCHLIESSLICH am Abschnitt; jedes
Widget war Position 0 in seiner Spalte. Solange in jeder Spalte genau ein
Baustein stand, ging das gut. Seit ein Baustein in eine bestehende Spalte
gelegt werden kann (0479), stehen dort zwei — und beide trugen die 0. Ihre
Reihenfolge entschied dann die Datenbank, also der Zufall: nach einem Neuladen
konnte der Knopf über dem Text stehen und nach dem nächsten darunter.

**Die zwei Ebenen, die es braucht:**

* Ein Widget bekommt seinen Rang IN SEINER SPALTE (0, 1, 2 …).
* Ein Abschnitt bekommt seinen Rang in der SEITE — und zwar nach seinem ERSTEN
  Baustein in der gesendeten Liste. Das ist die einzige Zuordnung, die zur
  Anzeige passt: der Abschnitt steht dort, wo sein erster Inhalt steht.

Abschnitte, die in der Liste gar nicht vorkommen (leer, gerade angelegt),
behalten ihre Position — sie stehen nicht in der Liste, also sagt die Liste
nichts über sie.
"""

from __future__ import annotations


def ordnung_planen(
    reihenfolge: list[tuple[str, str | None]],
    abschnitt_von_spalte: dict[str, str],
) -> tuple[dict[str, int], dict[str, int]]:
    """Aus der gesendeten Reihenfolge die zwei Positionsebenen rechnen.

    ``reihenfolge`` ist ``[(widget_id, spalte_id), …]`` in der Reihenfolge, in
    der die Bausteine untereinander stehen sollen. ``spalte_id`` darf ``None``
    sein (ein Bestandsblock ohne Hülle, den 0472 nicht erwischt hat) — er
    bekommt dann keinen Spaltenrang, aber sein Abschnitt zählt trotzdem mit,
    falls einer bekannt ist.

    Rückgabe: ``(rang_je_widget, rang_je_abschnitt)``.

    Beide Karten enthalten NUR, was sich wirklich ändern soll. Wer nicht
    vorkommt, wird nicht angefasst — ein „sicherheitshalber auf 0 setzen" wäre
    genau die stille Änderung, die niemand sucht (Wurzel 1).
    """
    rang_je_widget: dict[str, int] = {}
    rang_je_abschnitt: dict[str, int] = {}
    zaehler_je_spalte: dict[str, int] = {}

    for widget_id, spalte_id in reihenfolge:
        if spalte_id is not None:
            rang = zaehler_je_spalte.get(spalte_id, 0)
            rang_je_widget[widget_id] = rang
            zaehler_je_spalte[spalte_id] = rang + 1
            abschnitt_id = abschnitt_von_spalte.get(spalte_id)
        else:
            abschnitt_id = None
        if abschnitt_id and abschnitt_id not in rang_je_abschnitt:
            # Der Abschnitt steht dort, wo sein ERSTER Baustein steht. Die
            # Zählung läuft über die bereits vergebenen Ränge und nicht über
            # den Listenindex: bei zwei Bausteinen in einer Spalte wäre der
            # Index zwei, der Abschnitt aber der erste (Wurzel 4 — die Zahl
            # muss das meinen, was sie behauptet).
            rang_je_abschnitt[abschnitt_id] = len(rang_je_abschnitt)

    return rang_je_widget, rang_je_abschnitt


def abschnitte_einordnen(
    alte_reihenfolge: list[str],
    neue_raenge: dict[str, int],
) -> dict[str, int]:
    """Die VOLLSTÄNDIGE Reihenfolge der Abschnitte — auch der leeren.

    ``neue_raenge`` kommt aus ``ordnung_planen`` und kennt nur die Abschnitte,
    in denen wirklich ein Baustein liegt: die anderen stehen in der gesendeten
    Liste ja gar nicht. Vergibt man nur diese Ränge neu, tragen die leeren
    Abschnitte weiter ihre alten Zahlen — und dann gibt es zwei Zeilen mit
    Position 0, deren Reihenfolge die Datenbank entscheidet. Live gesehen am
    28.08.2026: ein Baustein wurde in eine andere Spalte gezogen, und die zwei
    leeren Abschnitte sprangen dabei an den Anfang der Seite.

    Die Regel, die die Nachbarschaft erhält: ein leerer Abschnitt bleibt hinter
    denselben BELEGTEN Abschnitten, hinter denen er vorher stand. Lagen vorher
    zwei belegte vor ihm, steht er auch nachher hinter den (neuen) ersten zwei.

    Rückgabe: ``abschnitt_id -> Rang``, lückenlos ab 0 für ALLE übergebenen
    Abschnitte (Wurzel 1: wer eine Ordnung neu setzt, pflegt die dadurch
    verschobene alte mit).
    """
    belegt_neu = [
        aid for aid, _ in sorted(neue_raenge.items(), key=lambda kv: kv[1])
    ]
    # Wie viele BELEGTE Abschnitte lagen vorher vor diesem leeren?
    davor_zaehler: dict[str, int] = {}
    gesehen = 0
    for aid in alte_reihenfolge:
        if aid in neue_raenge:
            gesehen += 1
        else:
            davor_zaehler[aid] = gesehen

    ergebnis: list[str] = []
    for i, aid in enumerate(belegt_neu):
        # Erst die leeren, die vor diesem belegten stehen …
        ergebnis.extend(
            leer for leer, davor in davor_zaehler.items() if davor == i
        )
        ergebnis.append(aid)
    # … und zum Schluss, was hinter allen belegten lag.
    ergebnis.extend(
        leer
        for leer, davor in davor_zaehler.items()
        if davor >= len(belegt_neu)
    )
    return {aid: rang for rang, aid in enumerate(ergebnis)}


def raenge_verdichten(
    raenge: dict[str, int],
    entfallen: set[str],
) -> dict[str, int]:
    """Ränge ohne die entfallenen Abschnitte — lückenlos ab 0.

    Nötig, seit das Umhängen eines Bausteins seine leer gewordene Hülle
    abräumt (28.08.2026): die Rangliste entsteht VOR dem Aufräumen und kennt
    die gelöschten Abschnitte noch. Sie unverändert zu schreiben hieße,
    Positionen an Zeilen zu vergeben, die es nicht mehr gibt — und die
    verbleibenden trügen Zahlen mit Löchern (0, 2, 3). Sortiert stimmt das
    zwar, aber die nächste Einfügeposition rechnet daneben.
    """
    bleiben = sorted(
        ((aid, rang) for aid, rang in raenge.items() if aid not in entfallen),
        key=lambda kv: kv[1],
    )
    return {aid: neu for neu, (aid, _) in enumerate(bleiben)}
