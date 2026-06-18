# NextDays — Mobile-App (bare React Native)

Native App für **Gäste** (Buchen & Aufenthalt) und **Gastgeber** (Verwaltung).
Teilt sich das FastAPI-Backend (`apps/api`) mit der Web-App.

## Stack

- **React Native 0.86** (CLI, **kein Expo**), New Architecture, React 19
- **React Navigation 7** — Root-Stack + zwei Bottom-Tab-Navigatoren (Gast/Gastgeber)
- **react-native-svg** für das Icon-Set, **react-native-keychain** fürs Auth-Token
- **react-native-gesture-handler** / **safe-area-context** / **screens**
- Eigene Schibsted-Grotesk-TTFs unter `assets/fonts` (nativ via `react-native.config.js`)

## Struktur

```
App.tsx               GestureHandler → SafeArea → Theme → NavigationContainer
index.js              RN-Entry (AppRegistry)
ios/ · android/       native Projekte (Xcode / Gradle)
navigation/           types.ts, GuestTabs.tsx, HostTabs.tsx
screens/              14 Screens (RoleSelect, GuestHome/Discover/Wishlist/Trips/Profile, Host*, ListingDetail, Checkout, Checkin)
components/ui/         Design-System: Icon, kit (Btn/Chip/Card/…), Screen
components/            ListingCard, Placeholder
theme/                tokens.ts (Farben/Typo/Dichte, Light+Dark) + ThemeProvider
lib/                  api.ts, auth.ts (keychain), properties.ts, config.ts, photos.ts
assets/fonts/         Schibsted-Grotesk TTFs (PostScript-Namen: SchibstedGrotesk-Regular …)
```

Das Design-System ist 1:1 aus dem Design-Kit portiert (Tokens, Icon-Pfade,
Komponenten) — Akzent `#C42B3A`, Schibsted Grotesk, Light/Dark.

### Gast-Tabs

`Erkunden` (GuestHome) · `Suche` (GuestDiscover) · `Merkliste` · `Reisen` · `Profil`.
`Erkunden` ist die Discovery-Startseite im Booking-×-Airbnb-Stil (Such-Box mit
Reitern Aufenthalte/Erlebnisse/Services, Kategorien, „Suche fortsetzen",
beliebte Unterkünfte, Treue-Banner, Reiseziele, Wochenend-Angebote) und führt
per Tap in `ListingDetail`.

## Backend-Anbindung

Ruft dieselbe `/api/v1`-Schnittstelle wie die Web-App. Basis-URL in
[lib/config.ts](lib/config.ts): iOS-Simulator → `localhost:8000`, Android-Emulator
→ `10.0.2.2:8000`, echtes Gerät → LAN-IP des Dev-Rechners eintragen.
Auth-Token via Keychain ([lib/auth.ts](lib/auth.ts), `/auth/login`).
Aktuell live angebunden: **Inserate** (`/properties`, Fallback auf Demo-Daten).

## Entwicklung

```bash
cd apps/mobile
npm install
cd ios && pod install && cd ..   # einmalig / nach nativen Dep-Änderungen

npm start                        # Metro-Bundler (eigenes Terminal)
npm run ios                      # iOS-Simulator
npm run android                  # Android-Emulator
npm run typecheck                # tsc --noEmit
```

Nach Font-/Asset-Änderungen: `npx react-native-asset` erneut ausführen.
