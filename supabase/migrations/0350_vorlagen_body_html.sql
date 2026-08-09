-- =========================================================================
-- 0350 — Nachrichten-Vorlagen bekommen ein Autorenformat (body_html).
-- =========================================================================
-- AUSGANGSLAGE: public.message_template fuehrt bisher NUR `body` (Klartext).
-- Der Vorlagen-Editor konnte damit keine Gliederung speichern: Wer im Editor
-- eine nummerierte Liste schrieb, bekam sie beim naechsten Oeffnen als
-- Aufzaehlung mit Strichen zurueck — die Nummerierung existierte im
-- gespeicherten Klartext nicht mehr als STRUKTUR, nur noch als Zeichen, und
-- der naechste Speichervorgang zerlegte sie weiter.
--
-- ZWEI SPALTEN, ZWEI ROLLEN — bewusst keine Ersetzung von `body`:
--   `body_html` = AUTORENFORMAT. Was der Editor zeigt und der Betrieb pflegt.
--                 Serverseitig mit nh3-Allowlist gesaeubert (Wurzel 8,
--                 inbox/schemas.sanitize_vorlagen_html).
--   `body`      = VERSANDQUELLE. Airbnb und Booking.com uebertragen im
--                 Gast-Chat ausschliesslich reinen Text; ein `<strong>` kaeme
--                 dort woertlich beim Gast an. Der Klartext wird deshalb
--                 SERVERSEITIG aus `body_html` abgeleitet
--                 (inbox/felder.html_zu_text) und NICHT vom Client
--                 uebernommen (Wurzel 3): sonst koennte eine Anfrage
--                 harmloses HTML zeigen und einen anderen Text versenden
--                 lassen.
--
-- KEIN BACKFILL, und das ist Absicht (Wurzel 4 — kein erfundener Ersatzwert):
-- `body_html = ''` heisst genau eine Sache, naemlich „diese Vorlage wurde noch
-- nie formatiert". Das Frontend baut daraus per `textZuHtml` einen
-- Editor-Inhalt aus dem vorhandenen Klartext. Wuerde hier stattdessen ein
-- generiertes HTML eingetragen, waere spaeter nicht mehr unterscheidbar, ob
-- ein Betrieb die Gliederung so GEWOLLT oder eine Migration sie GERATEN hat.
-- Die 17 Bestandsvorlagen des Beta-Betriebs bleiben unveraendert lesbar und
-- versendbar.
--
-- Alt/Neu-Gegenzustand (Wurzel 1): rein additiv. Es wird keine bestehende
-- Zeile angefasst und keine Spalte entfernt; `body` behaelt Bedeutung und
-- Inhalt. Ein Rueckbau waere ein reines `drop column`.
--
-- SICHERHEIT (Wurzel 6) — hier ist NICHTS zu tun, live gegengeprueft:
-- 0337 hat public.message_template vollstaendig vom DB-Direktpfad genommen
-- (`revoke select, insert, update, delete ... from anon, authenticated`).
-- Der Live-Stand der Grants (08.2026, Server-DB) zeigt fuer anon und
-- authenticated nur noch REFERENCES/TRIGGER/TRUNCATE, kein SELECT und keinen
-- Schreibpfad; dazu die RESTRICTIVE Policies message_template_read_restrict
-- (SELECT) sowie _write_insert/_write_update/_write_delete aus 0196/0315.
-- Ein GRANT auf Tabellenebene wirkt fuer ALLE Spalten, auch fuer spaeter
-- hinzugefuegte — der Entzug damit ebenso. Eine neue Spalte erbt den
-- gesperrten Zustand also automatisch.
-- DESHALB AUSDRUECKLICH KEIN zusaetzliches `grant` hier: ein `grant select
-- (body_html)` wuerde den in 0337 geschlossenen Direktpfad fuer genau diese
-- Spalte wieder oeffnen. Gelesen wird ausschliesslich ueber die FastAPI
-- (service_role, rolbypassrls = t).
-- Gegenprobe (ein eingeloggter cleaner mit anon-Key):
--   curl -H "apikey: <anon>" -H "Authorization: Bearer <cleaner-JWT>" \
--        "$SUPABASE_URL/rest/v1/message_template?select=body_html"
--   -> permission denied, unveraendert zu heute.
--
-- REALTIME: message_template ist nicht in der Publikation `supabase_realtime`
-- und soll es nicht werden — das Frontend laedt Vorlagen ueber die API. Die
-- neue Spalte aendert daran nichts.
-- =========================================================================

alter table public.message_template
    add column if not exists body_html text not null default '';

comment on column public.message_template.body_html is
    'Autorenformat der Vorlage (gesaeubertes HTML aus dem Editor). Leer = noch '
    'nie formatiert; das Frontend leitet den Editor-Inhalt dann aus body ab. '
    'VERSENDET wird nie diese Spalte, sondern body: die Portale uebertragen im '
    'Gast-Chat nur Klartext. body wird serverseitig aus body_html abgeleitet '
    '(inbox/felder.html_zu_text), nie vom Client uebernommen (Wurzel 3).';
