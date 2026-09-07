// Deutsche Basisinhalte der Gastgeber-Hilfe. Reihenfolge = Anzeigereihenfolge.
//
// Die Angaben stammen aus dem Code, nicht aus dem Gedaechtnis: der Provisions-
// Satz haengt am KANAL (cohosts/service.py: „Es gibt nur EINEN Tarif, der Kanal
// entscheidet"), Fotopflicht und Mindestzahl aus dem Wizard, Zahlungs- und
// Auszahlungswege aus lib/payments.ts bzw. lib/auszahlungen.ts. Wo eine Zahl
// kontoabhaengig ist, nennt der Text die Stelle in der App statt einer festen
// Zahl — ein erfundener Wert waere schlimmer als keiner (Wurzel 4).
import type { HilfeKategorie } from "./typen";

const ersteSchritte: HilfeKategorie = {
  slug: "erste-schritte",
  titel: "Erste Schritte",
  beschreibung: "Vom Konto zum ersten Inserat auf myBestDays.",
  icon: "ph:rocket-launch-duotone",
  artikel: [
    {
      slug: "konto-einrichten",
      titel: "Konto einrichten",
      auszug: "Was du brauchst, bevor dein Objekt buchbar wird.",
      text: [
        { art: "p", text: "myBestDays ist der Marktplatz für Gäste. Als Gastgeber stellst du dein Objekt ein, führst deinen Kalender und beantwortest Anfragen — alles in diesem Dashboard." },
        { art: "h2", text: "Was zum Veröffentlichen nötig ist" },
        { art: "schritte", punkte: [
          "Konto bestätigen: Die Bestätigung deiner E-Mail-Adresse findest du unter [Konto](/konto).",
          "Objekt anlegen: Der Assistent führt dich durch Typ, Adresse, Kapazität, Ausstattung und Fotos.",
          "Fotos hochladen: Jeder Raum braucht mindestens ein Foto, insgesamt mindestens fünf.",
          "Preis setzen: Ohne Grundpreis kann niemand buchen.",
          "Auszahlung hinterlegen: Ohne Bankverbindung erhältst du kein Geld.",
        ] },
        { art: "hinweis", ton: "info", text: "Solange etwas fehlt, zeigt die Übersicht genau an, was noch aussteht. Veröffentlichen lässt sich ein Objekt erst, wenn alle Pflichtangaben stehen." },
      ],
    },
    {
      slug: "objekt-einstellen",
      titel: "Objekt einstellen",
      auszug: "Der Assistent Schritt für Schritt.",
      text: [
        { art: "p", text: "Über [Objekte](/objekte) legst du ein neues Objekt an. Der Assistent fragt der Reihe nach ab, was ein Gast vor der Buchung wissen muss." },
        { art: "h2", text: "Die Schritte" },
        { art: "ul", punkte: [
          "Art des Objekts und ob Gäste die ganze Unterkunft, ein Zimmer oder ein Gemeinschaftszimmer bekommen.",
          "Adresse — such sie über das Straßenfeld, dann werden Ort, PLZ, Land und die Lage auf der Karte automatisch gesetzt.",
          "Position auf der Karte prüfen und den Pin bei Bedarf verschieben.",
          "Kapazität: Gäste, Schlafzimmer, Betten, Bäder.",
          "Ausstattung aus dem vollständigen Katalog — nutze die Suche, es sind über 300 Merkmale.",
          "Fotos je Raum, Titel, Beschreibung, Buchungsart und Preis.",
        ] },
        { art: "hinweis", ton: "tipp", text: "Du kannst jederzeit „Speichern & beenden“ wählen. Dein Entwurf bleibt erhalten und du machst später weiter." },
      ],
    },
  ],
};

