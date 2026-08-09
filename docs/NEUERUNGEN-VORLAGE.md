# Textvorlage für die Ankündigung „Neuerungen"

Diese Datei ist eine **Vorlage zum Abschreiben**, keine Ankündigung. Nichts
davon ist im System eingetragen. Du pflegst den Text nach dem Deploy selbst
unter **Backoffice → Ankündigungen → Neue Ankündigung** ein.

Stellen, die du selbst ergänzen oder entscheiden musst, sind mit `[[…]]`
markiert. Bitte **alle** durchgehen, bevor du veröffentlichst.

---

## Vorab: was du über das Zielformat wissen musst

Diese fünf Punkte ändern den Text, deshalb stehen sie vor der Vorlage.

**1. Wer die Ankündigung überhaupt sieht: nur Admin und Co-Admin.**
Sowohl das Popup als auch die Seite „Neuerungen" sind auf diese beiden Rollen
begrenzt. Mitarbeiter, Reinigungskräfte und Eigentümer sehen weder das eine
noch das andere — der Menüpunkt fehlt bei ihnen, die Seite antwortet mit
„nicht gefunden". Der Text ist deshalb an die **Entscheider** des Betriebs
gerichtet. Wo Mitarbeiter oder Eigentümer etwas tun müssen, muss dastehen,
dass der Betrieb sie informiert — sie lesen es hier nicht mit.

**2. Der Inhalt wird NICHT übersetzt.** Die Oberfläche drumherum ist in 24
Sprachen, dein Text nicht. Er steht bei jedem Betrieb genau so, wie du ihn
schreibst. Deshalb: kurze Sätze, keine Redewendungen. `[[Entscheide, ob du
zusätzlich eine englische Fassung veröffentlichst — dann als zweite
Ankündigung.]]`

**3. Die Felder und ihre Grenzen** (technisch erzwungen, längerer Text wird
abgelehnt):

| Feld | Grenze | Bedeutung |
|---|---|---|
| Titel | max. 200 Zeichen | Überschrift in Popup und Liste |
| Kurztext | max. 300 Zeichen | Eine Zeile unter dem Titel, in Popup **und** Listenkarte |
| Inhalt | keine harte Grenze | Formatierter Text (Fett, Listen, Überschriften, Links, Bilder) |
| Kategorie | Auswahl | Neuerung · Wartung · Hinweis · Wichtig |
| Popup nur bis | Datum, optional | Begrenzt **nur** das Popup, nicht die Liste |
| Als Popup zeigen | Haken | Ohne Haken erscheint sie nur auf „Neuerungen" |

**4. Popup und Seite sind dasselbe Objekt.** Es gibt **kein** getrenntes
Kurz- und Langfeld: Titel, Kurztext und Inhalt erscheinen an beiden Orten. Die
zwei Fassungen unten sind deshalb **zwei getrennte Ankündigungen**:

- **Ankündigung A** (Popup-Fassung) — Haken „Als Popup zeigen" **an**, kurzer
  Inhalt, verweist auf die Seite „Neuerungen".
- **Ankündigung B** (die ausführliche) — Haken „Als Popup zeigen" **aus**,
  erscheint nur in der Liste.

Reihenfolge beim Anlegen: **erst B veröffentlichen, dann A.** Sonst klickt
jemand aus dem Popup auf „Neuerungen" und findet dort nichts.

**5. Screenshots** lassen sich erst einfügen, **nachdem** der Entwurf einmal
gespeichert ist (PNG oder WebP). Der Knopf dafür fehlt vorher.

Weiter gilt: Bilder werden nicht verkleinert (max. 10 MB je Bild), und die
Ankündigung erscheint **beim nächsten Login**, nicht sofort bei einer offenen
Sitzung.

---

# Ankündigung A — Popup-Fassung

> Haken „Als Popup zeigen": **an**. Kategorie: **Wichtig** (wegen der
> Zwei-Faktor-Pflicht). „Popup nur bis": `[[leer lassen, oder ein Datum ca. 4
> Wochen nach Veröffentlichung]]`.

### Titel
```
Neu: Eigentümer-Portal, E-Mails in 24 Sprachen und Zwei-Faktor-Anmeldung
```

### Kurztext
```
Ein Überblick über das größte Update seit dem Start — und eine Sache, um die du dich kümmern musst.
```

### Inhalt

```
Wir haben in den letzten Wochen viel gebaut. Das Wichtigste in Kürze:

