-- 0439 — `system_fonts_first` auf den Wert bringen, den 0430 gemeint hat
--
-- 0430 beschreibt in seinem eigenen Kommentar ausführlich, warum der Default
-- `true` sein MUSS: der Renderer lädt seine Schriften heute schon mit
-- `font-display: swap`, also ist genau das der Ist-Zustand jeder bestehenden
-- Kundenseite. Ein `false` bedeutet `font-display: block` — der Text bleibt
-- unsichtbar, bis die Marken-Schrift geladen ist (FOIT), im schlechten Fall drei
-- Sekunden lang.
--
-- Live steht trotzdem `default false`, und die bestehende Zeile trägt `false`.
-- Der Grund ist ein Ablauffehler, kein Denkfehler: 0430 wurde in einer früheren
-- Fassung eingespielt und in `schema_migrations` vermerkt; die spätere Korrektur
-- der Datei auf `default true` hat der Runner nie wieder angefasst — eine
-- angewendete Migration wird nicht erneut ausgeführt. Gegen die Live-DB geprüft
-- am 24.08.2026: `information_schema.columns.column_default = false`.
--
-- Daraus die Lehre, die hier festgehalten gehört: eine bereits eingespielte
-- Migrationsdatei zu ÄNDERN wirkt nicht. Die Korrektur ist immer eine neue
-- Datei.
--
-- Das Umstellen der bestehenden Zeilen ist bewusst pauschal (`where
-- system_fonts_first = false`) und nicht auf einen Tenant beschränkt: die
-- Oberfläche für diesen Schalter ist noch nicht ausgeliefert, also kann kein
-- `false` eine Nutzerentscheidung sein — jedes stammt aus dem falschen Default.
-- Nach diesem Zeitpunkt gesetzte `false` sind echte Entscheidungen und dürfen
-- nie wieder pauschal überschrieben werden.

alter table public.tenant_site_config
    alter column system_fonts_first set default true;

update public.tenant_site_config
   set system_fonts_first = true
 where system_fonts_first = false;

comment on column public.tenant_site_config.system_fonts_first is
    'System-Schrift zeigen, während die Marken-Schrift lädt (font-display: '
    'swap). Beschleunigt das erste Lesen, lässt die Seite aber blinken. '
    'AUS bedeutet font-display: block — der Text erscheint erst mit der '
    'Marken-Schrift. Default true, weil das der bisherige Zustand ist.';
