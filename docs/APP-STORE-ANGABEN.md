# Store-Angaben und Review-Notes — zum Abtippen bei der Einreichung

Begleitdokument zu `docs/APP-STORE-RECHTLICH.md`. Dort steht, WAS verlangt wird;
hier stehen die fertigen Antworten, damit bei der Einreichung nichts geraten wird.
Die Angaben sind gegen den Code geprüft (Abhängigkeiten, Privacy Manifest,
Berechtigungen), nicht geschätzt.

Drei Apps = drei vollständige Sätze (ADR-0022). Vertauschen ist ein
Ablehnungsgrund, weil Apple das Privacy Label gegen das Manifest im jeweiligen
Binary prüft — und weil die drei Apps unterschiedlich viel dürfen: die
Eigentümer-App hat bewusst KEINE Kamera- und Medienberechtigung, ein von
myNextDays kopierter Satz würde also Zugriffe angeben, die es im Binary nicht
gibt.

**Reihenfolge (Stand 03.09.2026):**

| # | App | Bundle | Stand |
|---|-----|--------|-------|
| 1 | myNextDays | `com.mynextdays.app` | bei Google Play **in Prüfung** (seit 31.08.2026) |
| 2 | myNextDays Eigentümer | `com.mynextdays.owner` | **als nächstes** — Abschnitt 2 |
| 3 | myBestDays | `com.mybestdays.app` | danach — Abschnitt 3 (Vorarbeit) |

Das Play-Konto ist mit dem Firebase-Projekt verbunden (03.09.2026). Das gilt auf
PROJEKT-Ebene; jede App braucht zusätzlich ihre eigene Registrierung je
`applicationId`, sonst findet das google-services-Plugin keinen Client.

Abschnitt 3 zu myBestDays ist Vorarbeit — dort ist im Code noch nichts umgesetzt
(kein Löschweg, kein Rechtliches-Abschnitt, Privacy Manifest noch leer). Die
Angaben dort erst verwenden, wenn die App gebaut ist; sonst steht im
Store-Formular etwas, was das Binary nicht hergibt.

Ein Fund an App 1 gilt für alle drei: die erste App eines Kontos durchläuft die
volle Konto- und DSA-Prüfung, die folgenden erben sie. Also erst an App 1
beheben, dann App 2 einreichen — sonst wird derselbe Mangel dreimal abgelehnt.

---

## 1. myNextDays (`mobile-nextdays`, Bundle `com.mynextdays.app`)

### Kategorie und Einordnung
- Primär: Wirtschaft (Business) · Sekundär: Produktivität
- Altersfreigabe: 4+ / Alle Altersgruppen — kein nutzergenerierter öffentlicher
  Inhalt, kein Chat zwischen Fremden (die Gast-Korrespondenz ist geschäftlich
  und läuft über das Portal des Betriebs)
- Zielgruppe (Google): Nein, nicht für Kinder
- Anmeldung erforderlich: ja

### Datenschutz-Angaben (Apple „App Privacy" / Google „Data Safety")
Deckungsgleich mit `ios/MyNextDays/PrivacyInfo.xcprivacy`:

| Datenart | erhoben | mit Identität verknüpft | für Tracking | Zweck |
|---|---|---|---|---|
| E-Mail-Adresse | ja | ja | nein | App-Funktionalität |
| Name | ja | ja | nein | App-Funktionalität |
| Telefonnummer | ja | ja | nein | App-Funktionalität |
| Nutzer-ID | ja | ja | nein | App-Funktionalität |
| Andere Nutzerinhalte (Nachrichten, Notizen, Storno-Gründe) | ja | ja | nein | App-Funktionalität |
| Andere Daten (Gast-/Buchungsdaten des Betriebs) | ja | ja | nein | App-Funktionalität |
| **Fotos** | ja | ja | nein | App-Funktionalität (Fotonachweis an Aufgaben) |
| **Geräte- oder andere IDs** | ja | ja | nein | App-Funktionalität (Push-Zustellung) |
| **Absturzprotokolle** | ja | **nein** | nein | Fehlerbehebung |

