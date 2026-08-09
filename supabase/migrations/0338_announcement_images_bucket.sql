-- 0338 — Storage-Bucket für Screenshots in Ankündigungen (0337).
--
-- Pfad `{announcement_id}/{token_hex}.{png|webp}` — bewusst OHNE tenant_id im
-- Pfad: eine Ankündigung gehört keinem Betrieb, sondern der Plattform.
--
-- PUBLIC, und das ist hier die richtige Wahl: die Bilder stehen in einer
-- Mitteilung, die ohnehin jeder Kunde zu sehen bekommt. Signierte URLs müssten
-- beim Rendern je Bild erneuert werden — sie stehen aber als `<img src>` im
-- gespeicherten HTML und wären nach einer Stunde tote Bilder in der Historie.
-- Schutz vor Erraten: nicht-ratbarer Dateiname (secrets.token_hex), wie bei
-- property-images (0062). Deshalb keine storage.objects-Policy nötig.
--
-- NUR PNG UND WEBP:
--   • KEIN SVG — ein SVG im public Bucket ist Stored-XSS (es darf <script>
--     tragen und wird vom Browser als Dokument ausgeführt). Genau dieser Befund
--     machte `_sanitize_svg` in buchhaltung/service.py nötig.
--   • KEIN JPEG/GIF — Screenshots sind PNG oder WebP. Jedes zusätzliche Format
--     ist Angriffsfläche (Decoder-CVEs) ohne fachlichen Nutzen.
-- Die MIME-Allowlist hier ist der zweite Riegel; der erste ist die
-- MAGIC-BYTE-Prüfung im Upload-Endpunkt (der Client-content_type ist frei
-- wählbar und damit kein Schutz, Wurzel 8).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'announcement-images',
    'announcement-images',
    true,
    10485760,  -- 10 MB; im Backend wird nichts skaliert (kein Pillow-Pfad hier)
    array['image/png', 'image/webp']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
