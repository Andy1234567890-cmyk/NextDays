"""Obergrenzen der MCP-Werkzeuge (Wurzel 8).

Eigene Datei, weil sowohl die Fachlogik (`tools.py`) als auch die
Beschreibungen (`katalog.py`) sie nennen — die Zahl im Text und die Zahl in der
Prüfung müssen dieselbe sein, sonst verspricht der Katalog etwas anderes, als
der Code zulässt.
"""

# Lesen. Ein Modell fragt gern „alles" — ohne Deckel wäre das ein Vollabzug des
# Bestands in den Kontext.
MAX_TAGE = 370
MAX_BUCHUNGEN = 100
MAX_THREADS = 50
MAX_NOTIZEN = 50
MAX_OBJEKTE = 200
MAX_AUFGABEN = 100
MAX_GAESTE = 100
MAX_BEWERTUNGEN = 100

# Schreiben. Enger als beim Lesen, weil jeder Schreibvorgang über Channex live
# an die Portale geht: ein Modell, das „das ganze Jahr" sperren will, soll das
# in bewussten Schritten tun und nicht in einem Aufruf.
MAX_SCHREIB_TAGE = 366
MAX_NACHRICHT_ZEICHEN = 4000

# Objekt- und Eigentümerverwaltung. Die Einheitenzahl deckelt das Schema
# ohnehin bei 200 (`UnitCountRequest`); hier steht dieselbe Zahl, damit der
# Katalogtext sie nennen kann, ohne dass zwei Grenzen auseinanderlaufen.
MAX_EINHEITEN = 200
MAX_EIGENTUEMER = 200
MAX_SAISONS = 100
MAX_ADDONS = 100
MAX_RABATTE = 100