Die letzten drei Zeilen sind am 31.08.2026 dazugekommen, nachdem ein Abgleich
gegen den Code drei Abweichungen fand. Sie standen vorher als „nicht erhoben"
in dieser Datei — eine Data-Safety-Erklärung, die vom Binary abweicht, ist ein
Sperrgrund, und niemandem wäre es aufgefallen:
- **Fotos**: `android/app/src/main/AndroidManifest.xml` deklariert `CAMERA`,
  `lib/foto.ts` nimmt auf bzw. wählt aus, `lib/tasks.ts` lädt als `FormData`
  hoch (`uploadTaskPhoto`/`uploadChecklistPhoto`), genutzt in
  `screens/TaskDetail.tsx` für Checklisten-Pflichtfotos. Das Foto hängt an einer
  Aufgabe eines Betriebs, ist also mit Identität verknüpft. `READ_MEDIA_*`
  bleibt bewusst NICHT deklariert (System-Photo-Picker liefert die URI ohne
  Leserecht) — das ist kein Widerspruch, die Berechtigung ist etwas anderes als
  die Datenart.
- **Geräte-IDs**: `lib/push.ts` (`tokenMelden`) sendet das FCM-Gerätetoken per
  `PUT /notification-settings/push-geraet` über `lib/api.ts`, also im
  Auth-Kontext des angemeldeten Nutzers → verknüpft. Gegenzustand vorhanden:
  `pushAbmelden()` beim Logout (Wurzel 1).
- **Absturzprotokolle**: `lib/absturzmeldung.ts` sendet seit dem 30.08.2026
  `POST /api/v1/diagnostics/startabsturz` mit Stacktrace (max. 4000 Zeichen),
  Komponentenkette, Plattform, Android-Version und Laufzeit seit Prozessstart —
  bewusst ohne Token, also NICHT mit dem Konto verknüpft.

Nicht erhoben, und das ist belegbar (Abhängigkeiten geprüft: React Navigation,
supabase-js, Keychain, Gesture Handler, Safe Area, Screens, SVG, URL-Polyfill;
Firebase nur `app` + `messaging` — kein Analytics-, Werbe- oder Crash-SDK):
- kein Standort (keine `ACCESS_*_LOCATION`, kein `Geolocation`-Aufruf; die
  lat/lng in `lib/reservations.ts` sind die des OBJEKTS, nicht des Geräts)
- keine Kontakte, keine Gesundheitsdaten, keine Fotomediathek-Leseberechtigung
- keine Nutzungs-/Verhaltensdaten (kein Analytics; die Absturzprotokolle oben
  sind Fehlerbehebung, kein Nutzungsprofil)
- **kein Tracking** → kein ATT-Dialog, im Data-Safety-Formular „Keine Daten für
  Werbung oder Marketing geteilt"

Datenübertragung: verschlüsselt (HTTPS/TLS). Datenlöschung: ja, in der App
möglich (siehe unten) — plus Web-Weg.

### Pflicht-URLs
- Datenschutz: `https://www.mynextdays.com/datenschutz`
- Nutzungsbedingungen: `https://www.mynextdays.com/agb`
- Support: `https://www.mynextdays.com/hilfe`
- Konto-Löschung (Google-Pflichtfeld): die öffentliche Löschseite auf der
  Marketing-Domain — **wird separat gebaut**, URL hier eintragen, sobald sie
  steht. Bis dahin ist das Google-Formular nicht abschließbar.

### Konto-Löschung: was der Reviewer sieht
In der App: **Konto → ganz unten → „Konto löschen"** (Abschnitt „KONTO LÖSCHEN").
Der Ablauf ist zweistufig: Erklärung inklusive Aufbewahrungshinweis, dann Eingabe
des aktuellen Passworts.

Zwei Ergebnisse, je nach Rolle des angemeldeten Nutzers:
- Mitarbeiter, Reinigungskraft, Eigentümer, Co-Admin → Zugang wird **sofort**
  gelöscht, die App meldet sich ab.
