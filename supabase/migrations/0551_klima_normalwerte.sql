-- 0551_klima_normalwerte.sql — langjährige Tages-Klimawerte je Objekt
--
-- WARUM
-- =====
-- Eine Wettervorhersage reicht zehn Tage, der Preiskalender achtzehn Monate. An
-- 529 von 540 Tagen stand deshalb `weather: 1.0` — der Betrieb hatte Wetter
-- eingeschaltet und sah nie eine Wirkung (Befund 04.09.2026, FeWo Stjerneskud).
--
-- Diese Tabelle schließt die Lücke mit dem, was für einen fernen Tag WIRKLICH
-- aussagbar ist: dem langjährigen Mittel dieses Kalendertages an diesem Ort
-- (ERA5-Land, ~11 km Raster, Mittel über ~30 Jahre). Das ist KEINE Vorhersage,
-- und genau deshalb trägt jeder abgeleitete Wert im System die Herkunft
-- 'saisonal' mit sich — ein Mittelwert, der als Prognose auftritt, wäre eine
-- Falschaussage, die niemand als Bug erkennt (Wurzel 5b).
--
-- WARUM JE OBJEKT UND NICHT JE KOORDINATE
-- =======================================
-- Objekte sind der Bezugspunkt der Preisrechnung, und ihre Koordinaten ändern
-- sich praktisch nie. Ein eigener Geo-Cache wäre eine zweite Wahrheit mit
-- eigener Invalidierung; hier hängt der Wert am Objekt und verschwindet mit ihm.
--
-- WARUM MONAT/TAG STATT DATUM
-- ===========================
-- Ein Klimanormalwert gilt für den KALENDERTAG, nicht für ein Jahr: der Wert
-- für den 14. Mai gilt 2027 wie 2028. 366 Zeilen je Objekt decken damit jeden
-- künftigen Tag ab, auch den 29. Februar.

create table if not exists public.klima_normalwerte (
    property_id     uuid not null references public.properties (id) on delete cascade,
    -- Kalendertag, jahresunabhängig. 29.02. ist zulässig (Schaltjahre).
    monat           smallint not null check (monat between 1 and 12),
    tag             smallint not null check (tag between 1 and 31),
    -- Langjährige Tagesmittel. NULL = für diese Größe liegt kein Mittel vor;
    -- der Score wird dann aus den vorhandenen gebildet (kein 0-Ersatzwert).
    temp_c          numeric(5, 2),
    niederschlag_mm numeric(6, 2) check (niederschlag_mm is null or niederschlag_mm >= 0),
    bewoelkung_pct  numeric(5, 2) check (
                        bewoelkung_pct is null
                        or bewoelkung_pct between 0 and 100
                    ),
    -- Fertig gerechneter Score [-1, +1] — dieselbe Formel wie bei der echten
    -- Vorhersage (_score_day). Vorberechnet, damit die Preisrechnung im
    -- Hot Path nur liest und nicht rechnet.
    score           numeric(4, 3) not null check (score between -1 and 1),
    -- Woher die Rohdaten stammen und über welche Jahre gemittelt wurde. Ohne
    -- diese Angabe ließe sich später nicht sagen, ob ein Wert noch aktuell ist.
    quelle          text not null default 'era5_land',
    jahre_von       smallint,
    jahre_bis       smallint,
    berechnet_am    timestamptz not null default now(),
    primary key (property_id, monat, tag)
);

comment on table public.klima_normalwerte is
  'Langjaehrige Tages-Klimamittel je Objekt (ERA5-Land). Fuellt den Wetter-'
  'Faktor jenseits des 10-Tage-Vorhersagehorizonts. KEINE Vorhersage — abgeleitete '
  'Signale tragen die Herkunft "saisonal".';

create index if not exists klima_normalwerte_property_idx
    on public.klima_normalwerte (property_id);

alter table public.klima_normalwerte enable row level security;

-- Tenant-Policy über das Objekt (die Tabelle selbst trägt keine tenant_id —
-- sie haengt am Objekt, das sie besitzt).
drop policy if exists klima_normalwerte_tenant on public.klima_normalwerte;
create policy klima_normalwerte_tenant on public.klima_normalwerte
    for all
    using (
        exists (
            select 1 from public.properties p
            where p.id = klima_normalwerte.property_id
              and p.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        )
    );

-- Wurzel 6: RLS erzwingt nur den MANDANTEN. Geschrieben wird ausschliesslich
-- vom Server (Normalwert-Berechnung); ein Client mit anon-Key hat hier nichts
-- zu suchen. Lesen bleibt erlaubt, damit der Kalender die Werte per Realtime
-- anzeigen kann — es sind Klimadaten, keine Geschaeftsgeheimnisse.
revoke insert, update, delete on public.klima_normalwerte from anon, authenticated;
grant select on public.klima_normalwerte to anon, authenticated;
