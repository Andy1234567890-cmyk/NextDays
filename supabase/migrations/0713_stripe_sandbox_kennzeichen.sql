-- 0713 — welche Stripe-WELT gilt fuer diesen Mandanten.
--
-- ANLASS (16.09.2026): myBestDays soll gegen die Stripe-SANDBOX laufen,
-- waehrend myNextDays echtes Geld bewegt. Beides im selben Betrieb, ohne den
-- Live-Pfad anzufassen — AirSmil ist der einzige Mandant mit einem echten
-- verbundenen Konto (`acct_1U19sh…`, freigeschaltet), und an seinem Weg darf
-- sich nichts aendern.
--
-- WARUM EIN EIGENES FELD UND NICHT `tenants.account_type = 'marketplace'`:
-- Die Umgebung ist keine Eigenschaft des Geschaeftsmodells. Wer beides
-- gleichsetzt, sperrt den ERSTEN echten myBestDays-Gastgeber in der Testwelt
-- ein — sein `acct_` gaebe es live nicht, `stripe_charges_enabled` bliebe
-- false, und er bekaeme nie eine Auszahlung. Das Kennzeichen wird deshalb
-- ausdruecklich gesetzt, nicht abgeleitet.
--
-- DEFAULT FALSE ist die Sicherheitsrichtung: jeder Bestand und jeder neue
-- Mandant ist LIVE. Sandbox bekommt nur, wer es eingetragen bekommt.
--
-- WAS DAS FELD NICHT TUT: Es schaltet keinen Schluessel um. Fehlt
-- `STRIPE_MARKTPLATZ_SECRET_KEY`, waehrend hier `true` steht, scheitert der
-- Aufruf LAUT (503) — es gibt keinen Rueckfall auf den Live-Schluessel
-- (CLAUDE.md, Wurzel 5). Ein Sandbox-Mandant kann auf keinem Weg eine echte
-- Karte belasten.
--
-- DIESES FELD IST AUF ABSCHAFFUNG GEBAUT. Sobald der Marktplatz live geht,
-- traegt `STRIPE_MARKTPLATZ_SECRET_KEY` denselben Wert wie
-- `STRIPE_SECRET_KEY`, das Feld steht ueberall auf false und kann samt
-- `payments/welt.py::ist_sandbox` entfallen. Die Trennung der beiden WEGE
-- bleibt davon unberuehrt — sie erlaubt dem Marktplatz spaeter ein eigenes
-- Stripe-Konto.
--
-- Wegwerfware, bewusst: Connect-Konten, die in der Sandbox eingerichtet
-- werden, existieren live NICHT. Wer hier `true` setzt, darf dort keinen
-- echten Gastgeber onboarden — er muesste die Einrichtung spaeter komplett
-- wiederholen.

alter table public.tenant_billing_profile
  add column if not exists stripe_sandbox boolean not null default false;

comment on column public.tenant_billing_profile.stripe_sandbox is
  'true = dieser Mandant spricht mit der Marktplatz-/Sandbox-Stripe-Welt '
  '(STRIPE_MARKTPLATZ_SECRET_KEY) statt mit dem Live-Schluessel. Default '
  'false. Kein Rueckfall: fehlt der Marktplatz-Schluessel, scheitert der '
  'Aufruf. Siehe apps/api/src/features/payments/welt.py.';

-- Kein GRANT noetig: `tenant_billing_profile` ist fuer anon/authenticated
-- ohnehin gesperrt (0169) — nur die Service-Rolle liest es. Ein Client soll
-- gar nicht sehen (und erst recht nicht setzen) koennen, in welcher Welt ein
-- Mandant zahlt. Deshalb steht hier auch bewusst KEIN neues Policy-Paar:
-- die Tabelle traegt bereits einen Riegel, ein zweiter waere nur Rauschen.
