-- 0353 — Eigentümer-Sperrzeiten: Einheit am Antrag, Eigentümer + Antragsbezug
-- an der Reservierung.
--
-- DREI LÜCKEN, DIE HIER ZUSAMMEN GESCHLOSSEN WERDEN:
--
-- (1) `block_requests.unit_id` — der Antrag kann keine EINHEIT benennen.
--     Seit 0265 ist ein Objekt ein Einheiten-TYP mit n >= 1 identischen
--     Einheiten. Ein Sperrantrag konnte bisher nur den ganzen Typ meinen: bei
--     fünf gleichen Studios nahm die Eigennutzung EINES Studios alle fünf aus
--     dem Verkauf. Die Einheit gehört deshalb an den Antrag — sie ist die
--     Aussage des Antragstellers („ich will Studio 3"), nicht eine Ableitung
--     der Genehmigung.
--
-- (2) `reservations.owner_id` — ein Eigentümer-Aufenthalt (0241,
--     `is_owner_stay`) hatte keinen Personenbezug. `is_owner_stay` sagt „das
--     ist kein Umsatz", aber nicht WER da war. Genau die Frage stellt die
--     Agentur am Jahresende („wie oft hat Herr Ohm sein Objekt selbst
--     genutzt?"), und genau die konnte niemand beantworten. Der Bezug geht auf
--     `owners` (die verwaltete Eigentümer-PARTEI aus 0063), NICHT auf `guests`:
--     ein Eigentümer ist kein Gast. Ihn in die Gästekartei zu schreiben,
--     verfälschte Loyalty-Aggregate (Aufenthalte/Umsatz je Gast), Marketing-
--     Segmente und die Gästeliste.
--
-- (3) `reservations.block_request_id` — der Gegenzustand des Widerrufs
--     (Wurzel 1). Ab jetzt erzeugt eine Genehmigung eine Reservierung statt
--     einer anonymen `blocked`-Nacht. Der Widerruf muss GENAU DIESE
--     Reservierung finden und storniern — so, wie `availability.block_request_id`
--     (0337) es für die anonyme Sperre tat. Ohne die Spalte müsste der Widerruf
--     über (property_id, Zeitraum, is_owner_stay) raten und träfe dabei eine
--     zweite, unabhängig erfasste Eigennutzung im selben Zeitraum mit.
--
-- ALLE DREI SPALTEN SIND NULLABLE, und das ist kein Datenloch:
--   * `unit_id` null = der Antrag meint den ganzen Typ (der gesamte Altbestand
--     und der Normalfall „Objekt mit einer Einheit").
--   * `owner_id` null = jede gewöhnliche Gastbuchung.
--   * `block_request_id` null = jede Reservierung ohne Antragsbezug, also alle
--     außer den aus einer Genehmigung entstandenen.

-- == (1) Einheit am Sperrantrag ==============================================
alter table public.block_requests
  add column if not exists unit_id uuid
    references public.property_units(id) on delete cascade;

comment on column public.block_requests.unit_id is
  'Einheit, die der Antrag sperren soll (property_units, 0265). NULL = der '
  'ganze Einheiten-TYP, also alle Einheiten des Objekts — der Normalfall bei '
  'einem Objekt mit einer Einheit und der gesamte Altbestand. Der Service '
  'prüft, dass die Einheit zum property_id UND zum Mandanten gehört (Wurzel 3).';

-- `on delete cascade`: verschwindet die Einheit, ist der Antrag auf sie
-- gegenstandslos. Ein `set null` machte daraus still einen Antrag auf den
-- GANZEN Typ — aus einer Sperre für ein Studio würde die Sperre aller fünf
-- (Wurzel 4: kein plausibler Ersatzwert).

create index if not exists block_requests_unit_idx
  on public.block_requests (unit_id)
  where unit_id is not null;

-- Der EXCLUDE-Constraint aus 0333 verbietet zwei GENEHMIGTE Anträge im selben
-- Zeitraum am selben Objekt. Mit Einheiten ist das zu streng: zwei Eigentümer-
-- Anträge auf VERSCHIEDENE Studios desselben Typs sind gleichzeitig erfüllbar
-- und dürfen sich überlappen. Die Ausschluss-Bedingung bekommt deshalb die
-- Einheit als dritte Dimension.
--
-- `coalesce(unit_id, property_id)` ist bewusst gewählt und kein Trick: Ein
-- Antrag OHNE Einheit meint den ganzen Typ und muss weiterhin mit JEDEM
-- anderen Antrag desselben Objekts kollidieren. Er trägt darum die
-- property_id als Schlüssel — dieselbe, die die erste Spalte ohnehin
-- vergleicht — und kollidiert damit mit jedem anderen typweiten Antrag. Zwei
-- Anträge auf verschiedene EINHEITEN tragen verschiedene unit_id und
-- kollidieren nicht.
--
-- WAS DAS BEWUSST NICHT LEISTET: Ein typweiter Antrag (unit_id null) und ein
-- einheitengenauer Antrag (unit_id gesetzt) auf dasselbe Objekt kollidieren
-- hier NICHT, obwohl sie sich fachlich überschneiden. Der Constraint kann das
-- nicht ausdrücken (er vergleicht Gleichheit, keine Teilmengen). Der reale
-- Schutz sitzt eine Ebene tiefer und ist der stärkere: die Genehmigung legt
-- eine Reservierung an, und deren Kalender-/EXCLUDE-Pfad
-- (`reservations_no_local_overlap` + der Belegungscheck in
-- `create_reservation_atomic`) lehnt jede Einheit ab, die im Zeitraum schon
-- belegt ist. Der typweite Antrag findet dann schlicht keine freie Einheit
-- mehr und scheitert mit 409 — an der richtigen Stelle und mit der richtigen
-- Meldung.
alter table public.block_requests
  drop constraint if exists block_requests_kein_ueberlapp;

alter table public.block_requests
  add constraint block_requests_kein_ueberlapp
  exclude using gist (
    property_id with =,
    (coalesce(unit_id, property_id)) with =,
    daterange(start_date, end_date, '[]') with &&
  )
  where (status = 'approved');

comment on constraint block_requests_kein_ueberlapp on public.block_requests is
  'Zwei GENEHMIGTE Anträge dürfen sich am selben Objekt UND derselben Einheit '
  'nicht überlappen (0333, um die Einheit erweitert in 0353). Anträge auf '
  'verschiedene Einheiten desselben Typs sind gleichzeitig erfüllbar. '
  'coalesce(unit_id, property_id): ein typweiter Antrag (unit_id null) '
  'kollidiert weiterhin mit jedem anderen typweiten Antrag.';

-- == (2) Eigentümer an der Reservierung ======================================
alter table public.reservations
  add column if not exists owner_id uuid
    references public.owners(id) on delete set null;

comment on column public.reservations.owner_id is
  'Verwalteter Eigentümer (owners, 0063), der diesen Aufenthalt nutzt. Trägt '
  'den Personenbezug eines Eigentümer-Aufenthalts (is_owner_stay, 0241) — dort '
  'ist der „Gast" der Eigentümer und guest_id bleibt leer, weil ein Eigentümer '
  'kein Gast ist (keine Loyalty-/Marketing-Aggregate, keine Gästekartei). '
  'NULL bei jeder gewöhnlichen Buchung.';

-- `on delete set null`: Wird der Eigentümer-Stammsatz gelöscht, bleibt der
-- AUFENTHALT bestehen — er hat real stattgefunden und die Nächte waren belegt.
-- Ein Cascade löschte hier Belegungshistorie, um einen Kontakt zu entfernen.

-- Ein Eigentümer-Aufenthalt OHNE Eigentümer wäre genau der Zustand, den (2)
-- beseitigen soll: eine als „kein Umsatz" markierte Belegung, die niemandem
-- zuzuordnen ist. Der CHECK ist auf NEUE Zeilen beschränkt, indem er den
-- Altbestand über `guest_id` durchlässt: bisherige Eigentümer-Aufenthalte
-- tragen einen Gast (der Anlegen-Weg erzwang ihn), neue tragen einen
-- Eigentümer. Was es nicht geben darf, ist die Zeile ohne BEIDES — sie hätte
-- keinen Personenbezug.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reservations_owner_stay_person'
  ) then
    alter table public.reservations
      add constraint reservations_owner_stay_person
      check (
        not is_owner_stay
        or owner_id is not null
        or guest_id is not null
      );
  end if;
end $$;

-- Die Auswertung „Aufenthalte dieses Eigentümers" filtert genau hierauf.
-- Partiell, weil die weit überwiegende Mehrheit der Zeilen NULL trägt.
create index if not exists reservations_owner_idx
  on public.reservations (owner_id, check_in)
  where owner_id is not null;

-- == (3) Antragsbezug an der Reservierung ====================================
alter table public.reservations
  add column if not exists block_request_id uuid
    references public.block_requests(id) on delete set null;

comment on column public.reservations.block_request_id is
  'Genehmigter Sperrantrag (block_requests), aus dem diese Reservierung '
  'entstanden ist. Der Widerruf der Genehmigung storniert GENAU diese Zeile '
  'und gibt nur ihre Nächte frei (Wurzel 1) — das Gegenstück zu '
  'availability.block_request_id (0337) für den Reservierungs-Weg. NULL bei '
  'jeder Reservierung ohne Antragsbezug.';

-- Ein Antrag darf nicht zwei aktive Reservierungen tragen: sonst gäbe der
-- Widerruf die eine frei und ließe die andere stehen, und der Kalender wäre
-- für einen zurückgenommenen Antrag weiter gesperrt. Partiell auf die
-- lebenden Zustände — eine stornierte Zeile blockiert den Antrag nicht mehr,
-- damit eine erneute Genehmigung nach Storno möglich bleibt.
--
-- Das ist zugleich der Idempotenz-Backstop in der DB (Wurzel 2): der bedingte
-- Claim pending -> approved im Service ist die erste Bremse, dieser UNIQUE ist
-- die zweite für den Fall, dass zwei Läufe den Claim doch beide gewinnen.
create unique index if not exists reservations_block_request_aktiv_idx
  on public.reservations (block_request_id)
  where block_request_id is not null and status <> 'cancelled';

-- == Wurzel 6 — der DB-Direktpfad ============================================
-- Keine der drei Spalten öffnet etwas Neues:
--   * `block_requests` ist für anon/authenticated vollständig gesperrt
--     (0229 revoke insert/update/delete, 0332 revoke select) — die neue
--     Spalte ist über den Direktpfad weder les- noch schreibbar.
--   * `reservations` ist für authenticated LESBAR (die eine erlaubte
--     Realtime-Quelle, 0337 Abschnitt 4) unter den RESTRICTIVE-Rollen-Scopes,
--     und für anon/authenticated nicht schreibbar. `owner_id` und
--     `block_request_id` sind UUID-Verweise ohne eigenen Informationsgehalt:
--     wer die Zeile sehen darf, darf ohnehin sehen, dass sie ein
--     Eigentümer-Aufenthalt ist (`is_owner_stay` steht seit 0241 daneben).
--     Der Eigentümer-NAME hängt an `owners`, und die Tabelle bleibt für
--     anon/authenticated komplett gesperrt (0337 Abschnitt 5) — aus der ID
--     allein ist nichts abzuleiten.
-- Es wird deshalb bewusst KEIN Grant vergeben und keiner entzogen.
--
-- Gegenprobe (Wurzel 6, mit anon-Key + cleaner-JWT):
--   curl /rest/v1/block_requests?select=unit_id             -> 0 Zeilen
--   curl -X PATCH /rest/v1/reservations?owner_id=...        -> 401/403
--   curl /rest/v1/owners?select=name                        -> 0 Zeilen
