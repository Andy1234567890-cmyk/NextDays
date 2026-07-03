-- 0093_guest_name_backfill.sql — Vorname/Nachname für Bestandsgäste ableiten
--
-- Gäste aus Buchungs-Wizard/OTA wurden bis jetzt nur mit dem zusammengesetzten
-- `name` angelegt (identity-Resolver schrieb first_name/last_name aus 0046
-- nicht mit) — die Gästekartei zeigte Vorname/Nachname leer, obwohl der Name
-- ursprünglich aus genau diesen zwei Feldern zusammengesetzt wurde.
--
-- Deterministische Umkehrung (kein Raten): erstes Wort = Vorname, Rest =
-- Nachname. Nur wo BEIDE Felder leer sind, der Name mindestens zwei Wörter
-- hat und der Gast nicht anonymisiert ist. Ein-Wort-Namen bleiben unangetastet
-- (könnte Firma oder nur Vorname sein — nichts erfinden).
-- Neuanlagen schreiben die Felder seitdem direkt (guests/identity.py).

update public.guests
set
    first_name = split_part(btrim(name), ' ', 1),
    last_name  = btrim(substr(btrim(name), length(split_part(btrim(name), ' ', 1)) + 2))
where first_name is null
  and last_name is null
  and anonymized_at is null
  and btrim(coalesce(name, '')) like '% %';
