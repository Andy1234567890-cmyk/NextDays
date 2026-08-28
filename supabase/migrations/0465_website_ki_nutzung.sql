-- 0465 — Jeder KI-Aufruf wird gezählt, bevor jemand ihn bezahlen muss
--
-- In dieser Runde gibt es KEIN Guthabensystem. Diese Tabelle ist trotzdem da,
-- und das ist der ganze Punkt: eine Zählung, die man erst einführt, wenn man
-- abrechnen will, hat für die Vergangenheit nichts. Man weiß dann nicht, was
-- ein Betrieb im Schnitt verbraucht, kann kein Kontingent bemessen und muss
-- die erste Zahl raten. Deshalb steht die Zählung ab dem ersten Aufruf.
--
-- Duda zählt für die drei Funktionen, die wir hier bauen (Umschreiben, SEO,
-- Alt-Text), ausdrücklich KEINE Credits — nur die Bild-Erzeugung kostet dort.
-- Wir bauen keine Bild-Erzeugung. Ein Guthaben wäre heute also eine Rechnung
-- ohne Posten. Der Deckel je Betrieb und Tag
-- (`Settings.ki_tageslimit_je_tenant`) ist etwas anderes als ein Guthaben: er
-- schützt vor der außer Kontrolle geratenen Schleife, nicht vor dem Nutzen.
--
-- WAS EINE ZEILE IST: ein Aufruf an das Modell, erfolgreich oder nicht.
-- Fehlgeschlagene stehen mit `erfolg = false` und ihrem Grund darin. Sie
-- zählen NICHT gegen den Tagesdeckel (ein Netzwerkfehler ist nicht das
-- Verschulden des Betriebs und kostet auch nichts), aber sie stehen im
-- Diagnosepfad — „die KI geht nicht" ist sonst eine Aussage ohne Beleg.
--
-- WARUM KEINE ZÄHLERSPALTE AM TENANT: ein `ki_aufrufe_heute`-Integer wäre
-- billiger zu lesen und wertlos zu allem anderen. Er beantwortet nicht, WOFÜR
-- die Aufrufe gingen, ob sie durchliefen, wie lange sie dauerten und wie viele
-- Tokens sie kosteten. Genau das braucht ein späteres Guthaben, und genau das
-- braucht die Fehlersuche. Eine Zeile je Aufruf bei zweistelligen Zahlen pro
-- Tag und Betrieb ist keine Datenmenge, über die man nachdenken muss.

