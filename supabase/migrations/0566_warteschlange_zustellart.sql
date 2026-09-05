-- 0566 — Die Warteschlange lernt die Zustellart: Entwurf ODER automatisch.
--
-- Anlass (05.09.2026, 10:31 UTC): Der Betrieb hatte in den KI-Texten beide
-- Richtungen auf „Als Entwurf vorbereiten" gestellt. Der Worker-Tick legte
-- sieben KI-Antworten als Entwurf an (`send_at = jetzt`, damit sie in der
-- Liste oben stehen) — und `send_due` schickte sie im SELBEN Tick an
-- Booking.com und Airbnb, weil es nur `status = 'geplant'` und
-- `send_at <= now()` prüft. Die Zustellart stand ausschliesslich in
-- `review_ki_settings` und im Protokoll, nie am Eintrag selbst. Eine
-- öffentliche Antwort lässt sich bei keinem Portal zurücknehmen.
--
-- Deshalb trägt jeder Eintrag jetzt selbst, ob er von sich aus rausgeht:
--   'automatisch' — geht zur Fälligkeit ohne weiteres Zutun raus
--                   (Vorlagen-Automatik seit 0267, KI bei 'automatisch').
--   'entwurf'     — bleibt liegen, bis ein Mensch „Abschicken" drückt.
-- Vorgabe 'automatisch': jede bestehende Zeile stammt aus der
-- Vorlagen-Automatik, deren Zusage genau das war — planen, sichtbar machen,
-- zur Fälligkeit senden (Wurzel 1: Altbestand mitpflegen, nicht umdeuten).

alter table public.guest_review_queue
    add column if not exists zustellart text not null default 'automatisch';

alter table public.guest_review_queue
    drop constraint if exists guest_review_queue_zustellart_check;
alter table public.guest_review_queue
    add constraint guest_review_queue_zustellart_check
    check (zustellart in ('entwurf', 'automatisch'));

comment on column public.guest_review_queue.zustellart is
    'automatisch = geht zur Fälligkeit von selbst raus; entwurf = wartet auf '
    'die Freigabe eines Menschen. Der Versandlauf (send_due) nimmt NUR '
    'automatisch.';

-- Der Versandlauf fragt „geplant, fällig, automatisch" — der alte Teilindex
-- (0267, nur status) deckt das mit; ein eigener wäre bei dieser Tabellengrösse
-- Zierde. Bewusst kein neuer Index.

-- --------------------------------------------------------------------------
-- Zwei Einträge je Portal-Bewertung: Gastbewertung UND öffentliche Antwort
-- --------------------------------------------------------------------------
-- 0267 legte `guest_review_queue_review_uidx` auf (review_id) allein an —
-- damals gab es nur die Gastbewertung. Seit 0549 hängt an derselben Airbnb-
-- Bewertung auch der Antwort-Entwurf (review_id = channex_review.id). Der
-- zweite Insert lief in 23505, beide Anlegepfade werten das als „steht schon
-- drin" und geben still False zurück: je nach Reihenfolge fehlte dauerhaft
-- die KI-Antwort oder die Gastbewertung, und der KI-Lauf erzeugte den Text
-- bei Vertex in jedem Tick neu. Eindeutig ist das Paar (review_id, richtung).
drop index if exists public.guest_review_queue_review_uidx;
create unique index if not exists guest_review_queue_review_richtung_uidx
    on public.guest_review_queue (review_id, richtung)
    where review_id is not null;
