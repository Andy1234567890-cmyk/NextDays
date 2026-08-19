# Channex-Support-Anfrage: `is_inclusive: true` bei exklusiv gepflegten Gebühren

Stand 19.08.2026. Zwei Fassungen desselben Sachverhalts — die englische ist die,
die abgeschickt wird.

---

## Deutsche Fassung

**Betreff:** Booking.com-Buchungen melden `rooms[].taxes[].is_inclusive: true`,
obwohl die Gebühr bei Channex als exklusiv angelegt ist

Guten Tag,

bei drei unserer Objekte melden Booking.com-Buchungen Gebühren mit
`is_inclusive: true` zurück, obwohl dieselben Gebühren bei Ihnen als
`is_inclusive: false` (exklusiv) angelegt sind und auch im Booking.com-Extranet
als „nicht im Preis enthalten" gepflegt sind. Bei fünfzehn weiteren Objekten
desselben Kontos funktioniert es korrekt.

**Betroffene Objekte**

| Objekt | Channex Property ID | Booking hotel_id |
|---|---|---|
| Feriehus Line | `b02f3d49-568a-40a5-bbaa-8eb1c2273d11` | 11659051 |
| Feriehus Britt | `30067a82-018f-41d7-a39a-ad85288a1ce7` | 9769544 |
| FeWo Lille Lægehus | `f86cb4d8-2b31-4efd-ab4a-29b5d912bd13` | 13840500 |

**Was wir an Sie senden**

Alle unsere Gebühren-Objekte stehen auf `is_inclusive: false`. Beispiel
Feriehus Line, `GET /taxes/c9250f36-22bb-4a11-8be2-67f5659361a3`:

```json
{
  "title": "Reinigungsgebühr",
  "type": "fee",
  "logic": "per_booking",
  "rate": "1275.00",
  "currency": "DKK",
  "is_inclusive": false
}
```

Das Tax-Set `4f9d77de-f4e2-4696-a760-778cf46a27ac` hängt am Rate-Plan
`12d0e499-9047-464f-a623-77107ccea33c`, über den der Kanal auch tatsächlich
verkauft.

**Was zurückkommt**

Buchung `BDC-6514454721` (Booking ID `3c653fa2-e274-4961-b39d-12cc5dc6b288`),
Feriehus Line:

```json
"taxes": [
  { "name": "Resort fee",   "total_price": "125.00",  "is_inclusive": true },
  { "name": "Cleaning fee", "total_price": "1275.00", "is_inclusive": true }
]
```

**Der aussagekräftigste Fall**

Buchung `5916893468`, FeWo Lille Lægehus — drei Gebühren aus **demselben**
Tax-Set, in **derselben** Buchung, mit unterschiedlichem Ergebnis:

| Gebühr | in `meta.charge_periods` | `is_inclusive` |
|---|---|---|
| Haustiergebühr | ja (`PETFEE`) | `false` — korrekt |
| Reinigungsgebühr | nein | `true` — falsch |
| Resortgebühr | nein | `true` — falsch |

Alle drei wurden von uns identisch mit `is_inclusive: false` angelegt. Ein Fehler
auf unserer Seite könnte drei Posten desselben Sets nicht unterschiedlich
behandeln.

**Was wir gemessen haben**

Über 36 Gebührenposten aus Live-Buchungen (ohne importierte Buchungen)
korreliert `rooms[0].meta.charge_periods.<CODE>.excluded` ausnahmslos mit
`is_inclusive`:

| `charge_periods.excluded` | resultierendes `is_inclusive` | Fälle |
|---|---|---|
| `true` | `false` — korrekt | 24 |
| `false` | `true` — falsch | 10 |
| Eintrag fehlt | `true` — falsch | 2 |

Auffällig dabei: Bei den acht Objekten, die korrekt arbeiten, ist
`settings.tax_settings.room_charges` je Zimmertyp gefüllt. Bei den drei
betroffenen Objekten ist es leer (`{}`), während `property_charges` gesetzt ist.

**Unsere Fragen**

1. Wie leiten Sie `rooms[].taxes[].is_inclusive` her? Aus unserem Tax-Set oder
   aus `tax_settings` des Kanals?
2. Wodurch entsteht `settings.tax_settings.room_charges`, und warum ist es bei
   manchen Kanälen desselben Kontos gefüllt und bei anderen leer?
