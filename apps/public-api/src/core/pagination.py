"""Blättern und Zeiträume — Cursor (empfohlen), Offset (weiterhin erlaubt).

## Warum Cursor

Offset-Blättern hat einen Fehler, der nicht auffällt: die Liste ändert sich
während des Blätterns. Kommt zwischen Seite 1 und Seite 2 eine Buchung dazu,
rutscht alles um eine Position, und `offset=50` überspringt eine Zeile. Beim
Löschen kommt eine Zeile doppelt. Für ein Fremdsystem, das seine Datenbank
daraus füllt, ist das ein stiller Datenverlust — niemand bemerkt die eine
Buchung, die nie ankam.

Cursor-Blättern („Keyset") kennt das Problem nicht: die nächste Seite wird nicht
über eine POSITION beschrieben, sondern über den letzten gesehenen DATENSATZ.
Was danach kommt, kommt danach — egal, wie viel davor passiert ist.

## Die Form

    ?limit=50&starting_after=<id des letzten Elements der Vorseite>

Der Cursor ist die **Objekt-ID**, nicht eine kodierte Zeichenkette. Das ist das
Muster von Stripe (`starting_after` nimmt eine Objekt-ID, geprüft am 22.08.2026
in docs.stripe.com/api/pagination), und es hat drei Vorteile gegenüber einem
opaken base64-Token: der Client muss nichts dekodieren, wir müssen kein
Cursor-Format versionieren, und eine ID, die nicht zum Betrieb gehört, lässt
sich als solche erkennen und melden — bei einem konstruierten opaken Cursor
wüsste niemand, was schiefging.

Preis dieser Wahl: eine zusätzliche Abfrage je Seite, um den Sortierwert des
Cursor-Elements zu lesen. Das ist ein Primärschlüssel-Treffer, einmal je Seite,
nicht je Zeile.

## Offset bleibt

`offset` wird NICHT entfernt. Es ist der einfachste Weg für einen einmaligen
Blick („zeig mir Seite 3") und für Werkzeuge, die nur Offset kennen. Beides
GLEICHZEITIG ist dagegen ein Fehler (422) — wie bei Stripe, wo `starting_after`
und `ending_before` einander ausschließen: zwei Positionsangaben in einer
Anfrage haben keine widerspruchsfreie Bedeutung, und stillschweigend eine davon
zu ignorieren wäre die schlechtere Antwort.

## Zusammengesetzter Schlüssel — ohne ihn ist Cursor wertlos

Sortiert wird immer nach `(fachliches Feld, id)`. Der Titel eines Objekts, der
Name eines Gasts, ein Anreisetag: nichts davon ist eindeutig. Ohne den
eindeutigen zweiten Schlüssel wäre die Reihenfolge bei gleichen Werten
undefiniert, und ein Cursor könnte nicht sagen, welches der drei gleichnamigen
Elemente gemeint war.

Der Vergleich lautet deshalb (aufsteigend):

    (feld, id) > (cursor_feld, cursor_id)

und wird über PostgREST als `or=(feld.gt.X, and(feld.eq.X, id.gt.Y))`
ausgedrückt. Live gegen die Datenbank verifiziert (22.08.2026): dieselbe Menge
wie `offset`, keine Überlappung.

## NULL-Werte im Sortierfeld

Aufgaben ohne Fälligkeit haben `due_at = null`. Postgres sortiert NULLs bei
aufsteigender Ordnung ans ENDE (`NULLS LAST`), und ein naiver Vergleich
`due_at.gt.X` schließt sie aus — der Cursor käme nie in den NULL-Block, das
Blättern würde vor den letzten Zeilen stehen bleiben. Deshalb behandelt
`keyset_ausdruck` beide Lagen ausdrücklich:

  * Cursor steht auf einem Wert → alles Größere PLUS der ganze NULL-Block.
  * Cursor steht auf NULL → nur noch NULL-Zeilen mit größerer ID.

Bei ABSTEIGENDER Ordnung liegt der NULL-Block vorne (`NULLS FIRST` ist der
Postgres-Standard für `DESC`). Steht der Cursor dort, müssen danach ALLE Zeilen
mit einem Wert folgen — sonst endet das Blättern nach dem NULL-Block, und der
Client hält die Liste für zu Ende.

Wer eine neue Liste baut, deren Sortierfeld NULL sein kann, muss zwei Dinge
zusammenhalten: die Richtung im `order()` und das `aufsteigend` des Filters,
und bei aufsteigender Ordnung `nullsfirst=False` im `order()`. Passt das nicht
zusammen, fehlen Zeilen in der Antwort des Kunden, ohne dass irgendwo ein
Fehler entsteht.

## Zwei Formen, und warum

PostgREST kann keinen Tupel-Vergleich `(feld, id) < (?, ?)` ausdrücken — die
Filtersyntax hat links keine Stelle für ein Spalten-Tupel, und der Maintainer
hat den Wunsch (Issue #1431) mit „gehört in eine Client-Bibliothek" abgelehnt.
Der naive Ersatz ist eine reine ODER-Form. Sie ist korrekt, aber `EXPLAIN` zeigt
dabei `Index Cond: (tenant_id = …)` und die ganze Keyset-Bedingung als
NACHFILTER: der Index trägt nur den Mandanten, gefiltert wird über alle seine
Zeilen.

Deshalb steht hier für Spalten ohne NULL die RANGE-Form: die untere Grenze wird
als eigener Vergleich gesetzt, und `EXPLAIN` zeigt
`Index Cond: (tenant_id = … AND title >= 'M')` — der Scan beginnt am richtigen
Punkt und endet nach `limit` Zeilen. Live gemessen am 22.08.2026 mit erzwungenem
Index-Scan; beide Formen liefern dieselbe Menge.

Für NULL-fähige Sortierspalten bleibt die ODER-Form: ein `feld >= wert` würde
alle NULL-Zeilen ausschließen und den NULL-Block unerreichbar machen.
Korrektheit vor Geschwindigkeit.

Die letzte Stufe wäre eine DB-Funktion mit echtem Tupel-Vergleich (`Index Cond:
ROW(title, id) > ROW(…)`, seit Postgres 8.2 ein Access-Predicate). Sie ist NICHT
gebaut: bei den heutigen Größen ist der Unterschied nicht messbar, und fünf neue
SECURITY-DEFINER-Funktionen sind Angriffsfläche, die man nur auf Nachweis
anlegt. Der Weg ist notiert, nicht vorgebaut. NICHT der Ausweg: den Cursor
aufgeben und zu Offset zurückkehren — das tauscht ein Geschwindigkeitsproblem
gegen ein Korrektheitsproblem.

## Werte werden gequotet, nicht roh eingesetzt

PostgREST trennt seine Logik-Bäume mit `,` `(` `)`. Ein Sortierwert, der eines
dieser Zeichen enthält — ein Objekt namens `Haus, klein` genügt —, zerlegt den
Ausdruck und ergibt `failed to parse logic tree`, also einen 500 für den Kunden.
`.or_()` von supabase-py sanitisiert nichts. Deshalb geht jeder Wert durch
`_wert_fuer_filter`; die Regeln und die Live-Belege stehen dort.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from supabase import Client

from . import errors
from .config import get_settings

# Ein noch nicht ausgeführter PostgREST-Abfrage-Baukasten. `Any` mit Namen:
# supabase-py exportiert die Builder-Typen nicht öffentlich (sie liegen in einem
# privaten Modul und heißen je Version anders), ein Import daraus wäre bei jedem
# Bibliotheks-Update ein Bruch. Derselbe Alias wie in `core/db.py`.
type Abfrage = Any

# Der Wert einer Sortierspalte: Text, Datum, Zeitstempel — oder None, wenn die
# Spalte NULL erlaubt (Aufgaben ohne Fälligkeit). Was hier hereinkommt, hat die
# Datenbank geliefert; ein enger Typ wäre eine Behauptung über ein Schema, das
# der Aufrufer bestimmt.
type SortierWert = Any


@dataclass(frozen=True)
class Blaettern:
    """Geprüfte Blätter-Angaben einer Anfrage."""

    limit: int
    offset: int
    include_total: bool
    starting_after: str | None = None

    @property
    def range_bis(self) -> int:
        """Obergrenze für PostgREST `.range()` — eine Zeile mehr als `limit`,
        damit `has_more` ohne zweiten Aufruf feststeht.

        Beim Cursor-Blättern beginnt jede Seite bei 0: die Position steckt im
        Filter, nicht im Bereich.
        """
        start = 0 if self.starting_after else self.offset
        return start + self.limit  # inklusive → das sind limit+1 Zeilen

    @property
    def range_von(self) -> int:
        return 0 if self.starting_after else self.offset


def blaettern_pruefen(
    limit: int | None,
    offset: int | None,
    include_total: bool,
    starting_after: str | None = None,
) -> Blaettern:
    """Rohwerte aus der Query prüfen. Zu groß/negativ/widersprüchlich → 422."""
    settings = get_settings()
    max_limit = settings.max_page_size
    wert = 50 if limit is None else limit
    if wert < 1 or wert > max_limit:
        raise errors.ungueltige_anfrage(
            f"limit muss zwischen 1 und {max_limit} liegen.",
            extra={"max_limit": max_limit},
        )
    versatz = 0 if offset is None else offset
    if versatz < 0:
        raise errors.ungueltige_anfrage("offset darf nicht negativ sein.")

    cursor = (starting_after or "").strip() or None
    if cursor and versatz:
        # Zwei Positionsangaben in einer Anfrage haben keine widerspruchsfreie
        # Bedeutung. Eine davon stillschweigend zu ignorieren wäre schlimmer als
        # der Fehler: der Client bekäme eine Seite, die er nicht bestellt hat.
        raise errors.ungueltige_anfrage(
            "`starting_after` und `offset` schließen sich aus. Nimm `starting_after` "
            "für einen laufenden Durchgang (stabil, auch wenn sich die Liste "
            "ändert) oder `offset` für einen einmaligen Blick auf eine Seite."
        )
    return Blaettern(
        limit=wert,
        offset=versatz,
        include_total=include_total,
        starting_after=cursor,
    )


def cursor_position(
    db: Client,
    tabelle: str,
    *,
    cursor_id: str,
    tenant_id: str,
    sortier_spalte: str,
) -> tuple[SortierWert, str]:
    """Sortierwert und ID des Cursor-Elements lesen.

    Der Zugriff ist tenant-gescopet: eine fremde oder erfundene ID ergibt einen
    422 mit Begründung — nicht eine leere Seite. Eine leere Seite wäre die
    schlechteste Antwort, weil der Client sie als „fertig, keine Daten mehr"
    liest und das Blättern beendet.

    Kein 404: der Cursor ist ein PARAMETER, keine Ressource. 422 sagt „deine
    Anfrage passt nicht", und genau das ist der Fall — meist, weil der Datensatz
    inzwischen gelöscht wurde.
    """
    zeilen = (
        db.table(tabelle)
        .select(f"id, {sortier_spalte}")
        .eq("id", cursor_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    if not zeilen:
        raise errors.ungueltige_anfrage(
            "Der Wert in `starting_after` gehört zu keinem Datensatz dieses "
            "Betriebs. Häufigste Ursache: der Datensatz wurde inzwischen "
            "gelöscht — beginne den Durchgang ohne `starting_after` neu.",
            extra={"starting_after": cursor_id},
        )
    return zeilen[0].get(sortier_spalte), str(zeilen[0]["id"])


def _wert_fuer_filter(wert: SortierWert) -> str:
    """Sortierwert für einen PostgREST-Filter einsetzbar machen.

    PostgREST trennt seine Logik-Bäume mit `,` `(` `)`; ein Wert, der eines
    dieser Zeichen enthält, zerlegt den Ausdruck. Live geprüft am 22.08.2026:
    ein Objekt mit dem Titel `Haus, klein` ergibt roh eingesetzt
    `failed to parse logic tree` — also einen 500 für den Kunden, sobald ein
    Betrieb ein Komma in einem Namen benutzt. Dass es das in den Daten heute
    (noch) nicht gibt, ist keine Absicherung, sondern Glück.

    Deshalb steht der Wert IMMER in doppelten Anführungszeichen, mit escapten
    inneren Anführungszeichen und Backslashes. Ebenfalls live geprüft: das
    Quoting schadet Zeitstempeln (`:` und `+`) und Datumswerten nicht, und ohne
    das Escape liefert ein Titel wie `Feriehus "Perlen" Tversted` eine Zeile zu
    viel — die Anführungszeichen im Wert beenden sonst das Quoting.

    `.or_()` von supabase-py sanitisiert NICHTS (es reicht den String
    unverändert durch). Diese Funktion ist damit die einzige Stelle, die
    zwischen einem Datenbankwert und einem Filter-Ausdruck steht.
    """
    roh = str(wert)
    escaped = roh.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def keyset_ausdruck(
    sortier_spalte: str,
    sortier_wert: SortierWert,
    cursor_id: str,
    *,
    aufsteigend: bool,
) -> str:
    """PostgREST-`or=`-Ausdruck für „alles nach diesem Datensatz".

    Ergebnis ist der Inhalt für `.or_(…)`, ohne das umgebende `or=(…)`.

    Aufsteigend mit Wert:  `feld.gt.X, and(feld.eq.X,id.gt.Y), feld.is.null`
    Absteigend mit Wert:   `feld.lt.X, and(feld.eq.X,id.lt.Y)`
    Cursor steht auf NULL: `and(feld.is.null,id.gt.Y)` bzw. `.lt.` bei desc

    Der NULL-Block hängt an der Sortierrichtung: bei aufsteigender Ordnung
    stehen NULLs am Ende und gehören damit hinter jeden Wert (deshalb
    eingeschlossen); bei absteigender Ordnung stehen sie am Anfang und sind
    damit schon vorbei.

    WICHTIG für jeden, der diesen Ausdruck weiterverwendet: er MUSS über
    `.or_(…)` von supabase-py gehen und darf NICHT selbst in eine URL geschrieben
    werden. Ein Zeitstempel enthält `+00:00`, und ein `+` in einer Query bedeutet
    dort ein LEERZEICHEN — PostgREST antwortet dann mit
    `22007 invalid input syntax for type timestamp`. Live geprüft am 22.08.2026:
    von Hand gebaute URL → 400, derselbe Ausdruck über `.or_()` → 200 mit dem
    erwarteten Ergebnis (supabase-py kodiert den Wert).
    """
    vergleich = "gt" if aufsteigend else "lt"
    if sortier_wert is None:
        # Der Cursor steht IM NULL-Block. Wie es weitergeht, hängt daran, wo
        # dieser Block liegt:
        #
        #   aufsteigend (NULLS LAST)  → er ist der SCHLUSS. Es folgen nur noch
        #                               NULL-Zeilen mit größerer ID.
        #   absteigend (NULLS FIRST)  → er ist der ANFANG. Danach kommen ALLE
        #                               Zeilen mit einem Wert — ohne diesen
        #                               Zweig bräche das Blättern nach dem
        #                               NULL-Block ab, und der Client hielte die
        #                               Liste für zu Ende.
        rest_im_block = f"and({sortier_spalte}.is.null,id.{vergleich}.{cursor_id})"
        if aufsteigend:
            return rest_im_block
        return f"{rest_im_block},{sortier_spalte}.not.is.null"

    wert = _wert_fuer_filter(sortier_wert)
    teile = [
        f"{sortier_spalte}.{vergleich}.{wert}",
        f"and({sortier_spalte}.eq.{wert},id.{vergleich}.{cursor_id})",
    ]
    if aufsteigend:
        # NULLs stehen bei aufsteigender Ordnung am Ende, gehören also hinter
        # jeden Wert. Bei absteigender Ordnung sind sie schon vorbei — sie
        # einzuschließen würde gelieferte Zeilen erneut ausspielen.
        teile.append(f"{sortier_spalte}.is.null")
    return ",".join(teile)


def keyset_anwenden(
    query: Abfrage,
    db: Client,
    tabelle: str,
    blatt: Blaettern,
    *,
    tenant_id: str,
    sortier_spalte: str,
    aufsteigend: bool,
    nullable: bool = False,
) -> Abfrage:
    """Den Cursor-Filter auf eine Abfrage legen — oder sie unverändert lassen.

    Der eine Aufruf, den jeder Listen-Endpunkt braucht. Ohne Cursor passiert
    nichts; mit Cursor wird die Position gelesen und der Filter gesetzt.

    ZWEI FORMEN, und der Unterschied ist messbar:

    * **Sortierspalte NOT NULL** (der Normalfall) → RANGE-Form. Die untere
      Grenze wird als eigener Vergleich gesetzt (`feld >= wert`), und nur
      innerhalb dieser Spanne entscheidet ein ODER über die Gleichstände. Damit
      wird die Grenze zum INDEX-STARTPUNKT: `EXPLAIN` zeigt
      `Index Cond: (tenant_id = … AND title >= 'M')`, der Scan beginnt an der
      richtigen Stelle und hört nach `limit` Zeilen auf.

    * **Sortierspalte NULLABLE** (`tasks.due_at`) → die reine ODER-Form aus
      `keyset_ausdruck`, weil ein `feld >= wert` alle NULL-Zeilen ausschließen
      würde und der NULL-Block damit unerreichbar wäre. Preis: `EXPLAIN` zeigt
      hier `Index Cond: (tenant_id = …)` plus Nachfilter — der Index trägt nur
      den Mandanten. Korrektheit vor Geschwindigkeit; bei Aufgaben ist die
      Menge je Betrieb ohnehin klein.

    Beide Formen sind live gegen die Datenbank auf Mengengleichheit geprüft
    (22.08.2026, auf- und absteigend, identische Ergebnisse wie `offset` ohne
    Nebenläufigkeit).

    `nullable` ist ein PARAMETER und keine Abfrage am Schema: der Aufrufer setzt
    ohnehin `nullsfirst` im `order()` und weiß es deshalb. Ein zusätzlicher
    Schema-Blick je Anfrage wäre eine Abfrage mehr für eine Antwort, die im Code
    steht.
    """
    if not blatt.starting_after:
        return query
    wert, cid = cursor_position(
        db,
        tabelle,
        cursor_id=blatt.starting_after,
        tenant_id=tenant_id,
        sortier_spalte=sortier_spalte,
    )
    # Ein NULL-Wert in einer als NOT NULL geführten Spalte wäre ein Datenfehler.
    # Dann greift die ODER-Form, die NULL behandeln kann — statt einer
    # Range-Grenze, die stillschweigend Zeilen verschluckt.
    if nullable or wert is None:
        return query.or_(
            keyset_ausdruck(sortier_spalte, wert, cid, aufsteigend=aufsteigend)
        )

    gequotet = _wert_fuer_filter(wert)
    richtung = "gt" if aufsteigend else "lt"
    grenze = query.gte(sortier_spalte, wert) if aufsteigend else query.lte(
        sortier_spalte, wert
    )
    # Innerhalb der Spanne: entweder der Wert ist schon größer, oder er ist
    # gleich und die ID entscheidet. Dass die Spanne das `eq` mit einschließt,
    # macht den zweiten Zweig zu `id.{richtung}` ohne erneutes `feld.eq` —
    # dasselbe Ergebnis mit einer Bedingung weniger.
    return grenze.or_(
        f"{sortier_spalte}.{richtung}.{gequotet},id.{richtung}.{cid}"
    )


def seite_bauen(
    zeilen: list[dict],
    blatt: Blaettern,
    *,
    total: int | None = None,
    id_feld: str = "id",
) -> dict:
    """Rohzeilen (limit+1 Stück) → Antwort-Umschlag.

    Der Umschlag ist bei JEDER Liste derselbe:

        {"data": [...],
         "pagination": {"limit", "offset", "has_more",
                        "next_starting_after"?, "total"?}}

    `next_starting_after` steht nur drin, wenn es eine weitere Seite gibt — der
    Client braucht dann nichts selbst zusammenzusetzen und muss nicht wissen,
    nach welchem Feld sortiert wird. Fehlt das Feld, ist der Durchgang fertig.

    Ein Umschlag, der je Endpunkt anders heißt, zwingt jeden Client zu
    Sonderfällen. `total` erscheint nur, wenn es bestellt wurde — nicht als
    `null`, das sonst wie „null Treffer" gelesen wird (Wurzel 4).
    """
    hat_mehr = len(zeilen) > blatt.limit
    daten = zeilen[: blatt.limit]
    seite: dict = {
        "limit": blatt.limit,
        "offset": blatt.offset,
        "has_more": hat_mehr,
    }
    if hat_mehr and daten:
        letzte = daten[-1].get(id_feld)
        if letzte is not None:
            seite["next_starting_after"] = str(letzte)
    if total is not None:
        seite["total"] = total
    return {"data": daten, "pagination": seite}


def zeitraum_pruefen(von: date, bis: date, *, max_tage: int | None = None) -> None:
    """Datums-Spanne prüfen: verdrehte Reihenfolge und Übergröße sind 422.

    Ohne diese Prüfung wäre `von=2000-01-01&bis=2100-01-01` ein Aufruf, der
    36 500 Tage aus der Datenbank zieht und den Service beschäftigt hält — die
    billigste Form, einen öffentlichen Dienst umzulegen (Wurzel 8).
    """
    if bis < von:
        raise errors.ungueltige_anfrage("'bis' liegt vor 'von'.")
    grenze = max_tage or get_settings().max_date_span_days
    tage = (bis - von).days + 1
    if tage > grenze:
        raise errors.ungueltige_anfrage(
            f"Der Zeitraum umfasst {tage} Tage; erlaubt sind höchstens {grenze}.",
            extra={"max_tage": grenze, "angefragte_tage": tage},
        )
