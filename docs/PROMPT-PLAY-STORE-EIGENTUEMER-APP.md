# Prompt für Claude Terminal — Google Play vorbereiten: myNextDays Eigentümer

Kopiere alles ab „--- PROMPT ---" in eine neue Claude-Code-Sitzung im Ordner
`/Users/andystaudinger/NextDays`.

--- PROMPT ---

Bereite die Eigentümer-App `mobile-owner` vollständig für die
Google-Play-Veröffentlichung vor. Ich (der Nutzer) klicke am Ende in der Play
Console; du lieferst alles, was dafür gebraucht wird, fertig und geprüft.

## Was schon steht — bitte prüfen, nicht neu bauen

- `applicationId` / `namespace`: `com.mynextdays.owner`
- `versionCode`/`versionName` kommen aus dem Workflow (`-PversionCode`,
  `-PversionName`), nicht aus der Datei
- Release-Workflow: `.github/workflows/mobile-release-owner.yml`
  (`workflow_dispatch`, Auswahl `apk` | `aab`) — er baut, signiert, beweist die
  Signatur und lädt hoch
- Alle sechs Secrets sind gesetzt: `MYNEXTDAYSOWNER_RELEASE_KEYSTORE_BASE64`,
  `_RELEASE_KEY_ALIAS`, `_RELEASE_KEY_PASSWORD`, `_RELEASE_STORE_PASSWORD`,
  `_GOOGLE_SERVICES_JSON_BASE64`, `_FIREBASE_APP_ID` (03.09.2026)
- Store-Angaben: `docs/APP-STORE-ANGABEN.md`, Abschnitt 2
- Rechts-URLs: `mobile-owner/lib/rechtliches.ts`, Basis
  `https://www.mynextdays.com`

`docs/APP-STORE-ANGABEN.md` ist an zwei Stellen VERALTET: unter „Weiter offen"
stehen Firebase-App und Release-Keystore als fehlend, beides existiert seit dem
03.09.2026. Korrigiere das im Zuge der Arbeit, statt es zu übernehmen.

## Die fünf Aufgaben

### 1. Eigenes App-Icon (blockiert die Veröffentlichung nicht, ist aber ein Mangel)

`mobile-owner/android/app/src/main/res/mipmap-*/ic_launcher.png` ist
BYTE-IDENTISCH mit dem der PMS-App (`md5 beae8ce4…`, nachgemessen). Zwei Apps
desselben Herstellers sind im Launcher nicht unterscheidbar — und Play zeigt
beide nebeneinander.

Erzeuge einen eigenen Satz für alle `mipmap`-Dichten plus das 512×512-Symbol
für den Store-Eintrag. Halte dich an das bestehende Markenbild (Farben aus dem
Marketing-Auftritt); die Unterscheidung darf nicht nur ein Buchstabe sein, den
man bei 48 px nicht liest. Frage mich VOR dem Erzeugen, welche Richtung dir
richtig scheint — ein Icon ist eine Gestaltungsentscheidung, keine Ableitung.

### 2. Konto-Löschung — die einzige echte Sperre

Google verlangt für Apps mit Konto-Anmeldung einen Löschweg. `mobile-owner` hat
KEINEN: weder `lib/konto.ts` noch einen Löschpunkt in `screens/Mehr.tsx`
(nachgesehen, nur `auth.ts` und `ChatGeraete.tsx` sprechen von „löschen", beide
in anderer Sache).

Der Web-Weg `https://mynextdays.com/konto-loeschen` ist vorhanden und live
geprüft (200) — formal reicht das für die Einreichung. Prüfe das erneut LIVE,
bevor du dich darauf verlässt.

Dann entscheide begründet, ob wir den In-App-Weg nachziehen, und leg mir die
Entscheidung vor. Die fachliche Klemme dabei (nicht übergehen): das Konto des
Eigentümers hängt an Objekten eines Betriebs. „Konto löschen" darf die
Zuordnung in `owner_properties` und `owner_property_assignments` NICHT
mitreißen und keine Abrechnungshistorie zerstören — der Löschpfad der PMS-App
(`mobile-nextdays/lib/konto.ts`) ist deshalb nicht ungeprüft übernehmbar
(Wurzel 1: jede Aktion hat einen Gegenzustand).

### 3. Store-Eintrag: Texte und Bilder

