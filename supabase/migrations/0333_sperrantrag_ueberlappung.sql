-- 0333 — Überlappende GENEHMIGTE Sperr-Anträge verhindern.
--
-- DER FEHLER, DEN DAS SCHLIESST (Wurzel 1 — der Gegenzustand):
-- Der Widerruf einer Genehmigung gibt die Nächte über
-- `CalendarService._unblock` frei. Der löscht im Zeitraum ALLES mit
-- `status='blocked' AND source='manual'` — er kann nicht wissen, welcher
-- Antrag welche Nacht gesperrt hat, denn `availability` trägt keinen Bezug
-- zum Antrag.
--
-- Solange zwei GENEHMIGTE Anträge für dasselbe Objekt überlappen durften,
-- entstand daraus ein stiller Datenfehler: Antrag A (1.–10.) und Antrag B
-- (5.–7.) sind beide genehmigt, der Widerruf von B öffnet auch die Nächte
-- 5.–7. von A — während A weiterhin „approved" anzeigt. Das Objekt wäre an
-- Tagen verkäuflich, für die dem Eigentümer eine Sperre zugesagt ist, und
-- niemand sähe einen Widerspruch: beide Zustände sehen für sich plausibel aus.
--
-- Die Reparatur gehört in die DB, nicht in den Service: eine Prüfung im
-- Python-Code wäre ein Read-vor-Write und damit genau das Rennen, das Wurzel 2
-- beschreibt (zwei gleichzeitige Genehmigungen sähen beide „keine
-- Überlappung"). Ein EXCLUDE-Constraint entscheidet im Schreibmoment.
--
-- NUR 'approved' ist erfasst (partieller WHERE): offene Anträge dürfen sich
-- selbstverständlich überlappen — mehrere Eigentümer-Wünsche für denselben
-- Zeitraum sind ein normaler Vorgang, den die Agentur durch Entscheiden
-- auflöst. Abgelehnte erst recht. Verboten ist ausschließlich der Zustand,
-- der zwei Sperren gleichzeitig WIRKSAM behauptet.
--
-- daterange(..., '[]'): start_date und end_date sind INKLUSIV gespeichert (der
-- Eigentümer meint „vom 1. bis zum 5."), anders als der exklusive DateRange
-- des Kalenders. Ein '[)' hier ließe zwei Anträge durch, die sich am letzten
-- Tag berühren, obwohl beide diese Nacht sperren.

create extension if not exists btree_gist;

alter table public.block_requests
    drop constraint if exists block_requests_kein_ueberlapp;

alter table public.block_requests
    add constraint block_requests_kein_ueberlapp
    exclude using gist (
        property_id with =,
        daterange(start_date, end_date, '[]') with &&
    )
    where (status = 'approved');

comment on constraint block_requests_kein_ueberlapp on public.block_requests is
    'Zwei GENEHMIGTE Anträge dürfen sich am selben Objekt nicht überlappen '
    '(0333). Sonst gäbe der Widerruf des einen die Nächte des anderen frei, '
    'weil availability keinen Antragsbezug trägt — das Objekt wäre trotz '
    'zugesagter Sperre verkäuflich. Offene/abgelehnte Anträge sind frei '
    'überlappbar.';
