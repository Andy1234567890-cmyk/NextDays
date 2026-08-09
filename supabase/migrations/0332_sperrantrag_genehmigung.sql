-- 0332 — Genehmigungs-Workflow für Sperr-Anträge des Eigentümers (Etappe A).
--
-- BISHER: `block_requests` (0014) kennt zwar status pending|approved|rejected
-- und eine Spalte `decided_by`, aber es gab KEINEN Weg, einen Antrag zu
-- entscheiden: der Owner stellt ihn (public_portal.request_block), und dort
-- endet der Vorgang. `decided_by` wurde nie geschrieben, die Capability
-- APPROVE_BLOCK hing an keinem Endpunkt, und ein 'approved' erzeugte KEINE
-- Sperre im Kalender — der Antrag wäre also selbst nach einer Genehmigung
-- wirkungslos geblieben und das Objekt weiter verkäuflich.
--
-- NEU: die Audit-Felder, die eine Entscheidung nachvollziehbar machen. Muster
-- ist 0203 (property_moderation): WER hat entschieden (vorhanden), WANN
-- (`decided_at`) und WARUM (`decision_note`). Dazu die Begründung des
-- ANTRAGSTELLERS (`reason`) — ohne sie muss die Agentur raten, warum der
-- Eigentümer sein eigenes Objekt gesperrt haben will (Eigennutzung? Handwerker?
-- Verkauf?), und kann nicht sinnvoll entscheiden.
--
-- WARUM `decided_at` NICHT aus `updated_at` abgeleitet wird (Wurzel 5b):
-- `updated_at` ist UNSERE Uhr für die letzte Zeilenänderung — der Trigger aus
-- 0015 setzt sie bei JEDEM Update neu. Eine spätere Korrektur der Notiz würde
-- den Entscheidungszeitpunkt stillschweigend verschieben. Der Zeitpunkt der
-- Entscheidung ist ein eigenes fachliches Ereignis und braucht ein eigenes Feld.

alter table public.block_requests
    -- Begründung des Eigentümers beim Stellen des Antrags (optional: der
    -- Bestand hat keine, und ein NOT NULL würde jede Altzeile brechen).
    add column if not exists reason text,
    -- Wann entschieden wurde. Partner von `decided_by` aus 0014.
    add column if not exists decided_at timestamptz,
    -- Begründung der Agentur (bei Ablehnung fachlich erwartet, technisch frei).
    add column if not exists decision_note text;

comment on column public.block_requests.reason is
    'Begründung des Eigentümers für den Sperrwunsch (Eigennutzung, Handwerker …). '
    'Vom Antragsteller gesetzt, danach unveränderlich (0332).';
comment on column public.block_requests.decided_at is
    'Zeitpunkt der Entscheidung (approve/reject). Bewusst NICHT updated_at: das '
    'ist unsere Uhr für jede Zeilenänderung und würde sich bei jeder späteren '
    'Korrektur verschieben (Wurzel 5b, 0332).';
comment on column public.block_requests.decision_note is
    'Notiz der Agentur zur Entscheidung — bei Ablehnung die Begründung für den '
    'Eigentümer (0332).';

-- Warteschlange der Agentur: die offenen Anträge, älteste zuerst. Partiell auf
-- status='pending', weil genau darauf der List-Endpunkt im Normalfall filtert —
-- entschiedene Anträge (die dauerhaft wachsende Mehrheit) belasten den Index nicht.
create index if not exists block_requests_pending_idx
    on public.block_requests (tenant_id, created_at)
    where status = 'pending';

