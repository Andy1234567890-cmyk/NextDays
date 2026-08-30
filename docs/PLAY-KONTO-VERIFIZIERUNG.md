# Play-Entwicklerkonto anlegen — die Verifizierungsfragen

Vorgelagert zu `docs/PLAY-STORE-LISTING.md` (Texte des Store-Eintrags) und
`docs/APP-STORE-ANGABEN.md` (Data Safety, Review-Notes). **Hier steht der Schritt
davor:** das Entwicklerkonto selbst. Ohne dieses Konto gibt es keine App-Hülle,
in die der Store-Eintrag hineinkann.

**Das Konto steht** (30.08.2026):

| | |
|---|---|
| Name des Entwicklers | MyNextDays.ApS |
| Kontotyp | Organisation |
| Entwicklerkonto-ID | 5543610186292775583 |
| Kontoinhaber | `jeanine@mynextdays.dk` (Andy Staudinger) |
| Organisation | Mynextdays ApS, Hirtshalsvej 21, 9881 Bindslev, Dänemark |
| Kontakt-E-Mail | `developer@mynextdays.dk` ✅ bestätigt |
| Website | `https://mynextdays.com/` ✅ bestätigt |

---

## Wo „Kontodetails" steckt

Googles Hilfetext sagt „Gehe zur Seite ‚Kontodetails'" — im Menü gibt es diesen
Punkt aber nicht. Der Weg ist:

**Entwicklerkonto** (linkes Menü) → Abschnitt **Kontaktdaten** → Pfeil `→` rechts
in der Abschnittszeile. Erst die dann geöffnete Seite heißt „Kontodetails".

Direkt:
`play.google.com/console/u/1/developers/5543610186292775583/account/developer-details?tab=contactDetails`

Der Knopf **„Zu den Kontodetails"** auf der Seite „Telefonnummern bestätigen"
führt ebenfalls dorthin, ist aber **ausgegraut**, solange die Identitätsprüfung
läuft — auch das ein Grund, warum die Seite unauffindbar wirkt.

---

## Warum die Telefonbestätigung gerade nicht geht

Beide Nummern sind eingetragen (Kontakt- und Entwicklertelefonnummer, dieselbe
Nummer), beide **ohne** grünen Haken. Einen „Bestätigen"-Knopf gibt es nicht;
stattdessen steht dort:

> Zum Bestätigen dieser Telefonnummer zuerst andere Bestätigungsschritte
> abschließen. […] Dazu gehört die Überprüfung deiner Identität und die
> Genehmigung deiner Ausweisdokumente durch Google.

Auf der Startseite steht dazu: **„Google überprüft deine Identität — Die
Dokumente wurden hochgeladen. […] Das kann einige Tage dauern."**

Es ist also nichts falsch gemacht und nichts nachzureichen. Es wartet auf Google.
Dasselbe Tor sperrt auch „Identitätsbestätigung für Android-Entwickler" (dort:
„Bevor du Paketnamen registrieren kannst, musst du die ausstehenden
Bestätigungen auf der Startseite abschließen").

### Es sind ZWEI Prüfungen, nicht eine

Das ist der Punkt, der beim Warten verwirrt: Google prüft an zwei getrennten
Stellen, und beide müssen durch sein.

| Prüfung | Wo sichtbar | Stand 30.08.2026, 21:00 |
|---|---|---|
| Play-Entwicklerkonto (Organisation + Identität) | Play Console → Startseite | „Die Dokumente wurden hochgeladen […] kann einige Tage dauern" |
| Google Payments (Zahlungsprofil **2322-4985-0463**) | `payments.google.com` → Glocke „1 wichtige Benachrichtigung" | „Identität bestätigen — Deine Identität wird überprüft. Dieser Vorgang kann einige Tage dauern." |

Die Payments-Prüfung meldet sich per Mail als **„Du musst deine Identität
bestätigen"** (amtlicher Lichtbildausweis). Diese Mail ist eine
Aufforderung, keine Bestätigung — und die Mail **„Google: Vielen Dank"** ist
nur die Quittung über die 25 $ Registrierungsgebühr, nicht die Freigabe.
Verwechselt man die beiden, hält man die Prüfung für erledigt.

Im Zahlungscenter steht neben „Identität bestätigen" **kein Knopf** mehr, wenn
die Unterlagen eingegangen sind — nur der Prüfhinweis. Genau daran erkennt man,
dass nichts nachzureichen ist.

**Wenn die Prüfung durch ist:** Kontodetails öffnen → bei beiden Nummern
„Bestätigen" → Code per SMS **oder Anruf** anfordern → eintragen. Beide Nummern
einzeln. Googles eigener Tipp: klemmt die eine Methode, die andere nehmen.

### Ein Punkt, der später Arbeit spart

Die Kontodetails-Seite meldet:

> Die eingegebene E-Mail-Adresse stimmt nicht mit der Domain der Website deiner
> Organisation überein. Wenn du eine E-Mail-Adresse mit derselben Domain wie die
> Website deiner Organisation verwendest, musst du weniger Bestätigungsschritte
> durchführen.

