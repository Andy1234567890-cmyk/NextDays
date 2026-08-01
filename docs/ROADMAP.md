# Roadmap bis MVP-Go-Live — myNextDays

Stand: 2026-07-20. Ziel dieser Roadmap: der Weg vom heutigen Stand (alles läuft
auf dem Staging-Server `65.21.144.136`) bis zum **echten Produktions-Go-Live**
mit zahlenden Betrieben. Sie ist nach **Blocker zuerst** geordnet: Phase 0/1 sind
harte Go-Live-Voraussetzungen, Phase 2 schließt die Kern-Feature-Lücken, Phase 3
ist Launch-begleitend/danach.

Grundlage: Ist-Stand-Erhebung 2026-07-20 (Backend 30 Slices, 5 Frontends,
Infra/Security/Deploy). Referenzen auf die zugrundeliegenden Detailpläne stehen
jeweils dabei. **Legende:** 🔴 Launch-Blocker · 🟡 Kern-Lücke · 🟢 danach ·
👤 = manueller Andy-Schritt (nicht im Code lösbar).

---

## Wo wir stehen (Ampel)

| Bereich | Stand | Kurz |
|---|---|---|
| Backend-Kern | 🟢 | channel_manager, reservations, pricing, auth, calendar, inbox, owner_statements, payments (Stripe), tasks, rates, properties, guests — fertig, getestet |
| PMS-Dashboard (apps/web) | 🟡 | Kern live; Buchhaltung/HR/Jobs/Marktplatz = Gerüst (29 Coming-Soon-Seiten) |
| Plattform (Buchungskanal) | 🟢 | Such→Detail→Buchung→Stripe echt angebunden, schmal aber fertig |
| Builder (White-Label) | 🟢 | Renderer fertig; Editor in apps/web/`/website` |
| Mobile | 🟡 | Zwei Apps seit ADR-0019: `mobile-nextdays` (Host/Owner/Mitarbeiter, live) und `mobile-bestdays` (Gast-Erlebnis Attrappe, P7–P9 offen) |
| Marketing-Site | 🟡 | Landingpage fertig; Trial-Formular ohne Backend, keine Legal-Seiten |
| DB-Security (RLS/Revokes) | 🔴 | **SB-1/SB-2/PG-1 offen** — Rollen-/Finanz-Bypass über PostgREST |
| Prod-Umgebung | 🔴 | Kein echter Prod-Server; alles auf einem Staging-Host |
| Backup/Recovery | 🟢 | Borg + getesteter Restore + Runbook fertig (👤 Erst-Setup verifizieren) |
| Mail | 🟢 | Mailserver live, 10/10 mail-tester, Gmail/Outlook zustellbar (iCloud-Warmup läuft) |
| CI/CD | 🟡 | Lint+Test-Gate gut; Security-Gate (SHA-Pin/permissions) offen |

---

## Phase 0 — Launch-Blocker Security & Daten (🔴 zuerst, ~1–2 Wochen)

Nichts geht live, bevor das steht. Reihenfolge = Risiko.

1. **🔴 DB-Härtung SB-1 / SB-2 / PG-1** — die schwerste offene Lücke der Auditreihe.
   RLS erzwingt nur den Mandanten; Rollen-/Finanz-Trennung lebt nur im FastAPI-Layer,
   `authenticated` hat per Default volles DML über PostgREST. Migration schreiben:
   `revoke insert,update,delete[,select] on public.{users,payments,commissions,
   owner_statements,guests,secrets,…} from anon, authenticated` + restriktive
   Rollen-Policies (`as restrictive for all`, nicht nur select) + `revoke create on
   schema public`. Danach `scripts/security/redteam-verify.sh` gegen die Live-DB
   grün. Ref: `docs/SECURITY-REDTEAM.md`, CLAUDE.md Wurzel 6.
2. **🔴 Auth-Härtung (AT-1/2/3/6)** — MFA serverseitig erzwingen (aal2-Claim,
   nicht nur `/auth/login`), E-Mail-/Passwort-/TOTP-Änderung nur mit Re-Auth,
   E-Mail-Wechsel als Doppel-Opt-in (kein `email_confirm=True`). Ref: CLAUDE.md Wurzel 7.
3. **🔴 👤 Supabase Attack Protection** einschalten (Captcha + Leaked-Password/HIBP)
   — schützt den direkten GoTrue-Login vor Stuffing (AT-3). Betriebs-/Config-Schritt.
4. **🔴 anon-Key rotieren + aus Git-History entfernen** — Key ist aktuell aus den
   getrackten Dateien raus (gitignored `config.secrets.ts`), liegt aber noch in der
   History. Rotieren (Kong/Supabase) → `git filter-repo`/BFG → alle Clients neu
   (web/mobile/storybook). 👤 destruktiver History-Rewrite.