- Kontoinhaber (Rolle `admin`) → es entsteht ein **Löschantrag**, weil an diesem
  Konto der gesamte Betrieb hängt (Objekte, Buchungen, Portalverbindungen,
  Auszahlungen) und Belege gesetzlich 5 Jahre aufzubewahren sind. Der Antrag ist
  in der App sichtbar und zurückziehbar.

Das ist mit 5.1.1(v) vereinbar: die Richtlinie verlangt, dass der Nutzer die
Löschung *initiieren* kann. Falls der Reviewer nachfragt, ist genau das die
Antwort — zusammen mit dem Hinweis auf die Buchführungspflicht.

### Review-Notes (Text zum Einfügen)

**Welcher Mandant** (live gegengeprüft am 19.08.2026):

| Mandant | `is_demo` | Objekte | Buchungen | Aufgaben | für die Prüfung |
|---|---|---|---|---|---|
| Nordlicht Ferienvermietung | **true** | 8 | 242 | 105 | **ja** |
| Hotel Seeblick Warnemünde | false | 12 | 0 | 128 | nein |

Nordlicht ist die richtige Wahl, und zwar aus zwei unabhängigen Gründen:

1. **Nur dort greift der Schreibschutz.** Das Demo-Gate liest
   `tenants.is_demo` (`features/auth/demo_gate.py`). Bei Seeblick steht dort
   `false` — ein Prüfer könnte dort echte Daten verändern.
2. **Nur dort sieht der Prüfer etwas.** Seeblick hat 0 Buchungen; Posteingang,
   Kalender und Buchungsdetail wären leer. Eine leere App ist ein
   Ablehnungsgrund.

Konto: `merle.ahrens@mynextdays.com` (Rolle `admin`). Das Passwort steht
bewusst NICHT in dieser Datei (Repo-Regel: keine echten Zugangsdaten in
Repo-Dateien) — beim Einreichen direkt ins Store-Formular eintragen.

```
Demo-Zugang:
  E-Mail:   merle.ahrens@mynextdays.com
  Passwort: <beim Einreichen eintragen>

Bitte beachten: Der Demo-Zugang ist ein Vorführ-Mandant und absichtlich
schreibgeschützt. Schreibende Aktionen (Buchung anlegen, Preise ändern) werden
vom Server mit einer Meldung abgelehnt — das ist kein Fehler, sondern schützt
die echten Betriebsdaten. Ein Band am oberen Rand weist darauf hin. Für eine
Prüfung mit Schreibrechten senden wir gern einen zweiten Zugang.

Zahlungen / In-App-Kauf:
Diese App verkauft nichts. Sie ist das mobile Frontend eines
Business-Abonnements, das ausschließlich direkt an Betriebe (Unternehmen)
verkauft wird — Guideline 3.1.3(c) Enterprise Services. In der App gibt es keine
Kaufaufforderung und keinen Link zu einem Kaufvorgang.

Die Funktion „Zusatzleistungen" erfasst reale Leistungen, die ein Betrieb SEINEM
GAST vor Ort verkauft (Reinigung, Wäschepaket, Frühstück). Das ist ein
Geschäftsvorgang zwischen Betrieb und Gast außerhalb der App, kein digitaler
Inhalt für den App-Nutzer — Guideline 3.1.3(e). Es fließt kein Geld über diese
App.

Konto-Löschung:
Konto → „Konto löschen" (unten). Für Mitarbeiter-Konten wird sofort gelöscht. Für
den Kontoinhaber entsteht ein Löschantrag, weil an seinem Konto der gesamte
Betrieb hängt und Buchungsbelege nach dänischem Recht 5 Jahre aufzubewahren sind
(bogføringsloven). Der Antrag ist in der App sichtbar und kann dort
zurückgezogen werden.

Zielgruppe:
Gewerbliche Nutzer (Ferienhausvermieter, Hotels). Kein nutzergenerierter
öffentlicher Inhalt, kein Tracking, keine Werbung.
```

---

## 2. myNextDays Eigentümer (`mobile-owner`, Bundle `com.mynextdays.owner`)

Die zweite Einreichung (ADR-0022). Dieser Satz ist NICHT von Abschnitt 1
abgeleitet, sondern gegen `mobile-owner/` geprüft — die App darf bewusst
weniger, und ein kopierter Satz würde Zugriffe angeben, die es im Binary nicht
gibt.

