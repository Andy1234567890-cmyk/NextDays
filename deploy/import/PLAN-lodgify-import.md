# Plan: .. → myNextDays Import (Kunden-Umzug)

> **Status: KONZEPT.** Erstellt 2026-07-08. Ziel: ein ..-Kunde soll seine
> Daten (Objekte, Buchungen, Gäste) nach myNextDays holen können, um den Wechsel
> hürdenfrei zu machen (Preisliste: „mind. 50 % günstiger als ..").

## Verifizierte ..-API-Fakten (nicht geraten)

Quelle: offizieller `Fast-Transients/..-mcp-server` (kapselt die echte
.. Public API v2) + Doku-URL-Muster. **Nicht** aus der Cloudflare-
geschützten Doku selbst (403 für automatisierte Zugriffe).

- **Base-URL:** `https://api....com/v2`
- **Auth:** Header `X-ApiKey: <key>` (der Kunde erzeugt den in seinem ..-
  Account und gibt ihn uns EINMALIG für den Import — kein OAuth).
- **Doku-Plattform:** ReadMe.io (`/reference/<operationId>`, Slugs = .NET-
  Methodennamen wie `GetAllAsync` → Swagger-Import aus ASP.NET-Backend).
- **Verifizierte Endpunkte (GET, paginiert):**
  | Zweck | Endpunkt |
  |---|---|
  | Objekte (Liste/Detail) | `/properties`, `/properties/{id}` |
  | Buchungen (Liste/Detail) | `/reservations/bookings`, `/reservations/bookings/{id}` |
  | Preis-Kalender | `/rates/calendar` |
  | Buchung anlegen | `POST /reservation/booking` |
  - Paginierung: `params` mit `limit`/`size`/`page` (Feldnamen pro Endpunkt
    beim Bau live gegenprüfen — nicht raten).

> **Wichtig (Wurzel 4/„echte DB testen"):** Die genauen FELDNAMEN der ..-
> Responses (z. B. Gastname, Preisaufschlüsselung, Objekt-Adresse) sind hier NOCH
> NICHT verifiziert (Doku hinter Cloudflare). Vor dem Bau MUSS gegen die echte
> ..-API mit einem Test-Key gegengelesen werden — kein Mapping aus Vermutung.

## Ziel-Datenmodell (myNextDays, vorhanden)

| ..                  | myNextDays-Ziel                                                                            | Endpunkt-Muster (bestehend)          |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| Property            | `properties` (title, description, address, lat/lng, amenities, max_guests, photos, status) | `features/properties`                |
| Booking/Reservation | `reservations` (+ `guests`)                                                                | `features/reservations`              |
| Rates/Kalender      | `rate_plans` / `availability` / dynamic pricing                                            | `features/rates`, `features/pricing` |
| Gast                | `guests` (Identity-Resolver vorhanden: `resolve_or_create_guest`)                          | `features/guests`                    |

**Kanal-Zuordnung (wichtig, Provisions-relevant):** ..-Buchungen tragen
einen Quell-Kanal (Airbnb/Booking/Vrbo/Direct). Beim Import muss der auf euer
`reservation_channel`-Enum (`direct|portal|booking|airbnb|vrbo`) gemappt werden —
sonst stimmt später die Provisions-/Belegungslogik nicht. Importierte
OTA-Buchungen dürfen KEINE 8-%-Portal-Fee und KEINE 1-%-Provision rückwirkend
auslösen (das sind Bestandsdaten, keine neuen Buchungen).

## Architektur-Entscheidung (zu klären)

Es gibt noch KEINEN Import-Slice. Zwei saubere Wege:

- **(A) Eigener `features/import`-Slice** (empfohlen): ein Endpunkt
  `POST /import/..` (Kunde gibt API-Key), ein Worker-Job zieht paginiert
  Objekte→Buchungen→Gäste und legt sie tenant-gescopet an. Fortschritt/Fehler in
  einer `import_run`-Tabelle (Realtime-Statusanzeige). Idempotent über eine
  externe-ID-Map (`.._id ⇄ myNextDays-id`), damit ein erneuter Lauf nichts
  doppelt anlegt (Wurzel 2).
- **(B) Einmaliges Skript** (`deploy/import/`): schneller, aber kein
  Self-Service, kein UI, nicht wiederholbar pro Kunde. Nur für einen manuellen
  Erst-Umzug.

## Kernrisiken (ehrlich)

1. **Feldnamen unverifiziert** → zuerst mit echtem ..-Test-Key gegenlesen
   (Recherche vor Bau), sonst falsches Mapping.
2. **Idempotenz** (Wurzel 2): Import ist retrybar → externe-ID-Map + UNIQUE-
   Backstop, sonst Doppel-Objekte/-Buchungen bei erneutem Lauf.
3. **Gegenzustand** (Wurzel 1): Import setzt Belegung/availability → muss zur
   importierten Buchung passen (keine Phantom-Sperren).
4. **Fotos/Medien:** .. liefert Bild-URLs → müssen in euren Storage
   (Hetzner S3) kopiert werden, nicht nur verlinkt (sonst tote Links nach
   ..-Kündigung).
5. **Rate-Limits** .. → Backoff/Drosselung im Worker (wie Channex-Budget).
6. **Kein Rück-Sync:** Das ist ein EINMALIGER Import (Umzug), kein laufender
   Zwei-Wege-Sync. Nach dem Import ist myNextDays die Quelle der Wahrheit.

## WEB-RECHERCHE (2026-07-08): Wie Migration von .. REAL funktioniert

**Kernbefund: Es gibt KEINEN Konkurrenz-tauglichen API-Weg. Alle machen es über
vom KUNDEN selbst exportierte Dateien.** (Wir sind ..s Konkurrenz → bekommen
keinen bevorzugten Zugang; und der Kunde soll seinen eigenen API-Key nicht
umständlich erzeugen müssen.)

Drei öffentliche, vom Kunden selbst nutzbare Datenquellen — verifiziert:

1. **iCal-Export (öffentlich, LIVE geprüft):** pro Objekt eine `.ics`-URL
   (`...com/oh/<uuid>.ics`, 301→`/oh/`, 200 text/calendar). Enthält NUR
   Belegungszeiträume (`DTSTART/DTEND`), `UID` (Idempotenz) und `SUMMARY`
   (Gastname teils maskiert / "Closed Period" = Sperre). KEINE Objektdaten/Preise.

2. **CSV-Export aus .. (Kunde lädt selbst runter):** Dashboard → Booking
   Agenda → "Generate CSV". Enthält laut .. "complete breakdown of booking
   financials" + bei OTA-Sync **Gastname, E-Mail, Telefon, Sprache**. Zeitraum:
   Buchungen mit Checkout **ab 01.01.2024**, confirmed + cancelled, filterbar
   (Rentals, Status, Booking source). → DAS ist die reichhaltigste vom Kunden
   selbst zugängliche Quelle für Buchungen+Gäste+Finanzen.

3. **Öffentliche Buchungs-Website des Kunden:** Objektdaten (Titel, Fotos,
   Beschreibung, Ausstattung, Adresse, Preise) sind auf der öffentlichen ..-
   Site des Kunden sichtbar — grundsätzlich lesbar, aber Scraping ist fragil.

**Industriestandard (recherchiert):** Hostaway kann NUR von Airbnb importieren,
NICHT von ... Guesty/RentalWise migrieren **manuell über ihr Onboarding-Team**
mit exportierten Dateien, Zeitrahmen "Wochen". D.h. der Markt hat KEINE
1-Klick-Lösung — hier ist ein echter Wettbewerbsvorteil möglich.

## Empfohlener Weg für myNextDays: CSV-Upload-Import (kein Kunden-API-Key)

**Der einfachste Weg FÜR DEN KUNDEN, den WIR kontrollieren:**

- Kunde exportiert in .. die **CSV** (ein Klick, kein API-Key, kein
  Entwickler) + optional die **iCal-URLs**.
- Kunde lädt die CSV bei uns hoch → wir parsen sie, mappen Felder, legen
  Buchungen + Gäste tenant-gescopet an. Objekte werden aus den in der CSV
  referenzierten Rentals als Gerüst angelegt (Titel/Objektnr.), Details
  (Fotos/Beschreibung) ergänzt der Kunde oder wir ziehen sie best-effort von der
  öffentlichen Site.
- **Belegung** kommt zusätzlich aus den iCal-Feeds (laufend aktuell).

Vorteil: kein API-Key, kein ..-Zutun, sofort machbar. Genau der
niedrigschwellige "einfach zu uns"-Weg.

**Offen/zu verifizieren vor Bau:** exakte CSV-Spaltennamen (..-Doku hinter
Cloudflare) → wir brauchen EINE echte Beispiel-CSV eines Kunden zum Mappen
(nicht raten, Wurzel 4). Die kann der Kunde mit den 20 Objekten liefern.

## Nächster Schritt (Entscheidung)

1. **Eine echte ..-CSV** (vom Kunden mit den 20 Objekten) als Muster → exakte
   Spalten mappen. Das ist der einzige noch fehlende Baustein.
2. Dann: `features/import`-Slice (CSV-Upload + Parser + tenant-gescopetes Anlegen,
   idempotent über ..-Buchungs-UID) + iCal-Belegungs-Sync.
