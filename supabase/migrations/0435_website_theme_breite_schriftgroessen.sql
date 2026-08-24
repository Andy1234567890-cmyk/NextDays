-- 0435 — Theme: Seitenbreite und Schriftgrößen-Faktoren
--
-- Etappe E aus docs/WEBSITE-BAUKASTEN-PLAN.md. Zwei Dinge, die Hostaway im
-- Theme-Panel hat und wir nicht: die maximale Inhaltsbreite und die Größe der
-- Schrift je Rolle.
--
-- Was hier NICHT entsteht, obwohl Hostaway es hat, und warum:
--
--   · Schriftgröße, -gewicht, Zeilenhöhe und Laufweite EINZELN je Ebene
--     (DFLT/PAR/H1–H6, dazu getrennt für Desktop und Mobil). Das sind 6 Ebenen
--     × 5 Eigenschaften × 2 Geräte = 60 Werte. Ein Ferienvermieter, der eine
--     Website braucht, trifft davon keine 60 Entscheidungen — er will, dass die
--     Überschriften „etwas größer" sind. Deshalb hier ZWEI Faktoren, die auf
--     das bestehende, aufeinander abgestimmte Typo-System wirken.
--   · 30 benannte Theme-Farben mit Bindung an einzelne Widgets. Wir haben sechs
--     ROLLEN (0426), und eine Rolle ist die bessere Abstraktion: sie sagt, WOFÜR
--     die Farbe gilt, statt eine Palette zu verwalten, deren Zuordnung man
--     nachschlagen muss.
--   · „Farben aus dem Logo generieren". Braucht eine Bildanalyse auf dem Server
--     und liefert ohne Nacharbeit meist eine unbrauchbare Palette (das Logo
--     eines Ferienhauses ist oft schwarz-weiß). Die Farbwahl bleibt beim
--     Kunden, mit Kontrast-Prüfung daneben.
--
-- Wurzel 1: alle drei Spalten sind NULL-fähig ohne Default. NULL heißt „nie
-- gewählt", und der Renderer nimmt dann genau die Werte, die er heute schon
-- verwendet — bestehende Kundenseiten sehen nach dem Deploy unverändert aus.

alter table public.tenant_site_config
    -- Maximale Breite des Inhalts in Pixeln. Die Abschnitte begrenzen sich
    -- heute fest auf ihre eigene Breite (`max-w-5xl`/`6xl`); dieser Wert
    -- überschreibt sie site-weit.
    --
    -- Grenzen: 960 (schmaler wird es auf dem Laptop zur Spalte) bis 1920
    -- (breiter reißt jede Zeile über die Lesbarkeitsgrenze von etwa 90
    -- Zeichen). Dieselben Grenzen nennt Hostaway.
    add column if not exists content_width smallint,
    -- Faktor auf die Überschriften-Größen, in Prozent. 100 = wie bisher.
    --
    -- Ein FAKTOR und keine absolute Größe: die Überschriften-Stufen stehen in
    -- einem festen Verhältnis zueinander, das gestaltet ist. Absolute Werte je
    -- Ebene würden dieses Verhältnis zerstören, und der Kunde müsste drei
    -- Zahlen aufeinander abstimmen.
    add column if not exists heading_scale smallint,
    -- Dasselbe für den Fließtext. Getrennt vom Überschriften-Faktor, weil es
    -- der häufigere Wunsch ist: „der Text ist zu klein" hat nichts mit der
    -- Größe der Überschriften zu tun.
    add column if not exists body_scale smallint;

alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_content_width_range;
alter table public.tenant_site_config
    add constraint tenant_site_config_content_width_range check (
        content_width is null or content_width between 960 and 1920
    );

-- 80 bis 130 Prozent. Enger als man denkt, und das ist Absicht: unter 80 wird
-- der Text unlesbar, über 130 sprengt eine Überschrift auf dem Telefon jede
-- Zeile. Ein Regler, der bis 300 % geht, ist kein Werkzeug, sondern eine
-- Einladung, die eigene Seite zu zerstören.
alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_scale_range;
alter table public.tenant_site_config
    add constraint tenant_site_config_scale_range check (
        (heading_scale is null or heading_scale between 80 and 130)
        and (body_scale is null or body_scale between 80 and 130)
    );

comment on column public.tenant_site_config.content_width is
    'Maximale Inhaltsbreite in px (960–1920). NULL = die Breiten, die die '
    'Abschnitte selbst setzen.';
comment on column public.tenant_site_config.heading_scale is
    'Faktor auf die Überschriften-Größen in Prozent (80–130). NULL = 100.';
comment on column public.tenant_site_config.body_scale is
    'Faktor auf die Fließtext-Größe in Prozent (80–130). NULL = 100.';
