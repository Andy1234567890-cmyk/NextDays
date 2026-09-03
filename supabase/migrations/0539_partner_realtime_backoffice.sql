-- Realtime für die Partner-Seiten des Backoffice (0539).
--
-- WAS GEFEHLT HAT: Die Partner-Sektion (`/partner`, `/partner/leads`,
-- `/partner/videos`, `/partner/material`, `/partner/auszahlungen`) hatte KEIN
-- einziges Abo. Sieben andere Backoffice-Seiten haben es längst (0206:
-- Freigaben, Buchungen, Diagnose, Ankündigungen, Steuern). Wer im Backoffice
-- auf Bewerbungen wartete, musste die Seite von Hand neu laden — gemeldet am
-- 03.09.2026: „ausserdem muss das realtime gehen immer muss ich die seite
-- aktuallesieren". Live geschah dabei genau das: eine Bewerbung ging um 17:21
-- ein und war erst nach einem Neuladen sichtbar.
--
-- WARUM DAS NICHT MIT EINEM GRANT ERLEDIGT IST (Wurzel 6): `affiliates` trägt
-- E-Mail-Adresse, Auszahlungsdaten und Stripe-Zustand. Ein pauschales
-- `grant select … to authenticated` würde diese Zeilen JEDEM eingeloggten
-- Nutzer über `curl /rest/v1/affiliates` öffnen — Betriebe, Eigentümer,
-- Reinigungskräfte inbegriffen. Der Schutz besteht deshalb aus DREI Teilen,
-- von denen keiner allein reicht:
--
--   1. `grant select` (nur SELECT, kein insert/update/delete) — nötig, damit
--      Realtime überhaupt etwas senden darf.
--   2. Die restriktive `*_deny_all`-Policy aus 0517 wird ERSETZT durch eine,
--      die ausschließlich Backoffice-Nutzer ausnimmt. Restriktive Policies
--      gelten UND-verknüpft: solange dort `using (false)` steht, hilft keine
--      permissive Policie daneben. Schreiben bleibt für alle gesperrt.
--   3. Eine permissive Lese-Policy mit `is_platform_admin()` (0206,
--      SECURITY DEFINER, fail-closed).
--
-- Ergebnis für einen eingeloggten Nicht-Backoffice-Nutzer: `select` liefert 0
-- Zeilen, `insert/update/delete` scheitern am fehlenden GRANT. Für das
-- Backoffice: Lesen erlaubt, Schreiben weiterhin nur über die API mit
-- service_role.
--
-- BEWUSST NICHT DABEI: `affiliate_payouts`, `affiliate_payout_items`,
-- `affiliate_commissions`. Das sind Finanzdaten, und Wurzel 6 sperrt sie
-- ausdrücklich („dort ist das Abo der Fehler"). Die Auszahlungsseite hört
-- deshalb auf `affiliates` mit — eine Auszahlung entsteht nie ohne eine
-- Änderung am Partner selbst (Rang, Status, Stripe-Zustand).

do $$
declare
    t text;
begin
    -- Nur Tabellen, deren Inhalt das Backoffice ohnehin in seiner Oberfläche
    -- zeigt. `affiliate_assets` ist das Werbematerial (kein Personenbezug),
    -- `affiliate_leads` die Multiplikatorenliste, `affiliate_posts` die
    -- Videofreigabe.
    foreach t in array array[
        'affiliates', 'affiliate_assets', 'affiliate_leads', 'affiliate_posts'
    ] loop
        -- 1. Nur LESEN. Kein insert/update/delete — der Schreibpfad bleibt
        --    ausschließlich service_role (Wurzel 6).
        execute format('grant select on public.%I to authenticated', t);

        -- 2. Die Total-Sperre aus 0517/0526 durch eine ersetzen, die das
        --    Backoffice ausnimmt. `for all` bleibt: sie deckt weiterhin
        --    insert/update/delete mit `using(false)`-Wirkung ab, weil die
        --    Ausnahme nur SELECT betrifft (siehe with check unten).
        execute format('drop policy if exists %I on public.%I', t || '_deny_all', t);
        execute format(
            'create policy %I on public.%I as restrictive for all '
            -- Lesen: nur Backoffice. Alles andere: niemand.
            'using (public.is_platform_admin()) '
            -- Schreiben über den Direktpfad: NIEMAND, auch kein Backoffice.
            -- Wer Partner ändert, tut das über die API, die die Rolle prüft
            -- und protokolliert (reviewed_by/reviewed_at).
            'with check (false)',
            t || '_deny_all', t
        );

        -- 3. Permissive Lese-Policy. Ohne sie greift keine Erlaubnis: RLS ist
        --    default-deny, restriktive Policies erlauben nichts, sie
        --    beschränken nur.
        execute format('drop policy if exists %I on public.%I', t || '_platform_read', t);
        execute format(
            'create policy %I on public.%I as permissive for select '
            'using (public.is_platform_admin())',
            t || '_platform_read', t
        );

        -- 4. In die Realtime-Publikation. Ohne Mitgliedschaft ist das Abo
        --    eine stumme Attrappe: die Oberfläche sieht live aus und
        --    aktualisiert nie.
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;

comment on policy affiliates_deny_all on public.affiliates is
    'Restriktiv: LESEN nur für aktive Backoffice-Nutzer (is_platform_admin), '
    'SCHREIBEN über den DB-Direktpfad für niemanden (with check false). '
    'Partner selbst sehen ihre Zeile nicht per PostgREST — ihr Dashboard '
    'holt sie über die API, die auf affiliate_id aus dem Token scopet.';
