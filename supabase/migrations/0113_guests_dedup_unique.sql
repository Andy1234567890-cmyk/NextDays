-- 0113_guests_dedup_unique.sql — Duplikat-Gäste bei parallelen Buchungen sperren
--
-- BUG (Loop-Fund): resolve_or_create_guest (guests/identity.py) sucht per
-- _find_by_email/_find_by_phone und legt bei Nichtfund einen Gast an. Zwischen
-- Suche und Insert klafft ein Race-Fenster: zwei gleichzeitige Buchungen
-- desselben Gastes (z. B. OTA-Push + Direktbuchung) laufen beide durch die
-- Suche (nichts gefunden) und legen ZWEI Gäste mit derselben E-Mail/Telefon an.
-- Es gab keinen Unique-Index auf guests(tenant_id, email/phone).
--
-- FIX: partielle Unique-Indizes je Tenant —
--   * (tenant_id, lower(email)) WHERE email IS NOT NULL
--   * (tenant_id, phone)        WHERE phone IS NOT NULL
-- E-Mail case-insensitiv (lower), passend zu normalize_email (trim+lowercase).
-- NULLs bleiben ausgenommen (Gäste ganz ohne E-Mail/Telefon kollidieren nicht).
-- Der App-Code (identity.py) fängt eine Verletzung ab und lädt den bestehenden
-- Gast (Resolver bleibt idempotent) statt zu scheitern.
--
-- Live verifiziert (SSH gegen die Server-DB): 0 Bestands-Duplikate für beide
-- Schlüssel — die Indizes sind gefahrlos anlegbar (kein Backfill/Merge nötig).

create unique index if not exists guests_tenant_email_uq
    on public.guests (tenant_id, lower(email))
    where email is not null;

create unique index if not exists guests_tenant_phone_uq
    on public.guests (tenant_id, phone)
    where phone is not null;
