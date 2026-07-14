# Lastenheft — NextDays Platform (MVP & Phase 1)

> Konsolidierte Anforderungsbasis (Stand 13.05.2026). Dieses Dokument ist die
> **fachliche Quelle der Wahrheit** für Funktionsumfang. Technische Umsetzung &
> Konventionen: [PROJECT.md](../PROJECT.md). Abgleich mit dem aktuellen Stand:
> [REQUIREMENTS-GAP.md](REQUIREMENTS-GAP.md).

## 1. Übergreifende System- & UI/UX-Vorgaben

- **Währungssystem:** Striktes Verbot von Cent-/Øre-Darstellungen. Alle Preise
  systemweit (Schnittstellen, Widgets, Dashboards) in **glatten Beträgen** (Kr / €)
  ausgegeben und gerundet.
- **System-Sprachen (nativ):** UI und alle automatisierten Kommunikationskanäle
  vollständig und fehlerfrei in **Deutsch (DE), Dänisch (DK), Englisch (EN)**.
  Bestehenden Dänisch-Bug fixen.
- **Globale Architektur:** universelle, mandantenfähige SaaS-Cloud-Plattform,
  unabhängig von lokalen Ländervorgaben weltweit einsetzbar.

## 2. Modul-Architektur & Funktions-Spezifikationen

### 2.1 Custom Dashboard & Navigation

- **Dynamische Kacheln:** Dashboard per Drag-and-Drop personalisierbar. Jede
  Daten-Kachel (inkl. Umsatzentwicklung, Kanalverteilung) verschiebbar, skalierbar,
  ausblendbar.
- **White-Labeling:** Upload-Feld für Agentur-/Nutzerlogos (PDF, JPG, PNG).
- **Seitenmenü:** einklappbare Untermenüs (Accordion). Doppelte Menüstrukturen
  entfernen (z. B. Personal).

### 2.2 Multi- & Einzelkalender (Herzstück)

- **UI/UX:** Anpassung an Industriestandard (Vorbild: ..-Multikalender).
- **Click-and-Hold-Logik:**
  - **Einzeltag-Klick** → Kontext-Popup mit drei Optionen:
    - **Direktbuchung:** automatische Periodenberechnung inkl. automatisierter
      Aufschläge (Reinigung, Nebenkostenpauschale, Hundegebühr, Wäschepakete).
    - **Buchungsangebot:** Angebots-E-Mail an Gast mit Bestätigungs-Link +
      verschlüsseltem Zahlungs-Gateway.
    - **Kalendersperrung.**
  - **Click-and-Hold (gleitende Markierung):** Auswahl Tag X bis Tag Y zur direkten
    Blockierung oder manuellen Preisanpassung.
- **Manuelle Preisüberschreibung:** Tagespreise direkt im Kalenderblatt
  überschreiben/zurücksetzen per Klick. Alten Menüpunkt „Preisüberschreibungen“
  entfernen (keine System-Sprünge).

### 2.3 Saison- & Event-Management (Preissystem)

- **Taggenauer Saisonkalender:** Abschaffung der KW-Aufteilung. Saisons taggenau
  per Datums-Popup („Von X bis Y“).
- **Saison-Templates:** globale Templates (z. B. „Standard“, „Skagen“), per
  Checkbox Unterkünften zuweisbar.
- **Farbcodierte Legende:** deckungsgleich im Kalender, freie Farbdefinition.
  Standard: Saison G hellgrün · E helllila · F hellblau · D hellgelb · C hellorange
  · B hellrot · A mittelrot.
- **Sonder-Events:** mehrere Datumsbereiche unter einem Event-Namen, auch
  unterbrochene Zeiträume.
- **Saison-Kategorien:** volle Bearbeitungsrechte für Prozentwerte, Hinzufügen/
  Löschen im Admin-Bereich.

### 2.4 Unified Inbox & Variables Messaging

- **Präzises Timing:** minutengenaues Trigger-System (z. B. Bestätigung 5 Min nach
  Buchung; Check-In-Info am Anreisetag 06:45; Erinnerung 3 Tage vor Anreise 19:00).
- **Multi-Channel-Versand:** Mehrfachauswahl (E-Mail, SMS, OTA-In-App wie Airbnb).
- **Übersetzungs-Gateway:** Ein-Klick-Übersetzung in Vorlagen/Schnellantworten
  (DE → EN + DK).
- **Rich-Text-Editor:** fett/kursiv/unterstrichen, Trennlinien, Listen,
  Einrückungen, Schriftart — für Vorlagen, Schnellantworten, Anleitungen.
- **Drag-and-Drop Shortcodes:** Shortcodes per Drag-and-Drop in den Text ziehen
  (keine Textmarkierung mehr).
- **Trigger-Erweiterung:** neuer Trigger „Sobald digitales Check-in-Formular
  vollständig ausgefüllt“.

### 2.5 Operatives Aufgaben- & Checklistenmanagement

- **Automatische Aufgaben-Generierung:** bei Buchung am Abreisetag „Endreinigung“,
  am Anreisetag „Anreise-Check/Inspektion“ (verknüpft mit Channel-Manager).
