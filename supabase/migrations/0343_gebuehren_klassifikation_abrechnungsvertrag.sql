-- =========================================================================
-- 0343 — Fundament der konfigurierbaren Eigentümer-Abrechnung:
--        (A) Gebühren-Klassifikation  (B) Abrechnungsvertrag mit Zeitachse
-- =========================================================================
-- Diese Migration legt NUR die Datenhaltung an. Die Rechenkette in
-- `owner_statements/common.py` bleibt in dieser Etappe UNVERÄNDERT führend;
-- sie liest hier noch nichts. Der Umstieg ist eine eigene, abgegrenzte
-- Etappe — deshalb schreibt diese Migration auch keine Bestandsdaten um.
--
-- WARUM ÜBERHAUPT (der fachliche Anlass):
-- Die Auszahlung der Plattform ist das Brutto des Betriebs. Davon gehören
-- NICHT alle Bestandteile derselben Partei:
--
--   Auszahlung der Plattform                    = Brutto des Betriebs
--     − Reinigungsgebühr   → bleibt beim BETRIEB (er erbringt die Leistung)
--     − Haustiergebühr     → bleibt beim BETRIEB
--     − Nebenkosten        → 100 % an den EIGENTÜMER, provisionsfrei
--     = bereinigte Basis
--   bereinigte Basis × Provisionssatz           = Provision des Betriebs
--   bereinigte Basis × (1 − Satz) + Nebenkosten = Eigentümer-Betrag
--     − Pauschale je Buchung                    = Auszahlung
--
-- Diese Kette ist die Vereinbarung EINES Betriebs. Sie wird deshalb NICHT
-- als Konstante in den Code geschrieben, sondern als Konfiguration: jeder
-- Betrieb rechnet anders (andere Gebühren beim Betrieb, andere Sätze, mit
-- oder ohne Pauschale), und jede Agentur muss das selbst einstellen können.
--
-- =========================================================================
-- (A) GEBÜHREN-KLASSIFIKATION — zwei UNABHÄNGIGE Achsen
-- =========================================================================
-- Recherchierter Branchenstand: OwnerRez und Guesty führen an jeder Gebühr
-- zwei getrennte Kennzeichen, nicht eines. Die naheliegende Einachsigkeit
-- („provisionspflichtig ja/nein") reicht nachweislich nicht, weil sie zwei
-- verschiedene Fragen zusammenwirft:
--
--   Achse 1  WEM GEHÖRT DER BETRAG        betrieb | eigentuemer | durchlauf
--   Achse 2  PROVISIONSPFLICHTIG          ja | nein
--
-- Dass sie unabhängig sind, zeigen die drei realen Fälle:
--   Miete            → eigentuemer + provisionspflichtig
--   Nebenkosten      → eigentuemer + provisionsFREI
--   Reinigung        → betrieb     + provisionsfrei (gehört ohnehin nicht ihm)
-- Mit nur einer Achse ließe sich „Nebenkosten" nicht von „Reinigung"
-- unterscheiden: beide sind provisionsfrei, aber das Geld geht an zwei
-- verschiedene Parteien.
--
-- `durchlauf` ist die dritte Eigentümerschaft und keine Spitzfindigkeit:
-- Kurtaxe gehört der Gemeinde, die Kaution dem Gast. Beides ist weder
-- Ertrag des Betriebs noch des Eigentümers und darf in KEINER der beiden
-- Summen auftauchen — ohne eigenen Wert müsste man es einer der beiden
-- Parteien zuschlagen und die Abrechnung wäre um diesen Betrag falsch.
--
-- WARUM EINE EIGENE TABELLE UND NICHT EIN FELD IM PREIS-BLOB:
-- Die Gebühren liegen als JSON in `properties.type_attributes.pricing.fees`
-- (gespiegelt nach `property_pricing_config.fees`). Ein Blob kennt weder
-- NOT NULL noch einen CHECK — eine fehlende Klassifikation wäre dort
-- schlicht ein fehlender Schlüssel und damit von „noch nicht zugeordnet"
-- nicht unterscheidbar. Genau diese Unterscheidung ist aber der Kern von
-- Wurzel 4: die Rechenkette MUSS später klar fehlschlagen können statt
-- „gehört wohl dem Eigentümer, ist wohl provisionspflichtig" zu unterstellen.
--
-- WARUM JE GEBÜHRENART UND NICHT JE GEBÜHREN-ZEILE:
-- Die 49 Gebührenarten (`gebuehren.FEE_TYPE_CATEGORY`) sind die fachliche
-- Achse; die einzelne Zeile im Blob ist nur ihre Ausprägung an einem Objekt.
-- Live in der Kundendatenbank stehen 43 Gebühren-Zeilen, aber nur DREI
-- Arten (cleaning_fee 19×, resort 15×, pet_fee 9×). Eine Zuordnung je Zeile
-- hieße 43 identische Entscheidungen und würde bei jedem neuen Objekt erneut
-- anfallen; eine Zuordnung je Art ist drei Entscheidungen, die dauerhaft
-- tragen. Braucht ein einzelnes Objekt eine Abweichung, trägt sie
-- `property_id` (siehe unten) — dasselbe Vorrangprinzip wie beim Vertrag.
--
-- KEINE GERATENEN BESTANDSWERTE (Wurzel 4):
-- Diese Migration füllt die Tabelle NICHT. Es wäre naheliegend,
-- `cleaning_fee` per INSERT auf „betrieb" zu setzen — schließlich steht es
-- oben in der Kette. Aber das ist die Vereinbarung DIESES Betriebs, und ob
-- die Reinigungsgebühr beim Betrieb bleibt, wird gerade noch geprüft. Ein
-- geratener Bestandswert wäre nicht als Rateergebnis erkennbar: er sähe in
-- der Maske aus wie eine bewusste Entscheidung der Agentur. Die Agentur
-- ordnet die vorhandenen Arten einmalig in der Zuordnungsmaske zu; die Maske
-- darf Vorschläge ANZEIGEN, die Bestätigung ist die Entscheidung.
-- =========================================================================

create table if not exists public.fee_classification (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,

    -- Die Gebührenart aus `gebuehren.FEE_TYPES` (54 gültige Werte: 49
    -- wählbare + 5 Altbestandsschlüssel). Bewusst `text` und KEIN Enum: die
    -- Liste lebt im Python-Katalog und wächst dort mit neuen Portalen. Ein
    -- DB-Enum müsste bei jeder Ergänzung migriert werden und liefe der
    -- Anwendung hinterher — eine zweite Quelle der Wahrheit, die auseinander-
    -- läuft. Geprüft wird beim Schreiben gegen den Katalog (422).
    fee_type text not null,

    -- Objekt-Ausnahme. NULL = die Regel des Betriebs, gilt für alle Objekte.
    -- Gesetzt = nur für dieses eine Objekt und schlägt die Betriebsregel
    -- (Vorrang wie `commission_override_pct` vor `default_commission_pct`).
    -- Der Normalfall ist NULL; die Spalte existiert, damit ein einzelnes
    -- Objekt mit abweichender Vereinbarung nicht die ganze Betriebsregel
    -- verbiegen muss.
    property_id uuid references public.properties(id) on delete cascade,

    -- ACHSE 1 — wem gehört der Betrag.
    gehoert_zu text not null
        check (gehoert_zu in ('betrieb', 'eigentuemer', 'durchlauf')),

    -- ACHSE 2 — fließt der Betrag in die Provisionsbemessung ein.
    -- NOT NULL ohne Default: die Achse ist eine Entscheidung, kein
    -- Automatismus. Ein `default true` hieße „im Zweifel provisionspflichtig"
    -- und wäre der erfundene Ersatzwert aus Wurzel 4 — nur eben in der
    -- Tabellendefinition versteckt, wo ihn niemand mehr als Annahme erkennt.
    provisionspflichtig boolean not null,

    -- Wer die Zuordnung zuletzt bestätigt hat. Die Zuordnung ist eine
    -- Geschäftsentscheidung mit Geldwirkung; ohne Urheber lässt sich später
    -- nicht klären, wer sie getroffen hat.
    zugeordnet_von uuid references public.users(id) on delete set null,
    -- Zeitpunkt der Entscheidung. Bewusst eine EIGENE Spalte und nicht
    -- `updated_at` (Wurzel 5b): `updated_at` ist unsere Uhr für jede
    -- Zeilenänderung und verschöbe sich bei jeder späteren Korrektur.
    zugeordnet_am timestamptz not null default now(),

    notiz text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Genau EINE Regel je (Betrieb, Art) und genau EINE je (Betrieb, Art, Objekt).
-- Zwei partielle Unique-Indizes statt eines gemeinsamen: in Postgres sind
-- NULL-Werte in einem Unique-Index untereinander NICHT gleich, ein
-- `unique (tenant_id, fee_type, property_id)` ließe also beliebig viele
-- Betriebsregeln derselben Art nebeneinander zu — und die Auflösung müsste
-- raten, welche gilt. Das ist zugleich der Backstop gegen Doppelklick/Retry
-- (Wurzel 2): der zweite Schreibversuch läuft in 23505 statt eine zweite
-- widersprüchliche Regel anzulegen.
create unique index if not exists fee_classification_tenant_art_uidx
    on public.fee_classification (tenant_id, fee_type)
    where property_id is null;
create unique index if not exists fee_classification_tenant_art_objekt_uidx
    on public.fee_classification (tenant_id, fee_type, property_id)
    where property_id is not null;

-- Der Auflösungspfad der Rechenkette: alle Regeln eines Betriebs auf einmal.
create index if not exists fee_classification_tenant_idx
    on public.fee_classification (tenant_id);

comment on table public.fee_classification is
    'Klassifikation der Gebührenarten je Betrieb: wem der Betrag gehört und ob '
    'er provisionspflichtig ist. Zwei unabhängige Achsen (OwnerRez/Guesty-Modell). '
    'Ohne Zeile für eine Art ist die Art UNKLASSIFIZIERT — die Rechenkette muss '
    'dann klar fehlschlagen, nie eine Zugehörigkeit unterstellen (Wurzel 4, 0343).';
comment on column public.fee_classification.fee_type is
    'Gebührenart aus gebuehren.FEE_TYPES. text statt Enum: der Katalog lebt in '
    'der Anwendung, ein DB-Enum wäre eine zweite Quelle (0343).';
comment on column public.fee_classification.property_id is
    'NULL = Regel des Betriebs (Normalfall). Gesetzt = Ausnahme für dieses eine '
    'Objekt, schlägt die Betriebsregel — Vorrang wie commission_override_pct (0343).';
comment on column public.fee_classification.gehoert_zu is
    'Achse 1: betrieb (Leistung des Betriebs, z. B. Reinigung) | eigentuemer '
    '(z. B. Nebenkosten, Miete) | durchlauf (gehört Dritten: Kurtaxe der '
    'Gemeinde, Kaution dem Gast) (0343).';
comment on column public.fee_classification.provisionspflichtig is
    'Achse 2, unabhängig von Achse 1: fließt der Betrag in die Provisions-'
    'bemessung ein. Nebenkosten sind eigentuemer+false, Miete eigentuemer+true '
    '— eine Achse allein könnte beide nicht trennen (0343).';
comment on column public.fee_classification.zugeordnet_am is
    'Zeitpunkt der Zuordnungs-Entscheidung. Bewusst nicht updated_at: das ist '
    'unsere Uhr für jede Zeilenänderung (Wurzel 5b, 0343).';


-- =========================================================================
-- (B) ABRECHNUNGSVERTRAG — die Vereinbarung mit Zeitachse
-- =========================================================================
-- Eine eigene Konfigurationsebene neben `owners.default_commission_pct` und
-- `owner_properties.commission_override_pct`. Die beiden bleiben in dieser
-- Etappe FÜHREND und werden nicht angefasst; der Vertrag ist die Form, in
-- die sie beim späteren Umstieg übergehen.
--
-- WARUM EINE ZEITACHSE ZWINGEND IST:
-- Ohne `gueltig_ab`/`gueltig_bis` gäbe es je Eigentümer genau EINEN Satz —
-- den aktuellen. Ändert die Agentur ihn im September, rechnete ein danach
-- erzeugtes Juli-Statement mit dem September-Satz. Ein Statement für einen
-- vergangenen Zeitraum muss aber immer dasselbe Ergebnis liefern, egal wann
-- es erzeugt wird; sonst ist jede Vertragsänderung ein rückwirkender
-- Eingriff in bereits ausgezahlte Abrechnungen. Der Vertrag wird deshalb
-- nicht überschrieben, sondern abgelöst: der alte bekommt ein `gueltig_bis`,
-- der neue ein `gueltig_ab`. Das ist zugleich die Historie, die die
-- Oberfläche zeigt (nicht nur der aktuelle Stand).
--
-- Die Zeitachse ist HALB OFFEN [gueltig_ab, gueltig_bis): der letzte Tag ist
-- ausgeschlossen. Grund: nur so ist der lückenlose Anschluss zweier Verträge
-- eindeutig — der Nachfolger beginnt genau an dem Tag, an dem der Vorgänger
-- endet, ohne dass ein Tag zu beiden gehört. Bei geschlossenen Intervallen
-- müsste jede Ablösung „einen Tag vorher" rechnen, und ein Off-by-one
-- erzeugte einen Tag mit zwei gültigen Verträgen.
-- =========================================================================

create table if not exists public.owner_billing_terms (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,

    -- Für WEN der Vertrag gilt.
    owner_id uuid not null references public.owners(id) on delete cascade,
    -- NULL = für alle Objekte dieses Eigentümers. Gesetzt = nur für dieses
    -- Objekt, und schlägt den Eigentümer-Vertrag (Vorrangprinzip wie
    -- commission_override_pct vor default_commission_pct).
    property_id uuid references public.properties(id) on delete cascade,

    -- ZEITACHSE, halb offen [gueltig_ab, gueltig_bis).
    gueltig_ab date not null,
    -- NULL = läuft bis auf Weiteres. Das ist ein echter Zustand („der Vertrag
    -- gilt unbefristet") und kein fehlender Wert — deshalb NULL und kein
    -- Fantasie-Datum wie 9999-12-31.
    gueltig_bis date,
    check (gueltig_bis is null or gueltig_bis > gueltig_ab),

    -- Der Provisionssatz des Vertrags. NOT NULL ohne Default: fehlt der Satz,
    -- gibt es keinen Vertrag. Ein `default 0` wäre „der Betrieb arbeitet
    -- umsonst" — genau der Fehler, den `owners.default_commission_pct` heute
    -- noch macht (siehe Anmerkung am Dateiende).
    provisions_pct numeric(5,2) not null check (provisions_pct >= 0 and provisions_pct <= 100),

    -- MINDESTPROVISION JE BUCHUNG.
    -- Unterschreitet die berechnete Provision diesen Betrag, gilt der
    -- Mindestbetrag. Der Anlass ist messbar und kein Vorsichtsdenken: in den
    -- Echtdaten gibt es zwei Buchungen, deren bereinigte Basis NEGATIV ist,
    -- weil die pauschale Reinigungsgebühr bei einem Kurzaufenthalt größer ist
    -- als der Übernachtungsertrag. Ohne Mindestprovision ergäbe die Formel
    -- dort eine negative Provision — der Betrieb zahlte dem Eigentümer dafür,
    -- dass er seine Wohnung verwaltet.
    -- NULL = keine Mindestprovision vereinbart (echter Zustand, kein Loch).
    min_provision_betrag numeric(12,2)
        check (min_provision_betrag is null or min_provision_betrag >= 0),
    -- Währung des Mindestbetrags. Steht EXPLIZIT am Vertrag und wird NICHT
    -- vom Objekt abgeleitet: 50 DKK sind 50 DKK, auch wenn ein Objekt in EUR
    -- verkauft. Eine Ableitung aus der Objektwährung würde denselben
    -- vereinbarten Betrag je nach Objekt still in eine andere Währung
    -- umdeuten (Wurzel 4).
    min_provision_currency text
        check (min_provision_currency is null
               or min_provision_currency ~ '^[A-Z]{3}$'),
    -- Betrag und Währung sind untrennbar: eine Zahl ohne Währung ist kein
    -- Geldbetrag, eine Währung ohne Zahl ist keine Vereinbarung.
    check ((min_provision_betrag is null) = (min_provision_currency is null)),

    -- PAUSCHALE JE BUCHUNG — bewusst OPTIONAL, kein Pflichtfeld.
    -- Nicht jeder Betrieb erhebt sie; ein Pflichtfeld erzwänge eine 0, und
    -- „0,00 Pauschale" ist etwas anderes als „keine Pauschale vereinbart".
    pauschale_betrag numeric(12,2)
        check (pauschale_betrag is null or pauschale_betrag >= 0),
    pauschale_currency text
        check (pauschale_currency is null or pauschale_currency ~ '^[A-Z]{3}$'),
    -- Bezugsgröße: einmal je Buchung oder je Nacht.
    pauschale_basis text
        check (pauschale_basis is null
               or pauschale_basis in ('je_buchung', 'je_nacht')),
    -- WANN sie abgezogen wird. Das ist keine Formalie: `vor_provision`
    -- verkleinert die Bemessungsgrundlage und damit auch die Provision,
    -- `nach_provision` wird erst vom fertigen Eigentümer-Betrag abgezogen.
    -- Dieselbe Pauschale ergibt je nach Zeitpunkt zwei verschiedene Zahlen.
    pauschale_zeitpunkt text
        check (pauschale_zeitpunkt is null
               or pauschale_zeitpunkt in ('vor_provision', 'nach_provision')),
    -- Alles-oder-nichts: entweder die Pauschale ist vollständig vereinbart
    -- (Betrag, Währung, Basis, Zeitpunkt) oder sie ist nicht vereinbart. Ein
    -- Betrag ohne Zeitpunkt wäre nicht ausrechenbar, und die Rechenkette
    -- müsste sich einen aussuchen.
    check (
        (pauschale_betrag is null and pauschale_currency is null
         and pauschale_basis is null and pauschale_zeitpunkt is null)
        or
        (pauschale_betrag is not null and pauschale_currency is not null
         and pauschale_basis is not null and pauschale_zeitpunkt is not null)
    ),

    notiz text,

    -- Urheber der Vereinbarung (Geldwirkung, siehe fee_classification).
    erstellt_von uuid references public.users(id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Der Auflösungspfad: „welcher Vertrag galt für diesen Eigentümer/dieses
-- Objekt am Tag X". Genau die Spalten in genau der Reihenfolge, in der die
-- Auflösung filtert.
create index if not exists owner_billing_terms_owner_idx
    on public.owner_billing_terms (tenant_id, owner_id, property_id, gueltig_ab desc);

-- ÜBERLAPPUNGSSCHUTZ auf DB-Ebene, nicht nur im Service.
-- Zwei gültige Verträge am selben Tag für dieselbe Geltung wären die eine
-- Situation, in der die Auflösung raten müsste. Das lässt sich im Service
-- nicht dicht bekommen: zwei gleichzeitige Anlagen prüfen beide gegen den
-- Stand VOR der jeweils anderen und legen beide an (Wurzel 2). Der Constraint
-- ist der Backstop darunter.
--
-- Umgesetzt als EXCLUDE über daterange. `gueltig_bis` NULL heißt „offen" —
-- daterange(ab, NULL) ist in Postgres genau das (obere Grenze unendlich),
-- es braucht also kein Ersatzdatum. Zwei Constraints, weil `property_id`
-- NULL-fähig ist: in einem GIST-Vergleich ist NULL nicht gleich NULL, ein
-- gemeinsamer Constraint ließe überlappende Eigentümer-Verträge durch.
--
-- btree_gist wird gebraucht, um uuid-Gleichheit (=) mit dem Range-Overlap
-- (&&) in einem Constraint zu mischen.
create extension if not exists btree_gist;

alter table public.owner_billing_terms
    drop constraint if exists owner_billing_terms_owner_kein_ueberlapp;
alter table public.owner_billing_terms
    add constraint owner_billing_terms_owner_kein_ueberlapp
    exclude using gist (
        owner_id with =,
        daterange(gueltig_ab, gueltig_bis, '[)') with &&
    ) where (property_id is null);

alter table public.owner_billing_terms
    drop constraint if exists owner_billing_terms_objekt_kein_ueberlapp;
alter table public.owner_billing_terms
    add constraint owner_billing_terms_objekt_kein_ueberlapp
    exclude using gist (
        owner_id with =,
        property_id with =,
        daterange(gueltig_ab, gueltig_bis, '[)') with &&
    ) where (property_id is not null);

comment on table public.owner_billing_terms is
    'Abrechnungsvertrag je Eigentümer (optional je Objekt) MIT ZEITACHSE. Ein '
    'Statement für einen vergangenen Zeitraum rechnet mit dem damals gültigen '
    'Vertrag, egal wann es erzeugt wird. Objekt schlägt Eigentümer (0343).';
comment on column public.owner_billing_terms.property_id is
    'NULL = gilt für alle Objekte des Eigentümers. Gesetzt = nur dieses Objekt '
    'und schlägt den Eigentümer-Vertrag (0343).';
comment on column public.owner_billing_terms.gueltig_ab is
    'Beginn der Geltung, einschließlich. Intervall ist halb offen '
    '[gueltig_ab, gueltig_bis) — der Nachfolger beginnt am Endtag des '
    'Vorgängers, kein Tag gehört zu zwei Verträgen (0343).';
comment on column public.owner_billing_terms.gueltig_bis is
    'Ende der Geltung, AUSSCHLIESSLICH. NULL = unbefristet (echter Zustand, '
    'kein Fantasie-Datum 9999-12-31) (0343).';
comment on column public.owner_billing_terms.min_provision_betrag is
    'Mindestprovision je Buchung. Unterschreitet die berechnete Provision '
    'diesen Betrag, gilt der Mindestbetrag. Anlass: Kurzaufenthalte, bei denen '
    'die pauschale Reinigungsgebühr die Buchung aufzehrt — live zwei Buchungen '
    'mit negativer bereinigter Basis. NULL = nicht vereinbart (0343).';
comment on column public.owner_billing_terms.min_provision_currency is
    'Währung der Mindestprovision, EXPLIZIT am Vertrag. Nicht aus dem Objekt '
    'abgeleitet: 50 DKK sind 50 DKK, auch wenn ein Objekt in EUR verkauft '
    '(Wurzel 4, 0343).';
comment on column public.owner_billing_terms.pauschale_zeitpunkt is
    'vor_provision verkleinert die Bemessungsgrundlage (und damit die '
    'Provision), nach_provision wird erst vom Eigentümer-Betrag abgezogen. '
    'Dieselbe Pauschale ergibt je nach Zeitpunkt zwei verschiedene Zahlen (0343).';


-- =========================================================================
-- updated_at-Trigger (Bestandsfunktion aus 0015)
-- =========================================================================
drop trigger if exists set_updated_at on public.fee_classification;
create trigger set_updated_at before update on public.fee_classification
    for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.owner_billing_terms;
create trigger set_updated_at before update on public.owner_billing_terms
    for each row execute function public.set_updated_at();


-- =========================================================================
-- WURZEL 6 — DER DB-DIREKTPFAD
-- =========================================================================
-- Beide Tabellen sind FINANZTABELLEN. `owner_billing_terms` enthält den
-- Provisionssatz, den ein Betrieb mit einem bestimmten Eigentümer vereinbart
-- hat — die Kernkonditionen seines Geschäfts. `fee_classification` sagt,
-- welche Erträge er für sich behält. Beides geht eine Reinigungskraft oder
-- einen Eigentümer desselben Mandanten nichts an (§4.3), und beides darf
-- niemand von außen ÄNDERN: wer `provisions_pct` auf 0 setzt, verschiebt bei
-- der nächsten Abrechnung echtes Geld.
--
-- `enable rls` + Tenant-Policy reicht dafür ausdrücklich NICHT. Ein
-- eingeloggter Nutzer mit gültigem JWT und dem ÖFFENTLICHEN anon-Key spricht
-- PostgREST direkt an und umgeht die FastAPI vollständig — jede Prüfung im
-- Service ist auf diesem Weg wirkungslos. Die Tenant-Policy ließe ihn
-- tenant-WEIT lesen und schreiben, also genau das, was hier verhindert
-- werden muss.
--
-- Deshalb der vollständige Riegel: alle vier Rechte für BEIDE Client-Rollen
-- entzogen, plus eine RESTRICTIVE `for all`-Policy als zweite Schicht (nicht
-- nur `for select` — sonst bliebe der Schreibpfad offen). Gelesen und
-- geschrieben wird ausschließlich per service_role (rolbypassrls = t) durch
-- die API, die den Scope und die Rolle dort erzwingt.
--
-- Gegenprobe (eingeloggter cleaner, anon-Key):
--   curl        /rest/v1/owner_billing_terms → 42501 permission denied
--   curl -X POST/PATCH/DELETE …              → 42501 permission denied
-- Belegt durch `scripts/security/direktpfad-pruefen.sh` (acht Kombinationen
-- je Tabelle per echtem `set local role`).
-- =========================================================================

alter table public.fee_classification enable row level security;
alter table public.owner_billing_terms enable row level security;

-- Permissive Tenant-Policy. Sie ist NICHT der Schutz (der liegt im revoke),
-- sondern die Grundlage dafür, dass eine spätere gezielte Öffnung — sollte
-- sie je fachlich gewollt sein — nicht versehentlich tenant-übergreifend
-- wirkt. Ohne sie wäre eine solche Öffnung sofort ein Datenleck.
drop policy if exists fee_classification_tenant on public.fee_classification;
create policy fee_classification_tenant on public.fee_classification
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists owner_billing_terms_tenant on public.owner_billing_terms;
create policy owner_billing_terms_tenant on public.owner_billing_terms
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- RESTRICTIVE-Guard: gilt UND-verknüpft zu jeder permissiven Policy und
-- schließt damit auch jede künftig ergänzte. `for all`, nicht `for select`.
drop policy if exists fee_classification_write_restrict on public.fee_classification;
create policy fee_classification_write_restrict on public.fee_classification
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists owner_billing_terms_write_restrict on public.owner_billing_terms;
create policy owner_billing_terms_write_restrict on public.owner_billing_terms
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Der eigentliche Riegel. Erst alles entziehen, dann nichts wieder gewähren:
-- ein späteres Spalten-GRANT griffe ohnehin nicht, solange ein pauschales
-- Tabellen-GRANT bestünde (Reihenfolge wie in 0314).
revoke all on public.fee_classification from anon, authenticated;
revoke all on public.owner_billing_terms from anon, authenticated;

-- Realtime-Folge, ausdrücklich festgehalten: beide Tabellen kommen NICHT in
-- die Publikation `supabase_realtime`. Ein Abo darauf wäre eine stumme
-- Attrappe (ohne SELECT-Grant passt keine Policy) — die UI sähe live aus und
-- aktualisierte nie. Die Pflegemasken laden über die API und aktualisieren
-- nach der eigenen Aktion; das ist hier der richtige Weg, weil die Daten sich
-- ausschließlich durch eine Handlung genau dieses Nutzers ändern.


-- =========================================================================
-- NEBENBEFUND, BEWUSST NICHT IN DIESER MIGRATION GEFIXT
-- =========================================================================
-- `public.owners.default_commission_pct` ist `numeric not null default 0`.
-- Wer einen Eigentümer anlegt, ohne einen Satz einzugeben, bekommt damit
-- still 0 % Provision — der Eigentümer erhält 100 % des Ertrags und der
-- Betrieb nichts. Das ist ein bestehender Wurzel-4-Verstoß: ein plausibler
-- Ersatzwert an der Stelle, an der ein Datenfehler stehen müsste.
-- `common.effektive_provision_pct` würde bei NULL korrekt
-- `PayoutUnbekannt("provision")` werfen — nur kommt dort nie NULL an, weil
-- die Spalte es nicht zulässt.
--
-- Warum hier NICHT gefixt: ein `drop default` + `alter column drop not null`
-- ist harmlos, aber die vorhandene 0 lässt sich nicht unterscheiden — sie
-- kann „bewusst 0 % vereinbart" ODER „nie ausgefüllt" bedeuten. Ein
-- pauschales `update … set default_commission_pct = null where … = 0` würde
-- bewusste Nullsätze zerstören. Die Bereinigung gehört deshalb an den
-- Umstieg der Rechenkette und läuft dann so:
--   1. Der Vertrag (owner_billing_terms) wird führend. Er hat `provisions_pct
--      not null` ohne Default — dort kann die Lücke gar nicht erst entstehen.
--   2. Für jeden Eigentümer OHNE Vertrag wird in der Oberfläche ein Vertrag
--      angelegt; die Agentur bestätigt dabei den Satz (auch wenn er 0 ist).
--      Damit wird aus jeder unklaren 0 eine bestätigte Entscheidung.
--   3. Erst wenn jeder Eigentümer eines Betriebs einen Vertrag hat, verliert
--      `owners.default_commission_pct` seine Rolle; die Spalte wird auf
--      nullable gesetzt, der Default entfernt und die Spalte als Altbestand
--      kommentiert — ohne eine einzige Bestandszeile zu ändern.
-- =========================================================================
