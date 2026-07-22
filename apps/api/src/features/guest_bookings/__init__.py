"""Feature-Slice guest_bookings — „Meine Buchungen" des Kunden-Dashboards.

Guest-facing (/plattform): ein eingeloggter Portal-Gast (CurrentGuest) sieht,
verfolgt und storniert seine EIGENEN Reservierungen. Die Zuordnung läuft über
E-Mail-Match (``reservations.guest_email`` == ``ctx.email``, case-insensitiv,
Index ``reservations_guest_email_lower_idx`` aus Migration 0181) — es gibt KEINE
portal_guest_id-Spalte an reservations.

Alle Zugriffe (Liste UND {id}) sind ausschließlich über diesen E-Mail-Match
gescopet (Wurzel 3/9); eine fremde Buchung liefert 404. Der Storno delegiert an
``ReservationsService.cancel`` (eine Nächte-Freigabe ``_release_nights``, Wurzel 1;
idempotent, Wurzel 2). Beträge/Währung kommen aus reservation/property ohne
Fallback (Wurzel 4); die Zeitleiste ist gast-maskiert (keine internen Auslöser).
"""
