# Prompt für Claude Code — neues Release der App myNextDays hochladen

Kopiere alles ab „--- PROMPT ---" in eine neue Claude-Code-Sitzung im Ordner
`/Users/andystaudinger/NextDays`. Claude Chrome muss verbunden sein
(`claude --chrome` oder `"chrome": true` in `.claude/settings.local.json`) —
beides wirkt erst nach einem Neustart der Sitzung, nicht mitten in ihr.

--- PROMPT ---

Bau und verteil ein neues Android-Release der App `mobile-nextdays`
(`com.mynextdays.app`). Ich klicke nichts selbst; du löst den Lauf aus,
verfolgst ihn und weist mir am Ende nach, dass das Artefakt wirklich bei den
Testern liegt. Vorher fragst du mich EINMAL um Freigabe — ein signierter Build,
der bei Testern landet, ist eine Veröffentlichung (CLAUDE.md: nichts
committen/pushen/deployen ohne Ansage).

## Nicht verhandelbar

- **Nicht lokal bauen.** Kein `gradlew`, kein `assembleRelease`, kein
  Android-Emulator auf diesem Rechner. Er hat 8 GB; die Toolchain sind ~8 GB,
  und der Release-Schlüssel gehört nicht auf einen Laptop. Gebaut wird
  AUSSCHLIESSLICH in GitHub Actions (`docs/MOBILE-BETA-VERTEILUNG.md`).
- **Kein Playwright.** Für alles im Browser: Claude Chrome, sonst
  `node scripts/diagnose/chrome-lesen.mjs` über den Debug-Port mit eigenem
  Profil. Gründe und Startbefehl stehen in CLAUDE.md.
- **Version nicht von Hand hochzählen.** `versionCode` ist
  `github.run_number`, `versionName` ist `<Basis>+<run_number>`; beides setzt
  der Workflow per `-PversionCode` / `-PversionName`. In
  `android/app/build.gradle` steht dazu nichts, was du ändern müsstest — ein
  `sed` darauf wäre falsch.

## Was schon steht — prüfen, nicht neu bauen

| | |
|---|---|
| Workflow | `.github/workflows/mobile-release.yml`, Anzeigename **Mobile Release (Android)** |
| Auslöser | `workflow_dispatch` mit `app`, `artefakt` (`apk` \| `aab`), `notiz` |
| Was der Lauf tut | bun install → `tsc --noEmit` → Jest → Keystore aus Secret → `assembleRelease` → `apksigner verify` → Firebase App Distribution → GitHub-Artefakt (14 Tage) |
| APK-Ziel | Firebase App Distribution, App-ID `1:683362094842:android:98b6212be46056d2bc0343`, Gruppe `beta-tester` |
| AAB-Ziel | NUR GitHub-Artefakt — den Upload in die Play Console macht ein Mensch |
| Secrets | `MYNEXTDAYS_RELEASE_KEYSTORE_BASE64`, `_STORE_PASSWORD`, `_KEY_ALIAS`, `_KEY_PASSWORD`, `MYNEXTDAYS_GOOGLE_SERVICES_JSON_BASE64`, `MOBILE_SUPABASE_ANON_KEY` |

`MOBILE_SUPABASE_ANON_KEY` ist Pflicht: `lib/config.secrets.ts` ist
gitignoriert, und mit dem CI-Platzhalter hätten die Tester **kein Realtime**.
Der Workflow bricht ohne das Secret ab — wenn er das tut, ist das die Antwort,
kein Grund für einen Umweg.

## Der Ablauf

### 1. Vorher prüfen, ob dieses Release überhaupt Sinn ergibt

Die App spricht auch im DEV-Build gegen `https://api.mynextdays.com`. Ein APK
mit neuen Bildschirmen, deren Endpunkt noch nicht deployt ist, zeigt bei den
Testern Fehler, die im Code nicht stehen. Prüfe deshalb ZUERST:

```bash
git -C . log --oneline -5
git status --short                       # nichts Ungebautes offen?
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://api.mynextdays.com/api/v1/reservations/dashboard/verlauf?metrik=revenue&zeitraum=30d"
```

`401` = Route ist live (Anmeldung fehlt nur, weil curl kein Token hat).
`404` = der Backend-Deploy hängt noch → **nicht bauen**, erst melden.

Sieh außerdem nach, ob eine Migration offen ist, die dieses Release braucht.
Es gibt KEINEN automatischen Runner; verglichen wird `supabase/migrations/`
gegen `public.schema_migrations` in der Live-DB (Zugangsweg steht im Kopf von
`supabase/apply-migrations.sh`) — nicht gegen den Git-Verlauf und nicht gegen
meine Zusage. Einspielen tust du sie NICHT selbst (CLAUDE.md): sag mir, welche
fehlt und was ohne sie still kaputt ist.

### 2. Release-Notiz schreiben

Aus den Commits seit dem letzten Lauf, in der Sprache der Tester: was sie
sehen, nicht welche Datei sich geändert hat. Zwei bis fünf Zeilen. Leg sie mir
zusammen mit der Freigabefrage vor.

### 3. Auslösen und verfolgen

```bash
gh workflow run "Mobile Release (Android)" \
  -f app=mobile-nextdays -f artefakt=apk -f notiz="<deine Notiz>"
gh run list --workflow="Mobile Release (Android)" --limit 1
gh run watch <run-id>
```

Bricht er ab: `gh run view <run-id> --log-failed`, Ursache benennen, beheben,
neu auslösen. Nichts unterdrücken, nichts „nochmal probieren", ohne zu wissen,
warum es beim ersten Mal nicht ging (Wurzel 5).

### 4. Im Browser nachweisen, dass es angekommen ist

Mit Claude Chrome, nicht durch Raten am Log:

- **Firebase App Distribution** → Projekt `project-460d8aaf-4b7d-4d13-b3a` →
  App `com.mynextdays.app` → Releases. Steht das neue Build dort, mit der
  richtigen Versionsnummer, der Notiz und der Gruppe `beta-tester`?
- Wenn nein: die Gruppe hat keine Mail bekommen, egal was der Lauf grün
  meldet. Das ist dann der Befund, nicht „vermutlich unterwegs".

Nenne mir am Ende: Lauf-Nummer, `versionName`, `versionCode`, den
SHA-Fingerabdruck aus dem Schritt „Signatur beweisen" und den Link zum Release
in der Firebase-Konsole.

### 5. Nur falls ich „Play Store" sage

Dann `artefakt=aab` statt `apk`. Das AAB wird NICHT automatisch hochgeladen —
es liegt als GitHub-Artefakt. Lade es herunter
(`gh run download <run-id> -D <scratchpad>`), öffne mir die Play Console im
Browser auf der richtigen Spur und sag mir, welche Felder noch fehlen. Den
Upload-Klick mache ich.

## Woran ich merke, dass du geschludert hast

- Du hast lokal gebaut oder einen Emulator gestartet.
- Du hast die Version in einer Datei hochgezählt.
- Du meldest „verteilt", ohne in der Firebase-Konsole nachgesehen zu haben.
- Du hast gebaut, obwohl der Backend-Endpunkt noch 404 lieferte.
