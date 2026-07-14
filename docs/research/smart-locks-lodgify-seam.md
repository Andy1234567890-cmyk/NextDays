# Research: Wie .. Smart Locks macht (Stand 13.07.2026)

Quellen: help....com — „Connect with smart locks and manage entry codes"
(Artikel 15335695055004, aktualisiert vor 7 Tagen) · docs.seam.co (Smart Locks,
Access Codes) · ..-Marketingseite (Preis/Seam-Disclosure).

## Kernbefund

**.. baut keine einzige Schloss-Integration selbst.** Der gesamte Dienst
läuft über **Seam Labs, Inc. (seam.co)** als Aggregator — .. legt das im
Kleingedruckten offen („Der Smart Locks-Dienst wird Ihnen von .. über
Seam Labs, Inc. angeboten"). .. integriert EINE API (Seam) und bekommt
damit alle Marken: Nuki, August, Igloohome, Kwikset, Schlage, SmartThings,
Tedee, TTLock, Wyze, Yale, Lockly, 4Suites — die Liste ist deckungsgleich mit
Seams Gerätekatalog. Gerätevoraussetzungen: Tastatur (oder nachrüstbar), WLAN
oder Bridge, ggf. Anbieter-Abo.

## Ablauf bei .. (aus dem Hilfeartikel)

1. **Verbinden**: Einstellungen → Smart Locks → Abonnieren → Marke wählen →
   neuer Tab öffnet Anbieter-Login (= Seam **Connect Webview**; OAuth/Creds
   laufen bei Seam, nie bei ..). Nur Geräte, die programmatische
   Code-Erstellung können, werden importiert.
2. **Abo/Billing**: Preis pro Gerät/Monat (7 USD / 6 EUR / 6 GBP), Vorauszahlung
   30 Tage, Anzahl jederzeit änderbar (sofortige Differenz-Abbuchung),
   Geräte müssen vor dem Entfernen unassigned werden.
3. **Zuweisen**: Gerät ↔ Rental (n Geräte pro Rental erlaubt, 1 Gerät nur zu
   1 Rental). Sichtbar: Status on/off, Batteriestand, Permanent-Code.
   Nicht verfügbar bei Zimmertypen/buchbaren Einheiten (Hotelmodus!).
4. **Code-Lebenszyklus (der eigentliche Mehrwert)**:
   - Code wird NUR für Status „Booked" erzeugt, für ALLE Quellen (auch
     OTA-Buchungen; extern erzeugte OTA-Codes werden nicht importiert).
   - Sichtbar ab 30 Tage vor Check-in; aktiv von 30 min vor Check-in bis
     30 min nach Check-out; danach automatische Löschung.
   - Zeiten pro Reservierung (auch bulk) editierbar; Check-in/out-Zeiten
     fallen zurück auf Policy der Unterkunft, sonst Default 14:00/12:00.
   - Status-Maschine: Active · Scheduled · Expired · No code (not booked) ·
     No code (30 days) · Generating · Deleting · Updating — d.h. asynchrone
     Programmierung mit sichtbaren Zwischenzuständen (Provider brauchen Zeit).
5. **Permanent-Codes**: reservierungsunabhängig (Personal/Wartung/Backup),
   manuell angelegt/gelöscht; bestehende Codes des Schlosses werden NICHT
   importiert.
6. **Gast-Kommunikation**: automatische Nachricht „1 Tag vor Check-in, bei
   Last-Minute sofort (alle 30 min)" mit Platzhalter `{{KeyCode}}`
   (mehrere Geräte → „Gerät 1: Code 1, Gerät 2: Code 2"). Push-Notification
   an den Host beim ersten Gast-Check-in mit dem Code. `{{KeyCode}}` ist
   exklusiv: Smart Locks ODER Jervis/Homeit/Chekin, nicht parallel.

## Seam-API-Modell (docs.seam.co)

- Konzepte: **Connected Account** (Anbieter-Login via Connect Webview) →
  **Devices** (mit Capability-Flags wie `can_program_online_access_codes`,
  `can_remotely_unlock`) → **Access Codes** (permanent oder time-bound,
  `starts_at`/`ends_at`) → **Events/Webhooks** (Code programmiert, Tür
  entriegelt, Batteriestand).
- Seam empfiehlt heute die höhere Abstraktion „Access Grants" statt der
  Low-Level-Smart-Locks-API.
- Asynchrone Programmierung: Codes werden auf dem Gerät provisioniert →
  darum ..s Generating/Updating/Deleting-Status.

## Was das für NextDays bedeutet (Empfehlung)

1. **Gleicher Move: Aggregator statt 12 Einzelintegrationen.** Ein
   `smart_locks`-Slice mit Adapter-Interface (wie channel_manager/ocr,
   ADR-Muster) und **Seam als erstem Adapter**. Alternativ-Aggregatoren zum
   Vergleichen: Nuki-direkt (EU-lastig) — aber Seam ist der Marktstandard,
   den auch der Wettbewerb nutzt.
2. **Datenmodell-Skizze**: `smart_lock_devices` (tenant_id, property_id
   nullable, seam_device_id, status, battery, provider),
   `smart_lock_codes` (device_id, reservation_id nullable für permanent,
   code, starts_at, ends_at, state: scheduled|active|expired|generating|…).
   RLS wie üblich; Owner-RESTRICTIVE-Policy beachten (0059-Muster).
3. **Wurzel-Passung**: Code-Erzeugung hängt am Reservierungs-Lifecycle →
   Wurzel 1 (Storno/Umbuchung muss Codes löschen/verschieben — Alt/Neu-Diff!);
   Seam-Webhooks → Wurzel 2 (Redelivery-idempotent); Zeiten aus
   Reservierung/Policy, nie hardcoded (Wurzel 4).
4. **Monetarisierung**: .. verlangt 6 €/Gerät/Monat als Add-on —
   Achtung Spannungsfeld zu unserem „All-Inclusive, kein Feature-Gating"
   (PROJECT.md §5): entweder in den Festpreis einpreisen oder als
   Hardware-nahen Durchleitungsposten begründen (Seam kostet pro Gerät).
   Geschäftsentscheidung Andy/Jeanine, kein Code.
5. **DSGVO**: Seam ist US-Anbieter (Datenverarbeitung im Auftrag) — vor
   Integration AVV/SCC prüfen und als ADR dokumentieren (wie Google-Dienste,
   PROJECT.md §2). .. löst das per eigener Smart-Locks-Datenschutzerklärung.
6. **Einstieg über die Inbox**: `{{KeyCode}}`-artiger Platzhalter passt exakt
   in unser bestehendes Automail-/Template-System (inbox-Slice, Migration 0072).

**Nicht jetzt bauen** — erst P6–P9 abschließen. Kandidat für ein eigenes
Arbeitspaket P10 nach dem Security-Review.