### Kategorie und Einordnung
- Primär: Wirtschaft (Business) · Sekundär: Finanzen
- Altersfreigabe: 4+ / Alle Altersgruppen — kein nutzergenerierter öffentlicher
  Inhalt, kein Chat
- Zielgruppe (Google): Nein, nicht für Kinder
- Anmeldung erforderlich: ja (Eigentümer-Rolle; eine andere Rolle bekommt den
  Hinweis-Screen `FalscheRolle`, keinen Zugang)

### Datenschutz-Angaben
Deckungsgleich mit `ios/MyNextDaysOwner/PrivacyInfo.xcprivacy`:

| Datenart | erhoben | mit Identität verknüpft | für Tracking | Zweck |
|---|---|---|---|---|
| E-Mail-Adresse | ja | ja | nein | App-Funktionalität |
| Name | ja | ja | nein | App-Funktionalität |
| Telefonnummer | ja | ja | nein | App-Funktionalität |
| Nutzer-ID | ja | ja | nein | App-Funktionalität |
| Andere Nutzerinhalte (Sperrantrag-Begründung, Zählerstand) | ja | ja | nein | App-Funktionalität |
| Andere Daten (Objekt-/Buchungsdaten des Eigentümers) | ja | ja | nein | App-Funktionalität |
| Geräte- oder andere IDs | ja | ja | nein | App-Funktionalität (Push-Zustellung) |
| Absturzprotokolle | ja | **nein** | nein | Fehlerbehebung |

**Der Unterschied zu myNextDays: KEINE Fotos.** Im Store-Formular gehört hier
„nicht erhoben", und das ist belegt, nicht angenommen:
`android/app/src/main/AndroidManifest.xml` deklariert ausschließlich `INTERNET`
und `POST_NOTIFICATIONS` — kein `CAMERA`, kein `READ_MEDIA_*`; es gibt keinen
Picker und kein `lib/datei.ts` (die Datei fehlt absichtlich, die CI prüft das);
kein Aufrufer erzeugt ein `FormData` (`lib/api.ts` KANN es, niemand nutzt es);
und `screens/Fotoalbum.tsx` zeigt mit `<Image source={{uri}}>` nur Server-URLs
an. Anzeigen ist kein Erheben. Das Privacy Manifest trug die Foto-Zeile
zunächst aus der Kopiervorlage und wurde am 03.09.2026 korrigiert — eine
Angabe, die das Binary nicht hergibt, ist bei Apple ein Sperrgrund, nicht die
sichere Seite.

Nicht erhoben (Abhängigkeiten geprüft: React Navigation, supabase-js, Keychain,
Gesture Handler, Safe Area, Screens, SVG, URL-Polyfill; Firebase nur `app` +
`messaging` — kein Analytics-, Werbe- oder Crash-SDK):
- kein Standort, keine Kontakte, keine Gesundheitsdaten, keine Fotos
- keine Nutzungs-/Verhaltensdaten
- **kein Tracking** → kein ATT-Dialog

Zu den Beträgen: die Eigentümer-API maskiert Geldwerte serverseitig
(`payout: null`), die App zeigt dann „—". Das ändert die Datenarten oben nicht,
ist aber die Antwort auf eine Reviewer-Rückfrage nach Finanzdaten.

Datenübertragung: verschlüsselt (HTTPS/TLS).

### Pflicht-URLs
Aus `lib/rechtliches.ts` (Basis `https://www.mynextdays.com`), in der App unter
„Mehr → Rechtliches" verlinkt:
- Datenschutz: `/datenschutz` · Nutzungsbedingungen: `/agb`
- Auftragsverarbeitung: `/auftragsverarbeitung` · Cookie-Richtlinie:
  `/cookie-richtlinie` · Impressum: `/impressum`
- Kontakt: `info@mynextdays.dk`, `+4593903991`

