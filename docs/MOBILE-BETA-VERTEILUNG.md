# Android-Beta an Testteilnehmer verteilen

Wie ein signiertes APK zu Beta-Testern kommt — und was davon einmalig ist.

Es gibt **DREI Apps und drei getrennte Wege** (ADR-0019/0022). Bis zum
16.09.2026 beschrieb dieses Dokument nur `mobile-nextdays`; die
Eigentuemer-App ging da schon in die Beta, ohne hier vorzukommen.

| | myNextDays | myNextDays Eigentuemer | myBestDays |
|---|---|---|---|
| Projekt | `mobile-nextdays` | `mobile-owner` | `mobile-bestdays` |
| Paket | `com.mynextdays.app` | `com.mynextdays.owner` | `com.mybestdays.app` |
| Workflow | Mobile Release (Android) | Mobile Release myNextDays Eigentuemer (Android) | Mobile Release myBestDays (Android) |
| Tester-Gruppe | `beta-tester` | `beta-tester-owner` | `beta-tester-bestdays` |
| Firebase-App-ID | `1:683362094842:android:98b6212be46056d2bc0343` | Secret `MYNEXTDAYSOWNER_FIREBASE_APP_ID` | `1:683362094842:android:17381b5cdbd3ed7cbc0343` |
| Keystore-Secrets | `MYNEXTDAYS_RELEASE_*` | `MYNEXTDAYSOWNER_RELEASE_*` | `MYBESTDAYS_RELEASE_*` |
| google-services | Secret `MYNEXTDAYS_GOOGLE_SERVICES_JSON_BASE64` | Secret `MYNEXTDAYSOWNER_GOOGLE_SERVICES_JSON_BASE64` | — (kein Firebase-SDK) |

**Je App eine eigene Datei, kein gemeinsamer Workflow mit `inputs.app`.** Es
haette genau eine Verwechslung gebraucht, um die Eigentuemer-App mit dem
PMS-Schluessel zu signieren oder sie an das Verwaltungsteam zu verteilen —
beides nicht rueckholbar, weil Android die App-Identitaet an den
Signaturschluessel bindet. Die Eigentuemer-App traegt aus demselben Grund
einen eigenen Schritt, der den **Paketnamen des fertigen APK** beweist:
`com.mynextdays.owner` und `com.mynextdays.app` unterscheiden sich um ein
Wort, und von aussen sieht man dem verteilten Artefakt nichts an.

Die App-ID der Eigentuemer-App steht als Secret und NICHT im Text: sie
entsteht erst beim Anlegen der App in der Konsole, und eine geratene ID waere
schlimmer als keine — `appdistribution:distribute` verteilte dann an eine
FREMDE App. `scripts/mobile/release-kette-pruefen.sh` haelt fuer alle drei
zusammen, dass Workflow, eigene Gruppe, Keystore-Secret und Signatur-Beweis
existieren.

Der Rest dieses Dokuments beschreibt den Weg am Beispiel `mobile-nextdays`;
fuer die anderen beiden gelten dieselben Schritte mit den Werten aus der
Tabelle.

Gebaut wird **ausschliesslich in GitHub Actions**, nicht auf einem Arbeitsrechner.
Grund ist derselbe wie beim Web-Build (`CLAUDE.md`): eine lokale Android-
Toolchain sind ~8 GB, und ein Release-Schluessel, der auf einem Laptop liegt und
dort benutzt wird, wandert erfahrungsgemaess in Screenshots und Shell-History.

## Ueberblick

```
  workflow_dispatch (Mensch waehlt App + apk/aab)
        │
        ├─ typecheck + jest            ← auch hier, nicht nur in ci.yml
        ├─ Keystore aus GitHub-Secret  ← Base64, nach dem Lauf verworfen
        ├─ gradlew assembleRelease     ← signiert
        ├─ apksigner verify            ← BEWEIS, nicht Annahme
        ├─ Firebase App Distribution   ← Gruppe „beta-tester", schluessellos (WIF)
        └─ GitHub-Artifact (14 Tage)   ← Rueckfallweg
```

## Firebase (schon eingerichtet, 19.08.2026)