5. **🔴 Restliche PostgREST-Befunde** — PG-2 (Scope-Helper fail-**closed** machen),
   SB-3 (`storybook_chat` anon r/w schließen), PG-4 (`reviews` cross-tenant),
   RLS-Vollständigkeit für ALLE neuen Tabellen prüfen. Ref: CLAUDE.md Wurzel 6/9.

## Phase 1 — Produktions-Umgebung & Betriebs-Härtung (🔴, ~1–2 Wochen, teils parallel zu 0)

Der Code kann fertig sein — ohne echte Prod-Trennung darf nichts live.

1. **🔴 Echte Staging↔Prod-Trennung** — 2. Coolify-Environment (Weg A) oder 2.
   Hetzner-Server (Weg B). `main` geht heute direkt auf den einen Host. Ref:
   `deploy/DEPLOY-SAFETY-PLAN.md` Säule 1.
2. **🔴 DB/Redis aus dem Compose-Monolith isolieren** — heute reißt strukturell
   jeder API-Deploy die Prod-DB mit. Ref: Safety-Plan Schritt 4, Memory
   [worker-nie-in-db-stack], [db-stack-container-race].
3. **🔴 👤 Domain-Cutover** — echte Domain statt `*.sslip.io` (DNS/TLS/Coolify-FQDN
   je App). `mynextdays.com` = Haupt, `mynextdays.dk` = Mail. Danach die als „geparkt"
   markierten Stellen nachziehen (RECOVERY/STATUS-PAGE/RATE-LIMITING).
4. **🔴 Edge/DDoS** — Cloudflare/WAF vor die Domains (nur App-Rate-Limit reicht nicht);
   `/docs`, `/openapi.json`, `/redoc` in Prod schließen (A8).
5. **🟡 CI-Security-Gate** — Actions per Commit-SHA pinnen, `permissions: contents: read`,
   `pip-audit`/`npm audit` + Dependabot/Secret-Scanning aktivieren. Ref: INF-4.
6. **🟡 Monitoring Schicht 3** — Sentry (App-Fehler) vor Go-Live; Schicht 1 (Uptime-Kuma)
   läuft bereits. Ref: `deploy/monitoring/STATUS-PAGE.md`.
7. **🟢 👤 Toter Ballast** — `deploy/docker-compose.prod.yml` bereinigen (wird vom
   Workflow nicht genutzt, widersprüchlich).
8. **🟢 👤 Backup-Erst-Setup verifizieren** — Borg/Storage-Box-Installation auf dem
   Zielserver bestätigen (Skripte + Restore-Test sind fertig).

## Phase 2 — Kern-Feature-Lücken bis „verkaufbar" (🟡, ~4–8 Wochen)

Was ein zahlender Betrieb + dessen Gäste zum Start real brauchen.

1. **🟡 Mobile Gäste-Erlebnis (P7–P9)** — der größte fehlende Produktteil.
   - **P7:** `guest_portal`-Slice im Backend neu bauen (Gast-Konto, getrennte
     Auth-Welt `portal_guests`).
   - **P8:** Gäste-App echt anbinden (`lib/bookingEngine.ts`, `lib/guestPortal.ts`,
     `GuestAuthContext`) — heute Unsplash-Demo-Fotos + `<Placeholder>` in
     GuestHome/Discover/Trips/Wishlist/Checkout.
   - **P9:** abschließender Security-Review Gesamtprojekt.
   Ref: `NOTES.md`, `docs/mobile-integration-prompts.md`. (P1–P6 ✅.)
2. **🟡 Buchhaltung echt machen** — 13 Coming-Soon-Seiten (bank/datev/kassenbuch/
   umsatz/steuer/mahnwesen …) + Backend-Stubs (Textbausteine, Nutzer-Präferenzen,
   Inline-Service-Tracking sind No-Op) + **E-Rechnung/GoBD laufen auf Mock-Daten**
   (`autoEInvoiceService.ts`, `GoBDSystem.tsx`). Entscheiden: welcher Umfang ist
   MVP-Pflicht vs. Fast-Follow. Ref: Backend `buchhaltung/router.py` Z.320–410.
3. **🟡 Nachrichten-Shortcodes real ersetzen** — `{{WifiInformation}}` & Co. werden
   heute nirgends ersetzt (kein Replacing im inbox-scheduler), `content_blocks`
   (Mig. 0014) ohne Code/Daten. Blockt Gäste-Info/Gastmappe. Ref:
   `docs/ANALYSE-gaeste-info-gastmodul-gaestemappe.md`.
