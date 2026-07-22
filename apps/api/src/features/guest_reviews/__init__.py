"""guest_reviews — Bewertungen des Kunden-Dashboards (/plattform).

Gäste bewerten NUR abgeschlossene, ihnen gehörende Reservierungen (Nachweis
„echter Gast" per E-Mail-Match, analog Booking/Airbnb). Öffentlicher Lesepfad
liefert maskierte Bewertungen (kein Name/E-Mail/guest_id). Schreiben läuft
ausschließlich server-seitig (service_role) — der anon-/authenticated-Direktpfad
ist in Migration 0181 hart entzogen (Wurzel 6).
"""