Grund: Kontakt-E-Mail `developer@mynextdays.**dk**`, Website
`mynextdays.**com**`. Beides ist für sich richtig (`.com` ist die Hauptdomäne,
`.dk` die Mail-Domäne), Google sieht darin aber zwei verschiedene Organisationen
und verlangt deshalb mehr Nachweise. Wer das glätten will, trägt entweder
`https://mynextdays.dk` als Website ein oder eine `@mynextdays.com`-Adresse als
Kontakt. **Nicht jetzt ändern** — mitten in einer laufenden Prüfung die geprüften
Angaben zu verschieben, startet sie im Zweifel neu.

---

## Warum diese Fragen ernst zu nehmen sind

Google gleicht die Antworten gegen das ab, was es über die beteiligten Konten
ohnehin weiß. Ein Widerspruch zwischen Angabe und Kontohistorie ist einer der
häufigsten Gründe für eine Sperre — nicht die unbequeme Wahrheit, sondern das
bequeme „Nein". Deshalb steht unten nur, was belegbar ist; jede Lücke ist als
Lücke gekennzeichnet und nicht mit einer plausiblen Vermutung gefüllt.

---

> Die beiden folgenden Abschnitte gehören zum **Anlegen** des Kontos und sind
> erledigt. Sie bleiben stehen, weil Google im Verlauf der Prüfung nachfragen
> kann und die Antworten dann widerspruchsfrei bleiben müssen.

## Frage 1 — „Deine Nutzung der Play Console und von Android"

Freitext, max. 5000 Zeichen, laut Formular nur für den Kontoinhaber sichtbar.

### Entwurf (belegbarer Teil)

```
Ich baue myNextDays, ein Verwaltungssystem (PMS) und Channel-Manager für
Ferienhäuser, Ferienwohnungen und Hotels, dazu den Marktplatz myBestDays.
Dazu gehören zwei eigenständige Android-Apps in React Native:
com.mynextdays.app für die Betriebe (Verwaltung, Kalender, Buchungen,
Aufgaben, Gästenachrichten) und com.mybestdays.app für Gäste.

com.mynextdays.app steht auf Version 1.0.0 und ist fertig gebaut. Die
Release-Builds entstehen in einem eigenen GitHub-Actions-Workflow, werden
mit einem Upload-Schlüssel signiert und bisher über Firebase App
Distribution an eine geschlossene Gruppe von Beta-Testern verteilt. Dieses
Entwicklerkonto lege ich an, um diese App erstmals im Play Store zu
veröffentlichen.

Website: https://www.mynextdays.com
```

### Woher jede Aussage stammt

| Aussage | Beleg im Repo |
|---|---|
| zwei getrennte Apps, eine je Marke | ADR-0019, `mobile-nextdays/` und `mobile-bestdays/` |
| Paketnamen | `android/app/build.gradle` → `applicationId "com.mynextdays.app"` |
| Version 1.0.0 | `mobile-nextdays/package.json`, Commit `90160b0b` |
| eigener Release-Workflow, signiert | `.github/workflows/mobile-release.yml` |
| Verteilung an Beta-Tester | ebenda, Schritt „An Beta-Tester verteilen", Gruppe `beta-tester` |

### Was noch fehlt — nur der Kontoinhaber weiß es

- [ ] Gab es **früher schon einmal** ein Play-Entwicklerkonto oder dort
      veröffentlichte Apps? Falls ja, gehört das in den Text. Google kennt die
      Historie der Konten; es wegzulassen ist der Widerspruch, den es zu
      vermeiden gilt.
- [ ] Seit wann Android-Entwicklung, in welchem Umfang?
- [ ] Mitgliedschaft als Teammitglied in einer **fremden** Play Console
      (Agentur, Arbeitgeber, Kunde)?

---

## Frage 2 — „Andere Google-Konten in den letzten 6 Monaten"

**Antwort: Ja.**

Nicht wegen einer alten Geschichte, sondern wegen heute: Am 30.08.2026 wurde in
diesem Chrome-Profil `play.google.com/console` nacheinander unter

- `a.staudinger32@gmail.com`
- `info@the-freelancer-marketing.de`

geöffnet — beide waren angemeldet, beide wurden durchprobiert, um zu klären, ob
eines von ihnen bereits ein Entwicklerkonto trägt. Beide landeten auf der
Anmeldeseite; ein Konto liegt dort also **nicht**. Ein Zugriff auf die Play
Console innerhalb der letzten 6 Monate war es trotzdem, und genau danach fragt
das Formular.

Ergänzen, falls zutreffend: weitere Konten, mit denen der Kontoinhaber selbst in
den letzten 6 Monaten in einer Play Console war — eigene wie fremde.

---

## Danach

Sobald das Konto steht und die Organisationsprüfung durch ist:

1. **DSA-Händlerstatus** verifizieren. Ohne ihn wird die App in der EU nicht
   ausgeliefert bzw. wieder entfernt — der Punkt mit dem längsten Vorlauf.
2. App anlegen, Store-Eintrag de-DE und en-US aus `docs/PLAY-STORE-LISTING.md`
   einsetzen.
3. Grafiken hochladen: Icon, Feature-Grafik und die sechs Telefon-Screenshots
   aus `docs/store-assets/`.
4. Data-Safety-Formular und Content-Rating-Fragebogen aus
   `docs/APP-STORE-ANGABEN.md`.
5. Demo-Zugang für den Prüfer eintragen (Konto steht in den Store-Angaben, das
   Passwort bewusst nicht im Repo).
6. AAB bauen: Workflow `Mobile Release (Android)`, `artefakt: aab`. Läuft nur
   auf Ansage, nicht automatisch bei einem Push.
