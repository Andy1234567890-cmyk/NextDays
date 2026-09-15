-- 0707 — Werbematerial des Partnerprogramms als DATEI, nicht nur als Adresse.
--
-- Bisher trug `affiliate_assets` ausschließlich eine fremde Adresse (`url`):
-- das Backoffice tippte einen YouTube-Link oder eine Bild-URL ein, die irgendwo
-- anders lag. Damit gab es kein Logo-Paket, kein Banner, kein Presse-PDF — alles,
-- was ein Partner HERUNTERLÄDT statt anzuklicken, hatte keinen Ort.
--
-- Dieser Bucket ist dieser Ort. Das Backoffice lädt PNG/SVG/JPEG/WebP, MP4/WebM
-- und PDF/ZIP/DOCX/XLSX/PPTX hoch, der Partner lädt sie im Dashboard herunter.
--
-- ÖFFENTLICH und nicht signiert — mit Begründung, weil das von `partner-deals`
-- (0598, privat) abweicht: Werbematerial ist zum Verbreiten da. Der Partner legt
-- das Banner in seinen Beitrag, den Newsletter, die Landingpage; eine signierte
-- Adresse mit Ablauf wäre dort nach zehn Minuten ein totes Bild. Der Schutz ist
-- derselbe wie beim Baukasten-Bucket `site-media`: der Pfad enthält einen
-- 16-Byte-Zufallstoken und ist nicht ratbar. Personenbezug gibt es hier keinen —
-- was im Bucket liegt, hat das Backoffice bewusst zum Weitergeben gelegt.
--
-- Die MIME-Liste ist der ZWEITE Riegel, nicht der erste. Der erste ist die
-- Magic-Byte-Prüfung in `affiliates/material_dateien.py` (Wurzel 8): der vom
-- Browser gemeldete `content_type` ist eine Behauptung. SVG ist erlaubt, weil
-- Logos als Vektor geliefert werden — es wird VOR dem Ablegen mit derselben
-- nh3-Allowlist gesäubert wie die Firmenlogos (`<script>`, `foreignObject`,
-- Event-Handler raus), sonst wäre es in einem öffentlichen Bucket Stored-XSS.
--
-- 25 MB = `MAX_UPLOAD_BYTES` aus `core/uploads.py`, die Transportgrenze des
-- Multipart-Parsers. Ein höherer Bucket-Wert wäre eine Zusage, die der Upload
-- nicht einlösen kann. Längere Videos bleiben deshalb der Weg über `url`
-- (YouTube/Vimeo), wie bisher.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'affiliate-material',
    'affiliate-material',
    true,      -- öffentlich: der Partner bettet das Banner in seinen Beitrag ein
    26214400,  -- 25 MB, wie MAX_UPLOAD_BYTES
    array[
        'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
        'video/mp4', 'video/webm',
        'application/pdf', 'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Schreiben in den Bucket darf NUR die service_role (Wurzel 6). Ein öffentlicher
-- Bucket ist öffentlich zum LESEN; ohne diese Feststellung liest man „public"
-- leicht als „jeder darf hochladen". `storage.objects` hat RLS an und ohne
-- passende Policy für anon/authenticated ist Schreiben zu, also ist hier nichts
-- zu tun — und genau das steht hier, damit die nächste Migration es nicht
-- „nachholt".

-- --------------------------------------------------------------------------
-- Datei-Spalten an `affiliate_assets`
-- --------------------------------------------------------------------------
-- `storage_path` ist der GEGENZUSTAND (Wurzel 1): ohne ihn kennt das Löschen
-- der Zeile die Datei nicht mehr, und im Bucket bleibt eine Waise liegen, die
-- niemand findet. Er ist der Pfad IM Bucket, nicht die Adresse — die steht
-- weiter in `url`, weil die Anzeige beide Fälle (eigene Datei, fremder Link)
-- gleich behandelt.
alter table public.affiliate_assets
    add column if not exists storage_path text,
    add column if not exists filename     text,
    add column if not exists mime         text,
    add column if not exists bytes        bigint;

comment on column public.affiliate_assets.storage_path is
    'Pfad im Bucket affiliate-material. NULL = fremde Adresse (url), keine eigene Datei.';
comment on column public.affiliate_assets.filename is
    'Original-Dateiname, reine ANZEIGE und Name beim Download. Der echte Pfad ist der Zufallstoken.';

-- `kind` bekommt 'file': ein Presse-PDF oder ein ZIP mit dem Logo-Paket ist
-- weder Bild noch Video noch Link. Die vier alten Werte bleiben unverändert —
-- der Check wird ersetzt, nicht die Spalte.
alter table public.affiliate_assets
    drop constraint if exists affiliate_assets_kind_check;

alter table public.affiliate_assets
    add constraint affiliate_assets_kind_check
    check (kind in ('video', 'image', 'text', 'link', 'file'));

-- Eine Zeile mit Datei MUSS eine Adresse haben — sie wird beim Hochladen aus
-- dem Pfad gebildet. Andersherum darf eine Adresse ohne Datei stehen (der alte
-- Link-Fall). Fail-closed statt einer Zeile, die im Dashboard als leere Karte
-- erscheint (Wurzel 5).
alter table public.affiliate_assets
    drop constraint if exists affiliate_assets_datei_hat_adresse;

alter table public.affiliate_assets
    add constraint affiliate_assets_datei_hat_adresse
    check (storage_path is null or url is not null);
