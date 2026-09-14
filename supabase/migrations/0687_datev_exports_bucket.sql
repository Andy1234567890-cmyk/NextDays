-- 0687_datev_exports_bucket.sql — Privater Bucket für DATEV-Exportdateien
--
-- Die EXTF-Dateien (Buchungsstapel, Debitoren/Kreditoren) enthalten Umsätze,
-- Kundennamen und Personenkonten des Betriebs. Sie liegen deshalb in einem
-- PRIVATEN Bucket ohne `storage.objects`-Policy für anon/authenticated
-- (fail-closed-Fassung, Muster 0598 partner-deals / 0445 site-form-uploads).
-- Ausgeliefert wird ausschließlich über `GET /buchhaltung/datev/exports/{id}/
-- download` — der Server lädt die Datei mit der Service-Role, prüft den Tenant
-- (load_scoped) und streamt sie mit Content-Disposition. Keine signierte
-- Bucket-Adresse in der Datenbank, keine Adresse im Frontend.
--
-- MIME `text/csv`: DATEV-Dateien sind Windows-1252-kodierter Text mit
-- Semikolon; der Server setzt beim Upload denselben Typ. Größencap 50 MB —
-- ein Jahr Buchungen eines Betriebs liegt weit darunter; der Cap ist die
-- Rückfallebene hinter der Zeitraumgrenze (≤ 366 Tage) des Service.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'datev-exports',
    'datev-exports',
    false,     -- privat: nur über die API
    52428800,  -- 50 MB
    array['text/csv']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
