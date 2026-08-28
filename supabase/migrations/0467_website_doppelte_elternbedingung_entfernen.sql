-- 0467 — Die in 0466 versehentlich verdoppelte Elternteil-Bedingung entfernen.
--
-- 0466 legte `site_pages_parent_typ_check` an, um festzuhalten, dass eine
-- Systemseite kein Elternteil haben darf. Dieselbe Bedingung stand aber schon
-- seit 0433 unter dem Namen `site_pages_parent_nur_eine_ebene` — wortgleich:
--
--   parent_id is null or page_type in ('normal', 'external')
--
-- Da `system` in dieser Aufzählung nicht vorkommt, deckte die BESTEHENDE
-- Bedingung den neuen Typ bereits ab. Die zweite war überflüssig, bevor sie
-- geschrieben wurde.
--
-- Warum das kein kosmetisches Problem ist: zwei gleichlautende CHECKs unter
-- verschiedenen Namen sind eine Falle für den Nächsten. Wer die Regel einmal
-- lockern will (etwa: Beiträge dürfen unter einem Ordner hängen), findet eine
-- davon, ändert sie, und die andere weist den Schreibvorgang weiterhin ab — mit
-- einer Fehlermeldung, die auf eine Bedingung zeigt, die man gerade eben
-- geändert zu haben glaubt.
--
-- Eine eigene Nummer und keine Korrektur an 0466: eine angewendete Migration
-- läuft nie wieder, eine Änderung an ihrer Datei wirkt also nirgends.

alter table public.site_pages
    drop constraint if exists site_pages_parent_typ_check;
