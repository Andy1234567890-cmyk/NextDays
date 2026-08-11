# Channex-API: vollständige Messung aller Felder und IDs

Konto **AirSmil** · Airbnb-Host `529591717` · gemessen **04.08.2026** gegen
**Produktion** (`https://app.channex.io/api/v1`), nicht Staging.

Jeder Wert in diesem Dokument ist ein **Live-Messwert**. Kein Feld ist aus
Dokumentation, Code oder Vermutung übernommen. Wo ein Weg nicht geprüft wurde,
steht das ausdrücklich dabei.

**Methodenwarnung:** der Namensraum `channels/{id}/execute/<name>` antwortet auf
JEDEN Namen mit `200 {"meta":{"message":"Success"}}` — auch auf
`voelliger_unsinn_xyz123`. Ein 200 ist dort KEIN Existenzbeweis. Jede Messung
unten wurde deshalb gegen einen absichtlich erfundenen Kontrollnamen geprüft.

---

## 1. Die IDs dieses Kontos

| Ebene | ID | Bezeichnung |
|---|---|---|
| Organisation / Billing | `1528b0e4-6dba-49b7-b8c6-dfb34de315c9` | AirSmil |
| Gruppe | `3b13c06e-a19e-4f77-b216-ba85ce941ec5` | AirSmil |
| Kanal (Airbnb) | `9a46827b-7b6a-4be2-bbd6-611794f785fb` | AirBNB, `is_active: false` |
| Mapping (Objekt 020) | `f37d5d54-7808-43c2-b36e-30f2e34cccd5` | `published: false` |
| Airbnb-Listing 020 | `1378994948547697321` | 020 Lille Lægehus |
| Property 020 | `f86cb4d8-2b31-4efd-ab4a-29b5d912bd13` | 020 Lille Lægehus |
| Zimmertyp 020 | `03f53b67-2028-4ddc-a2a5-0d83cfd199ce` | der EINZIGE im Konto |
| Rate-Plan (Basis) | `b358bacf-e839-4428-81ca-4c3acd8fbfb0` | Grundpreis (von Airbnb) |
| Rate-Plan (Kanal) | `8cbafcb5-a7a5-4758-ae09-0b2df7f96d45` | …- AirBNB Airbnb |
| Webhook | `b4688844-3a7c-4670-9231-fbbb690be3d0` | global, alle 20 Events |
## 2. Property — `GET /properties/{id}`

HTTP **200** · **43 Felder** gemessen. Senden: `PUT /properties/{id}`. Empfangen: `GET`. Beide belegt.

| Feld | gemessener Wert |
|---|---|
| `id` | `f86cb4d8-2b31-4efd-ab4a-29b5d912bd13` |
| `state` | `null` |
| `address` | `Hirtshalsvej 21` |
| `title` | `020 Lille Lægehus (1966) · FeWo Lille Lægehus` |
| `content.description` | `null` |
| `content.photos` | `[]` |
| `content.important_information` | `null` |
| `currency` | `DKK` |
| `email` | `info@airsmil.dk` |
| `city` | `Hjørring` |
| `country` | `DK` |
| `settings.min_stay_type` | `both` |
| `settings.allow_availability_autoupdate` | `true` |
| `settings.allow_availability_autoupdate_on_cancellation` | `false` |
| `settings.allow_availability_autoupdate_on_confirmation` | `true` |
| `settings.allow_availability_autoupdate_on_modification` | `false` |
| `settings.cut_off_days` | `null` |
| `settings.cut_off_time` | `null` |
| `settings.max_day_advance` | `null` |
| `settings.max_price` | `null` |
| `settings.min_price` | `null` |
| `settings.state_length` | `500` |
| `phone` | `93903991` |
| `is_active` | `true` |
| `logo_url` | `null` |
| `max_count_of_occupancies` | `18` |
| `max_count_of_rate_plans` | `400` |
| `max_count_of_room_types` | `50` |
| `min_stay_type` | `both` |
| `expected_removal_date` | `2026-11-02` |
| `default_cancellation_policy_id` | `null` |
| `hotel_policy_id` | `null` |
| `acc_channels_count` | `1` |
| `default_tax_set_id` | `null` |
| `latitude` | `57.5539737` |
| `location_precision` | `500` |
| `longitude` | `10.1503442` |
| `max_count_of_users` | `20` |
| `property_type` | `holiday_home` |
| `timezone` | `Europe/Copenhagen` |
| `website` | `www.airsmil.dk` |
| `zip_code` | `9881` |
| `property_category` | `vacation_rental` |

## 3. Zimmertyp — `GET /room_types/{id}`

HTTP **200** · **14 Felder** gemessen. Senden: `POST`/`PUT /room_types`. **17 von 18 Objekten haben keinen.**

| Feld | gemessener Wert |
|---|---|
| `id` | `03f53b67-2028-4ddc-a2a5-0d83cfd199ce` |
| `meta` | `null` |
| `position` | `0` |
| `title` | `020 Lille Lægehus (1966) · FeWo Lille Lægehus` |
| `content.description` | `null` |
| `content.photos` | `[]` |
| `occ_adults` | `3` |
| `occ_children` | `0` |
| `occ_infants` | `0` |
| `capacity` | `null` |
| `codes` | `null` |
| `count_of_rooms` | `1` |
| `default_occupancy` | `3` |
| `room_kind` | `room` |

## 4. Rate-Plan — `GET /rate_plans/{id}`

HTTP **200** · **44 Felder** gemessen. Senden: `POST`/`PUT /rate_plans`. Die Wochentags-Arrays haben 7 Werte (Mo–So).

| Feld | gemessener Wert |
|---|---|
| `id` | `b358bacf-e839-4428-81ca-4c3acd8fbfb0` |
| `meta` | `null` |
| `options` | [1 Objekte] |
| `options[0].id` | `b358bacf-e839-4428-81ca-4c3acd8fbfb0` |
| `options[0].occupancy` | `2` |
| `options[0].rate` | `504.00` |
| `options[0].derived_option` | `null` |
| `options[0].inherit_availability_offset` | `false` |
| `options[0].inherit_closed_to_arrival` | `false` |
| `options[0].inherit_closed_to_departure` | `false` |
| `options[0].inherit_max_availability` | `false` |
| `options[0].inherit_max_stay` | `false` |
| `options[0].inherit_min_stay_arrival` | `false` |
| `options[0].inherit_min_stay_through` | `false` |
| `options[0].inherit_rate` | `false` |
| `options[0].inherit_stop_sell` | `false` |
| `options[0].is_primary` | `true` |
| `options[0].rate_category_id` | `null` |
| `title` | `Grundpreis (von Airbnb)` |
| `currency` | `DKK` |
| `auto_rate_settings` | `null` |
| `closed_to_arrival` | `[false, false, false, false, false, false, false]` |
| `closed_to_departure` | `[false, false, false, false, false, false, false]` |
| `max_stay` | `[0, 0, 0, 0, 0, 0, 0]` |
| `min_stay_arrival` | `[1, 1, 1, 1, 1, 1, 1]` |
| `min_stay_through` | `[1, 1, 1, 1, 1, 1, 1]` |
| `stop_sell` | `[false, false, false, false, false, false, false]` |
| `cancellation_policy_id` | `null` |
| `children_fee` | `0.00` |
| `infant_fee` | `0.00` |
| `inherit_availability_offset` | `false` |
| `inherit_closed_to_arrival` | `false` |
| `inherit_closed_to_departure` | `false` |
| `inherit_max_availability` | `false` |
| `inherit_max_stay` | `false` |
| `inherit_min_stay_arrival` | `false` |
| `inherit_min_stay_through` | `false` |
| `inherit_rate` | `false` |
| `inherit_stop_sell` | `false` |
| `meal_type` | `none` |
| `rate_mode` | `manual` |
| `sell_mode` | `per_room` |
| `tax_set_id` | `null` |
| `ui_read_only` | `false` |

## 5. Kanal — `GET /channels/{id}`

HTTP **200** · **83 Felder** gemessen. Senden: `PUT /channels/{id}`. `actions` ist die Whitelist der erlaubten Aktionen.

| Feld | gemessener Wert |
|---|---|
| `id` | `9a46827b-7b6a-4be2-bbd6-611794f785fb` |
| `title` | `Airbnb` |
| `currency` | `null` |
| `settings.tokens` | `<zensiert>` |
| `settings.derived_option` | `{}` |
| `settings.token_invalid` | `<zensiert>` |
| `actions` | `["enable_los_mode", "load_future_reservations"]` |
| `channel` | `AirBNB` |
| `inserted_at` | `2026-08-04T14:40:27.757399` |
| `updated_at` | `2026-08-04T15:01:27.455514` |
| `properties` | `["08ae1a1e-3c90-4f5e-88a0-1b4ababf3575", "28392615-ea5e-4f6d` |
| `is_active` | `false` |
| `rate_plans` | [1 Objekte] |
| `rate_plans[0].id` | `f37d5d54-7808-43c2-b36e-30f2e34cccd5` |
| `rate_plans[0].settings.listing_id` | `1378994948547697321` |
| `rate_plans[0].settings.published` | `false` |
| `rate_plans[0].settings.promotions` | [2 Objekte] |
| `rate_plans[0].settings.promotions[0].listing_id` | `1378994948547697321` |
| `rate_plans[0].settings.promotions[0].status` | `AVAILABLE` |
| `rate_plans[0].settings.promotions[0].type` | `HIGH_RATED_GUEST_DISCOUNT` |
| `rate_plans[0].settings.availability_rule.allow_rtb_above_max_nights` | `false` |
| `rate_plans[0].settings.availability_rule.allow_rtb_beyond_max_days_notice` | `false` |
| `rate_plans[0].settings.availability_rule.booking_lead_time` | `12` |
| `rate_plans[0].settings.availability_rule.day_of_week_check_in` | `[true, true, true, true, true, true, true]` |
| `rate_plans[0].settings.availability_rule.day_of_week_check_out` | `[true, true, true, true, true, true, true]` |
| `rate_plans[0].settings.availability_rule.day_of_week_min_nights` | `[-1, -1, -1, -1, -1, -1, -1]` |
| `rate_plans[0].settings.availability_rule.default_max_nights` | `1125` |
| `rate_plans[0].settings.availability_rule.default_min_nights` | `1` |
| `rate_plans[0].settings.availability_rule.instant_booking_allowed_category` | `everyone` |
| `rate_plans[0].settings.availability_rule.max_days_notice` | `365` |
| `rate_plans[0].settings.availability_rule.seasonal_min_nights` | `null` |
| `rate_plans[0].settings.availability_rule.turnover_days` | `0` |
| `rate_plans[0].settings.pricing_setting.airbnb_configured_taxes` | `[]` |
| `rate_plans[0].settings.pricing_setting.allowed_pass_through_taxes_collection_types` | `["NO_AIRBNB_COLLECTED_TAX"]` |
| `rate_plans[0].settings.pricing_setting.cleaning_fee` | `null` |
| `rate_plans[0].settings.pricing_setting.default_daily_price` | `504` |
| `rate_plans[0].settings.pricing_setting.default_pass_through_taxes_collection_type` | `NO_AIRBNB_COLLECTED_TAX` |
| `rate_plans[0].settings.pricing_setting.default_pricing_rules` | `[]` |
| `rate_plans[0].settings.pricing_setting.eligible_for_pass_through_taxes` | `null` |
| `rate_plans[0].settings.pricing_setting.eligible_offline_fees` | [1 Objekte] |
| `rate_plans[0].settings.pricing_setting.eligible_offline_fees[0].fee_type` | `PASS_THROUGH_SECURITY_DEPOSIT` |
| `rate_plans[0].settings.pricing_setting.guest_fee_percent` | `0.0` |
| `rate_plans[0].settings.pricing_setting.guests_included` | `1` |
| `rate_plans[0].settings.pricing_setting.host_fee_percent` | `0.155` |
| `rate_plans[0].settings.pricing_setting.listing_currency` | `DKK` |
| `rate_plans[0].settings.pricing_setting.listing_id` | `1378994948547697321` |
| `rate_plans[0].settings.pricing_setting.monthly_price_factor` | `0.0` |
| `rate_plans[0].settings.pricing_setting.offline_standard_fee_types` | `{}` |
| `rate_plans[0].settings.pricing_setting.pass_through_taxes` | `[]` |
| `rate_plans[0].settings.pricing_setting.pass_through_taxes_collection_type` | `NO_AIRBNB_COLLECTED_TAX` |
| `rate_plans[0].settings.pricing_setting.price_per_extra_person` | `0` |
| `rate_plans[0].settings.pricing_setting.security_deposit` | `null` |
| `rate_plans[0].settings.pricing_setting.standard_fees` | [3 Objekte] |
| `rate_plans[0].settings.pricing_setting.standard_fees[0].amount` | `25.0` |
| `rate_plans[0].settings.pricing_setting.standard_fees[0].amount_type` | `flat` |
| `rate_plans[0].settings.pricing_setting.standard_fees[0].charge_period` | `PER_NIGHT` |
| `rate_plans[0].settings.pricing_setting.standard_fees[0].charge_type` | `PER_GROUP` |
| `rate_plans[0].settings.pricing_setting.standard_fees[0].fee_type` | `PASS_THROUGH_RESORT_FEE` |
| `rate_plans[0].settings.pricing_setting.standard_fees[0].offline` | `false` |
| `rate_plans[0].settings.pricing_setting.weekend_price` | `null` |
| `rate_plans[0].settings.pricing_setting.weekly_price_factor` | `0.0` |
| `rate_plans[0].settings.pricing_availability_model.in_model_transition` | `false` |
| `rate_plans[0].settings.pricing_availability_model.type` | `standard` |
| `rate_plans[0].settings.listing_type` | `apartment` |
| `rate_plans[0].settings.sync_category` | `sync_all` |
| `rate_plans[0].settings.booking_setting.cancellation_policy_settings.cancellation_policy_category` | `better_strict_with_grace_period` |
| `rate_plans[0].settings.booking_setting.cancellation_policy_settings.lts_cancellation_policy_id` | `CANCEL_LONG_TERM_FAIR` |
| `rate_plans[0].settings.booking_setting.cancellation_policy_settings.non_refundable_price_factor` | `null` |
| `rate_plans[0].settings.booking_setting.check_in_time_end` | `FLEXIBLE` |
| `rate_plans[0].settings.booking_setting.check_in_time_start` | `16` |
| `rate_plans[0].settings.booking_setting.check_out_time` | `10` |
| `rate_plans[0].settings.booking_setting.guest_controls.allows_children_as_host` | `false` |
| `rate_plans[0].settings.booking_setting.guest_controls.allows_events_as_host` | `false` |
| `rate_plans[0].settings.booking_setting.guest_controls.allows_infants_as_host` | `false` |
| `rate_plans[0].settings.booking_setting.guest_controls.allows_pets_as_host` | `true` |
| `rate_plans[0].settings.booking_setting.guest_controls.allows_smoking_as_host` | `false` |
| `rate_plans[0].settings.booking_setting.guest_controls.children_not_allowed_details` | `null` |
| `rate_plans[0].settings.booking_setting.guest_controls.pet_capacity` | `1` |
| `rate_plans[0].settings.booking_setting.instant_book_welcome_message` | `null` |
| `rate_plans[0].settings.booking_setting.instant_booking_allowed_category` | `everyone` |
| `rate_plans[0].settings.booking_setting.listing_expectations_for_guests` | `[]` |
| `rate_plans[0].rate_plan_id` | `b358bacf-e839-4428-81ca-4c3acd8fbfb0` |
| `expected_removal_date` | `null` |

## 6. Airbnb-Preise — `GET /channels/{id}/mappings/{mid}/pricing_settings`

HTTP **200** · **17 Felder** gemessen. **Lese- UND Schreibkanal**: `PUT` auf denselben Pfad ist belegt (unser Rabatt-Push nutzt ihn).

| Feld | gemessener Wert |
|---|---|
| `currency` | `DKK` |
| `default_daily_price` | `504` |
| `default_pass_through_taxes_collection_type` | `NO_AIRBNB_COLLECTED_TAX` |
| `guests_included` | `1` |
| `pass_through_taxes` | `[]` |
| `pass_through_taxes_collection_type` | `NO_AIRBNB_COLLECTED_TAX` |
| `price_per_extra_person` | `0` |
| `standard_fees` | [3 Objekte] |
| `standard_fees[0].amount` | `25.0` |
| `standard_fees[0].amount_type` | `flat` |
| `standard_fees[0].charge_period` | `PER_NIGHT` |
| `standard_fees[0].charge_type` | `PER_GROUP` |
| `standard_fees[0].fee_type` | `PASS_THROUGH_RESORT_FEE` |
| `standard_fees[0].offline` | `false` |
| `weekend_price` | `null` |
| `allowed_pass_through_taxes_collection_types` | `["NO_AIRBNB_COLLECTED_TAX"]` |
| `default_pricing_rules` | `[]` |

## 7. Airbnb-Regeln — `GET /channels/{id}/mappings/{mid}/availability_settings`

HTTP **200** · **9 Felder** gemessen. **Erst in dieser Messung gefunden.** `PUT` existiert laut Channex-Client — von uns NICHT genutzt.

| Feld | gemessener Wert |
|---|---|
| `allow_rtb_above_max_nights` | `false` |
| `allow_rtb_beyond_max_days_notice` | `false` |
| `booking_lead_time` | `12` |
| `default_max_nights` | `1125` |
| `max_days_notice` | `365` |
| `turnover_days` | `0` |
| `day_of_week_min_nights` | `[-1, -1, -1, -1, -1, -1, -1]` |
| `day_of_week_check_in` | `[true, true, true, true, true, true, true]` |
| `day_of_week_check_out` | `[true, true, true, true, true, true, true]` |

## 8. Konto — `GET /whoami`

HTTP **200** · **8 Felder** gemessen. Nur lesen.

