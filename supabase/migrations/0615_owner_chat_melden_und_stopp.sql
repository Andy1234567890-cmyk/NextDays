-- 0615 — Melden und Chat-Stopp im Eigentümer-Chat (Google UGC-Policy).
--
-- WARUM DAS SEIN MUSS, wörtlich aus Googles „User Generated Content"-Richtlinie
-- (geprüft am 09.09.2026, nicht aus dem Gedächtnis):
--
--   „Apps featuring UGC that identify a specified set of users through means
--    such as user verification or offline registration (for example, apps
--    exclusively used within a specific school or company, etc.) must provide
--    in-app functionality to report content and users."
--
--   „UGC features that enable 1:1 user interaction with specific users (for
--    example, direct messaging, tagging, mentioning, etc.) must provide an
--    in-app functionality for blocking users."
--
-- Beide Sätze treffen den Eigentümer-Chat aus 0611: ein geschlossener,
-- eingeladener Nutzerkreis, und darin Direktnachrichten zwischen genau zwei
-- Seiten. Eine Ausnahme für geschäftliche Kommunikation nennt die Richtlinie
-- nicht. Ohne diese zwei Wege ist die App bei Google angreifbar — und zwar
-- nicht theoretisch: die Prüfung fragt nach beidem.
--
-- WAS „BLOCKIEREN" HIER HEISST — und warum es nicht wörtlich geht:
-- Die Gegenseite ist die VERWALTUNG der eigenen Objekte. Sie wegzublocken
-- hieße, den einzigen Draht zu dem Betrieb zu kappen, dem das Haus anvertraut
-- ist; ein Knopf „Verwaltung blockieren" wäre eine Zusage, die das Produkt
-- nicht halten kann. Was der Nutzer wirklich braucht, ist ein Weg HERAUS aus
-- dem Gespräch: `owner_chat_stopps` beendet den Faden FÜR IHN. Er schreibt
-- nicht mehr, bekommt keine Meldungen mehr, und die Verwaltung sieht, dass sie
-- auf keine Antwort warten muss. Umkehrbar, weil ein Streit endet (Wurzel 1:
-- der Gegenzustand gehört mitgebaut, nicht nachgereicht).
--
-- WAS EINE MELDUNG ENTHALTEN KANN — und was nicht: den TEXT nicht. Der Chat ist
-- Ende-zu-Ende verschlüsselt (ADR-0029); der Server hat Chiffretext. Die
-- Meldung trägt deshalb die Nachrichten-ID, den Grund aus einer festen Liste
-- und den Freitext des MELDERS. Wer hier je einen Auszug der Nachricht ablegen
-- will, muss vorher die Verschlüsselung aufheben — dann bitte ADR-0029 ändern,
-- nicht diese Tabelle.

-- == Meldungen ==============================================================
create table if not exists public.owner_chat_meldungen (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    thread_id uuid not null references public.owner_threads (id) on delete cascade,
    -- Die gemeldete Nachricht. NULL = die Meldung gilt dem Gespräch bzw. der
    -- Gegenseite insgesamt, nicht einer einzelnen Blase. Beides muss gehen:
    -- Google verlangt „report content AND users".
    message_id uuid references public.owner_messages (id) on delete set null,
    -- Wer gemeldet hat. `set null`, weil eine Meldung die Löschung ihres
    -- Melders überdauern soll — sonst verschwindet die Beschwerde mit dem
    -- Konto, das sich beschwert hat.
    melder_user_id uuid references public.users (id) on delete set null,
    melder_seite text not null check (melder_seite in ('owner', 'agency')),
    -- Feste Liste statt Freitext-Kategorie: eine Auswertung über getippte
    -- Gründe gibt es nicht, und die Prüfung braucht die Einordnung.
    grund text not null check (
        grund in ('beleidigung', 'betrug', 'unerwuenscht', 'anderes')
    ),
    freitext text,
    status text not null default 'offen' check (
        status in ('offen', 'geprueft', 'verworfen')
    ),
    bearbeitet_von uuid references public.users (id) on delete set null,
    bearbeitet_am timestamptz,
    notiz text,
    created_at timestamptz not null default now(),
    -- Begründung ist bei einer Entscheidung Pflicht: eine als „geprüft"
    -- abgelegte Meldung ohne Notiz ist von einer vergessenen nicht zu
    -- unterscheiden.
    constraint owner_chat_meldungen_entscheidung_begruendet check (
        status = 'offen' or (notiz is not null and length(trim(notiz)) > 0)
    )
);