- **Wiederkehrende Aufgaben:** Regelwerke (alle X Wochen/Tage/Monate, jährlich,
  saisonal eingegrenzt, z. B. „monatlich im Winter 01.10.–31.03.“).
- **Zuweisungs-Logik:** je Regel global oder spezifischen Unterkünften zuweisbar
  (Mehrfachauswahl).
- **Foto-Checklisten:** unbegrenzt Bildnachweise pro Raum über mobile Web-App
  (Detailaufnahmen unter Möbeln, in Schränken).
- **Dynamische Fälligkeiten:** Zeitfenster-Mapping (Start „nach Check-out“ →
  Deadline „vor nächstem Check-in“) oder exakte Uhrzeiten.
- **Büro- & Lagerinventar:** Bestände ohne Unterkunfts-Zuordnung (z. B. zentraler
  Pool von 23 Wäschepaketen für Gast-Verkauf).

### 2.6 Daten-Akquise & Partnermanagement

- **Eigentümer-Akquise (CRM):** Lead-DB mit Stammdaten (Name, Adresse, Telefon,
  E-Mail), Marketing-Attribution (Lead-Quelle), Objekt-Eckdaten (Adresse, qm,
  max. Personen), Fortschritts-Tracking (Notizen, Status).
- **Partner & Deals (B2B-Rabatt):** Verwaltung von Kooperationspartnern (z. B.
  Fårup Sommerland, Café Fisk) mit Name, Anschrift, Ansprechpartner, Kontakt,
  Rabattart (% oder Fixbetrag), Rabattcode, QR-Code-Upload.

## 3. Schnittstellen (API- & Channel-Management)

- **Zwei-Wege-REST-APIs (keine reinen iCal-Hinweise):** native Anbindung inkl.
  Preise, Verfügbarkeiten, Content, Webhooks für:
  - **Airbnb** (API-Programm)
  - **Booking.com** (Connectivity-Partnerprogramm)
  - **Vrbo / Expedia** (Expedia Connectivity-Programm)
  - **Optional:** Bündelungs-Dienste (z. B. Feondi) für kleinere Regional-Portale.
- **Zahlungssystem (Revolut-Infrastruktur):** **Revolut Business API (Gateway) als
  primäres, kostengünstiges Gateway** für Mieten, Kautionen, Zusatzleistungen.
  **Stripe sekundär** konfigurierbar.
- **Onboarding/Klonen:** bidirektionale Sync — Unterkünfte aus Airbnb/Booking.com
  importieren ODER in NextDays erstellte Unterkünfte per API zu Airbnb/Booking.com
  exportieren und dort neu anlegen.

## 4. Rollen- & Berechtigungs-Matrix (Access Control)

Granulare, erweiterbare Matrix; alle Konten per **Toggles** administrierbar.

### 4.1 Administrator & Co-Admin

- **Administrator:** voller Zugriff (Finanzen, Plattform-Dienste,
  Mandanteneinstellungen).
- **Co-Admin:** operative Rechte von Eigentümern + Mitarbeitern kombiniert; kann
  manuelle Aufgaben erstellen/ändern, erhält System-Warnungen/-Benachrichtigungen,
  volle Bearbeitungsrechte für Hausdaten, Inventar, Eigentümer-/Mitarbeiterdaten.

### 4.2 Eigentümer-Portal

- **Sicherer Daten-Split:** Eigentümer sehen Belegungskalender inkl. Saisons/
  Legende; Buchungen nur mit **Vorname** + Buchungsquelle. Gast-Gesamtpreis
  unsichtbar; nur **Netto-Auszahlung pro Nacht** sichtbar.
- **Sperrungs-Handling:** Eigentümer können Sperrung nur **beantragen** → Push/
  E-Mail an Admin → erst nach Bestätigung aktiv + automatische Rückmeldung.
- **Zählerstände:** historische Stände einsehbar, neue eigenständig hinzufügbar;
  Überschreiben/Löschen gesperrt.
- **Direkt-Buchung Dienstleistungen:** Endreinigung, Hauptreinigung, Zusatz
  (Fenster, Rasen, Terrasse, Freitext) direkt im Kalender → fließt in globalen
  Aufgabenkalender + benachrichtigt Mitarbeiter.
- **Reporting & Benachrichtigungen:** selbstverwaltetes Menü (SMS/E-Mail/aus),
  Download verifizierter Monats-/Jahresberichte + Abrechnungsstand.

### 4.3 Mitarbeiter- & Dienstleister-Portal (Smartphone)

- **Strikte Datentrennung:** kein Zugriff auf Bewertungen, Umsätze, Reports,
  Finanzen.
- **Operative Ansicht:** persönlicher Aufgabenkalender, hausspezifische
  Inventarlisten, eigene Urlaubszeiten/Verfügbarkeiten.
- **Vertretungs-Feature:** Vertretung per Knopfdruck im Team anfragen.
- **Buchungstransparenz:** sehen An-/Abreisedaten, **keine** Namen/Quellen/Beträge.
- **Objekt-Festzuweisung:** Admin kann Mitarbeiter als Stamm-Mitarbeiter für Häuser
  definieren.