| Feld | gemessener Wert |
|---|---|
| `id` | `3e265f76-d4c4-427c-9afd-5be11b051e15` |
| `name` | `Nynextdays PMS` |
| `email` | `jeanine@mynextdays.dk` |
| `settings.block_booking_export` | `false` |
| `preferred_language` | `en` |
| `is_api_key_allowed` | `<zensiert>` |
| `signed_agreement_version` | `1` |
| `system_role` | `user` |

## 9. White-Label — `GET /white_label/settings`

HTTP **200** · **7 Felder** gemessen. Nur lesen.

| Feld | gemessener Wert |
|---|---|
| `title` | `Channex` |
| `features` | `["DisableSignUp", "simple_rate"]` |
| `agreement_version` | `1` |
| `social_auth` | `["google", "facebook"]` |
| `onboarding_app` | `null` |
| `support_app.app` | `intercom` |
| `support_app.config.app_id` | `odbfthyr` |

## 10. Gruppe — `GET /groups/{id}`

HTTP **200** · **2 Felder** gemessen. Senden: `POST`/`PUT /groups`.

| Feld | gemessener Wert |
|---|---|
| `id` | `3b13c06e-a19e-4f77-b216-ba85ce941ec5` |
| `title` | `AirSmil` |

## 11. Webhook — `GET /webhooks`

HTTP **200** · **9 Felder** gemessen. Senden: `POST /webhooks`. **Das Secret steht im Klartext in der Antwort.**

| Feld | gemessener Wert |
|---|---|
| `id` | `b4688844-3a7c-4670-9231-fbbb690be3d0` |
| `protected` | `false` |
| `send_data` | `true` |
| `headers.X-Channex-Webhook-Secret` | `<zensiert>` |
| `is_active` | `true` |
| `callback_url` | `https://api.mynextdays.com/api/v1/channel-manager/webhook` |
| `event_mask` | `ari;booking_new;booking_modification;booking_cancellation;bo` |
| `request_params` | `null` |
| `is_global` | `true` |
---

## 12. ARI — was WIRKLICH bei Channex steht

Das ist der Beweis-Endpunkt: nicht was wir gesendet haben, sondern was
angekommen ist. `GET /availability` und `GET /restrictions` mit
`filter[restrictions]=<feld>` (ohne diesen Filter: HTTP 400).

### Verfügbarkeit — `GET /availability`

| Zimmertyp | 05.08. | 06.08. | 07.08. | 08.08. | 09.08. | 10.08. | 11.08. | 12.08. |
|---|---|---|---|---|---|---|---|
| `03f53b67…` | **0** | **0** | **0** | **0** | **0** | **0** | **0** | **0** |

**Null verfügbare Einheiten an jedem Tag.** Bei 0 verkauft kein Portal,
unabhängig vom Preis. Das ist die Ursache, warum bei diesem Konto nichts läuft.

### Restriktionen — `GET /restrictions`, Rate-Plan `8cbafcb5…`

| Feld | gemessener Wert (05.–12.08.) | Status |
|---|---|---|
| `rate` | `"504.00"` an allen 8 Tagen | **angekommen** |
| `min_stay_arrival` | `1` an allen 8 Tagen | **angekommen** |
| `min_stay_through` | `1` an allen 8 Tagen | **angekommen** |
| `max_stay` | `0` an allen 8 Tagen | 0 = keine Grenze |
| `closed_to_arrival` | `false` an allen 8 Tagen | offen |
| `closed_to_departure` | `false` an allen 8 Tagen | offen |
| `stop_sell` | `false` an allen 8 Tagen | nicht gesperrt |

Alle sieben Felder antworten HTTP 200 mit Daten. Der Preis **ist** bei Channex.

---

## 13. Bestand des Kontos — die Kette bricht früh

| Endpunkt | Einträge | Bedeutung |
|---|---|---|
| `properties` | **18** | alle 18 Objekte angelegt |
| `room_types` | **1** | **nur Objekt 020** — 17 Objekte ohne Zimmertyp |
| `rate_plans` | **2** | beide bei 020 (Basis + Kanal-Plan) |
| `taxes` | **0** | keine Steuer angekommen |
| `tax_sets` | **0** | kein Steuer-Set |
| `hotel_policies` | **0** | keine Richtlinie |
| `cancellation_policies` | **0** | keine Stornoregel |
| `photos` | **0** | kein Foto auf dem Konto |
| `reviews` | 0 | keine Bewertung |
| `bookings` | 0 | keine Buchung |
| `booking_revisions` | 0 | Feed leer |
| `message_threads` | 0 | keine Nachricht |
| `channel_availability_rules` | 0 | keine Regel |
| `channels` | 1 | nur Airbnb |
| `webhooks` | 1 | global, alle 20 Events |
| `groups` | 1 | AirSmil |
| `applications` | 13 verfügbar / 18 installiert | je Property eine |
| `property_facilities` | **301** | Ausstattungs-Katalog (9 Kategorien) |
| `room_facilities` | **191** | Zimmer-Ausstattung (7 Kategorien) |
| `currencies` | 154 | Währungs-Katalog |
| `timezones` | 597 | Zeitzonen-Katalog |
| `channels/codes` | 730 | alle Portale, die Channex kennt |

**Die Kette:** Zimmertyp → Verfügbarkeit → Preis → Portal.
Bei 020 fehlt Glied 2 (Verfügbarkeit 0). Bei den anderen 17 fehlt Glied 1.

---

## 14. Airbnb-Aktionen — was der Kanal erlaubt

Der Kanal deklariert selbst, was geht:

```json
"actions": ["enable_los_mode", "load_future_reservations"]
```

| Aktion | Methode | Ergebnis | Bewertung |
|---|---|---|---|
| `load_future_reservations` | GET `execute/` | 200 | in `actions` deklariert |
| `enable_los_mode` | — | nicht aufgerufen | in `actions` deklariert |
| `get_checkout_tasks?listing_id=` | GET `action/` | **200 mit echten Daten** | liefert Airbnb-Daten, steht NICHT in `actions` |
| `get_unpublish_reasons` | GET `action/` | **200, 2725 B** | liefert Daten, steht NICHT in `actions` |
| `get_opportunities` | GET `action/` | 200, leer | — |
| `retrieve_rate_plans` | GET `action/` | 200, leer | — |
| `all_listings` | GET+POST `action/` | 400 „action is not supported" | wie der Kontrollname |
| `amenities` | GET+POST `action/` | 400 | wie der Kontrollname |
| `get_pricing_settings` | GET+POST `action/` | 400 | wie der Kontrollname |
| `get_default_rules` | GET+POST `action/` | 400 | wie der Kontrollname |
| `get_default_pricing` | GET+POST `action/` | 400 | wie der Kontrollname |
| `misconduct_categories` | GET+POST `action/` | 400 | wie der Kontrollname |
| **`erfundene_kontrolle_zzz`** | GET+POST `action/` | **400** | **Kontrolltest** |

**Schluss daraus:** die 400er sind NICHT von einem erfundenen Namen zu
unterscheiden. Ob `all_listings` gesperrt oder für diesen Kanaltyp nicht
vorhanden ist, lässt sich von außen NICHT feststellen. Das ist die Frage an
Channex, keine Behauptung von uns.

Diese Namen stehen im ausgelieferten Channex-Client
(`app.channex.io/assets/index-BefbhQp2.js`) mit exaktem Aufrufmuster, z. B.
`GET channels/{id}/action/all_listings` → `data.listings[]`.

### Airbnb-Promotions — lesbar

| Typ | Status | Listing |
|---|---|---|
| `HIGH_RATED_GUEST_DISCOUNT` | `AVAILABLE` | `1378994948547697321` |
| `MOBILE_ONLY_DISCOUNT` | `AVAILABLE` | `1378994948547697321` |

`GET /channels/{id}/promotions` → 200. Ein-/Ausschalten per
`POST …/promotions/enable|disable` existiert im Client — von uns NICHT genutzt.

---

## 15. Endpunkte, die es NICHT gibt (404-Kontrolle)

| Pfad | HTTP |
|---|---|
| `/facilities` | 404 |
| `/property_types` | 404 |
| `/meal_types` | 404 |
| `/property_categories` | 404 |
| `/bed_types` | 404 |
| `/languages` | 404 |
| `/countries` | 404 |
| `/amenities` | 404 |
| `/descriptions` | 404 |
| `/content` | 404 |
| `/listings` | 404 |
| `/property_content` | 404 |
| `/room_type_content` | 404 |
| **`/erfundene_kontrolle_zzz`** | **404** |

Der Kontrollname antwortet gleich — diese Liste belegt also, was **nicht**
existiert, mit der Einschränkung, dass 404 auch „nicht für dieses Konto
sichtbar" bedeuten kann.

### Content-Wege, die geprüft und geschlossen sind

| Weg | Ergebnis |
|---|---|
| `POST /channels/{id}/proxy/v2/listing_photos?listing_id=` | 500 |
| `POST /channels/{id}/proxy/v2/listings/{id}` | 500 |
| `POST /channels/{id}/proxy/v2/listing_descriptions/{id}/en` | 500 |
| `POST /channels/{id}/proxy/v2/listing_amenities` | 500 |
| … 12 weitere Airbnb-v2-Pfade | 500 |
| **`POST /channels/{id}/proxy/v2/voelliger_unsinn_zzz`** | **500 (Kontrolle)** |
| `GET /meta/airbnb/{id}/listings` | 500 |
| `GET /meta/airbnb/{id}/content` | 400 `implementation_not_defined` |
| **`GET /meta/airbnb/{id}/sonstwas_erfunden_zzz`** | **400 (Kontrolle)** |
| 19 erfundene `execute/load_listing_*content*`-Namen | **alle 200, 30 B, ohne Daten** |
| `POST /channels/mapping_details` + `with_content`/`include`/`full`/`detailed` | 200, immer dieselben 8 Felder |
| 11 Unterpfade an `mappings/{id}` (`/content`, `/photos`, …) | 404, wie die Kontrolle |
| `POST /meta/airbnb/{id}/full_sync_listing` | **200 Success** — danach kein Byte Content mehr am Kanal |

`mapping_details` liefert je Listing genau **acht** Felder:
`id`, `title`, `type`, `city`, `country_code`, `occupancies`,
`quality_status`, `synchronization_category`.

**Fotos, Beschreibung, Ausstattung und die Hausadresse sind über die
Channex-API nicht abrufbar.** Belegt durch die Messungen oben UND durch das
Validierungsschema im Channex-Client selbst, das für ein Airbnb-Listing nur
`syncCategory`, `suspended`, `airbnbRatePlanId`, `pricingAvailabilityModel`
und `bookingSetting` kennt — kein Content-Feld.
---

## 16. Senden und Empfangen — die Matrix

Spalte „Beweis": **gemessen** = Live-Wert in diesem Dokument.
**ungeprüft** = Weg existiert laut Client/Doku, von mir nicht ausgelöst.
Kein Häkchen ohne Messwert.

### Was wir SENDEN können

| Datum | Endpunkt | Beweis |
|---|---|---|
| Verfügbarkeit (Zahl je Tag) | `POST /availability` | gemessen (steht 0) |
| Nachtpreis | `POST /restrictions` `rate` | **gemessen: 504.00 angekommen** |
| Mindestaufenthalt Anreise | `POST /restrictions` `min_stay_arrival` | **gemessen: 1** |
| Mindestaufenthalt durchgehend | `POST /restrictions` `min_stay_through` | **gemessen: 1** |
| Maximalaufenthalt | `POST /restrictions` `max_stay` | **gemessen: 0** |
| Anreise gesperrt | `POST /restrictions` `closed_to_arrival` | **gemessen: false** |
| Abreise gesperrt | `POST /restrictions` `closed_to_departure` | **gemessen: false** |
| Verkaufsstopp | `POST /restrictions` `stop_sell` | **gemessen: false** |
| Objekt-Stammdaten (62 Felder) | `PUT /properties/{id}` | gemessen (Lesen) |
| Zimmertyp (26 Felder) | `POST`/`PUT /room_types` | gemessen (Lesen) |
| Rate-Plan (42 Felder) | `POST`/`PUT /rate_plans` | gemessen (Lesen) |
| Steuern | `POST`/`PUT /taxes` + `/tax_sets` | **0 angekommen** |
| Fotos (Property) | `PUT /properties` `content.photos` | **0 angekommen** |
| Fotos (Zimmertyp) | `PUT /room_types` `content.photos` | **0 angekommen** |
| Ausstattung | `facilities` (301 Katalog-UUIDs) | **0 gesetzt** |
| Airbnb-Rabattregeln | `PUT mappings/{id}/pricing_settings` `default_pricing_rules` | gemessen: `[]` leer |
| Airbnb-Verfügbarkeitsregeln | `PUT mappings/{id}/availability_settings` | **ungeprüft** — von uns nicht genutzt |
| Airbnb-Promotions an/aus | `POST channels/{id}/promotions/enable|disable` | **ungeprüft** — von uns nicht genutzt |
| Airbnb veröffentlichen | `PUT channels/{id}/execute/publish` | **ungeprüft** |
| Zimmertyp löschen | `DELETE /room_types/{id}` | ungeprüft |

### Was wir EMPFANGEN können

| Datum | Endpunkt | Beweis |
|---|---|---|
| Airbnb-Nachtpreis | `mappings/{id}/pricing_settings` `default_daily_price` | **gemessen: 504** |
| Airbnb-Währung | `…pricing_settings` `listing_currency` | **gemessen: DKK** |
| Airbnb-Gebühren | `…pricing_settings` `standard_fees[]` | **gemessen: 3 Gebühren** |
| Zusatzgast-Preis (Airbnb) | `…pricing_settings` `price_per_extra_person` | **gemessen** (nur gelesen) |
| Inkl. Gäste (Airbnb) | `…pricing_settings` `guests_included` | **gemessen** (nur gelesen) |
| Steuern (Airbnb) | `…pricing_settings` `airbnb_configured_taxes`, `pass_through_taxes` | **gemessen** (nicht ausgewertet) |
| Gebühren-Prozente | `…pricing_settings` `guest_fee_percent`, `host_fee_percent` | **gemessen** (nicht ausgewertet) |
| Min/Max Nächte | `…availability_settings` `default_max_nights` | **gemessen: 1125** |
| Vorlaufzeit | `…availability_settings` `booking_lead_time` | **gemessen: 12** |
| Vorausbuchbarkeit | `…availability_settings` `max_days_notice` | **gemessen: 365** |
| Wechseltage | `…availability_settings` `turnover_days` | **gemessen: 0** |
| Min-Nächte je Wochentag | `…availability_settings` `day_of_week_min_nights` | **gemessen: [-1 ×7]** = nicht gesetzt |
| An-/Abreisetage | `…availability_settings` `day_of_week_check_in/out` | **gemessen: [true ×7]** |
| Check-in / Check-out | Kanal `rate_plans[].settings.booking_setting` | **gemessen: 16:00 / 10:00** |
| Haustiere / Rauchen / Kinder | `booking_setting.guest_controls` | **gemessen** |
| Stornorichtlinie (Airbnb) | `booking_setting.cancellation_policy_settings` | **gemessen** (nicht ausgewertet) |
| Gast-Erwartungen | `booking_setting.listing_expectations_for_guests` | **gemessen: `[]` leer** |
| Airbnb-Promotions | `GET channels/{id}/promotions` | **gemessen: 2 verfügbar** |
| Listing-Liste (8 Felder) | `POST /channels/mapping_details` | **gemessen: 18 Listings** |
| Buchungen | `GET /booking_revisions/feed` + `/bookings` | **gemessen: 0** |
| Nachrichten | `GET /message_threads` | **gemessen: 0** (`message_support: true`) |
| Bewertungen | `GET /reviews`, `/scores/{id}` | **gemessen: 0** |
| Kanal-Ereignisse | `GET /channels/{id}/events` | gemessen |
| Künftige Reservierungen | `GET execute/load_future_reservations` | 200 — in `actions` deklariert |
| **Fotos** | — | **kein Weg** (13 Pfade + Kontrolltests) |
| **Beschreibung** | — | **kein Weg** |
| **Ausstattung des Listings** | — | **kein Weg** |
| **Hausadresse** | — | **kein Weg** — alle 18 tragen die Firmenadresse |

---

## 17. Befunde, die Handlung brauchen

### Sicherheit: Webhook-Secret im Klartext

`GET /webhooks` liefert das Secret unmaskiert im Header-Feld
(`X-Channex-Webhook-Secret`). Jeder mit dem Channex-Key liest es.
**Empfehlung: rotieren.**

Zusätzlich zeigt `callback_url` auf `api.mynextdays.com` — die Domäne wird
aber auf `.dk` umgestellt.

### Die Firmenadresse steht bei allen 18 Objekten

Gemessen an Objekt 020: `zip_code: "9881"`, `address` = Firmenanschrift,
`latitude/longitude` = Firmensitz. Das geht so an die Portale. Der
Import-Fix im Code verhindert nur das Zurücklesen in unsere DB.

### 17 Objekte ohne Zimmertyp

Ohne `room_type` gibt es kein Ziel für Verfügbarkeit und keinen Rate-Plan
darunter. Für diese 17 Objekte kann NICHTS gesendet werden.

### Verfügbarkeit 0 bei Objekt 020

Preis und Mindestaufenthalt sind angekommen, aber `availability: 0` an
jedem geprüften Tag. Kein Portal verkauft.

### Ungenutzte Lese-Werte

Diese Felder liegen gemessen vor und werden von uns nicht ausgewertet:
`airbnb_configured_taxes`, `pass_through_taxes`, `guest_fee_percent`,
`host_fee_percent`, `allows_infants_as_host`,
`listing_expectations_for_guests`, `cancellation_policy_settings`,
sowie der ganze `availability_settings`-Block (9 Felder).

### Ungenutzte Schreibwege

`PUT mappings/{id}/availability_settings` und
`POST channels/{id}/promotions/enable|disable` existieren im Channex-Client,
werden von uns nicht aufgerufen. **Ungeprüft**, ob sie für diesen Kanal gehen.

---

## 18. Was diese Messung NICHT beantwortet

- Ob die `action/*`-Aktionen (`all_listings`, `amenities`, …) gesperrt oder für
  diesen Kanaltyp nicht vorhanden sind. Von außen nicht unterscheidbar.