3. Ihr Changelog vom 17.06.2026 nennt „Fix tax inclusion resolution for
   identically named Booking.com charge codes". Betrifft das unseren Fall — also
   eine Gebühr, die sowohl im Booking-Extranet als auch in unserem Tax-Set
   existiert?
4. Können wir `tax_settings` selbst setzen? Im Adapter-Katalog
   (`GET /channels/adapter?code=booking`) taucht das Feld nicht als Parameter
   auf.
5. Gibt es einen Weg, die Übernahme der Gebührenkonfiguration aus dem
   Booking-Extranet neu anzustoßen?

Über einen Hinweis, wie wir die drei Objekte in Ordnung bringen, freuen wir uns.

Mit freundlichen Grüßen

---

## English version

**Subject:** Booking.com reservations return `rooms[].taxes[].is_inclusive: true`
although the fee is configured as exclusive in Channex

Hello,

for three of our properties, Booking.com reservations come back with fees marked
`is_inclusive: true`, even though those same fees are configured as
`is_inclusive: false` (exclusive) in Channex and are set to "not included in the
price" in the Booking.com extranet. Fifteen other properties on the same account
behave correctly.

**Affected properties**

| Property | Channex property ID | Booking hotel_id |
|---|---|---|
| Feriehus Line | `b02f3d49-568a-40a5-bbaa-8eb1c2273d11` | 11659051 |
| Feriehus Britt | `30067a82-018f-41d7-a39a-ad85288a1ce7` | 9769544 |
| FeWo Lille Lægehus | `f86cb4d8-2b31-4efd-ab4a-29b5d912bd13` | 13840500 |

**What we send**

All of our fee objects are set to `is_inclusive: false`. Example for Feriehus
Line, `GET /taxes/c9250f36-22bb-4a11-8be2-67f5659361a3`:

```json
{
  "title": "Reinigungsgebühr",
  "type": "fee",
  "logic": "per_booking",
  "rate": "1275.00",
  "currency": "DKK",
  "is_inclusive": false
}
```

Tax set `4f9d77de-f4e2-4696-a760-778cf46a27ac` is attached to rate plan
`12d0e499-9047-464f-a623-77107ccea33c`, which is the plan the channel actually
sells through.

**What we receive**

Reservation `BDC-6514454721` (booking ID `3c653fa2-e274-4961-b39d-12cc5dc6b288`),
Feriehus Line:

```json
"taxes": [
  { "name": "Resort fee",   "total_price": "125.00",  "is_inclusive": true },
  { "name": "Cleaning fee", "total_price": "1275.00", "is_inclusive": true }
]
```

**The most telling case**

Reservation `5916893468`, FeWo Lille Lægehus — three fees from the **same** tax
set, in the **same** reservation, with different outcomes:

| Fee | present in `meta.charge_periods` | `is_inclusive` |
|---|---|---|
| Haustiergebühr (pet fee) | yes (`PETFEE`) | `false` — correct |
| Reinigungsgebühr (cleaning) | no | `true` — wrong |
| Resortgebühr (resort) | no | `true` — wrong |

All three were created by us identically with `is_inclusive: false`. An error on
our side could not treat three items of the same set differently.

**What we measured**

Across 36 fee items from live reservations (excluding imported bookings),
`rooms[0].meta.charge_periods.<CODE>.excluded` correlates with `is_inclusive`
without exception:

| `charge_periods.excluded` | resulting `is_inclusive` | cases |
|---|---|---|
| `true` | `false` — correct | 24 |
| `false` | `true` — wrong | 10 |
| entry missing | `true` — wrong | 2 |

One observation: the eight properties that work correctly have
`settings.tax_settings.room_charges` populated per room type. The three affected
properties have it empty (`{}`) while `property_charges` is set.

**Our questions**

1. How do you derive `rooms[].taxes[].is_inclusive` — from our tax set, or from
   the channel's `tax_settings`?
2. What causes `settings.tax_settings.room_charges` to be populated, and why is
   it filled for some channels on the same account and empty for others?
3. Your changelog entry from 17 June 2026 mentions "Fix tax inclusion resolution
   for identically named Booking.com charge codes". Does that apply to our case —
   a fee that exists both in the Booking extranet and in our tax set?
4. Can we set `tax_settings` ourselves? The field does not appear as a parameter
   in the adapter catalogue (`GET /channels/adapter?code=booking`).
5. Is there a way to trigger a re-import of the fee configuration from the
   Booking.com extranet?

Any guidance on how to bring these three properties in line would be much
appreciated.

Kind regards
