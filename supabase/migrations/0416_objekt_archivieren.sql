-- 0416 — Objekt archivieren statt löschen.
--
-- DER FALL: Ein Beta-Betrieb hat ein Ferienhaus gekündigt („Fewo-Mosbjerg-Sindal").
-- Das Objekt soll aus der Arbeitsliste verschwinden. Löschen ist dafür der
-- falsche Weg — und scheitert ohnehin an der Datenbank:
--
--   ERROR: update or delete on table "properties" violates foreign key
--          constraint "reservations_property_id_fkey"
--
-- `reservations.property_id` steht auf RESTRICT (bewusst). Das Objekt trägt
-- 10 abgeschlossene Aufenthalte; ein hartes Löschen nähme deren Historie mit —
-- Umsatz, Eigentümer-Abrechnung, Gastprofile. Genau das darf nicht passieren.
--
-- WARUM EINE EIGENE SPALTE UND KEIN STATUS-WERT:
-- `status` beschreibt die Verkaufsfähigkeit (draft/active/inactive). Ob ein
-- Objekt ARCHIVIERT ist, ist eine zweite, unabhängige Achse — dasselbe Muster
-- wie bei den Kanal-Sichtbarkeiten (listed_on_marketplace neben status, 0159).
-- Ein Enum-Wert `archived` hätte den vorherigen Status überschrieben: beim
-- Aufheben des Archivs wüsste niemand mehr, ob das Objekt aktiv war oder ein
-- Entwurf — man müsste raten (Wurzel 4).
--
-- Der Zeitstempel statt eines Booleans, weil „wann wurde gekündigt" die Frage
-- ist, die danach gestellt wird.
--
-- `inactive` im Enum bleibt unangetastet: der Wert wird im gesamten Code nicht
-- verwendet und ist an keinem Objekt gesetzt (live geprüft 21.08.2026).
-- „Inaktiv" heisst fachlich etwas anderes als „gekündigt".
--
-- DER VERKAUFSSTOPP hängt NICHT an dieser Spalte, sondern am vorhandenen
-- Vertragsende (`contract_end_date`, 0355/0359): der Service setzt es beim
-- Archivieren auf heute und ruft `vertragsende_durchsetzen`. Das schreibt echte
-- Sperrnächte in `availability` (source='contract_end') und meldet sie an die
-- Portale — ein reines Ausblenden in der Liste hätte Booking und Airbnb weiter
-- verkaufen lassen.

alter table public.properties
  add column if not exists archived_at timestamptz;

comment on column public.properties.archived_at is
  'Zeitpunkt der Archivierung (gekündigtes/aufgegebenes Objekt). NULL = im '
  'Bestand. Archivierte Objekte sind aus Listen ausgeblendet, ihre Buchungen '
  'und Abrechnungen bleiben vollständig erhalten. Der Verkaufsstopp läuft '
  'getrennt über contract_end_date (0355) — diese Spalte sperrt nichts.';

-- Nur die archivierten indizieren: der Normalfall ist NULL, und die Listen
-- fragen genau darauf ab (`archived_at is null`). Ein Teilindex auf die
-- Ausnahme bleibt klein und trägt die Abfrage trotzdem.
create index if not exists properties_archived_at_idx
  on public.properties (tenant_id, archived_at)
  where archived_at is not null;

-- KEINE neuen Grants und keine neue Policy: die Spalte hängt an `properties`,
-- deren RLS und Rollen-Policies gelten unverändert weiter (Wurzel 6). Geschrieben
-- wird ausschliesslich über den FastAPI-Pfad, der MANAGE_PROPERTY_SETTINGS
-- verlangt — wie publish/resync/delete.