const fotos: HilfeKategorie = {
  slug: "fotos",
  titel: "Fotos",
  beschreibung: "Welche Bilder Pflicht sind und was gute Fotos ausmacht.",
  icon: "ph:camera-duotone",
  artikel: [
    {
      slug: "foto-pflicht",
      titel: "Welche Fotos sind Pflicht?",
      auszug: "Je Raum mindestens eins, insgesamt mindestens fünf.",
      text: [
        { art: "p", text: "Gäste buchen, was sie sehen. Deshalb braucht jeder Raum ein eigenes Foto — nicht fünf Bilder derselben Küche." },
        { art: "h2", text: "Die Regel" },
        { art: "ul", punkte: [
          "Ein Titelbild — es steht auf dem Marktplatz an erster Stelle.",
          "Jedes Schlafzimmer ein Foto.",
          "Jedes Bad ein Foto, auch geteilte Bäder.",
          "Den Außenbereich.",
          "Insgesamt mindestens fünf Fotos.",
        ] },
        { art: "p", text: "Legst du ein Schlafzimmer oder Bad dazu, erscheint dafür sofort eine weitere offene Kachel. Unter „Weitere Fotos“ kannst du bis zu zehn zusätzliche Bilder hochladen." },
        { art: "hinweis", ton: "warnung", text: "Der Assistent lässt dich erst weiter, wenn jeder Raum belegt ist. Das ist Absicht: unvollständige Inserate werden seltener gebucht." },
      ],
    },
    {
      slug: "gute-fotos",
      titel: "Gute Fotos machen",
      auszug: "Tageslicht, Weitwinkel, aufgeräumt.",
      text: [
        { art: "ul", punkte: [
          "Bei Tageslicht fotografieren, Vorhänge auf, Licht an.",
          "Aus der Ecke des Raums fotografieren — so wirkt er so groß, wie er ist.",
          "Vorher aufräumen: persönliche Dinge, Kabel, Mülleimer verschwinden lassen.",
          "Quer statt hoch — der Marktplatz zeigt Bilder im Querformat.",
          "Keine Bilder mit fremden Personen ohne deren Einverständnis.",
        ] },
        { art: "hinweis", ton: "info", text: "JPEG und PNG werden angenommen. Sehr kleine Dateien lehnt das System ab, weil sie in der Anzeige unscharf wären." },
      ],
    },
  ],
};

const preiseBuchungen: HilfeKategorie = {
  slug: "preise-buchungen",
  titel: "Preise & Buchungen",
  beschreibung: "Grundpreis, Verfügbarkeit und wie Anfragen ankommen.",
  icon: "ph:calendar-check-duotone",
  artikel: [
    {
      slug: "preis-setzen",
      titel: "Preis festlegen",
      auszug: "Grundpreis je Nacht und was ihn beeinflusst.",
      text: [
        { art: "p", text: "Der Grundpreis gilt je Nacht in der Währung deines Objekts. Ohne ihn ist keine Buchung möglich." },
        { art: "ul", punkte: [
          "Den Grundpreis setzt du im Assistenten oder später im Objekt-Editor.",
          "Wochenendzuschläge und Rabatte für längere Aufenthalte kannst du ergänzen.",
          "Die Währung ergibt sich aus dem Land des Objekts und wird nicht geraten.",
        ] },
      ],
    },
    {
      slug: "stornobedingungen",
      titel: "Stornobedingungen für dein Objekt",
      auszug:
        "Was ein Gast zurückbekommt, wenn er absagt — und wie du das je Objekt festlegst.",
      art: "grundlagen",
      text: [
        { art: "p", text: "Du legst zwei Bedingungen fest: eine für kurze Aufenthalte und eine für lange. Die Grenze liegt bei 28 Nächten — dieselbe Trennung, die auch die Portale führen." },
        { art: "h2", text: "Kurze Aufenthalte (unter 28 Nächten)" },
        { art: "ul", punkte: [
          "Flexibel: volle Erstattung bis 1 Tag vor der Anreise.",
          "Moderat: volle Erstattung bis 5 Tage vor der Anreise.",
          "Eingeschränkt: volle Erstattung bis 14 Tage vor der Anreise, danach 50 % bis 7 Tage vorher.",
          "Nicht erstattungsfähig: keine Erstattung bei Absage.",
        ] },
        { art: "h2", text: "Lange Aufenthalte (ab 28 Nächten)" },
        { art: "ul", punkte: [
          "Moderat (Langzeit): volle Erstattung bis 30 Tage vor der Anreise.",
          "Streng (Langzeit): volle Erstattung bis 28 Tage vor der Anreise.",
        ] },
        { art: "h2", text: "Wo du sie einstellst" },
        { art: "schritte", punkte: [
          "Öffne den [Kalender](/kalender) und klicke auf dein Objekt.",
          "Wähle rechts „Stornierungen“.",
          "Öffne „Kurzzeitaufenthalte“ oder „Langzeitaufenthalte“ und wähle eine Richtlinie.",
        ] },
        { art: "hinweis", ton: "info", text: "Die Bedingung hängt am Preisplan des Objekts. Hat ein Objekt noch keinen Preisplan, lässt sie sich erst danach zuordnen." },
        { art: "p", text: "Die gewählte Bedingung gilt für alle Buchungen dieses Objekts — auch für die über die Portale." },
      ],
    },
    {
      slug: "buchungsart",
      titel: "Sofortbuchung oder Anfrage",
      auszug: "Wer entscheidet, ob eine Buchung zustande kommt.",
      text: [
        { art: "p", text: "Du wählst, wie Gäste bei dir buchen." },
        { art: "ul", punkte: [
          "Sofortbuchung: Der Gast bucht direkt, ohne auf dich zu warten. Das wird häufiger gebucht.",
          "Auf Anfrage: Du bestätigst jede Buchung selbst. Antworte zügig — lange Wartezeit kostet Buchungen.",
        ] },
        { art: "p", text: "Anfragen und Bestätigungen laufen über [Nachrichten](/nachrichten)." },
      ],
    },
  ],
};