## 5. Gäste-Portal & Buchungsstrecke

- **White-Label-Gäste-Portal:** Web-App, Admin mit vollem Einblick/Konfiguration.
- **Echtzeit-Benachrichtigung:** Erst-Login eines Gasts/Eigentümers/Mitarbeiters →
  sofortige Admin-Push + automatische Willkommens-Nachricht.
- **Zentralisierte Standardtexte:** globales, dreisprachiges Content-Menü
  (Hausregeln, Check-out-Regeln, Check-in-Infos, Reiseguide, Notfallkontakte,
  Mietbedingungen), per Checkbox einzelnen Unterkünften/Portfolio zuweisbar.
- **Buchungs-Widget (Baukasten):** modulare, exportierbare Buchungsstrecke, per
  Widget in die eigene Marketing-Website einbindbar, voll an das Kernsystem
  angebunden.

## 6. Datenblätter & Onboarding (8-stufig)

Eigentümerdaten in der Unterkunfts-Kartei. Adressen strikt getrennt: Straße,
Hausnummer, PLZ, Ort, Land. Miteigentümer mit identischen Stammdaten-Feldern.
PDF-Export + Druck. Acht Stufen:

1. **OBJEKTINFORMATION** — internes Hausnummer-Feld; Hausname; Kapazitäten
   (Personen/qm); BFE-Nummer (DK-Kataster); Boligtype (Flexbolig/Helårsbolig/
   Fritidshus); Eigentümer-Stammdaten & CPR-Nummer; Bankverbindung (Reg.-Nr./
   Konto-Nr./Bankname).
2. **PROCES & KONTRAKT** — Daten: Erstgespräch, Vertrag versendet, unterzeichnet
   retour, Onboarding-Faktura versendet, Faktura bezahlt.
3. **ADGANG & TEKNIK** — Schlüssel-Status (Extra-Schlüssel bei Agentur);
   Schlüsselbox-Code; physische Platzierung; WLAN (SSID/Passwort).
4. **SERVICEAFTALER** — Hausmeister-Runde, Fensterreinigung, Rasenmähen (je
   Frequenz/Preis).
5. **HÅNDVÆRKERE** — Elektriker, VVS/Sanitär+Heizung, Zimmermann, Schlüsseldienst
   (Name/Tel.); Akut-Vollmacht (Checkbox: bis Betrag X / immer Eigentümer
   kontaktieren).
6. **MARKEDSFØRING** — Daten: Fotograf beauftragt, Medien erhalten, Hausbegehung,
   Mängelliste übermittelt.
7. **HUSMAPPE** — Begrüßungstext (Status erhalten/offen); Geheimtipps; physische
   Hausmappe platziert (ja/nein).
8. **ANNONCERING** — Grundpreis-Definition; permanente Sperrung/Eigenbelegungs-
   Import; Plattform-Matrix & Launch-Termine (Nativ-Website, Airbnb, Booking.com,
   Vrbo).

---

## 7. Ergänzungs-Modul: Das NextDays-Ökosystem

### 7.1 „All-Inclusive-Premium“-Preisstruktur

- **Kein Feature-Versteckspiel:** keine künstlichen Leistungsvariationen oder
  gesperrten Funktionen hinter teureren Paketen. Jeder Nutzer erhält sofort den
  vollen Funktionsumfang (Channel Manager, PMS, Aufgabenplanung, Eigentümer-Portal,
  Gäste-Portal).
- **0% Buchungsgebühr:** keine prozentuale Beteiligung an Vermieter-Buchungen
  (Abgrenzung zu vOffice mit 4 %).
- **Skalierung nur über Einheiten:** Preis skaliert ausschließlich über die Anzahl
  verwalteter Unterkünfte (günstiger Festpreis für 1–5 Häuser, auch bei 10+ für
  kleine Unternehmen bezahlbar).

### 7.2 Universelles Unterkunfts-Ökosystem (Cross-Over-SaaS)

Modulare Datenstruktur für **jede Art von Kurzzeitvermietung weltweit**. Ein
primäres **Beherbergungs-Typ-Dropdown** beim Anlegen passt Checklisten und
Shortcodes automatisch an:

- **Klassische Ferienhäuser & Urlaubs-Appartements:** Schlüsselboxen,
  Hausspezifikationen (BFE-Nummer DK), große Endreinigungen, saisonale Event-Preise,
  Abrechnung mit privaten Eigentümern.
- **Glamping & Tiny Houses:** Felder für Außenanlagen, Whirlpool-/Saunawartung,
  Brennholz-Zusatzleistungen, wetterabhängige Sonder-Saisonzeiten.
- **Wohnmobilstellplätze & Camping-Pitches:** reduzierte PMS-Struktur, rein digital
  (Check-in via QR-Code, automatische Stellplatz-Zuweisung, Schranken-Öffnungscodes
  in automatisierter SMS/E-Mail).
- **Hausboote / Floating Homes:** Onboarding für Liegeplatz-Vorschriften, technische
  Einweisungen (Fäkalientank, Stromversorgung), spezialisierte Handwerker-
  Notfallkontakte.
