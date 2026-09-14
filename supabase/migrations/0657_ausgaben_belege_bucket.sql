-- 0657_ausgaben_belege_bucket.sql — privater Bucket für Eingangsbelege
--
-- PRIVAT: ein Eingangsbeleg trägt IBAN, Steuernummer und Anschrift des
-- Lieferanten und die Umsätze des Betriebs — nichts davon gehört an eine
-- öffentliche Adresse (Wurzel 6/8). Zugriff ausschließlich über signierte URLs
-- vom Server (`GET /buchhaltung/expenses/{id}/receipt-url`, 10 Minuten).
--
-- 15 MB und PDF/JPEG/PNG/HEIC/HEIF — beides zusätzlich serverseitig geprüft
-- (Magic-Bytes in bereiche/ausgaben/service.py), weil ein Client-content_type
-- nichts beweist. HEIC kommt vom iPhone; das Frontend wandelt NICHT um
-- (`heic2any` ist nicht installiert), der Server nimmt die Datei an und legt
-- sie so ab. Vorschau im Browser gibt es dann nicht — die Datei ist trotzdem
-- der Beleg.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ausgaben-belege', 'ausgaben-belege', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'])
on conflict (id) do update
    set public = false,
        file_size_limit = 15728640,
        allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png',
                                   'image/heic', 'image/heif'];
