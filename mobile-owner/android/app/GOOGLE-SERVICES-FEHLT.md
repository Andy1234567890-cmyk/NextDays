# `google-services.json` fehlt hier bewusst

Diese App hat das Package **`com.mynextdays.owner`**. Die aus
`mobile-nextdays` kopierte `google-services.json` galt für
`com.mynextdays.app` und wurde deshalb ENTFERNT, nicht übernommen:

- Das Gradle-Plugin `com.google.gms.google-services` bricht den Build ab, wenn
  im JSON kein Client mit dem eigenen `applicationId` steht („No matching client
  found for package name").
- Schlimmer wäre der umgekehrte Fall: eine Konfiguration, die zum falschen
  Package gehört, lässt Push scheinbar laufen und liefert nie eine Meldung aus.
  Ein Konfigurationswert, dessen Fehlen still bleibt, ist derselbe Fehler wie
  ein verschluckter Exception (CLAUDE.md, Wurzel 5).

## Was zu tun ist (Firebase-Konsole, einmalig)

1. Im BESTEHENDEN Firebase-Projekt (`project-460d8aaf-4b7d-4d13-b3a`, dasselbe
   wie PMS und Marktplatz) eine neue **Android-App** anlegen mit Package
   `com.mynextdays.owner`.
2. Den SHA-1 des Release-Keystores hinterlegen (derselbe Keystore-Ablauf wie
   bei `mobile-nextdays`, Signing-Env `MYNEXTDAYSOWNER_RELEASE_*`).
3. Die erzeugte `google-services.json` nach `android/app/google-services.json`
   legen.
4. Für iOS analog eine **iOS-App** mit Bundle-ID `com.mynextdays.owner` anlegen
   und die `GoogleService-Info.plist` nach `ios/MyNextDaysOwner/` legen.

Solange die Dateien fehlen, ist der Push-Pfad (`lib/push.ts`) nicht
funktionsfähig — der Rest der App läuft. `lib/push.ts` lädt Firebase bewusst
per `require` erst bei Bedarf, ein fehlendes Modul stürzt also nicht beim
Start ab.

## Was BEREITS erledigt ist (Backend, 03.09.2026)

Damit die Datei genügt, wenn sie kommt: die Empfangskette ist gebaut. Push für
diese App hat eine EIGENE Kennung `mynextdaysowner` — vorher stand hier
`mynextdays`, also die Kennung der Verwaltungs-App. Ein Eigentümer hätte damit
`betrieb_buchung` und `messages` bekommen (Meldungen für die Verwaltung) und
seine eigenen nie.

Gebaut und live geprüft:

| Stelle | Was |
|---|---|
| `lib/push.ts` | `APP_KENNUNG = "mynextdaysowner"` |
| `notification_settings/schemas.py` | `Literal[…, "mynextdaysowner"]` |
| `notification_settings/geraete.py` | `_APPS` um die Kennung erweitert |
| Migration 0532 | `push_devices_app_check` erweitert (live) |
| `katalog.py` | Feld `push_app` je Kategorie; `owner_booking`, `owner_service`, `block_decision` → Owner-App **und** PUSH-Kanal |
| Migration 0532 | Spalten `owner_booking_push`, `owner_service_push`, `block_decision_push` (live) |
| `dispatcher.py` | wählt die Ziel-App aus `push_app`, statt fest `mynextdays` zu senden |

Der letzte Punkt war der stille: `_sende_push` hatte die Verwaltungs-App
hart verdrahtet. Selbst mit korrekter Kennung in der App hätte der Eigentümer
nichts bekommen, weil der Versand nie nach seinen Geräten gefragt hätte.

**Nach dem Ablegen der Datei** genügt ein Neubau (`bunx react-native run-android`);
die drei Meldungen „keine Firebase-App konfiguriert" verschwinden dann von
selbst. Bis dahin protokolliert die App den Mangel einmal pro Start als
`console.info` mit Verweis auf diese Datei — sichtbar, aber nicht als
Stacktrace, der echte Push-Fehler begräbt.

## Auslieferung: Workflow und Beta-Test (03.09.2026 gebaut)

Der Release-Workflow ist da: **`.github/workflows/mobile-release-owner.yml`**
(eigene Datei je App — ADR-0019/0022, damit kein `inputs.app` die Apps
verwechseln kann). Start per Hand über Actions → *Mobile Release myNextDays
Eigentümer (Android)*, Wahl zwischen APK (Beta über Firebase) und AAB (Play).

Was der Lauf tut: Typprüfung + Tests, Keystore entpacken und lesbar beweisen,
Release bauen, **Signatur beweisen** (`apksigner`), **Paketnamen beweisen**
(`aapt2 dump packagename` — muss `com.mynextdays.owner` sein), dann an die
Gruppe `beta-tester-owner` verteilen. Jeder Beweis-Schritt bricht ab, statt ein
unbrauchbares Artefakt weiterzugeben.

Der Paketnamen-Beweis ist der Schritt, den die Schwester-Workflows nicht haben.
`com.mynextdays.owner` und `com.mynextdays.app` unterscheiden sich um ein Wort;
ein falsch gebautes Artefakt an die Eigentümer-Tester zu verteilen wäre von
außen nicht zu sehen, und sie würden die Verwaltungs-App installieren.

### Was du EINMALIG anlegen musst

**1. Firebase-Konsole** — Android-App `com.mynextdays.owner` im Projekt
`project-460d8aaf-4b7d-4d13-b3a` (siehe oben). Danach hast du beides, was der
Workflow braucht: die `google-services.json` und die **App-ID**
(Form `1:683362094842:android:…`).

**2. Tester-Gruppe** in App Distribution: **`beta-tester-owner`**.
Eine EIGENE Gruppe, weil ein Eigentümer kein Mitarbeiter des Betriebs ist —
`beta-tester` gehört der PMS-App. Anlegen und pflegen:

```bash
bash scripts/mobile/beta-tester-verwalten.sh mobile-owner liste
bash scripts/mobile/beta-tester-verwalten.sh mobile-owner hinzu name@firma.de
```

Das Skript verlangt die App seit dem 03.09.2026 als erstes Argument und hat
KEINEN Default: ein stiller Rückfall auf `beta-tester` hätte einer
Eigentümer-Adresse die Verwaltungs-App aufs Telefon gelegt.

**Achtung — die Falle, vor der das Skript selbst warnt:** der Build ist auch
mit LEERER Gruppe grün. Er verteilt dann an niemanden. „Lauf grün" heißt nicht
„Tester haben die App".

**3. Release-Keystore** (unersetzlich, außerhalb des Repos):

```bash
bash scripts/mobile/keystore-erzeugen.sh mobile-owner
```

**4. Sechs GitHub-Secrets** (`MOBILE_SUPABASE_ANON_KEY` gilt projektweit und ist schon gesetzt):

| Secret | Woher |
|---|---|
| `MYNEXTDAYSOWNER_RELEASE_KEYSTORE_BASE64` | Ausgabe von Schritt 3 |
| `MYNEXTDAYSOWNER_RELEASE_STORE_PASSWORD` | bei Schritt 3 gewählt |
| `MYNEXTDAYSOWNER_RELEASE_KEY_ALIAS` | `mobile-owner` |
| `MYNEXTDAYSOWNER_RELEASE_KEY_PASSWORD` | bei Schritt 3 gewählt |
| `MYNEXTDAYSOWNER_GOOGLE_SERVICES_JSON_BASE64` | `base64 -i mobile-owner/android/app/google-services.json \| tr -d '\n'` |
| `MYNEXTDAYSOWNER_FIREBASE_APP_ID` | App-ID aus Schritt 1 |

Die App-ID steht als **Secret** und nicht fest im Workflow: sie entsteht erst
beim Anlegen der App. Eine geratene ID wäre schlimmer als keine — die
Verteilung ginge dann an eine FREMDE App, und die Schwester-IDs unterscheiden
sich nur in den letzten Zeichen. Der Workflow prüft zusätzlich die Form
(`1:683362094842:android:…`), damit eine ID aus dem falschen Projekt nicht wie
ein Rechteproblem aussieht.

Jedes fehlende Secret bricht den Lauf mit einer Meldung ab, die den Befehl zum
Setzen nennt — kein Lauf verteilt „halb".

### Wächter

`scripts/mobile/release-kette-pruefen.sh` (läuft in der CI bei jedem Lauf) hält
die Kette für alle drei Apps: Release-Workflow vorhanden, EIGENE Tester-Gruppe
(und keine fremde), Keystore-Präfix passend zu `build.gradle`,
`google-services.json` im Workflow, wenn die App Firebase nutzt, und ein
Signatur-Beweis. Eine vierte App ohne Eintrag lässt ihn fehlschlagen — sonst
wäre er über sie stumm, also genau der Fehler, den er verhindern soll.
