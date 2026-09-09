"""Eigentümer-Chat: gemeinsame Logik beider Seiten (0611, ADR-0029).

Agentur und Eigentümer sprechen dieselben Tabellen an, aber über verschiedene
Slices (`inbox` bzw. `public_portal`). Was BEIDE brauchen — Empfängerkreis,
Thread-Anlage, Ablage einer Nachricht samt verpackter Schlüssel — steht hier,
damit es nicht zweimal existiert und beim Ändern auseinanderläuft.
"""
