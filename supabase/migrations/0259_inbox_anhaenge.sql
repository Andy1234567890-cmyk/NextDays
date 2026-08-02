-- 0259_inbox_anhaenge.sql — Anhänge im Posteingang
--
-- Bisher konnte an eine Gastnachricht nichts angehängt werden. Der häufigste
-- reale Anlass ist genau das: Anfahrtsskizze, Hausordnung, Rechnung, das PDF
-- mit dem Türcode.
--
-- Der Bucket ist PRIVAT (Muster 0126 task-photos): an einem Anhang kann ein
-- Türcode, ein Ausweis oder eine Rechnung hängen. Zugriff läuft ausschließlich
-- über das Backend (Service-Role lädt hoch und signiert befristete Download-
-- URLs). Für anon/authenticated bleibt der Bucket dicht — es gibt bewusst
-- KEINE storage.objects-Policy, damit ohne Backend-Signatur nichts geht.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'inbox-attachments',
    'inbox-attachments',
    false,
    10485760,  -- 10 MB: Channex nimmt Anhänge base64-kodiert entgegen
    array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'
    ]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.inbox_attachment (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    thread_id     uuid not null references public.channex_booking(id) on delete cascade,
    storage_path  text not null,
    filename      text not null,
    mime          text not null,
    size_bytes    integer not null,
    uploaded_by   uuid references public.users(id) on delete set null,
    -- Gesetzt, sobald der Anhang an den Kanal übergeben wurde. NULL heißt:
    -- liegt bei uns, ist beim Gast noch nicht angekommen.
    sent_at       timestamptz,
    -- Warum der Kanal ihn abgelehnt hat (Airbnb nimmt kein PDF, Booking.com
    -- weder PDF noch QR-Code). Der Grund gehört sichtbar an den Anhang, statt
    -- verschluckt zu werden (Wurzel 5).
    channel_error text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists inbox_attachment_thread_idx
    on public.inbox_attachment (thread_id, created_at);
create index if not exists inbox_attachment_tenant_idx
    on public.inbox_attachment (tenant_id);

drop trigger if exists trg_inbox_attachment_updated on public.inbox_attachment;
create trigger trg_inbox_attachment_updated
    before update on public.inbox_attachment
    for each row execute function public.set_updated_at();

alter table public.inbox_attachment enable row level security;

-- Wurzel 6: RLS allein reicht nicht. Der Datei-PFAD ist der Schlüssel zum
-- Bucket-Objekt; wer ihn lesen kann, umgeht die Signatur-Kontrolle nicht ganz,
-- aber der Weg über das Backend soll der einzige sein. Schreiben darf hier
-- ausschließlich der Server: ein Client, der Zeilen anlegt, könnte auf fremde
-- storage_path zeigen.
revoke all on public.inbox_attachment from anon, authenticated;

create policy inbox_attachment_tenant on public.inbox_attachment
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy inbox_attachment_kein_direktzugriff on public.inbox_attachment
    as restrictive for all
    using (false)
    with check (false);

comment on table public.inbox_attachment is
    'Anhänge einer Posteingang-Konversation. Datei im privaten Bucket '
    'inbox-attachments; Zugriff nur über das Backend (signierte URLs).';
