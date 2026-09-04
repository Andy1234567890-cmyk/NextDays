-- 0549 — Bewertungs-KI: Haltungs-Katalog, Einstellungen, Protokoll
--
-- WARUM: Die Auto-Bewertung kannte bis hierher genau EINEN Weg, an Text zu
-- kommen: feste Sätze in `review_auto_template.texte`, aus denen der Versand
-- zufällig einen zog (0503). Das trägt, solange alle Bewertungen gleich
-- aussehen — und genau das tun sie nicht. Ein Gast, der drei Sterne und einen
-- Absatz über den Lärm schreibt, bekommt denselben Satz wie einer mit fünf
-- Sternen und „alles perfekt". Wer dafür feste Texte pflegen will, braucht je
-- Sternestufe einen Vorrat, und selbst dann passt keiner auf den Einzelfall.
--
-- BEIDE RICHTUNGEN. Zwischen Betrieb und Gast laufen zwei verschiedene Texte,
-- und beide sind öffentlich sichtbar:
--
--   'gast_bewerten'  — WIR bewerten den GAST (Airbnb-Gastbewertung, die
--                      bestehende Warteschlange `guest_review_queue`).
--   'antwort'        — WIR antworten auf die Bewertung, die der Gast über UNS
--                      geschrieben hat (die öffentliche Antwort unter der
--                      Bewertung, bisher nur von Hand über `reply`).
--
-- Sie teilen sich den Katalog, weil sie dieselbe Frage beantworten — „wie
-- redet dieser Betrieb?" —, aber NICHT die Freigabe: die Antwort auf eine
-- schlechte öffentliche Bewertung ist der heiklere der beiden Texte, und ein
-- Betrieb muss die eine Richtung automatisch laufen lassen können, während die
-- andere Entwurf bleibt. Deshalb steht die Zustellart je Richtung.
--
-- DER KATALOG ist der Kern. Zehn Fragen, vom Betrieb beantwortet, sind die
-- Stilvorlage im Prompt: „Wie antwortet ihr auf 5 Sterne?", „Wie auf 1 Stern?",
-- „Was sagt ihr nie zu?". Warum ein FESTER Fragenkatalog und kein Freitextfeld:
-- ein leeres Feld „Beschreibe deinen Stil" bleibt leer oder bekommt einen Satz.
-- Zehn konkrete Fragen bekommen zehn konkrete Antworten, und jede einzelne ist
-- im Prompt zuordenbar — bei einer schiefen Antwort ist ablesbar, WELCHE
-- Haltung sie erzeugt hat. Ein Freitext wäre nicht diagnostizierbar.
--
-- Die Fragen selbst stehen NICHT in der Datenbank, sondern im Code
-- (`reviews/ki_katalog.py`): sie sind übersetzbarer Produkttext, keine
-- Betriebsdaten. In der DB steht nur, was der Betrieb geantwortet hat —
-- adressiert über `frage_schluessel`.
--
-- SICHERHEIT (Wurzel 6): Alle drei Tabellen bekommen RLS, eine Tenant-Policy
-- UND eine restriktive `for all`-Policy — nicht nur `for select`, sonst wäre
-- der Schreibpfad tenant-weit offen. Zusätzlich wird anon/authenticated jedes
-- Recht entzogen. Diese Tabellen steuern, was ohne menschliche Prüfung
-- öffentlich unter einem Portal-Inserat erscheint, und das Protokoll enthält
-- Auszüge echter Gasttexte. Beides geht ausschliesslich den Server an: ein
-- eingeloggter cleaner mit dem anon-Key bekommt per
-- `curl /rest/v1/review_ki_katalog` weder etwas zu lesen noch zu schreiben.

-- --------------------------------------------------------------------------
-- Der Haltungs-Katalog — die Antworten des Betriebs auf die zehn Fragen
-- --------------------------------------------------------------------------
create table if not exists public.review_ki_katalog (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,

    -- Der Schlüssel der Frage aus `reviews/ki_katalog.py`. Kein CHECK auf eine
    -- Werteliste: die Fragen sind Produkttext und dürfen sich weiterentwickeln,
    -- ohne dass jede Ergänzung eine Migration braucht. Der Server nimmt nur
    -- bekannte Schlüssel an (`KATALOG`), die DB hält nur die Eindeutigkeit.
    frage_schluessel text not null,

    -- Die Antwort des Betriebs, in seinen Worten. Sie geht in den Prompt.
    antwort text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Eine Antwort je Frage und Betrieb. Der zweite Versuch ist eine Änderung,
    -- kein zweiter Eintrag — sonst stünden zwei widersprüchliche Haltungen
    -- zur selben Frage im selben Prompt (Wurzel 2: der Upsert braucht den
    -- UNIQUE-Backstop, nicht ein Vorab-SELECT).
    constraint review_ki_katalog_eindeutig unique (tenant_id, frage_schluessel),
    constraint review_ki_katalog_schluessel_laenge
        check (length(frage_schluessel) between 1 and 80),
    -- Wurzel 8: der Text geht in den Prompt, also bekommt er eine harte
    -- Obergrenze. Zehn Antworten à 1500 Zeichen sind 15 000 — das passt neben
    -- den Kontext, 10 × 20 000 würde ihn verdrängen.
    constraint review_ki_katalog_antwort_laenge
        check (length(antwort) <= 1500)
);

