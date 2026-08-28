-- 0449 — Korrektur zu 0448: „Hide from" gehoert in `settings`, nicht in eine
--        eigene Spalte
--
-- 0448 hat `site_blocks.hidden_on` als eigene Spalte angelegt. Beim Anschluss
-- an die Lesepfade kam heraus, dass das nicht traegt:
--
-- Eine Seite wird an SECHS Stellen fuer den Renderer zusammengebaut — die
-- veroeffentlichte Seite, die Entwurfs-Vorschau, die eigene Fehlerseite
-- (0433), die Pop-ups (0437), die Blog-Beitraege (0438) und die
-- Vorlagen-Vorschau. Jede dieser Stellen reicht `content` und `settings`
-- durch; eine SIEBTE Spalte muesste an jeder einzeln nachgezogen werden. Beim
-- Bau war sie an zweien schon vergessen, und der Fehler ist genau die stille
-- Sorte: die Seite rendert, der Abschnitt ist nur ueberall sichtbar, obwohl
-- der Kunde ihn ausgeblendet hat.
--
-- `settings` ist dagegen als „generische Darstellungs-Settings, fuer alle
-- Block-Typen gleich" definiert und laeuft ohne Zutun durch alle sechs Pfade.
-- Sichtbarkeit je Geraet ist genau so ein Wert.
--
-- Die Werte-Pruefung geht dabei NICHT verloren: sie wandert als CHECK auf das
-- jsonb. `site_blocks` traegt eine tenant-`for all`-Policy, ein Client mit
-- anon-Key schreibt also per PostgREST am FastAPI-Layer vorbei (Wurzel 6) —
-- die DB muss die geschlossene Werteliste selbst kennen.

-- Die Spalte aus 0448 war nie befuellt (sie entstand und verschwand im selben
-- Arbeitsgang, kein Kunde hat je einen Wert darin gesetzt). Es geht also keine
-- Kundenangabe verloren; ein Nachtragen nach `settings` waere ein Umzug von
-- Null Zeilen.
alter table public.site_blocks
    drop constraint if exists site_blocks_hidden_on_werte;
alter table public.site_blocks
    drop constraint if exists site_blocks_hidden_on_eindeutig;
alter table public.site_blocks
    drop column if exists hidden_on;

-- Geschlossene Werteliste auf DB-Ebene.
--
-- `<@` auf jsonb-Arrays heisst „jedes Element kommt in der rechten Liste vor".
-- Damit sind `[]`, `["mobil"]`, `["desktop"]` und `["desktop","mobil"]`
-- erlaubt und alles andere abgewiesen. Fehlt der Schluessel ganz, ist das der
-- Normalfall „ueberall sichtbar" und ebenfalls erlaubt — `settings` ist ein
-- offenes Objekt, in dem die meisten Bloecke gar nichts stehen haben.
--
-- Doppelte Eintraege (`["mobil","mobil"]`) laesst jsonb-Containment durch; sie
-- sind aber auch harmlos, weil der Wert als MENGE gelesen wird. Der Server
-- normalisiert zusaetzlich (sortiert und entdoppelt), damit dieselbe Eingabe
-- zweimal gesendet dieselbe Zeile ergibt (Wurzel 2).
alter table public.site_blocks
    drop constraint if exists site_blocks_settings_hidden_on;
alter table public.site_blocks
    add constraint site_blocks_settings_hidden_on check (
        settings->'hidden_on' is null
        or (
            jsonb_typeof(settings->'hidden_on') = 'array'
            and settings->'hidden_on' <@ '["desktop", "mobil"]'::jsonb
        )
    );

comment on constraint site_blocks_settings_hidden_on on public.site_blocks is
    'settings.hidden_on = Geraete, auf denen dieser Abschnitt beim GAST nicht '
    'erscheint. Erlaubt sind ausschliesslich ''desktop'' und ''mobil'' — genau '
    'die zwei, die der Editor umschalten kann. Im Editor bleibt ein '
    'versteckter Abschnitt immer sichtbar (durchscheinend), sonst gaebe es '
    'keinen Weg zurueck.';
