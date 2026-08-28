-- 0448 — Abschnitte je Geraet ausblenden („Hide from")
--
-- Hostaway kann jedes Element auf Desktop, Tablet und Mobil EINZELN
-- ausblenden. Bei uns fehlte das ganz: ein Abschnitt war entweder auf der
-- Seite oder geloescht. Wer ein breites Titelbild auf dem Telefon nicht haben
-- will, musste bisher eine zweite Seite bauen.
--
-- WARUM EINE SPALTE UND KEIN FELD IN `settings`:
-- `settings` ist ein freies jsonb, das der Server bis heute ungeprueft
-- durchreicht. Eine Sichtbarkeits-Angabe entscheidet aber darueber, ob ein
-- Abschnitt beim Gast erscheint — dafuer ist eine gepruefte Spalte mit einer
-- geschlossenen Werteliste die richtige Form (Wurzel 4: keine erfundenen
-- Werte, klar fehlschlagen statt raten).
--
-- WELCHE GERAETE: genau die zwei, die unser Editor auch umschalten kann
-- (`Geraet = "desktop" | "mobil"`, web/components/website/vorschau.tsx). Eine
-- dritte Stufe „Tablet" in der DB zu fuehren, die keine Oberflaeche setzen und
-- keine Vorschau zeigen kann, waere eine Attrappe. Kommt der Tablet-
-- Breakpoint, kommt er als eigene Migration mit Umschalter und Vorschau.
--
-- DER GEGENZUSTAND (Wurzel 1): ausblenden muss zuruecknehmbar bleiben. Ein
-- Abschnitt, der auf ALLEN Geraeten aus ist, verschwindet bei Hostaway aus dem
-- Canvas und ist nur noch ueber das Ebenen-Panel erreichbar. Bei uns bleibt er
-- im Editor IMMER sichtbar (durchscheinend, mit durchgestrichenem Auge) — er
-- verschwindet ausschliesslich auf der Gast-Seite. Deshalb ist der leere Array
-- der Default und `hidden_on` nie NULL: „keine Angabe" und „nirgends
-- versteckt" sind derselbe Zustand und brauchen keine zwei Darstellungen.

alter table public.site_blocks
    add column if not exists hidden_on text[] not null default '{}'::text[];

-- Geschlossene Werteliste auf DB-Ebene. Der FastAPI-Layer prueft dasselbe,
-- aber `site_blocks` traegt eine tenant-`for all`-Policy — ein Client mit
-- anon-Key und gueltigem JWT schreibt hier direkt per PostgREST vorbei
-- (Wurzel 6). Ohne diesen Check landete dort jeder beliebige String und der
-- Renderer haette eine unbekannte Klasse zu bauen.
alter table public.site_blocks
    drop constraint if exists site_blocks_hidden_on_werte;
alter table public.site_blocks
    add constraint site_blocks_hidden_on_werte check (
        hidden_on <@ array['desktop', 'mobil']::text[]
    );

-- Doppelte Eintraege sind kein zweiter Zustand, sondern derselbe zweimal.
-- Ohne diesen Check waere `{mobil,mobil}` erlaubt und jede Rundreise durch den
-- Editor haette den Array weiter wachsen lassen (Wurzel 2: dieselbe Eingabe
-- zweimal gesendet muss denselben Zustand ergeben).
--
-- Ausgeschrieben statt per `count(distinct …)`: eine CHECK-Bedingung darf
-- keine Unterabfrage enthalten. Bei genau zwei erlaubten Werten ist
-- „hoechstens zwei Eintraege und die beiden verschieden" dieselbe Aussage.
alter table public.site_blocks
    drop constraint if exists site_blocks_hidden_on_eindeutig;
alter table public.site_blocks
    add constraint site_blocks_hidden_on_eindeutig check (
        cardinality(hidden_on) <= 2
        and (cardinality(hidden_on) < 2 or hidden_on[1] <> hidden_on[2])
    );

comment on column public.site_blocks.hidden_on is
    'Geraete, auf denen dieser Abschnitt beim GAST nicht erscheint '
    '(''desktop'', ''mobil''). Leer = ueberall sichtbar. Im Editor bleibt ein '
    'versteckter Abschnitt immer sichtbar (durchscheinend), sonst gaebe es '
    'keinen Weg zurueck.';
