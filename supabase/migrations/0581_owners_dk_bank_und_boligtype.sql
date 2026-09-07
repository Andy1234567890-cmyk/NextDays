-- 0581_owners_dk_bank_und_boligtype.sql — dänische Bankverbindung am Eigentümer
-- und Wertebereich für `properties.boligtype` (Lastenheft §6, Kartei Stufe 1)
--
-- TEIL 1 — owners.bank_reg_nr / owners.bank_konto_nr
-- Dänische Konten werden nicht als IBAN geführt, sondern als Registrierungs-
-- nummer (4 Ziffern, die Bank) plus Kontonummer (bis 10 Ziffern). 0063 kennt
-- nur iban/bic/bank_name — ein dänischer Eigentümer musste seine Reg.-/Konto-
-- Nummer bislang in `notes` oder gar nicht ablegen. Beide Spalten sind
-- nullable und ergänzen IBAN/BIC, sie ersetzen sie nicht: ein Eigentümer hat
-- entweder das eine oder das andere, je nach Bank.
--
-- Die CHECKs spiegeln die Pydantic-Validatoren in owners/schemas.py (`_reg_nr`,
-- `_konto_nr`) — DB-CHECK und Schema müssen deckungsgleich bleiben, sonst
-- nimmt die API einen Wert an, den die DB ablehnt (500 statt 422).
--
-- Schutz: `owners` ist seit 0337 für anon/authenticated komplett gesperrt
-- (revoke select/insert/update/delete) — der Direktpfad kann die neuen Spalten
-- weder lesen noch schreiben. Nur der Service (service_role) erreicht sie,
-- und der liefert sie ausschließlich an MANAGE_OWNERS/MANAGE_PROPERTIES aus.
--
-- TEIL 2 — properties.boligtype
-- Die Spalte existiert seit 0009 als freier `text` und wurde nie beschrieben
-- (0 Treffer in API/Web, REQUIREMENTS-GAP §6). Sie bekommt jetzt den
-- Wertebereich des Lastenhefts als sprachneutrale Schlüssel — die Labels
-- leben im Frontend (Namensraum `dossier.boligtype`):
--   flexbolig      Flexbolig (Wohnrecht ohne Wohnpflicht)
--   helaarsbolig   Helårsbolig (ganzjähriges Wohnen)
--   fritidshus     Fritidshus (Ferienhaus)
-- 0127 hatte 'flex'/'year_round'/'holiday' als Beispiel genannt, aber nichts
-- angelegt; die dänischen Fachbegriffe sind die Schlüssel, weil es DK-
-- Rechtsbegriffe ohne exakte Entsprechung sind (wie `bfe_number`).
--
-- Der CHECK wird OHNE Bereinigung gesetzt: steht in der Live-DB ein Wert
-- außerhalb der Liste, schlägt die Migration laut fehl, und der Bestand wird
-- angesehen statt still auf NULL gesetzt (Memory: Bereinigung nur nach Absicht).
--
-- KEIN `begin;`/`commit;`: `apply-migrations.sh` fährt jede Migration bereits
-- in einer eigenen Transaktion.

alter table public.owners
    add column if not exists bank_reg_nr text,
    add column if not exists bank_konto_nr text;

alter table public.owners
    drop constraint if exists owners_bank_reg_nr_format,
    add constraint owners_bank_reg_nr_format
        check (bank_reg_nr is null or bank_reg_nr ~ '^[0-9]{4}$'),
    drop constraint if exists owners_bank_konto_nr_format,
    add constraint owners_bank_konto_nr_format
        check (bank_konto_nr is null or bank_konto_nr ~ '^[0-9]{1,10}$');

comment on column public.owners.bank_reg_nr is
    'Dänische Bank-Registrierungsnummer (4 Ziffern). Ergänzt IBAN/BIC, ersetzt sie nicht.';
comment on column public.owners.bank_konto_nr is
    'Dänische Kontonummer (1–10 Ziffern) zur Reg.-Nr.';

alter table public.properties
    drop constraint if exists properties_boligtype_check,
    add constraint properties_boligtype_check
        check (boligtype is null or boligtype in ('flexbolig', 'helaarsbolig', 'fritidshus'));

comment on column public.properties.boligtype is
    'DK-Wohnstatus des Objekts (Kartei Stufe 1): flexbolig | helaarsbolig | fritidshus. Kein OTA-Sync.';
