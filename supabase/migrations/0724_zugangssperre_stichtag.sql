-- 0724 — Stichtag einer Zugangssperre am Betrieb.
--
-- WOZU: Endet der Zugang eines Betriebs zu einem festen Zeitpunkt, muss der
-- Betrieb das VOR dem Stichtag sehen, und zwar dort, wo er arbeitet. Eine Mail
-- allein reicht nicht — sie wird gelesen, weggelegt und vergessen; wer im
-- Dashboard steht, liest sie nicht. Das Band im PMS haengt an dieser Spalte.
--
-- WARUM EIN DATUM AM BETRIEB und keine feste Kennung im Frontend: eine
-- eingetragene tenant_id waere ein Hardcode (Wurzel 4) — beim naechsten Fall
-- muesste jemand den Quelltext anfassen, und der Hinweis bliebe stehen, wenn
-- die Sperre abgesagt wird. So ist es ein Datum: gesetzt = Band sichtbar,
-- geleert = Band weg. Dieselbe Bauart wie das Testphasen-Band (0488), das an
-- `trial_ends_at` haengt.
--
-- NULL heisst „keine Sperre geplant" — kein erfundener Ersatzwert, keine
-- Sperre aus Versehen (Wurzel 4/5).
--
-- KEINE WIRKUNG AUF DEN ZUGANG: Diese Spalte ist eine ANKUENDIGUNG, kein
-- Riegel. Sie sperrt niemanden aus. Wer daraus spaeter eine echte Sperre
-- ableitet, baut sie serverseitig (Wurzel 7 — im Frontend waere sie durch den
-- direkten GoTrue-Login umgehbar) und traegt das hier nach.
--
-- RLS/GRANTS: `tenants` ist seit 0337:669 fuer anon und authenticated
-- vollstaendig entzogen (select, insert, update, delete). Eine neue Spalte
-- erbt diesen Zustand; der Wert erreicht die Oberflaeche ausschliesslich ueber
-- `/auth/me`, das mit service_role liest. Kein neuer Grant noetig, und
-- ausdruecklich keiner gewollt (Wurzel 6).

-- KEIN eigenes `begin`/`commit`: `supabase/apply-migrations.sh` klammert jede
-- Migration zusammen mit ihrem schema_migrations-Eintrag in EINE Transaktion.
-- Ein `commit` hier schloesse diese Klammer vorzeitig — der Tracking-Eintrag
-- liefe dann ausserhalb. Dieselbe Bauart wie 0720-0722.

alter table public.tenants
    add column if not exists zugang_gesperrt_ab timestamptz;

comment on column public.tenants.zugang_gesperrt_ab is
    'Stichtag einer angekuendigten Zugangssperre. NULL = keine geplant. '
    'Reine Ankuendigung fuer das Band im PMS, kein Riegel — die Sperre selbst '
    'waere serverseitig zu bauen.';