Deine Eigentümer haben jetzt einen eigenen Zugang: Belegungskalender mit
Auszahlung pro Nacht, Sperrungen beantragen, Zählerstände melden,
Dienstleistungen beauftragen und Abrechnungen als PDF.

Einladungen und „Passwort vergessen" laufen ab sofort per E-Mail. Du musst
keine Passwörter mehr abschreiben und weitergeben. Alle E-Mails gehen in der
Sprache des Empfängers raus — in allen 24 EU-Amtssprachen.

Bitte einmal selbst aktiv werden: Für Admin- und Co-Admin-Zugänge ist ein
zweiter Anmeldefaktor künftig Pflicht. Du hast dafür ab jetzt 14 Tage Zeit.
Danach ist die Anmeldung ohne zweiten Faktor nicht mehr möglich. Einrichten
unter Konto → Sicherheit; das dauert zwei Minuten.

Alle Neuerungen im Detail findest du unter Werkzeuge → Neuerungen.
```

> **Zur Frist:** Die 14 Tage laufen **je Zugang** ab dessen erster Anmeldung
> nach dem Update — es gibt bewusst keinen gemeinsamen Stichtag im System.
> Deshalb steht oben „ab jetzt 14 Tage" und **kein** festes Datum. Jeder
> Betroffene sieht sein persönliches Datum im Hinweisbanner im Dashboard.
> `[[Wenn du lieber ein festes Datum nennen willst, müsste das vorher im
> System umgestellt werden — Stand jetzt wäre ein genanntes Datum falsch.]]`

---

# Ankündigung B — Seite „Neuerungen" (ausführlich)

> Haken „Als Popup zeigen": **aus**. Kategorie: **Neuerung**.
> Zuerst veröffentlichen, dann Ankündigung A.

### Titel
```
Das große Update: Eigentümer-Portal, E-Mail-Versand und mehr Sicherheit
```

### Kurztext
```
Eigentümer-Portal, Einladungen per E-Mail in 24 Sprachen, Zwei-Faktor-Anmeldung und eine Reihe korrigierter Anzeigen.
```

### Inhalt

`[[Screenshots einfügen, nachdem der Entwurf einmal gespeichert ist —
sinnvoll wären: Eigentümer-Portal Belegungskalender, Warteschlange
Sperranträge, Konto → Sicherheit.]]`

```
Das Update bringt einen komplett neuen Bereich für deine Eigentümer, den
E-Mail-Versand, den es vorher gar nicht gab, und eine deutlich sicherere
Anmeldung. Dazu haben wir mehrere Anzeigefehler behoben, die zu falschen
Beträgen führen konnten.


## Ein eigener Zugang für deine Eigentümer

Eigentümer haben ab sofort einen eigenen, abgetrennten Bereich. Sie melden
sich normal an und landen direkt dort — deine Verwaltungsoberfläche sehen sie
nicht, und sie sehen ausschließlich ihre eigenen Objekte.

Was der Eigentümer dort tun kann:

• Belegungskalender: welche Nächte belegt, frei oder gesperrt sind, eingefärbt
  nach deinen Saisons. Pro Nacht steht seine Netto-Auszahlung — nicht der
  Gastpreis. Vom Gast sieht er nur den Vornamen.
• Sperrungen beantragen: Zeitraum und Grund angeben, du entscheidest.
• Zählerstände melden: Strom, Wasser und Gas mit Ablesedatum. Einträge werden
  nicht überschrieben; eine Korrektur ist ein neuer Eintrag.
• Dienstleistungen beauftragen: Endreinigung, Hauptreinigung,
  Fensterreinigung, Rasenmähen, Terrassenreinigung — oder als Freitext, wenn
  nichts davon passt. Der Eigentümer sieht weder den Preis noch, wer den
  Auftrag ausführt.
