-- 0335 — Die Sprache des E-Mail-EMPFÄNGERS.
--
-- BISHER gingen ALLE Backend-Mails hart deutsch raus (Einladung, Passwort-Reset,
-- Buchungsmeldung an den Eigentümer, Bewertungserinnerung an den Gast). Das
-- Produkt läuft europaweit, das Frontend spricht 24 Sprachen — die Mail, also
-- der einzige Kanal, der den Nutzer AUSSERHALB der Oberfläche erreicht, sprach
-- als einziger nur Deutsch. Ein dänischer Eigentümer bekam seine Abrechnungs-
-- und Buchungsmails auf Deutsch.
--
-- WAS ES SCHON GAB (live geprüft am 08.08.2026):
--   * `users.preferred_language` (0233) — da, aber NUR Anzeigesprache der
--     Oberfläche; der Mailversand hat sie nie gelesen.
--   * `guests.language` (0046), `portal_guests.preferred_locale` (0181) — da.
--   * `owners` und `tenants` hatten KEINE Sprachspalte. Genau die beiden fehlten:
--     der Eigentümer ist Mail-Empfänger OHNE zwingenden Login (Abrechnungs- und
--     Buchungsmails), und ohne Betriebssprache gibt es keine sinnvolle
--     Zwischenstufe in der Fallback-Kette.
--
-- DIESE MIGRATION schließt genau diese zwei Lücken:
--   1. `owners.language`         — die Sprache der Eigentümer-PARTEI.
--   2. `tenants.default_language`— die Sprache des BETRIEBS, zweite Stufe der Kette.
--
-- DIE FALLBACK-KETTE (dokumentiert in `core/mail_sprache.py`, hier die
-- DB-Seite davon):
--     Sprache am Empfänger  →  Sprache des Betriebs  →  Englisch
-- Es gibt bewusst KEINEN Default auf Betriebsebene und KEIN `not null default
-- 'de'`: eine Spalte mit Default 'de' würde bei JEDEM neu angelegten Betrieb
-- behaupten, er sei deutschsprachig — ein erfundener Wert (Wurzel 4). NULL heißt
-- ehrlich „nicht erfasst", und erst dann greift die nächste Stufe der Kette.
--
-- WARUM ENGLISCH ALS LETZTER RÜCKFALL und nicht Deutsch: Deutsch ist eine
-- INHALTLICHE Wahl, die sich als technischer Default tarnt. Für einen
-- französischen Eigentümer ist eine deutsche Mail keine neutrale Voreinstellung,
-- sondern eine Falschaussage über das Produkt. Englisch wird als Ausweichsprache
-- erkannt, Deutsch als Herkunftsaussage.
--
-- WARUM CHECK UND NICHT ENUM: Ein Postgres-Enum zu erweitern ist DDL
-- (`alter type ... add value`), läuft nicht in jeder Transaktion und zwingt bei
-- der 25. Sprache zu einer Migration mit Sonderbehandlung. Der CHECK gegen eine
-- Liste ist eine Zeile `alter ... drop constraint / add constraint` — und die
-- eigentliche Wahrheit über die unterstützten Sprachen steht ohnehin im Code
-- (`core/mail_sprache.SUPPORTED`, gedeckt durch einen Test über alle 24
-- Kataloge). Der CHECK ist der DB-seitige Backstop gegen Müll, nicht die Quelle.
--
-- WURZEL 6 (DB-Direktpfad): Es wird KEINE neue Tabelle angelegt und KEIN Grant
-- verändert. `users`, `owners` und `tenants` sind für anon/authenticated
-- SELECT-only (live verifiziert: REFERENCES, SELECT, TRIGGER, TRUNCATE — kein
-- INSERT/UPDATE/DELETE), der Schreibweg läuft ausschließlich über die service_role
-- im FastAPI-Layer. Eine Sprachangabe ist zudem keine sensible Information: sie
-- verrät nichts, was der Mandant nicht ohnehin über seine eigenen Nutzer weiß.
-- Ein zusätzliches `revoke` ist deshalb weder nötig noch sinnvoll — die Spalte
-- muss für die Oberfläche lesbar sein, die sie anzeigt.

-- Die 24 EU-Amtssprachen (ISO 639-1), identisch zu `web/messages/*.json`,
-- `core/mail_sprache.SUPPORTED` und `buchhaltung/doc_i18n.SUPPORTED`.
-- Regionsvarianten (de-AT, pt-BR) werden IM CODE auf die Basissprache gekappt,
-- bevor gespeichert wird — die Spalte trägt darum nur den 2-Buchstaben-Code.

alter table public.owners
  add column if not exists language text;

comment on column public.owners.language is
  'Korrespondenzsprache des Eigentuemers (ISO 639-1, z. B. "da"). Sprache '
  'SEINER Mails (Buchungsmeldung, Abrechnung). NULL = nicht erfasst, dann '
  'greift tenants.default_language, dann Englisch (core/mail_sprache).';

alter table public.tenants
  add column if not exists default_language text;

comment on column public.tenants.default_language is
  'Standardsprache des Betriebs (ISO 639-1). Zweite Stufe der Mail-Fallback-'
  'Kette: gilt fuer Empfaenger ohne eigene Sprachangabe. NULL = nicht erfasst, '
  'dann Englisch. KEIN Default "de" — das waere ein erfundener Wert (Wurzel 4).';

-- CHECK-Constraints. `not valid` gibt es hier nicht: die Spalten sind neu und
-- damit ausnahmslos NULL, es kann also keine Bestandszeile auflaufen.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'owners_language_iso'
  ) then
    alter table public.owners
      add constraint owners_language_iso check (
        language is null or language in (
          'bg','cs','da','de','el','en','es','et','fi','fr','ga','hr',
          'hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tenants_default_language_iso'
  ) then
    alter table public.tenants
      add constraint tenants_default_language_iso check (
        default_language is null or default_language in (
          'bg','cs','da','de','el','en','es','et','fi','fr','ga','hr',
          'hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv'
        )
      );
  end if;
end $$;

-- `users.preferred_language` (0233) hatte bislang KEINEN CHECK — dort konnte
-- jeder String bis Länge 10 landen (das Pydantic-Schema erlaubt max_length=10).
-- Ein nicht unterstützter Wert („zh", „xx-YZ") wird vom Code zwar auf die
-- Fallback-Kette abgebildet und ergibt nie eine kaputte Mail, aber er ist
-- trotzdem Müll in der Spalte. Der Code normalisiert ab jetzt vor dem Schreiben;
-- der CHECK ist der Backstop dahinter.
--
-- ACHTUNG Bestand: live stehen dort heute nur 'de' und NULL (geprüft), der
-- CHECK kann also sofort validiert werden.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_preferred_language_iso'
  ) then
    alter table public.users
      add constraint users_preferred_language_iso check (
        preferred_language is null or preferred_language in (
          'bg','cs','da','de','el','en','es','et','fi','fr','ga','hr',
          'hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv'
        )
      );
  end if;
end $$;