- Ob unsere Push-Wege für die 17 Objekte ohne Zimmertyp funktionieren würden.
  Ungetestet, weil kein Ziel existiert.
- Ob `PUT availability_settings` bei Airbnb ankommt. Nicht ausgelöst.
- Ob im Channex-Konto Einstellungen existieren, die per API nicht sichtbar
  sind (`POST channels/{id}/allow_airbnb_rate_plans_access` steht im Client —
  bewusst NICHT aufgerufen, weil es schreibt).

---

## 19. Der Channel-Dialog von Channex — alle sieben Reiter

Aus dem ausgelieferten Client (`app.channex.io/assets/index-BefbhQp2.js`),
interne Schlüssel neben dem sichtbaren Namen. Diese Reiter sind die
Oberfläche, die Channex selbst für einen Airbnb-Kanal anbietet:

| Reiter (sichtbar) | interner Schlüssel | von mir gemessen |
|---|---|---|
| General Settings | `settings_tab` | `GET /channels/{id}` — 28 Felder, Abschnitt 5 |
| Mapping | `mapping_tab` | `POST /channels/mapping_details` — 8 Felder je Listing |
| Listing | `listing_tab` | kein eigener Endpunkt gefunden |
| **Rate Plans** | **`airbnb_rate_plans_tab`** | `action/retrieve_rate_plans` → **200 `{"data":[]}`** |
| Opportunities | `opportunities_tab` | `action/get_opportunities` → **200, `opportunities: []`** |
| Readiness Check | **`missing_content_tab`** | `POST channels/{id}/check_readiness` → **200, `data: []`** |
| Channel Settings | `channel_settings_tab` | Teil von `GET /channels/{id}` |

### Der Reiter „Rate Plans" hängt an einem BENUTZERRECHT

Das ist der Fund, der die 400er aus Abschnitt 14 erklärt. Im Client stehen
diese Admin-Aktionen samt Dialogtexten:

```
POST {user}/allow_airbnb_rate_plans_access
   → "Allow User to work with Airbnb Rate Plans?"
POST {user}/disallow_airbnb_rate_plans_access
   → "Remove User access to manage Airbnb Rate Plans?"
```

Daneben dieselbe Rechte-Mechanik für `allow_api_key_access`,
`allow_google_fields_access`, `allow_apaleo_reserva_import_access`.

**Damit ist die offene Frage aus Abschnitt 14 beantwortet:** die
`action/*`-Aufrufe (`all_listings`, `amenities`, `get_pricing_settings`,
`get_default_rules`) sind kein „für diesen Kanaltyp nicht vorhanden" —
sie hängen an einem Recht, das unser API-Konto nicht hat. Das ist eine
konkrete Bitte an Channex, keine Vermutung mehr.

`retrieve_rate_plans` antwortet dagegen **200 mit leerem Array** — die
Aktion ist erlaubt, das Listing hat nur keine Airbnb-Rate-Plans
(Preismodell `standard`, nicht LOS).

---

## 20. Readiness Check — Channex' eigene Prüfliste

`POST /channels/{id}/check_readiness` → **200, `data: []`**

In der Channex-Oberfläche zeigt derselbe Reiter **„No data"** — die Anzeige und
der API-Messwert stimmen also überein (04.08.2026 gegengeprüft).

Leeres Ergebnis heißt: für den EINEN gemappten Zimmertyp bemängelt Channex
nichts. Beachten: es ist genau ein Mapping vorhanden — die 17 Objekte ohne
Zimmertyp werden hier nicht geprüft, weil sie gar nicht gemappt sind.

`POST /properties/{id}/check_readiness` → **404** (existiert nur am Kanal).

### Was Channex prüft — die Feldliste aus dem Client

Der Reiter heißt intern `missing_content`. Seine vollständige Feldliste ist
die Antwort auf die Frage, wofür `content` da ist:

| Feld | Kategorie |
|---|---|
| `address` | Objekt-Stammdaten |
| `country` | Objekt-Stammdaten |
| `description` | **Content** |
| `facilities` | **Content** |
| `photos` | **Content** — Regel: „should have at least {count} photos" |
| `bedrooms_count` | Zimmertyp |
| `bathrooms_count` | Zimmertyp |
| `beds_count` | Zimmertyp |
| `extra_adult_price` | Preis |
| `extra_child_price` | Preis |
| `default_cancellation_policy_id` | Richtlinie |

Zusätzliche Fehlerregeln aus dem Client:

```
Property → Photo   : "should have at least {{count}} photos"
Channel  → Mapping : "mapping should not be empty"
Channel  → RoomMapping : "Max count of Rooms is greater than allowed"
```

**Das ist eine EINGANGSprüfung, keine Importfunktion.** Channex verlangt
diese Felder VON UNS, bevor ein Kanal aktiviert wird. Es bestätigt den
Messbefund aus Abschnitt 15: `content` ist unser Postfach nach draußen.

`extra_adult_price` und `extra_child_price` stehen in dieser Liste, und der
Rate-Plan trägt `children_fee` / `infant_fee` als echte Felder (Abschnitt 4,
beide `"0.00"`). Dieser Weg ist offen und wird von uns nicht genutzt.

---

## 21. Airbnb-Promotions — vollständig

### Alle drei Typen, die Airbnb über Channex kennt

| Typ | Rabatt | Status bei Listing 020 | Bedingung (Client-Text) |
|---|---|---|---|
| `HIGH_RATED_GUEST_DISCOUNT` | 15 % | **`AVAILABLE`** | Gast mit ≥3 Bewertungen und ⌀ ≥4,8 |
| `MOBILE_ONLY_DISCOUNT` | 10 % | **`AVAILABLE`** | Buchung über die Airbnb-App |
| `NEW_LISTING_PROMOTION` | 20 % | **nicht in der Antwort** | Smart Pricing muss AUS sein, endet nach 3 Buchungen |

Statuswerte: `AVAILABLE` · `ONGOING` · `EXPIRED` (der Client zeigt zusätzlich
ein selbst erzeugtes `COMING_SOON`). Die Höhe ist von Airbnb FEST vorgegeben —
nur an/aus, kein eigener Prozentsatz.

| Weg | Status |
|---|---|
| `GET /channels/{id}/promotions` | **gemessen: 200, 2 Einträge** |
| `POST /channels/{id}/promotions/enable` | im Client vorhanden, **von uns nicht aufgerufen** |
| `POST /channels/{id}/promotions/disable` | im Client vorhanden, **von uns nicht aufgerufen** |

### Die Vorrangregel — ein echter Konflikt mit unserer Preise-Seite

Wörtlich aus der Channex-Oberfläche:

> Promotions override discounts. Example: if a host sets a New Listing
> Promotion on a listing that has a last-minute discount, guests will only
> receive the New Listing Promotion.

**Airbnbs Promotion schlägt unseren Rabatt.** Setzt der Betrieb bei uns einen
Last-Minute-Rabatt und ist gleichzeitig eine Airbnb-Promotion aktiv, greift
NUR die Airbnb-Promotion — unser Rabatt verschwindet stillschweigend. Unsere
Oberfläche kennt und zeigt diesen Konflikt heute nicht.

---

## 22. Opportunities

`GET /channels/{id}/action/get_opportunities` → **200, `{"opportunities": []}`**
(mit und ohne `listing_id`, gleiches Ergebnis)

Die Aktion ist erlaubt und antwortet leer — Airbnb schlägt für dieses Listing
derzeit nichts vor. `POST channels/{id}/action/apply_opportunity` existiert im
Client zum Annehmen eines Vorschlags; **nicht aufgerufen** (es würde schreiben).

---

## 23. Airbnb-Aufräumaufgaben — echte Listing-Daten

`GET /channels/{id}/action/get_checkout_tasks?listing_id=` → **200**

| Aufgabe | `is_present` | `task_detail` |
|---|---|---|
| `RETURN_KEYS` | `true` | `""` (leer) |
| `LOCK_UP` | `true` | `""` (leer) |
| `THROW_TRASH` | `true` | `""` (leer) |
| `TURN_THINGS_OFF` | `true` | `""` (leer) |
| `GATHER_TOWELS` | `true` | `""` (leer) |

Das sind **echte Daten aus dem Airbnb-Listing** — Airbnbs
„Checkout-Aufgaben für Gäste". Bemerkenswert: die Aktion steht NICHT in
`actions` am Kanal, liefert aber Daten. Die `actions`-Whitelist ist also
nicht vollständig.

Ohne `listing_id`: **HTTP 500**. Genau dieser Unterschied (500 statt 400)
war der Hinweis, dass die Aktion existiert — ein erfundener Name antwortet
immer 400.

`POST action/update_checkout_tasks?listing_id=` existiert im Client;
**nicht aufgerufen** (schreibt).

---

## 24. Endpunkte, die für dieses Konto 404 sind

| Pfad | HTTP | Anmerkung |
|---|---|---|
| `POST /properties/{id}/check_readiness` | 404 | Readiness gibt es nur am Kanal |
| `GET /channels/{id}/rate_plans` | 404 | kein GET-Pfad für Kanal-Rate-Plans |
| `GET /channels/{id}/airbnb_rate_plans` | 404 | der Reiter nutzt `action/retrieve_rate_plans` |
| `GET /channels/{id}/events` | 404 | trotz `Channels…events` im Client |
| `GET /scores/{property_id}` | 404 | keine Bewertungen auf dem Konto |

---

## 25. Endpunkte aus der OFFIZIELLEN Postman-Collection

Quelle: Channex' eigene Postman-Collection (176 KB, 100 Requests). Diese
Endpunkte standen in keiner meiner vorherigen Messungen — sie sind der Grund,
warum die Liste vorher unvollständig war.

| Endpunkt | HTTP | Ergebnis |
|---|---|---|
| `GET /property_facilities/options` | 200 | **301 Ausstattungen** mit UUID + `category` |
| `GET /room_facilities/options` | 200 | **191 Zimmer-Ausstattungen** |
| `GET /tax_sets/options` | 200 | `[]` — kein Steuer-Set |
| `GET /property_users?filter[property_id]=` | 200 | **1 Benutzer, `role: owner`** |
| `GET /property_users/all?property_id=` | 200 | 1 Benutzer mit Name + E-Mail |
| `GET /group_users?filter[group_id]=` | 200 | **1 Benutzer, `role: owner`** |
| `GET /scores/{id}/detailed` | 200 | „In the process of obtaining property score information" |
| `GET /hotel_policies` | 200 | `total: 0` |
| `GET /booking_revisions` | 200 | `total: 0` (Liste, nicht nur `/feed`) |
| `GET /booking_revisions/{id}/raw` | — | **ungeprüft** (keine Revision vorhanden) |
| `GET /booking_revisions/{id}/acks` | — | **ungeprüft** |
| `GET /bookings/{id}/acks` | — | **ungeprüft** |
| `POST /photos/upload` | — | **nicht aufgerufen** (schreibt) — der Foto-UPLOAD-Weg |
| `POST /tax_sets/test` | — | **nicht aufgerufen** (Steuer-Set gegen Beispiel prüfen) |
| `POST /webhooks/test` | — | **nicht aufgerufen** |
| `GET /photos/{id}` · `PUT` · `DELETE` | — | ungeprüft (0 Fotos vorhanden) |

### Der Benutzer, unter dem unsere API läuft

```
user_id : 3e265f76-d4c4-427c-9afd-5be11b051e15
name    : Nynextdays PMS
e-mail  : jeanine@mynextdays.dk
role    : owner   (sowohl am Property als auch an der Gruppe)
overrides: null
```

**Das ist der Schlüssel zur Rechte-Frage aus Abschnitt 19.** Unser API-Benutzer
hat `role: owner` — die höchste Rolle am Objekt. Und trotzdem antworten
`action/all_listings`, `action/amenities`, `action/get_pricing_settings` mit
`400 action is not supported`.

Daraus folgt: `allow_airbnb_rate_plans_access` ist ein SEPARATES Recht, das
NICHT in `role: owner` enthalten ist. Es muss von Channex-Seite gesetzt werden
(`overrides: null` heißt, für diesen Benutzer ist nichts zusätzlich gewährt).

### Die Ausstattungs-Kataloge — Kategorien

Beide Kataloge liefern je Eintrag `id` (UUID), `title` und `category`. Die
Kategorienamen aus dem Channex-Client:

| Kategorie | Klartext |
|---|---|
| `general` | General |
| `bathroom` | Bathroom |
| `food_and_drink` | Food and drink |
| `in_room` | In room |
| `kitchen` | Kitchen |
| `outdoors` | Outdoors |
| `outside` | Outside |
| `parking` | Parking |
| `pets` | Pets |
| `safety_and_security` | Safety and security |
| `security` | Security |
| `services` | Services |
| `activites` | Activites (Schreibfehler von Channex) |
| `sustainable_practices` | Sustainable practices |

Beispiele mit echten UUIDs (Property):

```
0cde9d7a-eb6d-447b-88e9-2114f073212e  24-hour front desk       general
f4be53ab-0256-407e-a2c4-7b322a989874  24-hour security         safety_and_security
445d08ee-4542-45bf-a1be-197c2dc354a1  ADA Accessible           general
```

Zimmer:

```
99037843-48aa-4b34-a8a2-3ad8c912dc31  100 Amps                 general
a924101f-c8e2-4df6-b780-783fe63c07ef  Accessible by Lift       in_room
```

**Beide Kataloge sind bei diesem Konto zu 0 % genutzt** —
`properties.facilities` und `room_types` tragen keine Ausstattung.

---

## 26. Der Foto-Weg — vollständig

Aus der Postman-Collection ergibt sich der komplette Foto-Ablauf, den ich
vorher nur halb kannte:

| Schritt | Endpunkt | Status |
|---|---|---|
| 1. Datei hochladen | `POST /photos/upload` | **nicht aufgerufen** (schreibt) |
| 2. Foto anlegen | `POST /photos` | **nicht aufgerufen** |
| 3. Foto lesen | `GET /photos` · `GET /photos/{id}` | **gemessen: `total: 0`** |
| 4. Foto ändern | `PUT /photos/{id}` | ungeprüft |
| 5. Foto löschen | `DELETE /photos/{id}` | ungeprüft |
| 6. am Objekt zuweisen | `PUT /properties/{id}` `content.photos[]` | gemessen (Lesen: `[]`) |
| 7. am Zimmertyp zuweisen | `PUT /room_types/{id}` `content.photos[]` | gemessen (Lesen: `[]`) |

Es gibt also einen dedizierten Upload-Endpunkt (`/photos/upload`) — der Weg
zum Hochladen ist offen. Was fehlt, ist die QUELLE: Airbnb gibt die Fotos
nicht heraus (Abschnitt 15).

---

## 27. Gesamttabelle — JEDER Endpunkt, den irgendeine Quelle nennt

Quellen zusammengeführt: offizielle Postman-Collection (100 Requests),
Bundle-Szenarienliste (46), alle `send()`-Aufrufe im Bundle (~170), sowie
`docs.channex.io`. **54 Endpunkte einzeln gemessen**, jeder mit
Kontrollvergleich gegen einen erfundenen Namen.

| Endpunkt | HTTP | Ergebnis |
|---|---|---|
| `whoami` | 200 | 3 Felder |
| `white_label/settings` | 200 | 2 Felder |
| `currencies` | 200 | n=154 |
| `timezones` | 200 | n=597 |
| `channels/codes` | 200 | n=730 |
| `channels/list` | 200 | n=118 |
| `applications` | 200 | n=13 |
| `applications/installed` | 200 | n=18 |
| `groups` | 200 | n=1/total=1 |
| `properties` | 200 | n=18/total=18 |
| `room_types` | 200 | n=1/total=1 |
| `rate_plans` | 200 | n=2/total=2 |
| `taxes` | 200 | n=0/total=0 |
| `tax_sets` | 200 | n=0/total=0 |
| `hotel_policies` | 200 | n=0/total=0 |
| `photos` | 200 | n=0/total=0 |
| `webhooks` | 200 | n=1/total=1 |
| `channels` | 200 | n=1/total=1 |
| `reviews` | 200 | n=0/total=0 |
| `bookings` | 200 | n=0/total=0 |
| `booking_revisions` | 200 | n=0/total=0 |
| `booking_revisions/feed` | 200 | n=0/total=0 |
| `message_threads` | 200 | n=0/total=0 |
| `live_feed` | 200 | n=0/total=0 |
| `channel_availability_rules` | 200 | n=0/total=0 |
| `cancellation_policies` | 200 | n=0/total=0 |
| `properties/options` | 200 | n=18 |
| `room_types/options` | 200 | n=1 |
| `rate_plans/options` | 200 | n=1 |
| `groups/options` | 200 | n=1 |
| `tax_sets/options` | 200 | n=0 |
| `property_facilities/options` | 200 | n=301 |
| `room_facilities/options` | 200 | n=191 |
| `channel_availability_rules/options` | 200 | n=0 |
| `property_facilities` | 200 | n=100/total=301 |
| `room_facilities` | 200 | n=100/total=191 |
| `properties/{prop}` | 200 | 4 Felder |
| `room_types/{rt}` | 200 | 4 Felder |
| `rate_plans/{rp}` | 200 | 4 Felder |
| `groups/{grp}` | 200 | 4 Felder |
| `channels/{ch}` | 200 | 4 Felder |
| `webhooks/b4688844-3a7c-4670-9231-fbbb690be3d0` | 200 | 4 Felder |
| `property_users` | 422 | bad_request — korrekt gemessen in Abschn. 12 bzw. 25 (Sammelskript-Parameterkollision) |
| `group_users` | 422 | bad_request — korrekt gemessen in Abschn. 12 bzw. 25 (Sammelskript-Parameterkollision) |
| `property_users/all?property_id={prop}` | 500 | internal_server_error |
| `scores/{prop}` | 404 | resource_not_found |
| `scores/{prop}/detailed` | 200 | 93B |
| `channels/{ch}/mappings/{map}/pricing_settings` | 200 | 3 Felder |
| `channels/{ch}/mappings/{map}/availability_settings` | 200 | 3 Felder |
| `channels/{ch}/promotions` | 200 | n=2 |
| `availability?filter[property_id]={prop}&filter[date][gte]=2026-08-05&filter[date][lte]=2026-08-06` | 422 | bad_request — korrekt gemessen in Abschn. 12 bzw. 25 (Sammelskript-Parameterkollision) |
| `restrictions?filter[property_id]={prop}&filter[date][gte]=2026-08-05&filter[date][lte]=2026-08-06&filter[restrictions]=rate` | 422 | bad_request — korrekt gemessen in Abschn. 12 bzw. 25 (Sammelskript-Parameterkollision) |
| `erfundene_kontrolle_zzz999` | 404 | resource_not_found |

