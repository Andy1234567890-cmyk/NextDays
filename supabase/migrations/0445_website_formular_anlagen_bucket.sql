-- 0445 — Der Bucket fuer Formular-Anlagen
--
-- 0444 hat die Tabelle `site_form_uploads` angelegt und den ganzen Weg
-- beschrieben — aber den SPEICHER nicht. Der Code in `formular_anlagen.py`
-- schreibt nach `site-form-uploads`; diesen Bucket gab es in der Live-Datenbank
-- nicht (nachgemessen am 25.08.2026: property-images, company-logos,
-- agency-contracts, task-photos, inbox-attachments, announcement-images,
-- owner-expense-receipts, site-media — mehr nicht). Der erste Upload waere mit
-- „Bucket not found" gescheitert, und zwar erst beim GAST auf einer
-- Kundenseite.
--
-- Warum ein EIGENER, PRIVATER Bucket und nicht `site-media`:
--
--   * `site-media` ist oeffentlich lesbar. Eine Datei, die ein Fremder
--     hochlaedt, waere damit fuer jeden abrufbar, der die Adresse kennt — und
--     Adressen von Bildern einer Website werden geteilt, indexiert und
--     weitergereicht.
--   * `site-media` ist der Bildbestand des BETRIEBS. Eine Gast-Datei taucht
--     dort in der Mediathek auf, zwischen den Fotos, die er selbst gewaehlt hat.
--
-- Zugriff gibt es deshalb ausschliesslich ueber die API: sie legt mit der
-- Service-Role ab und erzeugt zum Lesen kurzlebige, signierte Adressen
-- (`formular_anlagen.SIGNATUR_SEKUNDEN` = 300). Fuer anon/authenticated bleibt
-- der Bucket dicht — es braucht KEINE `storage.objects`-Policy, und genau das
-- ist die fail-closed-Fassung (Muster: 0126 task-photos, 0088 agency-contracts).
--
-- Die MIME-Liste ist der ZWEITE Riegel. Der erste ist die Magic-Byte-Pruefung
-- in `formular_anlagen.dateityp`: der vom Browser behauptete `content_type` ist
-- frei waehlbar und damit kein Schutz. Beide fuehren dieselben vier Typen —
-- kein ZIP, kein Office-Format (das sind ZIPs), kein SVG (das ist HTML mit
-- Skripten darin).
--
-- `file_size_limit` = 10 MB, dieselbe Zahl wie `formular_anlagen.MAX_BYTES` und
-- wie der CHECK auf `site_form_uploads.groesse` aus 0444. Drei Stellen, ein
-- Wert: die API weist frueh und mit einer verstaendlichen Meldung ab (413), der
-- Bucket und der CHECK sind die Rueckfallebenen fuer den Fall, dass jemand die
-- API-Grenze aendert und die anderen vergisst.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'site-form-uploads',
    'site-form-uploads',
    false,     -- privat: nur ueber die API signierte Adressen
    10485760,  -- 10 MB, wie MAX_BYTES und der CHECK aus 0444
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
