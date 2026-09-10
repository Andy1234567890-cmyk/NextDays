"""DAC7-Meldung — Modell, Prüfung und Ausgabeformate.

Der Kern (`modell`) ist formatneutral; `csv_dk` ist der erste Serialisierer,
ein DPI-XML-Serialisierer tritt für das Meldejahr 2026 daneben. Alles
Fachliche steht im Modell und in `pruefung`, damit ein zweites Format keine
zweite Fachlogik braucht.
"""