• Berichte: Einnahmen für Monat oder Jahr, dazu abgeschlossene Abrechnungen
  als PDF.
• Benachrichtigungen: Der Eigentümer stellt selbst ein, worüber er per E-Mail
  oder SMS informiert wird.

Zugang einrichten unter: Eigentümer → Eigentümer anlegen (oder bei einem
bestehenden Eigentümer den Portalzugang aktivieren). Der Eigentümer bekommt
eine Einladungs-E-Mail und vergibt sein Passwort selbst.


## Sperranträge entscheiden

Beantragt ein Eigentümer eine Sperrung, landet sie in einer Warteschlange
unter Reservierungen → Sperranträge. Du kannst genehmigen, ablehnen und eine
Genehmigung später widerrufen; eine Anmerkung dazu sieht der Eigentümer. Über
jeden neuen Antrag informieren wir dich automatisch.

Eine Genehmigung sperrt die Nächte wirklich — im Kalender und auf allen
Portalen. Ein Widerruf gibt genau diese Nächte wieder frei und lässt andere
Sperren im selben Zeitraum unangetastet. Über jede Entscheidung wird der
Eigentümer automatisch per E-Mail informiert.

Hinweis: Ein einmal gestellter Antrag kann vom Eigentümer nicht selbst
zurückgezogen werden. Meldet er sich mit einer Änderung, lehnst du den Antrag
ab; er stellt einen neuen.


## Einladungen und Passwörter laufen jetzt per E-Mail

Bisher gab es keinen E-Mail-Versand: Ein neuer Zugang bedeutete, ein Passwort
abzuschreiben und weiterzugeben, und „Passwort vergessen" gab es nicht.

Ab sofort bekommt jeder neue Nutzer und jeder Eigentümer eine Einladung per
E-Mail und vergibt sein Passwort selbst — du siehst es nie. Der
Einladungslink gilt 7 Tage.

Auf der Anmeldeseite gibt es jetzt „Passwort vergessen". Der Link aus dieser
E-Mail gilt aus Sicherheitsgründen 1 Stunde.

Die Anmelde- und Einladungsseiten gibt es in allen 24 EU-Amtssprachen.


## E-Mails in der Sprache des Empfängers

Alle E-Mails haben ein neues Layout mit Logo und den gesetzlich
vorgeschriebenen Anbieterangaben — und sie gehen in der Sprache des
Empfängers raus, in allen 24 EU-Amtssprachen.

Die Sprache legst du direkt beim Anlegen fest: bei Nutzern unter Konto →
Nutzer, bei Eigentümern unter Eigentümer. Nachträglich änderbar. Ist nichts
hinterlegt, gilt die Standardsprache deines Betriebs (Konto → Sonstiges),
sonst Englisch.


## Zwei-Faktor-Anmeldung — für Admin und Co-Admin Pflicht

Die Anmeldung lässt sich jetzt mit einem zweiten Faktor absichern, unter
Konto → Sicherheit:

• Passkey (Fingerabdruck, Gesichtserkennung oder Hardware-Schlüssel) — der
  sicherste Weg, weil er sich nicht abphishen lässt. Empfohlen.
• Authenticator-App: ein Sechsstelliger Code, der alle 30 Sekunden wechselt.
• Wiederherstellungscodes: 10 Einmal-Codes für den Fall, dass das Gerät weg
  ist. Sie werden genau einmal angezeigt — bitte sicher aufbewahren.

Für Admin- und Co-Admin-Zugänge ist ein zweiter Faktor Pflicht. Ab der ersten
Anmeldung nach diesem Update hast du 14 Tage Zeit, ihn einzurichten. In dieser
Zeit erscheint im Dashboard ein Hinweis mit deinem persönlichen Datum. Danach
ist nur noch die Einrichtung selbst erreichbar, bis der Faktor steht.

Wir empfehlen, mindestens zwei Faktoren einzurichten (zum Beispiel Passkey und
Authenticator-App) oder die Wiederherstellungscodes zu sichern. Sperrst du
dich aus, kann nur der myNextDays-Support den Zugang zurücksetzen.