| | |
|---|---|
| Google-Cloud-Projekt | `project-460d8aaf-4b7d-4d13-b3a` (Nr. `683362094842`) |
| Firebase-App-ID (Android) | `1:683362094842:android:98b6212be46056d2bc0343` |
| Tester-Gruppe | `beta-tester` („Beta-Tester") |
| Dienste | App Distribution, Crashlytics-API aktiv |

Es ist **dasselbe** Projekt, in dem die Maps-/Translate-/OAuth-Schluessel liegen —
also dasselbe Guthaben. App Distribution und Crashlytics kosten nichts.

`android/app/google-services.json` ist **gitignoriert** (enthaelt einen echten
API-Schluessel). Neu holen:

```bash
firebase apps:sdkconfig ANDROID 1:683362094842:android:98b6212be46056d2bc0343 \
  --project project-460d8aaf-4b7d-4d13-b3a \
  --out mobile-nextdays/android/app/google-services.json
```

### Warum der CI-Zugang schluessellos ist

Die Organisation `jeanine-org` erzwingt seit dem 18.08.2026
`iam.disableServiceAccountKeyCreation` und `…KeyUpload`. Ein Service-Account-Key
als GitHub-Secret ist damit **nicht erzeugbar** — und das ist gut so: ein
langlebiger Schluessel in einem CI-Secret ist ein bekannter Leckweg.

Stattdessen Workload Identity Federation: GitHub reicht pro Lauf ein kurzlebiges
OIDC-Token ein, Google tauscht es gegen einen Zugang. Wer darf das? Nur dieses
eine Repo — festgeschrieben an zwei Stellen:

```
Provider-Bedingung : assertion.repository == 'Nextdays-AirSmil/NextDays'
SA-Bindung         : principalSet://…/attribute.repository/Nextdays-AirSmil/NextDays
Rolle des SA       : roles/firebaseappdistro.admin   (genau eine, nichts weiter)
```

Ein Fork oder ein fremdes Repo bekommt kein Token, auch nicht mit gueltigem
GitHub-OIDC. Und der Service-Account kann ausser App Distribution nichts.

## Einmalig: Release-Keystore

**Der Keystore ist unersetzlich.** Android bindet die Identitaet der App an ihren
Signaturschluessel; ist er weg, kann fuer `com.mynextdays.app` nie wieder ein
Update veroeffentlicht werden — auch Google kann das nicht reparieren.

```bash
bash scripts/mobile/keystore-erzeugen.sh mobile-nextdays
```

Das Skript legt `~/.keystores/mobile-nextdays-release.keystore` an (ausserhalb des
Arbeitsbaums, damit ihn kein `rm -rf` im Projektordner mitnimmt), verweigert das
Ueberschreiben eines vorhandenen Keystores und gibt den SHA-Fingerabdruck aus.

Danach vier Secrets setzen:

```bash
gh secret set MYNEXTDAYS_RELEASE_KEYSTORE_BASE64 < ~/.keystores/mobile-nextdays-release.keystore.base64
gh secret set MYNEXTDAYS_RELEASE_STORE_PASSWORD    # das gewaehlte Passwort
gh secret set MYNEXTDAYS_RELEASE_KEY_ALIAS         # mobile-nextdays
gh secret set MYNEXTDAYS_RELEASE_KEY_PASSWORD      # dasselbe Passwort
gh secret set MOBILE_SUPABASE_ANON_KEY             # Wert aus mobile-nextdays/lib/config.secrets.ts
rm -f ~/.keystores/mobile-nextdays-release.keystore.base64
```

`MOBILE_SUPABASE_ANON_KEY` ist Pflicht: `lib/config.secrets.ts` ist gitignoriert,
und mit dem Platzhalter (den die CI-Pruefjobs nutzen) haette die App bei den
Testern **kein Realtime**. Der Workflow bricht ohne dieses Secret ab, statt still
eine halb funktionierende App auszuliefern.

### Nach dem ersten Keystore: Firebase-Schluessel binden

Der von Firebase automatisch erzeugte Android-API-Schluessel hat aktuell
`androidKeyRestrictions: {}` — also **keine** Bindung an unsere App. Sobald der
Keystore existiert, den SHA-1 eintragen:

```bash
keytool -list -v -keystore ~/.keystores/mobile-nextdays-release.keystore | grep SHA1
# dann in der Firebase-Konsole → Projekteinstellungen → Meine Apps → SHA-Fingerabdruck
```

## Ein Beta-Build ausloesen

Actions → den Workflow der App aus der Tabelle oben → *Run workflow*:

| Eingabe | Wert |
|---|---|
| app | nur bei „Mobile Release (Android)": `mobile-nextdays` (die anderen zwei haben je eine eigene Datei und damit kein Auswahlfeld) |
| artefakt | `apk` (Tester) bzw. `aab` (Play Store) |
| notiz | was die Tester wissen sollen — leer = Commit-Titel |

Von der Kommandozeile, am Beispiel der Eigentuemer-App:

```bash
gh workflow run "Mobile Release myNextDays Eigentümer (Android)" \
  -f artefakt=apk -f notiz="Was die Tester sehen sollen"
gh run list --workflow=mobile-release-owner.yml --limit 1
gh run watch <run-id>
```

Bei `apk` laedt der Lauf die Datei automatisch zu App Distribution und die
Tester-Gruppe **dieser** App bekommt eine Mail. `aab` wird nur als Artefakt
abgelegt; den Upload in die Play Console macht ein Mensch.

Der Workflow laeuft **nur auf Ansage** (`workflow_dispatch`), nicht bei jedem
Push: ein signierter Build, der bei Testern landet, ist eine Veroeffentlichung.

### Was VOR dem Verteilen prueft — und was nicht

In `ci.yml` baut der Job `mobile-android-release` fuer `mobile-nextdays` und
`mobile-owner` bei jeder Aenderung an der App ein **unsigniertes** Release —
genau die Fehlerklasse, die Debug-Build, `tsc` und Jest nicht sehen (ProGuard
entfernt Code, den ein natives Modul per Reflection sucht; eine neue
Abhaengigkeit kollidiert erst beim Zusammenbauen; Hermes scheitert an etwas,
das Metro toleriert).

Dieser Job hat vom 09.09. bis zum 16.09.2026 **nichts gebaut**: sein erster
Schritt trug eine Bedingung auf seine eigene Ausgabe, wurde deshalb immer
uebersprungen, und weil jeder folgende Schritt daran haengt, lief der Job leer
durch — und meldete Erfolg. Belegt an Lauf 34995333441, wo alle zwoelf
Schritte `skipped` sind. Seitdem prueft
`scripts/diagnose/workflow-schrittbedingungen-pruefen.py` genau diese Klasse
mit, damit ein stillgelegtes Gate nicht wieder als gruener Haken erscheint.

## Tester hinzufuegen

```bash
firebase appdistribution:testers:add tester@example.com \
  --project project-460d8aaf-4b7d-4d13-b3a
firebase appdistribution:group:members:add beta-tester tester@example.com \
  --project project-460d8aaf-4b7d-4d13-b3a
```

**Die Gruppe ist Teil der Marken-/Rollengrenze, keine Kosmetik.** Ein
Eigentuemer ist kein Mitarbeiter des Betriebs und kein Marktplatz-Gast; wer
ihn in `beta-tester` aufnimmt, schickt ihm die PMS-App. Die drei Gruppen
heissen `beta-tester`, `beta-tester-owner` und `beta-tester-bestdays` und
werden nicht vermischt — auch nicht „nur zum Testen".

Der Tester bekommt eine Einladung, installiert einmal die App-Tester-App und
danach jede neue Version per Benachrichtigung. Auf dem Geraet muss die
Installation aus unbekannten Quellen erlaubt sein.

## Abstuerze analysieren

Crashlytics ist als **API aktiv, aber im Code nicht eingebaut** — bewusst, siehe
unten. Bis dahin ist der Weg zum Absturz:

```bash
adb logcat --pid=$(adb shell pidof -s com.mynextdays.app)
```

Zu erwarten ist eine **minifizierte** Hermes-Zeile (`index.android.bundle:1:…`),
weil Release-Builds keine Source-Map mitliefern. Auflösen:

```bash
npx metro-symbolicate android/app/build/generated/sourcemaps/react/release/index.android.bundle.map < absturz.txt
```

### Warum kein Crash-Reporter im Code

Bewusst offen gelassen (19.08.2026). Crashlytics faengt in React Native auch
JS-Fehler, kann sie aber in der Konsole **nicht** ueber Source-Maps aufloesen —
man braucht ohnehin den Weg oben. Ein Reporter ist damit Komfort, kein Ersatz.
Er wird nachgezogen, wenn die Beta zeigt, dass Fehler auftreten, die per
`logcat` nicht greifbar sind — dann mit dem dann bekannten Bedarf statt auf
Verdacht. `docs/ROADMAP.md` fuehrt „Monitoring Schicht 3" weiterhin als offen.

## Play Store spaeter

Fuer die Produktion gilt: Konten, die als **Organisation** registriert sind,
sind von der Testpflicht ausgenommen. Personenkonten, die nach dem 13.11.2023
angelegt wurden, muessen vorher einen *Closed Test* mit **12 Testern ueber 14
zusammenhaengende Tage** fahren. *Internal Testing* ist davon **nicht** betroffen
und jederzeit nutzbar — die 12/14-Huerde blockiert nur den Sprung nach
Produktion. Bei der Kontoanlage ist die Wahl Organisation/Person also eine
Terminentscheidung, keine Formalie.
