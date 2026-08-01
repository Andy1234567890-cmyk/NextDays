# myBestDays — Marktplatz-App (bare React Native)

Native App des **Marktplatzes myBestDays** für Gäste: suchen, buchen, Reisen und
Merklisten verwalten, Self-Check-in. Teilt sich das FastAPI-Backend (`apps/api`)
mit allen anderen Frontends.

Die Verwaltungsseite (PMS, Channel-Manager, Eigentümer, Mitarbeiter) ist eine
**eigene App**: [`mobile-nextdays`](../mobile-nextdays) — siehe
[ADR-0019](../docs/decisions/0019-zwei-mobile-apps.md).

## Identität

| | |
|---|---|
| Bundle-ID (iOS + Android) | `com.mybestdays.app` |
| URL-Scheme | `mybestdays://` |
| Xcode-Projekt/Target/Scheme | `MyBestDays` |
| AppRegistry-Komponente (`app.json` `name`) | `MyBestDays` |
| Keychain-Service | `mybestdays.guest` |
| Release-Signing (Android) | `MYBESTDAYS_RELEASE_STORE_FILE` / `_STORE_PASSWORD` / `_KEY_ALIAS` / `_KEY_PASSWORD` |

Der `name` aus `app.json` muss exakt zu `getMainComponentName()`
(`android/…/MainActivity.kt`) und `withModuleName:` (`ios/MyBestDays/AppDelegate.swift`)
passen — sonst startet die App mit „Application has not been registered".

## Stack

- **React Native 0.86** (CLI, **kein Expo**), New Architecture, React 19
- **React Navigation 7** — Root-Stack + Bottom-Tabs
- **react-native-svg** für das Icon-Set, **react-native-keychain** für die Tokens
- **react-native-gesture-handler** / **safe-area-context** / **screens**
- **@react-native-community/geolocation** für die Umkreissuche
- Schibsted-Grotesk-TTFs unter `assets/fonts` (nativ via `react-native.config.js`)

## Struktur

```
App.tsx               GestureHandler → SafeArea → Theme → GuestAuthProvider → Navigation
index.js              RN-Entry (AppRegistry)
ios/ · android/       native Projekte (Xcode / Gradle)
navigation/           types.ts, GuestTabs.tsx, tab-style.tsx
screens/              GuestHome/Discover/Wishlist/Trips/Profile/Account/Login,
                      ListingDetail, Checkout, Checkin, TripDetail, WishlistDetail
components/           SearchSheet, ListingCard, DateRangePicker, GuestGate, Splash
components/ui/        Design-System: Icon, kit, patterns, PlaceIllustration
theme/                tokens.ts (Struktur) + marke.ts (Markenwerte) + ThemeProvider
lib/                  guestApi/guestAuth/guestBookings/guestStay/guestWishlist,
                      listings, standort, datum, config, realtime, currency, appwechsel
assets/fonts/         Schibsted-Grotesk TTFs (PostScript-Namen: SchibstedGrotesk-Regular …)
```

**Eine Auth-Welt.** Diese App kennt nur den Portal-Gast (`portal_guests`).
Entsprechend registriert `App.tsx` genau eine Realtime-Tokenquelle
(`realtimeTokenQuelleSetzen`); ohne sie wirft `useRealtime` fail-closed.

**Geteilter Code mit `mobile-nextdays`** liegt als bewusste Kopie vor (ADR-0019,
Stufe 1). Dateien mit `SCHWESTERDATEI`-Kopf müssen byte-identisch bleiben — die
CI prüft das (`mobile-konsistenz`). Die UI-Dateien (`kit`, `patterns`, `Icon`)
dürfen bewusst divergieren.

## Backend-Anbindung

Dieselbe `/api/v1`-Schnittstelle wie alle anderen Frontends. Basis-URL in
[lib/config.ts](lib/config.ts). Gast-Token im Keychain
([lib/guestAuth.ts](lib/guestAuth.ts), `/guest-auth/*`).

## Entwicklung

```bash
cd mobile-bestdays
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
xcrun simctl openurl booted "mybestdays://unterkunft/<id>"
adb shell am start -a android.intent.action.VIEW -d "mybestdays://reisen/<id>"
```
