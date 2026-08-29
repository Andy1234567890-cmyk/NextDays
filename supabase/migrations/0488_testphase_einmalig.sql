-- 0488 — Kostenlose Testphase: einmal pro Betrieb
--
-- WARUM: Die Marketing-Seite wirbt an 14 Stellen je Sprache mit „14 Tage
-- kostenlos testen". Gebaut war davon nichts — der Checkout schickte keinen
-- `trial_period_days`, Stripe zog also sofort ein. Der Status `trialing` stand
-- zwar im Enum und wurde von jeder Schranke akzeptiert, aber nie ERZEUGT: die
-- Empfangsseite war fertig, der Absender fehlte.
--
-- Diese Spalte ist der Riegel gegen die Wiederholung (Wurzel 2 — real kommt
-- alles doppelt): ohne sie kuendigt man am vorletzten Tag und schliesst neu ab,
-- beliebig oft kostenlos. Gestempelt wird sie vom Stripe-Webhook, sobald der
-- Status das erste Mal `trialing` lautet — massgeblich ist die TATSACHE aus
-- Stripe, nicht unsere Absicht beim Checkout (Wurzel 5b: fremdes Ereignis,
-- fremder Zeitpunkt; `created_at` waere hier die falsche Uhr).
--
-- NULL heisst „Testphase noch offen". Bestandskunden bleiben damit auf NULL —
-- fachlich richtig, denn sie hatten nie eine: bis heute konnte keine entstehen.

alter table public.tenant_subscription
    add column if not exists trial_used_at timestamptz;

comment on column public.tenant_subscription.trial_used_at is
    'Beginn der EINEN kostenlosen Testphase dieses Betriebs (aus Stripe, '
    'gesetzt beim ersten Status "trialing"). NULL = Testphase noch offen. '
    'Wird nie zurueckgesetzt — sie steht genau einmal zu.';

-- Kein GRANT noetig: tenant_subscription ist per 0224/0337 fuer anon und
-- authenticated bereits vollstaendig gesperrt (Wurzel 6 — Finanzdaten gehen
-- ausschliesslich ueber den Server). Eine neue Spalte erbt diese Sperre.

-- ---------------------------------------------------------------------------
-- Praeferenzspalte fuer die Erinnerung „Testphase endet in 3 Tagen"
-- ---------------------------------------------------------------------------
-- Jede Katalog-Kategorie braucht ihre Spalte je Kanal (Muster aus 0408). Die
-- Kategorie fuehrt NUR den Kanal E-Mail, also entsteht auch nur diese eine.

alter table public.notification_settings
    add column if not exists testphase_endet_email boolean not null default true;

comment on column public.notification_settings.testphase_endet_email is
    'Erinnerung, dass die kostenlose Testphase in drei Tagen endet (0488). '
    'NICHT abwaehlbar (email_pflicht): am Tag darauf zieht Stripe den ersten '
    'Beitrag ein — ohne Vorwarnung waere das eine Belastung aus dem Nichts.';
