-- 0577_schloss_anbieter_module.sql — je Schloss-Hersteller ein buchbares Modul
--
-- Der CHECK auf `tenant_module_entitlement.module_key` (0117, letzter Stand
-- 0278) listet die Module NAMENTLICH auf. Ohne diese Migration läuft der
-- Upsert in `SubscriptionsService.add_module` live in einen
-- 23514-Constraint-Fehler: der Kunde klickt „Aktivieren", bekommt einen 500,
-- und das Modul bleibt aus. In den Tests fällt das nicht auf, weil der DB-Fake
-- keine CHECKs kennt — deshalb erzwingt `test_modul_keys_migration` die
-- Deckungsgleichheit zwischen `MODULE_KEYS` im Code und dieser Definition.
-- Genau dieser Test hat die fehlende Migration hier gemeldet.
--
-- WAS SICH ÄNDERT: 32 Anbieter-Module kommen dazu (`schloss_igloohome`,
-- `schloss_nuki`, …). Die Kennung nach dem Präfix ist Seams eigener
-- Provider-Name — damit ist die Verbindung zwischen gebuchtem Modul und dem
-- Provider-Filter im Connect Webview eindeutig, und ein Hersteller heißt bei
-- uns nicht anders als bei Seam.
--
-- ABGRENZUNG ZU 0574: dort wurde je GERÄT abgerechnet (3 EUR/Schloss/Monat).
-- Das ist mit dieser Migration stillgelegt — abgerechnet wird je Anbieter als
-- Abo-Modul über Stripe. Beides gleichzeitig hätte den Betrieb doppelt
-- belastet. Die Tabelle `schloesser_ledger` bleibt bestehen: offene Zeilen aus
-- der Zeit davor werden noch fakturiert (erbrachte Leistung), neue entstehen
-- nicht mehr.
--
-- Keine neue Tabelle → kein neuer RLS-/Grant-Bedarf; die Policies und Grants
-- von `tenant_module_entitlement` (0117/0224) gelten unverändert weiter.

alter table public.tenant_module_entitlement
    drop constraint if exists tenant_module_entitlement_module_key_check;

alter table public.tenant_module_entitlement
    add constraint tenant_module_entitlement_module_key_check
    check (module_key in (
        'modul3_buchhaltung', 'modul4_mitarbeiter', 'modul5_jobmarkt',
        'modul6_hotel', 'modul7_avatar', 'dynamische_preise',
        'schloss_igloohome', 'schloss_nuki', 'schloss_ttlock',
        'schloss_yale', 'schloss_august', 'schloss_tedee',
        'schloss_schlage', 'schloss_kwikset', 'schloss_lockly',
        'schloss_smartthings', 'schloss_akiles', 'schloss_ultraloq',
        'schloss_wyze', 'schloss_keyincode', 'schloss_korelock',
        'schloss_sifely', 'schloss_dusaw', 'schloss_yacan',
        'schloss_thirty_three_lock', 'schloss_dormakaba_oracode', 'schloss_keynest',
        'schloss_salto_ks', 'schloss_salto_space', 'schloss_assa_abloy_vostio',
        'schloss_assa_abloy_credential_service', 'schloss_dormakaba_ambiance', 'schloss_dormakaba_community',
        'schloss_visionline', 'schloss_hotek', 'schloss_latch',
        'schloss_brivo', 'schloss_legic_connect'
    ));
