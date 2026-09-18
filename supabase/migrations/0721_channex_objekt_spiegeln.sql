-- 0721_channex_objekt_spiegeln.sql — Objekt UND Verknüpfung in EINER Transaktion
--
-- WARUM ES DIESE FUNKTION BRAUCHT (17./18.09.2026)
-- Der Tenant-Abgleich (reconcile_properties_for_tenant) legte ein aus Channex
-- gespiegeltes Objekt in DREI getrennten PostgREST-Aufrufen an: properties-
-- Insert, property_units-Insert, channex_property_map-Schreiben. Drei
-- Aufrufe sind drei Transaktionen. Live ist der dritte gescheitert (42P10,
-- ein `on_conflict` auf eine seit 0158 nicht mehr eindeutige Spalte), und
-- zurück blieb ein Objekt OHNE Verknüpfung — eine Waise, die kein späterer
-- Lauf wiederfindet, weil der Abgleich ausschließlich über
-- channex_property_map matcht. Jeder Wiederholungsversuch legte die nächste
-- an: zehn gleichnamige Entwürfe je Betrieb, bei zwei Betrieben.
--
-- Ein Zurücknehmen in Python (Objekt löschen, wenn das Verknüpfen scheitert)
-- deckt nur den Ausnahmepfad. Es deckt NICHT: den harten Prozesstod zwischen
-- den Aufrufen (OOM, Deploy, SIGKILL — der Worker-Reaper reiht den Job dann
-- neu ein), Transportfehler, die keine APIError sind, und zwei gleichzeitige
-- Läufe (Onboarding-Klick und Worker-Tick lesen beide „kein Mapping" und
-- legen beide an — kein Index hält das auf, weil channex_property_id seit
-- 0158 absichtlich nicht eindeutig ist). Zwei Reviewer haben jeden dieser
-- Wege am Code belegt.
--
-- Dicht ist nur, was das Repo für Buchungen längst tut (0104,
-- create_reservation_atomic): ALLES in einer Funktion, serialisiert per
-- Advisory-Lock. Stirbt der Prozess, gibt es entweder Objekt+Verknüpfung
-- oder nichts. Laufen zwei gleichzeitig, wartet der zweite und findet dann
-- die Verknüpfung des ersten.
--
-- WAS DIE FUNKTION ENTSCHEIDET (in dieser Reihenfolge, fail-closed):
--   vorhanden          aktive Verknüpfung DIESES Betriebs → nichts tun
--   fremd              aktive Verknüpfung eines ANDEREN Betriebs → nichts tun
--                      (Wurzel 3: die Mandantengrenze zieht die DB, nicht
--                      der Aufrufer)
--   archiviert         soft-gelöschte Verknüpfung, Objekt archiviert → nichts
--                      tun (0416: der Abgleich macht kein Archivieren
--                      rückgängig)
--   anders_verknuepft  das Altobjekt trägt inzwischen eine andere aktive
--                      Verknüpfung → nichts tun (sonst 23505 auf
--                      channex_property_map_property_uidx, und das riss bis
--                      hierher den ganzen Abgleich des Betriebs)
--   reaktiviert        soft-gelöschte Verknüpfung, Objekt lebt → Verknüpfung
--                      öffnen, Adresse/Koordinaten spiegeln. NICHT title und
--                      description: die führt der Nutzer (siehe den
--                      „Unbenannt"-Bug im Update-Pfad des Abgleichs)
--   neu                Objekt + Verknüpfung anlegen
--
-- Die Gruppenprüfung gegen Channex (in welcher Betriebs-Gruppe hängt die
-- Property?) bleibt im Python-Aufrufer — sie braucht einen Channex-Aufruf.
-- Sie läuft VOR dieser Funktion, für jeden Pfad, auch die Reaktivierung.
--
-- Nur übergebene Spalten werden geschrieben; alles andere behält seinen
-- Default (status 'draft', listed_on_marketplace true per 0527, die Einheit
-- legt der Trigger properties_ersteinheit_anlegen aus 0571 an).

create or replace function public.channex_objekt_spiegeln(
    p_tenant_id            uuid,
    p_channex_property_id  text,
    p_zeile                jsonb
)
returns table (property_id uuid, ergebnis text)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_map_id      uuid;
    v_property_id uuid;
    v_archiviert  timestamptz;
begin
    if p_tenant_id is null or coalesce(p_channex_property_id, '') = '' then
        raise exception 'channex_objekt_spiegeln: tenant und channex_property_id sind Pflicht'
            using errcode = '22023';
    end if;
    if coalesce(p_zeile->>'title', '') = '' then
        raise exception 'channex_objekt_spiegeln: title ist Pflicht (kein Titel erfinden, Wurzel 4)'
            using errcode = '22023';
    end if;

    -- Serialisierung je (Betrieb, Channex-Property). Zwei Läufe für dasselbe
    -- Paar laufen hier hintereinander; der zweite sieht dann die Verknüpfung
    -- des ersten. Transaktionsgebunden: die Sperre fällt mit dem Commit.
    perform pg_advisory_xact_lock(
        hashtext(p_tenant_id::text || ':' || p_channex_property_id)
    );

    -- 1) Schon verknüpft — mit diesem Betrieb.
    select m.property_id
      into v_property_id
      from public.channex_property_map m
     where m.tenant_id = p_tenant_id
       and m.channex_property_id = p_channex_property_id
       and m.deleted_at is null
     order by m.created_at desc
     limit 1;
    if found then
        return query select v_property_id, 'vorhanden'::text;
        return;
    end if;

    -- 2) Verknüpft — mit einem ANDEREN Betrieb. Fail-closed.
    if exists (
        select 1
          from public.channex_property_map m
         where m.channex_property_id = p_channex_property_id
           and m.deleted_at is null
           and m.tenant_id <> p_tenant_id
    ) then
        return query select null::uuid, 'fremd'::text;
        return;
    end if;

    -- 3) Soft-gelöschte Verknüpfung dieses Betriebs: die JÜNGSTE Schließung
    --    entscheidet (ohne order wählte bisher der Planner ein beliebiges
    --    Altobjekt).
    select m.id, m.property_id, p.archived_at
      into v_map_id, v_property_id, v_archiviert
      from public.channex_property_map m
      join public.properties p
        on p.id = m.property_id
       and p.tenant_id = p_tenant_id
     where m.tenant_id = p_tenant_id
       and m.channex_property_id = p_channex_property_id
       and m.deleted_at is not null
     order by m.deleted_at desc, m.created_at desc
     limit 1;
    if found then
        if v_archiviert is not null then
            return query select v_property_id, 'archiviert'::text;
            return;
        end if;
        if exists (
            select 1
              from public.channex_property_map x
             where x.property_id = v_property_id
               and x.deleted_at is null
        ) then
            return query select v_property_id, 'anders_verknuepft'::text;
            return;
        end if;

        update public.channex_property_map
           set deleted_at       = null,
               sync_enabled     = true,
               last_sync_status = 'ok',
               last_sync_error  = null,
               last_sync_at     = now()
         where id = v_map_id;

        update public.properties
           set address     = coalesce(p_zeile->>'address', address),
               city        = coalesce(p_zeile->>'city', city),
               postal_code = coalesce(p_zeile->>'postal_code', postal_code),
               country     = coalesce(p_zeile->>'country', country),
               lat         = coalesce((p_zeile->>'lat')::double precision, lat),
               lng         = coalesce((p_zeile->>'lng')::double precision, lng)
         where id = v_property_id
           and tenant_id = p_tenant_id;

        return query select v_property_id, 'reaktiviert'::text;
        return;
    end if;

    -- 4) Neu — Objekt und Verknüpfung in DIESER Transaktion.
    insert into public.properties
        (tenant_id, title, description, address, city, postal_code, country, lat, lng)
    values
        (p_tenant_id,
         p_zeile->>'title',
         p_zeile->>'description',
         p_zeile->>'address',
         p_zeile->>'city',
         p_zeile->>'postal_code',
         p_zeile->>'country',
         (p_zeile->>'lat')::double precision,
         (p_zeile->>'lng')::double precision)
    returning id into v_property_id;

    insert into public.channex_property_map
        (tenant_id, property_id, channex_property_id,
         sync_enabled, last_sync_status, last_sync_at)
    values
        (p_tenant_id, v_property_id, p_channex_property_id, true, 'ok', now());

    return query select v_property_id, 'neu'::text;
end
$$;

comment on function public.channex_objekt_spiegeln(uuid, text, jsonb) is
    'Legt ein aus Channex gespiegeltes Objekt SAMT Verknüpfung atomar an oder '
    'reaktiviert die Verknüpfung; serialisiert je (Betrieb, Channex-Property). '
    'Fail-closed bei Fremdbesitz. Nur service_role (0721).';

-- Nur das Backend ruft sie. Ein Client mit anon-Key + JWT darf hier weder
-- lesen noch schreiben (Wurzel 6) — die Tabellen selbst sind seit 0337 zu.
revoke all on function public.channex_objekt_spiegeln(uuid, text, jsonb) from public;
revoke all on function public.channex_objekt_spiegeln(uuid, text, jsonb) from anon;
revoke all on function public.channex_objekt_spiegeln(uuid, text, jsonb) from authenticated;
grant execute on function public.channex_objekt_spiegeln(uuid, text, jsonb) to service_role;
