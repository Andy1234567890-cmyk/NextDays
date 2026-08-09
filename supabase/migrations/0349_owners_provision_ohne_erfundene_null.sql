-- 0349 — `owners.default_commission_pct`: „nicht erfasst" darstellbar machen.
--
-- WARUM
-- `default_commission_pct` war `numeric(5,2) not null default 0` (0063). Damit
-- gab es den Zustand „noch kein Satz vereinbart" auf Spaltenebene NICHT: wer
-- einen Eigentümer anlegte, ohne einen Satz einzugeben, bekam still 0 % — der
-- Eigentümer erhielt 100 % der Auszahlung, der Betrieb nichts. Live belegt am
-- 09.08.2026 am Betrieb AirSmil, Eigentümer „Andy Staudinger":
--   Gesamt-Auszahlung 32.120,45 DKK / Eigentümer-Auszahlung 32.120,45 DKK /
--   Verwaltungs-Auszahlung 0,00 DKK  (8 Buchungen, alle über Booking.com)
-- Das ist der Wurzel-4-Verstoß, den 0343 (Zeilen 450-474) als Nebenbefund
-- bereits benannt, aber bewusst nicht behoben hat.
--
-- `common.effektive_provision_pct` behandelt den fehlenden Satz längst richtig
-- (`PayoutUnbekannt("provision")`), nur konnte dort nie ein NULL ankommen —
-- die Spalte ließ es nicht zu. Diese Migration macht den Helfer wirksam.
--
-- WAS DIESE MIGRATION BEWUSST NICHT TUT
-- Sie ändert KEINE einzige Bestandszeile. Ein `update … set … = null where
-- … = 0` wäre die naheliegende „Bereinigung" und genau der Fehler: eine
-- vorhandene 0 kann „bewusst 0 % vereinbart" ODER „nie ausgefüllt" heißen, und
-- die beiden sind aus den Daten nicht unterscheidbar. Sie umzudeuten hieße,
-- eine bewusste Vereinbarung zu einem Datenfehler zu erklären. Bestandszeilen
-- behalten deshalb ihre 0 und rechnen unverändert weiter; NULL entsteht nur
-- dort, wo ab jetzt bewusst nichts eingetragen wird.
--
-- Der Weg für den Bestand ist der aus 0343 beschriebene: die Agentur bestätigt
-- den Satz je Eigentümer in der Maske (auch eine 0), womit aus jeder unklaren
-- 0 eine bestätigte Entscheidung wird.

alter table public.owners
    alter column default_commission_pct drop not null,
    alter column default_commission_pct drop default;

comment on column public.owners.default_commission_pct is
    'Standard-Provisionssatz des Betriebs für diesen Eigentümer, in Prozent. '
    'NULL = noch nicht vereinbart/erfasst — KEIN Synonym für 0 %. '
    'Die Abrechnung wirft bei NULL PayoutUnbekannt("provision") und weist die '
    'Verwaltungs-Auszahlung als „—" aus, statt dem Eigentümer stillschweigend '
    '100 % auszuzahlen (Wurzel 4). Vorrang: '
    'owner_properties.commission_override_pct schlägt diesen Wert.';

-- Der Check aus 0063 bleibt inhaltlich bestehen; er ist NULL-tolerant
-- (`null >= 0` ist unknown → der Constraint gilt als erfüllt), muss also nicht
-- angefasst werden. Explizit festgehalten, damit niemand ihn „nachzieht":
-- ein zusätzliches `not null` im Check wäre die Rückkehr zum alten Zustand.


-- `owner_statements.owner_payout`: Folge derselben Wahrheit.
--
-- 0346 hat `total_price` und `pm_payout` nullable gemacht und dabei
-- ausdrücklich festgehalten, `owner_payout` bleibe `not null`, weil es „immer
-- berechenbar" sei. Diese Annahme galt nur, solange ein fehlender
-- Provisionssatz still als 0 % durchging: dann ließ sich immer eine Zahl
-- bilden — sie war bloß falsch.
--
-- Mit der Änderung oben gibt es den Zustand „Satz nicht vereinbart" wirklich,
-- und damit gibt es Zeiträume, für die die Eigentümer-Auszahlung NICHT
-- berechenbar ist. `_compute_summary` liefert dafür NULL; ohne diese Zeile
-- schlüge das Speichern des Entwurfs mit 23502 fehl (genau der Blocker, den
-- 0346 für die Nachbarspalten behoben hat).
--
-- Eine 0 wäre hier besonders heikel: sie liest sich als „dem Eigentümer steht
-- nichts zu", während in Wahrheit nur der Prozentsatz fehlt.
alter table public.owner_statements
    alter column owner_payout drop not null,
    alter column owner_payout drop default;

comment on column public.owner_statements.owner_payout is
    'Auszahlung an den Eigentümer (Snapshot, in owner_currency). NULL = nicht '
    'berechenbar, weil für mindestens ein Objekt kein Provisionssatz '
    'feststeht — niemals 0 als Ersatzwert (Wurzel 4). Die UI rendert NULL als '
    '„—" und nennt den Grund.';
