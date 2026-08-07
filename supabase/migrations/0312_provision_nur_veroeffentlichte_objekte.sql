-- 0312_provision_nur_veroeffentlichte_objekte.sql — Altbestand bereinigen
--
-- Regel ab 07.08.2026: Provision fällt NUR für veröffentlichte Objekte an
-- (`properties.status='active'` — genau das, was publish() setzt). Ein Entwurf
-- ist nicht im Verkauf und wird nicht berechnet, auch wenn über das verknüpfte
-- OTA-Inserat noch Buchungen eingehen. Durchgesetzt wird das beim Erfassen
-- (`SubscriptionsService.record_commission` → `_objekt_veroeffentlicht`).
--
-- Diese Migration räumt den Bestand nach, der vor der Regel entstanden ist:
-- live standen 9 offene Zeilen (223,45 DKK) — alle auf Objekten im Status
-- 'draft'. Sie wären am 1. des Folgemonats eingezogen worden, obwohl kein
-- einziges der Objekte veröffentlicht ist.
--
-- Scope, eng und bewusst:
--   * NUR status='pending'. Bereits fakturierte Zeilen hängen an einem
--     gestellten Stripe-Invoice-Item und bleiben stehen — sie nachträglich zu
--     löschen würde Rechnung und Ledger auseinanderlaufen lassen.
--   * NUR Zeilen, deren Objekt NICHT 'active' ist. Zeilen ohne auflösbare
--     Reservierung/Objekt fallen ebenfalls weg: was wir nicht belegen können,
--     stellen wir nicht in Rechnung (fail-closed, dieselbe Regel wie im Code).
--   * delete statt update: eine Provisionszeile mit Betrag 0 wäre eine
--     Falschaussage („es ist Provision entstanden"), nicht bloß ein Nullwert.

delete from public.commission_ledger cl
 where cl.status = 'pending'
   and not exists (
     select 1
       from public.reservations r
       join public.properties p on p.id = r.property_id
      where r.id = cl.reservation_id
        and r.tenant_id = cl.tenant_id
        and p.tenant_id = cl.tenant_id
        and p.status = 'active'
   );
