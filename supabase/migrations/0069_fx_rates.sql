-- 0069_fx_rates.sql — Wechselkurs-Cache (ECB-Tageskurse via Frankfurter)
--
-- Eigentümer-Abrechnungen rechnen die Eigentümer-Auszahlung je Reservierung in
-- die Owner-Währung (aus dem Herkunftsland) um. Quelle ist die kostenlose
-- Frankfurter-API (ECB-Referenzkurse, kein Key). Die Kurse werden hier gecacht,
-- damit (a) ein Tageskurs stabil bleibt (GoBD: nachvollziehbar, reproduzierbar)
-- und (b) nicht bei jedem Aufruf extern angefragt wird.
--
-- Ein Kurs ist pro (date, base, quote) eindeutig. Die Abrechnung liest aus dem
-- Cache; fehlt der Kurs, wird er einmal von Frankfurter geholt und gespeichert.
-- Bewusst KEIN Fallback-Kurs: ist ein Kurs nicht beschaffbar, schlägt die
-- Abrechnung klar fehl, statt einen erfundenen Wert zu verwenden.

create table if not exists public.fx_rates (
    rate_date   date        not null,
    base        text        not null,  -- z. B. 'SEK' (Quellwährung der Buchung)
    quote       text        not null,  -- z. B. 'EUR' (Owner-/Zielwährung)
    rate        numeric(18, 8) not null check (rate > 0),
    source      text        not null default 'ECB',
    cached_at   timestamptz not null default now(),
    primary key (rate_date, base, quote)
);

comment on table public.fx_rates is
    'Gecachte Tages-Wechselkurse (ECB via Frankfurter) für Owner-Abrechnungen. 1 base = rate quote am rate_date.';
