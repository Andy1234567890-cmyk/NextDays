# Slice: guests

Gäste-Kartei (`/api/v1/guests`): Gäste-CRUD mit Dubletten-Merge
(`POST /merge`) und pro Gast die Unterressourcen Adressen, Kontakte,
Ausweisdokumente (`identity.py`), Präferenzen, Einwilligungen (Consents),
Notizen und Dokumente.

Zusätzlich Querbezüge für die Gäste-Akte: Reservierungen, Inbox-Threads und
Rechnungen des Gasts (`GET /{guest_id}/reservations|threads|invoices`).
