-- Chat für ANONYME Website-Besucher (Marketing-Seite) im vorhandenen
-- Support-Modell.
--
-- Ausgangslage: support_tickets kennt genau zwei Melder-Welten (0204) —
-- Betriebs-Nutzer (auth.users) und Plattform-Gast (portal_guests). Ein
-- Interessent auf mynextdays.com ist WEDER das eine noch das andere: er hat
-- keinen Account und soll für eine Frage auch keinen anlegen müssen. Genau so
-- lösen es Intercom, Crisp und Chatwoot: der anonyme Besucher ist ein eigener
-- Melder-Typ („contact"/„visitor") mit Kontaktdaten am Ticket, KEIN Nutzerkonto.
--
-- Bewusst KEINE zweite Tabelle: Verlauf, Zuweisung, Status, Ungelesen-Zähler
-- und die Backoffice-Ansicht existieren bereits — ein Lead-Chat daneben würde
-- alles doppeln (dieselbe Begründung wie bei 0236).
--
-- Zugriff ohne Login: das Widget bekommt beim Eröffnen ein Zufallstoken, in der
-- DB liegt nur dessen SHA-256. Das Token ist der einzige Schlüssel zum eigenen
-- Verlauf — deshalb nie im Klartext speichern und serverseitig byteweise
-- vergleichen (core.security.secrets_match).
--
-- Wurzel 6: an den Grants ändert sich NICHTS. support_tickets/support_messages
-- bleiben für anon und authenticated vollständig gesperrt (0204/0205); der
-- Besucher spricht ausschließlich über die FastAPI-Routen unter
-- /api/v1/support/public, nie direkt mit PostgREST oder Realtime.

alter table public.support_tickets
    -- Kontaktdaten des anonymen Melders. Nur gesetzt, wenn das Ticket aus dem
    -- Website-Widget stammt; für eingeloggte Melder bleiben sie leer (deren
    -- Daten stehen an users bzw. portal_guests).
    add column if not exists reporter_name text,
    add column if not exists reporter_email text,
    add column if not exists reporter_phone text,
    -- SHA-256 des Besucher-Tokens (hex). Nie das Token selbst.
    add column if not exists visitor_token_hash text;

-- Ein Token gehört zu genau einem Ticket.
create unique index if not exists support_tickets_visitor_token_uq
    on public.support_tickets (visitor_token_hash)
    where visitor_token_hash is not null;

-- Melder-Check erweitern: GENAU EINE der drei Welten.
-- 'visitor' ist daran erkennbar, dass ein Token-Hash gesetzt ist — ohne Token
-- gäbe es keinen Weg, den Verlauf je wieder zu lesen, das Ticket wäre eine
-- Sackgasse.
alter table public.support_tickets
    drop constraint if exists support_tickets_genau_ein_melder;

alter table public.support_tickets
    add constraint support_tickets_genau_ein_melder check (
        (reporter_user_id is not null
             and reporter_guest_id is null
             and visitor_token_hash is null)
        or (reporter_user_id is null
             and reporter_guest_id is not null
             and visitor_token_hash is null)
        or (reporter_user_id is null
             and reporter_guest_id is null
             and visitor_token_hash is not null)
    );

-- Herkunft: 'form' (Formular), 'chat' (Dashboard-Widget), neu 'web' (Website).
-- Getrennt vom Dashboard-Chat, weil das Backoffice diese Konversationen anders
-- behandelt: es ist ein Interessent ohne Konto, kein zahlender Betrieb.
alter table public.support_tickets
    drop constraint if exists support_tickets_source_check;

alter table public.support_tickets
    add constraint support_tickets_source_check
    check (source in ('form', 'chat', 'web'));

comment on column public.support_tickets.visitor_token_hash is
    'SHA-256 des Besucher-Tokens (Website-Widget). Klartext-Token existiert nur '
    'im Browser des Besuchers; Vergleich serverseitig byteweise.';
comment on column public.support_tickets.reporter_email is
    'Kontakt-E-Mail eines anonymen Melders (Website-Widget). Bei eingeloggten '
    'Meldern leer — deren Adresse steht an users/portal_guests.';
