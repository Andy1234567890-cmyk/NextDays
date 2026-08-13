-- MCP-Zugriffslog: welcher Connector hat wann welche Daten geholt.
--
-- WARUM: Ohne diesen Log kann der Betrieb zwei Pflichten nicht erfüllen, die
-- ihn als Verantwortlichen treffen:
--   · Art. 15 DSGVO — ein Gast fragt „wer hat meine Daten bekommen?". Ohne
--     Aufzeichnung ist die Antwort „wir wissen es nicht", und das ist keine
--     zulässige Auskunft.
--   · Art. 5 Abs. 2 DSGVO — Rechenschaftspflicht. Die Verbindung IST die
--     Weisung zur Drittlandübermittlung (Art. 28 Abs. 3 lit. a); wer sie
--     erteilt hat und was daraufhin floss, muss belegbar sein.
-- Uns selbst dient er als Nachweis nach Art. 28 Abs. 3 lit. h.
--
-- Bewusst OHNE Inhalte: gespeichert wird, WAS abgerufen wurde (Werkzeug,
-- Objekt-/Buchungs-ID, Zeilenzahl), nie die Gastdaten selbst. Ein Log, der die
-- Nachrichtentexte ein zweites Mal ablegt, vergrössert genau das Risiko, das
-- er dokumentieren soll.

create table if not exists public.mcp_access_log (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  -- Wer die Verbindung erteilt hat. ON DELETE SET NULL: der Log überlebt das
  -- Löschen des Kontos, sonst verschwände der Nachweis mit dem Mitarbeiter.
  user_id      uuid references public.users(id) on delete set null,
  client_id    text not null,
  werkzeug     text not null,
  -- Was angefragt wurde, ohne die Antwort: Objekt-/Buchungs-/Thread-ID.
  ziel_id      text,
  -- Wie viele Datensätze herausgingen — macht einen Massenabruf sichtbar.
  anzahl       integer not null default 0,
  -- Welche Scopes das Token trug (mcp:read, ggf. mcp:freetext).
  scopes       text not null default '',
  erfolg       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists mcp_access_log_tenant_zeit_idx
  on public.mcp_access_log (tenant_id, created_at desc);

alter table public.mcp_access_log enable row level security;

-- Wurzel 6: RLS + tenant-Policy allein genügt nicht. Der Log dokumentiert, wer
-- Gastdaten abgerufen hat — er darf nicht über den anon-Key manipulierbar
-- sein, sonst ist der Nachweis wertlos. Nur der Server (service_role) schreibt.
revoke insert, update, delete on public.mcp_access_log from anon, authenticated;

drop policy if exists mcp_access_log_tenant on public.mcp_access_log;
create policy mcp_access_log_tenant on public.mcp_access_log
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Restriktiv: nur Rollen, die den Betrieb vertreten, sehen den Log. Ein
-- cleaner soll nicht nachlesen können, welche Buchungen abgefragt wurden.
drop policy if exists mcp_access_log_nur_leitung on public.mcp_access_log;
create policy mcp_access_log_nur_leitung on public.mcp_access_log
  as restrictive
  for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.tenant_id = mcp_access_log.tenant_id
        and u.role in ('admin', 'co_admin')
    )
  );

comment on table public.mcp_access_log is
  'Zugriffe externer Connectors (MCP). Ohne Inhalte — nur Werkzeug, Ziel-ID und Umfang.';
