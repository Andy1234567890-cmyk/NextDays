"""Feature-Slice ``guest_auth`` — Gast-Auth-Welt der Plattform-Demand-Seite.

Getrennt von ``features/auth`` (Vermieter/Staff/Tenant): ein Portal-Gast hat
KEINEN tenant_id und KEINE Rolle, sondern ein reines Kundenkonto (E-Mail +
Passwort über GoTrue). Login/Registrierung/Profil laufen ausschließlich über
diesen Slice; jeder per-ID-Zugriff ist über ``guest_id == auth.uid()`` gescopet.
"""