create index if not exists review_ki_katalog_tenant_idx
    on public.review_ki_katalog (tenant_id);

-- --------------------------------------------------------------------------
-- Einstellungen — je Betrieb EINE Zeile, die Zustellart je RICHTUNG
-- --------------------------------------------------------------------------
create table if not exists public.review_ki_settings (
    tenant_id uuid primary key references public.tenants (id) on delete cascade,

    -- Der grosse Schalter. Aus, bis der Betrieb ihn umlegt: eine KI, die
    -- ungefragt öffentliche Texte schreibt, wäre eine böse Überraschung.
    -- Er gilt für BEIDE Richtungen — wer ihn auslegt, will Ruhe, nicht
    -- „halb aus".
    ki_aktiv boolean not null default false,

    -- Zustellart JE RICHTUNG. Zwei Spalten statt einer, weil die Richtungen
    -- verschieden riskant sind: eine Gastbewertung sieht ausser dem Gast kaum
    -- jemand, eine öffentliche Antwort auf eine 1-Stern-Bewertung lesen alle
    -- künftigen Gäste. Ein Betrieb muss die erste laufen lassen können und die
    -- zweite gegenlesen. Vorgabe beide 'entwurf'.
    zustellart_gast_bewerten text not null default 'entwurf'
        check (zustellart_gast_bewerten in ('entwurf', 'automatisch')),
    zustellart_antwort text not null default 'entwurf'
        check (zustellart_antwort in ('entwurf', 'automatisch')),

    -- Unterhalb dieser Note bleibt die ANTWORT immer ein Entwurf, auch wenn
    -- oben 'automatisch' steht. Der Grund ist betrieblich, nicht technisch:
    -- eine schlechte Bewertung ist der Moment, in dem ein Mensch lesen muss,
    -- was der Betrieb öffentlich sagt. NULL = keine Schwelle.
    antwort_mensch_ab_note integer
        check (antwort_mensch_ab_note is null
               or antwort_mensch_ab_note between 1 and 5),

    -- Tonfall und Unterschrift. Dieselbe Rolle wie in `inbox_ai_settings`,
    -- aber eigene Werte: unter einer öffentlichen Bewertung schreibt ein
    -- Betrieb anders als in einer privaten Gastnachricht.
    tonfall text not null default 'freundlich'
        check (tonfall in ('freundlich', 'formell', 'locker', 'herzlich')),
    unterschrift text,

    -- Die Sprache der Antwort. 'auto' = die Sprache der Bewertung; sonst ein
    -- fester Sprachcode. Nie Deutsch als stiller Rückfall (Wurzel 4).
    sprache text not null default 'auto',

    -- Wie lange gewartet wird, bevor eine automatische Antwort hinausgeht.
    -- Der Sinn ist der Mensch, nicht die Rechenzeit: in diesem Fenster kann
    -- jemand selbst antworten, und dann entfällt die KI-Antwort. 0 = sofort.
    verzoegerung_minuten integer not null default 60
        check (verzoegerung_minuten between 0 and 10080),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint review_ki_settings_unterschrift_laenge
        check (unterschrift is null or length(unterschrift) <= 300),
    constraint review_ki_settings_sprache_laenge
        check (length(sprache) between 2 and 10)
);

