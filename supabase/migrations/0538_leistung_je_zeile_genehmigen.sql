-- Bestellte Leistung zu einer Eigentümersperre: Genehmigung JE LEISTUNG (0538).
--
-- WAS 0510 GEBAUT HAT: der Eigentümer bestellt zu seiner Sperre Leistungen
-- (Reinigung, Endreinigung, …) als Zeilen in `block_request_services`. Ohne
-- Zeile keine Aufgabe.
--
-- WAS 0510 NICHT KONNTE: die Zeile war ein reines Ja/Nein (vier Spalten:
-- id, block_request_id, rule_id, created_at). Genehmigte die Agentur den
-- ANTRAG, wurden ALLE bestellten Leistungen zu Aufgaben — sie fuhren blind mit.
-- Im Prüfdialog (`sperrantrag-pruefung-dialog.tsx`) kamen sie gar nicht vor;
-- die Agentur sah sie nur in der Zeile der Warteschlange DAHINTER, und
-- ändern, ergänzen oder einzeln ablehnen konnte sie sie nirgends (kein UPDATE,
-- kein DELETE auf die Tabelle im ganzen Backend).
--
-- Vorgabe des Betriebs (03.09.2026): „ein Eigentümer muss eine Reinigung
-- buchen und eine Endreinigung. Die muss genehmigt werden von der Agentur."
-- Genehmigt werden muss also die LEISTUNG, nicht nur die Sperre. Eine Sperre
-- kann genehmigt sein und die Endreinigung dazu abgelehnt — z. B. weil der
-- Betrieb sie in dieser Woche nicht leisten kann.
--
-- Deshalb bekommt jede Bestellzeile ihren eigenen Zustand:
--   angefragt  — der Eigentümer hat bestellt, die Agentur hat nicht entschieden
--   genehmigt  — die Agentur hat die Leistung freigegeben → Aufgabe entsteht
--   abgelehnt  — die Agentur hat sie abgelehnt → keine Aufgabe
-- Nur `genehmigt` erzeugt eine Aufgabe (`tasks.eigennutzung.bestellte_regeln`).
-- Fail-closed (Wurzel 5): eine Zeile, die noch `angefragt` steht, ist KEINE
-- Freigabe.

alter table public.block_request_services
    add column if not exists status text not null default 'angefragt',
    -- Wer und wann — Entscheidungsspur wie am Antrag (`decided_by/_at`).
    -- Die Uhr ist hier richtig: es ist UNSERE Entscheidung (5b gilt für
    -- fremde Ereignisse, das ist keins).
    add column if not exists entschieden_von    uuid,
    add column if not exists entschieden_am     timestamptz,
    -- Begründung der Agentur, vor allem bei Ablehnung: der Eigentümer hat
    -- bestellt und muss erfahren, WARUM er die Leistung nicht bekommt.
    add column if not exists entscheidungsnotiz text;

-- Zustandswerte festgenagelt (Wurzel 4): ein Tippfehler im Service darf keine
-- Zeile erzeugen, die weder Aufgabe noch Ablehnung ist.
alter table public.block_request_services
    drop constraint if exists block_request_services_status_chk;
alter table public.block_request_services
    add constraint block_request_services_status_chk
    check (status in ('angefragt', 'genehmigt', 'abgelehnt'));

comment on column public.block_request_services.status is
    'Genehmigung DIESER Leistung durch die Agentur: angefragt | genehmigt | '
    'abgelehnt. Nur genehmigt erzeugt eine Aufgabe. Unabhängig vom Status des '
    'Antrags: eine Sperre kann genehmigt und ihre Endreinigung abgelehnt sein.';

-- Bestand nachziehen. Bis hierher galt: Antrag genehmigt = alles genehmigt.
-- Diese Aussage bleibt für den Bestand wahr — sie rückwirkend auf 'angefragt'
-- zu setzen würde Aufgaben, die längst existieren, zu Aufgaben ohne Freigabe
-- machen. Abgelehnte Anträge tragen abgelehnte Leistungen.
update public.block_request_services s
   set status = 'genehmigt',
       entschieden_von = br.decided_by,
       entschieden_am  = br.decided_at
  from public.block_requests br
 where br.id = s.block_request_id
   and br.status = 'approved'
   and s.status = 'angefragt';

update public.block_request_services s
   set status = 'abgelehnt',
       entschieden_von = br.decided_by,
       entschieden_am  = br.decided_at
  from public.block_requests br
 where br.id = s.block_request_id
   and br.status = 'rejected'
   and s.status = 'angefragt';

-- Rechte (Wurzel 6): unverändert `revoke all … from anon, authenticated` aus
-- 0510. Das ist hier der eigentliche Schutz — der Eigentümer spricht mit
-- gültigem JWT PostgREST direkt an, und ein UPDATE auf `status` wäre eine
-- Selbstgenehmigung. Geschrieben wird ausschließlich über die API mit
-- service_role, und der Service prüft dort die Rolle (APPROVE_BLOCK).
