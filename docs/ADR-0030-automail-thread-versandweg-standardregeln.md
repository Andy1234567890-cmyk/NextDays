# ADR-0030 — Automail für JEDE Buchung: Thread, Versandweg, Standard-Regelsatz

**Status:** ANGENOMMEN · **Datum:** 14.09.2026 · **Migration:** 0705 (nur der
Rollen-Riegel; Thread und Regelsatz brauchen kein DDL)

## Kontext

Die Nachrichten-Automatisierung des Posteingangs war vollständig gebaut —
Auslöser, Versatz, Zeitfenster, Sprachfassungen, Platzhalter, Planung, Claim,
Reaper. Trotzdem erreichte sie einen Teil der Gäste nie, und zwar ohne dass
irgendwo ein Fehler sichtbar wurde. Drei Lücken, alle drei stumm:

1. **Kein Thread, keine Automail.** Die Planung arbeitet ausschließlich über
   Threads (`planung._thread_und_objekt`), Threads liegen in `channex_booking`.
   Eine Direktbuchung (Kalender, genehmigter Sperrantrag, CSV-/PMS-Übernahme)
   hatte dort keine Zeile. Der Betrieb sah seine Regel „Buchungsbestätigung,
   Kanal Direkt" in der Liste stehen und durfte annehmen, sie laufe.

2. **Kein Versandweg.** Eine Marktplatz-Buchung (myBestDays) bekam ihren Thread
   zwar über die Buchungsstrecke, war aber unzustellbar: `send_message` kannte
   nur den Channex-Chat und sendete gegen eine Buchungs-ID, hinter der beim
   Aggregator nichts steht.

3. **Kein Anfang.** Ein frisch registrierter Betrieb hatte null Regeln. Die
   Hürde war nicht das Können, sondern das leere Blatt: wer nie eine
   Automail-Regel gesehen hat, schreibt keine.

Jede dieser Lücken sieht im Betrieb wie Absicht aus. Genau das macht sie
teuer — niemand meldet eine Nachricht, die nie kam.

## Entscheidung

**1. Jede Buchung bekommt eine Konversation — über EINEN Weg.**
`inbox/thread_spiegel.spiegeln` ist die einzige Stelle, an der eine
Thread-Zeile entsteht; jeder Pfad, der eine Reservierung anlegt oder ändert,
ruft sie auf. Der Tabellenname `channex_booking` ist historisch, ihr Inhalt ist
es nicht: sie ist der Thread-Speicher für JEDEN Kanal. Idempotent über die
UNIQUE `channex_booking_id` (Wurzel 2), geladen immer mit `tenant_id`
(Wurzel 3). Bewusst NICHT je Aufrufer inline nachgebaut — dieselbe Vorgabe wie
bei `ReservationsService._release_nights`: ein Gegenzustand, den sechs Stellen
selbst schreiben, läuft beim ersten Zusatz auseinander (Wurzel 1).

**2. Der Thread entscheidet den Versandweg, nicht der Absender.**
Hinter einem Portal-Thread steht eine Buchung beim Aggregator → Channex-Chat.
Hinter einem eigenen Thread (Direkt, Website, myBestDays) steht keine → dort
ist die E-Mail-Adresse der Buchung der Kanal. Der Betreff kommt auf dem Mailweg
aus der Regel (`automation_id`) und wird auch nur dort aufgelöst: ein
Portal-Chat hat keinen Betreff, und zwei Abfragen je fälliger Zeile wären im
Tick umsonst.

**3. Ein neuer Betrieb bekommt vier INAKTIVE Regeln.**
`inbox/standard_regeln.standard_regeln_anlegen` legt bei der Registrierung
`booking_new` (+5 Minuten), `before_checkin` (−1 Tag, 18:00),
`on_checkin` (Anreisetag, 06:00) und `on_checkout` (Abreisetag, 11:00) an —
alle mit `is_active = false`, `property_ids`/`channels` leer (= alle).

