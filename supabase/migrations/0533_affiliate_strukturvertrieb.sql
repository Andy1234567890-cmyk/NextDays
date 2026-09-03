-- 0533: Partnerprogramm → Strukturvertrieb (03.09.2026).
--
-- Bis hier galt „genau eine Ebene": ein Sponsor durfte selbst keinen Sponsor
-- haben, ein Team-Führer nicht Mitglied werden (Trigger 0520), und je
-- Ertragszeile gab es höchstens EINE Override-Zeile (Unique-Index 0520).
-- Entscheidung 03.09.2026: die Team-Provision läuft über die GANZE Sponsor-
-- Kette nach oben (Roll-up zum höchsten bereits vergüteten Satz, Summe = Satz
-- des höchsten Rangs der Kette, Deckel 30 % hält von selbst), der Rang zählt
-- die zahlenden Kunden der ganzen Struktur, Superprovision und Buchungsanteil
-- gehen genau einmal an den ersten Elite von unten.
--
-- Was die DB dafür ändern muss:
--   1. Das Ebenen-Limit fällt. An seine Stelle tritt ein ZYKLENSCHUTZ — ohne
--      ihn könnte A → B → A entstehen, und jede Kettenwanderung im Code liefe
--      endlos (Wurzel 8). Dazu eine harte Tiefengrenze (25), identisch zu
--      `provision.UPLINE_MAX`.
--   2. Der Override-Index wird auf (parent_id, affiliate_id) erweitert: je
--      Ertragszeile eine Zeile JE SPONSOR der Kette, idempotent je Empfänger.
--
-- Bestehende Daten: es gibt heute keine Kette tiefer als eins (der alte
-- Trigger hat es verhindert), der neue Index ist eine Lockerung — beides
-- läuft ohne Datenmigration.

-- 1. Ebenen-Trigger weg, Zyklen-Trigger hin -----------------------------------
drop trigger if exists affiliates_sponsor_eine_ebene on public.affiliates;
drop function if exists public.affiliate_sponsor_eine_ebene();

-- Keine coalesce()-Falle, keine Bedingung, die bei einem Update ohne Sponsor-
-- Bezug werfen könnte (Lehre aus 0418→0424). Die Schleife endet, sobald ein
-- Knoten keinen Sponsor hat (select ... into liefert NULL) — oder laut, wenn
-- sie den Ausgangsknoten wiederfindet oder die Tiefe reißt.
create or replace function public.affiliate_sponsor_kein_zyklus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    aktuell uuid;
    tiefe   integer := 0;
begin
    if new.sponsor_affiliate_id is null then
        return new;
    end if;
    if tg_op = 'UPDATE' and new.sponsor_affiliate_id is not distinct from old.sponsor_affiliate_id then
        return new;
    end if;
    aktuell := new.sponsor_affiliate_id;
    while aktuell is not null loop
        if aktuell = new.id then
            raise exception 'Sponsor-Kette von % führt zu sich selbst zurück (Zyklus).', new.id
                using errcode = 'check_violation';
        end if;
        tiefe := tiefe + 1;
        if tiefe > 25 then
            raise exception 'Sponsor-Kette tiefer als 25 Ebenen — abgelehnt.'
                using errcode = 'check_violation';
        end if;
        select s.sponsor_affiliate_id into aktuell
          from public.affiliates s
         where s.id = aktuell;
    end loop;
    return new;
end;
$$;

revoke execute on function public.affiliate_sponsor_kein_zyklus() from anon, authenticated;

drop trigger if exists affiliates_sponsor_kein_zyklus on public.affiliates;
create trigger affiliates_sponsor_kein_zyklus
    before insert or update of sponsor_affiliate_id on public.affiliates
    for each row execute function public.affiliate_sponsor_kein_zyklus();

comment on column public.affiliates.sponsor_affiliate_id is
    'Sponsor (Team-Führung) dieses Partners — Kette beliebiger Tiefe bis 25, zyklenfrei '
    '(Trigger affiliates_sponsor_kein_zyklus, 0533). Team-Provision = Roll-up-Differenz '
    'über die ganze Kette (provision.override_buchen).';

-- 2. Override-Index: eine Zeile je Ertragszeile UND Sponsor ------------------
drop index if exists public.affiliate_commissions_override_parent_uq;
create unique index if not exists affiliate_commissions_override_uq
    on public.affiliate_commissions (parent_id, affiliate_id)
    where kind = 'override';
