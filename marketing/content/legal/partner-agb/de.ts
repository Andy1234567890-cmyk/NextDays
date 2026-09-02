// Partner-AGB (Affiliate-Programm, 0517/0520) — ENTWURF.
//
// Dieser Text ist ein von uns formulierter Platzhalter, damit Programmseite,
// Bewerbung (Pflicht-Häkchen) und Gutschrift auf ein Dokument zeigen. Er ist
// NICHT anwaltlich geprüft; die Prüfung DE/DK (Handelsvertreterrecht,
// Verfallsklauseln gegenüber Privatpersonen, Team-Satz am eigenen Rang) steht
// aus und ist im Text selbst als Entwurf kenntlich gemacht. Fachliche Zahlen
// (Staffel, Fristen) stehen bewusst als Verweis auf die Programmseite, nicht
// als Zahl im Vertragstext (Wurzel 4).
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Teilnahmebedingungen des myNextDays-Partnerprogramms: Attribution, Provisionsbasis, Staffel, Team-Provision, Verbote, Kennzeichnung, Auszahlung.",
  numbered: false,
  toc: true,
  title: "Teilnahmebedingungen Partnerprogramm (Partner-AGB) — Entwurf",
  standIso: "2026-09-02",
  intro: [
    "ENTWURF — Diese Bedingungen sind ein Arbeitsstand von myNextDays und noch nicht anwaltlich geprüft. Bis zur Freigabe der geprüften Fassung gelten sie als Beschreibung des Programms, nicht als endgültiger Vertragstext. Die geprüfte Fassung wird unter dieser Adresse mit neuer Versionsnummer veröffentlicht; Partner werden bei der nächsten Anmeldung um erneute Zustimmung gebeten.",
    `Diese Teilnahmebedingungen regeln die Teilnahme am Partnerprogramm (Affiliate-Programm) der ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (nachfolgend „myNextDays“ oder „wir“) durch Partner (nachfolgend „Partner“).`,
    "Das Partnerprogramm richtet sich an Personen und Unternehmen mit Sitz in der EU, der Schweiz oder dem Vereinigten Königreich, die Betriebe (Vermieter, Agenturen, Hotels) auf myNextDays empfehlen.",
  ],
  sections: [
    {
      heading: "§ 1 Teilnahme und Freigabe",
      paragraphs: [
        "Die Teilnahme setzt eine Bewerbung über das Partner-Dashboard voraus. Pflichtangaben sind Name bzw. Firma, Rechtsform, Land, mindestens ein Social-Media-Konto mit Adresse, Handle und Reichweite sowie bei Unternehmen die Umsatzsteuer-Identifikationsnummer.",
        "myNextDays prüft jede Bewerbung persönlich und entscheidet frei über die Freigabe. Ein Anspruch auf Aufnahme besteht nicht. Die Teilnahme ist kostenlos; ein Abo von myNextDays ist keine Voraussetzung.",
        "Der Partner hält seine Angaben aktuell, insbesondere Kanäle, Rechtsform, Steuer- und Auszahlungsdaten.",
        "Die angegebene Reichweite ist zunächst eine Selbstauskunft. Der Partner kann seine Konten bei YouTube, Instagram, Facebook und TikTok freiwillig verbinden; dann werden Follower und Aufrufe aus der Plattform gelesen und als verifiziert ausgewiesen. Nicht verifizierte Reichweite wird bei der Freigabe und bei späteren Prüfungen geringer gewichtet. Die Verbindung ist jederzeit im Dashboard trennbar; Einzelheiten zur Verarbeitung stehen in der Datenschutzerklärung.",
      ],
    },
    {
      heading: "§ 2 Zuordnung von Betrieben (Attribution)",
      paragraphs: [
        "Ein Betrieb wird dem Partner zugeordnet, wenn er sich mit dem Empfehlungscode des Partners registriert. Der Code wird dem Betrieb bei der Registrierung sichtbar angezeigt und durch das Absenden bestätigt. Tracking-Cookies werden nicht gesetzt.",
        "Ein Betrieb wird genau einem Partner zugeordnet; maßgeblich ist der bei der Registrierung bestätigte Code. Eine spätere Umordnung erfolgt nur durch myNextDays bei nachgewiesenem Fehler.",
        "Nicht zugeordnet werden Betriebe des Partners selbst, seiner Gesellschafter, Mitarbeiter oder Angehörigen sowie Betriebe, die bereits Kunde von myNextDays sind oder waren.",
      ],
    },
    {
      heading: "§ 3 Provision auf eigene Kunden",
      paragraphs: [
        "Provisionsbasis ist der Netto-Abo-Umsatz des zugeordneten Betriebs (Grundtarif und Module) aus bezahlten Rechnungen — ohne Umsatzsteuer, ohne Portalprovisionen, Zusatzleistungen, Nachberechnungen und sonstige durchlaufende Posten.",
        "Der Provisionssatz richtet sich nach dem Rang des Partners zum Zeitpunkt der Zahlung. Die Ränge und Sätze sind auf der Programmseite veröffentlicht. Der Rang bemisst sich nach der Zahl der zahlenden Kunden in der Struktur des Partners: seine eigenen zahlenden Kunden und die zahlenden Kunden seiner Team-Partner (§ 4), jeder Kunde einmal. Der Rang wird monatlich zum Stichtag festgestellt; ein Aufstieg gilt sofort, eine Rückstufung erst, wenn die Zahl an zwei Stichtagen in Folge unter der Schwelle lag.",
        "Erreicht der Partner erstmals einen Rang ab „Aufsteiger“, erhält er einmalig den für diesen Rang auf der Programmseite ausgewiesenen Aufstiegsbonus (derzeit 50,00 EUR je Rang, für alle Partner in Euro). Jeder Rang wird nur einmal vergütet, auch nach Rückstufung und erneutem Aufstieg. Der Bonus unterliegt dem Erstattungsfenster nach § 7.",
        "Die Provision entsteht je Betrieb für zwölf Monate ab dessen erster zahlungspflichtiger Abo-Rechnung; eine über den Partner vermittelte kostenlose Testphase und ein Gratismonat zählen nicht mit. Endet das Abo vorher, endet die Provision mit der letzten bezahlten Rechnung.",
        "Ab dem Rang „Elite-Partner“ erhält der Partner zusätzlich eine Superprovision in der auf der Programmseite ausgewiesenen Höhe (derzeit 2,5 %) auf den Netto-Abo-Umsatz aller Kunden seiner Struktur — eigene Kunden und Kunden seiner Team-Partner — ohne die Grenze von zwölf Monaten, solange der jeweilige Kunde ein zahlendes Abo hält und der Partner den Rang zum Zeitpunkt der Zahlung innehat. Sie entsteht neben der Provision nach Satz 2 und § 4.",
        "Für jede über myBestDays eingehende und bezahlte Buchung eines Betriebs, der dem Partner oder einem seiner Team-Partner zugeordnet ist, erhält der Partner einen Buchungsanteil in der auf der Programmseite ausgewiesenen Höhe (derzeit 0,5 %) des vom Gast gezahlten Buchungsbetrags in der Buchungswährung, ohne zeitliche Grenze, solange die Zuordnung besteht. Kautionen sind kein Buchungsbetrag. Erstattungen an den Gast nehmen den Anteil anteilig zurück (§ 7).",
      ],
    },
    {
      heading: "§ 4 Team-Provision",
      paragraphs: [
        "Ab dem Rang „Aufsteiger“ darf ein Partner Team-Partner führen. Bewirbt sich ein weiterer Partner über den Team-Link des Partners und bestätigt dessen Code sichtbar in seiner Bewerbung, wird er nach seiner Freigabe dem Team des Partners (nachfolgend „Sponsor“) zugeordnet. Führt der Sponsor den Rang zum Zeitpunkt der Bewerbung nicht, bleibt die Bewerbung gültig, eine Team-Zuordnung entsteht nicht.",
        "Der Sponsor erhält auf den Netto-Abo-Umsatz der Kunden seiner Team-Partner eine Team-Provision in Höhe der Differenz zwischen seinem eigenen Provisionssatz und dem Provisionssatz des Team-Partners, jeweils nach dem Rang zum Zeitpunkt der Zahlung. Stehen beide im gleichen Rang oder der Team-Partner höher, entsteht keine Team-Provision. Provision des Team-Partners und Team-Provision des Sponsors übersteigen zusammen nie den höchsten Satz der Staffel (derzeit 30 %).",
        "Die Team-Provision besteht genau eine Ebene tief: Team-Partner erhalten keine Team-Provision auf Partner, die sie selbst werben. Für das Anwerben eines Partners wird keine Vergütung gezahlt; ein Teilnahmebeitrag wird nicht erhoben. Die Team-Provision entsteht ausschließlich aus bezahltem Abo-Umsatz.",
        "Die Team-Provision läuft je Team-Kunde zwölf Monate ab dessen erster bezahlter Rechnung, unterliegt demselben Erstattungsfenster und wird bei Erstattung oder Rückbelastung anteilig zurückgenommen (§ 7). Sie entsteht nur, solange Sponsor und Team-Partner freigegeben sind; andernfalls wird sie bis zur Klärung angehalten.",
        "Die Team-Zuordnung ist einmalig. Eine Änderung erfolgt nur durch myNextDays mit dokumentiertem Grund.",
      ],
    },
    {
      heading: "§ 5 Pflichten des Partners und Kennzeichnung",
      paragraphs: [
        "Der Partner kennzeichnet jede Empfehlung mit seinem Link oder Code als Werbung — am Anfang des Beitrags, in der Sprache des Beitrags, entsprechend den Vorgaben seines Landes (in Deutschland u. a. § 5a Abs. 4 UWG, in Dänemark markedsføringsloven § 6 Abs. 4). Wortlaute je Land stellt myNextDays im Partner-Dashboard bereit.",
        "Der Partner macht zu myNextDays nur Angaben, die den veröffentlichten Leistungsbeschreibungen entsprechen, und gibt keine Zusagen im Namen von myNextDays ab. Untersagt sind insbesondere Erfolgs- und Garantieversprechen (etwa „garantierte Vollauslastung in drei Tagen“) sowie Aussagen zu Einnahmen, die nicht aus den veröffentlichten Leistungsbeschreibungen folgen.",
        "Jedes Video und jeder Beitrag, der myNextDays nennt oder den Link des Partners trägt, wird vor der Veröffentlichung als Datei im Partner-Dashboard zur Prüfung vorgelegt. Der Link des Partners entsteht erst nach der schriftlichen Freigabe durch myNextDays; eine Veröffentlichung ohne Freigabe ist untersagt. myNextDays kann eine Freigabe widerrufen; bereits entstandene Provisionen bleiben unberührt.",
        "Für Logos, Bildschirmaufnahmen, B-Roll, Overlays und Screenshots verwendet der Partner ausschließlich das von myNextDays bereitgestellte Werbematerial. Eigene, nicht geprüfte Software-Aufnahmen sind nicht gestattet.",
      ],
    },
    {
      heading: "§ 6 Verbotene Praktiken",
      paragraphs: ["Untersagt sind insbesondere:"],
      list: [
        "Brand-Bidding: bezahlte Anzeigen auf die Marke „myNextDays“, Schreibvarianten und Kombinationen (z. B. „myNextDays Preise“) in Suchmaschinen und Netzwerken;",
        "Cookie-Dropping, verdeckte Weiterleitungen, iFrames, automatisiertes Aufrufen des Partner-Links oder sonstige technische Manipulation der Zuordnung;",
        "Selbstwerbung: Registrierung eigener Betriebe, von Gesellschaftern, Mitarbeitern oder Angehörigen über den eigenen Code oder den Code eines Team-Partners;",
        "gekaufte Reichweite (gekaufte Follower, Klick-Farmen, Bot-Traffic) sowie Anreize an Betriebe für die Registrierung (Rückvergütungen, Geschenke, Gewinnspiele);",
        "Rekrutierungsversprechen: die Anwerbung von Partnern mit Verdienstzusagen, die nicht aus bezahltem Abo-Umsatz stammen, oder die Darstellung des Programms als Einkommensquelle durch das Anwerben weiterer Partner;",
        "Spam, unerlaubte Direktwerbung und die Nutzung fremder Marken oder Inhalte ohne Recht.",
      ],
    },
    {
      heading: "§ 7 Erstattungsfenster, Rücknahme, Rückhaltung",
      paragraphs: [
        "Jede Provisionszeile ist nach ihrer Entstehung 30 Tage offen (Erstattungsfenster) und danach auszahlbar. Wird eine zugrunde liegende Rechnung ganz oder teilweise erstattet oder zurückbelastet (Chargeback), wird die Provision — einschließlich einer darauf beruhenden Team-Provision — anteilig zurückgenommen, auch nach Auszahlung durch Verrechnung mit künftigen Provisionen.",
        "Bei Verdacht auf einen Verstoß gegen § 2, § 5 oder § 6 darf myNextDays Zuordnungen und Provisionen bis zur Klärung anhalten. Bestätigt sich der Verstoß, entfallen die betroffenen Provisionen.",
      ],
    },
    {
      heading: "§ 8 Auszahlung und Gutschrift",
      paragraphs: [
        "Auszahlbare Provisionen werden monatlich je Währung gebündelt und ausgezahlt, sobald sie den auf der Programmseite bzw. im Dashboard genannten Mindestbetrag der jeweiligen Währung erreichen. Eine Umrechnung zwischen Währungen findet nicht statt.",
        "Die Abrechnung erfolgt im Gutschriftverfahren (Selbstfakturierung, momsloven § 52a): myNextDays erstellt je Auszahlung eine Gutschrift; der Partner stellt keine Rechnung. Der Partner stimmt dem Gutschriftverfahren zu.",
        "Unternehmer erhalten die Gutschrift mit Hinweis auf die Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge); Voraussetzung ist eine gültige, bestätigte Umsatzsteuer-Identifikationsnummer. Privatpersonen erhalten die Gutschrift ohne Umsatzsteuer und versteuern die Provision selbst.",
        "Die Auszahlung erfolgt per SEPA-Überweisung, Wise oder PayPal auf die vom Partner im Dashboard hinterlegten Daten.",
      ],
    },
    {
      heading: "§ 9 Daten und Einblick",
      paragraphs: [
        "Der Partner sieht zugeordnete Betriebe pseudonym (Nummer, Land, Status, Beträge). Namen, E-Mail-Adressen oder Buchungsdaten der Betriebe werden nicht offengelegt. Ein Sponsor sieht von seinen Team-Partnern Name bzw. Firma, Rang, Anzahl zahlender Kunden und die daraus entstehende Team-Provision, keine Kundendetails.",
        "Zu verbundenen Konten und angelegten Beiträgen sieht myNextDays Follower, Aufrufe, Interaktionen sowie Klicks und Kunden je Beitrag. Auffälligkeiten (etwa ein Follower-Sprung ohne passende Aufrufe oder eine deutliche Abweichung zwischen Selbstauskunft und verifiziertem Wert) sind Hinweise für eine persönliche Prüfung nach § 6 und § 10, keine automatische Sperre.",
        "Die Verarbeitung personenbezogener Daten im Partnerprogramm ist in der Datenschutzerklärung beschrieben.",
      ],
    },
    {
      heading: "§ 10 Laufzeit, Sperre und Kündigung",
      paragraphs: [
        "Die Teilnahme läuft unbefristet und kann von beiden Seiten jederzeit in Textform beendet werden. Bereits entstandene, auszahlbare Provisionen werden nach § 8 ausgezahlt; nach Beendigung entstehen keine neuen Provisionen.",
        "myNextDays darf den Partner bei Verstößen gegen diese Bedingungen sperren. Während der Sperre werden Provisionen angehalten; bei bestätigtem Verstoß entfallen sie.",
      ],
    },
    {
      heading: "§ 11 Änderungen",
      paragraphs: [
        "myNextDays kann diese Bedingungen und die Staffel mit Wirkung für die Zukunft ändern. Änderungen werden im Partner-Dashboard und auf dieser Seite mit Versionsnummer veröffentlicht; bei wesentlichen Änderungen wird der Partner um erneute Zustimmung gebeten. Bereits entstandene Provisionen bleiben unberührt.",
      ],
    },
    {
      heading: "§ 12 Anwendbares Recht",
      paragraphs: [
        "Es gilt dänisches Recht unter Ausschluss des Kollisionsrechts. Zwingende Verbraucherschutzvorschriften des Staates, in dem ein privater Partner seinen gewöhnlichen Aufenthalt hat, bleiben unberührt.",
      ],
    },
  ],
};
