-- =========================================================================
-- 0362 — Nachrichten in mehreren Sprachen: Betreff + Sprachfassungen für
--        Vorlagen (message_template) und Automail-Regeln (message_automation)
-- =========================================================================
-- ANLASS (11.08.2026, Gleichzug mit Lodgify, dort live abgelesen): Der Betrieb
-- pflegt seine geplanten Nachrichten und Schnellantworten JE SPRACHE. Die Maske
-- „Geplante Nachricht erstellen" hat dafür Sprach-Reiter (beim Beta-Betrieb
-- Dänisch · Deutsch · Englisch), darunter je Sprache einen eigenen BETREFF und
-- einen eigenen Inhalt; welche Sprachen es überhaupt gibt, verwaltet ein eigener
-- Einstieg („Sprachen verwalten") mit genau einer Standardsprache.
--
-- Bei uns gab es beides nicht: `message_template` und `message_automation`
-- führen live GENAU EINEN Text (`body`/`body_html` bzw. `message`) und keinen
-- Betreff. Ein dänischer Gast und ein deutscher Gast bekamen zwangsläufig
-- denselben Wortlaut — obwohl `{{guest_language}}` die Sprache des Gastes längst
-- kennt (sie steht als `customer.language` an der Buchung und wird in der
-- Gästekarte angezeigt).
--
-- ============================================================================
-- DAS MODELL: GRUNDFASSUNG + SPRACHFASSUNGEN (bewusst kein Sprach-Backfill)
-- ============================================================================
-- Die vorhandenen Spalten bleiben, was sie sind, und heißen ab jetzt
-- GRUNDFASSUNG: der Text OHNE Sprachangabe. Daneben stehen beliebig viele
-- SPRACHFASSUNGEN in eigenen Tabellen (`lang` + Betreff + Inhalt).
--
-- Beim Versand wird in dieser Reihenfolge gewählt:
--   1. Sprachfassung in der Sprache des Gastes,
--   2. Sprachfassung in der Standardsprache des Betriebs,
--   3. Grundfassung.
--
-- WARUM DER ALTBESTAND NICHT EINER SPRACHE ZUGESCHRIEBEN WIRD (Wurzel 4):
-- Niemand hat die Sprache der 17 Bestandsvorlagen des Beta-Betriebs jemals
-- erfasst, und sie ist auch nicht ableitbar — mehrere davon sind dänisch, einige
-- deutsch, eine englisch, und `tenants.default_language` ist live bei ALLEN
-- Betrieben leer. Ein `insert ... lang = 'de'` wäre also nicht eine Migration,
-- sondern eine Behauptung: hinterher wäre nicht mehr unterscheidbar, ob ein
-- Betrieb diesen Text als deutsche Fassung GEPFLEGT oder eine Migration ihn dazu
-- ERKLÄRT hat. Ein dänischer Gast bekäme dann die „deutsche" Fassung in
-- Wirklichkeit auf Dänisch — und für Deutsche gälte sie als vorhanden, sodass
-- niemand die fehlende deutsche Fassung je bemerkt.
--
-- Deshalb: kein Backfill, keine Zeile wird angefasst. Ohne gepflegte
-- Sprachfassung verhält sich der Versand exakt wie heute (Grundfassung), und
-- jede Sprachfassung, die dasteht, ist eine, die jemand geschrieben hat.
--
-- WARUM `tenant_message_language` ebenfalls LEER startet: dieselbe Regel. Eine
-- Standardsprache zu erfinden, entscheidet stillschweigend, welcher Wortlaut
-- Millionen Gäste erreicht. Der Betrieb wählt sie in „Sprachen verwalten"; bis
-- dahin zeigt die Oberfläche keine Reiter und pflegt nur die Grundfassung.
--
-- ============================================================================
-- BETREFF: gespeichert, aber (noch) ohne Versandweg — und das steht hier
-- ============================================================================
-- Der Betreff gilt nur für E-MAIL. Unser Automail-Versand läuft heute
-- ausschließlich über den Gast-Chat der Portale (`send_message` → Channex), und
-- der überträgt reinen Text ohne Betreff. Die Spalte ist also Vorarbeit für den
-- E-Mail-Versand (eigener Auftrag, Mailcow) und wird bis dahin von KEINEM
-- Versandpfad gelesen. Sie ist mit Absicht schon hier: der Betrieb pflegt seine
-- Texte je Sprache genau einmal, nicht zweimal.
-- Die Oberfläche schreibt am Feld dieselbe Wahrheit dazu, die Lodgify dort
-- schreibt („gilt nur für E-Mails") — kein Versprechen, das der Versand nicht
-- hält (Wurzel 4).
--
-- ============================================================================
-- SICHERHEIT (Wurzel 6) — Nachrichteninhalte sind sensibel
-- ============================================================================
-- `message_template` und `message_automation` hat 0337 vollständig vom
-- DB-Direktpfad genommen (revoke select/insert/update/delete für anon UND
-- authenticated + restriktive Policies). Die neuen Tabellen tragen DENSELBEN
-- Inhalt (Text, der an den Gast hinausgeht, samt Türcode-/Bankdaten-Platzhaltern
-- im Klartext) und bekommen deshalb von Anfang an denselben Zustand:
--   (a) `revoke select, insert, update, delete ... from anon, authenticated` —
--       alle vier Rechte, damit der Entzug den ENDZUSTAND beschreibt,
--   (b) RESTRICTIVE `for all`-Guard auf den Mandanten (nicht `for select`,
--       sonst bliebe der Schreibpfad tenant-weit offen),
--   (c) KEIN Eintrag in die Publikation `supabase_realtime` — gelesen wird
--       ausschließlich über die FastAPI (service_role, rolbypassrls = t). Ein
--       Abo darauf wäre nach dem Entzug ohnehin eine stumme Attrappe.
-- Gegenprobe (eingeloggter cleaner mit anon-Key):
--   curl -H "apikey: <anon>" -H "Authorization: Bearer <cleaner-JWT>" \
--        "$SUPABASE_URL/rest/v1/message_template_text?select=*"
--   -> permission denied (lesen UND schreiben).
--
-- `tenant_message_language` trägt nur Sprachcodes, also kein Personen-, Finanz-
-- oder Nachrichtendatum. Sie wird trotzdem geschlossen: geschrieben wird sie
-- ausschließlich vom Dienst (die Standardsprache entscheidet, welcher Wortlaut
-- an Gäste geht — das ist keine Einstellung, die ein beliebiger eingeloggter
-- Zugang am FastAPI-Layer vorbei umstellen darf), und gelesen wird sie mit den
-- Vorlagen zusammen über die API.
--
-- Alt/Neu-Gegenzustand (Wurzel 1): additiv. Zwei neue Spalten mit Default '',
-- drei neue Tabellen, keine Datenzeile wird geändert, keine Spalte entfernt.
-- Rückbau wäre `drop table` + `drop column`.
-- =========================================================================


-- =========================================================================
-- 1. Betreff an der Grundfassung
-- =========================================================================
-- Leer heißt „kein Betreff gepflegt" — nicht „Betreff ist leer". Der E-Mail-
-- Versand (später) muss daran scheitern können, statt eine Mail ohne Betreff
-- oder mit erfundenem Betreff zu senden.
alter table public.message_template
    add column if not exists subject text not null default '';
alter table public.message_automation
    add column if not exists subject text not null default '';

comment on column public.message_template.subject is
    'Betreff der GRUNDFASSUNG. Gilt nur fuer E-Mail: der Gast-Chat der Portale '
    'uebertraegt keinen Betreff. Leer = nicht gepflegt (kein Ersatzwert).';
comment on column public.message_automation.subject is
    'Betreff der GRUNDFASSUNG dieser Regel. Gilt nur fuer E-Mail. '
    'Leer = nicht gepflegt.';


-- =========================================================================
-- 2. Sprachen des Betriebs
-- =========================================================================
-- Eine Zeile je Sprache, die der Betrieb pflegen WILL. `is_default` markiert
-- genau eine davon (partieller Unique-Index) — sie ist der Rückfall, wenn die
-- Sprache des Gastes keine Fassung hat.
--
-- `code` ist ISO-639-1, zweistellig, klein. Die erlaubte Liste steht an EINER
-- Stelle im Code (`core.languages`, 31 Sprachen) und wird dort geprueft; ein
-- CHECK auf ein Enum hier hiesse, jede neue Sprache braucht eine Migration.
-- Das Format wird trotzdem erzwungen, sonst landet „de-DE" oder „Deutsch" in
-- der Spalte und der Vergleich mit der Gastsprache trifft nie.
create table if not exists public.tenant_message_language (
    tenant_id   uuid    not null references public.tenants (id) on delete cascade,
    code        text    not null check (code ~ '^[a-z]{2}$'),
    is_default  boolean not null default false,
    created_at  timestamptz not null default now(),
    primary key (tenant_id, code)
);

-- Genau EINE Standardsprache je Betrieb. Ohne diesen Index kann eine zweite
-- „Standard"-Zeile entstehen (Doppelklick, Retry — Wurzel 2), und dann
-- entscheidet die Sortierung, welcher Wortlaut an den Gast geht.
create unique index if not exists tenant_message_language_default_idx
    on public.tenant_message_language (tenant_id)
    where is_default;

comment on table public.tenant_message_language is
    'Sprachen, in denen ein Betrieb seine Vorlagen und Automail-Regeln pflegt. '
    'Genau eine Zeile je Betrieb traegt is_default = true; sie ist der Rueckfall, '
    'wenn die Sprache des Gastes keine Fassung hat. Startet bewusst leer — eine '
    'erfundene Standardsprache entscheidet still, welcher Wortlaut an Gaeste '
    'geht (Wurzel 4).';


-- =========================================================================
-- 3. Sprachfassungen der Vorlagen
-- =========================================================================
-- `tenant_id` steht hier redundant zur Vorlage — absichtlich: die restriktive
-- Policy und JEDER Zugriff scopen darauf, ohne erst joinen zu muessen (Wurzel 3:
-- Load und Scope nicht trennen). Ein Join in der Policy waere zudem ein
-- Fremdzugriff, den RLS auf der Elterntabelle erneut beurteilen muss.
--
-- Rollen wie in 0350: `body_html` ist das Autorenformat (Editor, nh3-gesaeubert),
-- `body` die VERSANDQUELLE (Klartext, serverseitig aus body_html abgeleitet —
-- die Portale uebertragen im Gast-Chat nur Text). Der Client schickt nie `body`.
create table if not exists public.message_template_text (
    template_id uuid not null
        references public.message_template (id) on delete cascade,
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    lang        text not null check (lang ~ '^[a-z]{2}$'),
    subject     text not null default '',
    body        text not null default '',
    body_html   text not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    primary key (template_id, lang)
);
create index if not exists message_template_text_tenant_idx
    on public.message_template_text (tenant_id);

comment on table public.message_template_text is
    'Sprachfassungen einer Vorlage. Fehlt die Fassung fuer die Gastsprache, '
    'greift die Standardsprache des Betriebs, danach die Grundfassung in '
    'message_template. body wird serverseitig aus body_html abgeleitet und nie '
    'vom Client uebernommen (Wurzel 3).';


-- =========================================================================
-- 4. Sprachfassungen der Automail-Regeln
-- =========================================================================
-- Nur Klartext (`message`), kein `message_html` — wie die Grundfassung
-- `message_automation.message`. Diese Regel-Texte gehen an genau derselben
-- Stelle in den Versand (`planung._automation_body`) und werden dort als
-- KLARTEXT verschickt; eine HTML-Spalte hier hiesse, das Markup steht woertlich
-- in der Nachricht beim Gast. Wer Formatierung will, verknuepft eine Vorlage.
create table if not exists public.message_automation_text (
    automation_id uuid not null
        references public.message_automation (id) on delete cascade,
    tenant_id     uuid not null references public.tenants (id) on delete cascade,
    lang          text not null check (lang ~ '^[a-z]{2}$'),
    subject       text not null default '',
    message       text not null default '',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    primary key (automation_id, lang)
);
create index if not exists message_automation_text_tenant_idx
    on public.message_automation_text (tenant_id);

comment on table public.message_automation_text is
    'Sprachfassungen einer Automail-Regel (Freitext ohne Vorlage). Reiner '
    'Klartext, weil der Gast-Chat der Portale kein HTML uebertraegt. Fehlt die '
    'Fassung fuer die Gastsprache, greift die Standardsprache, danach die '
    'Grundfassung message_automation.message.';


-- =========================================================================
-- 5. updated_at
-- =========================================================================
drop trigger if exists trg_message_template_text_updated
    on public.message_template_text;
create trigger trg_message_template_text_updated
    before update on public.message_template_text
    for each row execute function public.set_updated_at();

drop trigger if exists trg_message_automation_text_updated
    on public.message_automation_text;
create trigger trg_message_automation_text_updated
    before update on public.message_automation_text
    for each row execute function public.set_updated_at();


-- =========================================================================
-- 6. RLS + DB-Direktpfad schliessen (Wurzel 6)
-- =========================================================================
alter table public.tenant_message_language   enable row level security;
alter table public.message_template_text     enable row level security;
alter table public.message_automation_text   enable row level security;

revoke select, insert, update, delete
    on public.tenant_message_language from anon, authenticated;
revoke select, insert, update, delete
    on public.message_template_text from anon, authenticated;
revoke select, insert, update, delete
    on public.message_automation_text from anon, authenticated;

-- Permissive Mandanten-Policy (die Grundregel) …
drop policy if exists tenant_message_language_tenant
    on public.tenant_message_language;
create policy tenant_message_language_tenant on public.tenant_message_language
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists message_template_text_tenant on public.message_template_text;
create policy message_template_text_tenant on public.message_template_text
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists message_automation_text_tenant
    on public.message_automation_text;
create policy message_automation_text_tenant on public.message_automation_text
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- … und der restriktive Riegel darueber, der auch fuer den SCHREIB-Pfad gilt.
drop policy if exists tenant_message_language_restrict
    on public.tenant_message_language;
create policy tenant_message_language_restrict on public.tenant_message_language
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists message_template_text_restrict on public.message_template_text;
create policy message_template_text_restrict on public.message_template_text
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists message_automation_text_restrict
    on public.message_automation_text;
create policy message_automation_text_restrict on public.message_automation_text
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
