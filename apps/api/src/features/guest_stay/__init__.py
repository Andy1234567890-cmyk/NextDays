"""guest_stay-Slice: Gastmodul / Self-Check-in im Kunden-Dashboard (/plattform).

Gleiche Plattform-Seite wie booking_engine (Demand-Seite, /plattform), aber NACH
der Buchung: der eingeloggte Gast ruft für SEINE Buchung Check-in-Infos, WLAN,
Hausordnung, Anreise und — nur nach den Sichtbarkeitsregeln — den Türcode ab und
checkt selbst ein. Scope IMMER über E-Mail-Match (reservations.guest_email ==
GuestContext.email, case-insensitiv); fremde Buchung → 404 (Wurzel 3/9).
"""