### OFFEN vor der Einreichung — Konto-Löschung
**Die App hat keinen Löschweg.** `mobile-nextdays` hat
`lib/konto.ts → kontoLoeschen()`; in `mobile-owner` existiert weder die
Funktion noch ein Konto-Screen (`screens/Mehr.tsx` bietet Konto, App-Wechsel,
Rechtliches, Abmelden — kein Löschen). Google verlangt für Apps mit
Konto-Anmeldung einen Löschweg IN der App oder eine öffentlich erreichbare
Löschseite.

Der Web-Weg ist vorhanden und live geprüft:
`https://mynextdays.com/konto-loeschen` (200, trägt das Formular). Damit ist die
Einreichung formal möglich. Zu entscheiden ist, ob das reicht oder ob der
In-App-Weg nachgezogen wird — beim Eigentümer ist die Frage nicht rein
formal: sein Konto hängt an Objekten eines Betriebs, „Konto löschen" darf also
nicht die Objektzuordnung mitreißen (Wurzel 1). Der Löschpfad der PMS-App ist
deshalb nicht ungeprüft übernehmbar.

### Weiter offen (aus ADR-0022)
- Firebase-App für `com.mynextdays.owner` (Android + iOS) — die Play↔Firebase-
  Verbindung besteht auf Projektebene, die App-Registrierung je
  `applicationId` fehlt noch.
- Release-Keystore + die drei `MYNEXTDAYSOWNER_RELEASE_*`-Secrets.
- Screenshots (eigener Satz; die der PMS-App zeigen andere Oberflächen).
- Store-Beschreibung: Zielgruppe ist der Eigentümer, nicht der Betrieb.
- Eigenes App-Icon (derzeit die myNextDays-Assets, im Launcher nicht
  unterscheidbar).

---

## 3. myBestDays (`mobile-bestdays`, Bundle `com.mybestdays.app`) — VORARBEIT

> Diese App ist noch nicht umgesetzt. Der Abschnitt hält die Recherche fest,
> damit sie nicht zweimal gemacht werden muss. Vor der Einreichung müssen erst
> Löschweg, Rechtliches-Abschnitt, Privacy Manifest und
> `ITSAppUsesNonExemptEncryption` gebaut sein.

### Kategorie und Einordnung
- Primär: Reisen · Sekundär: Lifestyle
- Altersfreigabe: 4+ / Alle — Bewertungen sind nutzergenerierter Inhalt;
  Moderation und Meldeweg müssen im Formular angegeben werden
- Zielgruppe (Google): Nein, nicht für Kinder
- Anmeldung erforderlich: nein zum Stöbern, ja zum Buchen

### Datenschutz-Angaben (noch NICHT im Manifest hinterlegt)
So muss `ios/MyBestDays/PrivacyInfo.xcprivacy` künftig aussehen — momentan steht
dort ein leeres `NSPrivacyCollectedDataTypes`:

| Datenart | erhoben | verknüpft | Tracking | Zweck |
|---|---|---|---|---|
| E-Mail-Adresse | ja | ja | nein | App-Funktionalität |
| Name | ja | ja | nein | App-Funktionalität |
| Telefonnummer | ja | ja | nein | App-Funktionalität |
| Nutzer-ID | ja | ja | nein | App-Funktionalität |
| Andere Nutzerinhalte (Nachrichten, Bewertungen) | ja | ja | nein | App-Funktionalität |
| Ungefährer Standort | ja | **nein** | nein | App-Funktionalität |

Zum Standort: `lib/standort.ts` fragt bewusst nur den GROBEN Standort ab, für die
Umkreissuche „In der Nähe". Er geht als Query-Parameter in die Suchanfrage, wird
nicht gespeichert, nicht geloggt und nicht dem Konto zugeordnet — deshalb
„erhoben, aber nicht verknüpft". „Nicht erhoben" wäre falsch, „präzise" wäre
übertrieben.

Kein Tracking, keine Werbe-SDKs, keine Diagnose-Daten.

### Pflicht-URLs
Gleiche Domain wie oben (ein Anbieter, dieselben Rechtsdokumente):
Datenschutz, Nutzungsbedingungen, Support, Konto-Löschungs-URL.

