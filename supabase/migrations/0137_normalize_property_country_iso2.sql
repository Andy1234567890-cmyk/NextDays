-- 0137: properties.country auf ISO-3166-1 alpha-2 normalisieren.
--
-- Bestand trägt teils Klartext-Ländernamen („Deutschland"/„Germany"), weil das
-- Standort-Formular ein freies Textfeld hatte und der Places-Picker den long_name
-- lieferte. Channex verlangt ISO-2 (max 2 Zeichen) → 422 beim Veröffentlichen.
-- Ab jetzt erzwingt das Backend-Schema ISO-2 beim Speichern; diese Migration zieht
-- die vorhandenen Klartext-Werte einmalig nach. Unbekannte/leere Werte bleiben
-- unangetastet (kein Datenverlust, kein erfundener Ersatzwert).
--
-- Umfang = 27 EU + CH/GB, identisch zu core/countries.py / lib/countries.ts.

update public.properties
set country = case lower(btrim(country))
    when 'belgien' then 'BE' when 'belgium' then 'BE'
    when 'bulgarien' then 'BG' when 'bulgaria' then 'BG'
    when 'dänemark' then 'DK' when 'denmark' then 'DK'
    when 'deutschland' then 'DE' when 'germany' then 'DE'
    when 'estland' then 'EE' when 'estonia' then 'EE'
    when 'finnland' then 'FI' when 'finland' then 'FI'
    when 'frankreich' then 'FR' when 'france' then 'FR'
    when 'griechenland' then 'GR' when 'greece' then 'GR'
    when 'irland' then 'IE' when 'ireland' then 'IE'
    when 'italien' then 'IT' when 'italy' then 'IT'
    when 'kroatien' then 'HR' when 'croatia' then 'HR'
    when 'lettland' then 'LV' when 'latvia' then 'LV'
    when 'litauen' then 'LT' when 'lithuania' then 'LT'
    when 'luxemburg' then 'LU' when 'luxembourg' then 'LU'
    when 'malta' then 'MT'
    when 'niederlande' then 'NL' when 'netherlands' then 'NL'
        when 'the netherlands' then 'NL'
    when 'österreich' then 'AT' when 'austria' then 'AT'
    when 'polen' then 'PL' when 'poland' then 'PL'
    when 'portugal' then 'PT'
    when 'rumänien' then 'RO' when 'romania' then 'RO'
    when 'schweden' then 'SE' when 'sweden' then 'SE'
    when 'slowakei' then 'SK' when 'slovakia' then 'SK'
    when 'slowenien' then 'SI' when 'slovenia' then 'SI'
    when 'spanien' then 'ES' when 'spain' then 'ES'
    when 'tschechien' then 'CZ' when 'czechia' then 'CZ'
        when 'czech republic' then 'CZ'
    when 'ungarn' then 'HU' when 'hungary' then 'HU'
    when 'zypern' then 'CY' when 'cyprus' then 'CY'
    when 'schweiz' then 'CH' when 'switzerland' then 'CH'
    when 'vereinigtes königreich' then 'GB' when 'united kingdom' then 'GB'
        when 'great britain' then 'GB' when 'uk' then 'GB'
    else country
  end
where country is not null
  and char_length(country) > 2;
