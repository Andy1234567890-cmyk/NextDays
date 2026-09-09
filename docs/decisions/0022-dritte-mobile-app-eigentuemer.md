# ADR-0022: Eine dritte Mobile-App für den Eigentümer

- Status: **ANGENOMMEN** (2026-09-02)
- Erweitert: [ADR-0019](0019-zwei-mobile-apps.md) („Zwei Mobile-Apps statt
  einer All-in-One-App"). ADR-0019 bleibt in Kraft; seine Aussage
  „**Der Owner/Eigentümer gehört nach `mobile-nextdays`**" wird durch diese
  Entscheidung ersetzt.
- Anlass: Auftrag vom 02.09.2026, eine eigenständige iOS- und Android-App für
  Eigentümer zu erstellen, mit einem Smoobu-Screenshot als UI-Vorlage.

## Frage

Das Eigentümer-Erlebnis existierte bereits vollständig in `mobile-nextdays`:
sieben Screens (Objekte, Kalender, Auszahlungen, Statistiken, Anfragen,
Objektdetail, Fotoalbum), ein eigener Tab-Navigator (`OwnerTabs`) und eine
hermetische Datenschicht gegen `/public-portal`. Welches Erlebnis ein Nutzer
sieht, entschied seine Server-Rolle (`lib/experience.ts`). Warum daraus eine
dritte App?

## Entscheidung

**Der Eigentümer bekommt ein eigenes React-Native-Projekt `mobile-owner/`.**

| | `mobile-bestdays/` | `mobile-nextdays/` | `mobile-owner/` |
|---|---|---|---|
| Rolle | Gast | Agentur · Mitarbeiter | Eigentümer |
| Marke | myBestDays | myNextDays | myNextDays (Untermarke) |
| Store-Name | myBestDays | myNextDays | myNextDays Eigentümer |
| Bundle-ID | `com.mybestdays.app` | `com.mynextdays.app` | `com.mynextdays.owner` |
| URL-Scheme | `mybestdays://` | `mynextdays://` | `mynextdaysowner://` |
| Xcode-Target | `MyBestDays` | `MyNextDays` | `MyNextDaysOwner` |
| Android-Package | `com.mybestdays.app` | `com.mynextdays.app` | `com.mynextdays.owner` |
| Signing-Env | `MYBESTDAYS_RELEASE_*` | `MYNEXTDAYS_RELEASE_*` | `MYNEXTDAYSOWNER_RELEASE_*` |
| Auth-Welt | `portal_guests` | Tenant | Tenant (Rolle `owner`) |
| Endpunkte | Gast-API | `/api/v1/*` | `/api/v1/public-portal/*` |

**Keine dritte Marke.** Die App trägt Namen, Wortmarke und Akzentfarbe
(`#C42B3A`) von myNextDays — ausdrückliche Ansage vom 02.09.2026: *„unsere
Farben sollten schon erhalten bleiben"*. Aus der Smoobu-Vorlage übernommen ist
die **Struktur** (gerahmte Karten mit weichem Schatten, Kennzahl-Widgets mit
Halbkreis-Tacho und Verteilungs-Ring, runder Aktionsknopf), nicht die Farbe;
Smoobus gemessenes `#0F62FE` steht nirgends im Code. Was gemessen wurde und was
aus dem Screenshot geschätzt ist, trennt `docs/SMOOBU-UI-ANALYSE.md`.

**Das Eigentümer-Erlebnis in `mobile-nextdays` bleibt unangetastet.** Es wird
nicht gelöscht und nicht stillgelegt — dafür gibt es keinen Auftrag, und ein
Eigentümer, der die PMS-App schon installiert hat, verliert nichts. Die
Ablösung ist eine eigene Entscheidung zu einem eigenen Zeitpunkt.

> **Abgelöst am 09.09.2026** — siehe „Nachtrag: Ausbau aus `mobile-nextdays`"
> am Ende dieses Dokuments. Die oben angekündigte eigene Entscheidung ist
> gefallen; das Eigentümer-Erlebnis liegt jetzt ausschließlich in
> `mobile-owner`.

**Die App wurde von Grund auf neu gebaut** (Auswahl des Auftraggebers), nicht
aus den sieben Screens kopiert. Übernommen wurde nur, was geprüft ist und nicht
neu erfunden werden darf: die Datenschicht (`lib/ownerPortal.ts`), Auth
(`lib/api.ts`, `lib/auth.ts`, `contexts/AuthContext.tsx`), der zweistufige
2FA-Flow und die elf CI-geprüften Schwesterdateien.

## Begründung

### Was für die dritte App spricht

- **Der Store-Auftritt ist ein anderes Produkt.** Ein Eigentümer sucht keine
  „Property-Management-Software", er sucht die App, in der seine Abrechnung
  steht. Zwei Zielgruppen in einem Store-Eintrag heißt: eine Beschreibung, die
  für beide halb passt.
- **Die Berechtigungen unterscheiden sich real.** Diese App nimmt keine Fotos
  auf und lädt keine Dateien hoch. Sie deklariert deshalb weder `CAMERA` noch
  `NSCameraUsageDescription` und trägt den Dateiwähler nicht als natives Modul
  — in einer gemeinsamen App müsste sie beides mitschleppen und in der
  Play-Data-Safety-Angabe eine Nutzung behaupten, die für den Eigentümer nicht
  stattfindet.
- **Das Erlebnis ist ein anderes, nicht eine Teilmenge.** Die Vorlage stellt
  Kennzahlen in den Mittelpunkt; die PMS-App stellt den Arbeitsvorrat in den
  Mittelpunkt. Das ist ein anderer erster Screen, eine andere Tab-Leiste und
  eine andere Informationsdichte.

### Was dagegen sprach — und wie es beantwortet ist

- **Wartungskosten (der eigentliche Einwand).** Drei RN-Projekte heißen drei
  Upgrades, drei Podfiles, drei `node_modules`. Antwort: derselbe Mechanismus
  wie bei ADR-0019 Stufe 1 — geteilter Code liegt als bewusste **Kopie** mit
  `SCHWESTERDATEI`-Kopf vor, und der CI-Job `mobile-konsistenz` vergleicht ihn
  jetzt **dreifach gegen `mobile-bestdays` als Referenz**. Paarweise wäre die
  dritte App unbemerkt gedriftet, solange sich die ersten zwei decken.
- **Ein dritter Store-Eintrag und ein dritter Keystore.** Bleibt als echter
  Preis. `com.mynextdays.app` liegt seit dem 31.08.2026 in der Play-Prüfung;
  dieser Eintrag kommt daneben.
- **Die Rollen-Logik gibt es doppelt.** In `mobile-nextdays` entscheidet
  `experienceFor` unter drei Erlebnissen; hier gibt es nur eines, und eine
  fremde Rolle bekommt einen erklärenden Screen samt Weg in die richtige App
  (`screens/FalscheRolle.tsx`) — fail-closed, aber nicht als stiller Logout,
  der von einem falschen Passwort nicht zu unterscheiden wäre.

## Folgen

**Sofort wirksam:**
- `scripts/ci/bereiche.txt`: Bereich `mobile-owner`, und `mobile-konsistenz`
  triggert zusätzlich auf `mobile-owner/`.
- `.github/workflows/ci.yml`: Test-Matrix, `betroffen`-Outputs, Drei-Wege-Diff
  der Schwesterdateien, Drei-Wege-Abgleich der Kernversionen.
- `scripts/mobile/ausstattung-labels-sync.mjs`: generiert `lib/ausstattung.ts`
  jetzt in drei Apps.
- `scripts/realtime/abos-pruefen.sh`: prüft die Abos der dritten App mit
  (`availability`, `reservations` — beide gegen die Live-DB verifiziert).

## Veröffentlichungs-Reihenfolge (Stand 03.09.2026)

Die drei Apps gehen NACHEINANDER in die Stores, nicht zusammen:

1. **myNextDays** (`com.mynextdays.app`) — seit 31.08.2026 bei Google Play in
   Prüfung. Das Play-Konto ist mit dem Firebase-Projekt verbunden.
2. **myNextDays Eigentümer** (`com.mynextdays.owner`) — als nächstes.
3. **myBestDays** (`com.mybestdays.app`) — danach.

Warum die Reihenfolge zählt und nicht nur eine Terminfrage ist: die erste App
eines Kontos durchläuft bei Google die volle Konto- und DSA-Prüfung, die
folgenden erben sie. Ein Fund an App 1 (Data-Safety-Abweichung, fehlende
Händler-Verifizierung) betrifft daher alle drei — er wird an App 1 behoben,
bevor App 2 eingereicht wird, sonst wird derselbe Mangel dreimal abgelehnt.
Die Store-Angaben je App stehen in `docs/APP-STORE-ANGABEN.md`; sie sind pro
App vollständig zu füllen und NIE voneinander abzuleiten (Apple prüft das
Privacy Label gegen das Manifest im jeweiligen Binary).

**Offen, bevor die App in einen Store kann:**
- **Push-Kennung `mynextdaysowner` (03.09.2026 gebaut).** Die App meldete
  sich zunächst als `mynextdays` an — die Kennung der Verwaltungs-App. Ein
  Eigentümer hätte damit `betrieb_buchung` und `messages` bekommen (Meldungen
  für die Verwaltung) und seine eigenen nie. Ein Push erreicht ein GERÄT, nicht
  ein Konto; dieselbe Person kann beide Apps installiert haben.
  Die Kette reicht weiter, als sie aussieht — fünf Stellen plus zwei
  Kategorien-Entscheidungen:
  `lib/push.ts` (Kennung) · `schemas.py` (`Literal`) · `geraete.py` (`_APPS`) ·
  Migration 0532 (`check` + drei `*_push`-Spalten, live) ·
  `dispatcher.py` (`_sende_push` hatte `app="mynextdays"` HART verdrahtet —
  selbst mit korrekter Kennung hätte der Eigentümer nichts bekommen).
  Neu ist das Katalog-Feld `Kategorie.push_app`: die Zuständigkeit steht dort,
  wo die Kategorie definiert wird, nicht im Versandpfad. Aus dem Schlüsselnamen
  ableiten wäre falsch gewesen — `block_decision` geht an den Eigentümer und
  trägt kein `owner_`-Präfix.
  `owner_booking`, `owner_service` und `block_decision` haben seither
  überhaupt erst einen PUSH-Kanal; vorher gab es für den Eigentümer nichts zu
  senden.
- Firebase: je eine App für `com.mynextdays.owner` (Android + iOS) im
  bestehenden Projekt anlegen. Die Verbindung Play-Konto ↔ Firebase-Projekt
  steht seit dem 03.09.2026 — das ist die PROJEKT-Ebene und ersetzt diesen
  Punkt nicht: eine App-Registrierung je `applicationId` bleibt nötig, sonst
  findet das Plugin keinen passenden Client; die kopierte `google-services.json` galt für
  `com.mynextdays.app` und wurde entfernt, damit der Build laut scheitert statt
  Push still ins Nichts zu liefern
  (`android/app/GOOGLE-SERVICES-FEHLT.md`).
- Release-Keystore und die `MYNEXTDAYSOWNER_RELEASE_*`-Secrets.
- **Auslieferung gebaut (03.09.2026).**
  `.github/workflows/mobile-release-owner.yml` als EIGENE Datei — kein
  gemeinsamer Workflow mit `inputs.app`, weil eine Verwechslung dort die App
  mit dem falschen Schlüssel signieren oder an fremde Tester verteilen würde,
  und Android die App-Identität an den Signaturschlüssel bindet.
  Eigene Tester-Gruppe `beta-tester-owner`: ein Eigentümer ist kein
  Mitarbeiter des Betriebs.
  Neu gegenüber den Schwester-Workflows ist ein **Paketnamen-Beweis**
  (`aapt2 dump packagename`): `com.mynextdays.owner` und `com.mynextdays.app`
  unterscheiden sich um ein Wort, und ein falsch gebautes Artefakt bei den
  Eigentümer-Testern wäre von außen nicht zu sehen.
  Die Firebase-App-ID steht als Secret, nicht im Text — sie entsteht erst beim
  Anlegen der App, und eine geratene ID verteilte an eine fremde App.
  Miterweitert: `scripts/mobile/keystore-erzeugen.sh` (dritter Präfix
  `MYNEXTDAYSOWNER`) und `scripts/mobile/beta-tester-verwalten.sh` (App als
  Pflichtargument, kein Default mehr auf die PMS-Gruppe).
- **Wächter `scripts/mobile/release-kette-pruefen.sh`** (in `ci.yml`, läuft
  immer). Er schließt die Lücke, durch die diese App einen Tag lang gefallen
  ist: `ci.yml` prüfte ihren CODE vollständig, die AUSLIEFERUNG prüfte
  niemand — eine neue App fällt dabei nicht auf, sie ist einfach nie
  ausgeliefert worden. Geprüft wird je App: Release-Workflow vorhanden, eigene
  Tester-Gruppe (und keine fremde), Keystore-Präfix passend zu `build.gradle`,
  `google-services.json` im Workflow bei Firebase-Nutzung, Signatur-Beweis.
  Eine vierte App ohne Eintrag lässt ihn fehlschlagen.
- App-Icon und Splash tragen derzeit die myNextDays-Assets. Das ist innerhalb
  der Marke richtig, unterscheidet die App im Launcher aber nicht von der
  PMS-App — eine eigene Icon-Variante ist eine Design-Entscheidung, keine
  technische.
- `ios/Pods` ist nicht installiert (`pod install` läuft auf dem Mac des
  Entwicklers, nicht hier).

## Nachtrag: Ausbau aus `mobile-nextdays` (09.09.2026)

Anlass: Auftrag vom 09.09.2026, vor dem Deploy der Eigentümer-App alles
Eigentümer-Bezogene aus `mobile-nextdays` auszubauen. Damit endet die oben
festgehaltene Doppelung — das Erlebnis lag seit dem 02.09.2026 in beiden Apps,
und zwei Fassungen desselben Portals driften, sobald eine davon gepflegt wird.

**Entfernt** (`mobile-nextdays`): die sieben Screens (`OwnerProperties`,
`OwnerCalendar`, `OwnerEarnings`, `OwnerStatistics`, `OwnerRequests`,
`OwnerPropertyDetail`, `OwnerPhotoAlbum`), der Tab-Navigator
`navigation/OwnerTabs.tsx`, die Datenschicht `lib/ownerPortal.ts`, das
Flächen-Gating `lib/owner-flaechen.ts` und die beiden zugehörigen Testdateien.
Aus `navigation/types.ts` fällt `OwnerTabParamList` samt der beiden
Root-Einträge; die Deep-Links `eigentuemer/objekte` und
`eigentuemer/auszahlungen` gibt es nicht mehr.

**Geblieben ist genau ein Screen**, `screens/OwnerAppHinweis.tsx`. Ein Konto
der Rolle `owner` kann sich weiterhin anmelden — der Zugang ist gültig, nur das
Erlebnis liegt woanders — und bekommt die Erklärung plus den Absprung nach
`mynextdaysowner://`. Der naheliegendere Weg, `owner` einfach aus `BY_ROLE`
(`lib/experience.ts`) zu streichen, wurde VERWORFEN: `experienceFor` gäbe dann
`null`, und der bestehende fail-closed-Pfad loggt wortlos aus — für den Nutzer
nicht von „Passwort falsch" zu unterscheiden. Ein stummer Rauswurf ist derselbe
Fehler wie ein verschluckter Exception (Wurzel 5).

Das Gegenstück in der anderen Richtung existierte bereits:
`mobile-owner/screens/FalscheRolle.tsx` fängt ein Verwaltungs-Konto ab, das die
Eigentümer-App öffnet. Beide Apps halten damit keinen Fremdzustand mehr stumm.

Mitgezogen, weil `canOpenURL` sonst IMMER `false` liefert und der Verweis auch
bei installierter App in den Store liefe: `mynextdaysowner` steht jetzt in
`mobile-nextdays/ios/MyNextDays/Info.plist`
(`LSApplicationQueriesSchemes`) und in dessen `AndroidManifest.xml`
(`<queries>`).

Die Zieladresse der Eigentümer-App steht im Screen und NICHT in
`theme/marke.ts`: `marke.andereApp` zeigt auf myBestDays, und `theme/tokens.ts`
— wo der Typ `Marke` liegt — hält die CI über alle drei Apps byte-identisch;
ein zweites Feld dort änderte den Typ in `mobile-bestdays` und `mobile-owner`
mit. Die Eigentümer-App ist zudem keine eigene Marke (siehe oben), also kein
Markenwert.

Nicht berührt: `is_owner_stay` (Eigennutzung in Buchungen), die Rollen-Bezeichnung
„Eigentümer" in `screens/HostProfile.tsx` und die `pm_owner_*`-Einträge in
`lib/rechte-texte.ts`. Das sind Betriebs-Sichten AUF den Eigentümer, kein
Eigentümer-Erlebnis — sie gehören der Agentur und bleiben.
