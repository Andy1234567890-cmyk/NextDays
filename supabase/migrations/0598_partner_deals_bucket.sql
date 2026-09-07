-- 0598 — Privater Bucket `partner-deals` für QR-Codes der Partner-Deals (§2.6).
--
-- Der Partner (Fårup Sommerland, Café Fisk …) liefert seinen QR-Code als
-- Bild oder PDF; der Betrieb lädt ihn am Deal hoch (`POST /crm/deals/{id}/qr`).
-- Angezeigt wird er ausschließlich über kurzlebige signierte Adressen aus dem
-- Service — der Bucket ist privat und hat KEINE `storage.objects`-Policy für
-- anon/authenticated (fail-closed-Fassung, Muster 0088 agency-contracts, 0445
-- site-form-uploads). Ein späteres Gastportal-Rendering (`im_gastportal_sichtbar`,
-- 0597) holt sich die Adresse ebenfalls über den Server, nie über den Bucket.
--
-- MIME-Liste = ZWEITER Riegel. Der erste ist die Magic-Byte-Prüfung in
-- `crm/dateien.py`: der vom Browser behauptete `content_type` ist frei
-- wählbar. SVG ist erlaubt, weil Druckereien QR-Codes als Vektor liefern —
-- es wird VOR dem Ablegen mit der nh3-Allowlist der Firmenlogos gesäubert
-- (Skripte, foreignObject, Event-Handler raus).
--
-- 5 MB = derselbe Wert wie `crm/dateien.QR_MAX_BYTES`. Zwei Stellen, ein Wert:
-- die API weist früh mit verständlicher Meldung ab (413), der Bucket ist die
-- Rückfallebene.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'partner-deals',
    'partner-deals',
    false,    -- privat: nur über die API signierte Adressen
    5242880,  -- 5 MB, wie QR_MAX_BYTES
    array['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