4. **🟡 i18n (mind. DE/EN, DK)** — Persistenz/Umschaltung noch nicht umgesetzt
   (REQUIREMENTS-GAP 🔴). Plattform-UI ist noch einsprachig; AGB schon 24-sprachig.
5. **🟡 Hotel-Container-Überbuchungslücke schließen** — der parallele `room_types`-
   Zweig ist unvollständig integriert (nur Zert-Testobjekt nutzt ihn) und birgt eine
   Überbuchungslücke. Rückbau umsetzen. Ref: `docs/PLAN-rueckbau-hotel-container.md`.
6. **🟡 Marketing-Trial-Formular anbinden** — `marketing-trial.tsx` submittet ins
   Leere (nur `preventDefault`) → Leads gehen verloren. An CRM/`subscriptions`
   hängen. Dazu Legal-Seiten (Impressum/Datenschutz) — Pflicht für Prod.
7. **🟡 Proxy-Auth-Weiterleitung** — `// TODO Auth: currentToken()` in
   `plattform/` und `builder/` `/api/v1/[...path]/route.ts` ist auskommentiert.

## Phase 3 — Launch-begleitend & danach (🟢)

Nicht Go-Live-kritisch für den Kern; parallel oder Fast-Follow.

- **🟢 👤 S3-Storage-Cutover** — Skript fertig & verifiziert; wartet nur auf Hetzner-
  Bucket (`nextdays-media`, privat/EU) + Creds in Coolify, dann `STORAGE_BACKEND`
  `file`→`s3`. Ref: `deploy/storage/README.md`.
- **🟢 👤 Mail iCloud-Warmup** — Apple/Proofpoint blockt präventiv (junge IP);
  Delisting-Ticket offen, Warmup läuft. Vor breitem Prod-Versand beobachten.
  Mailcow-Volume-Backup noch nicht Teil des Backups → nachziehen.
- **🟢 Google-Kalender-Sync** — reiner Plan; eigener `mail-sync`-Dienst, Google
  OAuth-Verifizierung (sensibler Scope, Wochen Wartezeit) zuerst starten. ~3–4 Wochen.
  Ref: `deploy/mail/PLAN-google-kalender-sync.md`.
- **🟢 Objektkartei (Lastenheft §6)** — 8-stufiger Plan, wartet auf Freigabe (kein Code).
  Ref: `docs/PLAN-objektkartei.md`.
- **🟢 Derived Rate-Plans (SiteMinder-Modell)** — Plan, phasenweise Freigabe.
  Ref: `docs/rate-plan-derived-plan.md`.
- **🟢 Channex-Zert Test #10 abschließen** — Ref: `docs/plan-channex-cert-test10.md`.
- **🟢 Payments Revolut** — bewusst zurückgestellt (Stripe primär, ADR-0011).
- **🟢 CRM- / OCR-Slice** — heute reine Health-Stubs; OCR hängt am Meldeschein/
  Check-in-Modul (`mobile-bestdays/screens/Checkin.tsx` bewusst Dummy).
- **🟢 Custom Dashboard (Drag&Drop/White-Label), HR/Jobs/Marktplatz-Bereiche** —
  Gerüst; nach MVP ausbauen. Ref: `docs/REQUIREMENTS-GAP.md`.
- **🟢 Skalierung/Performance** — Pläne vorhanden (100 Betriebe / 100 Nutzer),
  greifen erst bei Wachstum. Ref: `docs/skalierung-100-betriebe-plan.md`.

---

## Kritischer Pfad (Kurzfassung)

**Vor jedem echten Kunden:** Phase 0 (DB-/Auth-Härtung, Key-Rotation) →
Phase 1 (Prod-Trennung, Domain, Edge/WAF, Monitoring). Diese beiden Phasen sind
die harten Blocker — ohne sie kein Go-Live, egal wie fertig die Features sind.

**Für ein verkaufbares MVP zusätzlich:** aus Phase 2 mindestens Mobile-Gast (P7–P9,
falls die App Teil des Launch-Versprechens ist), Marketing-Trial+Legal, i18n-Basis
und die Hotel-Überbuchungslücke. Buchhaltung-Tiefe nach Bedarf priorisieren.

**Reihenfolge-Regel:** Security/Betrieb (0+1) blockieren alles → zuerst. Feature-
Lücken (2) danach, parallelisierbar. Phase 3 begleitet den Launch oder folgt.

> Diese Datei ist der lebende Launch-Plan. Bei jeder erledigten Position hier
> abhaken/streichen und die zugehörige Detail-Doku aktualisieren (CLAUDE.md:
> Doku-Aktualität ist Teil der „fertig"-Definition).
