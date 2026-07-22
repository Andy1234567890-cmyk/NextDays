"""Feature-Slice guest_messages — Gast↔Host-Chat des Kunden-Dashboards (/plattform).

Eigenes Thread-Modell (guest_message_threads + guest_messages, Migration 0181),
getrennt vom tenant-seitigen inbox/ (das auf channex_booking aufbaut). Der Gast
ist über ctx.guest_id (== portal_guests.id) und ctx.email (E-Mail-Match gegen
reservations.guest_email) identifiziert. Schreiben läuft ausschließlich
server-seitig (service_role); der Server setzt sender='guest' und scoped jeden
Zugriff auf den eingeloggten Gast.
"""
