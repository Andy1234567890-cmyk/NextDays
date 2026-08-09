"""Die Sprache einer ausgehenden E-Mail — Auflösung und Fallback-Kette.

DIE EINE STELLE, die entscheidet, in welcher Sprache eine Mail rausgeht. Ohne
sie baut jeder Absender seine eigene `(locale or "de").split("-")[0]`-Zeile,
und die dritte Kopie vergisst dann den Regionsschnitt oder fällt auf eine
andere Sprache zurück als die zweite.

WARUM ENGLISCH DER LETZTE RÜCKFALL IST (und nicht Deutsch):
Der Bestand fiel überall auf Deutsch zurück (`doc_i18n._DEFAULT`, der
`(locale or "de")` des Newsletters, die hart deutschen Betreffs in
`notification_settings/ereignisse`). Für einen französischen Eigentümer ist
eine deutsche Mail keine „neutrale Voreinstellung", sondern eine
Falschaussage über das Produkt: sie sagt „diese Software ist deutsch". Deutsch
ist eine INHALTLICHE Wahl, die sich als technischer Default tarnt — genau das
Muster, das Wurzel 4 verbietet.

Englisch ist der ehrliche Rückfall: es ist die Verkehrssprache des europäischen
Tourismus, und wer es liest, erkennt es als Ausweichsprache statt als Aussage
über die Herkunft des Anbieters. Das ist auch die Empfehlung der Recherche zu
Locale-Tiers (Fallback-Kette endet auf Englisch, nicht auf der Sprache des
Herstellers).

DIE KETTE, in dieser Reihenfolge — jede Stufe ist eine ECHTE Auskunft über den
Empfänger, keine geratene:
  1. Die Sprache AM EMPFÄNGER (`users.preferred_language`, `owners.language`,
     `guests.language`, `portal_guests.preferred_locale`). Er hat sie gewählt
     oder der Betrieb hat sie bei der Anlage erfasst.
  2. Die Sprache DES BETRIEBS (`tenants.default_language`). Wer einen dänischen
     Betrieb führt, schreibt seinen Eigentümern eher dänisch als englisch.
  3. Englisch.
Es gibt bewusst KEINE Stufe „Browsersprache des Anfragenden": beim Anlegen
eines Eigentümers sitzt der BETREIBER am Rechner, nicht der Eigentümer. Dessen
`Accept-Language` sagt über den Empfänger nichts aus — es wäre ein plausibel
aussehender erfundener Wert (Wurzel 4).

REGIONSVARIANTEN: `de-AT` → `de`, `pt-BR` → `pt`. Wir pflegen keine regionalen
Fassungen, also wird der Regionsteil abgeschnitten statt die ganze Angabe zu
verwerfen — ein Österreicher bekommt Deutsch, nicht Englisch. Unterstriche
(`de_AT`, die Schreibweise mancher OTA-Payloads) gelten als Bindestrich.
"""
from __future__ import annotations

# Die unterstützten Sprachen: die 24 EU-Amtssprachen, identisch zu
# `web/messages/*.json` und zu `buchhaltung.doc_i18n.SUPPORTED`. Die Liste
# steht hier NICHT zum zweiten Mal als Literal, sondern wird von dort bezogen —
# zwei Listen liefen beim Hinzufügen der 25. Sprache auseinander.
from src.features.buchhaltung.doc_i18n import SUPPORTED as _EU_SPRACHEN

SUPPORTED: frozenset[str] = _EU_SPRACHEN

# Der letzte Rückfall. Als Konstante und nicht als Literal an den Fundstellen,
# damit ein Wechsel EINE Änderung ist und nicht eine Suche über das Repo.
FALLBACK = "en"


def normalisieren(wert: object) -> str | None:
    """Ein roher Sprachwert → unterstützter Code, oder None.

    `None` heißt „diese Quelle weiß es nicht" — der Aufrufer geht dann zur
    nächsten Stufe der Kette. Bewusst NICHT `FALLBACK`: sonst könnte eine
    leere Nutzerspalte die Betriebssprache überstimmen, und die Kette wäre
    nach der ersten Stufe zu Ende.

    Unbekannte Codes (`zh`, `ru`, Tippfehler) ergeben ebenfalls None: wir haben
    für sie keinen Text, und so etwas als Sprache zu führen hieße, später einen
    leeren Betreff zu verschicken.
    """
    if not isinstance(wert, str):
        return None
    code = wert.strip().lower().replace("_", "-").split("-", maxsplit=1)[0]
    return code if code in SUPPORTED else None


def aufloesen(*quellen: object) -> str:
    """Die erste brauchbare Sprache aus der Kette — sonst Englisch.

    Aufruf in der Reihenfolge der Kette, z. B.::

        aufloesen(user["preferred_language"], tenant["default_language"])

    Der Rückgabewert ist IMMER ein unterstützter Code, nie None: ab hier ist
    die Sprache entschieden, und jede Fundstelle darunter darf sich darauf
    verlassen, dass ihr Katalog einen Eintrag hat.
    """
    for quelle in quellen:
        code = normalisieren(quelle)
        if code is not None:
            return code
    return FALLBACK
