# ADR-0012: Neue Unterkünfte bei OTAs anlegen – Anbieter-Wahl (Channex vs. NextPax vs. Beds24)

- Status: **offen** (warten auf NextPax-Antwort; siehe `docs/nextpax-anfrage.md`)
- Datum: 2026-06-22
- Bezug: ergänzt ADR-0001 (Channel-Manager-Architektur)
- Hinweis: ursprünglich als „0011" angelegt; wegen Nummern-Kollision mit
  [ADR-0011 (Stripe primär)](0011-zahlungs-gateway-stripe-primaer.md) auf 0012 umnummeriert.

## Kontext

Kundenwunsch: Ein Vermieter legt eine Unterkunft in myNextDays an, und diese soll
**automatisch bei den verbundenen Portalen (Booking.com, Airbnb, Vrbo/Expedia) NEU
angelegt** und verteilt werden ("Kunde legt an → wird bei Booking.com erstellt →
Hotel-ID zurück → automatisch gelistet"). Erst sicher wissen, **dass es geht**, bevor
der aktuelle Channel-Manager (Channex) ersetzt wird.

## Recherche-Ergebnis (belegt, Stand Juni 2026)

### Direkter OTA-Zugang ist versperrt
- **Booking.com Connectivity API** kann Properties von Null anlegen
  (`OTA_HotelDescriptiveContentNotif` / Property API), aber nur als zugelassener
  Connectivity-Partner. Aufnahme neuer Partner ist **pausiert**
  ("pausing integrations with new connectivity providers until further notice",
  connect.booking.com).
- **Airbnb Partner API**: geschlossen, nur auf Einladung (airbnb.com/help/article/3418).
- **Per-Owner-OAuth-Token** (Owner loggt sich ein, gibt uns Zugang, ohne dass wir
  Partner sind) existiert bei **keinem** der drei OTAs. Login-Token ≠ API-Zugang.

### Channel-Manager-Vergleich
| Kriterium | Channex (aktuell) | NextPax | Beds24 |
|---|---|---|---|
| Booking.com-Property von Null per API | ❌ nur Hotel-ID verbinden | ✅ (stellt sogar Vertrag aus) | ✅ `createProperties`, aber Vertrags-Mail + Mapping manuell |
| Finales Room-Mapping per API | – | ✅ `confirm-mapping` | ❌ "mapping cannot be done via our API" |
| White-Label (harte Projekt-Regel) | ✅ | ✅ "White Label Channel Manager" | ⚠️ "can not be completely white labeled" |
| Payments by Booking.com automatisch | – | ✅ (Beta) | ❌ |
| Self-Service-Zugang | ✅ | ❌ Sales-Prozess | ✅ Token selbst erzeugbar |
| Kosten | ~25–35 €/Mt | ~250 €/Mt min. o. ~3,60 €/Unit | ab 15,50 €/Mt + 0,55 €/Channel-Link |
| OTAs | – | 150+, Vrbo Preferred 2026 | 60+, Premium Booking/Airbnb/Vrbo, Elite Expedia |

## Bewertung

Für die zwei harten Anforderungen — **(1) echtes Auto-Anlegen** und
**(2) White-Label-Zwang** — passt **NextPax** am besten: einziger Anbieter, der die
volle Kette (Vertrag + Property + Mapping + Payments) per API automatisiert und
offiziell white-label ist. Nachteil: kein Self-Service, Sales-/Partner-Prozess nötig,
höhere Kosten.

**Beds24** ist der schnell selbst testbare Plan B (offene API), lässt aber zwei
manuelle Lücken (Booking.com-Vertrags-E-Mail, Room-Mapping) und ist laut eigener Wiki
nicht vollständig white-label.

myNextDays qualifiziert sich als **Plattform/PMS-Partner** (nicht als einzelnes Hotel) —
genau die Zielgruppe der NextPax Supply API.

## Offene Fragen (nur per Anbieter klärbar)
- NextPax: Mindest-Property-Zahl zum Start? Pricing für White-Label-PMS? Sandbox?
  eigener `propertyManagerCode` pro Mandant? Booking.com-Approval trotz "instant go-live"?
- Beds24: Nennt Booking.com im Extranet "Beds24" als Provider (white-label-Risiko)?
  Sandbox? Airbnb-Listing-Neuanlage per API oder nur Import?

→ Fragenkatalog in `docs/nextpax-anfrage.md` (E-Mail an support@nextpax.com).

## Erweiterte Recherche (Juni 2026): weitere Anbieter geprüft
Mit striktem Filter **„neutrales White-Label-Backend vs. sichtbarer Konkurrent"**
geprüft (GitHub/Reddit/offizielle Devportale):
- **Hostaway** — kann Booking.com + Airbnb von Null anlegen, ABER eigenes sichtbares
  PMS (= direkter Konkurrent) und nicht white-label: Vermieter muss „Hostaway OY" im
  Booking.com-Extranet wählen. ❌
- **Rentals United** — gehört seit Mai 2024 zu **Guesty** (PMS-Konkurrent); „White
  Label" betrifft nur Rechnung, nicht das Extranet; Booking.com/Airbnb nur bestehende
  verbinden; XML-Legacy-API. ❌
- **Beds24** — eigenes sichtbares PMS + Booking-Engine (Konkurrent); sagt selbst
  „channel manager can not be completely white labeled"; Property-Anlage nur über
  Web-UI + manuelle Vertrags-Mail. ❌
- **SiteMinder/Little Hotelier** — verbindet nur bestehende Properties (wie Channex);
  „Channels Plus"-Auto-Listing gilt NICHT für Booking.com/Airbnb/Expedia. ❌
- **NextPax** — neutraler Aggregator, white-label, kann von Null anlegen → einziger
  ernsthafter Zukunfts-Kandidat. Sales-Prozess nötig. Anfrage liegt in
  `docs/nextpax-anfrage.md`.

**Strukturelle Wahrheit (für alle):** Die namentliche Provider-Auswahl im Booking.com-
Extranet ist eine **Booking.com-Regel** — jeder Channel-Manager wird dort namentlich
gewählt. Dass *euer* Name dort steht, ginge nur als selbst zugelassener Booking.com-
Connectivity-Partner (aktuell pausiert).

## Konsequenz (umgesetzt)
- Channex **bleibt produktiv** (einziges neutrales, nicht-konkurrierendes Backend).
- **Hotel-ID-Flow vervollständigt** (Plan „stateless-percolating-teacup"): neue Tabelle
  `channex_channel_connection` (Migration 0035) persistiert Hotel-ID + Channel-Status
  pro (Objekt, Portal); `connect_channel`/`disconnect_channel` schreiben sie,
  `list_channel_connections` + `GET /channel-manager/properties/{id}/connections` lesen
  sie; UI zeigt Status/Hotel-ID und befüllt beim Re-Connect vor.
- Channel-Manager-Adapter (ADR-0001) hält die Provider-Wahl austauschbar →
  NextPax später als zweiter Adapter einsteckbar, kein Bruch.
