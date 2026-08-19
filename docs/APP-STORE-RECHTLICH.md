# App-Veröffentlichung — rechtliche und regulatorische Voraussetzungen

Stand der Recherche: 19.08.2026. Betrifft BEIDE Apps (`mobile-nextdays` =
myNextDays, B2B/PMS · `mobile-bestdays` = myBestDays, Marktplatz/Gast). Die
Pflichten unterscheiden sich zwischen den beiden erheblich — eine Verbraucher-App
ist stärker reguliert als eine B2B-App.

**UMSETZUNGSSTAND: nur myNextDays.** Gebaut ist ausschließlich in
`mobile-nextdays` und dem Betriebs-Auth-Pfad. Alles zu myBestDays steht hier als
RECHERCHE für später — in der Gast-App und im Gast-Auth-Pfad ist bewusst nichts
geändert. Wo unten „gebaut" steht, ist myNextDays gemeint.

Das hier ist eine Umsetzungs-Checkliste, keine Rechtsberatung. Die Punkte unter
„Belege" sind primäre Quellen (Apple/Google/EU), keine Sekundärliteratur.

---

## 1. Store-Blocker — ohne das ist die App nicht live (oder fliegt raus)

### 1.1 Händler-Status (DSA) bei Apple UND Google — hart erzwungen
Seit **17.02.2025** entfernt Apple Apps ohne verifizierten Händler-Status
(„trader status") automatisch aus dem App Store **aller 27 EU-Länder** — auch
bereits veröffentlichte, ohne dass an der App etwas geändert wurde. Google Play
verlangt dasselbe für jede Einreichung und jedes Update mit EU-Vertrieb.

Zu hinterlegen und zu verifizieren: Firmenname wie im Register, Adresse,
Telefonnummer, E-Mail. Diese Angaben werden im Store **öffentlich** angezeigt.

- Apple: App Store Connect → Business → Trader Status (Verifizierung dauert Tage
  bis Wochen — nicht auf den letzten Tag legen)
- Google: Play Console → Payments profile / Developer profile → Trader status
- Zusätzlich Google: **Developer-Verifizierung** wird ab September 2026
  verpflichtend (zuerst BR/ID/SG/TH, global ab 2027). Für eine Organisation ist
  dafür eine **D-U-N-S-Nummer** nötig; die beantragt man kostenlos, es dauert
  aber bis zu 30 Tage.

### 1.2 Konto-Löschung IN der App — GEBAUT (19.08.2026)
Apple 5.1.1(v): *„If your app supports account creation, you must also offer
account deletion within the app."* Google Play verlangt zusätzlich einen
**Web-Link**, über den die Löschung ohne App angefordert werden kann.

Die Ausnahme für „education, enterprise, or business app that requires the user
to sign in with an **existing** enterprise account" greift bei
`mobile-nextdays` **nicht**: die App enthält mit `screens/HostSignup.tsx` eine
eigene Registrierung. Wer registrieren kann, muss löschen können.

**Umgesetzt:**
- Betrieb: `GET/POST/DELETE /auth/account/deletion`
  (`features/account_deletion/in_app.py`). Passwort-Rückfrage über
  `AccountService.passwort_pruefen` (Wurzel 7). Rollen-Weiche: Mitarbeiter,
  Reinigungskraft, Eigentümer und Co-Admin werden SOFORT gelöscht; beim
  Kontoinhaber entsteht ein Antrag im selben Löschbuch wie beim öffentlichen
  Formular (`account_deletion_requests`, 0413), weil an seinem Konto der ganze
  Betrieb hängt und Belege 5 Jahre aufzubewahren sind. Antrag ist idempotent und
  zurückziehbar.
- App: `components/KontoLoeschenBlock.tsx`, eingehängt in `screens/HostProfile.tsx`
  unter „Konto". Zeigt den Aufbewahrungshinweis VOR der Bestätigung; ein
  laufender Antrag ersetzt den Knopf und ist dort zurückziehbar.
- Tests: `test_in_app_loeschung.py` (13 Fälle) — Rollen-Weiche, Passwort-Hürde,
  dass eine GoTrue-Störung kein „Passwort falsch" wird, kein Halbzustand mit
  funktionierendem Login, doppelte Aufrufe.

**Für myBestDays noch offen** (App ist noch nicht dran): der Gast-Löschweg. Am
Gast-Login hängt kein Beleg, dort ist die sofortige Löschung richtig — mit dem
Hinweis, dass getätigte Buchungen beim Gastgeber bleiben (Vertrag +
Aufbewahrungsfrist). Endpunkt und App-Baustein sind noch nicht gebaut.

**Offen (anderer Agent):** die öffentliche Lösch-Seite auf der Marketing-Domain.
Ihre URL ist ein Pflichtfeld im Google-Data-Safety-Formular; das Backend dafür
steht schon (`POST /account-deletion/request` + `/confirm`, Migration 0413).

### 1.3 Datenschutz-Link in der App — GEBAUT (19.08.2026)
Apple 5.1.1(i): Link zur Datenschutzerklärung **sowohl** in den App-Store-
Metadaten **als auch** „within the app in an easily accessible manner". Die
Erklärung muss benennen, welche Daten erhoben werden, wozu, an welche Dritten sie
gehen, und wie man Einwilligung widerruft bzw. Löschung verlangt.

**Umgesetzt (myNextDays):** `mobile-nextdays/lib/rechtliches.ts` trägt die
Dokument-Adressen und die Anbieterangaben, angezeigt über
`components/RechtlichesBlock.tsx` unter „Konto". Die Anbieterangaben stehen als
TEXT in der App — sie müssen auch ohne Netz lesbar sein; E-Mail und Telefon sind
antippbar.

**Für myBestDays offen:** dieselbe Datei gehört dort hin (dann als
Schwesterdatei, byte-identisch, und in die CI-Konsistenzliste — hinter beiden Apps
steht EIN Anbieter). Zusätzlich muss der Abschnitt dort AUCH ohne Anmeldung
erreichbar sein: die Pflichtangaben müssen vor Vertragsschluss vorliegen, und
gebucht wird als Gast.

### 1.4 Privacy Manifest — KORRIGIERT (19.08.2026)
`mobile-nextdays/ios/MyNextDays/PrivacyInfo.xcprivacy` trug
`NSPrivacyCollectedDataTypes` als **leeres Array** — die Aussage „diese App
erhebt keine Daten", während E-Mail, Name, Telefonnummer und Nutzerinhalte
übertragen werden. Jetzt deklariert: sechs Datenarten, verknüpft, ohne Tracking,
Zweck App-Funktionalität. Die Tabelle zum Abtippen für die Store-Formulare steht
in `docs/APP-STORE-ANGABEN.md`.

**Für myBestDays offen:** dort steht das leere Array noch. Zusätzlich zu den
Kontodaten gehört der GROBE Standort deklariert — als „erhoben, aber NICHT
verknüpft": `lib/standort.ts` schickt ihn nur als Suchparameter mit und speichert
ihn nicht. „Nicht erhoben" wäre falsch, „präzise" übertrieben.

Richtig ist `NSPrivacyTracking = false` — es sind keine Tracking-/Analytics-SDKs
verbaut (Abhängigkeiten geprüft: nur React Navigation, Supabase, Keychain,
Gesture Handler, Safe Area, Screens, SVG, URL-Polyfill). Daraus folgt
erfreulicherweise: **kein App Tracking Transparency-Dialog nötig**, und im
Play-Data-Safety-Formular ist „kein Datenteilen zu Werbezwecken" wahr.

### 1.5 App-Privacy-Angaben in den Stores
- Apple: App Privacy Details („Nutrition Label") — je Datenart: erhoben?
  verknüpft mit Identität? für Tracking? Für uns: Kontaktdaten, Nutzerinhalte,
  Identifikatoren — verknüpft, nicht für Tracking.
- Google: **Data Safety Form** inkl. der Datenlöschungs-Fragen und der
  Konto-Löschungs-URL. Neue Einreichungen werden ohne das abgelehnt, bestehende
  Apps erst verwarnt und dann entfernt.

### 1.6 Review-Zugang
Apple 2.1(a) verlangt einen Demo-Zugang oder einen vollwertigen Demo-Modus.
**Vorhanden:** der Vorführ-Mandant (`is_demo`, 0407) — der schreibgeschützte
Zugang ist genau das, was Apple akzeptiert. In die Review-Notes gehören
Zugangsdaten plus der Hinweis, dass Schreibaktionen im Demo-Modus bewusst
abgelehnt werden (sonst wirkt es wie ein Defekt und wird als Bug abgelehnt).

### 1.7 In-App-Kauf — die Begründung muss in die Review-Notes
myNextDays verkauft das Abo **außerhalb** der App (Stripe, Web). Zulässig ist das
über 3.1.3(c) „Enterprise Services": *„If your app is only sold directly by you
to organizations or groups for their employees … you may allow enterprise users
to access previously-purchased content or subscriptions."* Bedingungen:
- Die App darf **nicht** zum Kauf auffordern und keinen Kauf-Link enthalten.
- Kein Consumer-/Einzelplatz-Verkauf über die App.
- Die im Panel gebuchten **Zusatzleistungen** sind kein digitaler Inhalt für den
  App-Nutzer, sondern die Erfassung eines Geschäftsvorgangs mit einem Gast
  (Reinigung, Wäsche, Frühstück) — reale Leistungen außerhalb der App, also
  3.1.3(e) und ausdrücklich **keine** IAP-Pflicht. Das gehört erklärt, sonst
  liest der Reviewer „Zahlung außerhalb IAP" und lehnt ab.
- `mobile-bestdays` ist der kritischere Fall: Übernachtungen sind reale
  Leistungen (3.1.3(e), IAP verboten) — aber jede Servicegebühr, die wie ein
  digitaler Aufschlag aussieht, muss sauber als Teil der Reiseleistung
  ausgewiesen sein.

### 1.8 Export-Compliance-Schlüssel — GESETZT für myNextDays (19.08.2026)
`ITSAppUsesNonExemptEncryption = false` steht in
`mobile-nextdays/ios/MyNextDays/Info.plist`, mit Begründung im Kommentar: die App
verschlüsselt ausschließlich über HTTPS/TLS des Systems und die System-Keychain.
Ändert sich das (eigene Krypto, eigene Verschlüsselung von Nutzerdaten), muss der
Wert neu bewertet werden. **Für myBestDays offen** — derselbe Schlüssel, dieselbe
Begründung.

---

## 2. Rechtlich verpflichtend (EU/DK), unabhängig von den Stores

### 2.1 Anbieterkennzeichnung (Impressum)
Dänisches E-handelslov §§ 7–12 verlangt: Firmenname wie im Register,
**CVR-Nummer**, physische Adresse, E-Mail und Telefonnummer — erreichbar,
bevor ein Vertrag zustande kommt. Für die App heißt das: erreichbar **in** der
App, nicht nur auf der Website. Text existiert (`marketing/app/impressum`),
Verlinkung in der App fehlt (siehe 1.3).

### 2.2 DSGVO — Rollenverteilung ist hier der entscheidende Punkt
- Für die **Gastdaten** ist der Betrieb Verantwortlicher, myNextDays
  Auftragsverarbeiter → AVV nötig, existiert (`/auftragsverarbeitung`). Er muss
  die **Subprozessoren** vollständig und aktuell nennen: Hetzner, Supabase-Stack
  auf dem eigenen Server, Stripe, PayPal, Brevo, Mailcow/Mailserver, Channex,
  Uptime-Kuma, Borg-Backup-Ziel (Hetzner Storage Box).
- Für die **Konto-/Nutzerdaten des Betriebs** ist myNextDays selbst
  Verantwortlicher → eigene Datenschutzerklärung, Rechtsgrundlagen, Fristen.
- Drittlandtransfer: Stripe und PayPal sind US-Anbieter → Standardvertrags-
  klauseln plus Transfer-Impact-Assessment dokumentieren.
- Verzeichnis der Verarbeitungstätigkeiten, TOM-Dokumentation, Melde-Prozess für
  Datenschutzvorfälle (72 h), Betroffenenrechte-Prozess (Auskunft, Löschung,
  Datenübertragbarkeit) — Letzteres deckt sich mit 1.2 und sollte denselben
  technischen Weg nutzen.

### 2.3 Barrierefreiheit — gilt für myBestDays, nicht für myNextDays
Der European Accessibility Act ist seit **28.06.2025** in Kraft und verlangt für
verbrauchergerichtete E-Commerce-Dienste **WCAG 2.1 Level AA**, auch für mobile
Apps. Rein B2B-Dienste und geschlossene Betriebsportale fallen nicht darunter.

- `mobile-bestdays` (Gast, Marktplatz, Buchung und Zahlung) → **erfasst**.
  Nötig: WCAG-2.1-AA-Prüfung und eine Barrierefreiheitserklärung.
- `mobile-nextdays` (nur mit Tenant-Konto, Verwaltung) → nach heutiger Lesart
  außerhalb; das gehört aber dokumentiert, statt es nur anzunehmen. Die Arbeit
  ist ohnehin sinnvoll: Screenreader-Labels sind in der App bereits durchgehend
  gesetzt (`accessibilityRole`/`accessibilityLabel`).
- Kleinstunternehmen-Ausnahme (< 10 Beschäftigte UND < 2 Mio. € Umsatz) gilt für
  Dienstleistungen — prüfen, ob sie auf euch zutrifft; sie entlastet aber nicht
  von der Dokumentation.

### 2.4 Aufbewahrung vs. Löschung
Dänische Buchführungspflicht (bogføringsloven) verlangt 5 Jahre Aufbewahrung von
Belegen. Rechnungen, Zahlungen und Provisionsabrechnungen dürfen also **nicht**
mit dem Konto verschwinden. Das Löschkonzept muss trennen: Kontodaten löschen,
Belege anonymisiert aufbewahren — und die App muss das dem Nutzer beim Löschen
in einem Satz sagen.

### 2.5 Marktplatz-spezifisch (nur myBestDays)
- **DSA**: Der Marktplatz ist Vermittler → Impressum, Melde- und
  Beschwerdewege, Begründung bei Sperrungen, Transparenz zu Rankings und
  Empfehlungen, Kontaktstelle.
- **P2B-Verordnung 2019/1150**: AGB für die Gastgeber müssen Rangkriterien,
  Datenzugang, Kündigungs- und Beschwerdeverfahren offenlegen.
- **Verbraucherrecht**: Widerrufsrecht bzw. dessen Ausnahme für
  Beherbergung mit festem Termin (Art. 16 l VRRL), Preisangaben inklusive
  aller Pflichtgebühren, Bestätigungsmail mit allen Pflichtinformationen.
- **Kurzzeitmieten-Verordnung (EU) 2024/1028**: gilt ab **20.05.2026** —
  Registrierungsnummer der Unterkunft muss erhoben, angezeigt und an Behörden
  gemeldet werden. Das ist ein Datenmodell-Thema, nicht nur ein Textthema, und
  der Termin ist bereits verstrichen: Prüfen, ob `properties` ein Feld für die
  Registrierungsnummer trägt und ob der Marktplatz sie anzeigt.

---

## 3. Was in den Store-Konten zu erledigen ist (kein Code)

| Punkt | Apple | Google |
|---|---|---|
| Händler-Status (DSA) verifiziert | Pflicht | Pflicht |
| Developer-Verifizierung / D-U-N-S | Team-Konto als Organisation | ab 09/2026 Pflicht |
| Datenschutz-URL | Pflicht | Pflicht |
| Konto-Löschungs-URL | — | Pflicht |
| Data Safety / Privacy Label | App Privacy Details | Data Safety Form |
| Altersfreigabe | Fragebogen | Content Rating (IARC) |
| Support-URL, Marketing-URL | Pflicht | Pflicht |
| Zielgruppe / Kinder | Nein | „Target audience" Nein |
| Demo-Zugang in Review-Notes | Pflicht | empfohlen |
| Export-Compliance | Info.plist-Schlüssel | — |

Zwei Apps = zwei vollständige Sätze davon. Die Marken-Trennung (ADR-0019) gilt
auch hier: getrennte Store-Einträge, getrennte Datenschutz-Links, getrennte
Screenshots.

---

## 4. Reihenfolge, die ich empfehle

1. **Händler-Status** bei Apple und Google beantragen — das ist der einzige
   Punkt mit externer Wartezeit von Wochen, und ohne ihn ist alles andere
   umsonst.
2. **Konto-Löschung** bauen (Backend + App + Web-URL) — der einzige echte
   Code-Blocker.
3. **Rechtliches-Abschnitt** in beiden Apps (Datenschutz, AGB, Impressum, AVV).
4. **Privacy Manifest und Store-Privacy-Angaben** wahrheitsgemäß ausfüllen.
5. Info.plist-Schlüssel, Review-Notes mit IAP-Begründung und Demo-Zugang.
6. Für myBestDays zusätzlich: WCAG-2.1-AA-Durchgang, DSA-/P2B-Texte,
   Registrierungsnummer nach EU 2024/1028.

**Stand 19.08.2026 — myNextDays:** Punkte 2–5 sind für diese App gebaut (siehe
die Abschnitte oben), die Store-Formulare und Review-Notes liegen fertig in
`docs/APP-STORE-ANGABEN.md`.

Offen: Punkt 1 (Händler-Status, D-U-N-S — externe Wartezeit), die öffentliche
Lösch-Seite (anderer Agent), die Vertrags- und Dokumentationsarbeit unter 2.2 —
und der komplette Satz 2–6 für **myBestDays**, sobald diese App an der Reihe ist.
In der Gast-App und im Gast-Auth-Pfad ist bewusst nichts geändert.

---

## Belege

- Apple, „Apps without trader status will be removed from the App Store in the
  EU": https://developer.apple.com/news/?id=einwn76m
- Apple, DSA trader status — Upcoming Requirements:
  https://developer.apple.com/news/upcoming-requirements/?id=02172025a
- Apple App Review Guidelines (5.1.1(v) Konto-Löschung, 5.1.1(i)
  Datenschutz-Link, 3.1.3(c)/(e) IAP-Ausnahmen, 2.1(a) Demo-Zugang):
  https://developer.apple.com/app-store/review/guidelines/
- Google Play, Konto-Löschungs-Anforderungen:
  https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play, Data Safety Form und Datenlöschung:
  https://support.google.com/googleplay/android-developer/community-guide/246344978
- European Accessibility Act, Geltung und Fristen:
  https://www.european-accessibility-act.info/
- Erhvervsstyrelsen, Virksomhedsguide til regler for e-handel i EU:
  https://erhvervsstyrelsen.dk/sites/default/files/2022-08/Virksomhedsguide-til-regler-for-e-handel-i-EU_Erhvervsstyrelsen2020_WA.pdf
- Forbrugerombudsmanden, E-handelsloven (Oplysningskrav §§ 7–12):
  https://forbrugerombudsmanden.dk/alle-emner/anden-lovgivning/e-handelsloven
