-- ============================================================================
-- Push für „neue Aufgabe" (task_assigned)
--
-- Anlass (15.09.2026, gemeldet vom Nutzer): „Push bei neuer Nachricht,
-- neuer Aufgabe, neuer Buchung — das geht nicht."
--
-- Nachricht und Buchung scheiterten an einer falschen Adressierung in der
-- FCM-Nutzlast (`fid` statt `token`, push.py). Die AUFGABE hatte darüber
-- hinaus nie einen Push-Kanal: `Kategorie("task_assigned", …, _MAIL_SMS)`
-- kennt nur E-Mail und SMS, und der Dispatcher iteriert ausschließlich über
-- `kategorie.kanaele`. Es war also kein Fehler im Versand, sondern eine
-- Auslassung im Katalog — und ohne die Spalte hier bliebe sie bestehen, weil
-- die Einstellung sonst nirgends abgelegt werden kann.
--
-- Default TRUE wie bei `task_substitution_push` (0415) und aus demselben
-- Grund: eine zugewiesene Aufgabe hat einen Zeitpunkt. Wer eine Reinigung für
-- heute Nachmittag zugeteilt bekommt, erfährt es per Mail unter Umständen
-- erst abends. Abwählbar bleibt es (in /konto), anders als die Glocke.
--
-- SMS wird hier NICHT angefasst: `task_assigned_sms` existiert bereits (0331).
-- ============================================================================

alter table public.notification_settings
    add column if not exists task_assigned_push boolean not null default true;

comment on column public.notification_settings.task_assigned_push is
    'Push bei zugewiesener Aufgabe. Default AN — eine Aufgabe hat einen Termin, '
    'und die Mail wird oft erst nach Feierabend gelesen. Abwählbar in /konto.';
