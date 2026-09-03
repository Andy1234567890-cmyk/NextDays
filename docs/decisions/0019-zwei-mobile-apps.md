# ADR-0019: Zwei Mobile-Apps statt einer All-in-One-App

- Status: **ANGENOMMEN** (2026-07-31)
- Ersetzt: die Vorgabe „Eine einzige App für ALLE Nutzergruppen — kein App-Zoo"
  aus `docs/mobile-integration-plan.md`.
- Grundlage: vollständige Kartierung von `mobile/` (Import-Graph, Navigator-Bäume,
  Auth-Welten, native Konfiguration) plus zwei ausgearbeitete Gegenentwürfe
  (ein Projekt mit Build-Varianten vs. zwei Projekte).

## Frage

`mobile/` ist heute eine App mit vier Erlebnissen (Gast · Agentur · Owner ·
Mitarbeiter); welches ein Nutzer sieht, entscheidet sein Konto. Seit der
Marken-Trennung in der Wurzel-`CLAUDE.md` („Zwei Marken — UNVERHANDELBAR") trägt
diese eine App zwei Marken gleichzeitig: sie heißt und brandet sich als
**myBestDays** (`CFBundleDisplayName`, `app_name`, Logo, Akzentfarbe), enthält
aber das komplette **myNextDays**-PMS. Wie wird daraus ein Zustand, der die
Markengrenze abbildet?

## Entscheidung

**Aus `mobile/` werden zwei eigenständige React-Native-Projekte:**

| | `mobile-bestdays/` | `mobile-nextdays/` |
|---|---|---|
| Marke | myBestDays — Marktplatz | myNextDays — PMS / Channel-Manager |
| Nutzer | Gast (portal_guest), später Marktplatz-Gastgeber | Betrieb: Agentur, Owner, Mitarbeiter |
| Auth-Welt | `guestAuth`/`guestApi`/`GuestAuthContext` | `auth`/`api`/`AuthContext` (Rolle aus `/auth/me`) |
| Bundle-ID (iOS + Android) | `com.mybestdays.app` | `com.mynextdays.app` |
| URL-Scheme | `mybestdays://` | `mynextdays://` |
| Xcode-Projekt/Target/Scheme | `MyBestDays` | `MyNextDays` |
| Android `rootProject.name` / Java-Package | `MyBestDays` / `com.mybestdays.app` | `MyNextDays` / `com.mynextdays.app` |
| Keychain-Service | `mybestdays.guest` | `mynextdays.auth` |
| Release-Signing-Env | `MYBESTDAYS_RELEASE_*` | `MYNEXTDAYS_RELEASE_*` |

`mobile-bestdays` entsteht per `git mv` aus `mobile` (erbt das native Projekt,
das inhaltlich bereits myBestDays ist); `mobile-nextdays` wird frisch per RN-CLI
erzeugt und bekommt die PMS-Dateien per `git mv`.

**Der Owner/Eigentümer gehört nach `mobile-nextdays`.** Das ist keine
Geschmacksfrage: das Owner-Portal hängt an der Tenant-Auth (`/auth/login`, Rolle
`owner`, `/public-portal/*`). In der Marktplatz-App bräuchte es den kompletten
Tenant-Stack — der Split wäre damit aufgehoben.

> **ERSETZT am 02.09.2026 durch [ADR-0022](0022-dritte-mobile-app-eigentuemer.md):**
> der Eigentümer hat seit dann eine EIGENE App (`mobile-owner`,
> `com.mynextdays.owner`). Der Grund gegen die Marktplatz-App gilt weiter — die
> neue App hängt an derselben Tenant-Auth und bleibt damit auf der myNextDays-
> Seite der Markengrenze. Das Eigentümer-Erlebnis in `mobile-nextdays`
> (`OwnerTabs`) bleibt bestehen und wird nicht abgeschaltet.

**Beide Projekte bleiben außerhalb des bun-Root-Workspace**, je mit eigenem
`bun.lock` — wie `mobile` heute schon.

**Geteilter Code liegt in Stufe 1 als bewusste Kopie vor, nicht als Paket.**

## Begründung

### Warum zwei Projekte und nicht zwei Build-Varianten eines Projekts

Der Gegenentwurf — ein Ordner, zwei JS-Einstiegspunkte, Android-`productFlavors`
und ein zweites iOS-Target — spart laufende Wartung (ein RN-Upgrade, ein
Podfile, ein `node_modules`) und wurde ernsthaft geprüft. Dagegen sprach:

- Zwei Marken mit getrennten Zielgruppen und getrennten Store-Auftritten sind
  auch organisatorisch zwei Produkte. ADR-0016 hält für die Frontends bereits
  fest: „Mehrere eigenständige Frontends je Nutzerwelt, vertikal fachlich
  geschnitten" — die Mobile-Seite zieht damit nur nach.
- Die Store-Kosten (2× Review, 2× Screenshots, 2× Privacy-Deklaration) fallen in
  **beiden** Ansätzen an; sie sind der größte Posten und kein Unterscheidungs­merkmal.
- Der verbleibende Unterschied ist doppelte native Wartung gegen dauerhaft
  entkoppelte Release-Zyklen: ein RN-Upgrade kann eine App nach der anderen
  migrieren, statt beide gleichzeitig zu erzwingen.
- Ein zweites iOS-Target im selben `.xcodeproj` bedeutet dauerhaft
  pbxproj-Handarbeit an einer Datei, die zwei Apps trägt (duplizierte
  Build-Phasen, `abstract_target`-Podfile, geteilte Codegen-Ausgabe).

### Warum der Schnitt technisch billig ist

- **Der Import-Graph ist bereits kreuzungsfrei.** Kein Gast-Modul importiert
  `lib/api.ts`, kein PMS-Modul importiert `lib/guestApi.ts`. Es gibt keine
  gemeinsame Domänenlogik zwischen den beiden Welten.
- **Die Auth-Welten sind schon getrennt** (eigene Keychain-Services, eigene
  HTTP-Clients, eigene Contexts, eigene Refresh-Logik).
- **Die Navigation ist schon in drei disjunkte Bäume geschnitten**
  (`GuestTabs` / `HostTabs` / `OwnerTabs`).
- Es sind genau **vier Kopplungspunkte**: `App.tsx`, `screens/RoleSelect.tsx`,
  `screens/GuestProfile.tsx` (liest als einziger Gast-Screen `useAuth()`) und
  `screens/GuestLogin.tsx` („Zum Gastgeber-Login").

### Warum die Bundle-IDs jetzt neu gesetzt werden

Es liegt nichts im Store: `versionCode 1`, kein fastlane, kein Release-Workflow,
keine Store-Referenz im Repo. `com.nextdays.app` / `com.nextdaysapp` sind
Altlasten aus der All-in-One-Zeit und passen zu keiner der beiden Marken. Eine
Bundle-ID ist nach der ersten Veröffentlichung unwiderruflich — das ist das
letzte Zeitfenster.

### Warum Kopie statt geteiltem Paket (Stufe 1)

Von ~1.860 „geteilten" Zeilen sind ~88 % UI (`ui/kit.tsx`, `ui/patterns.tsx`,
`ui/Icon.tsx`) — genau der Code, der laut ADR-0016 („Mut zur Duplikation, wo
Nutzerwelten bewusst unterschiedliche Optik brauchen") divergieren *darf*. Echt
geteilte Logik sind ~280 Zeilen (`config.ts`, `realtime.ts`, `currency.ts`).

Ein `mobile-shared/` bräuchte in beiden Projekten `metro.config.js` mit
`watchFolders` + `resolver.nodeModulesPaths` + `disableHierarchicalLookup` (heute
ist die Config der unveränderte Default). Die Fehlerbilder — „Invalid hook call"
durch zwei React-Instanzen, „Unable to resolve module", stilles Scheitern erst
beim Release-Bundle — sind schlecht diagnostizierbar und bei jedem RN-Upgrade neu
zu verifizieren. Für ~280 Zeilen ein schlechtes Geschäft; und es würde den
riskanten Split mit einer zweiten riskanten Änderung überlagern.

Stattdessen: **Schwesterdatei-Kopf in jeder Kopie + CI-`diff`-Wächter** auf
`lib/currency.ts`, `lib/realtime.ts`, `lib/config.ts`, `theme/tokens.ts`. Die
UI-Dateien stehen bewusst **nicht** unter dem Wächter.

`mobile-shared/` bleibt als **Stufe 2** offen (später ~1,5 PT auf grüner
Baseline; umgekehrt wäre es ein Debugging-Albtraum). Sie wird fällig, sobald die
geteilte Nicht-UI-Logik ~500 Zeilen überschreitet oder ein drittes RN-Projekt
dazukommt.

### Warum kein Root-Workspace

Die Begründung steht schon in `.github/workflows/ci.yml` („React Native braucht
sein eigenes, nicht gehobenes `node_modules`"). Zusätzlich verweist
`android/settings.gradle` mit `includeBuild("../node_modules/…")` relativ, und
zwei RN-Apps mit einem gehobenen `react-native` würden RN-Upgrades zwangskoppeln.
Versionsgleichheit der Kernpakete wird stattdessen per CI-`diff` geprüft.

## Konsequenzen

- **`nextdays://` entfällt ersatzlos.** Kein Backend-Code und keine E-Mail-Vorlage
  erzeugt solche Links; betroffen sind nur dokumentierte QA-Testkommandos.
- **`RoleSelect` verschwindet.** Der Wechsel zwischen den Welten wird zum
  Cross-App-Absprung (`Linking.canOpenURL` → andere App, sonst Store). Das
  verlangt `LSApplicationQueriesSchemes` (iOS) bzw. `<queries><intent>` (Android
  11+) — ohne diese Einträge liefert `canOpenURL` immer `false` und der Absprung
  bricht still.
- **Der Realtime-Singleton-Bug wird strukturell erledigt.** Heute hängen beide
  Token-Listener am selben supabase-Client mit einem globalen `setAuth`; bestehen
  beide Sessions parallel, überschreibt der zuletzt feuernde das JWT der anderen
  Welt und deren Channels laufen still aus. Nach dem Split gibt es je Prozess nur
  eine Auth-Welt; `realtime.ts` bekommt eine genau einmal registrierbare
  Tokenquelle und wirft fail-closed, wenn sie fehlt.
- **Laufende Mehrkosten ~+11 bis +21 PT/Jahr**, Löwenanteil im Store-Prozess.
  Nicht doppelt: Apple-Developer-Programm (99 $/Jahr deckt beliebig viele Apps
  derselben Team-ID), Play-Console-Gebühr (25 $ einmalig), Backend/API/RLS.
- **Apple-Guideline 4.3** („zu ähnlich") ist ein reales Erstreview-Risiko für die
  zweite App. Gegenmaßnahme: getrennte Store-Beschreibungen (Marktplatz vs.
  Betriebssoftware), eigene Icons, PMS-Screenshots zeigen Kalender/Reservierungen
  statt Buchen.
- **Universal Links / App Links** (`apple-app-site-association`,
  `assetlinks.json`) sind ein eigenes späteres Arbeitspaket; die Deep-Link-Pfade
  werden schon jetzt so gewählt, dass sie 1:1 auf die späteren HTTPS-Pfade passen.
- Sollte GoTrue je per Link in eine App zurückspringen, müssen **beide** Schemes
  in `ADDITIONAL_REDIRECT_URLS`.
