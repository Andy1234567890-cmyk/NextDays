-- 0527 — myBestDays-Pflichtlistung (Master-Strategie 02.09.2026, Entscheidung 1; ADR-0021)
--
-- BISHER (0159): der Marktplatz war ein pro Kanal abwählbarer Vertriebsweg —
-- `properties.listed_on_marketplace` als Schalter des Betriebs. AB JETZT ist
-- jedes Objekt auf myBestDays gelistet; der Betrieb kann den Kanal nicht
-- abwählen. Sichtbar ist es dort weiterhin nur, wenn `status='active'` UND die
-- Freigabe des Betreibers (`moderation_status='approved'`, 0203) vorliegt — die
-- Moderation bleibt die einzige Achse neben dem Lebenszyklus.
--
-- WARUM EIN TRIGGER UND NICHT NUR DIE API: `properties` ist für `authenticated`
-- schreibbar (RLS entscheidet über die Zeile, nicht über die Spalte). Ein Client
-- mit gültigem JWT könnte per PostgREST `listed_on_marketplace=false` setzen und
-- den FastAPI-Layer umgehen (Wurzel 6). Der Trigger erzwingt die Regel dort, wo
-- der Angreifer wirklich schreibt.
--
-- DIE EINE AUSNAHME: „Verkauf pausieren" (0375) nimmt ein Objekt bei ALLEN
-- Kanälen aus dem Verkauf — auch auf dem Marktplatz. Dafür sichert
-- `channel_manager.objekt_verkauf` VOR dem Umschalten eine offene Pause
-- (`property_sales_pause`, portal_code 'myBestDays', beendet_at null). Nur
-- solange diese Pause offen ist, darf das Flag false sein; der Rückweg setzt es
-- wieder auf true und schließt die Pause. Ohne offene Pause wird jeder Versuch,
-- false zu schreiben, still auf true korrigiert — kein Fehler, weil alte
-- Clients (mobile-nextdays, Open-API-Integratoren) das Feld noch senden.
--
-- Die Spalte bleibt: sie ist die eine Stelle, an der Marktplatz-Abfragen
-- (`booking_engine.schaufenster`, `guest_wishlist`, Kanal-Karte) filtern.

-- Bestand: alles auf true, was nicht gerade pausiert ist.
update public.properties p
   set listed_on_marketplace = true
 where listed_on_marketplace = false
   and not exists (
        select 1 from public.property_sales_pause sp
         where sp.property_id = p.id
           and sp.portal_code = 'myBestDays'
           and sp.beendet_at is null
   );

alter table public.properties
    alter column listed_on_marketplace set default true;

create or replace function public.properties_marktplatz_pflicht()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.listed_on_marketplace is distinct from false then
        return new;
    end if;
    -- false ist nur erlaubt, solange eine offene Marktplatz-Pause (0375) besteht.
    if exists (
        select 1 from public.property_sales_pause sp
         where sp.property_id = new.id
           and sp.portal_code = 'myBestDays'
           and sp.beendet_at is null
    ) then
        return new;
    end if;
    new.listed_on_marketplace := true;
    return new;
end;
$$;
revoke execute on function public.properties_marktplatz_pflicht() from anon, authenticated;

drop trigger if exists properties_marktplatz_pflicht on public.properties;
create trigger properties_marktplatz_pflicht
    before insert or update of listed_on_marketplace on public.properties
    for each row execute function public.properties_marktplatz_pflicht();

comment on column public.properties.listed_on_marketplace is
    'myBestDays-Pflichtlistung (0527): immer true, außer während einer offenen '
    '„Verkauf pausieren"-Pause (property_sales_pause, portal_code myBestDays). Der Betrieb '
    'kann den Kanal nicht abwählen (Trigger properties_marktplatz_pflicht). Sichtbar auf dem '
    'Marktplatz = status=active AND listed_on_marketplace AND moderation_status=approved.';
