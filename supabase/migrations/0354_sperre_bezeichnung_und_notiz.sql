-- 0354 — Name und Freitext an der Sperre
--
-- ANLASS: Der Belegungsplan zeigt auf einem Sperrbalken heute nur „Gesperrt".
-- Wer im Juli wissen will, warum ein Objekt im August zu ist, findet die
-- Antwort nirgends — sie steht bestenfalls in einer Mail. Lodgify schreibt
-- genau dafür die Notiz des Nutzers auf den Balken (real gesehen:
-- „ejerspærret iflg mail 15.3.26/ opd. 21.7." — eigentümergesperrt laut Mail
-- vom 15.3., aktualisiert am 21.7.). Dieselbe Zeile trägt beim
-- Eigentümer-Aufenthalt den Namen der Person.
--
-- WARUM AN `availability` UND NICHT NUR AN `block_requests`:
-- `block_requests` trägt bereits `reason`, deckt aber nur den ANTRAGSWEG ab
-- (Eigentümer stellt, Agentur genehmigt). Die Sperre direkt aus dem Kalender
-- legt gar keinen Antrag an — sie schreibt sofort nach `availability`. Ein
-- Freitext, den nur der halbe Weg kennt, wäre auf dem Balken mal da und mal
-- nicht. Die Anzeige hängt an `availability`, also hängt der Text auch dort.
--
-- ZWEI FELDER, NICHT EINS:
--   `label` — WER/WAS (Eigentümer-Name, „Handwerker", „Eigennutzung").
--             Kurz, steht vorn auf dem Balken.
--   `note`  — WARUM/Beleg (die Lodgify-Zeile oben ist genau das).
-- Ein einziges Feld hätte beide Zwecke vermischt: der Name gehört auf den
-- Balken, die Belegzeile in den Tooltip, wenn der Platz nicht reicht.
--
-- Beide NULLABLE: eine Sperre ohne Text bleibt gültig (Bestand, und der
-- schnelle Griff „Zeitraum zu" soll nicht an einem Pflichtfeld hängen).
-- Kein Default-Text (Wurzel 4) — leer heißt leer, nicht „Gesperrt".

alter table public.availability
  add column if not exists label text,
  add column if not exists note text;

-- Längen wie im übrigen Bestand: `stop_sell.reason` ist Freitext ohne Grenze,
-- die Pydantic-Schemas begrenzen auf 500 (reason) bzw. 2000 (note). Hier die
-- DB-seitige Obergrenze, damit ein Direktschreiber am API-Layer vorbei (Wurzel
-- 6: PostgREST mit anon-Key) keine Megabyte-Zeile ablegen kann.
alter table public.availability
  drop constraint if exists availability_label_laenge;
alter table public.availability
  add constraint availability_label_laenge
  check (label is null or char_length(label) <= 120);

alter table public.availability
  drop constraint if exists availability_note_laenge;
alter table public.availability
  add constraint availability_note_laenge
  check (note is null or char_length(note) <= 500);

comment on column public.availability.label is
  'Kurzbezeichnung der Sperre (Eigentümer-Name, „Handwerker"). Steht auf dem '
  'Kalenderbalken. NULL = ohne Bezeichnung, dann zeigt der Balken sein '
  'Status-Label.';
comment on column public.availability.note is
  'Freitext/Beleg zur Sperre („gesperrt laut Mail 15.3."). Steht auf dem '
  'Balken hinter der Bezeichnung, bei Platzmangel nur im Tooltip.';

-- DASSELBE AN DER RESERVIERUNG — für die Eigennutzung.
--
-- Eine Eigennutzung ist NICHT zwangsläufig der Eigentümer selbst: er sperrt
-- den Zeitraum genauso für seine Kinder, für Freunde oder für Handwerker.
-- Bisher gab es dort nur `owner_id`, und weil der Assistent bewusst keinen
-- Gast-Kontakt anlegt (das erzeugte eine Dublette in der Gästekartei), blieb
-- `guests.name` leer — jeder Eigennutzungs-Balken zeigte dasselbe
-- „Eigentümer-Aufenthalt", und ein Objekt OHNE gepflegten Eigentümer liess
-- sich gar nicht belegen.
--
-- `owner_id` bleibt der VERTRAGLICHE Bezug (Abrechnung, Kontingent),
-- `stay_name` ist die anwesende PERSON. Zwei verschiedene Fragen, zwei Felder.
alter table public.reservations
  add column if not exists stay_name text,
  add column if not exists stay_note text;

alter table public.reservations
  drop constraint if exists reservations_stay_name_laenge;
alter table public.reservations
  add constraint reservations_stay_name_laenge
  check (stay_name is null or char_length(stay_name) <= 120);

alter table public.reservations
  drop constraint if exists reservations_stay_note_laenge;
alter table public.reservations
  add constraint reservations_stay_note_laenge
  check (stay_note is null or char_length(stay_note) <= 500);

comment on column public.reservations.stay_name is
  'Anwesende Person bei einer Eigennutzung (Eigentümer, dessen Kinder, '
  'Freunde, Handwerker). NICHT identisch mit owner_id — das ist der '
  'vertragliche Bezug. NULL = ohne Angabe.';
comment on column public.reservations.stay_note is
  'Freitext zur Eigennutzung („gesperrt laut Mail 15.3."). Steht auf dem '
  'Kalenderbalken hinter dem Namen.';

-- RLS/Grants: keine Änderung nötig. Die Spalten hängen an einer Tabelle, die
-- bereits `enable rls` + tenant-Policy + restriktive owner/staff-Policies
-- führt; ein neues Feld erbt sie. Es sind KEINE sensiblen Daten im Sinne von
-- Wurzel 6 (kein Finanz-/Vertragsbezug) — der Eigentümer darf seine eigene
-- Sperrnotiz sehen, und genau darauf scopt `owner_can_see_property` bereits.
