# Slice: auth

Referenz-Slice (voll implementiert): Registrierung (Tenant + Owner, atomar),
Login, `/me`, Nutzer-Einladung in den eigenen Tenant (`MANAGE_STAFF`).
Rollen- und Rechte-Modell: Capability-Matrix (`permissions.py`,
`granular_permissions.py`) mit `require_permission`-Guards, Gäste-Daten-
Maskierung nach Rolle (`guest_masking.py`), Eigentümer-Objekt-Zuordnung
(Lastenheft §4.2, `owner_assignment_service.py`,
`GET/PUT /auth/owners/{user_id}/properties`).

Konto & Sicherheit: `/auth/account*` (E-Mail, Name, Passwort, Profil, Avatar,
Nutzerlisten) und TOTP-2FA (`/totp/enroll|verify|disable`). Betriebsart des
Mandanten: `PATCH /auth/tenant/accommodation-type`
(`vacation_rental | hotel`, Migration 0090).
