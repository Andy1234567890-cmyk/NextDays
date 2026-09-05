-- 0567 — Antwortfrist der Portal-Bewertung speichern.
--
-- Channex liefert je Review `expired_at`: der Zeitpunkt, bis zu dem das Portal
-- eine öffentliche Antwort annimmt. Gespiegelt wurde bisher nur `is_expired`
-- (ja/nein). Damit sah der Betrieb 130 unbeantwortete Airbnb-Bewertungen als
-- „Offen" neben 28, die wirklich noch beantwortbar waren — und bei keiner, wie
-- lange noch (05.09.2026). Der Zeitpunkt ist eine Aussage des Portals, kein
-- eigener Wert (Wurzel 4/5b): fehlt er, bleibt die Spalte leer.
alter table public.channex_review
    add column if not exists reply_expires_at timestamptz;

comment on column public.channex_review.reply_expires_at is
    'Antwortfrist des Portals (Channex `expired_at`). NULL = vom Portal nicht '
    'gemeldet. `is_expired` bleibt die verbindliche Ja/Nein-Aussage.';