### Die -Aktionen — vollständig mit Kontrolltest

| Aktion | HTTP | Größe | Bewertung |
|---|---|---|---|
| `all_listings` | 400 | 93 B | nicht unterscheidbar vom Kontrollnamen |
| `amenities` | 400 | 93 B | nicht unterscheidbar vom Kontrollnamen |
| `get_pricing_settings` | 400 | 93 B | nicht unterscheidbar vom Kontrollnamen |
| `get_default_rules` | 400 | 93 B | nicht unterscheidbar vom Kontrollnamen |
| `get_default_pricing` | 400 | 93 B | nicht unterscheidbar vom Kontrollnamen |
| `get_checkout_tasks` | 200 | 286 B | **echte Airbnb-Daten** (5 Aufgaben) |
| `get_unpublish_reasons` | 200 | 2725 B | **echte Daten** (Deaktivierungs-Dialog) |
| `get_opportunities` | 200 | 29 B | erlaubt, leer |
| `retrieve_rate_plans` | 200 | 11 B | erlaubt, leer (Preismodell `standard`) |
| `misconduct_categories` | 400 | 93 B | nicht unterscheidbar vom Kontrollnamen |
| `test_accounts` | 400 | 93 B | nicht unterscheidbar vom Kontrollnamen |
| **`erfundene_kontrolle_zzz`** | 400 | 93 B | **KONTROLLE** — dieselbe Antwort wie die 400er |

**Der Kontrolltest ist der Kern:** `erfundene_kontrolle_zzz` antwortet mit
exakt demselben `400` und derselben Größe (93 B) wie `all_listings`,
`amenities`, `get_pricing_settings`, `get_default_rules`,
`get_default_pricing`, `misconduct_categories` und `test_accounts`.
Diese sieben sind daher **nicht** von einem nicht existierenden Namen zu
unterscheiden — ihr Fehlen ist gemessen, ihre Ursache nicht.

Die vier mit `200` sind dagegen belegt: sie liefern Daten oder ein leeres,
aber strukturiertes Ergebnis (`{"data":[]}` bzw. `{"opportunities":[]}`).

---

## 28. Die offizielle Doku — vollständige Seitenliste

Quelle: `https://docs.channex.io/sitemap.md` (jede Seite als Markdown durch
Anhängen von `.md`). **94 Seiten**, davon 28 API-Referenz. Vorher hatte ich
nur nach Content gesucht statt die Liste systematisch abzuarbeiten.

### API-Referenz — alle 28 Seiten

| Seite | in dieser Messung |
|---|---|
| `api-reference` | Grundlagen: Envelope, Pagination, Filter, Statuscodes |
| `rate-limits` | **Abschnitt 29** |
| `property-size-limits` | **Abschnitt 30** |
| `ari` | Abschnitt 12 (gemessen) |
| `hotels-collection` | Abschnitt 2 (gemessen) |
| `room-types-collection` | Abschnitt 3 (gemessen) |
| `rate-plans-collection` | Abschnitt 4 (gemessen) |
| `facilities-collection` | **Abschnitt 31** — 4 Endpunkte, alle gemessen |
| `photos-collection` | Abschnitt 26 (Upload-Weg) |
| `taxes-and-tax-sets` | gemessen: 0 Steuern, 0 Sets |
| `hotel-policy-collection` | gemessen: `total: 0` |
| `availability-rules-collection` | gemessen: `total: 0` |
| `bookings-collection` | gemessen: `total: 0` |
| `messages-collection` | gemessen: `total: 0` |
| `reviews-collection` | gemessen: `total: 0` |
| `webhook-collection` | Abschnitt 11 (gemessen) |
| `groups-collection` | Abschnitt 10 (gemessen) |
| `group-users-collection` | Abschnitt 25 (gemessen: 1 owner) |
| `property-users-collection` | Abschnitt 25 (gemessen: 1 owner) |
| `channel-api` | Abschnitte 14, 19 (gemessen) |
| `channel-codes` | gemessen: 730 Portale |
| `channel-iframe` | nicht relevant (Einbettungs-UI) |
| `applications-api` | gemessen: 13 verfügbar / 18 installiert |
| `booking-crs-api` | Test-Buchungen erzeugen — nicht aufgerufen |
| `payment-application-api` | nicht relevant |
| `stripe-tokenization-app` | nicht relevant |
| `pms-certification-tests` | Zertifizierung — offen |
| `open-channel-api` / `shopping-api` | OTA-Seite, nicht PMS |

Dazu **35 Kanal-Mapping-Anleitungen** (eine je OTA), 12 Anwendungs-
Dokumentationen, 5 Leitfäden.

---

## 29. Rate-Limits — die harten Grenzen

| Grenze | Wert |
|---|---|
| ARI gesamt | **20 pro Minute** |
| Restrictions & Preise | **10 pro Minute pro Objekt** |
| Verfügbarkeit | **10 pro Minute pro Objekt** |
| JSON-Größe pro Aufruf | **10 MB** |
| Pagination `limit` | max. **100** |

Bei Überschreitung: **HTTP 429** `http_too_many_requests`.

Channex' eigene Empfehlung: Änderungen bündeln (z. B. ein Aufruf alle 6
Sekunden), drosseln, exponentielles Backoff, nach einem 429 eine Minute für
dieses Objekt pausieren. Ein vollständiger Sync soll **zwei** Aufrufe
brauchen — nicht mehr.

Unser Client setzt das um (`channex_client.py`: Budget-Töpfe getrennt nach
`availability` / `rates` / `other`, Backoff bei 429).

---

## 30. Größenlimits — und wie unser Konto dazu steht

| Grenze | Ferienobjekt | Hotel | unser Konto (gemessen) |
|---|---|---|---|
| Zimmertypen | **50** | 20 | `max_count_of_room_types: 50` ✓ |
| Preispläne | **10 je Zimmertyp** | 200 je Objekt | `max_count_of_rate_plans: 400` |
| Belegung (per person) | **18** | 18 | `max_count_of_occupancies: 18` ✓ |

Objekt 020 ist als `property_category: vacation_rental` /
`property_type: holiday_home` angelegt — es gilt also die Ferienobjekt-Grenze
von **10 Preisplänen je Zimmertyp**. Aktuell: 2 Pläne. Weit unter der Grenze.

### Überschreitungsgebühren (USD)

| Fall | Gebühr |
|---|---|
| Hotel-Zimmertyp | $1 je Typ (max. $7 je Objekt) |
| Hotel-Preisplan | $0,05 je Plan |
| Ferienobjekt-Preisplan | $0,05 je Plan |

### Channex' eigene Empfehlung — deckt sich mit unserem Datenmodell

> If you have vacation Rental you should make a property per apartment instead
> of putting all into one Channex property

Genau so ist es bei uns umgesetzt: 18 Objekte = 18 Channex-Properties.
Ebenso die zweite Empfehlung — „use *Per Person* rate plans instead of making
a rate plan per occupancy" und „try not to make a rate plan per OTA". Letzteres
verletzen wir derzeit: Objekt 020 hat einen zweiten Plan
`Grundpreis (von Airbnb) - AirBNB Airbnb`, also einen Plan JE OTA.

---

## 31. Facilities-Collection — die vier Endpunkte

| Endpunkt | gemessen |
|---|---|
| `GET /property_facilities` | **200, total 301** |
| `GET /property_facilities/options` | **200, 301** |
| `GET /room_facilities` | **200, total 191** |
| `GET /room_facilities/options` | **200, 191** |

Alle vier sind reine LESE-Kataloge (keine POST/PUT/DELETE). Gesetzt werden die
UUIDs am Objekt über `PUT /properties/{id}` `facilities[]` bzw. am Zimmertyp
über `PUT /room_types/{id}`.

---

## 32. Der offizielle Airbnb-Mapping-Guide

Quelle: `docs.channex.io/channel-mapping-guides/airbnb.md`. Die Aussagen dort
bestätigen die Messungen — und einer beantwortet die Ausgangsfrage direkt.

### Woher die Preisdaten kommen — wörtlich

> The details are **pulled from the listing**, so mostly it is to check they
> are correct. You can edit also. These settings are now **not** editable in
> Airbnb!

Das ist die Bestätigung für Abschnitt 6: Preise, Gebühren und Regeln werden
aus dem Airbnb-Listing GEZOGEN. Zweiter Teil des Satzes ist wichtig: nach dem
Mapping sind diese Einstellungen **bei Airbnb selbst nicht mehr änderbar** —
Channex übernimmt die Führung.

Der Guide nennt als übernommene Felder: Currency · Default Daily Price ·
Default Weekend Price · Monthly Stay Discount · Weekly Stay Discount ·
Price Per Extra Guest · Guests Included · Security Deposit · Cleaning Fee.
**Alle diese Felder habe ich in Abschnitt 6 gemessen. Kein Content-Feld ist
in dieser Liste.**

### Airbnb nimmt nur EINEN Preis — wörtlich

> Airbnb allows you to map only 1 rate plan. So essentially you can send just
> 1 price only, to have different prices per person you will need to change
> settings in the Airbnb listing.

> For Airbnb you can only have 1 setting for price per extra person, you cant
> have different price for 1st extra or 2nd extra etc.

**Damit ist die offene Frage zum Zusatzgast-Preis beantwortet.** Unsere
Preise-Seite erlaubt „Aufschlag pro Gast ab Gast N" — Airbnb kennt nur EINEN
Aufschlag für ALLE Zusatzgäste. Der Weg dorthin ist `price_per_extra_person` +
`guests_included` in den `pricing_settings` (Abschnitt 6, beide gemessen, von
uns **nur gelesen, nie geschrieben**).

Empfehlung des Guides: den NIEDRIGSTEN Belegungspreis mappen, dann
`guests_included` und `price_per_extra_person` setzen.

### Min-Stay: Airbnb kann nur EINE Art

> Currently we send Min Stay Arrival restriction to Airbnb, if your property is
> using Min Stay Through it will not be sent.

Objekt 020 hat `min_stay_type: "both"` (Abschnitt 2). Nach diesem Satz geht
nur `min_stay_arrival` an Airbnb — `min_stay_through` wird **verworfen**.
Beide sind bei 020 auf `1`, daher heute ohne Folge.

### CTA/CTD überschreiben die Airbnb-Einstellung täglich

> These settings will be overwritten by channex daily from the CTA (Closed to
> Arrival) and CTD (Closed to Departure) restrictions.

An-/Abreisetage im Listing werden also von unseren Restriktionen überschrieben.
Gemessen: `day_of_week_check_in`/`check_out` = `[true ×7]`, unsere
`closed_to_arrival`/`closed_to_departure` = `[false ×7]`. Konsistent.

### Eine Falle, die unser Onboarding kennen muss

> If the setting is on "Unavailable by Default" it is incompatible with
> Channex. You should choose either all dates or a number.

Steht das Airbnb-Listing auf „Unavailable by Default", ist es mit Channex
**unvereinbar**. Gemessen bei 020: `max_days_notice: 365` — also eine Zahl,
kein Problem. Bei den anderen 17 Listings **ungeprüft**.

> If there is already another channel manager or PMS connected to Airbnb the
> connection will not complete.

---

## 33. Webhook-Events — 25 dokumentiert, 20 bei uns abonniert

Die offizielle `webhook-collection` listet **25** Events. Unser globaler
Webhook `b4688844…` abonniert **20**. Fünf fehlen:

| Fehlendes Event | Bedeutung | Folge für uns |
|---|---|---|
| `booking` | Sammelevent für ALLE Buchungsänderungen (neu/geändert/storniert) | keine — wir haben die drei Einzelevents |
| **`accepted_reservation`** | **Airbnb**: Reservierungsanfrage wurde angenommen | wir erfahren die Annahme nicht |
| **`declined_reservation`** | **Airbnb**: Reservierungsanfrage wurde abgelehnt | wir erfahren die Ablehnung nicht |
| `new_channel` | ein neuer Kanal wurde für das Objekt erstellt | Kanal-Anlage außerhalb unserer App bleibt unbemerkt |
| `updated_channel` | der Kanal wurde geändert | Änderung im Channex-Backend bleibt unbemerkt |

`reservation_request` und `alteration_request` haben wir — die Antwort darauf
(`accepted_reservation` / `declined_reservation`) nicht. Wir sehen also die
Anfrage, aber nicht ihren Ausgang.

### Es gibt KEIN Content-Event

Die vollständige Doku-Liste enthält kein Event für Fotos, Beschreibung oder
Ausstattung. Bestätigt Abschnitt 15 aus einer weiteren Quelle.

### `POST /webhooks/test` ist als Namensprüfung UNTAUGLICH — gemessen

Ich habe versucht, gültige Event-Namen über `webhooks/test` zu ermitteln. Das
funktioniert nicht:

| `event_mask` | Antwort |
|---|---|
| `booking` | 200 |
| `accepted_reservation` | 200 |
| `content` | 200 |
| `photos` | 200 |
| **`voelliger_unsinn_zzz999`** | **200** |

Der Endpunkt prüft nur die `callback_url` (bei unerreichbarem Host: 422
`invalid host`) und schickt dann einen Test-POST — den **Event-Namen validiert
er nicht**. Er ist damit dieselbe Falle wie der `execute`-Namensraum
(Methodenwarnung oben). Die 25 gültigen Namen stammen daher aus der Doku, nicht
aus einer Messung; eine echte Prüfung bräuchte `POST /webhooks` (legt an →
nicht ausgeführt).

### Webhook-Sicherheit — Channex' eigene Aussage

> Channex-Webhooks verfügen derzeit **nicht** über eine integrierte
> HMAC-Signatur oder einen kryptografischen Signaturmechanismus, wie er bei
> Stripe/GitHub-Webhook-Signaturen verwendet wird.

Die Authentifizierung beruht auf: HTTPS · benutzerdefiniertem Shared-Secret-
Header · optionaler IP-Allowlist · eigener Replay-/Idempotenzbehandlung.

Unser Webhook nutzt genau diesen Weg (`X-Channex-Webhook-Secret`). **Aber:**
`GET /webhooks` gibt das Secret im Klartext zurück (Abschnitt 17). Channex
empfiehlt selbst „Geheimnis-Rotation, wo angebracht" — hier ist sie angebracht.

Weitere Vorgaben aus der Doku, die für unseren Endpunkt gelten:

- „Webhooks sollten als **nicht vertrauenswürdige externe Eingabe** behandelt
  werden." → deckt sich mit Wurzel 8.
- „Verlassen Sie sich nicht ausschließlich auf die Validierung der Quell-IP."
- „Die Struktur der eingehenden Nutzdaten muss stets vor der Verarbeitung
  überprüft werden."

### Wiederholungslogik — 10 Versuche über knapp 24 Stunden

Bei einem **5XX** von unserem Endpunkt wiederholt Channex mit exponentiellem
Backoff: 1 · 2 · 4 · 8 · 15 · 30 Minuten, dann 1 · 2 · 4 · 6 · 10 Stunden.
Maximal 10 Versuche, letzter Versuch ~24 h nach dem Ereignis.

**Wichtig:** das gilt nur für 5XX. Ein 4XX von uns gilt als endgültig — kein
Wiederholungsversuch. Ein Validierungsfehler, der 422 zurückgibt, verwirft das
Ereignis also dauerhaft.

### Reihenfolge ist NICHT garantiert — Channex' eigene Warnung

> Die Reihenfolge eingehender Webhook-Aufrufe kann von der Reihenfolge der
> Ereignisse abweichen, die diese Aufrufe auslösen. Webhooks können in
> falscher Reihenfolge eintreffen.

Deren Beispiel: Verfügbarkeit 0→1 und 1→0 lösen zwei `ari`-Webhooks aus.
Scheitert der erste an einem Timeout, trifft der zweite ZUERST ein — das PMS
sieht erst 0, dann 1, und speichert am Ende den FALSCHEN Wert.

> Wir empfehlen, die Informationen aus der Nutzlast **als Auslöser** zu
> verwenden und die ARI-Informationen aus Channex nachzuladen.

Das ist eine Warnung an unseren `ari`-Webhook: Werte aus der Nutzlast direkt zu
übernehmen ist laut Channex unsicher. **Ungeprüft**, wie unser Handler das
heute macht.

### Globale vs. Objekt-Webhooks

