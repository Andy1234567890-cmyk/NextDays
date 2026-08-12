-- 0366 — Portal-Abzugssatz darf einen OFFENEN ANFANG haben
--
-- WARUM (live gefunden am 11.08.2026):
-- Der Betrieb trug unter „Erweiterte Einstellungen" Airbnb 15,5 % und
-- Booking.com 15,0 % ein. Das Formular belegte `gueltig_ab` mit HEUTE. Weil
-- die Rechenkette den Satz am CHECK-OUT der Buchung auflöst, galt er für keine
-- einzige bestehende Buchung: sechs Aufenthalte aus Juni und August blieben
-- ohne bestimmbaren Portal-Abzug, der Bericht zeigte 0,00 DKK — und der
-- Betrieb hatte alles ausgefüllt, was die Maske verlangte.
--
-- Die Wurzel ist das Datenmodell, nicht die Maske: `gueltig_ab not null`
-- verlangt einen Anfang, den niemand kennt. Ein Betrieb weiß „Airbnb nimmt
-- 15,5 %", nicht „seit dem 14.03.2024". Ein erfundenes Startdatum wäre eine
-- Behauptung über die Vergangenheit (Wurzel 4), und der einzige ehrliche Wert
-- dafür ist „von Beginn an" — also NULL.
--
-- NULL heißt: dieser Satz gilt für ALLE Buchungen bis zum ersten befristeten
-- Nachfolgesatz. Wird später ein neuer Satz ab Datum X angelegt, bekommt
-- dieser hier `gueltig_bis = X` und bleibt für die Historie gültig — die
-- bestehende Zeitachse bleibt unverändert.
--
-- Beide EXCLUDE-Constraints tragen NULL korrekt: `daterange(null, bis, '[)')`
-- ist das Intervall (-∞, bis) und überlappt weiterhin wie erwartet. Der CHECK
-- `gueltig_bis is null or gueltig_bis > gueltig_ab` wird bei NULL zu NULL und
-- gilt damit als erfüllt — genau richtig, denn gegen einen offenen Anfang kann
-- kein Endtag zu früh liegen.

alter table public.portal_abzugssaetze
  alter column gueltig_ab drop not null;

comment on column public.portal_abzugssaetze.gueltig_ab is
  'Beginn der Gültigkeit. NULL = von Beginn an (gilt auch für vergangene '
  'Buchungen) — der Normalfall beim ersten Satz eines Kanals, weil der '
  'Betrieb den Vertragsbeginn des Portals nicht kennt.';
