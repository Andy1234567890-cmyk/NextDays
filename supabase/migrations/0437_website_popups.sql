-- 0437 — Pop-ups mit Auslösern
--
-- Etappe G aus docs/WEBSITE-BAUKASTEN-PLAN.md. Ein Pop-up ist bei uns ein
-- SEITENTYP und keine eigene Tabelle — genau wie bei Hostaway („pop-ups are
-- stored as internal pages with their own URLs", steht in deren Doku zu den
-- URL-Weiterleitungen). Der Grund ist derselbe: es hat Abschnitte, es wird im
-- Editor gebaut, es wird veröffentlicht. Alles, was eine Seite hat.
--
-- WAS ES NICHT WIRD: eine Regel-Engine. Hostaway hat „Personalization Rules"
-- mit Auslösern (Gerät, Ort, Zeit, Besuchszahl, Kampagnen-Parameter) und
-- Aktionen (Hinweisleiste, Pop-up, eigenes JavaScript, „Special Effects" wie
-- Schneeflocken). Davon bauen wir die eine Hälfte, die auf einer
-- Unterkunfts-Website wirklich etwas tut, und lassen die andere bewusst weg:
--
--   · **JavaScript als Aktion** — das ist `custom_js` (0426), und dort gehört
--     es hin. Als „Aktion einer Regel" wäre es ausführbarer Code hinter einer
--     Bedingung, die niemand mehr überblickt.
--   · **Special Effects** (Schneeflocken, fallende Herzen) — eine Website, die
--     schneit, verkauft keine Nacht mehr.
--   · **Kampagnen-Parameter als Auslöser** — er verlangt, dass der Betrieb
--     Kampagnen mit UTM-Parametern fährt. Wer das tut, hat ein Werbekonto und
--     dort bessere Werkzeuge.
--   · **Besuchszahl** — braucht ein Zählcookie über Wochen. Für „schon dreimal
--     hier" gegen ein Pop-up abzuwägen ist kein Geschäft, das eine
--     Ferienwohnung führt.
--
-- Geblieben sind drei Auslöser und zwei Bedingungen, alle ohne Zustand auf dem
-- Server: der Renderer entscheidet sie im Browser.

alter table public.site_pages
    drop constraint if exists site_pages_page_type_check;
alter table public.site_pages
    add constraint site_pages_page_type_check
    check (page_type in ('normal', 'external', 'folder', 'error404', 'popup'));

alter table public.site_pages
    -- WANN es erscheint.
    --   delay  — nach N Sekunden auf der Seite.
    --   exit   — wenn der Zeiger die Seite nach oben verlässt (Verlassensabsicht).
    --            Auf dem Telefon gibt es das nicht; dort greift ersatzweise
    --            `delay` mit demselben Wert (siehe Renderer).
    --   scroll — wenn N Prozent der Seite gelesen sind.
    add column if not exists popup_trigger text,
    -- Sekunden für `delay`, Prozent für `scroll`. EIN Feld für beides, weil
    -- immer nur einer der Auslöser aktiv ist — zwei Spalten wären zwei
    -- Wahrheiten, von denen eine tot ist.
    add column if not exists popup_value smallint,
    -- Nur auf diesen Geräten. NULL = auf allen.
    --   'mobile' | 'desktop'
    add column if not exists popup_device text,
    -- Wie oft: einmal je Browser (dauerhaft gemerkt) oder einmal je Sitzung.
    -- Ein Pop-up, das bei JEDEM Seitenwechsel wieder aufgeht, vertreibt Gäste —
    -- deshalb gibt es „immer" gar nicht.
    add column if not exists popup_once boolean not null default true;

alter table public.site_pages
    drop constraint if exists site_pages_popup_trigger_check;
alter table public.site_pages
    add constraint site_pages_popup_trigger_check check (
        popup_trigger is null
        or popup_trigger in ('delay', 'exit', 'scroll')
    );

alter table public.site_pages
    drop constraint if exists site_pages_popup_device_check;
alter table public.site_pages
    add constraint site_pages_popup_device_check check (
        popup_device is null or popup_device in ('mobile', 'desktop')
    );

-- Ein Auslöser gehört zu einem Pop-up und zu nichts anderem. Ohne diese Prüfung
-- könnte an einer normalen Seite ein `popup_trigger` stehen, der nie greift —
-- gespeichert, wirkungslos, und niemand fände den Grund.
alter table public.site_pages
    drop constraint if exists site_pages_popup_felder_nur_bei_popup;
alter table public.site_pages
    add constraint site_pages_popup_felder_nur_bei_popup check (
        page_type = 'popup'
        or (popup_trigger is null and popup_value is null
            and popup_device is null)
    );

-- Und umgekehrt: ein Pop-up ohne Auslöser wäre unsichtbar. Der Wertebereich
-- deckt beide Bedeutungen ab (1–120 Sekunden bzw. 1–100 Prozent); die genaue
-- Grenze je Auslöser erzwingt das Backend-Schema, weil sie dort mit einer
-- Meldung statt einem 23514 kommt.
alter table public.site_pages
    drop constraint if exists site_pages_popup_braucht_auslöser;
alter table public.site_pages
    drop constraint if exists site_pages_popup_braucht_ausloeser;
alter table public.site_pages
    add constraint site_pages_popup_braucht_ausloeser check (
        page_type <> 'popup'
        or (popup_trigger is not null
            and (popup_value is null or popup_value between 1 and 120))
    );

comment on column public.site_pages.popup_trigger is
    'Wann das Pop-up erscheint: delay (nach N Sekunden) · exit '
    '(Verlassensabsicht) · scroll (nach N Prozent). Nur bei page_type=popup.';
comment on column public.site_pages.popup_value is
    'Sekunden bei delay, Prozent bei scroll. Ein Feld für beides, weil immer '
    'nur ein Auslöser aktiv ist.';
comment on column public.site_pages.popup_device is
    'Nur auf diesem Gerätetyp zeigen (mobile/desktop). NULL = auf allen.';
comment on column public.site_pages.popup_once is
    'true = einmal je Browser (dauerhaft), false = einmal je Sitzung. Ein '
    'Pop-up, das bei jedem Seitenwechsel wieder aufgeht, gibt es bewusst nicht.';
