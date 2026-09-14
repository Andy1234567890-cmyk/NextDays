-- 0632 — Modul 3 (Buchhaltung) NUR für den Vorführbetrieb.
--
-- Anweisung vom 11.09.2026: „das buchhaltung tool muss nur bei theresa.gruber
-- frei geschaltet sein bei niemandem sonst". theresa.gruber@mynextdays.com ist
-- der Vorführbetrieb (Nordstrand Feriehusudlejning, `ist_vorfuehrbetrieb`, 0630).
--
-- Stand vor dieser Migration (gelesen am 11.09.2026): drei Entitlements
-- `modul3_buchhaltung`, alle aktiv, KEINES mit Stripe-Subscription-Item —
-- Hotel Seeblick Warnemünde, Nordlys Feriehusudlejning (die öffentliche
-- Live-Vorschau, merle.ahrens) und Nordstrand. Die ersten beiden werden
-- deaktiviert, nicht gelöscht: der Gegenzustand bleibt rekonstruierbar
-- (Wurzel 1), und die Zeile hält die unique-(tenant, module)-Idempotenz.
--
-- Zwei Wächter, weil eine Migration ohne sie still das Falsche täte:
--   1. Ein BEZAHLTES Entitlement (stripe_subscription_item_id gesetzt) darf
--      hier nie abgeschaltet werden — das wäre ein Eingriff in einen Kauf.
--   2. Danach muss GENAU EIN aktives Entitlement übrig sein, und zwar das des
--      Vorführbetriebs. Alles andere ist ein Fehler, keine Warnung.

do $$
declare
    bezahlt integer;
begin
    select count(*) into bezahlt
    from public.tenant_module_entitlement e
    join public.tenants t on t.id = e.tenant_id
    where e.module_key = 'modul3_buchhaltung'
      and e.active
      and e.stripe_subscription_item_id is not null
      and not coalesce(t.ist_vorfuehrbetrieb, false);
    if bezahlt > 0 then
        raise exception '0632: % bezahlte Buchhaltungs-Entitlements betroffen — Abbruch, nichts geändert.', bezahlt;
    end if;
end $$;

update public.tenant_module_entitlement e
set active = false
from public.tenants t
where t.id = e.tenant_id
  and e.module_key = 'modul3_buchhaltung'
  and e.active
  and not coalesce(t.ist_vorfuehrbetrieb, false);

-- Der Vorführbetrieb hat das Modul aktiv (idempotent, legt die Zeile an, falls
-- sie fehlt).
insert into public.tenant_module_entitlement (tenant_id, module_key, active)
select id, 'modul3_buchhaltung', true
from public.tenants
where ist_vorfuehrbetrieb
on conflict (tenant_id, module_key) do update set active = true, active_until = null;

do $$
declare
    aktive integer;
    vorfuehr integer;
begin
    select count(*) into aktive
    from public.tenant_module_entitlement
    where module_key = 'modul3_buchhaltung' and active;
    select count(*) into vorfuehr
    from public.tenant_module_entitlement e
    join public.tenants t on t.id = e.tenant_id
    where e.module_key = 'modul3_buchhaltung' and e.active and t.ist_vorfuehrbetrieb;
    if aktive <> 1 or vorfuehr <> 1 then
        raise exception '0632: erwartet genau 1 aktives Entitlement (Vorführbetrieb), gefunden % aktive / % Vorführbetrieb.', aktive, vorfuehr;
    end if;
end $$;