### Konto-Löschung (zu bauen)
Vorgesehen: **Profil → „Konto löschen"** unterhalb von „Abmelden", sofortige
Löschung nach Passwort-Eingabe (am Gast-Login hängt kein Beleg), mit dem Hinweis
VOR der Bestätigung, dass bereits getätigte Buchungen beim Gastgeber bestehen
bleiben — die Buchung ist ein Vertrag und unterliegt Aufbewahrungsfristen.
Backend-Endpunkt und App-Baustein existieren noch nicht.

### Review-Notes (Text zum Einfügen)

```
Demo-Zugang:
  E-Mail:   <Gast-Testkonto eintragen>
  Passwort: <Passwort eintragen>

Stöbern und Suchen funktionieren ohne Anmeldung; für Buchung, Wunschliste und
Nachrichten ist ein Gast-Konto nötig.

Zahlungen / In-App-Kauf:
Gebucht werden Übernachtungen — reale Leistungen, die außerhalb der App
erbracht werden. Guideline 3.1.3(e) verlangt dafür ausdrücklich ANDERE
Zahlungswege als In-App-Kauf. Es werden keine digitalen Inhalte oder Funktionen
in der App verkauft.

Standort:
Die Berechtigung wird ausschließlich für die Umkreissuche („In der Nähe")
abgefragt, nur grob, und die Position wird nicht gespeichert. Die App
funktioniert vollständig ohne diese Berechtigung.

Konto-Löschung:
Profil → „Konto löschen". Nach Passwort-Eingabe wird das Konto sofort gelöscht.
Bereits getätigte Buchungen bleiben beim jeweiligen Gastgeber, weil sie ein
Vertrag sind und gesetzlichen Aufbewahrungsfristen unterliegen; darauf wird vor
der Bestätigung hingewiesen.
```

---

## 4. Was vor der ERSTEN Einreichung von myNextDays noch fehlt (kein Code)

1. **Händler-Status (DSA)** bei Apple und Google verifiziert — sonst wird die App
   in der EU nicht ausgeliefert bzw. automatisch entfernt. Wochen Vorlauf.
2. ~~**D-U-N-S-Nummer**~~ — vorhanden: **306835924**. Damit entfaellt der
   laengste Vorlauf (die Beantragung dauert bis zu 30 Tage).
3. ~~**Öffentliche Lösch-Seite** auf der Marketing-Domain~~ — **gebaut**
   (Commit 7a785ee5, Slice `account_deletion` + `marketing/app/konto-loeschen`,
   Migration 0413 live). Die Adresse für das Formular ist
   `https://mynextdays.com/konto-loeschen`. **Live gegengeprüft am 30.08.2026:**
   200, und die Seite trägt wirklich das Löschformular (Überschrift „Konto
   löschen" + E-Mail-Feld), ist also kein 200 auf einer Fehlerseite. Ebenfalls
   200: `/datenschutz`, `/agb`, `/hilfe`.
4. ~~**Demo-Zugänge**~~ — vorhanden, siehe die Tabelle in Abschnitt 1. Offen ist
   nur das Passwort im Store-Formular.
5. ~~**Screenshots** je Gerätegröße, je App~~ — für myNextDays/Telefon
   **erledigt**: sechs Stück, 1080 × 1920, in `docs/store-assets/screenshots/`,
   samt Aufnahmeanleitung in `docs/PLAY-STORE-LISTING.md`. Offen bleibt: die
   Tablet-Größen (Play verlangt für die Aufnahme in Empfehlungsformate auf
   großen Bildschirmen mindestens 4 Bilder im Verhältnis 16:9/9:16) und der
   ganze Satz für myBestDays. Die sichtbaren Kanal-Kennzeichen von
   Booking.com/Airbnb/Vrbo sind eine sachliche Herkunftsanzeige; die
   Ersatz-Aufnahme ohne sie ist in der Listing-Datei beschrieben.
6. Für myBestDays zusätzlich: **WCAG-2.1-AA-Durchgang** und
   Barrierefreiheitserklärung (European Accessibility Act, seit 28.06.2025), die
   DSA-/P2B-Texte für Gastgeber sowie die Registrierungsnummer der Unterkunft
   nach EU-Verordnung 2024/1028 (Frist 20.05.2026 verstrichen).
