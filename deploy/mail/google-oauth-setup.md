# Google OAuth Setup für den Kalender-Sync (Web-Console)

> Projekt: **nextdays** (Nr. 275621779169) · Konto: **info@the-freelancer-marketing.de**
> Calendar API ist bereits per CLI aktiviert. Consent-Screen + OAuth-Client
> gehen NUR über die Web-Console (die alten `gcloud`-Befehle sind deprecated
> und werden 03/2026 abgeschaltet).

## Wichtige Werte (überall exakt so verwenden)

| Feld | Wert |
|---|---|
| App-Name | `myNextDays` |
| Support-E-Mail | (dein Postfach, z.B. `info@mynextdays.dk` oder das Google-Konto) |
| App-Domain (Startseite) | `https://mynextdays.com` |
| Datenschutzerklärung | `https://mynextdays.com/datenschutz` (muss existieren) |
| Nutzungsbedingungen | `https://mynextdays.com/agb` (muss existieren) |
| Autorisierte Domain | `mynextdays.dk` (und ggf. `mynextdays.com`) |
| Scope | `https://www.googleapis.com/auth/calendar` |
| **Redirect-URI** | `https://sync.mynextdays.dk/oauth/callback` |
| Autorisierter JS-Origin | `https://sync.mynextdays.dk` |

## Schritt 1 — OAuth-Consent-Screen (Google Auth Platform)

1. Öffne: <https://console.cloud.google.com/auth/overview?project=nextdays>
   (bzw. „APIs & Dienste → OAuth-Zustimmungsbildschirm").
2. **Nutzertyp: „Extern"** wählen → Erstellen.
3. **App-Informationen:**
   - App-Name: `myNextDays`
   - Nutzer-Support-E-Mail: dein Postfach
4. **App-Domain:**
   - Startseite: `https://mynextdays.com`
   - Datenschutz: `https://mynextdays.com/datenschutz`
   - Nutzungsbedingungen: `https://mynextdays.com/agb`
5. **Autorisierte Domains:** `mynextdays.dk` (+ `mynextdays.com`) hinzufügen.
6. **Entwickler-Kontakt-E-Mail:** dein Postfach → Speichern.

## Schritt 2 — Scope hinzufügen

1. Weiter zu **„Scopes"** → **„Bereiche hinzufügen oder entfernen"**.
2. Manuell hinzufügen: `https://www.googleapis.com/auth/calendar`
   (Voll-Zugriff Lesen+Schreiben — nötig für Zwei-Wege-Sync).
3. Aktualisieren → Speichern.

## Schritt 3 — Testnutzer (bis Verifizierung durch ist)

1. **„Testnutzer"** → deine Test-Mailadresse(n) hinzufügen (die Google-Konten,
   mit denen ihr zuerst syncen wollt). Ohne Verifizierung max. 100 Testnutzer.

## Schritt 4 — OAuth-Client-ID (Web)

1. **„APIs & Dienste → Anmeldedaten"**:
   <https://console.cloud.google.com/apis/credentials?project=nextdays>
2. **„Anmeldedaten erstellen" → „OAuth-Client-ID"**.
3. **Anwendungstyp: „Webanwendung"**.
4. Name: `myNextDays Mail Sync`
5. **Autorisierte JavaScript-Quellen:** `https://sync.mynextdays.dk`
6. **Autorisierte Weiterleitungs-URIs:** `https://sync.mynextdays.dk/oauth/callback`
7. **Erstellen** → es erscheinen **Client-ID** und **Client-Secret**.
   → **Beide kopieren** (Secret nur jetzt sichtbar!). Kommen später verschlüsselt
   in die mail-sync-Config auf dem Mail-Server (NICHT ins Repo committen).

## Schritt 5 — Verifizierung starten (läuft Wochen)

1. Zurück zum Consent-Screen → **„App veröffentlichen"** / **„Zur Verifizierung
   einreichen"**.
2. Google verlangt bei dem `calendar`-Scope (sensibel) eine Prüfung:
   Datenschutz-URL erreichbar, Domain-Verifizierung (Search Console),
   Verwendungszweck-Beschreibung, ggf. Demo-Video.
3. Bis die Verifizierung durch ist: App bleibt im **Test-Modus** (nur Testnutzer,
   Warnhinweis beim Login) — für die Entwicklung völlig ausreichend.

## Danach

Client-ID + Client-Secret an den mail-sync-Dienst geben (Server-Env, verschlüsselt).
Redirect-URI `https://sync.mynextdays.dk/oauth/callback` muss der Dienst bedienen.
