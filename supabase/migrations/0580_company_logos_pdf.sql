-- 0580_company_logos_pdf.sql — Firmenlogo auch als PDF (Lastenheft §2.1)
--
-- Das Lastenheft nennt für das Logo ausdrücklich „PDF, JPG, PNG". 0067 legte
-- den Bucket mit JPEG/PNG/WebP/SVG an; ein PDF lehnte die API mit 415 ab und
-- der Bucket hätte es auch dann verworfen, wenn die API es durchgelassen
-- hätte (`allowed_mime_types` prüft Storage-seitig, unabhängig vom Service).
-- Beide Stellen ziehen deshalb zusammen nach: hier der Bucket, im Service
-- `BuchhaltungService.LOGO_MIME` samt Magic-Byte-Prüfung (`%PDF-`).
--
-- Was ein PDF-Logo NICHT kann: in Dokumenten (Eigentümer-Abrechnung,
-- Rechnung, Gästeportal) als Bild gerendert werden. Die Verbraucher lesen
-- `company_logo_url` und binden sie als <img>/<Image> ein — ein PDF bleibt
-- dort leer. Der Service schreibt die URL trotzdem (es IST das Logo des
-- Betriebs), und die Konto-Seite sagt dem Betrieb beim Hochladen, dass ein
-- PDF nur als Datei hinterlegt, nicht in Dokumenten gezeigt wird (Wurzel 4:
-- kein stilles Nichts an der Stelle, wo ein Bild erwartet wird).
--
-- Größe bleibt 5 MB; ein Logo-PDF ist eine Seite mit einer Vektorgrafik.
--
-- KEIN `begin;`/`commit;`: `apply-migrations.sh` fährt jede Migration bereits
-- in einer eigenen Transaktion.

update storage.buckets
set allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'
]
where id = 'company-logos';