-- --------------------------------------------------------------------------
-- Protokoll — was die KI tatsächlich getextet hat
-- --------------------------------------------------------------------------
-- Nicht optional, aus demselben Grund wie beim Posteingang (0493): ein
-- öffentlicher Text, den niemand nachvollziehen kann, ist nicht
-- diagnostizierbar. Fällt eine Antwort schief aus, bliebe nur das Raten
-- zwischen „der Katalog sagt das so", „die Bewertung wurde falsch verstanden"
-- und „das Modell hat sich etwas zurechtgelegt". Die Zeile entsteht bei JEDEM
-- Lauf, auch beim Entwurf und auch beim Test.
create table if not exists public.review_ki_protokoll (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,

    richtung text not null check (richtung in ('gast_bewerten', 'antwort')),

    -- Worauf sich der Lauf bezog. KEIN Fremdschlüssel: je nach Richtung und
    -- Quelle ist das eine Reservierung, eine channex_review oder — beim Test —
    -- gar nichts. Ein FK auf eine von drei Möglichkeiten ginge nicht, ein
    -- geratener bräche die jeweils anderen Pfade.
    bezug_id text,
    quelle text not null default 'marketplace'
        check (quelle in ('marketplace', 'ota', 'test')),

    -- Die Note, um die es ging: bei 'antwort' die des Gastes, bei
    -- 'gast_bewerten' die, die wir vergeben. Sie ist der wichtigste Hebel des
    -- Katalogs, also gehört sie in die Spur.
    note integer check (note is null or note between 1 and 5),

    -- Auszug, nicht der ganze Text: das Protokoll ist eine Spur, kein zweiter
    -- Bewertungsbestand.
    eingabe_auszug text,
    ergebnis text,

    zustellart text not null check (zustellart in ('entwurf', 'automatisch')),
    gesendet_at timestamptz,

    -- Welche Katalogfragen die Antwort getragen haben — die eigentliche
    -- Diagnose. Als jsonb, weil die Auswahl je Note anders ausfällt.
    verwendete_fragen jsonb not null default '[]'::jsonb,
    grund text,

    modell text,
    region text,
    tokens_ein integer not null default 0 check (tokens_ein >= 0),
    tokens_aus integer not null default 0 check (tokens_aus >= 0),

    created_at timestamptz not null default now(),

    constraint review_ki_protokoll_eingabe_laenge
        check (eingabe_auszug is null or length(eingabe_auszug) <= 2000),
    constraint review_ki_protokoll_grund_laenge
        check (grund is null or length(grund) <= 500)
);

create index if not exists review_ki_protokoll_tenant_idx
    on public.review_ki_protokoll (tenant_id, created_at desc);

create index if not exists review_ki_protokoll_bezug_idx
    on public.review_ki_protokoll (tenant_id, richtung, bezug_id);

-- --------------------------------------------------------------------------
-- Die Warteschlange lernt die zweite Richtung
-- --------------------------------------------------------------------------
-- `guest_review_queue` (0263/0503) trägt bisher nur die Gastbewertung. Die
-- öffentliche ANTWORT braucht denselben Weg — Entwurf, sichtbar, änderbar,
-- überspringbar —, weil sie genauso unwiderruflich ist. Statt einer zweiten
-- Warteschlange mit derselben Mechanik bekommt die bestehende eine Richtung.
--
-- Vorgabe 'gast_bewerten': jede bestehende Zeile IST eine Gastbewertung. Ohne
-- diesen Vorgabewert stünden alle Altzeilen auf NULL und würden von jedem
-- Filter übersehen (Wurzel 1 — der Gegenzustand des Altbestands gehört
-- mitgepflegt).
alter table public.guest_review_queue
    add column if not exists richtung text not null default 'gast_bewerten';

alter table public.guest_review_queue
    drop constraint if exists guest_review_queue_richtung_check;
alter table public.guest_review_queue
    add constraint guest_review_queue_richtung_check
    check (richtung in ('gast_bewerten', 'antwort'));

-- Wurde der Text von der KI erzeugt? Nur zur Anzeige — der Betrieb soll in
-- seiner Warteschlange sehen, was ein Mensch und was ein Modell geschrieben
-- hat, bevor er es freigibt.
alter table public.guest_review_queue
    add column if not exists ki_erzeugt boolean not null default false;

-- Die Bewertung, auf die geantwortet wird. Bei Richtung 'antwort' zeigt sie
-- auf die eigene (`reviews`) oder die gespiegelte Portal-Bewertung
-- (`channex_review`) — welche, sagt `source`. Deshalb Text und kein FK, aus
-- demselben Grund wie oben.
alter table public.guest_review_queue
    add column if not exists antwort_auf_id text;

-- Eine Antwort je Bewertung. Der Backstop gegen die Doppelzustellung, die bei
-- jedem Retry und jedem zweiten Worker droht (Wurzel 2) — ein Vorab-SELECT
-- wäre hier ein Race, und zwei öffentliche Antworten unter derselben Bewertung
-- lassen sich bei keinem Portal wieder einsammeln.
create unique index if not exists guest_review_queue_antwort_eindeutig
    on public.guest_review_queue (tenant_id, antwort_auf_id)
    where antwort_auf_id is not null;

