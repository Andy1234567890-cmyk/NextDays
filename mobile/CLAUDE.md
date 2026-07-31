# Mobile (mobile) — gleiche Plattform, gleiche Regeln

Die React-Native-App ist ein gleichwertiges Frontend derselben FastAPI
(`/api/v1`) — die All-in-One-App: vier Erlebnisse (Gast · Agentur · Owner ·
Mitarbeiter), Routing aus dem Konto, zwei strikt getrennte Auth-Welten
(Tenant vs. portal_guests). Plan: `docs/mobile-integration-plan.md` ·
Arbeitspakete P1–P9: `docs/mobile-integration-prompts.md` (strikt sequenziell,
Status in NOTES.md). Zusätzlich verbindlich:
- Daten NUR über `mobile/lib/api.ts` (Bearer aus Keychain). Kein direkter
  Supabase-Zugriff — Ausnahme Realtime: dedizierter supabase-js-Client,
  `persistSession:false`, `await setAuth(token)` VOR `subscribe()` (Muster:
  `web/lib/use-realtime.ts`).
- Tokens (access + refresh) NUR in react-native-keychain, nie AsyncStorage,
  nie loggen. 401 → genau EIN Refresh-Versuch (single-flight), dann Logout —
  Auth-Rate-Limit ist 10/60/IP (Wurzel 2).
- URLs/Umgebung NUR in `mobile/lib/config.ts` (`__DEV__`-Switch). Keine
  URL-/Währungs-Hardcodes in Screens (Wurzel 4). Maskierte Felder
  (`total_amount: null`, Vorname-only) als „—" rendern, nie 0/Fantasiewert.
- Rollen-/Capability-Gating aus `GET /auth/me` (wie
  `web/components/app-sidebar.tsx`), nie clientseitig „aufmachen".

Die neun Wurzeln, das Datenmodell (1 property = 1 buchbare Einheit), die
Vertriebskanäle und das Qualitätsgate stehen in der `CLAUDE.md` im Repo-Wurzel-
verzeichnis und gelten hier unverändert mit.
