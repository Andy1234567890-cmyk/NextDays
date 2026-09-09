# Play-Store-Eintrag „myNextDays Eigentümer" — Texte zum Einfügen

Schwesterdokument zu `docs/PLAY-STORE-LISTING.md` (die PMS-App). Data Safety,
Content Rating und Review-Notes stehen in `docs/APP-STORE-ANGABEN.md`
Abschnitt 2; hier stehen nur die Felder des Store-Eintrags.

Jede Aussage ist am Code geprüft, nicht geschätzt: die Tabs aus
`mobile-owner/navigation/Tabs.tsx`, die Geldfelder aus
`mobile-owner/CLAUDE.md` („Nur EIN Geld"), die fünf schreibenden Aktionen aus
demselben Abschnitt, der Löschweg aus `mobile-owner/lib/konto.ts`.

**Der Unterschied zur PMS-App ist die ZIELGRUPPE, nicht der Ton.** Dort liest
ein Betrieb, hier ein Eigentümer, der sein Haus vermieten LÄSST. Er verwaltet
nicht, er sieht zu — und genau das muss der Text sagen, sonst lädt jemand die
falsche der beiden Apps.

Standardsprache **de-DE**, zweite Sprache **en-US** (dieselbe Festlegung wie
bei der PMS-App: zwei gepflegte Sprachen schlagen 24 maschinell gefüllte).

**Empfehlung für weitere Sprachen — begründet, nicht geraten:** `da-DK` und
`sv-SE` als dritte und vierte. Der Betrieb hinter der App sitzt in Dänemark
(`lib/rechtliches.ts`: myNextDays ApS, 9881 Bindslev), die Eigentümer der
Beta-Objekte sind dänisch, und die App trägt beide Sprachen bereits vollständig
(`mobile-owner/locales/da.ts`, `sv.ts` — 470 Schlüssel, keine deutschen Reste).
Ein Store-Eintrag in einer Sprache, die die App selbst nicht spricht, wäre
dagegen ein Versprechen ohne Deckung. Die übrigen 20 Sprachen der App erst,
wenn dort auch Kunden sind.

---

## de-DE

**App-Name** (max. 30 Zeichen — 21 genutzt)

```
myNextDays Eigentümer
```

**Kurzbeschreibung** (max. 80 Zeichen — 69 genutzt)

```
Belegung, Auszahlungen und Abrechnungen für Ihre vermieteten Objekte.
```

**Vollständige Beschreibung** (max. 4000 Zeichen)

```
myNextDays Eigentümer ist die App für Menschen, die ein Ferienhaus oder eine Ferienwohnung besitzen und sie von einer Agentur oder einem Gastgeber vermieten lassen. Sie zeigt Ihnen jederzeit, wie Ihr Objekt belegt ist, was dabei für Sie herauskommt und wann Sie es selbst nutzen können.

Die App gehört zum Verwaltungssystem myNextDays. Ihren Zugang bekommen Sie von dem Betrieb, der Ihr Objekt betreut — anmelden können Sie sich nur mit diesem Zugang.

WAS SIE SEHEN

• Startseite: Ihre Auszahlung im Zeitverlauf, Monat für Monat oder Tag für Tag, mit Vergleich zum Vorjahr. Darunter Ihre Objekte.
• Kalender: welche Nächte belegt sind, von wem, und was jede Nacht für Sie bringt.
• Abrechnungen: jede abgeschlossene Abrechnung als Beleg, Summen je Währung, zum Nachlesen und Teilen.
• Auslastung und Kanäle: wie voll Ihr Objekt war und über welche Buchungsportale die Gäste kamen.
• Fotoalbum und Objektdaten: wie Ihr Objekt bei den Portalen dargestellt wird.

WAS SIE TUN KÖNNEN

• Eigennutzung beantragen: Zeitraum wählen, Personenzahl und Wünsche angeben, absenden. Die Verwaltung entscheidet und sperrt die Nächte — Sie sperren nicht selbst.
• Zählerstände melden: Strom, Wasser, Gas, direkt vom Zählerkasten.
• Zugewiesene Aufgaben zurückmelden: Manche Eigentümer reinigen oder empfangen selbst. Was Ihnen zugewiesen wurde, sehen Sie hier und melden Anfang und Ende.
• Der Verwaltung schreiben: ein Gespräch je Objekt, mit Bildanhang, Ende-zu-Ende verschlüsselt.

ZU DEN ZAHLEN

Wo in dieser App Geld steht, ist es immer dieselbe Zahl: Ihre Netto-Auszahlung. Kein Gastpreis, kein Bruttoumsatz, kein Ertrag der Verwaltung. Kann ein Betrag nicht ausgewiesen werden, steht dort ein Strich — nie eine Null. Eine Null hieße „nichts verdient", ein Strich heißt „liegt uns nicht vor". Das ist ein Unterschied, und die App macht ihn.

ZUR VERSCHLÜSSELUNG DER NACHRICHTEN

Der Chat mit Ihrer Verwaltung wird auf Ihrem Gerät verschlüsselt und erst auf dem Gerät des Empfängers wieder geöffnet. Wir können ihn nicht mitlesen. Das hat einen Preis, den wir offen nennen: Es gibt keine Vorschau in der Übersicht, keinen Text in der Benachrichtigung, und Nachrichten, die älter sind als Ihr Gerät, bleiben verschlossen, bis Ihre Verwaltung den Verlauf freigibt. Der Sicherungscode beim Einrichten ist der einzige Weg, den Verlauf auf ein neues Gerät zu holen — schreiben Sie ihn auf.

WAS DIE APP NICHT TUT

• Kein Tracking, keine Werbung, keine Analyse- oder Werbe-SDKs.
• Kein Verkauf in der App. Sie zahlen hier nichts, und es gibt keinen Kauf-Link.
• Kein Standortzugriff, kein Zugriff auf Kontakte, keine Leseberechtigung für Ihre Fotomediathek. Die Kamera wird nur gefragt, wenn Sie im Chat ein Foto aufnehmen wollen.
• Kein Blick in fremde Objekte. Sie sehen ausschließlich, was Ihnen zugeordnet ist.

FÜR FAMILIEN

Ihre Verwaltung kann auf Ihren Wunsch weitere Familienmitglieder einladen — mit eigenem Zugang und in zwei Stufen: nur Kalender und Eigennutzung, oder zusätzlich die Zahlen. Damit muss niemand mehr Ihr Passwort kennen, und jeder Antrag hat einen Absender.

KONTO UND DATEN

Ihr Konto lässt sich in der App unter „Menü" ganz unten löschen. Dabei werden bereits zugesagte, noch bevorstehende Aufenthalte zurückgenommen und die Nächte freigegeben, und eingeladene Familienzugänge verlieren die Sicht auf Ihr Objekt. Ihre Abrechnungen und Ihre Bankverbindung bleiben beim Betrieb — sie gehören zum Vertrag, nicht zum Zugang. Rechnungen und Buchungsbelege bewahren wir auf, weil das Gesetz es verlangt. Ohne App geht die Löschung über https://mynextdays.com/konto-loeschen.

Datenschutzerklärung, Nutzungsbedingungen, Auftragsverarbeitung und Anbieterangaben sind in der App unter „Menü → Rechtliches" verlinkt; die Pflichtangaben stehen dort auch als Text und sind ohne Netz lesbar.
```

---

## en-US

**App-Name**

```
myNextDays Owner
```

**Kurzbeschreibung** (max. 80 Zeichen — 66 genutzt)

```
Occupancy, payouts and statements for the properties you rent out.
```

**Vollständige Beschreibung**

```
myNextDays Owner is the app for people who own a holiday home or apartment and have it rented out by an agency or a host. It shows you at any time how your property is booked, what it earns you, and when you can use it yourself.

The app belongs to the myNextDays management system. You receive your login from the business that looks after your property — that login is the only way in.

WHAT YOU SEE

• Home: your payout over time, month by month or day by day, with a comparison to last year. Below it, your properties.
• Calendar: which nights are booked, by whom, and what each night brings you.
• Statements: every closed statement as a record, totals per currency, to read and to share.
• Occupancy and channels: how full your property was and which booking portals the guests came from.
• Photo album and property data: how your property is presented on the portals.

WHAT YOU CAN DO

• Request your own stay: pick the dates, state the number of guests and any wishes, send it. Your property manager decides and blocks the nights — you do not block them yourself.
• Submit meter readings: electricity, water, gas, straight from the meter.
• Report back on assigned tasks: some owners clean or welcome guests themselves. What has been assigned to you appears here, and you report start and finish.
• Message your property manager: one conversation per property, with image attachments, end-to-end encrypted.

ABOUT THE NUMBERS

Wherever money appears in this app it is always the same figure: your net payout. Not the guest price, not gross revenue, not the manager's margin. Where an amount cannot be stated, you see a dash — never a zero. A zero would mean "earned nothing", a dash means "not available to us". That is a difference, and the app makes it.

ABOUT MESSAGE ENCRYPTION

Your conversation with your property manager is encrypted on your device and only opened again on the recipient's device. We cannot read it. That has a price, and we name it openly: no preview in the overview, no text in the notification, and messages older than your device stay locked until your manager releases the history. The recovery code shown during setup is the only way to move the history to a new device — write it down.

WHAT THE APP DOES NOT DO

• No tracking, no advertising, no analytics or ad SDKs.
• No selling inside the app. You pay nothing here, and there is no purchase link.
• No location access, no access to contacts, no read permission for your photo library. The camera is requested only when you want to take a photo in the chat.
• No view into other people's properties. You only see what is assigned to you.

FOR FAMILIES

At your request, your property manager can invite further family members — each with their own login, at one of two levels: calendar and own use only, or the figures as well. Nobody needs to know your password any more, and every request has a sender.

ACCOUNT AND DATA

Your account can be deleted in the app under "Menu", at the very bottom. Stays that were already approved and are still ahead are withdrawn and those nights become available again, and family logins you invited lose sight of your property. Your statements and bank details stay with the business — they belong to the contract, not to the login. Invoices and booking records are kept because the law requires it. Without the app, use https://mynextdays.com/konto-loeschen.

The privacy policy, terms of use, data processing agreement and provider details are linked in the app under "Menu → Legal"; the mandatory provider details are also shown there as text and readable without a network connection.
```

---

## Grafiken

| Element | Vorgabe Google | Datei |
|---|---|---|
| App-Symbol | 512 × 512, 32-Bit-PNG **mit** Alphakanal, ≤ 1 MB | `docs/store-assets/eigentuemer/play-icon-512.png` |
| Feature-Grafik | 1024 × 500, JPEG oder 24-Bit-PNG **ohne** Alpha | `docs/store-assets/eigentuemer/play-feature-1024x500.png` |
| Telefon-Screenshots | 2–8 Stück, PNG/JPEG ohne Alpha, Kante 320–3840 px, längere Seite höchstens doppelt so lang wie die kürzere; für die Empfehlungsformate mind. 4 Stück mit Mindestkante 1080 und 9:16 | `docs/store-assets/eigentuemer/screenshots/` |

Beide Grafiken erzeugt
`scripts/mobile/icon-eigentuemer-erzeugen.py` — sie sind KEIN Bildbearbeitungs-
ergebnis, sondern aus der Bildmarke gerechnet. Wer sie ändern will, ändert das
Skript.

**Warum das Symbol rot ist und das der PMS-App schwarz:** bis zum 09.09.2026
trugen beide Apps byte-identische Symbole (md5 `beae8ce4…` in allen fünf
Android-Dichten und allen neun iOS-Größen). Im Launcher waren sie nicht
auseinanderzuhalten, und im Play Store stehen sie nebeneinander. Unterschieden
wird jetzt über die FLÄCHE, weil man bei 48 px eine Kachelfarbe liest und kein
Detail: myNextDays `#0A0A0A`, Eigentümer `#B82028`. Die Bildmarke bleibt
dieselbe — es ist dieselbe Marke.

---

## Die sechs Telefon-Screenshots

Aufzunehmen im **iOS-Simulator**, nicht im Android-Emulator: der Simulator
teilt den Kernel mit macOS, der Android-Emulator virtualisiert eine ganze
ARM-Maschine und belegt auf diesem 8-GB-Rechner über 3 GB (CLAUDE.md). Für Play
ist das Betriebssystem der Aufnahme egal — verlangt sind Bilder DER APP.

Vorführdaten: **Alpenzeit Chalets**, Zugang `k.moser@example.at`
(Katharina Moser). Live gegengeprüft am 09.09.2026: 2 zugeordnete Objekte
(„Chalet Bergkristall", „Seehaus am Achensee"), 13 Abrechnungen, 243 künftige
Buchungen im Mandanten, Währung EUR, erfundene Namen. **Nicht Nordlicht**, der
Demo-Mandant der PMS-App: dort gibt es 0 `owners`, 0 `owner_properties` und
0 `owner_statements` — Abrechnungen und Auszahlung wären leer, und ein leerer
Screenshot ist ein Ablehnungsgrund.

| # | Datei | Zeigt | Warum diese |
|---|---|---|---|
| 1 | `01-start.png` | Startseite: Auszahlungs-Verlauf über die Monate, Vorjahresvergleich, darunter „Ihre Objekte" | Das erste Bild steht in der Suchliste. Es muss in einer Sekunde sagen, worum es geht: mein Haus, mein Geld. |
| 2 | `02-kalender.png` | Belegungskalender mit Aufenthalten und der Auszahlung pro Nacht | Die zweithäufigste Frage eines Eigentümers nach „was bekomme ich": „wann ist frei". |
| 3 | `03-abrechnung.png` | Ein Abrechnungsbeleg: Posten, Summen je Währung | Der Beleg ist das Dokument, auf das ein Eigentümer wartet. Er zeigt außerdem, dass die App Zahlen führt und nicht nur anzeigt. |
| 4 | `04-aufenthalt.png` | „Aufenthalt buchen": Zeitraum, Gästezahl, Notiz, Knopf „beantragen" | Die einzige Handlung, die ein Eigentümer regelmäßig ausführt — und die einzige, bei der die App etwas von ihm will. |
| 5 | `05-auslastung.png` | „Auslastung & Kanäle" mit Halbkreis-Tacho und Kanalverteilung | Das visuell stärkste Bild der App und der Beleg, dass sie mehr kann als eine Liste. |
| 6 | `06-chat.png` | Chat mit der Verwaltung, sichtbarer Schloss-Hinweis | Neu seit 0611 und der Grund für die Kamera-Berechtigung im Manifest — wer die Berechtigung erklären will, zeigt sie. |

**Bewusst NICHT dabei:**
- *Fotoalbum* — hängt an den Objektbildern des Mandanten; ein leeres Album wäre
  ein Leerzustand.
- *Meine Aufgaben* — die meisten Eigentümer haben keine; der Screen wäre bei
  Katharina Moser leer.
- *Zählerstand* — eine Zahl in einem Feld ist kein Bild, das jemanden überzeugt.

**Vor dem Einfügen prüfen** (Google: „Edit excess elements in the notification
bar. Do not show service providers or notifications. The battery, WiFi, and
cell service logos should be full."): In der Statusleiste des Simulators darf
kein Benachrichtigungs-Banner stehen, und das Glockensymbol „stumm" gehört
weg — im Simulator über *Features → Toggle Appearance*/Einstellungen.

### Aufnehmen — die Befehle

Simulator und Metro startet der Nutzer. **Vorher messen** (`uptime`,
`sysctl vm.swapusage`) und nichts parallel laufen lassen: kein Metro der
anderen Apps, kein Next.js-Dev-Server, kein Android-Emulator.

```bash
# 1. Metro der Eigentümer-App (eigener Port, damit nichts kollidiert)
cd mobile-owner && bun run start

# 2. App in den laufenden Simulator (zweites Terminal)
cd mobile-owner && bun run ios

# 3. Gerät prüfen und je Bildschirm auslösen
xcrun simctl list devices available
xcrun simctl io booted screenshot roh/01-start.png
xcrun simctl io booted screenshot roh/02-kalender.png
#   … usw.

# 4. Auf Googles Format bringen (1206 x 2622 -> 1475 x 2622, 9:16, ohne Alpha)
bash scripts/mobile/play-screenshots-aufbereiten.sh \
     roh docs/store-assets/eigentuemer/screenshots
```

Der letzte Schritt ist Pflicht, nicht Kosmetik: die native Aufnahme hat das
Verhältnis 2,174 und verletzt damit Googles harte Grenze („no more than twice
as long"). `screencapture` scheidet aus (keine Aufnahmeberechtigung, CLAUDE.md);
`simctl io` schreibt die Datei direkt aus dem Simulator und braucht keine.

---

## Weitere Pflichtfelder im Formular

| Feld | Wert |
|---|---|
| App- oder Spiel | App |
| Kostenlos oder kostenpflichtig | Kostenlos |
| Kategorie | Unternehmen |
| Tags | Immobilien, Finanzen, Terminplanung |
| E-Mail für den Support | info@mynextdays.dk |
| Website | https://www.mynextdays.com |
| Datenschutzerklärung | https://www.mynextdays.com/datenschutz |
| Konto-Löschung (URL) | https://mynextdays.com/konto-loeschen |
| Zielgruppe | 18+ / keine Kinder |
| Enthält Werbung | Nein |
| Government apps | Nein |
| Finanzfunktionen | Keine — die App zeigt Beträge an, bewegt aber kein Geld |