- **Kurzbeschreibung** (max. 80 Zeichen) und **vollständige Beschreibung**
  (max. 4000), Zielgruppe ist der EIGENTÜMER, nicht der Betrieb. Deutsch als
  Grundfassung; sag mir, welche weiteren Sprachen du für sinnvoll hältst.
- **Screenshots**: eigener Satz, mindestens vier, Telefon-Format. Die der
  PMS-App zeigen andere Oberflächen und sind nicht verwendbar.

  **Nimm sie im iOS-Simulator auf**, nicht im Android-Emulator. Grund steht in
  CLAUDE.md: der Simulator teilt den Kernel mit macOS und ist billig, der
  Android-Emulator virtualisiert eine ganze ARM-Maschine und belegt über 3 GB
  auf einem 8-GB-Rechner. Für Play-Screenshots ist das Betriebssystem egal —
  Google verlangt Bilder der App, keine Android-Aufnahmen.

  Der Weg, ohne Zusatzwerkzeug:
  ```
  xcrun simctl list devices available          # laufendes Gerät finden
  xcrun simctl io booted screenshot <datei>.png
  ```
  `screencapture` funktioniert hier NICHT (keine Aufnahmeberechtigung, siehe
  CLAUDE.md); `simctl io` schreibt die Datei direkt aus dem Simulator und
  braucht keine.

  Vor dem Start MESSEN (`uptime`, `sysctl vm.swapusage`) und nichts parallel
  laufen lassen — kein Metro der anderen App, kein Next.js-Dev-Server, kein
  Android-Emulator. Den Simulator und Metro starte ICH; gib mir die
  Terminal-Befehle, statt sie selbst auszuführen.

  Was auf die Bilder gehört: echte Inhalte aus einem Demo-Tenant, keine
  Attrappen und keine Blindtexte. Google lehnt Screenshots ab, die die App
  nicht zeigen. Sag mir vorher, welche vier bis acht Screens du zeigen willst
  und warum.

  Prüfe die Zielmaße gegen Googles aktuelle Vorgabe (Seitenverhältnis,
  Mindestkante) und wähle das Simulator-Gerät danach — nicht das
  erstbeste. Falls ein Zuschnitt nötig ist, mach ihn mit `sips`
  (bringt macOS mit), nicht mit einem neuen Paket.
- **Feature-Grafik** 1024×500.

### 4. Data-Safety-Formular

Abschnitt 2 von `docs/APP-STORE-ANGABEN.md` trägt die Tabelle. Gleiche sie
gegen das AKTUELLE Binary ab, nicht gegen das Dokument — die App hat seit dem
09.09.2026 den Chat mit Bildanhang (`CAMERA`, `react-native-image-picker`,
`lib/chat-bild.ts`). Eine Angabe, die das Binary nicht hergibt, ist ein
Sperrgrund; eine fehlende ebenso.

Prüfe dabei ausdrücklich mit: die Altersfreigabe im Dokument sagt „kein Chat" —
das stimmt seit 0611/ADR-0029 nicht mehr. Kläre gegen Googles
Inhaltsklassifizierung, ob ein Eins-zu-eins-Chat zwischen Eigentümer und
Verwaltung die Einstufung ändert, und begründe deine Antwort mit einer Quelle,
nicht mit einer Annahme.

Liefere das Ergebnis als ausfüllfertige Liste: Formularfrage → meine Antwort.

### 5. Der erste Upload

Wenn 1–4 stehen: `mobile-release-owner.yml` mit `artefakt: aab` starten (Play
nimmt kein APK für neue Apps), das Artefakt holen und mir sagen, welche Datei
ich in welchen Track lade. Starte den Workflow NICHT ohne meine ausdrückliche
Ansage — ein Release-Build ist eine Veröffentlichung, keine Prüfung.

## Regeln für diese Arbeit

- `CLAUDE.md` gilt vollständig, besonders: nichts committen/pushen/deployen
  ohne meine Ansage; keine erfundenen Fallback-Werte; keine KI-Attribution;
  keine Platzhalter in gelieferten Texten.
- Prüfe jede Angabe gegen den Code oder live, nicht gegen die Doku. Zwei
  veraltete Stellen sind oben schon benannt — geh davon aus, dass es weitere
  gibt.
- Sag mir am Ende KLAR, was noch offen ist und was ich in der Play Console
  selbst tun muss. Kein „fertig", solange etwas nur vorbereitet ist.

--- ENDE PROMPT ---
