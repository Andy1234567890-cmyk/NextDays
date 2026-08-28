# Prompt: Framer-CMS vollständig auslesen

Kopiere den Block unten in eine Claude-Chrome-Sitzung, während der Tab mit dem
Framer-Projekt offen ist.

Was beim letzten Versuch schiefging und was der Prompt deshalb erzwingt:
- Es wurde nur mit `document.querySelectorAll` gearbeitet — **das gesamte CMS liegt
  in einem iframe**, der äußere Baum ist leer. Sichtbare Elemente fehlten komplett.
- Menüs wurden geöffnet und dann per `Escape` geschlossen, was das CMS verließ.
- Es wurde abgebrochen und „vollständig" gemeldet, obwohl Untermenüs, Kontextmenüs
  und die Feldtyp-Auswahl nie geöffnet waren.

---

```
Lies das Framer-CMS in diesem Tab VOLLSTÄNDIG aus:
https://framer.com/projects/Pearl-FREE-Portfolio-Template-copy--S6TIWpCjBdmnBgd8Zayq-eHJy7?node=dEoznbEXC

ZIEL
Eine Spezifikation, die vollständig genug ist, um dieses CMS ohne den Original-Tab
nachzubauen: jedes Bedienelement, jedes Menü, jeder Untermenü-Eintrag, jeder
Feldtyp, jede Farbe, jedes Maß, jeder Text.

ARBEITSWEISE — verbindlich
1. Klicke JEDES Bedienelement wirklich an. Nichts wird aus dem Aussehen
   geschlossen oder aus Framer-Doku ergänzt. Was du nicht geöffnet hast, steht am
   Ende unter „Nicht geprüft" — nicht im Hauptteil.
2. Öffne AUCH die zweite und dritte Ebene: Untermenüs, Kontextmenüs
   (Rechtsklick UND die Drei-Punkte-Knöpfe), Klapplisten in Zellen, Dialoge in
   Dialogen.
3. Schließe Menüs mit einem Klick daneben oder dem eigenen Schließen-Knopf.
   NIE mit Escape — Escape verlässt das CMS und wirft dich in den Canvas.
   Passiert es doch: über den „CMS"-Knopf oben links zurück.
4. Wenn ein Menü nicht aufgeht, versuche: exakter Mittelpunkt des Elements,
   Überfahren vor dem Klick (manche Knöpfe erscheinen erst dabei), Klick direkt
   auf das DOM-Element. Erst nach drei Versuchen als „nicht öffenbar" notieren.
5. Ändere NICHTS: nicht speichern, nicht veröffentlichen, nichts löschen,
   nichts umsortieren, keine OAuth-Verbindung herstellen. Nur ansehen. Was du
   versehentlich änderst, machst du sofort rückgängig und schreibst es dazu.

WAS ABZUARBEITEN IST

A · Kopfleiste
   Jeden Knopf: CMS · Projektname · Branch-Wähler · Avatar · Preview · Einladen ·
   Veröffentlichen. Was öffnet jeder? Branch-Wähler aufklappen.

B · Die drei Reiter: Collections, Fields, Plugins
   Jeden öffnen, Inhalt der linken Spalte je Reiter notieren.

C · Werkzeugleiste
   New Item · Sorting · Filter · Search · Show Columns.
   Bei jedem: Panel öffnen, ALLE Einträge lesen, dann eine Ebene tiefer klicken.
   - Sorting: „Add Sorting" → Feldliste → ein Feld wählen → welche Richtungen
     gibt es (auf/ab)? Lässt sich eine zweite Regel hinzufügen? Wie entfernt man
     eine Regel?
   - Filter: Feld wählen → Werte-Untermenü → einen Filter setzen → wie sieht er
     danach in der Leiste aus, wie entfernt man ihn? Gibt es Operatoren
     (ist/ist nicht/enthält)? Danach wieder entfernen.
   - Show Columns: alle Einträge, ist es eine Mehrfachauswahl?

D · Tabelle
   - Spaltenkopf ANKLICKEN: öffnet sich ein Menü? Alle Einträge.
   - Rechtsklick auf eine Zelle und auf eine Zeile: alle Einträge.
   - Drei-Punkte-Knopf je Zeile: alle Einträge.
   - Status-Chip in der Zelle anklicken (er hat einen Pfeil): welche Werte?
   - Schalter in der Zelle: umlegen und wieder zurück.
   - Ziehgriff: was passiert beim Ziehen (nur beschreiben, nicht ausführen)?
   - Kontrollkästchen: eine Zeile wählen → welche Massenaktionen erscheinen?
     Alle lesen. Dann „alle wählen" in der Kopfzeile.
   - Expand-Knopf beim Überfahren.

E · Editor-Dialog (über „+ New Item" UND über einen bestehenden Eintrag)
   - Alle Felder mit Typ, Platzhalter, Beschriftung.
   - Das „More"-Menü öffnen: jeden Eintrag lesen. Wo möglich, jeden Eintrag
     öffnen (Open in Canvas, Open in Localization, View Analytics, Edit Fields,
     Copy Link, Copy as Markdown) — NICHT: Delete, Draft Item.
   - Jeden Feldnamen anklicken: die Feldkonfiguration lesen (Name, Beschreibung,
     Erforderlich, Textbereich, Platzhalter — und was sonst dort steht).
   - Bildfeld: was passiert beim Klick auf „+"? Beim Klick auf ein vorhandenes
     Bild? Was macht das kleine Kreuz?
   - Slug-Feld: die URL-Vorschau darunter anklicken.
   - Save und Publish: was unterscheidet sie? (nur lesen, NICHT klicken)

F · Fields-Reiter
   - Jedes der Felder anklicken → Konfiguration.
   - Wie legt man ein NEUES Feld an? Suche den Knopf. Wenn gefunden: die
     komplette Liste der Feldtypen lesen — das ist der wichtigste offene Punkt.
   - Lässt sich ein Feld umsortieren, umbenennen, löschen?

G · Collections-Spalte
   - Drei-Punkte-Knopf neben „Work": alle Einträge.
   - „Add…" unter einer Collection: was öffnet sich?
   - Wie legt man eine NEUE Collection an?
   - Was bedeutet „Synced" bei Notion? Einstellungen dazu öffnen.

H · Plugins
   - Alle acht auflisten.
   - CSV Import und CMS Export öffnen und vollständig beschreiben.
   - „Browse All" öffnen: welche Plugins gibt es?
   - Google Sheets / Airtable / Ashby / HubSpot: anklicken und beschreiben, was
     kommt — aber KEINE Anmeldung durchführen.

I · Gestaltung
   Für jeden Elementtyp die berechneten Werte: Hintergrund, Textfarbe,
   Schriftgröße, Schriftschnitt, Radius, Innenabstand, Höhe, Breite.
   Elementtypen: Reiter aktiv/inaktiv, Werkzeugknopf, Tabellenkopf, Tabellenzeile,
   Zelle, Status-Chip, Schalter an/aus, Primärknopf, Sekundärknopf, Eingabefeld,
   Textarea, Dialog, Menü, Menüeintrag.
   Lies zusätzlich Framers eigene CSS-Variablen aus (`--framerInternalUI-*`).

J · Zustände
   - Wie sieht eine Zeile beim Überfahren aus? Ausgewählt?
   - Wie sieht ein Feld mit Fokus aus?
   - Was passiert bei leerer Collection / leerem Feld?

AUSGABE
Ein Markdown-Dokument mit dieser Gliederung:
   A Bedienelemente (Tabelle: Element · Position · Größe · was es öffnet)
   B Alle Funktionen (je Funktion: was öffnet sich, ALLE Einträge, was passiert
     beim Klicken)
   C Alle Felder (Tabelle: Name · Typ · Platzhalter · Besonderheit)
   D Feldtypen (die vollständige Liste aus F)
   E Plugins
   F Farben und Maße (Tabelle)
   G Zustände
   H NICHT GEPRÜFT — was du nicht öffnen konntest, mit Grund

Regeln für die Ausgabe:
- Keine Vermutung ohne Kennzeichnung. Schreibe „nicht geprüft", nicht „vermutlich".
- Keine Zusammenfassung à la „diverse Optionen" — jeder Eintrag wird genannt.
- Deutsch.
```