-- --------------------------------------------------------------------------
-- Zwei neue KI-Funktionen für die Abrechnung
-- --------------------------------------------------------------------------
-- `site_ai_usage.funktion` trägt einen CHECK (zuletzt 0500). Fehlt ein Name
-- darin, steigt `ki_nutzung._schreiben` STILL aus: der Zähler bewegt sich
-- nicht, `deckel_pruefen` prüft einen Stand, der nie steigt, und der
-- Tagesdeckel wird zur Attrappe.
--
-- Zwei Namen, nicht einer — dieselbe Begründung wie bei 'wissen_import' /
-- 'wissen_lernen': die Richtungen laufen unterschiedlich oft und sind
-- unterschiedlich teuer. In einem Topf liesse sich später nicht sagen, welche
-- den Deckel gesprengt hat.
alter table public.site_ai_usage
  drop constraint if exists site_ai_usage_funktion_check;

alter table public.site_ai_usage
  add constraint site_ai_usage_funktion_check check (
    funktion in (
      'umschreiben',
      'seo',
      'alt_text',
      'abschnitt',
      'blogbeitrag',
      'profil_vorschlag',
      'seite_uebersetzen',
      'gast_antwort',
      'wissen_import',
      'wissen_lernen',
      -- Bestand aus 0501/0514/0546. MUSS mitgeführt werden: der CHECK wird
      -- ersetzt, nicht ergänzt — fehlt ein Name, weist die Datenbank jede
      -- bestehende Zeile ab und die Migration scheitert. Live passiert mit
      -- 'bewertung_deuten' und seinen 176 Zeilen.
      -- KEINE Klammern in diesem Block: `test_funktionen_deckungsgleich_mit_db_check`
      -- liest die Werteliste bis zur ersten schliessenden Klammer, ein
      -- Kommentar mit Klammer schneidet sie also mittendrin ab.
      'bewertung_deuten',
      'bewertung_bilanz',
      'addon_uebersetzen',
      'personal_prognose',
      'personal_autoplan',
      'personal_assistent',
      -- Wir bewerten den Gast.
      'bewertung_gast',
      -- Wir antworten öffentlich auf eine Bewertung über uns.
      'bewertung_antwort'
    )
  );

-- --------------------------------------------------------------------------
-- RLS + Rechte (Wurzel 6)
-- --------------------------------------------------------------------------
alter table public.review_ki_katalog enable row level security;
alter table public.review_ki_settings enable row level security;
alter table public.review_ki_protokoll enable row level security;

drop policy if exists review_ki_katalog_tenant on public.review_ki_katalog;
create policy review_ki_katalog_tenant on public.review_ki_katalog
    for all using (tenant_id = public.current_tenant_id());

drop policy if exists review_ki_katalog_restrict on public.review_ki_katalog;
create policy review_ki_katalog_restrict on public.review_ki_katalog
    as restrictive for all using (tenant_id = public.current_tenant_id());

drop policy if exists review_ki_settings_tenant on public.review_ki_settings;
create policy review_ki_settings_tenant on public.review_ki_settings
    for all using (tenant_id = public.current_tenant_id());

drop policy if exists review_ki_settings_restrict on public.review_ki_settings;
create policy review_ki_settings_restrict on public.review_ki_settings
    as restrictive for all using (tenant_id = public.current_tenant_id());

drop policy if exists review_ki_protokoll_tenant on public.review_ki_protokoll;
create policy review_ki_protokoll_tenant on public.review_ki_protokoll
    for all using (tenant_id = public.current_tenant_id());

drop policy if exists review_ki_protokoll_restrict on public.review_ki_protokoll;
create policy review_ki_protokoll_restrict on public.review_ki_protokoll
    as restrictive for all using (tenant_id = public.current_tenant_id());

-- RLS allein reicht NICHT: sie erzwingt den Mandanten, nicht die Rolle. Diese
-- drei Tabellen entscheiden, was ohne menschliche Prüfung öffentlich unter
-- einem Portal-Inserat steht, und das Protokoll enthält Auszüge echter
-- Gasttexte. Beides geht ausschliesslich den Server an.
revoke all on public.review_ki_katalog from anon, authenticated;
revoke all on public.review_ki_settings from anon, authenticated;
revoke all on public.review_ki_protokoll from anon, authenticated;