create index if not exists owner_chat_meldungen_offen_idx
    on public.owner_chat_meldungen (tenant_id, created_at desc)
    where status = 'offen';

-- Wurzel 2: real kommt alles doppelt. Ein zweiter Druck auf „Melden" darf
-- keine zweite offene Meldung derselben Nachricht durch dieselbe Person
-- anlegen. Zwei Teil-UNIQUEs, weil es zwei Formen gibt (Nachricht und Faden).
create unique index if not exists owner_chat_meldungen_nachricht_uidx
    on public.owner_chat_meldungen (message_id, melder_user_id)
    where message_id is not null and status = 'offen';

create unique index if not exists owner_chat_meldungen_faden_uidx
    on public.owner_chat_meldungen (thread_id, melder_user_id)
    where message_id is null and status = 'offen';

-- == Chat-Stopp =============================================================
-- Je MENSCH und Faden, nicht je Faden: an einem Objekt hängen seit 0389 auch
-- Familienzugänge, und dass die Tochter das Gespräch für sich beendet, darf
-- den Vater nicht abschneiden.
create table if not exists public.owner_chat_stopps (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    thread_id uuid not null references public.owner_threads (id) on delete cascade,
    user_id uuid not null references public.users (id) on delete cascade,
    grund text,
    gestoppt_am timestamptz not null default now(),
    unique (thread_id, user_id)
);

create index if not exists owner_chat_stopps_thread_idx
    on public.owner_chat_stopps (thread_id);

-- == Wurzel 6 — der DB-Direktpfad ===========================================
-- Beide Tabellen tragen Beschwerden über namentlich genannte Menschen. Ein
-- eingeloggter cleaner mit dem öffentlichen anon-Key läse per
-- `curl /rest/v1/owner_chat_meldungen` sonst tenant-weit mit, wer sich über
-- wen beschwert hat — und könnte eine Meldung durch `delete` verschwinden
-- lassen. `enable rls` + Tenant-Policy allein deckt genau das NICHT ab.
--
-- Also fail-closed wie bei 0611: keine Policy für anon/authenticated, alle
-- Rechte entzogen. Gelesen und geschrieben wird ausschließlich über den Server
-- (service_role), der den Scope prüft (Wurzel 3/9).
--
-- Folge fürs Frontend, bewusst: ein Realtime-Abo auf diese Tabellen wäre eine
-- stumme Attrappe. Die Oberfläche lädt den Stand mit dem Verlauf.
alter table public.owner_chat_meldungen enable row level security;
alter table public.owner_chat_stopps enable row level security;

revoke all on public.owner_chat_meldungen from anon, authenticated;
revoke all on public.owner_chat_stopps from anon, authenticated;

comment on table public.owner_chat_meldungen is
    'Meldungen aus dem Eigentümer-Chat (0615, Google UGC-Policy). Trägt NIE '
    'den Nachrichtentext — der Chat ist Ende-zu-Ende verschlüsselt (ADR-0029), '
    'der Server hat nur Chiffretext. Wurzel 6: kein Direktpfad.';
comment on table public.owner_chat_stopps is
    'Wer den Chat-Faden für SICH beendet hat (0615). Das Gegenstück zum '
    '„Blockieren", das Google für 1:1-Nachrichten verlangt — die Verwaltung '
    'wegzublocken wäre fachlich unmöglich, aus dem Gespräch auszusteigen '
    'nicht. Umkehrbar. Wurzel 6: kein Direktpfad.';
