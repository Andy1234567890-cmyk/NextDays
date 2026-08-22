"""Kopien fachlicher Module aus `apps/api` (SCHWESTERDATEIEN).

Dieser Baum enthält KEINE eigene Fachlichkeit. Er trägt die Module, die die
öffentliche API mit dem Betriebssystem teilen MUSS, weil ihr Ergebnis dasselbe
sein muss — heute die Preisberechnung. Sie liegen unter demselben Importpfad
wie dort (`src.features.…`), damit die Dateien byte-identisch bleiben können und
der CI-Job `public-api-konsistenz` die Gleichheit prüfen kann.

Warum überhaupt Kopien und nicht ein Import: die öffentliche API ist ein eigener
Dienst mit eigenem Image (siehe `pyproject.toml`). Würde sie aus `apps/api`
importieren, wären beide wieder EIN Deployment — und ein Lastausbruch eines
API-Kunden nähme die Oberfläche des Betriebs mit.
"""
