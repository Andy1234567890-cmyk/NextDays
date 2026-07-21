# Booking.com Typ-Kataloge (BCRT + PCT)

Referenz der offiziellen Booking.com-Codelisten, die ein Betrieb beim Anlegen
seiner Unterkunft/Zimmer braucht. **Zwei getrennte Ebenen** — nicht verwechseln:

- **BCRT** (Booking.com Room Type Codes) = der **Zimmertyp** / die buchbare
  Einheit (Single, Double, Suite, Apartment …). Relevant für den Channel-Manager
  (Zimmer-Mapping beim Verbinden).
- **PCT** (Property Class Type Codes) = die **Unterkunftsart** / das ganze Objekt
  (Hotel, Guesthouse, Riad, Lodge …). Relevant beim Anlegen des Betriebs/Property.

Quellen (offiziell, mehrfach verifiziert):
- BCRT: <https://developers.booking.com/connectivity/docs/codes-bcrt> (3-fach
  gegengeprüft: offizielle Doku + Guesty-Enum + SiteMinder)
- PCT: <https://developers.booking.com/connectivity/docs/codes-pct>

Wichtig: BCRT-Codes werden **nicht** am generischen Channex-Room-Type gesetzt
(das `codes`-Feld ist undokumentiert/read-only), sondern beim **Channel-Mapping**
(`POST /channels`, `rate_plans[].settings.room_type_code`). Unser Verbinden-Flow
macht genau das und schlägt den passenden Zimmertyp aus `property_type` vor
(Mapping siehe unten, `channel_manager/common.py._BOOKING_ROOM_TYPE`).

---

## BCRT — Zimmertypen (18 aktive Codes)

### Hotelzimmer
| Code | Zimmertyp | Bedeutung |
|---|---|---|
| 10 | Single | 1 Person |
| 9 | Double | 2 Pers., Doppel-/Queen-/King-Bett |
| 8 | Twin | 2 Pers., 2 getrennte Betten |
| 24 | Twin/Double | Standard Double oder Twin |
| 7 | Triple | 3 Personen (Dreibettzimmer) |
| 4 | Quadruple | 4 Personen |
| 5 | Suite | „Suite" muss im Namen stehen |
| 13 | Family | „Family" im Namen, Belegung 2+ |

### Ganze Einheit (Ferienobjekt)
| Code | Zimmertyp |
|---|---|
| 1 | Apartment |
| 12 | Studio |
| 27 | Bungalow |
| 28 | Chalet |
| 29 | Holiday home |
| 31 | Villa |
| 32 | Mobile home |
| 33 | Tent |

### Hostel
| Code | Zimmertyp |
|---|---|
| 25 | Dormitory room (ganzer Schlafsaal) |
| 26 | Bed in Dormitory (einzelnes Bett) |

**Nicht existent / zurückgezogen (nie verwenden):** 2, 3, 6, 11, 14–23, 30.

> **Belegung ≠ Typ:** Der BCRT-Code ist nur die Kategorie. Die echte Personenzahl
> setzt Booking separat über `MaxOccupancy`/`MaxAdultOccupancy`/`MaxChildOccupancy`.
> Ein Dreibettzimmer ist „Triple" (7) **und** `MaxOccupancy=3` — der Name allein
> garantiert die Kapazität nicht.

### Internes Mapping (property_type → BCRT)
`channel_manager/common.py._BOOKING_ROOM_TYPE` — Vorschlag beim Verbinden:

| intern (property_type) | BCRT | Code |
|---|---|---|
| einzelzimmer | Single | 10 |
| doppelzimmer | Double | 9 |
| zweibettzimmer | Twin | 8 |
| familienzimmer | Family | 13 |
| junior_suite / suite | Suite | 5 |
| ferienhaus | Holiday home | 29 |
| appartement | Apartment | 1 |
| glamping | Tent | 33 |
| tiny_house | Chalet | 28 |
| hausboot / stellplatz | — (Unterkunftsart, kein Zimmertyp) | — |

---

## PCT — Unterkunftsarten (26 aktive Codes)

| Code | Unterkunftsart (EN) | Deutsch |
|---|---|---|
| 20 | Hotel | Hotel |
| 19 | Hostel | Hostel |
| 3 | Apartment | Apartment / Ferienwohnung |
| 4 | Bed and Breakfast | B&B / Pension mit Frühstück |
| 40 | Pension/Guest House | Pension / Gästehaus |
| 6 | Campground/Camping | Campingplatz |
| 7 | Chalet | Chalet |
| 12 | Cruise/Boat | Kreuzfahrt / Boot |
| 15 | Guest farm/Farm stay | Bauernhof |
| 21 | Inn | Gasthof / Landgasthof |
| 22 | Lodge | Lodge |
| 27 | Motel | Motel |
| 30 | Resort | Resort |
| 33 | Tent/Tented | Zelt / Glamping |
| 35 | Villa | Villa |
| 5000 | ApartHotel | Aparthotel |
| 5001 | Riad | Riad |
| 5002 | Ryokan | Ryokan |
| 5003 | Love Hotel | Love Hotel |
| 5004 | Homestay | Homestay / Privatunterkunft |
| 5005 | Japanese-style Business Hotel | Business-Hotel (jap. Stil) |
| 5006 | Holiday Home | Ferienhaus |
| 5007 | Country house | Landhaus |
| 5008 | Capsule Hotel | Kapselhotel |
| 5009 | Holiday Park | Ferienpark |
| 5010 | Cruise Ship | Kreuzfahrtschiff |
| 5011 | Student Accommodation | Studentenunterkunft |

**Deprecated (nur zum Lesen bestehender Werte, NICHT zur Neuanlage):**
5, 8, 14, 16, 18, 23, 25, 26, 28, 29, 31, 32, 34, 36, 37, 44, 45, 46, 50, 51, 52.

> PCT-Codes sind **Integer** (nicht Kürzel wie BCRT). Beim Property-Anlegen als
> Zahl senden.
