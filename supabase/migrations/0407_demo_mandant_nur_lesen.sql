-- Demo-Mandant: oeffentlich anmeldbar, aber nur lesend (0407).
--
-- WOZU: Die Marketing-Seite soll „Demo ansehen" anbieten und den Besucher in
-- die ECHTE Anwendung fuehren — nicht in einen eingefrorenen Schnappschuss.
-- Der Vergleich mit Storylane/Navattic/Reprise (docs/ANALYSE-storylane-technik.md)
-- hat gezeigt: kein Anbieter zeigt einem anonymen Besucher die laufende App,
-- weil keiner ein eigenes Backend hat. Wir haben eines, also koennen wir es —
-- unter genau einer Bedingung: der Zugang darf NICHTS aendern.
--
-- WARUM EIN FLAG AM MANDANTEN UND NICHT EINE NEUE ROLLE:
-- Eine sechste Rolle `demo` im Rollensystem waere die naheliegende Loesung und
-- die falsche. Gemessen am Bestand: von 536 schreibenden Routen tragen 201
-- einen Capability-Guard, 168 einen granularen — aber **76 haben nur
-- `get_current_user`**, also gar keine Rollenpruefung (darunter
-- `PATCH /auth/account/password` und `DELETE /auth/account/users/{id}`).
-- Eine Rolle mit leeren Schreibrechten haette diese 76 Routen NICHT erfasst;
-- ein Demo-Besucher haette das Passwort des Demo-Kontos aendern und damit die
-- Demo fuer alle anderen sperren koennen.
-- Das Flag am Mandanten traegt dagegen ein Riegel in `core.security`, der JEDE
-- nicht-lesende Methode ablehnt — unabhaengig davon, ob die Route einen Guard
-- hat. Eine Route, die kuenftig ohne Guard dazukommt, ist damit automatisch
-- mitgeschuetzt (das ist der Unterschied zwischen einer Liste, die gepflegt
-- werden muss, und einer Regel, die gilt).
--
-- WARUM AM MANDANTEN UND NICHT AM NUTZER:
-- Der Demo-Mandant hat heute einen Nutzer, kann aber mehrere bekommen (etwa
-- einen zweiten fuer die Rolle „Reinigungskraft", um die Rollen-Ansicht zu
-- zeigen). Am Mandanten gilt die Regel fuer alle, auch fuer spaeter angelegte.
--
-- KEINE NEUEN GRANTS (Wurzel 6): `public.tenants` bleibt fuer anon/
-- authenticated ohne Schreibrechte. Ein Demo-Besucher darf sein eigenes
-- Demo-Flag nicht entfernen koennen — gesetzt wird es ausschliesslich per
-- Migration bzw. service_role.

alter table public.tenants
    add column if not exists is_demo boolean not null default false;

comment on column public.tenants.is_demo is
    'Oeffentlich zugaenglicher Vorfuehr-Mandant. Der Riegel in '
    'core.security.get_current_user lehnt fuer Nutzer dieses Mandanten JEDE '
    'Anfrage ab, die nicht GET/HEAD/OPTIONS ist (405) — unabhaengig von Rolle '
    'und Route. Damit sind auch die schreibenden Routen ohne Rollen-Guard '
    'gedeckt. Nur per Migration/service_role setzbar (0407).';

-- Nordlicht ist der Vorfuehr-Mandant (scripts/demo/katalog.py: 8 Ferienobjekte,
-- 40 Gaeste, ~300 Buchungen — genug Bestand, dass Kalender und Posteingang
-- echt aussehen). Die ID ist deterministisch aus dem Seed-Skript
-- (uuid5 ueber "nextdays-demo:tenant:nordlicht"), steht also fest.
--
-- Seeblick (Hotel) bleibt bewusst OHNE Flag: es ist das Fotomodell fuer die
-- Marketing-Bilder und soll nicht oeffentlich anmeldbar sein. Ein zweiter
-- Vorfuehr-Mandant waere eine zweite Angriffsflaeche fuer denselben Nutzen.
update public.tenants
   set is_demo = true
 where id = '69d24767-2a93-565e-9c0c-b57b35938353';

-- Der Riegel fragt bei JEDER schreibenden Anfrage „ist dieser Mandant ein
-- Demo-Mandant?". Partieller Index, weil nur die eine Zeile gesucht wird —
-- der Normalfall (false) bleibt aus dem Index heraus.
create index if not exists tenants_demo_idx
    on public.tenants (id)
    where is_demo;

-- --------------------------------------------------------------------------
-- storybook_chat: Lesen auf den eigenen Mandanten begrenzen
-- --------------------------------------------------------------------------
--
-- BEFUND, der diese Aenderung ausloest: `storybook_chat` ist die EINZIGE
-- Tabelle, in die ein authentifizierter Nutzer per PostgREST-Direktpfad
-- (/rest/v1 mit JWT + oeffentlichem anon-Key) schreiben darf — 0337 hat dort
-- bewusst nur `update, delete` entzogen, `insert` blieb als einziger echter
-- Frontend-Schreibpfad stehen (storybook/components/docs/team-chat.tsx).
-- Die Lese-Policy aus 0337 lautet `using (auth.uid() is not null)`: JEDER
-- eingeloggte Nutzer liest den kompletten internen Team-Chat mit Klarnamen.
--
-- Solange sich nur Mitarbeiter anmelden konnten, war das vertretbar. Mit einem
-- OEFFENTLICH verteilten Demo-Login ist es das nicht mehr: jeder Besucher der
-- Marketing-Seite laese die internen Notizen und koennte hineinschreiben.
--
-- Die Tabelle hat keine `tenant_id` (0020) — nachzuruesten hiesse, den
-- Bestand zuzuordnen, den niemand mehr braucht. Stattdessen: der Zugriff
-- verlangt einen Mandanten, der KEIN Demo-Mandant ist. Das Storybook laeuft
-- ausschliesslich intern, der Kreis ist damit unveraendert; nur der
-- Demo-Besucher fliegt heraus.
-- Der Name aus 0337 ist `storybook_chat_read` (live gegengeprueft), nicht
-- `_select` — beide Namen werden verworfen, damit keine alte Policy daneben
-- stehen bleibt und weiterhin greift (eine permissive Policy genuegt, um
-- Zugriff zu gewaehren).
drop policy if exists storybook_chat_read on public.storybook_chat;
drop policy if exists storybook_chat_select on public.storybook_chat;
create policy storybook_chat_read on public.storybook_chat
    for select
    using (
        (select auth.uid()) is not null
        and not exists (
            select 1 from public.tenants t
             where t.id = public.current_tenant_id()
               and t.is_demo
        )
    );

drop policy if exists storybook_chat_insert on public.storybook_chat;
create policy storybook_chat_insert on public.storybook_chat
    for insert
    to authenticated
    with check (
        char_length(author) between 1 and 60
        and char_length(body) between 1 and 2000
        and not exists (
            select 1 from public.tenants t
             where t.id = public.current_tenant_id()
               and t.is_demo
        )
    );

comment on table public.storybook_chat is
    'Interner Team-Chat der Doku-Oberflaeche. Lesen und Schreiben nur fuer '
    'eingeloggte Nutzer, die NICHT im Demo-Mandanten sitzen (0407) — der '
    'Demo-Login ist oeffentlich, und hier stehen Klarnamen und interne Notizen.';
