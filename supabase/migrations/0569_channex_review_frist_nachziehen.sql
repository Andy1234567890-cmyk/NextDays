-- 0569 — Antwortfrist nachziehen und verstrichene Fristen als verfallen führen.
--
-- Zwei Lücken, live am 05.09.2026 an einer Airbnb-Bewertung vom 25.07.:
-- (1) `reply_expires_at` (0567) war leer, obwohl `raw->>'expired_at'` den
--     24.08. trug — die Zeile war seit 0567 nicht mehr durch den Sync gelaufen.
-- (2) Channex meldete `is_expired=false` trotz verstrichener Frist; die
--     Bewertung stand als „offen" in Liste, Kennzahl und KI-Diagnose, obwohl
--     das Portal keine Antwort mehr annimmt.
-- Der Sync leitet `is_expired` jetzt auch aus der Frist ab; hier der
-- Altbestand. Nur aus den Rohdaten des Portals, kein eigener Wert (Wurzel 4).
update public.channex_review
   set reply_expires_at = ((raw->>'expired_at') || '+00:00')::timestamptz
 where reply_expires_at is null
   and coalesce(raw->>'expired_at', '') <> '';

update public.channex_review
   set is_expired = true,
       updated_at = now()
 where is_expired = false
   and reply_expires_at is not null
   and reply_expires_at < now();
