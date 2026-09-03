-- Dritte App-Kennung fuer Push: die Eigentuemer-App (ADR-0022).
--
-- Bis hier kannte `push_devices.app` genau zwei Werte, weil es zwei Apps gab
-- (ADR-0019). Mit `mobile-owner` ist das falsch geworden, und zwar auf die
-- gefaehrliche Art: die App meldete sich als `mynextdays` an. Ein Eigentuemer
-- haette damit die Push-Meldungen der BETRIEBS-App auf sein Telefon bekommen —
-- `betrieb_buchung` und `messages` sind Meldungen fuer die Verwaltung, nicht
-- fuer ihn. Der Empfaenger entscheidet sich hier am Geraet, nicht am Konto
-- (Wurzel 3: Scope serverseitig erzwingen, nicht der Anfrage vertrauen).
--
-- Der `check` ist eine Allowlist und bleibt eine: ein unbekannter Wert soll mit
-- 23514 auffliegen und nicht als neue stille Kategorie durchlaufen (Wurzel 4).
alter table public.push_devices
    drop constraint if exists push_devices_app_check;

alter table public.push_devices
    add constraint push_devices_app_check
    check (app in ('mynextdays', 'mybestdays', 'mynextdaysowner'));

comment on column public.push_devices.app is
    'Welche der DREI Apps das Geraet ist (ADR-0019/0022): mynextdays (PMS), '
    'mybestdays (Marktplatz), mynextdaysowner (Eigentuemer). Der Versand '
    'waehlt die Empfaenger hierueber — ein falscher Wert schickt fremde '
    'Meldungen auf ein Telefon.';


-- Push-Kanal fuer die drei EIGENTUEMER-Kategorien.
--
-- Warum das hierher gehoert und nicht in den Code allein: `soll_senden` liest
-- pro Kategorie und Kanal eine Spalte `<schluessel>_<kanal>`. Wer im Katalog
-- den PUSH-Kanal vergibt, ohne die Spalte anzulegen, baut eine Attrappe — der
-- Nutzer sieht keinen Schalter, und der Versand fragt einen Wert, den es nicht
-- gibt. Dieselbe Klasse Fehler wie ein Realtime-Abo ohne Grant.
--
-- Default `true` wie bei allen bestehenden Push-Spalten: wer die App
-- installiert, will die Meldungen; abwaehlen kann er sie in den Einstellungen.
alter table public.notification_settings
    add column if not exists owner_booking_push boolean not null default true,
    add column if not exists owner_service_push boolean not null default true,
    add column if not exists block_decision_push boolean not null default true;

comment on column public.notification_settings.owner_booking_push is
    'Push in die Eigentuemer-App bei Buchung/Aenderung/Storno am eigenen Objekt.';
comment on column public.notification_settings.owner_service_push is
    'Push in die Eigentuemer-App bei Dienstleistungen am eigenen Objekt.';
comment on column public.notification_settings.block_decision_push is
    'Push in die Eigentuemer-App bei Entscheidung ueber den eigenen Sperrantrag.';