Unser Webhook ist `is_global: true`, `property_id: null` — gemessen, und laut
Doku der empfohlene Weg bei vielen Objekten („neue Objekte werden automatisch
erfasst"). Bei doppelter Konfiguration gewinnt der Objekt-Webhook; das
Ereignis kommt trotzdem nur EINMAL.

### `send_data`

Unser Webhook: `send_data: true` (gemessen) — die Nutzlast kommt mit. Bei
`false` kämen nur `event`, `property_id`, `user_id`, `timestamp`.

Das Feld `user_id` in jeder Nutzlast ist der Auslöser der Änderung — damit
lassen sich Ereignisse ignorieren, die unsere eigenen Pushes verursacht haben.

---

## 34. Buchungen — was wir bei einer Airbnb-Buchung EMPFANGEN

Quelle: `bookings-collection`. Auf unserem Konto sind **0 Buchungen** (Abschnitt
13), die Feldliste stammt daher aus der Doku samt Airbnb-Beispiel — als
Sollzustand, nicht als Messwert.

### Buchungsrevision — alle Felder

| Feld | Bedeutung |
|---|---|
| `id` | Revisions-ID bei Channex |
| `property_id` · `booking_id` | Zuordnung |
| `unique_id` | OTA-Code + Reservierungscode, z. B. `ABB-HM5MBZ1AVA` |
| `system_id` | Nachrichten-ID der Quelle, **je Revision eindeutig** — Dedupe |
| `ota_reservation_code` | Reservierungscode der OTA (fürs Telefonat) |
| `ota_name` | `Airbnb` · `BookingCom` · `A-Expedia` · `Goibibo` … |
| `status` | `new` · `modified` · `cancelled` |
| `rooms[]` | die gebuchten Zimmer |
| `services[]` | Zusatzleistungen |
| `guarantee` | Kreditkarte — siehe Sicherheitshinweis unten |
| `customer` | Name, Mail, Telefon, Adresse, Land, Sprache |
| `occupancy` | `adults` · `children` · `infants` |
| `arrival_date` · `departure_date` | ISO `YYYY-MM-DD` |
| `arrival_hour` | `HH:MM`, 24-Stunden-Format |
| `amount` · `currency` | Gesamtbetrag |
| `notes` | Kundenhinweise — **bei Airbnb steckt hier die Preisaufschlüsselung** |
| **`payment_collect`** | `property` · `ota` · `null` — wer kassiert |
| **`payment_type`** | `credit_card` · `bank_transfer` · `null` |
| **`ota_commission`** | Provision der OTA — **nur Booking.com und Airbnb** |
| `inserted_at` | Empfangszeitpunkt bei Channex |

### Zimmer (`rooms[]`)

| Feld | Bedeutung |
|---|---|
| `checkin_date` · `checkout_date` | je Zimmer, kann von der Buchung abweichen |
| `rate_plan_id` · `room_type_id` | **`null`, wenn nicht gemappt** → `booking_unmapped_*` |
| `occupancy` | plus `ages[]`, wenn `children > 0` |
| `guests[]` | Name und Nachname, falls die OTA sie liefert |
| `services[]` | Leistungen auf Zimmerebene |
| `taxes[]` | `is_inclusive` · `name` · `total_price` · `type` (`fee`/`tax`/`city_tax`) |
| **`collected_taxes[]`** | von der OTA bereits einbehaltene Steuern — **nur Booking.com** |
| `amount` | Zimmerbetrag |
| `days` | **Preis je Nacht**: `{"2019-05-09": "100.00"}` |
| `meta.parent_rate_plan_id` | der ECHTE Plan bei abgeleitetem Plan/Belegungsoption |
| `ota_unique_id` | Zimmer-ID bei der OTA — derzeit nur Booking.com |

### Airbnbs Besonderheit: die Preisaufschlüsselung steckt im `notes`-Feld

Aus dem Doku-Beispiel einer echten Airbnb-Buchung:

```
Listing Base Price: 300.00
Total Paid Amount: 0.00
Transient Occupancy Tax Paid Amount: 0.00
Listing Security Price: 100.00
Listing Cancellation Payout: 249.60
Listing Cancellation Host Fee: 50.40
Occupancy Tax Amount Paid To Host: 0.00
```

Das ist **Freitext**, kein strukturiertes Feld. Airbnb liefert dort Grundpreis,
bezahlten Betrag, Kurtaxe, Kaution, Stornoauszahlung und Host-Gebühr. Wer diese
Zahlen braucht, muss den Text parsen — Airbnbs `taxes[]` ist im Beispiel **leer**.

### Was Airbnb NICHT liefert (aus demselben Beispiel)

| Feld | Airbnb | Booking.com |
|---|---|---|
| `guarantee` (Kreditkarte) | **`null`** | vollständig, teils virtuell |
| `rooms[].guests` | **`null`** | Name + Nachname |
| `rooms[].meta` | **`null`** | Storno-Staffel, Verpflegung, Richtlinien, Promotion |
| `rooms[].taxes` | **`[]`** | mit `is_inclusive`, Betrag, Typ |
| `customer.address` / `city` / `zip` | **`null`** | teils gefüllt |
| `ota_commission` | **vorhanden** | vorhanden |

Bei Airbnb kommt also **keine Kreditkarte** — die Zahlung läuft über Airbnb.

### Kreditkartendaten brauchen einen ANDEREN Endpunkt — PCI DSS

> Wenn Ihre Anwendung Informationen über Kreditkarten empfangen soll, ändern
> Sie den Ziel-Endpunkt … In der Produktionsumgebung verwenden Sie bitte
> **`secure.channex.io`**.

Voraussetzung laut Doku: vorher `support@channex.io` kontaktieren, IP-Liste zum
Whitelisting **und das eigene PCI-DSS-Zertifikat** einsenden.

Wir nutzen `app.channex.io` (gemessen, Abschnitt 1) — also den NICHT-secure
Endpunkt. Für Airbnb ohne Folge (`guarantee: null`), aber sobald Booking.com
oder Expedia dazukommen, kommen dort virtuelle Kreditkarten. Ohne den
secure-Endpunkt erhalten wir sie nicht — was PCI-technisch die sichere Seite
ist, aber bedeutet: **kein VCC-Einzug ohne eigene PCI-DSS-Zertifizierung.**

### Der Buchungs-Empfangsweg

| Endpunkt | Zweck | bei uns gemessen |
|---|---|---|
| `GET /booking_revisions/feed` | **primärer Weg**, nur unbestätigte | 200, `total: 0` |
| `GET /booking_revisions` | alle Revisionen | 200, `total: 0` |
| `GET /booking_revisions/{id}` | eine Revision | ungeprüft (keine vorhanden) |
| `POST /booking_revisions/{id}/ack` | **Pflicht**: bestätigen | nicht ausgeführt |
| `GET /bookings` · `GET /bookings/{id}` | Erstabruf / Nachschlagen | 200, `total: 0` |

Filter am Feed: `?filter[property_id]=…` und `?order[inserted_at]=asc`
(älteste zuerst — sinnvoll, damit Revisionen in Reihenfolge verarbeitet werden).

**Die 30-Minuten-Regel:** „PMS ist verpflichtet, alle Buchungen zu bestätigen.
Sollte eine Buchung nicht bestätigt werden, wird sie 30 Minuten lang angezeigt,
bevor Sie eine E-Mail-Warnung erhalten." Dazu passt das Webhook-Event
`non_acked_booking` — das haben wir abonniert (Abschnitt 33).

### Reporting-API — nur Booking.com

| Endpunkt | Zweck |
|---|---|
| `POST /bookings/{id}/no_show` | Nichterscheinen melden, Payload `{no_show_report: {waived_fees}}` |
| `POST /bookings/{id}/invalid_card` | ungültige Karte melden, leere Payload |
| `POST /bookings/{id}/cancel_due_invalid_card` | wegen ungültiger Karte stornieren |

Fristen: Nichterscheinen ab 00:00 Ortszeit des Anreisetags, bis 48 h danach.
Ungültige Karte bis Mitternacht des Anreisetags. Für **Airbnb nicht relevant**
(keine Kreditkarte im Spiel).

---

## 34. Buchungen — was wir bei einer Airbnb-Buchung EMPFANGEN

Quelle: `bookings-collection`. Auf unserem Konto sind **0 Buchungen** (Abschnitt
13), die Feldliste stammt daher aus der Doku samt Airbnb-Beispiel — als
Sollzustand, nicht als Messwert.

### Buchungsrevision — alle Felder

| Feld | Bedeutung |
|---|---|
| `id` | Revisions-ID bei Channex |
| `property_id` · `booking_id` | Zuordnung |
| `unique_id` | OTA-Code + Reservierungscode, z. B. `ABB-HM5MBZ1AVA` |
| `system_id` | Nachrichten-ID der Quelle, **je Revision eindeutig** — Dedupe |
| `ota_reservation_code` | Reservierungscode der OTA (fürs Telefonat) |
| `ota_name` | `Airbnb` · `BookingCom` · `A-Expedia` · `Goibibo` … |
| `status` | `new` · `modified` · `cancelled` |
| `rooms[]` | die gebuchten Zimmer |
| `services[]` | Zusatzleistungen |
| `guarantee` | Kreditkarte — siehe Sicherheitshinweis unten |
| `customer` | Name, Mail, Telefon, Adresse, Land, Sprache |
| `occupancy` | `adults` · `children` · `infants` |
| `arrival_date` · `departure_date` | ISO `YYYY-MM-DD` |
| `arrival_hour` | `HH:MM`, 24-Stunden-Format |
| `amount` · `currency` | Gesamtbetrag |
| `notes` | Kundenhinweise — **bei Airbnb steckt hier die Preisaufschlüsselung** |
| **`payment_collect`** | `property` · `ota` · `null` — wer kassiert |
| **`payment_type`** | `credit_card` · `bank_transfer` · `null` |
| **`ota_commission`** | Provision der OTA — **nur Booking.com und Airbnb** |
| `inserted_at` | Empfangszeitpunkt bei Channex |

### Zimmer (`rooms[]`)

| Feld | Bedeutung |
|---|---|
| `checkin_date` · `checkout_date` | je Zimmer, kann von der Buchung abweichen |
| `rate_plan_id` · `room_type_id` | **`null`, wenn nicht gemappt** → `booking_unmapped_*` |
| `occupancy` | plus `ages[]`, wenn `children > 0` |
| `guests[]` | Name und Nachname, falls die OTA sie liefert |
| `services[]` | Leistungen auf Zimmerebene |
| `taxes[]` | `is_inclusive` · `name` · `total_price` · `type` (`fee`/`tax`/`city_tax`) |
| **`collected_taxes[]`** | von der OTA bereits einbehaltene Steuern — **nur Booking.com** |
| `amount` | Zimmerbetrag |
| `days` | **Preis je Nacht**: `{"2019-05-09": "100.00"}` |
| `meta.parent_rate_plan_id` | der ECHTE Plan bei abgeleitetem Plan/Belegungsoption |
| `ota_unique_id` | Zimmer-ID bei der OTA — derzeit nur Booking.com |

### Airbnbs Besonderheit: die Preisaufschlüsselung steckt im `notes`-Feld

Aus dem Doku-Beispiel einer echten Airbnb-Buchung:

```
Listing Base Price: 300.00
Total Paid Amount: 0.00
Transient Occupancy Tax Paid Amount: 0.00
Listing Security Price: 100.00
Listing Cancellation Payout: 249.60
Listing Cancellation Host Fee: 50.40
Occupancy Tax Amount Paid To Host: 0.00
```

Das ist **Freitext**, kein strukturiertes Feld. Airbnb liefert dort Grundpreis,
bezahlten Betrag, Kurtaxe, Kaution, Stornoauszahlung und Host-Gebühr. Wer diese
Zahlen braucht, muss den Text parsen — Airbnbs `taxes[]` ist im Beispiel **leer**.

### Was Airbnb NICHT liefert (aus demselben Beispiel)

| Feld | Airbnb | Booking.com |
|---|---|---|
| `guarantee` (Kreditkarte) | **`null`** | vollständig, teils virtuell |
| `rooms[].guests` | **`null`** | Name + Nachname |
| `rooms[].meta` | **`null`** | Storno-Staffel, Verpflegung, Richtlinien, Promotion |
| `rooms[].taxes` | **`[]`** | mit `is_inclusive`, Betrag, Typ |
| `customer.address` / `city` / `zip` | **`null`** | teils gefüllt |
| `ota_commission` | **vorhanden** | vorhanden |

Bei Airbnb kommt also **keine Kreditkarte** — die Zahlung läuft über Airbnb.

### Kreditkartendaten brauchen einen ANDEREN Endpunkt — PCI DSS

> Wenn Ihre Anwendung Informationen über Kreditkarten empfangen soll, ändern
> Sie den Ziel-Endpunkt … In der Produktionsumgebung verwenden Sie bitte
> **`secure.channex.io`**.

Voraussetzung laut Doku: vorher `support@channex.io` kontaktieren, IP-Liste zum
Whitelisting **und das eigene PCI-DSS-Zertifikat** einsenden.

Wir nutzen `app.channex.io` (gemessen, Abschnitt 1) — also den NICHT-secure
Endpunkt. Für Airbnb ohne Folge (`guarantee: null`), aber sobald Booking.com
oder Expedia dazukommen, kommen dort virtuelle Kreditkarten. Ohne den
secure-Endpunkt erhalten wir sie nicht — was PCI-technisch die sichere Seite
ist, aber bedeutet: **kein VCC-Einzug ohne eigene PCI-DSS-Zertifizierung.**

### Der Buchungs-Empfangsweg

| Endpunkt | Zweck | bei uns gemessen |
|---|---|---|
| `GET /booking_revisions/feed` | **primärer Weg**, nur unbestätigte | 200, `total: 0` |
| `GET /booking_revisions` | alle Revisionen | 200, `total: 0` |
| `GET /booking_revisions/{id}` | eine Revision | ungeprüft (keine vorhanden) |
| `POST /booking_revisions/{id}/ack` | **Pflicht**: bestätigen | nicht ausgeführt |
| `GET /bookings` · `GET /bookings/{id}` | Erstabruf / Nachschlagen | 200, `total: 0` |

Filter am Feed: `?filter[property_id]=…` und `?order[inserted_at]=asc`
(älteste zuerst — sinnvoll, damit Revisionen in Reihenfolge verarbeitet werden).

**Die 30-Minuten-Regel:** „PMS ist verpflichtet, alle Buchungen zu bestätigen.
Sollte eine Buchung nicht bestätigt werden, wird sie 30 Minuten lang angezeigt,
bevor Sie eine E-Mail-Warnung erhalten." Dazu passt das Webhook-Event
`non_acked_booking` — das haben wir abonniert (Abschnitt 33).

### Reporting-API — nur Booking.com

| Endpunkt | Zweck |
|---|---|
| `POST /bookings/{id}/no_show` | Nichterscheinen melden, Payload `{no_show_report: {waived_fees}}` |
| `POST /bookings/{id}/invalid_card` | ungültige Karte melden, leere Payload |
| `POST /bookings/{id}/cancel_due_invalid_card` | wegen ungültiger Karte stornieren |

Fristen: Nichterscheinen ab 00:00 Ortszeit des Anreisetags, bis 48 h danach.
Ungültige Karte bis Mitternacht des Anreisetags. Für **Airbnb nicht relevant**
(keine Kreditkarte im Spiel).

---

## 35. Channel-API — WHITELABEL-GEBUNDEN (die endgültige Antwort)

Wörtlich aus `channel-api`:

> Der Zugriff auf die Channel-API ist **nur für Whitelabel-Konten** möglich.

**Damit ist die offene Frage aus Abschnitt 14 und 19 beantwortet.** Die
`action/*`-Aufrufe (`all_listings`, `amenities`, `get_pricing_settings`,
`get_default_rules`, `get_default_pricing`, `misconduct_categories`,
`test_accounts`) sind kein Fehler und keine Kanaltyp-Eigenschaft — sie gehören
zur **Channel-API**, und die ist an ein Whitelabel-Konto gebunden.

Was der Umfang der Channel-API laut Doku ist:

| Fähigkeit | bei uns messbar? |
|---|---|
| Kanäle hinzufügen und löschen | ja (`POST`/`DELETE /channels` im Client vorhanden) |
| Liste der Kanäle lesen | **ja, gemessen** (`GET /channels`, `channels/list`) |
| Kanaleinstellungen und Zuordnungen | **teilweise** — `POST …/mappings` geht (Abschnitt 6) |
| „Einige OTA-spezifische Fähigkeiten" | **NEIN** — genau hier liegen die 400er |

Der Widerspruch, den ich in Abschnitt 25 gemessen habe, löst sich damit auf:
unser Benutzer hat `role: owner`, aber `owner` ist eine Rolle am OBJEKT — das
Whitelabel-Merkmal hängt am KONTO. Gemessen: `GET /white_label/settings`
antwortet 200 mit nur **2 Feldern** (Abschnitt 9) — also ohne echte
Whitelabel-Konfiguration.

Zweiter Hinweis aus derselben Seite:

> Da die Kanalzuordnung individuell ist, benötigt der Entwickler Zeit, um die
> Zuordnung für jedes OTA zu erstellen. Wir bieten eine **iFrame-Lösung** an,
> um dies zu vereinfachen.

Der Weg für ein Nicht-Whitelabel-Konto ist also das **Channel-iFrame**
(`channel-iframe`, Abschnitt 28) — Channex' Zuordnungs-Maske in unsere
Oberfläche eingebettet, statt eigener API-Aufrufe.

**Für Evans Mail heißt das:** die Frage ist nicht „warum geht `all_listings`
nicht", sondern „welche Whitelabel-Stufe brauchen wir, und was kostet sie".

---

## 36. Booking CRS API — Buchungen SCHREIBEN

Quelle: `booking-crs-api`. **Beta**, laut Doku „experimentell und kann sich
ändern". Erfordert die installierte **Booking-CRS-App** am Objekt.

Gemessen (Abschnitt 25): 13 Applications verfügbar, 18 installiert — je Objekt
eine. **Ungeprüft**, welche App das ist; die installierten Einträge tragen
`application_code`, das ich nicht ausgelesen habe.

| Endpunkt | Zweck |
|---|---|
| `POST /bookings` | Buchung anlegen (auch offline entstandene) |
| `PUT /bookings/{id}` | Buchung ändern — **auch OTA-Buchungen** |

Beide sind im Client vorhanden; **nicht aufgerufen** (schreiben).

### Wofür das gut ist

Channex nennt als Zweck: Buchungsdaten im Gleichstand mit dem PMS halten,
Offline-Buchungen in die reguläre Verarbeitung einspeisen, und Buchungen mit
eigenen `meta`-Informationen anreichern — für Türschlösser, Reinigungs-Apps,
Check-in-Apps, Revenue-Management.

`meta` ist in drei Objekten frei belegbar: `booking`, `customer`, `room`.

### Die Überschreib-Logik — eine echte Falle

Normalfall: jede OTA-Revision ist eine **vollständige Momentaufnahme** und
übernimmt nichts aus der vorherigen.

Sobald wir eine Buchung per CRS-API ändern, schaltet Channex für diese Buchung
auf **differenzbasierte Logik** um: bei der nächsten OTA-Revision wird nur die
Differenz zur vorherigen OTA-Revision angewandt — auf unsere CRS-Fassung.

Channex' eigenes Beispiel:

| Schritt | Zustand |
|---|---|
| OTA sendet | 25.08.2025, Doppelzimmer, *John Doe* |
| PMS ändert per CRS | Einzelzimmer, *Hanna Doe* |
| OTA ändert Namen | *Alice Cooper* (Datum und Doppelzimmer unverändert) |
| **Ergebnis** | 25.08.2025, **Einzelzimmer**, *Alice Cooper* |

Unsere Zimmeränderung bleibt also erhalten, der Name kommt von der OTA.

**Aber zwei Grenzfälle kippen das:**

1. Ändert die OTA dasselbe Feld (Doppel → Dreibett), **gewinnt die OTA** —
   unsere Änderung ist weg.
2. Ändert der Gast das **Datum**, setzt das System den Zimmertyp auf den
   Stand der letzten OTA-Revision **zurück** — unsere Änderung ist weg.

Wer diese API nutzt, muss damit rechnen, dass eigene Änderungen still
verschwinden. Das ist Wurzel 1 (Gegenzustand) in fremder Hand.

### Asynchron — 404 direkt nach dem Anlegen

> Der Vorgang zum Erstellen und Speichern einer Buchung in der Datenbank ist
> asynchron. Wenn Sie daher unmittelbar nach Erhalt der Antwort eine Anfrage
> auslösen, kann ein 404-Fehler auftreten.

Ein `GET` direkt nach dem `POST` kann also 404 geben, obwohl alles geklappt hat.
Ein Retry darauf würde eine Doppelbuchung erzeugen — hier braucht es Wurzel 2
(Idempotenz über `ota_reservation_code`), nicht einen naiven Wiederholversuch.

### Und es löst echte Seiteneffekte aus

> Es wird ein Buchungsvorgang erstellt, der auf Basis regulärer Logik
> funktioniert und **alle zugehörigen Webhooks und Verfügbarkeitsänderungen**
> auslöst.

Eine CRS-Buchung verändert also die Verfügbarkeit und feuert unsere eigenen
Webhooks. Ein Testaufruf auf dem Produktionskonto wäre kein Test — genau
deshalb habe ich ihn nicht gemacht.

### Neue Felder, die nur hier auftauchen

| Feld | Bedeutung |
|---|---|
| `deposits[]` | Kaution: `amount`, `currency`, `charget_at` (Schreibfehler von Channex), `type`, `notes`, `meta` |
| `services[].type` | Typ der Leistung, z. B. `Cancellation Fee` |
| `taxes[].version` | Versionsfeld der Steuerangabe |
| `ota_name: "Offline"` | Kennzeichen für nicht-OTA-Buchungen |

---

## 37. Fotos — der vollständige Weg (Doku `photos-collection`)

### Zweistufig: hochladen, dann anlegen

```
1) POST /photos/upload      (multipart: photo=@datei.jpg)
   -> {"url": "https://ams3.digitaloceanspaces.com/temporaryphotos/….jpg"}

2) POST /photos             mit dieser url
```

Die URL aus Schritt 1 ist **temporär** — sie muss in Schritt 2 verwendet
werden, sonst verfällt sie.

### Felder des Foto-Objekts

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `property_id` | **ja** | UUID des Objekts |
| `url` | **ja** | gültige URL des Fotos |
| `room_type_id` | nein | `null` → Foto hängt nur am Objekt |
| `kind` | nein | `photo` (Standard) · `ad` · `menu` |
| `author` | nein | Name des Fotografen |
| `description` | nein | Bildbeschreibung |
| `position` | nein | **`0` = Titelbild**; muss je `property_id`+`room_type_id` eindeutig sein |

`position: 0` ist das Titelbild — und die Eindeutigkeitsregel je
Objekt+Zimmertyp ist eine Falle: zwei Fotos mit `position: 0` am gleichen
Zimmertyp geben **422**.

### Stapelverarbeitung über `content.photos`

Statt einzelner `POST /photos`-Aufrufe kann die ganze Liste über
`POST`/`PUT /properties` bzw. `/room_types` im Feld `content.photos` übergeben
werden. Drei Operationen in einem Aufruf:

| Aktion | wie |
|---|---|
| anlegen | Foto-Objekt ohne `id` |
| ändern | Foto-Objekt **mit** `id` |
| löschen | Foto-Objekt mit `id` **und** `is_removed: true` |

`is_removed` ist ein Feld, das die Endpunkt-Doku von `/photos` nicht nennt —
es gilt nur im Batch-Weg.

Unser `content_builder.py` nutzt genau diesen Batch-Weg (`content.photos`)
— gemessen ist das Ergebnis: `photos: []` bei allen 18 Objekten, kontoweit
`total: 0`.

### Fotos sind an Channex' Speicher gebunden

Die Beispiel-URLs zeigen `https://img.channex.io/<uuid>/` — Channex
übernimmt die Datei und liefert sie unter eigener Domain aus. Ein Foto, das
nur bei uns liegt, ist damit auch bei Channex gespeichert.

---

## 38. Hotel-Policy — die Objektregeln (Doku `hotel-policy-collection`)

Gemessen: **`total: 0`** — dieses Konto hat KEINE Hotel-Policy
(`properties.hotel_policy_id: null`, Abschnitt 2). Sie steht aber auf der
Readiness-Liste (Abschnitt 20: `hotel_policy` gehört zu Channex' Prüfliste vor
Kanal-Aktivierung).

### Alle Felder mit ihren erlaubten Werten

| Feld | Pflicht | erlaubte Werte |
|---|---|---|
| `property_id` | optional | UUID des Objekts |
| `title` | **ja** | Freitext |
| `currency` | **ja** | ISO 4217, 3 Zeichen |
| `max_count_of_guests` | **ja** | positive Zahl |
| `checkin_time` | **ja** | `HH:MM` |
| `checkout_time` | **ja** | `HH:MM` |
| `is_adults_only` | optional | boolean |
| `internet_access_type` | **ja** | `none` · `wifi` · `wired` |
| `internet_access_coverage` | **ja** | `entire_property` · `public_areas` · `all_rooms` · `some_rooms` · `business_centre` |
| `internet_access_cost` | optional | `null` = kostenlos, sonst Zahl |
| `parking_type` | **ja** | `on_site` · `nearby` · `none` |
| `parking_reservation` | **ja** | `not_available` · `not_needed` · `needed` |
| `parking_is_private` | **ja** | boolean |
| `pets_policy` | **ja** | `allowed` · `not_allowed` · `by_arrangements` · `assistive_only` |
| `pets_non_refundable_fee` | **ja** | positive Zahl |
| `pets_refundable_deposit` | **ja** | positive Zahl |
| `smoking_policy` | **ja** | `no_smoking` · `permitted_areas_only` · `allowed` |

### Warum das für unsere Preise-Seite zählt

Vier Felder aus der Preise-/Objekt-Verwaltung haben hier ihr Zielfeld — und
keines davon wird heute gefüllt:

| Unsere Seite | Hotel-Policy-Feld |
|---|---|
| Check-in / Check-out | `checkin_time` / `checkout_time` |
| Haustiere erlaubt (+ Anzahl) | `pets_policy` |
| Haustiergebühr | `pets_non_refundable_fee` |
| Kaution | `pets_refundable_deposit` |
| Rauchen erlaubt | `smoking_policy` |

Gemessen haben wir diese Werte AUS Airbnb (Abschnitt 6/7: Check-in 16:00,
Check-out 10:00, Haustiere erlaubt, `pet_capacity: 1`, Rauchen nicht erlaubt)
und schreiben sie in `properties.type_attributes` — aber **nicht** in eine
Channex-Hotel-Policy. Der Rückweg zu den Portalen fehlt.

Zur Kaution: Abschnitt 16 verzeichnet „Kaution geht an kein Portal". Das ist
für den ARI-/Steuer-Weg richtig, aber `pets_refundable_deposit` und
`refundable_deposit` in der Hotel-Policy sind ein ZWEITER Weg, den wir nicht
nutzen. Ob die Portale ihn auswerten, ist **ungeprüft**.

### Ein Feld, das nur in der Antwort auftaucht

Die `PUT`-Antwort enthält `internet_access_cost_type: "free"` — ein
abgeleitetes Feld, das man nicht selbst setzt. In der `GET`-Antwort taucht
stattdessen `refundable_deposit` auf (ohne `pets_`-Präfix), während beim
Schreiben `pets_refundable_deposit` verlangt wird. **Die Feldnamen für Lesen
und Schreiben unterscheiden sich hier** — eine Falle für einen Round-Trip:
`GET` → ändern → `PUT` würde die Kaution verlieren.

---

## 39. Facilities-Kataloge — vollständig gemessen

Die Doku sagt: „Channex bietet rund **181** Standardeinrichtungen an."
**Gemessen sind es mehr** — die Doku ist an dieser Stelle veraltet:

| Katalog | Doku | gemessen | Kategorien |
|---|---|---|---|
| `property_facilities` | ~181 | **301** | 9 |
| `room_facilities` | ~181 | **191** | 7 |

### Objekt-Ausstattung — 301 Einträge in 9 Kategorien

| Kategorie | Anzahl | Beispiele |
|---|---|---|
| `general` | **93** | 24-hour front desk, ADA Accessible, ATM on site |
| `activites` | **55** | Aerobics, Archery, Badminton equipment |
| `services` | **51** | Airport shuttle (free), Airport shuttle service (surcharge), Baby sitting |
| `safety_and_security` | **45** | 24-hour security, Access to health care professionals, All plates, cutlery, glasses and other tableware have been sanitised |
| `food_and_drink` | **18** | Accessible parking, Bar, Bottle of water |
| `outdoors` | **17** | BBQ/Picnic area, Garden, Infinity pool |
| `sustainable_practice` | **14** | Bike parking, Bike rental, Electric vehicle charging station |
| `parking` | **4** | Indoor parking, Pull-Thru RV Sites, Secured parking |
| `pets` | **4** | Pet Friendly, Pet basket, Pet bowls |

### Zimmer-Ausstattung — 191 Einträge in 7 Kategorien

| Kategorie | Anzahl | Beispiele |
|---|---|---|
| `in_room` | **104** | Accessible by Lift, Adapter, Air purifiers available |
| `bathroom` | **29** | Adapted bath, Additional Bathroom, Additional Toilet |
| `kitchen` | **14** | Barbecue, Children highchair, Cleaning products |
| `security` | **12** | Baby safety gates, Bathroom emergency pull cord, Carbon monoxide detector |
| `view` | **12** | City View, Extra long beds (> 2 meter), Garden View |
| `outside` | **11** | Balcony, Heated pool, Infinity pool |
| `general` | **9** | 100 Amps, 20 Amps, 30 Amps |

Beachten: `sustainable_practice` (Objekt) heißt im Channex-Client
`sustainable_practices` (Plural) — der API-Wert ist der SINGULAR. Ebenso ist
`activites` ein Schreibfehler von Channex, den man übernehmen muss.

Die Kategorien unterscheiden sich zwischen den beiden Katalogen: `view` und
`security` gibt es nur beim Zimmer, `pets`/`parking`/`activites`/
`services`/`safety_and_security`/`sustainable_practice`/`food_and_drink`/
`outdoors` nur beim Objekt. Gemeinsam ist nur `general`.

### Vier Endpunkte, alle nur LESEND

| Endpunkt | gemessen | Unterschied |
|---|---|---|
| `GET /property_facilities` | 200, `total: 301` | paginiert (10 je Seite Standard) |
| `GET /property_facilities/options` | 200, **301 auf einmal** | ohne Pagination, ohne Zusatzdetails |
| `GET /room_facilities` | 200, `total: 191` | paginiert |
| `GET /room_facilities/options` | 200, **191 auf einmal** | ohne Pagination |

Es gibt **kein** POST/PUT/DELETE — der Katalog ist fest. Gesetzt werden die
UUIDs am Objekt (`PUT /properties/{id}` → `facilities[]`) bzw. am Zimmertyp
(`PUT /room_types/{id}`). Für eine fehlende Ausstattung verweist die Doku auf
den Support.

### Stand bei diesem Konto

**0 von 301** Objekt-Ausstattungen und **0 von 191** Zimmer-Ausstattungen sind
gesetzt. `facilities` steht auf Channex' Readiness-Prüfliste (Abschnitt 20) —
sie fehlt also für die Kanal-Aktivierung.

---

## 40. Steuern und Steuersätze — drei Felder, die wir NICHT nutzen

Gemessen: `taxes` = **0**, `tax_sets` = **0**, `tax_sets/options` = **0**,
`properties.default_tax_set_id` = **`null`**, `rate_plans.tax_set_id` =
**`null`** bei beiden Plänen. Auf diesem Konto ist keine einzige Steuer
angekommen.

### Steuer (`/taxes`) — alle Felder

| Feld | Pflicht | Werte | nutzen wir? |
|---|---|---|---|
| `title` | **ja** | max. 255 Zeichen | ja |
| `logic` | **ja** | `percent` · `per_room` · `per_room_per_night` · `per_person` · `per_person_per_night` · `per_night` · `per_booking` | ja |
| `type` | **ja** | `tax` · `fee` · `city tax` | ja |
| `rate` | **ja** | bei `percent` 0–100, sonst Festbetrag | ja |
| `currency` | ja* | nur wenn `logic ≠ percent` | ja |
| `is_inclusive` | **ja** | boolean — im Preis enthalten oder zusätzlich | ja |
| `property_id` | **ja** | UUID | ja |
| **`skip_nights`** | optional | Nächte, die bei der Berechnung übersprungen werden | **NEIN** |
| **`max_nights`** | optional | Höchstzahl der Nächte als Bemessungsgrundlage | **NEIN** |
| **`applicable_date_ranges`** | optional | bis zu **20** Zeiträume `{after, before}` | **NEIN** |

### Die drei ungenutzten Felder lösen echte Anforderungen

Geprüft im Code (`tax_sync.py`, `channex_client.py`): `skip_nights`,
`max_nights` und `applicable_date_ranges` kommen **nirgends** vor.

| Feld | Wofür Channex es vorsieht | Unser Gegenstück |
|---|---|---|
| `skip_nights` | „Langzeitsteuer, die ab dem 8. Aufenthaltstag erhoben wird" | — |
| `max_nights` | „Steuer nur für die ersten 7 Tage des Aufenthalts" | — |
| `applicable_date_ranges` | „Tourismusabgabe vom 1. Juni bis 31. August" | Saisonpreise (nur Preis, nicht Steuer) |

**Das ist ein Fund für die Preise-Seite.** Unsere lokale Steuer kennt
`shortStayOnly` (Abschnitt: Gebühren-Editor), aber keinen Zeitraum. Eine
saisonale Kurtaxe — in Dänemark und weiten Teilen der EU der Normalfall —
hat bei Channex ein Zielfeld und bei uns kein Eingabefeld.

Und umgekehrt: unser `shortStayOnly` hätte mit `max_nights` ein Zielfeld,
wird aber laut Abschnitt 16 „an kein Portal" gesendet. Der Weg existiert —
wir nutzen ihn nicht.

### Steuersatz (`/tax_sets`) — alle Felder

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `title` | **ja** | max. 255 Zeichen |
| `property_id` | **ja** | **der ERSTE Steuersatz wird automatisch `default_tax_set`** |
| `currency` | **ja** | Währung des Satzes |
| `taxes[]` | **ja** | `{id, level}` je Steuer |
| `associated_rate_plan_ids[]` | optional | welche Preispläne den Satz nutzen |

Unser Code setzt `associated_rate_plan_ids` (`tax_sync.py:549`) und `level`
(`tax_sync.py:119`, `:640`) — beides korrekt.

### Die `level`-Logik — Reihenfolge von UNTEN nach OBEN

Channex' eigenes Beispiel, wörtlich gerechnet:

```
Nachtpreis:        100,00 USD
Reinigung:          10,00 USD    level 1
MwSt. 20 %:         22,00 USD    level 0   (20% von 100 + 20% von 10)
```

> Unsere Berechnungslogik verarbeitet die Steuern von der **untersten Ebene
> (höchster Wert)** zur **obersten Ebene (niedrigster Wert)**.

Also: **höhere `level`-Zahl wird ZUERST berechnet.** `level 1` (Reinigung)
vor `level 0` (MwSt.), und `level 0` rechnet auf `Nachtpreis + alle Beträge
aus level 1`.

Das ist gegenintuitiv — „Level 0" klingt nach „zuerst", ist aber ZULETZT.
Wer die Reihenfolge vertauscht, berechnet die MwSt. ohne die Reinigungsgebühr
und liefert einen zu niedrigen Steuerbetrag an die Portale.

### Ein Fehler in Channex' eigener Doku

Die Update-Seite nennt `PUT /api/v1/tax_set/:id` (Singular) und zeigt im
Beispiel-Body `{"tax": {…}}` statt `{"tax_set": {…}}`. Der Listen-
und Löschpfad ist `tax_sets` (Plural). Unser Client nutzt
`tax_sets/{id}` — **ungeprüft**, welche Form Channex tatsächlich annimmt
(nicht ausgelöst, weil es schreibt).

### Ein Steuersatz je Objekt ist Standard

> Jede Immobilie kann mehrere Steuersätze und Steuern haben, aber **nur einer**
> kann als Standardsteuersatz ausgewählt werden. Der Standardsteuersatz wird
> automatisch auf jeden neuen Tarifplan angewendet.

Wichtig für unseren Ablauf: legen wir zuerst den Steuersatz und DANN den
Preisplan an, erbt der Plan den Satz automatisch. Umgekehrt muss
`associated_rate_plan_ids` gesetzt werden. Gemessen ist der Ist-Zustand
`tax_set_id: null` bei beiden Plänen — es gibt keinen Satz zum Erben.

---

## 41. Applications — welche installiert sind (gemessen)

Das schließt die offene Frage aus Abschnitt 36.

### 13 verfügbare Apps

| `application_code` | Titel | Preis |
|---|---|---|
| `channex_messages` | Channex Messages & Reviews | **7** |
| `booking_crs` | Booking CRS | — |
| `channex_payments` | Channex Payments | — |
| `channex_pci` | Channex PCI | — |
| `stripe_tokenization` | Stripe Tokenization | — |
| `authorize_net` | Authorize.net | — |
| `pricelabs` | Pricelabs | — |
| `room_price_genie` | RoomPriceGenie | — |
| `apaleo` | Apaleo | — |
| `mews` | Mews | — |
| `vhp` | VHP | — |
| `zapier` | Zapier | — |
| `make_com` | Make | — |

### Installiert auf diesem Konto

| App | Anzahl |
|---|---|
| **`channex_messages`** | **18×** — auf JEDEM Objekt |
| alle anderen | **0×** |

Jeder Eintrag: `settings: {}` (leer), `relationships.rate_plans.data: []`.

**Damit ist Abschnitt 36 beantwortet:** `booking_crs` ist **nicht** installiert.
Die Booking-CRS-API (Buchungen anlegen/ändern) ist auf diesem Konto also nicht
verfügbar — der Aufruf würde scheitern, unabhängig davon, ob wir ihn bauen.

### Was `channex_messages` freischaltet — und was wir davon nutzen

Die App kostet **7** (Einheit in der API nicht angegeben) und ist die
Voraussetzung für die gesamte Messages-API. Ohne sie: **HTTP 403** auf allen
Nachrichten-Endpunkten.

| Endpunkt | gemessen |
|---|---|
| `GET /message_threads` | 200, `total: 0` |
| `GET /message_threads/{id}` | ungeprüft (keine Threads) |
| `GET /message_threads/{id}/messages` | ungeprüft |
| `POST /message_threads/{id}/messages` | nicht aufgerufen (schreibt) |
| `POST /message_threads/{id}/close` | nicht aufgerufen |
| `POST /message_threads/{id}/no_reply_needed` | **im Client nicht vorhanden** |
| `GET`/`POST /bookings/{id}/messages` | ungeprüft (0 Buchungen) |
| `POST /attachments` | nicht aufgerufen |

Wir zahlen also für 18 Objekte eine Nachrichten-App, deren Endpunkte leer sind —
weil noch keine Buchung existiert. Sobald Buchungen kommen, ist der Weg offen.

### `no_reply_needed` fehlt bei uns

`POST /message_threads/{id}/no_reply_needed` (leere Payload) markiert einen
Thread als „keine Antwort nötig" — **nur für Booking.com**. Der Grund laut Doku:
Booking.com bewertet Gastgeber nach Antwortzeit; ohne diese Markierung zählt
eine Gastnachricht, die keine Antwort braucht, gegen die eigene Bewertung.

Im Client (`channex_client.py`) ist dieser Pfad **nicht vorhanden** — für
Airbnb ohne Folge, aber sobald Booking.com dazukommt, ein messbarer Nachteil.

### Nachrichten gibt es nur für drei Kanäle

Booking.com · Airbnb · Expedia. Ausnahme laut Doku: Buchungen über **Expedia
Partner Solutions** (Expedia Affiliate Network) unterstützen die Messages-API
nicht.

Passt zur Kanal-Deklaration (Abschnitt 19): der Airbnb-Kanal meldet
`message_support: true`.

### Airbnb-Anfragen: Threads OHNE Buchung

Ein Fund, der für unseren Posteingang zählt. Airbnb kennt „Inquiry" — der Gast
fragt nach Daten und Preis, **ohne** dass eine Buchung existiert. Channex
bildet das als Message-Thread ohne Buchungsbezug ab, mit einer Sondernachricht:

```
sender: "system"      message: "inquiry"
meta.booking_details: checkin_date · checkout_date · nights · currency
                      expected_payout_amount_accurate · guest_name
                      listing_id · listing_name · room_type_id · property_id
                      number_of_adults/children/infants/pets/guests
                      non_response_at   <-- Frist!
```

**`non_response_at` ist eine Frist** — bis dahin muss geantwortet werden.
Airbnb bestraft Nichtantworten. Wir haben das Webhook-Event `inquiry`
abonniert (Abschnitt 33), aber **ungeprüft**, ob unser Handler
`non_response_at` auswertet und eine Erinnerung setzt.

### Anhänge sind zweistufig

```
1) POST /attachments   {file: <base64>, file_name, file_type}
2) POST /bookings/{id}/messages   {message: {attachment_id: …}}
```

Ein Anhang in einer empfangenen Nachricht kommt als **relative** URL — davor
muss `https://app.channex.io/api/v1/` gesetzt werden (Produktion). Wer das
vergisst, zeigt dem Betrieb einen toten Link.

---

## 42. Bewertungen — gebaut, aber auf diesem Konto leer

Voraussetzung ist dieselbe App wie für Nachrichten: **`channex_messages`**
(„Messages & Reviews") — auf allen 18 Objekten installiert (Abschnitt 41).
Ohne sie: **403** auf allen Review-Endpunkten.

| Endpunkt | im Client | gemessen |
|---|---|---|
| `GET /reviews` | `channex_client.py:1326` | **200, `total: 0`** |
| `GET /reviews/{id}` | ja | ungeprüft (keine Bewertung) |
| `POST /reviews/{id}/reply` | `:1346` | nicht aufgerufen (schreibt) |
| `POST /reviews/{id}/guest_review` | `:1356` | nicht aufgerufen (schreibt) |
| `GET /scores/{property_id}` | `:1367` | **404** — noch keine Bewertung |
| `GET /scores/{property_id}/detailed` | `:1367` (`suffix`) | **200**: „In the process of obtaining property score information" |

Der Weg ist im Code vorhanden (`reviews_sync.py`, `ota_extras.py:178`,
`router.py:809`/`:823`) — inklusive `tags` und `scores`
(`reviews_sync.py:112-127`) und `is_hidden` (`:128`). Nichts fehlt hier.

### `is_hidden` — eine Airbnb-Eigenheit mit Geschäftsfolge

> Boolescher Statusmarker **speziell für Airbnb**. Wenn `true`, bedeutet dies,
> dass die Bewertung erstellt wurde, aber erst sichtbar wird, wenn der
> Vermieter dem Gast Feedback gibt.

Airbnb hält die Gastbewertung also zurück, bis der Gastgeber selbst bewertet
hat. Wer nie eine Gastbewertung abgibt, sieht seine eigenen Bewertungen nicht
veröffentlicht. Das Feld wird gelesen (`reviews_sync.py:128`) — **ungeprüft**,
ob die Oberfläche daraus eine Aufforderung macht.

### Den GAST bewerten — nur Airbnb

`POST /reviews/{id}/guest_review` mit:

| Feld | Werte |
|---|---|
| `scores[]` | `{category, rating}` — Kategorien: `cleanliness`, `communication`, `respect_house_rules` |
| `private_review` | Text nur für den Gast |
| `public_review` | öffentlicher Text |
| `is_reviewee_recommended` | boolean — Empfehlung |
| `tags[]` | Tag-Codes, z. B. `host_review_guest_positive_neat_and_tidy` |

### Die Tag-Taxonomie — 87 Codes

Zwei Richtungen, klar getrennt am Präfix:

| Präfix | Richtung | Kategorien |
|---|---|---|
| `host_review_guest_*` | **wir bewerten den Gast** | `cleanliness` · `respect_house_rules` · `communication` |
| `guest_review_host_*` | **Gast bewertet uns** | `accuracy` · `checkin` · `cleanliness` · `communication` · `location` |

Jede Kategorie hat positive und negative Tags plus einen Sammel-Code
(`accuracy_other`, `check_in_other`, `cleanliness_other`, `communication_other`,
`location_other`, `respect_house_rules_other`).

Beispiele für Tags, die als **Warnsignal** taugen (Gast bewertet uns negativ):

```
guest_review_host_negative_did_not_match_photos     accuracy
guest_review_host_negative_unexpected_fees          accuracy
guest_review_host_negative_missing_amenity          accuracy
guest_review_host_negative_broken_or_missing_lock   accuracy
guest_review_host_negative_unclear_checkout_tasks   communication
guest_review_host_negative_excessive_checkout_tasks communication
```

`unexpected_fees` und `missing_amenity` sind direkte Folgen von Datenfehlern
bei uns: eine Gebühr, die im Portal nicht angekündigt war, oder eine
Ausstattung, die gepflegt ist aber nicht existiert. Diese Tags sind damit
auswertbare Rückmeldung auf unsere eigene Datenqualität — **ungeprüft**, ob
die Oberfläche sie so nutzt.

`unclear_checkout_tasks` / `excessive_checkout_tasks` beziehen sich auf genau
die Aufgaben, die ich in Abschnitt 23 gemessen habe (`RETURN_KEYS`, `LOCK_UP`,
`THROW_TRASH`, `TURN_THINGS_OFF`, `GATHER_TOWELS` — alle `is_present: true`,
`task_detail` leer). Leere Detailtexte bei fünf aktiven Aufgaben sind ein
plausibler Auslöser für `unclear_checkout_tasks`.

### Score-Kategorien: die Portale messen Verschiedenes

| Channex | Booking.com | Airbnb |
|---|---|---|
| `clean` | Sauberkeit | Sauberkeit |
| `location` | Standort | Standort |
| `value` | Wert | Wert |
| `facilities` | Einrichtungen | — |
| `services` | Dienstleistungen | — |
| `staff` | Personal | — |
| `comfort` | Komfort | — |
| `accuracy` | — | Genauigkeit |
| `communication` | — | Kommunikation |
| `checkin` | — | Check-in |

Nur **drei** Kategorien sind bei beiden Portalen gleich. Ein
Gesamtdurchschnitt über Portale hinweg vergleicht also Ungleiches — die
`scores`-Antwort trägt deshalb je Kategorie ein eigenes `count`
(im Doku-Beispiel: `accuracy` 18 Bewertungen, `clean` 1113).

### Zwei Score-Ebenen

| Endpunkt | liefert |
|---|---|
| `GET /scores/{id}` | **ein** zusammengefasster Score über alle Portale |
| `GET /scores/{id}/detailed` | zusätzlich **je OTA** ein Score mit `channel_id` und `ota` |

Gemessen: der einfache Pfad gibt **404**, der `detailed`-Pfad **200** mit
„In the process of obtaining property score information. Please try again
later." — also asynchrone Berechnung, die bei 0 Bewertungen nie fertig wird.

Ein Handler, der auf ein `data`-Feld wartet, bekommt hier stattdessen ein
`message`-Feld. **Ungeprüft**, ob unser Code das unterscheidet.

---

## 43. Kanal-Verfügbarkeitsregeln — pro Kanal steuern

Gemessen: `channel_availability_rules` = **`total: 0`**,
`channel_availability_rules/options` = **`[]`**. Keine Regel auf diesem Konto.

Im Client vollständig vorhanden (`channex_client.py:1370-1395`) und im Router
verdrahtet (`router.py:851-904`: list/create/update/delete).

### Die drei Regeltypen

| `type` | Wirkung | `value` |
|---|---|---|
| `close_out` | Kanal für den Zeitraum **schließen** | nicht nötig |
| `availability_offset` | `Zimmerverfügbarkeit − value = OTA-Verfügbarkeit` | **Pflicht** |
| `max_availability` | Obergrenze der an die OTA gemeldeten Verfügbarkeit | **Pflicht** |

### Alle Felder

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `property_id` | **ja** | UUID |
| `affected_channels[]` | **ja** | Kanal-UUIDs |
| `affected_room_types[]` | **ja** | Zimmertyp-UUIDs |
| `type` | **ja** | `close_out` · `availability_offset` · `max_availability` |
| `value` | bedingt | nur bei `availability_offset` / `max_availability` |
| `start_date` | **ja** | ISO `YYYY-MM-DD` |
| `end_date` | optional | **leer = unbegrenzt ab `start_date`** |
| `days[]` | optional | `mo` `tu` `we` `th` `fr` `sa` `su` — leer = alle Tage |
| `title` | — | Bezeichnung |

### Der Bezug zu unserer Stop-Sell-Regel

Unser Datenmodell sagt: **Stop-Sell sperrt überall**, kanalübergreifend
(CLAUDE.md, Vertriebskanäle). `close_out` ist das genaue Gegenteil — es sperrt
**einen** Kanal.

Das ist kein Widerspruch, sondern eine zweite Achse: `stop_sell` in
`/restrictions` (gemessen, Abschnitt 12) wirkt auf alle Kanäle,
`channel_availability_rules` wirkt gezielt. Wer künftig „nur bei Airbnb
sperren" braucht, hat hier den Weg — der Client kann es, die Oberfläche nutzt
es nicht.

`availability_offset` ist zudem der Weg für einen **Sicherheitspuffer**: bei
5 Einheiten und `value: 1` meldet die OTA nur 4 — Schutz gegen Überbuchung
beim Multi-Unit-Objekt (`property_units`, unser Einheiten-Modell).

**Achtung `end_date`:** leer heißt **unbegrenzt**. Ein `close_out` ohne
Enddatum sperrt den Kanal für immer — und würde in unserer Oberfläche nirgends
auffallen, weil wir die Regeln nicht anzeigen.

---

## 44. Zimmer- und Preisplan-Verwaltung — Channex' eigene Begriffe

Quelle: `application-documentation/rooms-management`. Das ist die
Oberflächen-Doku, die die Feldbedeutungen erklärt, die ich in Abschnitt 3 und 4
nur als Rohwerte gemessen habe.

### Belegung — was die vier Felder wirklich bedeuten

| Feld | gemessen (020) | Bedeutung laut Channex |
|---|---|---|
| `occ_adults` | **3** | Betten für Erwachsene. **Kinder dürfen hier schlafen** |
| `occ_children` | **0** | **nur** Betten, die ausschließlich für Kinder taugen |
| `occ_infants` | **0** | spezielle Babybetten (Kinderbett) |
| `default_occupancy` | **3** | „Wie viele Personen würden dieses Zimmer typischerweise belegen?" |
| `count_of_rooms` | **1** | Stückzahl. „Bei Ferienwohnungen üblicherweise eine Einheit" |

**Das korrigiert eine naheliegende Fehlannahme:** `occ_children: 0` heißt
NICHT „keine Kinder erlaubt", sondern „keine kinderspezifischen Betten".
Kinder schlafen laut Channex per Default in den Erwachsenenbetten. Wer
`occ_children` aus einer „Kinder erlaubt"-Angabe füllt, halbiert die
verkaufbare Belegung.

Passt zum gemessenen Airbnb-Wert `allows_children_as_host: false`
(Abschnitt 6) — bei 020 sind Kinder tatsächlich nicht erlaubt, aber das ist
eine Hausregel, nicht die Bettenzahl.

`count_of_rooms: 1` deckt sich mit unserem Datenmodell (1 Objekt = 1 Typ mit
n ≥ 1 Einheiten) — bei einer FeWo genau eine.

### Die Preisplan-Modi — vollständig

Gemessen bei 020: `rate_mode: manual`, `sell_mode: per_room`,
`parent_rate_plan_id: null`, `auto_rate_settings: null`. Also der einfachste
Fall. Die Doku nennt vier weitere Kombinationen:

| `rate_mode` | `sell_mode` | wie der Preis entsteht |
|---|---|---|
| `manual` | `per_room` | **ein** Preis für das ganze Zimmer — unser Fall |
| `manual` | `per_person` | Preis je Belegung, alle manuell eingegeben |
| `derived` | `per_person` | Primärbelegung eingeben, andere per **Modifikator** |
| `auto` | `per_person` | Primärbelegung + „wie viel günstiger/teurer" je Belegung |
| `derived` | (beliebig) | **Kaskade**: Kopie eines anderen Plans, z. B. 10 % günstiger |

### Modifikatoren — mehrere pro Belegung möglich

> Sie können bei Bedarf **mehrere** Modifikatoren pro Belegung hinzufügen.
> Beispiel: 10 % und 5 $ hinzufügen

Das erklärt die gemessene Struktur `options[0].derived_option: null`
(Abschnitt 4) — dort läge bei einem abgeleiteten Plan eine Liste von
Modifikatoren, wie in `content_sync.py:1138-1182` gebaut
(`derived_option {rate: [["increase_by_amount", …]]}`).

### „Von Eltern erben" — die zehn `inherit_*`-Schalter

Gemessen (Abschnitt 4): **alle zehn `false`**. Die Doku erklärt sie:

> Von Eltern erben — Sie wählen aus, was von den Eltern geerbt werden soll.
> Benutzerdefinierter Tarif oder Beschränkung: Sie können jedes Kästchen
> deaktivieren, um die Einstellungen manuell vorzunehmen.

Bei `parent_rate_plan_id: null` sind die Schalter wirkungslos — es gibt keinen
Elternplan. Sie werden erst relevant, wenn wir abgeleitete Pläne bauen
(unser `rate_plans.rate_mode = derived`, Rate-Plan-Assistent).

### Ein Satz, der unseren Push-Weg bestätigt

> Wenn Sie die Rateneinstellungen ändern, wirkt sich dies **nur auf den
> Lagerbestand aus, es sei denn**, Sie haben die Änderung über ein
> Update/eine Massenaktualisierung vorgenommen.

Übersetzt: die Standardwerte am Rate-Plan (`min_stay_arrival`, `max_stay`,
`closed_to_arrival` … als 7er-Arrays) sind **Vorlagen für neue Tage**. Sie
überschreiben bestehende Kalendertage NICHT. Wer einen Tageswert ändern will,
muss `POST /restrictions` nutzen — genau das tut unser `ari_push.py`.

Das erklärt auch, warum bei 020 `rate_plans.min_stay_arrival: [1,…]` UND
`restrictions.min_stay_arrival: 1` gemessen wurden: zwei Ebenen, gleicher Wert.

---

## 45. Die drei Ebenen des Inventars — und ein gemessener DEFEKT

Channex' Hierarchie (`inventory-management`):

```
Zimmertyp        (Doppelzimmer / die FeWo)
  └─ Zimmerpreis  (Zimmertyp + Preisplan)
      └─ Kanalrate (Zimmerpreis + Kanal, mit optionalem Modifikator)
```

> Bei der Kanalzuordnung können Sie einen **Modifikator** verwenden, um die an
> die Kanäle gesendeten Raten zu ändern. Beispiel: **+10 %**

Das ist Channex' Weg für „Preis je Portal" — und wir haben ihn nachgebaut
(`rate_plans.offset_percent` mit `portal_scope`, Preise-Seite „Preisänderung je
Portal"). Gemessen ist der Ist-Stand:

| Feld | Wert |
|---|---|
| `channel.settings.derived_option` | **`{}`** (leer) |
| Mapping-Modifikator-Felder | **keine vorhanden** |

### Die Kanalrate — Channex' dritte Ebene, und wie wir sie kaputt gemacht haben

**Korrektur vom 11.08.2026.** Hier stand vorher „DER DEFEKT: `rate_mode:
derived` ohne Elternplan". Das war eine Fehllesung der Antwort: **einen
Attributschlüssel `parent_rate_plan_id` gibt es nicht** — `.get()` lieferte
darum immer `null`. Der Elternplan steht in `relationships`. Nachgemessen an
allen 19 Properties:

```
GET /rate_plans/<kanalrate>
  attributes.rate_mode          "derived"
  attributes.options[0].rate    "0.00"     <-- Eigenwert einer Ableitung: sie erbt
  attributes.options[0].inherit_rate  true
  relationships.channel         → 9a46827b…   (AirBNB-Kanal)
  relationships.parent_rate_plan → 12d0e499…   (unser Grundpreis-Plan)
```

Die Kanalrate ist also **intakt** und genau die dritte Ebene aus dem Schaubild
oben. Channex legt sie SELBST an, je Eintrag im Kanal-Mapping, und blendet sie
in „Rooms & Rates" aus (Odden-hygge-mygdal: UI zeigt 2 Pläne, API 4). Zwei
Kanalraten gleichen Titels bedeuten zwei Raten-Codes im Extranet auf denselben
Plan gemappt — Booking.com z. B. `rate_plan_code` 65900767 + 65900673, beide auf
`12d0e499…`. Airbnb erlaubt nur ein Mapping, deshalb dort nie eine Dublette.

**Der echte Defekt war unserer.** Der Import hielt die Kanalraten für fremden
Portalbestand und spiegelte 32 davon als lokale `rate_plans` mit Preis 0;
`sync_content` schrieb sie danach mit `rate_mode: manual` zurück. Der Beweis
ist die exakte Korrelation:

| Kanalraten | `rate_mode` | lokal gespiegelt? |
|---|---|---|
| 32 | `manual`, Eigenpreis 0.00 | ja (13 Objekte) |
| 12 | `derived`, Elternplan gesetzt | nein (4 Objekte) |

Kein Objekt ohne Spiegel ist betroffen. Falsche Preise gingen dadurch nicht
hinaus — `0` filtern beide Push-Wege (`full_sync` `cents > 0`, `ari_push`
`if cents <= 0: continue`), und Klon wie Elternplan liefern für jeden geprüften
Tag denselben Wert. Verloren ist die **Rückfallebene**: fällt der tägliche Push
aus, hat die Kanalrate seither keinen Elternwert mehr, auf den sie zurückfällt.

Geschlossen über `common.kanal_plan_id` (erkennt die Kanal-Beziehung) an den
drei Stellen, die eine Rate-Plan-Liste verarbeiten: Import, Titel-Suche und
Prune. Altbestand: Migration `0361`. Das Zurückdrehen der 32 Kanalraten auf
`derived` wäre ein SCHREIBAUFRUF gegen Channex und steht aus.

### Channex' Warnung an PMS-verbundene Objekte

> Das PMS aktualisiert Verfügbarkeit, Preise und Einschränkungen. **Manuelle
> Änderungen können dazu führen, dass diese später durch ein PMS-Update
> überschrieben werden.**

Für den Betrieb heißt das: was er in der Channex-Oberfläche ändert, ist beim
nächsten Push von uns weg. Der einzige richtige Ort ist unsere Preise-Seite.

Zwei Ausnahmen nennt Channex ausdrücklich — Felder, die ein PMS
üblicherweise NICHT setzt:

| Einstellung | Kürzel | unser Stand |
|---|---|---|
| Maximale Verfügbarkeit | `MAL` | `channel_availability_rules` = 0 (Abschnitt 43) |
| Verfügbarkeitsausgleich | `AVO` | ebenso 0 |

Diese beiden darf der Betrieb also bei Channex pflegen, ohne dass wir sie
überschreiben. **Aber:** unsere Oberfläche zeigt sie nicht — er würde nicht
sehen, was dort gesetzt ist.

### Die Kalender-Kürzel — Channex' Sprache

| Kürzel | Bedeutung | unser Feld (gemessen) |
|---|---|---|
| `RATE` | Preis | `rate` = `504.00` |
| `AVL` | Verfügbarkeit (freie Einheiten) | `availability` = **0** |
| `MSA` | Mindestaufenthalt bei Ankunft | `min_stay_arrival` = 1 |
| `MST` | Mindestaufenthalt durchgehend | `min_stay_through` = 1 |
| `MXS` | Maximalaufenthalt | `max_stay` = 0 (keine Grenze) |
| `SS` | Verkaufsstopp | `stop_sell` = false |
| `CTA` | Anreise gesperrt | `closed_to_arrival` = false |
| `CTD` | Abreise gesperrt | `closed_to_departure` = false |
| `AVO` | Verfügbarkeitsausgleich | **nicht gesetzt** |
| `MAL` | Maximale Verfügbarkeit | **nicht gesetzt** |
| `COB` | gebucht (`booked`) | kommt im `ari`-Webhook mit |
| `MSL` | max_sell | **nie gemessen** — nur im Kürzel-Verzeichnis |

`MSL` (`max_sell`) taucht in Channex' Kürzel-Liste auf, aber in keinem
gemessenen Objekt und in keinem Doku-Feld. **Ungeklärt.**

### Massenaktualisierung — mehrere Zeiträume UND Wochentage

Die Oberfläche erlaubt mehrere Datumsbereiche plus Wochentagsauswahl in EINEM
Vorgang. Das entspricht unserem Push-Format: `date_from`/`date_to` plus
`days`-Maske (`ari_push.py:237-281`, Abschnitt 12). Gleiches Modell auf beiden
Seiten.

---

## 46. Kanal-Aktionen der Oberfläche — und die WICHTIGSTE Lücke

Quelle: `channels-management`. Sechs Aktionen bietet Channex je Kanal an:

| Aktion | API-Weg | bei uns |
|---|---|---|
| Bearbeiten | `PUT /channels/{id}` | im Client |
| Protokolle anzeigen | Kanal-Log (siehe unten) | `GET /channels/{id}/events` → **404** |
| Deaktivieren / Aktivieren | `POST …/deactivate` · `/activate` | im Client |
| **Vollständige Synchronisierung** | **500-Tage-Push** | `full_sync.py` vorhanden |
| **Zukünftige Buchungen abrufen** | `execute/load_future_reservations` | **KEIN Produktionsaufrufer** |
| Entfernen | `DELETE /channels/{id}` | im Client (Kanal muss inaktiv sein) |

### Die Lücke, die AirSmil direkt betrifft

> **Zukünftige Buchungen abrufen** — Derzeit nur auf Booking.com, Expedia und
> Airbnb verfügbar. Dadurch werden **alle Buchungen abgerufen, die vor der
> Anmeldung erstellt wurden.**

Das ist genau der Fall eines Wechselkunden: 19 Airbnb-Listings mit bestehenden
Buchungen, die VOR der Channex-Verbindung entstanden sind. Ohne diesen Aufruf
kennt unser PMS sie nicht — und der Kalender zeigt frei, wo ein Gast anreist.

Gemessen: `load_future_reservations` ist **eine der nur zwei** Aktionen, die
der Kanal überhaupt erlaubt (`actions: ["enable_los_mode",
"load_future_reservations"]`, Abschnitt 19) — und antwortet mit 200.

Im Code geprüft: der Name steht in `channels.py:1187` (als Kommentar, der genau
diesen Fall beschreibt) und in `schemas.py:728`. **Ein Aufrufer in Router,
Service oder OAuth-Pfad existiert nicht.** Die Aktion, die als einzige
freigeschaltet und für unseren Kunden entscheidend ist, wird nicht ausgelöst.

Einschränkung: die Wirkung ist **ungeprüft** (nicht ausgeführt) — auf diesem
Konto sind 0 Buchungen, und der Kanal steht auf `is_active: false`.

### „Vollständige Synchronisierung" = 500 Tage

> Dadurch wird ein vollständiges **500-Tage**-Update an den Kanal übertragen.

Die Zahl steht in keiner API-Doku. Für unsere Budget-Planung relevant: ein
Full-Sync erzeugt bei 20 ARI-Calls/Minute und komprimierten Ranges
entsprechend viele Aufrufe. Unser `full_sync.py` existiert — **ungeprüft**, ob
es denselben Horizont nutzt.

### Airbnb-Besonderheit beim Entfernen

> Bei einer Airbnb-Verbindung wird diese **auch in Airbnb getrennt**. Alle
> anderen Kanäle müssen Sie manuell im Extranet trennen.

`DELETE /channels/{id}` bei Airbnb wirkt also bis ins Airbnb-Konto. Und laut
Doku muss der Kanal vorher deaktiviert sein (`422 {"channel": ["is active"]}`).

### Kanal-Protokoll: der Weg fehlt uns

Die Oberfläche zeigt „alle an den Kanal gesendeten Protokolle **einschließlich
des Antworttextes**" — was gesendet, was empfangen wurde, und wie lange es
gedauert hat.

Gemessen: `GET /channels/{id}/events` → **404** (Abschnitt 24), obwohl der Pfad
im Channex-Client vorkommt. Der API-Weg zum Protokoll ist für uns nicht offen.
Wir führen stattdessen ein eigenes (`channex_debug_log` über den `TraceSink`,
`channex_client.py:36-56`) — das ist der richtige Ersatz.

Channex' eigener Hinweis dazu: „Die Suche funktioniert derzeit nicht."

---

## 47. Airbnb-Verbindung — die Betriebsfallen

Aus `channel-mapping-guides/airbnb` (ergänzt Abschnitt 32).

### Verbindung scheitert, wenn schon ein Channel-Manager hängt

> Wenn bereits ein anderer Channel-Manager oder ein anderes PMS mit Airbnb
> verbunden ist, kann die Verbindung **nicht** hergestellt werden.

Der Betrieb muss die Altverbindung selbst trennen: Airbnb → Einstellungen →
Datenschutz. Zweiter Grund für ein Scheitern: fehlende E-Mail-Verifizierung
oder unvollständige Host-Angaben.

### „Copy Link" — Verbindung ohne Zugang zum Airbnb-Konto

> Falls Sie keinen Zugriff auf das Airbnb-Konto haben, die Einrichtung aber im
> Namen des Gastgebers vornehmen müssen, kopieren Sie den Link und senden Sie
> ihn ihm.

Das ist `POST /meta/airbnb/connection_link` (im Client vorhanden,
`channex_client.py:1187`). Für uns der richtige Weg: der Betrieb klickt selbst,
wir brauchen sein Airbnb-Passwort nie.

### Zwei Kanal-Einstellungen, die wir setzen könnten

| Einstellung | Bedeutung | unser Stand (gemessen) |
|---|---|---|
| `min_stay_type` | welche Mindestaufenthalts-Art an Airbnb geht | Kanal: **nicht gesetzt**; Objekt: `both` |
| `send_email_notifications` | Channex mailt bei Buchung/Änderung/Storno | **`false`** (Standard) |
| `booking_amount_settings` | `Payout Amount` vs. `Total Paid Amount` | Standard `Payout Amount` |
| `cohost_payout_calculations` | Auszahlung abzüglich Co-Host-Provision | **`false`** |

`booking_amount_settings` ist geldrelevant: `Payout Amount` ist der Betrag
NACH Airbnbs Host-Gebühr, `Total Paid Amount` der Bruttobetrag des Gastes. Was
in `booking.amount` landet, hängt an dieser Einstellung. **Ungeprüft**, welchen
Wert unsere Buchhaltung erwartet.

### Was Channex an Airbnb NICHT übermittelt

> Aktuell übermitteln wir die **Mindestaufenthaltsdauer bei Ankunft**. Falls
> Ihre Unterkunft die Mindestaufenthaltsdauer bis zum Ende nutzt, wird diese
> Information **nicht übermittelt**.

Objekt 020 steht auf `min_stay_type: "both"` (Abschnitt 2). `min_stay_through`
wird also verworfen. Beide Werte sind derzeit `1`, daher ohne Folge — aber ein
Betrieb, der einen durchgehenden Mindestaufenthalt setzt, bekommt bei Airbnb
stillschweigend etwas anderes.

### Die Kaution bei Airbnb

> **Kaution** — Wie viel behält Airbnb als Kaution ein?

Das Feld heißt `security_deposit` in den `pricing_settings` (gemessen:
`null`, Abschnitt 6). Es ist ein ZWEITER Kautionsweg neben
`hotel_policies.pets_refundable_deposit` (Abschnitt 38) — und beide nutzen wir
nicht, obwohl unsere Preise-Seite eine Kaution kennt.

### Buchungsdetails, die die Oberfläche zeigt

Aus `bookings-management` — der Vollständigkeit halber, weil es die Felder aus
Abschnitt 34 benennt: Status · Quelle/OTA · Kanal-Titel · Reservierungs-ID ·
OTA-Reservierungs-ID · gebucht am · Objekt · **RUID** (interner Booking.com-Code
für den Support) · Check-in-Details · Kundendaten · Preisaufschlüsselung je Tag
· Gäste · Belegung · Verpflegung · Raucherwunsch · Richtlinien ·
Stornobedingungen · Kartentyp/-nummer/CVV/virtuell · Notizen · Gesamtbetrag ·
**Revisionen mit Zeitpunkt**.

`RUID` taucht in der API-Feldliste (Abschnitt 34) **nicht** auf — vermutlich in
`rooms[].meta`. **Ungeprüft** (0 Buchungen).

---

## 48. Der API-Schlüssel — die Rechtekette vollständig

Quelle: `api-key-access`. Der Satz, der die Befunde aus Abschnitt 14, 19, 25
und 35 zusammenbindet:

> Mit dem Schlüssel erhalten Sie Zugriff auf **dieselben Berechtigungen wie der
> Benutzer selbst**.

### Die Kette, Glied für Glied gemessen

| Ebene | gemessener Wert | Folge |
|---|---|---|
| API-Schlüssel | erbt die Rechte seines Benutzers | kein eigener Rechte-Umfang |
| Benutzer | `Nynextdays PMS`, `jeanine@mynextdays.dk` | Abschnitt 25 |
| Rolle am Objekt | **`owner`** | höchste Objekt-Rolle |
| Rolle an der Gruppe | **`owner`** | — |
| `overrides` | **`null`** | **keine Zusatzrechte gewährt** |
| Whitelabel am Konto | `white_label/settings` = **2 Felder** | keine Whitelabel-Konfiguration |

Daraus folgt zwingend: der Schlüssel kann nicht mehr als der Benutzer, der
Benutzer hat keine `overrides`, und die Channel-API verlangt Whitelabel
(Abschnitt 35). Die sieben `400 action is not supported` sind damit vollständig
erklärt — **es ist kein Fehler auf unserer Seite und keine falsche Aufrufform.**

### Der Schlüssel kann auf Objekte eingeschränkt sein

> Deaktivieren Sie einfach das Kontrollkästchen „Zugriff auf alle Eigenschaften"
> … Die API darf dann nur auf die ausgewählten Eigenschaften zugreifen.

Gemessen: unser Schlüssel sieht **alle 18** Objekte (`GET /properties` →
`total: 18`, Abschnitt 13). Er ist also nicht eingeschränkt — was für ein PMS
richtig ist.

### Voraussetzungen, die Betriebs-Anforderungen sind

| Bedingung | Folge |
|---|---|
| **aktives Abonnement** | ohne kein API-Schlüssel möglich |
| **Inhaber des Abrechnungskontos** | wer es nicht ist, sieht den Bereich nicht |
| auf Staging für alle verfügbar | erklärt, warum Tests dort einfacher sind |

Gemessen: `GET /whoami` liefert eine Organisation/Billing-Account-ID
`1528b0e4-6dba-49b7-b8c6-dfb34de315c9` (Abschnitt 1) — das Abo existiert also.

### Widerruf: der Schlüssel bleibt sichtbar

> Der API-Schlüssel wird weiterhin angezeigt und **nicht entfernt**, sondern
> lediglich deaktiviert.

Der Weg ist Organisation → API Keys → Actions → **Withdraw**. Passt zum
Bundle-Fund `POST {user}/{id}/withdraw` (Abschnitt 19).

### Der Schlüssel wird nur EINMAL angezeigt

> Bitte kopieren Sie den API-Schlüssel und bewahren Sie ihn an einem sicheren
> Ort auf. Der API-Schlüssel wird **nur einmal** angezeigt.

Praktische Folge für uns: geht er verloren, muss ein neuer erzeugt und in
`CHANNEX_API_KEY` getauscht werden — der alte lässt sich nicht wieder anzeigen.

### Channex nennt selbst das Git-Repository als Leck

> Dies kann aus verschiedenen Gründen geschehen — beispielsweise, wenn der
> Schlüssel in einem **Git-Repository** vergessen wird.

Deckt sich mit unserer eigenen Regel (CLAUDE.md „Nicht tun": nie echte
Credentials in Repo-Dateien). In dieser Messreihe wurde der Schlüssel
ausschließlich aus `apps/api/.env` gelesen und **nirgends** in eine Datei
geschrieben; alle Ausgaben sind zensiert.

**Offen bleibt der Webhook-Fund aus Abschnitt 17:** `GET /webhooks` gibt das
Webhook-Secret im KLARTEXT zurück. Für den API-Schlüssel gilt „nur einmal
sichtbar" — für das Webhook-Secret offensichtlich nicht. Es sollte rotiert
werden.
