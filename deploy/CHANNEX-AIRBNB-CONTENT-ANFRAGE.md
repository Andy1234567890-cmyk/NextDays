# Anfrage an Channex: Airbnb-Listing-Content lesen

Stand 04.08.2026. Alle Messwerte gegen **Produktion** (`app.channex.io/api/v1`),
nicht Staging. Kanal `9a46827b-7b6a-4be2-bbd6-611794f785fb` (AirBNB),
Airbnb-Host-ID 529591717, 18 Listings gemappt.

Jeder Aufruf wurde gegen einen **erfundenen Kontrollnamen** gegengeprüft — der
`execute`-Namensraum antwortet auf JEDEN Namen mit 200 `{"meta":{"message":
"Success"}}`, auch auf `voelliger_unsinn_xyz123`. Ohne Kontrolltest wäre jedes
200 ein Scheinfund. Nur Antworten MIT Daten zählen als Beweis.

---

## Mailtext (Englisch)

Betreff: `Reading Airbnb listing content (photos, description, amenities) via API`

Hi Evan,

we're a PMS integrating with Channex, and we have a customer onboarding
question I can't resolve from the docs or from probing the API.

**Context:** our customer has 19 live Airbnb listings and is switching to our
PMS. His Airbnb channel is connected and authorised (host ID 529591717), and 18
listings are mapped successfully. Rates, availability rules and booking settings
come through perfectly via `POST /channels/{id}/mappings` — that response carries
`pricing_setting`, `availability_rule` and `booking_setting`, which is exactly
what we needed. Thank you for that.

**What we can't find:** a way to READ the listing content — photos,
descriptions, amenities and the property street address. The goal is that the
customer doesn't have to retype anything that already exists on Airbnb.

Here's what we measured against production (`app.channex.io/api/v1`), each
verified against a deliberately invalid control name so we don't mistake a
generic 200 for a real endpoint:

| Attempt | Result |
|---|---|
| `GET /channels/{id}/action/all_listings` | `400 "action is not supported"` |
| `GET /channels/{id}/action/amenities` | `400 "action is not supported"` |
| `GET /channels/{id}/action/get_pricing_settings?listing_id=…` | `400 "action is not supported"` |
| `POST /channels/{id}/proxy/v2/listing_photos?listing_id=…` | `500 internal_server_error` |
| `POST /channels/{id}/proxy/v2/listings/{listing_id}` | `500 internal_server_error` |
| `POST /channels/mapping_details` | `200`, but only 8 fields per listing |
| `POST /meta/airbnb/{id}/full_sync_listing` | `200 Success`, no content added |
| `GET /properties/{id}` → `content` | `{description: null, photos: [], important_information: null}` for all 18 |
| `GET /photos` (account-wide) | `total: 0` |

`mapping_details` returns exactly these fields per listing: `id`, `title`,
`type`, `city`, `country_code`, `occupancies`, `quality_status`,
`synchronization_category`. No photos, no description, no amenities, no street
address.

The channel object itself reports:

```json
"actions": ["enable_los_mode", "load_future_reservations"]
```

Meanwhile the Channex web client calls `action/all_listings`,
`action/amenities`, `action/get_pricing_settings` and `action/update_listing`.
So those actions clearly exist on your side — I just can't tell from the
outside whether they're gated per account, gated per channel tier, or simply
belong to a different channel type.

**My questions:**

1. Is there any supported way to read Airbnb listing content (photos,
   descriptions, amenities, street address) through the Channex API?
2. If those `action/*` endpoints are the right path — how do we get them
   enabled for our API channel? Is that an account setting, a Whitelabel tier,
   or not available to PMS integrations at all?
3. Is `POST /channels/{id}/proxy/*path` meant to work for Airbnb channels? Every
   path we try returns 500, including a deliberately invalid one, which suggests
   the proxy isn't wired up for this channel type rather than us using wrong
   paths.
4. If content genuinely can't be read: is that a permanent design decision
   (content is push-only towards Airbnb), or is it on the roadmap? That answer
   determines whether we build a different import route for our customers.

I'd rather ask than keep guessing — happy to give you the channel ID and a
timestamp window if you want to look at the request logs on your side.

Thanks a lot,
Andy

---

## Was wir NICHT schreiben und warum

- **Keine API-Keys, Tokens oder Listing-IDs des Kunden** außer der Host-ID, die
  er selbst kennt. Der Kanal wird über die Kanal-ID identifiziert, nicht über
  Zugangsdaten.
- **Keine Behauptung „euer Proxy ist kaputt"** — der Kontrolltest zeigt nur,
  dass er bei DIESEM Kanaltyp nichts durchreicht. Warum, weiß Channex.
- **Keine Forderung.** Frage 4 ist die entscheidende: bei einem klaren „geht
  nicht" bauen wir den Weg über die Airbnb-Datenauskunft, statt zu warten.

## Was am eigenen Code offen bleibt (unabhängig von der Antwort)

- `listing_expectations_for_guests`, `airbnb_configured_taxes`,
  `pass_through_taxes`, `guest_fee_percent`, `host_fee_percent`,
  `allows_infants_as_host` liegen in der Mapping-Antwort und werden noch nicht
  ausgelesen.
- Alle 18 Channex-Properties tragen die FIRMENADRESSE (Hirtshalsvej 21, 9881)
  statt der Hausadresse. Der Import-Fix verhindert nur das Zurücklesen; bei
  Channex steht sie weiter und geht so an die Portale.
