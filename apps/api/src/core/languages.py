"""ISO-639-1-Sprachcode → ausgeschriebener Name (eine Quelle der Wahrheit).

Die Portale liefern die Sprache des Gastes als zweistelligen Code („de", „da",
„nl"). Den einem Menschen so hinzuschreiben ist keine Information: In der
Gästekarte stand „Sprache: de", und wer „da" liest, denkt eher an einen Tippfehler
als an Dänisch.

Zwei Namen je Code, aus demselben Grund wie bei den Ländern
(`core.countries`): Die Oberfläche des Betriebs ist deutsch, ein an den GAST
gerichteter Text kann aber englisch sein. Welcher Name genommen wird, entscheidet
der Aufrufer über `sprache=`.

Umfang: die 24 Amtssprachen der EU plus die Nicht-EU-Sprachen, die im
Gästeaufkommen real vorkommen (Norwegisch, Isländisch, Russisch, Ukrainisch,
Türkisch, Chinesisch, Japanisch). Kein Rateversuch über eine Bibliothek: ein
falsch benannter Sprachname in einer Gastnachricht ist peinlicher als der Code.

Unbekannter Code → None. Der Aufrufer zeigt dann den Rohwert oder gar nichts —
kein erfundener Name (Wurzel 4).
"""
from __future__ import annotations

from typing import Final

# ISO-639-1 → (deutscher Name, englischer Name).
_SPRACHEN: Final[dict[str, tuple[str, str]]] = {
    "bg": ("Bulgarisch", "Bulgarian"),
    "cs": ("Tschechisch", "Czech"),
    "da": ("Dänisch", "Danish"),
    "de": ("Deutsch", "German"),
    "el": ("Griechisch", "Greek"),
    "en": ("Englisch", "English"),
    "es": ("Spanisch", "Spanish"),
    "et": ("Estnisch", "Estonian"),
    "fi": ("Finnisch", "Finnish"),
    "fr": ("Französisch", "French"),
    "ga": ("Irisch", "Irish"),
    "hr": ("Kroatisch", "Croatian"),
    "hu": ("Ungarisch", "Hungarian"),
    "is": ("Isländisch", "Icelandic"),
    "it": ("Italienisch", "Italian"),
    "ja": ("Japanisch", "Japanese"),
    "lt": ("Litauisch", "Lithuanian"),
    "lv": ("Lettisch", "Latvian"),
    "mt": ("Maltesisch", "Maltese"),
    "nl": ("Niederländisch", "Dutch"),
    "no": ("Norwegisch", "Norwegian"),
    "pl": ("Polnisch", "Polish"),
    "pt": ("Portugiesisch", "Portuguese"),
    "ro": ("Rumänisch", "Romanian"),
    "ru": ("Russisch", "Russian"),
    "sk": ("Slowakisch", "Slovak"),
    "sl": ("Slowenisch", "Slovenian"),
    "sv": ("Schwedisch", "Swedish"),
    "tr": ("Türkisch", "Turkish"),
    "uk": ("Ukrainisch", "Ukrainian"),
    "zh": ("Chinesisch", "Chinese"),
}

# Norwegisch führt Airbnb teils als Bokmål/Nynorsk, Portugiesisch als pt-BR.
# Beides ist für die Anzeige dieselbe Sprache.
_ALIASSE: Final[dict[str, str]] = {"nb": "no", "nn": "no"}


def basis_sprache(code: str | None) -> str | None:
    """Rohwert eines Portals → zweistelliger Basiscode („de-AT" → „de").

    Dieselbe Normierung, die `sprach_name` intern schon macht — hier einzeln
    verfügbar, weil sie auch ohne Anzeige gebraucht wird: die Sprachfassungen
    einer Vorlage werden über diesen Code VERGLICHEN (`inbox.sprachen`). Ohne
    Normierung trifft „de-AT" keine „de"-Fassung, und der Gast bekommt still
    die Standardfassung — ein Fehler, den niemand an der Nachricht ansieht.

    Unbekannte/leere Werte → None; die Prüfung, ob es die Sprache überhaupt
    gibt, macht `ist_bekannte_sprache` (getrennt, weil ein Portal auch Codes
    schickt, die wir nicht führen — die dürfen den Aufrufer nicht sprengen).
    """
    roh = (code or "").strip().lower()
    if not roh:
        return None
    basis = roh.replace("_", "-").split("-", 1)[0]
    if len(basis) != 2 or not basis.isalpha():
        return None
    return _ALIASSE.get(basis, basis)


def ist_bekannte_sprache(code: str | None) -> bool:
    """Führen wir diese Sprache? (Grundlage für die Auswahlliste im Frontend.)"""
    basis = basis_sprache(code)
    return bool(basis and basis in _SPRACHEN)


def alle_sprachen(*, sprache: str = "de") -> list[tuple[str, str]]:
    """(Code, Name) aller geführten Sprachen, nach NAMEN sortiert.

    Nach Namen, nicht nach Code: die Liste wird gelesen, nicht gerechnet — nach
    Code sortiert stünde „Dänisch" (da) vor „Deutsch" (de) vor „Griechisch"
    (el), was in einer Auswahlliste wie eine zufällige Reihenfolge wirkt.
    """
    index = 0 if sprache == "de" else 1
    paare = [(code, namen[index]) for code, namen in _SPRACHEN.items()]
    return sorted(paare, key=lambda p: p[1])


def sprach_name(code: str | None, *, sprache: str = "de") -> str | None:
    """„de" → „Deutsch" (bzw. „German"). Unbekannt/leer → None.

    Regionale Varianten werden auf die Basissprache zurückgeführt: „pt-BR" und
    „de_AT" nennen wir „Portugiesisch" bzw. „Deutsch". Die Region gehört zum
    Land des Gastes, nicht zu seiner Sprache — sie hier mitzuschleppen führte in
    der Gästekarte zu „Sprache: de-AT", was denselben Rohwert-Eindruck macht wie
    vorher „de".
    """
    basis = basis_sprache(code)
    if not basis:
        return None
    treffer = _SPRACHEN.get(basis)
    if not treffer:
        return None
    return treffer[0] if sprache == "de" else treffer[1]