const geld: HilfeKategorie = {
  slug: "provision-auszahlung",
  titel: "Provision & Auszahlung",
  beschreibung: "Was myBestDays kostet und wann dein Geld kommt.",
  icon: "ph:currency-circle-dollar-duotone",
  artikel: [
    {
      slug: "provision",
      titel: "Was kostet myBestDays?",
      auszug: "Keine Grundgebühr — Provision nur auf Buchungen über den Marktplatz.",
      text: [
        { art: "p", text: "Es gibt keine monatliche Gebühr. Bezahlt wird nur, wenn du verdienst." },
        { art: "h2", text: "Der Kanal entscheidet" },
        { art: "ul", punkte: [
          "Buchungen über myBestDays: Provision auf den Buchungswert.",
          "Direktbuchungen über deine eigene Seite: provisionsfrei.",
        ] },
        { art: "p", text: "Deinen persönlichen Satz und jede einzelne Abrechnung siehst du unter [Konto](/konto) im Bereich Auszahlungen — dort steht der Betrag je Buchung, nicht eine allgemeine Zahl." },
        { art: "hinweis", ton: "info", text: "Die Provision wird von der Auszahlung abgezogen. Du musst nichts überweisen." },
      ],
    },
    {
      slug: "auszahlung",
      titel: "Auszahlung einrichten",
      auszug: "Bankverbindung hinterlegen und Auszahlungen verfolgen.",
      text: [
        { art: "schritte", punkte: [
          "Unter [Konto](/konto) den Bereich Auszahlungen öffnen.",
          "Bankverbindung und die geforderten Angaben zur Person oder Firma hinterlegen.",
          "Prüfung abwarten — erst danach sind Auszahlungen möglich.",
        ] },
        { art: "p", text: "Fehlt eine Angabe, steht auf der Seite konkret, welche. Jede Auszahlung wird dort mit Betrag, Buchung und Datum aufgeführt." },
        { art: "hinweis", ton: "warnung", text: "Ohne vollständige Auszahlungsdaten kannst du zwar Buchungen annehmen, aber kein Geld erhalten." },
      ],
    },
  ],
};

const konto: HilfeKategorie = {
  slug: "konto-sicherheit",
  titel: "Konto & Sicherheit",
  beschreibung: "Anmeldung, Zwei-Faktor und deine Daten.",
  icon: "ph:shield-check-duotone",
  artikel: [
    {
      slug: "zwei-faktor",
      titel: "Zwei-Faktor-Anmeldung",
      auszug: "Dein Konto zusätzlich absichern.",
      text: [
        { art: "p", text: "Mit einem zweiten Faktor kommt niemand allein mit deinem Passwort in dein Konto. Du kannst eine Authenticator-App oder dein Handy per SMS nutzen." },
        { art: "p", text: "Einschalten lässt sich das unter [Konto](/konto) im Bereich Sicherheit. Dort siehst du auch, von welchen Geräten aus du angemeldet bist, und kannst fremde Sitzungen beenden." },
      ],
    },
    {
      slug: "hilfe-bekommen",
      titel: "Persönliche Hilfe",
      auszug: "Wenn dein Fall hier nicht steht.",
      text: [
        { art: "p", text: "Findest du keine Antwort, schreib uns über [Support](/support). Dort legst du eine Anfrage an und siehst den Stand aller bisherigen Anfragen." },
        { art: "hinweis", ton: "tipp", text: "Nenne Objekt und Buchungsnummer, wenn es um eine bestimmte Buchung geht — das spart eine Rückfrage." },
      ],
    },
  ],
};

export const kategorien: HilfeKategorie[] = [
  ersteSchritte,
  fotos,
  preiseBuchungen,
  geld,
  konto,
];
