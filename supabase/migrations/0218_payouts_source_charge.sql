-- Auszahlung an den Ursprungs-Charge binden (weltweite Betriebe).
--
-- PROBLEM: Unser Plattformkonto ist dänisch und führt seinen Saldo in DKK.
-- Ein Transfer in einer anderen Währung scheitert mit
-- "insufficient available funds", solange kein Guthaben in DIESER Währung
-- vorliegt — live gegen die Sandbox nachgewiesen: dkk ging, eur/usd/gbp nicht.
--
-- Da die Plattform Betriebe weltweit bedient (US, CA, AU, JP, SG, GB, CH, MX,
-- AE, TH, MY sind von DK aus anlegbar), wäre das für jeden Nicht-DKK-Betrieb
-- ein Totalausfall der Auszahlung.
--
-- LÖSUNG: source_transaction. Stripe bindet den Transfer an den konkreten
-- Charge, aus dem er stammt, und wartet auf dessen Verfügbarkeit — statt am
-- freien Saldo zu scheitern. Der Charge ist bereits in der Währung des Gastes
-- eingegangen, also fließt das Geld in derselben Währung weiter.
--
-- Dafür muss die Auszahlungszeile wissen, aus welchem Charge sie stammt.

alter table public.payouts
    add column if not exists source_charge_id text;

comment on column public.payouts.source_charge_id is
  'Stripe-Charge, aus dem diese Auszahlung stammt. Wird als source_transaction '
  'am Transfer gesetzt: bindet ihn an den konkreten Zahlungseingang, statt am '
  'freien Plattform-Saldo zu scheitern (nötig für Betriebe außerhalb der '
  'Plattform-Währung).';
