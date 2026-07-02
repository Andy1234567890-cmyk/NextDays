-- 0089_stop_sell_agency_idx.sql — Index auf stop_sell.agency_id
--
-- Der FK aus 0088 (agency_id → travel_agencies, on delete set null) hat keinen
-- Index: Jede Agentur-Löschung müsste stop_sell sequenziell scannen, und die
-- Kartei filtert Stopps nach Partner. (Review-Befund M3/P7 zu 0088.)
create index if not exists stop_sell_agency_idx
    on public.stop_sell(agency_id)
    where agency_id is not null;
