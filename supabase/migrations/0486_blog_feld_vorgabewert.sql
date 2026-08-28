-- 0486 — VORGABEWERTE für Beitragsfelder (Framers „Default" und „Based on").
--
-- WAS IM VORBILD STEHT
-- ====================
-- Am 28.08.2026 im offenen Framer-Projekt abgelesen: das Feld-Popover hat einen
-- Eintrag `+ Add…` mit `Default · Placeholder · Max Length · Localization`.
-- Bei `Full Project Title` ist der Default nicht eingetippt, sondern
-- ABGELEITET: die Zeile heisst `Based on <Feldliste>` — der volle Titel folgt
-- dem kurzen Listentitel, solange niemand ihn ueberschreibt. Genau deshalb
-- steht im Beitragsdialog neben diesem Feld ein Knopf **Reset**: er nimmt die
-- Ueberschreibung zurueck und laesst die Ableitung wieder greifen.
--
-- Bei uns fehlte beides. Die Feldkonfiguration (0481) kennt Name,
-- Beschreibung, Platzhalter, Maximallaenge, Pflicht, mehrzeilig und
-- versteckt — aber keinen Vorgabewert. Ein `Reset` waere ohne ihn ein Knopf,
-- der auf nichts zurueckstellt.
--
--
-- ZWEI ARTEN VORGABE, NICHT EINE
-- ==============================
-- `standard_wert`  — ein FESTER Text. „Ferienvermietung" in `Industry`, weil
--                    dieser Betrieb nichts anderes vermietet.
-- `standard_feld`  — der Schluessel eines ANDEREN Feldes. Der Wert folgt
--                    diesem Feld, solange er nicht ueberschrieben ist.
--
-- Beide zugleich waeren zwei Wahrheiten darueber, was „die Vorgabe" ist
-- (Wurzel 2) — dagegen steht ein CHECK. Welches Feld gemeint sein DARF, prueft
-- der Server gegen seine Feldliste; ein CHECK koennte das nicht, weil die
-- Liste teils im Code und teils in `site_post_custom_fields` steht.
--
-- WARUM TEXT UND NICHT jsonb
-- ==========================
-- Der Vorgabewert ist die Eingabe, die im Feld stuende, haette der Redakteur
-- sie getippt. Ein Schalter hat keine sinnvolle Vorgabe ausser seinem eigenen
-- Grundzustand, ein Bild auch nicht — beides bekommt hier deshalb gar keine
-- (der Server lehnt es ab). Uebrig bleiben Text, Zahl, Datum und Link, und die
-- sind alle Text.
--
-- WAS DER VORGABEWERT NICHT IST
-- =============================
-- Er ist KEIN Ersatzwert beim Lesen. Ein leeres Feld bleibt leer — der
-- Vorgabewert wirkt nur an zwei Stellen: beim ANLEGEN eines Beitrags (das
-- Formular startet damit) und beim Klick auf `Zuruecksetzen`. Wuerde er beim
-- Lesen einspringen, stuende in der Liste ein Wert, den niemand eingegeben
-- hat — genau der Fall, den Wurzel 4 verbietet.

alter table public.site_post_field_config
    add column if not exists standard_wert text
        check (standard_wert is null or char_length(standard_wert) <= 500),
    add column if not exists standard_feld text
        check (standard_feld is null or char_length(standard_feld) <= 40);

alter table public.site_post_custom_fields
    add column if not exists standard_wert text
        check (standard_wert is null or char_length(standard_wert) <= 500),
    add column if not exists standard_feld text
        check (standard_feld is null or char_length(standard_feld) <= 40);

comment on column public.site_post_field_config.standard_wert is
    'Fester Vorgabewert (0486). Wirkt beim Anlegen eines Beitrags und beim '
    'Zuruecksetzen — NIE als Ersatzwert beim Lesen (Wurzel 4).';
comment on column public.site_post_field_config.standard_feld is
    'Vorgabe ABGELEITET aus einem anderen Feld (0486, Framers "Based on"). '
    'Schluessel des Quellfeldes; der Server prueft ihn gegen seine Feldliste.';

-- Genau eine Vorgabe je Feld. Beide zugleich waeren zwei Wahrheiten darueber,
-- worauf `Zuruecksetzen` zurueckstellt.
alter table public.site_post_field_config
    drop constraint if exists site_post_field_config_eine_vorgabe;
alter table public.site_post_field_config
    add constraint site_post_field_config_eine_vorgabe
    check (standard_wert is null or standard_feld is null);

alter table public.site_post_custom_fields
    drop constraint if exists site_post_custom_fields_eine_vorgabe;
alter table public.site_post_custom_fields
    add constraint site_post_custom_fields_eine_vorgabe
    check (standard_wert is null or standard_feld is null);

-- Ein Feld darf sich nicht auf SICH SELBST beziehen: die Vorgabe waere dann
-- ihr eigener Ausgangspunkt, und `Zuruecksetzen` taete nichts. Nur bei den
-- eigenen Feldern als CHECK moeglich — dort steht der eigene Schluessel in
-- derselben Zeile. Bei den eingebauten prueft es der Server (`feld_key` ist
-- dort ebenfalls in der Zeile, aber der Vergleich gehoert zu derselben
-- Pruefung wie die Existenz des Zielfeldes, und die kann nur er).
alter table public.site_post_custom_fields
    drop constraint if exists site_post_custom_fields_vorgabe_nicht_selbst;
alter table public.site_post_custom_fields
    add constraint site_post_custom_fields_vorgabe_nicht_selbst
    check (standard_feld is null or standard_feld <> feld_key);

alter table public.site_post_field_config
    drop constraint if exists site_post_field_config_vorgabe_nicht_selbst;
alter table public.site_post_field_config
    add constraint site_post_field_config_vorgabe_nicht_selbst
    check (standard_feld is null or standard_feld <> feld_key);

-- Rechte bleiben, wie sie sind: beide Tabellen sind seit 0481/0482 bzw. 0485
-- fuer `authenticated` nur lesbar, geschrieben wird ausschliesslich vom Server
-- (Wurzel 6). Eine neue Spalte erbt das Tabellen-Grant — ein zusaetzliches
-- `grant` waere hier falsch und ein zusaetzliches `revoke` ueberfluessig.