create table if not exists public.site_ai_usage (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null
                references public.tenants (id) on delete cascade,

    -- Wer den Knopf gedrückt hat. Ohne Fremdschlüssel auf `users`: die
    -- Zählung ist ein Protokoll und soll erhalten bleiben, wenn ein
    -- Mitarbeiter das Konto verlässt. Ein `on delete set null` wäre die
    -- Alternative, verliert aber genau die Auskunft, für die man später
    -- nachsieht.
    user_id     uuid,

    -- Welche Funktion. Dieselben Namen wie im Dienst (`ki_texte.py`), damit
    -- eine Auswertung nicht übersetzen muss.
    funktion    text not null,

    -- Modell und Region. Beides gehört ins Protokoll und nicht nur ins Log:
    -- die Frage „wurde dieser Text in der EU verarbeitet?" ist eine Frage an
    -- die Daten, nicht an eine Logzeile, die nach 14 Tagen rotiert ist.
    modell      text not null,
    region      text not null,

    tokens_ein  integer not null default 0,
    tokens_aus  integer not null default 0,
    dauer_ms    integer not null default 0,

    erfolg      boolean not null,
    -- Bei erfolg = false: die Ursache in einem Satz. Kein Stacktrace, keine
    -- Anbieter-Antwort im Rohzustand — die könnte Kundendaten aus dem Prompt
    -- zurückspiegeln.
    fehler_grund text,

    -- Der Kalendertag in UTC, auf den der Tagesdeckel zählt. Als eigene,
    -- gespeicherte Spalte statt `created_at::date` in der Abfrage, damit der
    -- Index greift.
    --
    -- UTC und nicht die Zeitzone des Betriebs: ein Deckel, der je nach
    -- Sommerzeit um eine Stunde springt, ist nicht erklärbar, und die
    -- CI läuft in UTC (Memory „tests-nie-zeitzonenabhaengig"). Der Preis ist,
    -- dass der Tag für einen dänischen Betrieb um 01:00 bzw. 02:00 Uhr
    -- wechselt — bei einem Deckel, den im Normalbetrieb niemand sieht, ist das
    -- der günstigere Fehler.
    tag         date not null default ((now() at time zone 'utc')::date),

    created_at  timestamptz not null default now(),

    constraint site_ai_usage_funktion_check check (funktion in (
        'umschreiben',
        'seo',
        'alt_text',
        'abschnitt',
        'blogbeitrag',
        'profil_vorschlag'
    )),
    constraint site_ai_usage_fehler_grund_laenge check (
        fehler_grund is null or char_length(fehler_grund) <= 500
    ),
    -- Negative Tokenzahlen gibt es nicht. Ohne diese Schranke rutscht ein
    -- Vorzeichenfehler in der Auswertung durch und macht eine spätere
    -- Abrechnung leise falsch.
    constraint site_ai_usage_zahlen_nicht_negativ check (
        tokens_ein >= 0 and tokens_aus >= 0 and dauer_ms >= 0
    )
);

-- Der Lesepfad des Tagesdeckels: „wie viele ERFOLGREICHE Aufrufe hat dieser
-- Betrieb heute gemacht?" Er läuft VOR jedem Aufruf und ist damit der
-- häufigste Zugriff auf diese Tabelle.
create index if not exists site_ai_usage_deckel_idx
    on public.site_ai_usage (tenant_id, tag)
    where erfolg;

-- Der Lesepfad der Diagnose: „was ist heute schiefgegangen?"
create index if not exists site_ai_usage_fehler_idx
    on public.site_ai_usage (tenant_id, created_at desc)
    where not erfolg;

comment on table public.site_ai_usage is
    'Ein Protokolleintrag je KI-Aufruf des Website-Baukastens. Trägt den '
    'Tagesdeckel je Betrieb und ist die Grundlage, auf der ein späteres '
    'Guthabensystem rechnen kann — deshalb steht sie ab dem ersten Aufruf und '
    'nicht erst, wenn abgerechnet werden soll.';
comment on column public.site_ai_usage.region is
    'Vertex-AI-Region des Aufrufs (z. B. europe-west4). Im Protokoll und '
    'nicht nur im Log, weil "wurde das in der EU verarbeitet?" eine Frage an '
    'die Daten ist und Logzeilen rotieren.';
comment on column public.site_ai_usage.erfolg is
    'Fehlgeschlagene Aufrufe zählen NICHT gegen den Tagesdeckel — sie kosten '
    'nichts und sind nicht das Verschulden des Betriebs. Sie stehen hier für '
    'die Fehlersuche.';

alter table public.site_ai_usage enable row level security;

drop policy if exists site_ai_usage_tenant on public.site_ai_usage;
create policy site_ai_usage_tenant on public.site_ai_usage
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: Das ist ein VERBRAUCHSPROTOKOLL und damit die Vorstufe einer
-- Rechnung. Es gehört in dieselbe Klasse wie payments und commission_ledger:
-- der Server schreibt, der Server liest, niemand sonst.
--
-- Besonders der Schreibpfad: wer hier Zeilen anlegen oder löschen könnte,
-- könnte den Tagesdeckel eines Wettbewerbers im selben System füllen (Denial
-- of Service) oder den eigenen Verbrauch verschwinden lassen. Ein reines
-- `revoke select` hätte genau diese Lücke offen gelassen.
revoke select, insert, update, delete on public.site_ai_usage
    from anon, authenticated;

drop policy if exists site_ai_usage_kein_direktpfad on public.site_ai_usage;
create policy site_ai_usage_kein_direktpfad on public.site_ai_usage
    as restrictive for all to anon, authenticated
    using (false) with check (false);

comment on policy site_ai_usage_kein_direktpfad on public.site_ai_usage is
    'Verbrauchsprotokoll = Vorstufe einer Rechnung. Restriktiv in ALLE '
    'Richtungen: wer schreiben könnte, könnte den Tagesdeckel eines fremden '
    'Betriebs füllen oder den eigenen Verbrauch tilgen.';

-- KEIN Eintrag in supabase_realtime — dieselbe Regel wie bei den Finanzen:
-- eine Tabelle, die Wurzel 6 bewusst sperrt, wird nicht per Grant für ein Abo
-- geöffnet. Die Verbrauchsanzeige im Dashboard holt ihren Stand über die API
-- (`GET /site-config/ki/status`), nicht über ein Abo.
