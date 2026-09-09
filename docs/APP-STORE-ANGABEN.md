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
| 2 | myNextDays Eigentümer | `com.mynextdays.owner` | **als nächstes** — Abschnitt 2; Symbol, Texte, Löschweg und UGC-Wege stehen seit 09.09.2026, offen sind nur die Screenshots |
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
- Konto-Löschung (Google-Pflichtfeld): `https://mynextdays.com/konto-loeschen`
  — **gebaut und live** (Commit 7a785ee5, Slice `account_deletion`, Migration
  0413). Zuletzt gegengeprüft am 09.09.2026: 200, und die Seite trägt wirklich
  das Formular (Überschrift „Konto löschen" + E-Mail-Feld), ist also kein 200
  auf einer Fehlerseite. Hier stand bis dahin „wird separat gebaut" — schon
  seit Abschnitt 4 dasselbe Dokument das Gegenteil sagte.

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
- Altersfreigabe: niedrigste Stufe (Google „Alle Altersgruppen" / IARC 3+),
  **aber mit dem interaktiven Element „Nutzer interagieren"**.
- Zielgruppe (Google): Nein, nicht für Kinder
- Anmeldung erforderlich: ja (Eigentümer-Rolle; eine andere Rolle bekommt den
  Hinweis-Screen `FalscheRolle`, keinen Zugang)

**Korrektur vom 09.09.2026 — hier stand „kein Chat", und das stimmt seit 0611
nicht mehr.** Die App hat einen Eins-zu-eins-Chat zwischen Eigentümer und
Verwaltung (ADR-0029). Was das für die Einstufung heißt, gegen die Quelle
geprüft und nicht angenommen:

- Die **Alterskategorie selbst ändert sich nicht.** Sie ergibt sich aus dem
  INHALT (Gewalt, Sexualität, Glücksspiel, Drogen, Schimpfwörter) — nichts
  davon kommt vor. Ein Chat ist im IARC-Fragebogen kein Inhalt, sondern ein
  *interaktives Element*; er wird gesondert abgefragt und als Zusatz
  ausgewiesen, nicht in die Alterszahl eingerechnet. Zum Vergleich nennt die
  ESRB für Nicht-Spiele soziale Netze mit Nutzeraustausch „Teen" — dort trägt
  aber der öffentliche, ungefilterte Inhalt Fremder die Einstufung, den es hier
  nicht gibt (geschlossener Kreis, zwei bekannte Parteien, keine Nutzersuche).
- Die Frage „Können Nutzer miteinander kommunizieren oder Inhalte
  austauschen?" ist mit **JA** zu beantworten. Ergebnis: das Element
  „Nutzer interagieren" erscheint am Eintrag. Sie mit „nein" zu beantworten,
  weil die Kommunikation geschäftlich ist, wäre eine Falschangabe — die
  Richtlinie kennt dafür keine Ausnahme.
- **Das teurere Ergebnis derselben Prüfung** steht nicht in der
  Alterseinstufung, sondern in der UGC-Richtlinie — siehe den eigenen Abschnitt
  „Nutzergenerierte Inhalte" weiter unten.

### Datenschutz-Angaben
Deckungsgleich mit `ios/MyNextDaysOwner/PrivacyInfo.xcprivacy`:

Die Zeilen tragen Googles eigene Datenart-Namen (Play Console Help
„Data types and purposes", geprüft am 09.09.2026), nicht selbst gewählte —
das Formular kennt keine anderen.

| Google-Kategorie → Datenart | erhoben | mit Identität verknüpft | für Tracking | Zweck | Beleg im Binary |
|---|---|---|---|---|---|
| Personal info → **Email address** | ja | ja | nein | App-Funktionalität | `lib/auth.ts` (Anmeldung) |
| Personal info → **Name** | ja | ja | nein | App-Funktionalität | `sender_name` an jeder Chat-Nachricht |
| Personal info → **User IDs** | ja | ja | nein | App-Funktionalität | jeder Aufruf über `lib/api.ts` im Auth-Kontext |
| **Messages → Other in-app messages** | ja | ja | nein | App-Funktionalität | `lib/chat.ts` → `POST /public-portal/chat/objekt/{id}` |
| Photos and videos → **Photos** | ja | ja | nein | App-Funktionalität | `lib/chat-bild.ts` + `POST /owner-chat/bilder` |
| App activity → **Other user-generated content** | ja | ja | nein | App-Funktionalität | Notiz am Sperrantrag, Zählerstand, Meldegrund |
| App info and performance → **Crash logs** | ja | **nein** | nein | Fehlerbehebung | `lib/absturzmeldung.ts` (bewusst ohne Token) |
| **Device or other IDs** | ja | ja | nein | App-Funktionalität | `lib/push.ts` → `PUT /notification-settings/push-geraet` |

**Zwei Änderungen am 09.09.2026, beide gegen das Binary geprüft:**

1. **„Messages → Other in-app messages" ist NEU und war die gefährlichere
   Lücke.** Googles Datenart-Liste führt Chat-Inhalte als eigene Kategorie
   („Any other types of messages. For example, instant messages or chat
   content"). Sie unter „Andere Nutzerinhalte" laufen zu lassen, wie es hier
   stand, ist eine Falschangabe — und zwar die Sorte, die niemandem auffällt.
   Dass der Inhalt Ende-zu-Ende verschlüsselt ist, ändert daran nichts: er
   verlässt das Gerät, und genau das ist Googles Kriterium.
2. **„Telefonnummer" ist RAUS.** Sie stand hier als „erhoben", das Binary gibt
   sie aber nicht her: `mobile-owner` sendet nirgends eine Telefonnummer.
   Gegengeprüft wurden alle schreibenden Aufrufe der App (`lib/auth.ts`,
   `lib/push.ts`, `lib/ownerPortal.ts`, `lib/chat.ts`,
   `lib/absturzmeldung.ts`). Was es gibt, ist eine MASKIERTE Nummer, die der
   Server für die SMS-Zweitfaktor-Anzeige zurückschickt (`mfa_phone_masked`) —
   empfangen ist nicht erhoben, und `lib/mfa-login.ts` schickt eine `factor_id`,
   keine Nummer. Über-Deklaration ist derselbe Fehler wie Unter-Deklaration:
   das Formular soll beschreiben, was die App TUT.

**Fotos: seit dem 09.09.2026 JA** — im Store-Formular „Fotos oder Videos:
erhoben, mit dem Konto verknüpft, kein Tracking, Zweck App-Funktionalität".

Was sich geändert hat: Der Chat mit der Verwaltung (0611, ADR-0029) hat einen
Bild-Anhang. Damit trägt die App `CAMERA` im `AndroidManifest.xml`,
`NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` in der
`Info.plist`, `NSPrivacyCollectedDataTypePhotosorVideos` im Privacy Manifest
und `react-native-image-picker` als Abhängigkeit — `lib/chat-bild.ts` ist der
eine Ort, an dem der Bildwähler angesprochen wird.

KEIN `READ_MEDIA_IMAGES`: der System-Bildwähler liefert die Auswahl über einen
temporären URI, ein Lese-Recht auf den gesamten Bildspeicher braucht die App
dafür nicht — und was sie nicht braucht, fragt sie nicht ab.

Erwähnenswert für die Formularantwort, aber KEINE andere Datenart: das Bild
verlässt das Gerät **Ende-zu-Ende verschlüsselt**. Der Server lagert
Chiffretext in einem privaten Bucket und kann ihn zu keinem Zeitpunkt ansehen.
Für Apples und Googles Zwecke bleibt es trotzdem „erhoben" — es verlässt das
Gerät, und das ist das Kriterium.

Die Vorgeschichte, damit sie nicht als Widerspruch gelesen wird: Bis zum
08.09.2026 stand hier „keine Fotos", und das war korrekt — es gab keinen
Picker, keinen Upload-Pfad und keine Berechtigung. Das Privacy Manifest trug
die Foto-Zeile fälschlich aus der Kopiervorlage und wurde am 03.09.2026
entfernt. Eine Angabe, die das Binary nicht hergibt, ist bei Apple ein
Sperrgrund, nicht die sichere Seite — jetzt gibt das Binary sie her.

Nicht erhoben (Abhängigkeiten geprüft: React Navigation, supabase-js, Keychain,
Gesture Handler, Safe Area, Screens, SVG, URL-Polyfill; Firebase nur `app` +
`messaging` — kein Analytics-, Werbe- oder Crash-SDK):
- kein Standort, keine Kontakte, keine Gesundheitsdaten
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

### Nutzergenerierte Inhalte (Googles UGC-Richtlinie) — das schärfere Gate
Nicht die Alterseinstufung ist hier das Risiko, sondern die UGC-Richtlinie.
Sie sagt wörtlich (Play Console Help „User Generated Content", 09.09.2026):

> „Apps featuring UGC that identify a specified set of users through means such
> as user verification or offline registration (for example, apps exclusively
> used within a specific school or company, etc.) must provide in-app
> functionality to **report content and users**."

> „UGC features that enable 1:1 user interaction with specific users (for
> example, direct messaging, tagging, mentioning, etc.) must provide an in-app
> functionality for **blocking users**."

Beide Sätze treffen diese App: geschlossener, eingeladener Nutzerkreis UND
Direktnachricht zwischen genau zwei Seiten. Eine Ausnahme für geschäftliche
Kommunikation nennt die Richtlinie nicht — wer sich darauf beruft, riskiert
eine Prüfrunde.

**Gebaut am 09.09.2026 (Migration 0615):**
- **Melden** — im Chat über „Optionen" oder langen Druck auf eine Nachricht.
  Vier Gründe, Freitext optional. Die Meldung geht an UNS, nicht an die
  Verwaltung; sie erfährt nichts davon.
- **Gespräch beenden** — das Gegenstück zum „Blockieren". Die Verwaltung der
  eigenen Objekte wegzublocken wäre fachlich unmöglich (sie ist der einzige
  Draht zu dem Betrieb, dem das Haus anvertraut ist); der Ausstieg aus dem
  Gespräch ist es nicht. Danach nimmt der Server nichts mehr an (409), das
  Eingabefeld verschwindet, und der Weg zurück steht daneben.

**Formularantwort zur Moderation, falls gefragt:** Der Inhalt ist Ende-zu-Ende
verschlüsselt (ADR-0029); der Server hat Chiffretext und kann eine gemeldete
Nachricht nicht lesen. Moderiert wird über die Metadaten — wer meldet wen, wie
oft, in welchem Gespräch — und über die Beschreibung des Melders. Das ist die
„moderation … as is reasonable and consistent with the type of UGC hosted",
die die Richtlinie verlangt. Diese Antwort gehört in die Review-Notes; sie
nicht zu geben, wäre die schlechtere Wahl als sie zu erklären.

### Konto-Löschung — seit dem 09.09.2026 IN der App
Hier stand „Die App hat keinen Löschweg". Das stimmt nicht mehr.

**Was der Reviewer sieht:** Menü → ganz unten → Abschnitt „KONTO LÖSCHEN" →
„Konto löschen". Zweistufig: erst die Erklärung samt Folgen, dann das aktuelle
Passwort (`components/KontoLoeschenBlock.tsx`, `lib/konto.ts`). Für einen
Eigentümer wird SOFORT gelöscht — er ist nie Kontoinhaber; wäre er es, hätte
ihn `screens/FalscheRolle.tsx` gar nicht hereingelassen.

**Zur Formalie:** Googles Anforderung greift, wenn eine App Konto-Anlage
anbietet oder dorthin führt („or if the app directs the user to an app account
creation flow outside of the app"). Diese App tut beides nicht — Eigentümer
werden von ihrem Betrieb eingeladen, `screens/Anmelden.tsx` hat keinen
Registrierweg und keinen Verweis darauf. Der Web-Weg
`https://mynextdays.com/konto-loeschen` (live geprüft am 09.09.2026: 200, trägt
das Formular mit Überschrift und E-Mail-Feld) hätte also genügt. Gebaut wurde
der In-App-Weg trotzdem, aus zwei Gründen, die beide nichts mit dem Formular zu
tun haben: Die Löschseite behauptet wörtlich „In der App findest du die
Löschung unter Profil → Konto" — für DIESE App war das falsch. Und der
Gegenzustand (siehe unten) fehlte auch dem Web-Weg.

**Der Gegenzustand, gegen die Datenbank gemessen (Wurzel 1):** Wird die
`users`-Zeile eines Eigentümers gelöscht, tun zwei Fremdschlüssel das Falsche.
`block_requests.requested_by` kaskadiert, `availability.block_request_id` (0337)
und `reservations.block_request_id` (0353) stehen dagegen auf `set null` — der
Antrag verschwindet, die von ihm GESPERRTEN NÄCHTE bleiben, und der einzige
Anker für ihre Freigabe ist weg. Und `owner_family_members` kaskadiert über
`owner_user_id`, die `owner_property_assignments` der Familienmitglieder aber
nicht — die Familie behielte die Objekt-Sicht. Beides schließt
`account_deletion/in_app.py` seit dem 09.09.2026, VOR dem Löschen des Logins.

**Was ausdrücklich NICHT mitgelöscht wird** (und die Antwort auf eine
Reviewer-Rückfrage nach „Vertragsdaten"): `owners.user_id` steht auf
`on delete set null`. Die verwaltete Eigentümer-PARTEI, ihre Bankverbindung,
`owner_properties` samt Anteil und die gesamte Abrechnungshistorie überleben.
Gelöscht wird ein LOGIN, nicht der Vertragspartner des Betriebs.

### Weiter offen
- ~~Firebase-App für `com.mynextdays.owner`~~ — **erledigt am 03.09.2026**,
  Secret `MYNEXTDAYSOWNER_GOOGLE_SERVICES_JSON_BASE64` und
  `MYNEXTDAYSOWNER_FIREBASE_APP_ID` sind gesetzt (`gh secret list`, 09.09.2026).
- ~~Release-Keystore + Secrets~~ — **erledigt am 03.09.2026**: alle vier
  `MYNEXTDAYSOWNER_RELEASE_*` gesetzt.
- ~~Store-Beschreibung~~ — **fertig**, `docs/PLAY-STORE-LISTING-EIGENTUEMER.md`
  (de-DE und en-US).
- ~~Eigenes App-Icon~~ — **erledigt am 09.09.2026**: rote Fläche `#B82028`,
  erzeugt von `scripts/mobile/icon-eigentuemer-erzeugen.py`, Store-Symbol und
  Feature-Grafik unter `docs/store-assets/eigentuemer/`.
- **Screenshots** — Aufnahmeplan, Vorführzugang und Befehle stehen in
  `docs/PLAY-STORE-LISTING-EIGENTUEMER.md`; die Bilder selbst fehlen noch
  (Simulator und Metro startet der Nutzer).
- **Passwort des Vorführzugangs** `k.moser@example.at` — steht bewusst nicht im
  Repo, beim Einreichen direkt ins Store-Formular.

### Review-Notes (Text zum Einfügen)

**Welcher Mandant** (live gegengeprüft am 09.09.2026):

| Mandant | `is_demo` | Eigentümer-Logins | `owners` | Abrechnungen | für die Prüfung |
|---|---|---|---|---|---|
| Alpenzeit Chalets | false | 1 (`k.moser@example.at`) | 8 | 104 (13 für sie) | **ja** |
| Nordlicht Ferienvermietung | **true** | **0** | **0** | **0** | nein |

Nordlicht ist der Vorführ-Mandant der PMS-App und hier NICHT brauchbar: es gibt
dort keinen Eigentümer-Login, keine Eigentümer-Partei und keine Abrechnung —
Startseite, Kalender-Auszahlung und der Abrechnungs-Tab wären leer, und eine
leere App ist ein Ablehnungsgrund. Alpenzeit trägt 2 zugeordnete Objekte,
13 Abrechnungen, 243 künftige Buchungen und ausschließlich erfundene Namen.

Preis dafür, offen benannt: Alpenzeit ist **nicht** schreibgeschützt
(`tenants.is_demo = false`), der Demo-Riegel aus 0407 greift dort also nicht.
Auf einem synthetischen Mandanten ohne echte Gäste ist das folgenlos — und der
Prüfer kann Sperrantrag, Zählerstand und Chat wirklich ausprobieren, was bei
einem gesperrten Zugang nicht ginge.

```
Demo-Zugang:
  E-Mail:   k.moser@example.at
  Passwort: <beim Einreichen eintragen>

Diese App ist die Eigentümer-Sicht des Verwaltungssystems myNextDays. Sie
richtet sich an Menschen, die ein Ferienobjekt besitzen und es von einem
Betrieb vermieten lassen. Der Zugang wird vom Betrieb vergeben; in der App
kann man kein Konto anlegen. Wer sich mit einem Verwaltungs- oder
Mitarbeiter-Konto anmeldet, sieht einen Hinweis-Bildschirm mit dem Weg in die
Schwester-App myNextDays.

Nachrichten:
Der Chat zwischen Eigentümer und Verwaltung ist Ende-zu-Ende verschluesselt.
Wir koennen die Inhalte nicht lesen. Melden und "Gespraech beenden" stehen in
der App unter "Optionen" bzw. langem Druck auf eine Nachricht zur Verfuegung;
Meldungen erreichen uns als Metadaten (wer meldet wen, wie oft, mit welcher
Begruendung), nicht als Text.

Zahlungen / In-App-Kauf:
Diese App verkauft nichts und enthaelt keinen Kauf-Link. Angezeigte Betraege
sind die Netto-Auszahlung des Eigentuemers aus seinem Vertrag mit dem Betrieb.
Es fliesst kein Geld ueber diese App.

Konto-Löschung:
Menue -> ganz unten -> "Konto löschen". Nach Eingabe des aktuellen Passworts
wird der Zugang sofort geloescht. Bereits zugesagte, noch bevorstehende
Aufenthalte werden dabei zurueckgenommen und die Naechte freigegeben;
Abrechnungen und Bankverbindung bleiben beim Betrieb, weil sie zum Vertrag
gehoeren und Buchungsbelege nach daenischem Recht 5 Jahre aufzubewahren sind.

Zielgruppe:
Private und gewerbliche Eigentuemer von Ferienobjekten. Kein oeffentlicher
nutzergenerierter Inhalt, kein Tracking, keine Werbung.
```

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