Die Texte stehen im Mailkatalog (`core.mail_texte_standardregeln`, Gebiet
`standardregeln`, 24 Sprachen) und werden doppelt geschrieben: als Grundfassung
an der Regel und als Sprachfassung in `message_automation_text`. Aufgerufen
wird best-effort im Nebenpfad der Registrierung (`AuthService.register`); ein
Fehler kippt die Anlage nie, wird aber als ERROR geloggt.

## Warum inaktiv, und nicht scharf

Weil wir sonst im Namen des Betriebs Nachrichten an fremde Gäste schickten, die
er nie gelesen hat. Ein Vorschlag ist etwas anderes als eine Entscheidung. Die
Regel steht sichtbar in der Liste — mit Text, Zeitpunkt und Platzhaltern — und
ein Schalter macht sie scharf. `planung` überspringt inaktive Regeln, es
entsteht also nicht einmal eine geplante Zeile.

Die +5 Minuten bei `booking_new` sind kein Puffer aus Vorsicht: im Moment des
Eingangs ist die Buchung noch nicht fertig verarbeitet (Gastdaten,
Objektzuordnung, Preis), und ein Platzhalter ohne Wert lässt den Versand mit
`felder.FeldFehlt` scheitern. Fünf Minuten sind für den Gast sofort und für uns
ein vollständiger Datensatz.

Die Uhrzeiten stehen in der ZEITZONE DES OBJEKTS (`use_property_timezone`),
nicht in UTC: „18:00" meint 18:00 dort, wo das Haus steht. Ohne das verschöbe
sich jede Anreise-Erinnerung je nach Jahreszeit um ein bis zwei Stunden.

## Migration 0705

Die Sprachfassungen aus 0363 (`message_automation_text`,
`message_template_text`) hatten nur eine MANDANTEN-Policy. 0315 hatte die
Grundfassungen rollenmäßig geschlossen — die zweite Ablage desselben Textes kam
später und bekam den Riegel nie. Ein eingeloggter cleaner oder owner las über
`curl /rest/v1/message_automation_text` jeden Anreisetext samt Türcode und
WLAN-Passwort, obwohl ihm dieselbe Regel in der Grundfassung verwehrt war
(Wurzel 6). 0705 setzt die restriktive Rollen-Policy nach, und zwar
`for all` statt nur `for select`: das GRANT ist zwar entzogen, aber ein
späteres Grant würde bei einer reinen SELECT-Policy den Schreibpfad tenant-weit
öffnen.

0705 nimmt außerdem `message_automation` und `automation_scheduled_message` aus
der Publikation `supabase_realtime`. 0072 hatte sie aufgenommen, 0337 hat ihnen
das SELECT-Grant entzogen; seitdem kann kein Client sie abonnieren, und die
beiden Frontend-Abos sind entfernt. Die Mitgliedschaft blieb — der WAL-Decoder
schleppte jede Neuplanung (eine Zeile je Buchung) für niemanden mit, und wer
später ein Grant setzt, hätte sofort ein offenes Abo auf dem fertig gerenderten
Gasttext.

## Folgen

* Der Betrieb sieht ab der Registrierung, wie eine Automail-Regel aussieht, und
  muss nichts abwählen, was er nie gewählt hat.
* Direkt-, Marktplatz- und Portal-Buchungen laufen über denselben Apparat; der
  Unterschied liegt in EINER Weiche, nicht in drei Codepfaden.
* Der Mailweg bringt eine neue Fehlerquelle mit: eine Buchung ohne
  E-Mail-Adresse ist unzustellbar. Das ist ein Datenfehler und schlägt
  entsprechend fehl (`last_error` an der geplanten Zeile, Glocke bei
  endgültigem Fehlschlag) — kein erfundener Ersatzempfänger (Wurzel 4).
* Wer ein neues Mail-Gebiet übersetzt, prüft die Platzhalter je Sprache: Gemini
  hat `{{feld}}` in vier Sprachen zu `{feld}` zusammengezogen (14.09.2026).
  Der Name blieb, die zweite Klammer fiel weg — `felder.MUSTER` erkennt das
  nicht mehr, und der Gast läse wörtlich „{property_name}", ohne dass ein Gate
  anschlägt. Gemessen in `tests/test_standard_regeln.py`.
