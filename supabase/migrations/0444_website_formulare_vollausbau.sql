-- 0444 — Formulare: Datei-Anlage, Bestaetigungsmail, Weiterleitung, Webhook
--
-- Der Abstand zu Hostaway war hier am groessten (docs/HOSTAWAY-BWP-LUECKEN.md,
-- Abschnitt 6). Was dazukommt und was bewusst NICHT:
--
-- == 1) Datei-Anlage ======================================================
--
-- Hostaway erlaubt eine Datei je Feld, hoechstens 10 MB, und laesst die
-- Einsendung nach 90 Tagen verfallen. Beide Zahlen uebernehmen wir, und zwar
-- nicht aus Bequemlichkeit: 10 MB ist gross genug fuer den Grundriss, den ein
-- Eigentuemer schickt, und klein genug, dass niemand den Speicher als Ablage
-- benutzt. Die 90 Tage sind der Grund, warum das ueberhaupt vertretbar ist —
-- eine Datei von einem Fremden, die ewig liegt, ist eine Haftung.
--
-- ES IST DER EINZIGE WEG, AUF DEM EIN FREMDER ETWAS IN UNSEREN SPEICHER LEGT.
-- Deshalb ein EIGENER, PRIVATER Bucket und nicht der Medien-Bucket des
-- Betriebs: eine Gast-Datei hat in der Mediathek nichts verloren, und der
-- Medien-Bucket ist oeffentlich lesbar. Der Zugriff laeuft ausschliesslich
-- ueber signierte URLs, die die API auf Anfrage erzeugt.
--
-- == 2) Bestaetigungsmail an den Absender ================================
--
-- Standardmaessig AN, wie bei Hostaway. Ein Gast, der ein Formular abschickt
-- und nichts hoert, schickt es noch einmal — oder ruft an.
--
-- == 3) Weiterleitung nach dem Absenden ==================================
--
-- Auf eine eigene Seite („Danke") oder eine fremde Adresse. Ist sie gesetzt,
-- entfaellt die Danke-Meldung: zwei Bestaetigungen hintereinander sind eine zu
-- viel.
--
-- == 4) Webhook ==========================================================
--
-- Ein POST je Einsendung. Wurzel 8: die Adresse liefert der KUNDE, und ein
-- ausgehender Aufruf auf eine nutzergelieferte URL ist ein SSRF-Vektor. Der
-- Versand laeuft deshalb ueber `core.ausgehende_url` (IP aufloesen, pruefen,
-- auf die geprueften IP pinnen, interne Netze blocken) — dieselbe Kette wie
-- beim iCal-Abruf.
--
-- WAS NICHT KOMMT: Google Sheets und Slack als eigene Anbindungen. Beide sind
-- ueber den Webhook erreichbar, und jede eigene Anbindung waere ein zweiter
-- Anmelde-Fluss, ein zweites Token und ein zweiter Ort, an dem etwas ablaeuft.

create table if not exists public.site_form_uploads (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null
                  references public.tenants (id) on delete cascade,
    -- Die Einsendung, zu der die Datei gehoert. `on delete cascade`: wird die
    -- Einsendung geloescht (Art. 17 DSGVO), muss die Datei mit — sie ist Teil
    -- derselben personenbezogenen Angabe.
    submission_id uuid not null
                  references public.site_form_submissions (id) on delete cascade,
    -- Der Feldname aus dem Formular, damit die Datei der richtigen Frage
    -- zugeordnet bleibt.
    feld          text not null,
    -- Wie die Datei beim Absender hiess. NUR zur Anzeige — gespeichert wird sie
    -- unter `pfad` mit einem erzeugten Namen. Ein Dateiname von einem Fremden
    -- gehoert nie in einen Pfad (`../`, Steuerzeichen, 4000 Zeichen).
    original_name text not null,
    pfad          text not null unique,
    groesse       integer not null,
    mime          text not null,
    created_at    timestamptz not null default now(),
    -- Wann die Datei verfaellt. Als SPALTE und nicht als Rechnung auf
    -- `created_at`: so kann eine einzelne Datei laenger behalten werden, wenn
    -- der Betrieb sie braucht, ohne dass die Regel fuer alle anderen kippt.
    verfaellt_am  timestamptz not null default (now() + interval '90 days'),

    constraint site_form_uploads_groesse check (
        groesse > 0 and groesse <= 10 * 1024 * 1024
    ),
    constraint site_form_uploads_feld_laenge check (
        char_length(feld) between 1 and 60
    )
);

create index if not exists site_form_uploads_submission_idx
    on public.site_form_uploads (submission_id);
-- Der Lesepfad des Aufraeumers: „was ist abgelaufen".
create index if not exists site_form_uploads_verfall_idx
    on public.site_form_uploads (verfaellt_am);

comment on table public.site_form_uploads is
    'Dateien aus Formular-Einsendungen. Von FREMDEN hochgeladen, deshalb '
    'privater Bucket, Groessengrenze und Verfallsdatum. Kein Grant fuer '
    'anon/authenticated — wie site_form_submissions.';

alter table public.site_form_uploads enable row level security;

drop policy if exists site_form_uploads_tenant on public.site_form_uploads;
create policy site_form_uploads_tenant on public.site_form_uploads
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6, wie bei den Einsendungen selbst (0436): NICHTS ueber den
-- Direktpfad, auch kein `select`. Die Zeilen zeigen, WER dem Betrieb was
-- geschickt hat.
revoke select, insert, update, delete
    on public.site_form_uploads from anon, authenticated;

drop policy if exists site_form_uploads_kein_direktpfad on public.site_form_uploads;
create policy site_form_uploads_kein_direktpfad
    on public.site_form_uploads
    as restrictive for all to anon, authenticated
    using (false) with check (false);

comment on policy site_form_uploads_kein_direktpfad on public.site_form_uploads is
    'Kein Zugriff ueber PostgREST/Realtime — auch nicht lesend. Dateien von '
    'Dritten; sie gehen ausschliesslich ueber die API an Rollen mit '
    'MANAGE_SITE_CONFIG, und auch dort nur als signierte, kurzlebige URL.';