Wichtig für dich als Betrieb: Mitarbeiter und Eigentümer lesen diese Mitteilung
nicht — sie sehen die Seite „Neuerungen" nicht. Wenn du weitere Admin- oder
Co-Admin-Zugänge in deinem Team hast, gib den Hinweis bitte weiter.


## Eigentümer schneller anlegen

Beim Anlegen eines Eigentümers lassen sich seine Objekte jetzt direkt
mitauswählen — mehrere auf einmal. Der Umweg über die Objektverwaltung
entfällt.

Außerdem lässt sich ein Eigentümer in der Übersicht löschen. Objekte und deren
Buchungen bleiben erhalten und stehen anschließend ohne Eigentümer da. Bitte
mit Bedacht: Die Abrechnungen dieses Eigentümers werden mitgelöscht und lassen
sich nicht wiederherstellen.


## Korrigierte Anzeigen und Berechnungen

Diese Fehler konnten zu falschen Zahlen führen. Wenn dir eine der Angaben in
der Vergangenheit seltsam vorkam, ist das die Erklärung:

• Die Einnahmen-Übersicht des Eigentümers wies zu hohe Beträge aus: Die
  Verwaltungsprovision war nicht abgezogen und Zusatzleistungen fehlten. Sie
  rechnet jetzt wie die Abrechnung.
• Bei Objekten mit mehreren gleichen Einheiten wurde für gleichzeitig belegte
  Nächte nur eine Auszahlung gezeigt statt aller.
• Fehlte auf einer Abrechnung die Währung, erschien sie als Euro. Jetzt zählt
  ausschließlich die hinterlegte Währung.
• Fehlende Beträge wurden als „0,00" angezeigt und damit als „nichts
  eingenommen" gelesen. Jetzt steht dort „—".
• Buchungen von Booking.com konnten als „Anderes Portal" mit grauem Balken im
  Belegungsplan erscheinen, obwohl daneben „Booking.com" stand. Portalnamen
  stehen jetzt einheitlich als Markenname (zum Beispiel „Booking.com" statt
  „BookingCom"), und die Suche findet beide Schreibweisen.
• Beim Widerruf einer Sperrung konnten andere Sperren im selben Zeitraum —
  etwa wegen Handwerkern — mit aufgehoben werden. Das Objekt war dann bei den
  Portalen wieder buchbar, ohne dass es jemand bemerkte.
• „Saison übertragen" konnte am Zielobjekt bereits gepflegte Zeiträume löschen
  und meldete trotzdem Erfolg. Außerdem hätte ein Objekt mit Basispreis 0,00
  Nächte zum Preis 0,00 an die Portale senden können; das wird jetzt
  abgelehnt.
• Eigentümer mit jährlicher Abrechnung hätten monatlich einen Beleg bekommen.

Zusätzlich haben wir den Zugriffsschutz auf Gast-, Finanz- und Eigentümerdaten
verschärft. Für dich ändert sich dadurch nichts an der Bedienung.


## Diese Seite

Unter Werkzeuge → Neuerungen findest du künftig alle Produkt-Updates. Wichtige
Mitteilungen zeigen wir zusätzlich einmalig beim Anmelden.
```

---

## Checkliste vor dem Veröffentlichen

- [ ] Alle `[[…]]`-Stellen bearbeitet oder bewusst gestrichen
- [ ] Ankündigung **B** angelegt, gespeichert, Screenshots eingefügt, **veröffentlicht**
- [ ] Ankündigung **A** angelegt, Haken „Als Popup zeigen" gesetzt, **veröffentlicht**
- [ ] Bei A geprüft: Kategorie „Wichtig", Verweis auf „Werkzeuge → Neuerungen"
- [ ] Vorschau im Backoffice gelesen — sie zeigt den gespeicherten Stand.
      Fehlt dort ein eingefügtes Bild, wurde es verworfen und muss über den
      Bild-Knopf des Editors neu hochgeladen werden.
- [ ] Selbst einmal ab- und wieder angemeldet und das Popup gesehen
- [ ] Nur wenn im System ein fester Stichtag statt der 14-Tage-Frist
      eingerichtet wurde: Datum im Text ergänzt
