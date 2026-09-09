# myNextDays — PMS-App (bare React Native)

Native App des **Betriebs**: Dashboard, Belegungsplan, Reservierungen,
Posteingang, Objekte, Aufgaben. Teilt sich das FastAPI-Backend (`apps/api`) mit
allen anderen Frontends.

Der Marktplatz für Gäste ist eine **eigene App**:
[`mobile-bestdays`](../mobile-bestdays) — siehe
[ADR-0019](../docs/decisions/0019-zwei-mobile-apps.md).

Das **Eigentümer-Portal** ist ebenfalls ausgezogen und liegt in
[`mobile-owner`](../mobile-owner) — siehe
[ADR-0022](../docs/decisions/0022-dritte-mobile-app-eigentuemer.md). Hier bleibt
davon nur `screens/OwnerAppHinweis.tsx`: meldet sich ein Konto der Rolle `owner`
an, sieht es den Verweis auf die Eigentümer-App (Absprung per
`mynextdaysowner://`) und einen Abmelden-Knopf — kein stummer Rauswurf. Das
Gegenstück ist `mobile-owner/screens/FalscheRolle.tsx`.

## Identität

| | |
|---|---|
| Bundle-ID (iOS + Android) | `com.mynextdays.app` |
| URL-Scheme | `mynextdays://` |
| Xcode-Projekt/Target/Scheme | `MyNextDays` |
| AppRegistry-Komponente (`app.json` `name`) | `MyNextDays` |
| Keychain-Service | `mynextdays.auth` |
| Release-Signing (Android) | `MYNEXTDAYS_RELEASE_STORE_FILE` / `_STORE_PASSWORD` / `_KEY_ALIAS` / `_KEY_PASSWORD` |

Der `name` aus `app.json` muss exakt zu `getMainComponentName()`
(`android/…/MainActivity.kt`) und `withModuleName:` (`ios/MyNextDays/AppDelegate.swift`)
passen — sonst startet die App mit „Application has not been registered".

## Stack

- **React Native 0.86** (CLI, **kein Expo**), New Architecture, React 19
- **React Navigation 7** — Root-Stack + Bottom-Tabs (Betrieb)
- **react-native-svg** für das Icon-Set, **react-native-keychain** für die Tokens
- **react-native-gesture-handler** / **safe-area-context** / **screens**
- Schibsted-Grotesk-TTFs unter `assets/fonts` (nativ via `react-native.config.js`)

Kein `@react-native-community/geolocation`: die Umkreissuche gehört zum
Marktplatz, diese App fragt keine Standortberechtigung ab.

## Struktur

```
App.tsx               GestureHandler → SafeArea → Theme → AuthProvider → Navigation
index.js              RN-Entry (AppRegistry)
ios/ · android/       native Projekte (Xcode / Gradle)
navigation/           types.ts, HostTabs.tsx, tab-style.tsx
screens/              HostDashboard/Calendar/Reservations/Inbox/Listings/Tasks/More/
                      Profile/Login/Signup, ReservationDetail, TaskDetail,
                      OwnerAppHinweis (Verweis auf die Eigentümer-App)
components/           Splash
components/ui/        Design-System: Icon, kit, patterns, LogoVektor,
                      SplashLogo (Logo-Teile des Splash, markenabhängig)
theme/                tokens.ts (Struktur) + marke.ts (Markenwerte) + ThemeProvider
lib/                  api, auth, permissions, experience, properties, reservations,
                      dashboard, tasks, inbox, calendar*,
                      config, realtime, currency, appwechsel
assets/fonts/         Schibsted-Grotesk TTFs (PostScript-Namen: SchibstedGrotesk-Regular …)
```

**Eine Auth-Welt.** Diese App kennt nur das Betriebskonto (Tenant, Rolle aus
`GET /auth/me`). Entsprechend registriert `App.tsx` genau eine
Realtime-Tokenquelle (`realtimeTokenQuelleSetzen`); ohne sie wirft `useRealtime`
fail-closed.

**Erlebnis aus der Rolle** (`lib/experience.ts`, fail-closed): admin / co_admin
/ staff / cleaner → `HostTabs` (Mitarbeiter sehen einen reduzierten Tab-Satz
ohne Finanz-/Vertriebseinblick), owner → `OwnerAppHinweis` (Verweis auf die
Eigentümer-App). Unbekannte Rolle → kein Erlebnis, Session wird beendet.

**Geteilter Code mit `mobile-bestdays`** liegt als bewusste Kopie vor (ADR-0019,
Stufe 1). Dateien mit `SCHWESTERDATEI`-Kopf müssen byte-identisch bleiben — die
CI prüft das (`mobile-konsistenz`). Die UI-Dateien (`kit`, `patterns`, `Icon`)
dürfen bewusst divergieren.

## Backend-Anbindung

Dieselbe `/api/v1`-Schnittstelle wie alle anderen Frontends. Basis-URL in
[lib/config.ts](lib/config.ts). Tenant-Token im Keychain
([lib/auth.ts](lib/auth.ts), `/auth/login`).

## Entwicklung

```bash
cd mobile-nextdays
bun install                      # Paketmanager im ganzen Repo: bun
cp lib/config.secrets.example.ts lib/config.secrets.ts   # einmalig, dann Wert eintragen
cd ios && pod install && cd ..   # einmalig / nach nativen Dep-Änderungen

bun start                        # Metro-Bundler (eigenes Terminal)
bun run ios                      # iOS-Simulator
bun run android                  # Android-Emulator
bun run typecheck                # tsc --noEmit
bun run lint                     # eslint
bun run test                     # jest
```

Nach Font-/Asset-Änderungen: `npx react-native-asset` erneut ausführen.
App-Icons/Splash werden aus den Marken-Logos abgeleitet:
`bash ../scripts/marken/app-icons.sh`.

Deep-Links testen:

```bash
xcrun simctl openurl booted "mynextdays://reservierungen/<id>"
adb shell am start -a android.intent.action.VIEW -d "mynextdays://aufgaben/<id>"
```
