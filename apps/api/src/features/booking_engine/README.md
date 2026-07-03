# Slice: booking_engine

Öffentliche Buchungsstrecke der Direktbuchung (`/api/v1/booking-engine`,
Gäste haben keinen Login): Inserate-Liste + Detail (`/listings`,
`/listings/{id}`), Verfügbarkeitsabfrage (`/availability`) und
Buchungsanlage (`POST /reservations`).

Nach der Buchung: Add-on-Verkaufsfläche für Gäste
(`GET/POST /reservations/{id}/addons`) — buchbare `guest_portal`-Add-ons
einsehen und nachkaufen, verifiziert über die Buchungs-E-Mail.