-- == Wurzel 6: DB-Direktpfad (PostgREST mit anon-Key) ========================
-- Der Schreibpfad war schon in 0229 zu (`revoke insert,update,delete` +
-- restriktive Tenant-Policy `block_requests_write_restrict`). Was OFFEN war:
-- SELECT. `authenticated` hatte pauschales SELECT, gefiltert nur durch
-- `block_requests_owner_scope`/`_staff_scope` — beide sind RESTRICTIVE FOR
-- SELECT über `owner_can_see_property`/`staff_can_see_property`, greifen also
-- für owner und staff. Für einen eingeloggten Nutzer OHNE diese Rollen bleibt
-- die permissive Tenant-Policy die einzige Schranke.
--
-- Mit 0332 tragen die Zeilen zusätzlich `reason` und `decision_note`: den
-- Grund, warum ein Eigentümer sein Objekt sperren will, und die interne Notiz
-- der Agentur dazu. Das ist eine Geschäftsinformation über einen bestimmten
-- Eigentümer, die eine Reinigungskraft desselben Mandanten nichts angeht.
-- Spalten-GRANTs greifen nicht, solange das Tabellen-GRANT besteht — also
-- erst das Tabellen-SELECT entziehen (Reihenfolge wie in
-- 0314_gastportal_geheimnisse_revoke).
--
-- Gelesen wird ab hier ausschließlich über die API (service_role) mit dem dort
-- erzwungenen Scope: Eigentümer sehen ihre eigenen Anträge
-- (public_portal.my_block_requests, requested_by = self), die Agentur die des
-- Mandanten (Capability APPROVE_BLOCK).
--
-- Gegenprobe (eingeloggter cleaner, anon-Key):
--   curl /rest/v1/block_requests            → 0 Zeilen (kein SELECT-GRANT)
--   curl -X PATCH /rest/v1/block_requests   → 401/403 (revoke aus 0229)
revoke select on public.block_requests from anon, authenticated;

-- Realtime-Folge: ein `block_requests`-Abo im Frontend ist ab hier eine stumme
-- Attrappe (ohne SELECT-Grant passt keine Policy). Das ist gewollt — die
-- Antragsliste lädt über die API. Es gibt heute KEIN solches Abo; wer eines
-- baut, muss auf eine erlaubte Quelle hören statt hier ein Grant zu setzen.

-- == Benachrichtigungs-Kategorie für den Sperr-Workflow ======================
-- Muster 0225/0331: der Katalog in notification_settings/katalog.py ist die EINE
-- Quelle der Wahrheit, die Spalten folgen strikt `<schluessel>_<kanal>`. Ohne
-- diese Spalten liefe `soll_senden` für die neue Kategorie ins Leere.
--
-- EIGENE Kategorie statt `listing_activity` mitzubenutzen — aus demselben Grund
-- wie 0331: die Empfänger sind verschieden. Die Meldung „neuer Sperrantrag"
-- geht an die ENTSCHEIDER des Mandanten (admin/co_admin mit APPROVE_BLOCK),
-- die Meldung „entschieden" an den EIGENTÜMER. Wer das mit den Buchungs-
-- meldungen zusammenlegt, kann das eine nicht ohne das andere abschalten.
--
-- email_pflicht = NEIN (im Katalog-Code): ein Sperrantrag ist eine interne
-- Abstimmung, keine vertragliche Kerninformation wie eine Stornierung. Wer
-- täglich Anträge bearbeitet, muss den Mail-Kanal abwählen dürfen — die Glocke
-- (Kanal INAPP) bleibt ohnehin an und ist nicht abwählbar.
alter table public.notification_settings
    -- An die Agentur: „ein Eigentümer möchte sperren".
    add column if not exists block_request_email boolean not null default true,
    add column if not exists block_request_sms   boolean not null default false,
    -- An den Eigentümer: „dein Antrag wurde genehmigt/abgelehnt/zurückgenommen".
    add column if not exists block_decision_email boolean not null default true,
    add column if not exists block_decision_sms   boolean not null default false;

comment on column public.notification_settings.block_request_email is
    'Meldung an die Entscheider (APPROVE_BLOCK), wenn ein Eigentümer eine '
    'Sperrung beantragt (0332). Abwählbar — die Glocke bleibt.';
comment on column public.notification_settings.block_decision_email is
    'Meldung an den antragstellenden Eigentümer, wenn über seinen Sperrantrag '
    'entschieden wurde (0332). Abwählbar — die Glocke bleibt.';
