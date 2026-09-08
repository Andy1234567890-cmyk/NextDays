-- Kinder und Haustiere am Aufenthalts-Antrag des Eigentümers.
--
-- WARUM (08.09.2026, Ansage des Nutzers „gibts keine Kinder oder Haustiere"):
-- 0606 brachte nur EINE Gästezahl. Die Verwaltung braucht aber beides einzeln,
-- und zwar bevor sie zusagt:
--   * KINDER entscheiden über die Ausstattung (Gitterbett, Hochstuhl) und bei
--     manchen Objekten über die zulässige Belegung. „4 Gäste" sagt nicht, ob
--     ein Kinderbett gebraucht wird.
--   * HAUSTIERE entscheiden über die Reinigung und darüber, ob das Objekt sie
--     überhaupt erlaubt. Genau daran hängt auch die Haustiergebühr
--     (`_ANLASS_GEBUEHREN`: `pet_fee` gilt nur, wenn `reservations.pets > 0`)
--     — ohne das Feld am Antrag entstünde sie bei der Zusage nie.
--
-- `gaeste` aus 0606 bleibt die GESAMTZAHL inklusive Kinder: so lesen es die
-- bestehenden Zeilen und die Oberfläche der Verwaltung. `kinder` ist die
-- Teilmenge davon, nicht ein Zuschlag — sonst zählte ein Kind doppelt.
--
-- Beide NULL-fähig ohne Default: ein Altbestand-Antrag hat die Angabe nicht,
-- und „0 Kinder" ist etwas anderes als „nicht gefragt worden" (Wurzel 4).

alter table public.block_requests
    add column if not exists kinder smallint
        check (kinder is null or (kinder between 0 and 20)),
    -- Anzahl der Tiere, nicht ein Ja/Nein: die Gebühr wird je Tier erhoben,
    -- und „2 Hunde" ist für die Reinigung eine andere Ansage als „1 Hund".
    add column if not exists haustiere smallint
        check (haustiere is null or (haustiere between 0 and 10));

comment on column public.block_requests.kinder is
    'Kinder im Aufenthalt — Teilmenge von `gaeste`, nicht zusätzlich. NULL = nicht angegeben.';
comment on column public.block_requests.haustiere is
    'Anzahl mitgebrachter Tiere. Steuert Reinigung und `pet_fee` bei der Zusage. NULL = nicht angegeben.';
