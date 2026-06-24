-- 0057_dynamic_pricing_base_mode.sql — Dynamic Pricing: Basispreis-Modus (Hostaway-Modell)
--
-- Additiv auf 0055/0056. Bildet das Hostaway-Bedienmodell ab: pro Objekt wählt
-- der Vermieter, WIE der Basispreis (Anker, um den alle Faktoren rechnen) zustande
-- kommt:
--   base_mode = 'data_driven' → der Basispreis kommt aus dem rate_plan/Grundpreis,
--               die Engine passt mit Faktoren an. Die Aggressivität
--               (base_rate_mode) dämpft/verstärkt die abweichungsbasierten Faktoren
--               (Auslastung + Markt):
--                 conservative → sanfter, recommended → normal, aggressive → stärker.
--   base_mode = 'manual'      → der Vermieter setzt den Basispreis selbst
--               (manual_base_price); Faktoren rechnen darauf. „Volle Kontrolle".
--
-- enabled (Aktiv-Toggle), min_price, max_price bestehen bereits (0055) und bleiben
-- die Leitplanken. Rein additiv, keine bestehenden Daten betroffen; Defaults
-- bilden das bisherige Verhalten ab (data_driven + recommended = neutral wie zuvor).

alter table public.dp_settings
    -- Wie kommt der Basispreis zustande: datengetrieben (rate_plan) oder manuell.
    add column if not exists base_mode text not null default 'data_driven'
        check (base_mode in ('data_driven', 'manual')),
    -- Aggressivität der datengetriebenen Anpassung.
    add column if not exists base_rate_mode text not null default 'recommended'
        check (base_rate_mode in ('conservative', 'recommended', 'aggressive')),
    -- Fester Basispreis bei base_mode='manual' (sonst NULL → rate_plan-Basis gilt).
    add column if not exists manual_base_price numeric(12, 2)
        check (manual_base_price is null or manual_base_price >= 0);
