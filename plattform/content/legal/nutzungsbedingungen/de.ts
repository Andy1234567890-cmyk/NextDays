import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

// DE ist die Quell-/Referenzfassung ALLER Rechtstexte: die 23 übrigen
// Sprachfassungen werden aus dieser Datei übersetzt. Inhaltliche Änderungen
// IMMER zuerst hier, dann in allen Sprachen nachziehen — und die `id` der
// Abschnitte dabei unverändert lassen, damit Deep-Links sprachübergreifend
// gelten. Zielgruppe sind Verbraucher (Gäste); die Bedingungen für Betriebe
// stehen in den Agentur-AGB von myNextDays, die für Gastgeber des Marktplatzes
// unter „gastgeber-bedingungen".
export const doc: LegalDoc = {
  title: "Nutzungsbedingungen für Gäste",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Nutzungsbedingungen regeln die Nutzung des Buchungsportals myBestDays (nachfolgend „Plattform“) durch Reisende und Bucher (nachfolgend „Gast“ oder „Sie“).",
    `Betreiberin der Plattform ist die ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (nachfolgend „myBestDays“ oder „wir“). myBestDays ist eine Marke dieser Gesellschaft und keine eigene juristische Person. Die vollständigen Anbieterangaben finden Sie im [Impressum](https://mybestdays.dk/rechtliches/impressum).`,
    "Mit der Nutzung der Plattform stimmen Sie diesen Bedingungen zu. Bitte lesen Sie sie aufmerksam.",
  ],
  summary: {
    heading: "Zusammenfassung dieser Bedingungen",
    paragraphs: [
      "myBestDays ist ein Marktplatz. Wir stellen die Plattform bereit, auf der Anbieter ihre Unterkünfte anbieten — die Unterkunft selbst stellen wir nicht. Der Beherbergungsvertrag kommt zwischen Ihnen und dem Anbieter zustande, nicht mit uns.",
      "Was Sie im Angebot sehen, stammt vom Anbieter: Beschreibung, Bilder, Ausstattung, Preis, Stornobedingungen und Hausregeln. Wir prüfen Angebote, aber wir können nicht für jede Angabe eines Anbieters einstehen.",
      "Der Preis, den Sie beim Abschluss der Buchung sehen, ist der Gesamtpreis für die gebuchten Leistungen. Zusätzliche Beträge, die erst vor Ort anfallen (etwa Kurtaxe oder eine Kaution), weisen wir vorher gesondert aus.",
      "Geht etwas schief, wenden Sie sich zuerst an uns. Abschnitt A15 beschreibt, wie Sie eine Beschwerde einreichen und welche Wege Ihnen danach offenstehen.",
      "Diese Zusammenfassung erklärt die Bedingungen, ersetzt sie aber nicht. Maßgeblich ist der vollständige Text.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Alle Buchungen über myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definitionen",
          paragraphs: [
            "Die in diesen Bedingungen groß geschriebenen Begriffe sind im Lexikon am Ende dieses Dokuments erläutert. Die wichtigsten sind:",
          ],
          list: [
            "„Plattform“ — die Website, die mobilen Anwendungen und alle sonstigen Zugänge, über die myBestDays Unterkünfte anzeigt und Buchungen vermittelt.",
            "„Anbieter“ — die natürliche oder juristische Person, die eine Unterkunft über die Plattform anbietet (Gastgeber, Vermieter, Agentur, Hotel- oder Beherbergungsbetrieb).",
            "„Unterkunft“ — die vom Anbieter angebotene Beherbergungsleistung, also ein Ferienobjekt oder eine Einheit eines Zimmer- bzw. Objekttyps.",
            "„Buchung“ — die über die Plattform abgeschlossene Reservierung einer Unterkunft für einen bestimmten Zeitraum.",
            "„Gesamtpreis“ — der beim Abschluss der Buchung ausgewiesene Betrag einschließlich aller Steuern, Gebühren und Zuschläge, die über die Plattform abgerechnet werden.",
            "„Vor-Ort-Kosten“ — Beträge, die nicht über die Plattform abgerechnet, sondern beim Anbieter fällig werden (z. B. Kurtaxe, Kaution, Endreinigung nach Wahl des Anbieters).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Über diese Bedingungen",
          paragraphs: [
            "Diese Bedingungen gelten für jede Nutzung der Plattform, unabhängig davon, ob Sie ein Konto anlegen und ob eine Buchung zustande kommt.",
            "Abschnitt A gilt für alle Buchungen. Abschnitt B enthält die ergänzenden Regeln für Unterkünfte. Widersprechen sich beide, geht Abschnitt B vor.",
            "Für die Beherbergungsleistung selbst gelten ergänzend die Bedingungen des jeweiligen Anbieters (insbesondere Hausordnung und Stornobedingungen), die im Angebot ausgewiesen sind. Diese Bedingungen des Anbieters treten neben unsere Bedingungen; sie können unsere Bedingungen nicht abbedingen, soweit es um Ihr Verhältnis zu uns geht.",
            "Diese Bedingungen liegen in allen 24 Amtssprachen der Europäischen Union vor. Bei Abweichungen zwischen den Sprachfassungen ist die deutsche Fassung maßgeblich, soweit zwingendes Recht Ihres Wohnsitzstaates nichts anderes vorschreibt.",
            "Zwingende Verbraucherrechte nach dem Recht Ihres Wohnsitzstaates bleiben von diesen Bedingungen unberührt.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Über myBestDays",
          paragraphs: [
            "myBestDays ist ein Online-Marktplatz für Ferienunterkünfte und Beherbergungsbetriebe. Wir betreiben die Plattform, auf der Anbieter ihre Unterkünfte darstellen und Gäste diese buchen können.",
            "Wir sind Vermittler, nicht Beherberger. Wir besitzen, betreiben, verwalten und kontrollieren keine der auf der Plattform angebotenen Unterkünfte und sind nicht Vertragspartei des Beherbergungsvertrags.",
            "myBestDays ist ein Vermittlungsdienst im Sinne der Verordnung (EU) 2022/2065 über digitale Dienste. Unsere Angaben und Verfahren nach dieser Verordnung finden Sie unter [Gesetz über digitale Dienste](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays ist kein Reiseveranstalter. Wir stellen keine Pauschalreisen im Sinne der Richtlinie (EU) 2015/2302 zusammen; zu verbundenen Reiseleistungen siehe A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Unsere Plattform",
          paragraphs: [
            "Die Inhalte eines Angebots — Beschreibung, Fotos, Ausstattung, Belegungsgrenzen, Preise, Verfügbarkeiten, Stornobedingungen und Hausregeln — stammen vom jeweiligen Anbieter. Der Anbieter ist für ihre Richtigkeit und Vollständigkeit verantwortlich.",
            "Wir prüfen Angebote vor der Veröffentlichung und laufend auf offensichtliche Verstöße gegen unsere [Richtlinien für angemessene Inhalte](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Eine Pflicht zur allgemeinen Überwachung sämtlicher Inhalte besteht nicht und wäre nach Artikel 8 der Verordnung (EU) 2022/2065 auch unzulässig.",
            "Wie wir Suchergebnisse anordnen und welche Merkmale die Reihenfolge bestimmen, erklären wir in den [Angaben zu Preisen, Ranking und Empfehlungen](https://mybestdays.dk/rechtliches/preisangaben).",
            "Wir bemühen uns um eine durchgehend verfügbare Plattform, schulden aber keine ununterbrochene Verfügbarkeit. Wartung, Störungen und Anpassungen sind möglich.",
            "Übersetzungen von Anbieterinhalten können maschinell erstellt sein. Maßgeblich ist die vom Anbieter eingestellte Ursprungsfassung.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Unsere Werte",
          paragraphs: [
            "Wir erwarten von Gästen und Anbietern einen respektvollen Umgang. Diskriminierung wegen Herkunft, Hautfarbe, Religion, Weltanschauung, Geschlecht, Geschlechtsidentität, sexueller Orientierung, Behinderung, Alter oder ähnlicher Merkmale wird auf der Plattform nicht geduldet — siehe [Antidiskriminierungs-Richtlinie](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Für das Verhalten während des Aufenthalts gelten die [Grundregeln für Gäste](https://mybestdays.dk/rechtliches/grundregeln-gaeste), für Anbieter der [Verhaltenskodex für Anbieter](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Ihr Konto und Ihre Nutzung der Plattform",
          paragraphs: [
            "Für eine Buchung können Sie ein Konto anlegen. Sie sind für die Vertraulichkeit Ihrer Zugangsdaten verantwortlich und benachrichtigen uns unverzüglich, wenn Sie eine unbefugte Nutzung vermuten.",
            "Sie dürfen die Plattform nur nutzen, wenn Sie geschäftsfähig sind und rechtlich wirksam Verträge schließen können.",
            "Ihre Angaben bei Registrierung und Buchung müssen richtig und vollständig sein — insbesondere Name, Kontaktdaten und Anzahl der Reisenden. Der Anbieter braucht diese Angaben, um die Unterkunft bereitzustellen und seinen melderechtlichen Pflichten nachzukommen.",
            "Nicht erlaubt ist insbesondere:",
          ],
          list: [
            "Scheinbuchungen, betrügerische Zahlungen oder die Nutzung fremder Zahlungsmittel ohne Berechtigung;",
            "das automatisierte Auslesen der Plattform (Scraping, Crawler) außerhalb dessen, was unsere robots.txt erlaubt;",
            "Maßnahmen, die die Plattform oder die zugrunde liegende Infrastruktur stören, überlasten oder deren Sicherheitsvorkehrungen umgehen;",
            "das Einstellen rechtswidriger, beleidigender oder irreführender Inhalte in Bewertungen, Nachrichten oder Profilangaben;",
            "der Versuch, die Buchung an der Plattform vorbei abzuwickeln, nachdem der Kontakt über die Plattform zustande kam — siehe [Gebühren außerhalb der Plattform](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Preise",
          paragraphs: [
            "Alle Preise werden als Gesamtpreis einschließlich Steuern und aller über die Plattform abgerechneten Gebühren angezeigt, sobald die Reisedaten (Zeitraum und Anzahl der Reisenden) feststehen. Fällt ein Bestandteil erst vor Ort an, weisen wir ihn vor Abschluss der Buchung gesondert aus.",
            "Preise werden in der Währung des Angebots angezeigt. Wird Ihnen ein Betrag zusätzlich in einer anderen Währung angezeigt, ist das eine unverbindliche Umrechnung zur Orientierung; abgerechnet wird in der Währung des Angebots, sofern beim Bezahlvorgang nichts anderes ausgewiesen ist.",
            "Preise können sich bis zum Abschluss der Buchung ändern, etwa weil der Anbieter sie anpasst oder die Verfügbarkeit wechselt. Maßgeblich ist der Preis, der Ihnen unmittelbar vor der verbindlichen Buchung angezeigt und in der Buchungsbestätigung genannt wird.",
            "Offensichtliche Preisfehler (z. B. ein um Zehnerpotenzen falscher Betrag) binden weder uns noch den Anbieter. Erkennen wir einen solchen Fehler, informieren wir Sie unverzüglich; Sie können die Buchung dann kostenfrei stornieren.",
            "Wie sich Servicegebühren zusammensetzen, steht in den [Angaben zu Servicegebühren](https://mybestdays.dk/rechtliches/servicegebuehren). Zu Steuern und Abgaben siehe die [Steuerrichtlinie](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Zahlung",
          paragraphs: [
            "Zahlungen über die Plattform werden über den Zahlungsdienstleister Stripe abgewickelt. Zahlungsdaten (z. B. Kartendaten) erhebt und verarbeitet Stripe unmittelbar; myBestDays speichert keine vollständigen Kartendaten.",
            "Wann welcher Betrag fällig wird — Anzahlung, Restzahlung oder Zahlung vor Ort — richtet sich nach dem Angebot und ist vor Abschluss der Buchung ausgewiesen. Einzelheiten regeln die [Zahlungsbedingungen](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Sofern im Angebot eine Kaution ausgewiesen ist, kann diese vorautorisiert oder eingezogen und im Schadensfall ganz oder teilweise einbehalten werden; maßgeblich sind die Angaben im Angebot.",
            "Scheitert eine Zahlung oder wird sie zurückgebucht, kann die Buchung storniert werden. Der Anbieter kann die nach seinen Stornobedingungen entstandenen Beträge weiterhin verlangen.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Richtlinien",
          paragraphs: [
            "Neben diesen Bedingungen gelten die folgenden Richtlinien, die Bestandteil des Vertrags zwischen Ihnen und uns sind:",
          ],
          list: [
            "[Richtlinien für angemessene Inhalte](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Bewertungsrichtlinien](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Antidiskriminierungs-Richtlinie](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Grundregeln für Gäste](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Stornierungsbedingungen](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Umbuchungs- und Rückerstattungsrichtlinie](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Richtlinie für schwerwiegende Beeinträchtigungen](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Urheberrechtsrichtlinie](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Datenschutz und Cookies",
          paragraphs: [
            "Wie wir personenbezogene Daten verarbeiten, steht in der [Datenschutzerklärung](https://mybestdays.dk/rechtliches/datenschutz). Welche Cookies und ähnlichen Technologien wir einsetzen, steht in der [Cookie-Richtlinie](https://mybestdays.dk/rechtliches/cookies).",
            "Für eine Buchung geben wir dem Anbieter die Daten weiter, die er zur Erbringung der Beherbergungsleistung benötigt. Der Anbieter ist dafür eigenständig Verantwortlicher; für ihn gelten die [Datenschutz-Standards für Gastgeber](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Barrierefreiheit",
          paragraphs: [
            "Unseren Stand zur Barrierefreiheit der Plattform und den Weg, Barrieren zu melden, beschreibt die [Erklärung zur Barrierefreiheit](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Angaben zur Barrierefreiheit einer Unterkunft stammen vom Anbieter. Wenn Sie auf bestimmte Merkmale angewiesen sind, klären Sie diese vor der Buchung über die Nachrichtenfunktion mit dem Anbieter ab.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Bewertungen und nutzergenerierte Inhalte",
          paragraphs: [
            "Nach dem Aufenthalt können Sie eine Bewertung abgeben. Bewertungen dürfen nur abgeben, wer über die Plattform gebucht und den Aufenthalt angetreten hat oder hätte antreten können — dadurch stellen wir sicher, dass veröffentlichte Bewertungen von tatsächlichen Gästen stammen.",
            "Wir bezahlen nicht für Bewertungen, verändern ihren Inhalt nicht und unterdrücken keine Bewertung, nur weil sie negativ ausfällt. Einzelheiten und die Gründe, aus denen wir eine Bewertung entfernen, stehen in den [Bewertungsrichtlinien](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Für Inhalte, die Sie einstellen — Bewertungen, Fotos, Nachrichten, Profilangaben — bleiben Sie verantwortlich. Sie räumen uns ein einfaches, räumlich und zeitlich unbeschränktes, unentgeltliches Recht ein, diese Inhalte im Rahmen des Betriebs und der Bewerbung der Plattform zu vervielfältigen, zu bearbeiten (z. B. Zuschnitt, Übersetzung) und öffentlich zugänglich zu machen. Sie können Ihre Inhalte löschen; bereits erteilte Nutzungen in bereits veröffentlichten Zusammenstellungen bleiben davon unberührt.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Nachrichten und Kommunikation mit dem Anbieter",
          paragraphs: [
            "Nachrichten zwischen Ihnen und dem Anbieter laufen über die Plattform. Wir stellen die Nachrichtenfunktion bereit, sind aber nicht Absender oder Empfänger der Inhalte.",
            "Wir dürfen Nachrichten automatisiert auf Verstöße gegen diese Bedingungen prüfen (z. B. Kontaktdaten zur Umgehung der Plattform, Betrugsmuster, rechtswidrige Inhalte) und betroffene Nachrichten zurückhalten oder entfernen. Über eine Entfernung informieren wir Sie mit einer Begründung nach A17.",
            "Wir senden Ihnen Nachrichten zu Ihrer Buchung (Bestätigung, Änderungen, Anreiseinformationen) an die angegebene E-Mail-Adresse. Diese Nachrichten sind Vertragskommunikation und lassen sich nicht abbestellen, solange die Buchung besteht. Werbliche Nachrichten erhalten Sie nur, soweit Sie eingewilligt haben oder das Recht es ohne Einwilligung erlaubt; Sie können ihnen jederzeit widersprechen.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Geistige Eigentumsrechte",
          paragraphs: [
            "Die Plattform, ihre Gestaltung, Software, Datenbanken, Texte und Marken sind geschützt. Sie erhalten ein einfaches, nicht übertragbares Recht, die Plattform für die Suche nach und die Buchung von Unterkünften zu nutzen — mehr nicht.",
            "Die Nutzung unserer Marken und Logos regeln die [Richtlinien für Markenzeichen](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Wenn Sie der Ansicht sind, dass Inhalte auf der Plattform Ihr Urheberrecht verletzen, folgen Sie der [Urheberrechtsrichtlinie](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Was tun, wenn etwas schiefgeht",
          paragraphs: [
            "Betrifft das Problem die Unterkunft selbst, wenden Sie sich zuerst an den Anbieter — über die Nachrichtenfunktion oder vor Ort. Viele Probleme lassen sich so am schnellsten lösen.",
            "Kommen Sie mit dem Anbieter nicht weiter oder betrifft das Problem die Plattform, die Zahlung oder die Buchungsabwicklung, wenden Sie sich an uns. Wie Sie uns erreichen und wie wir Beschwerden bearbeiten, steht unter [Beschwerden und Streitbeilegung](https://mybestdays.dk/rechtliches/beschwerden).",
            "Halten Sie dabei bereit: Ihre Buchungsnummer, die E-Mail-Adresse der Buchung, eine kurze Beschreibung des Problems mit Ihrem Wunsch, wie wir helfen sollen, und die zugehörigen Belege (Fotos, Nachrichten, Quittungen).",
            "Ist die Unterkunft bei Anreise nicht verfügbar oder weicht sie wesentlich vom Angebot ab, greift die [Umbuchungs- und Rückerstattungsrichtlinie](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Die Plattform der Europäischen Kommission zur Online-Streitbeilegung (OS-Plattform) wurde durch die Verordnung (EU) 2024/3228 aufgehoben und hat ihren Betrieb eingestellt; sie steht als Weg nicht mehr zur Verfügung. Welche Stellen an ihre Stelle treten, steht unter [Beschwerden und Streitbeilegung](https://mybestdays.dk/rechtliches/beschwerden).",
            "Haben wir eine Maßnahme gegen Ihre Inhalte oder Ihr Konto ergriffen, können Sie zusätzlich zu unserem internen Beschwerdeverfahren eine nach Artikel 21 der Verordnung (EU) 2022/2065 zertifizierte außergerichtliche Streitbeilegungsstelle anrufen. Deren Entscheidungen sind für uns nicht bindend.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Maßnahmen gegen unangemessenes Verhalten",
          paragraphs: [
            "Verstoßen Sie gegen diese Bedingungen oder eine der in A9 genannten Richtlinien, können wir — abgestuft nach Schwere, Häufigkeit und Auswirkung des Verstoßes — Inhalte entfernen oder ihre Sichtbarkeit einschränken, Funktionen sperren, Buchungen stornieren oder Ihr Konto vorübergehend oder dauerhaft sperren.",
            "Vor einer Maßnahme prüfen wir den Einzelfall. Bei offensichtlich rechtswidrigen Inhalten, bei Gefahr für Personen oder bei Betrug können wir sofort handeln.",
            "Jede Maßnahme begründen wir Ihnen und weisen Sie auf den Beschwerdeweg hin — siehe A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Meldung rechtswidriger Inhalte und Begründung von Maßnahmen",
          paragraphs: [
            "Jede Person kann uns Inhalte melden, die sie für rechtswidrig hält. Das Meldeverfahren nach Artikel 16 der Verordnung (EU) 2022/2065, unsere Kontaktstellen und der Umgang mit Meldungen sind unter [Gesetz über digitale Dienste](https://mybestdays.dk/rechtliches/dsa) beschrieben.",
            "Ergreifen wir eine Maßnahme gegen von Ihnen eingestellte Inhalte oder gegen Ihr Konto, erhalten Sie eine Begründung mit Angabe des Grundes, der Tatsachengrundlage, der Rechtsgrundlage oder der verletzten Vertragsbestimmung sowie der Beschwerdemöglichkeiten.",
            "Gegen jede Maßnahme können Sie innerhalb von sechs Monaten kostenfrei Beschwerde einlegen. Beschwerden werden von Menschen bearbeitet, nicht allein automatisiert.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Haftungsbeschränkung",
          paragraphs: [
            "Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit, für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie im Umfang einer von uns übernommenen Garantie. Ansprüche nach dem Produkthaftungsrecht bleiben unberührt.",
            "Im Übrigen ist unsere Haftung auf den vorhersehbaren Schaden begrenzt, der typischerweise aus der Verletzung der Pflichten entsteht, auf deren Erfüllung Sie vertrauen dürfen — und nur soweit das anwendbare Recht eine solche Begrenzung zulässt.",
            "Wir haften nicht für die Erbringung der Beherbergungsleistung selbst und nicht für das Verhalten von Anbietern oder anderen Gästen. Vertragspartner der Beherbergungsleistung ist der Anbieter.",
            "Wir haften nicht für die Richtigkeit der von Anbietern eingestellten Angaben, soweit wir sie nicht kannten und auch nicht kennen mussten. Erlangen wir Kenntnis von einer rechtswidrigen Angabe, handeln wir unverzüglich.",
            "Eine weitergehende Haftung ist ausgeschlossen. Zwingende gesetzliche Ansprüche, insbesondere Verbraucherrechte, bleiben unberührt.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Anwendbares Recht und Gerichtsstand",
          paragraphs: [
            "Es gilt dänisches Recht — der Sitz der Betreiberin liegt in Dänemark — unter Ausschluss des UN-Kaufrechts. Zwingende Verbraucherschutzvorschriften des Staates, in dem Sie Ihren gewöhnlichen Aufenthalt haben, bleiben nach Artikel 6 der Verordnung (EG) Nr. 593/2008 (Rom I) unberührt.",
            "Als Verbraucher können Sie uns an Ihrem Wohnsitzgericht oder an unserem Sitz in Dänemark verklagen; wir können Sie nur an Ihrem Wohnsitzgericht verklagen (Artikel 17 bis 19 der Verordnung (EU) Nr. 1215/2012).",
            "Für den Beherbergungsvertrag gilt regelmäßig das Recht des Staates, in dem die Unterkunft liegt; für Klagen aus Miete oder Pacht einer unbeweglichen Sache sind dessen Gerichte ausschließlich zuständig.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Verbundene Reiseleistungen",
          paragraphs: [
            "myBestDays vermittelt ausschließlich Beherbergungsleistungen. Wir bieten weder Flüge, Mietwagen, Beförderungsleistungen noch Ausflüge oder Attraktionen an und stellen keine Pauschalreisen im Sinne der Richtlinie (EU) 2015/2302 zusammen.",
            "Sollten wir künftig weitere Reiseleistungen vermitteln, weisen wir Sie vor der Buchung mit dem gesetzlich vorgeschriebenen Standardformular darauf hin, ob eine Pauschalreise oder eine verbundene Reiseleistung entsteht und welche Rechte Ihnen daraus zustehen.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Laufzeit, Sperrung und Kündigung",
          paragraphs: [
            "Der Vertrag über die Nutzung der Plattform läuft auf unbestimmte Zeit. Sie können Ihr Konto jederzeit ohne Angabe von Gründen löschen; bestehende Buchungen bleiben davon unberührt und werden nach den Bedingungen des jeweiligen Anbieters abgewickelt.",
            "Wir können den Nutzungsvertrag mit einer Frist von 14 Tagen kündigen. Bei einem schwerwiegenden Verstoß gegen diese Bedingungen können wir fristlos kündigen und das Konto sperren.",
            "Nach Beendigung löschen wir Ihre Daten, soweit keine gesetzliche Aufbewahrungspflicht oder ein berechtigtes Interesse an der Aufbewahrung entgegensteht; Einzelheiten regelt die [Datenschutzerklärung](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Änderungsklausel",
          paragraphs: [
            "Wir können diese Bedingungen ändern, wenn dafür ein sachlicher Grund besteht — etwa geänderte Rechtslage, höchstrichterliche Rechtsprechung, neue oder wegfallende Funktionen der Plattform oder die Beseitigung von Regelungslücken.",
            "Änderungen kündigen wir mindestens 30 Tage vor Wirksamwerden in Textform an. Widersprechen Sie nicht bis zum Wirksamwerden, gelten die geänderten Bedingungen als angenommen; auf diese Wirkung weisen wir in der Ankündigung gesondert hin. Widersprechen Sie, können wir den Nutzungsvertrag zum Zeitpunkt des Wirksamwerdens kündigen.",
            "Für bereits abgeschlossene Buchungen gelten die Bedingungen in der Fassung, die im Zeitpunkt der Buchung galt.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Unterkünfte",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Umfang dieses Abschnitts",
          paragraphs: [
            "Dieser Abschnitt gilt für die Buchung von Unterkünften über die Plattform — Ferienobjekte ebenso wie Zimmer und Einheiten von Beherbergungsbetrieben.",
            "Er ergänzt Abschnitt A. Bei Widersprüchen geht dieser Abschnitt B vor.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Vertragsverhältnis",
          paragraphs: [
            "Der Beherbergungsvertrag kommt ausschließlich zwischen Ihnen und dem Anbieter zustande. myBestDays ist nicht Vertragspartei.",
            "Die Darstellung einer Unterkunft auf der Plattform ist eine Aufforderung an Sie, ein Buchungsangebot abzugeben. Mit dem Klick auf den zahlungspflichtigen Buchungs-Button geben Sie ein verbindliches Angebot ab.",
            "Der Vertrag kommt zustande, wenn die Buchung bestätigt wird. Die Buchungsbestätigung senden wir an die von Ihnen angegebene E-Mail-Adresse; sie nennt den Anbieter, die gebuchte Leistung, den Zeitraum, den Gesamtpreis und die Stornobedingungen.",
            "Bei Unterkünften mit Anfragebuchung kommt der Vertrag erst mit der Annahme durch den Anbieter zustande. Bis dahin kann Ihr Zahlungsmittel vorautorisiert, aber nicht belastet werden.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Was wir tun",
          paragraphs: [
            "Wir stellen die Plattform bereit, zeigen die Angebote der Anbieter an, nehmen Ihre Buchung entgegen, leiten sie an den Anbieter weiter und übermitteln Ihnen die Buchungsbestätigung.",
            "Wir wickeln die Zahlung ab, soweit das Angebot eine Zahlung über die Plattform vorsieht, und stellen die Nachrichtenfunktion zwischen Ihnen und dem Anbieter bereit.",
            "Wir stellen die Unterkunft nicht bereit, betreiben sie nicht und übernehmen keine Gewähr für ihre Beschaffenheit. Wir sind nicht Ihr Reiseveranstalter.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Was Sie tun müssen",
          paragraphs: [
            "Prüfen Sie vor der Buchung das Angebot vollständig: Ausstattung, Belegungsgrenze, An- und Abreisezeiten, Hausregeln, Stornobedingungen und die Kosten, die erst vor Ort anfallen.",
            "Halten Sie die im Angebot ausgewiesene Höchstbelegung ein. Reisen mehr Personen an als gebucht, kann der Anbieter die Aufnahme verweigern oder einen Zuschlag verlangen.",
            "Beachten Sie die Hausordnung des Anbieters und die [Grundregeln für Gäste](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Sie behandeln die Unterkunft pfleglich und haften für Schäden, die Sie oder Ihre Mitreisenden verursachen.",
            "Benötigt der Anbieter oder eine Behörde Angaben zur Anmeldung (z. B. Meldeschein, Ausweisdaten, Kurtaxe-Erklärung), stellen Sie diese rechtzeitig bereit.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Preise und Zahlung",
          paragraphs: [
            "Der Gesamtpreis umfasst den Übernachtungspreis für den gebuchten Zeitraum und die im Angebot ausgewiesenen Zuschläge und Gebühren, die über die Plattform abgerechnet werden.",
            "Vor Ort können zusätzliche Beträge anfallen — insbesondere Kurtaxe oder ortsübliche Abgaben, eine Kaution sowie Zusatzleistungen, die Sie erst vor Ort buchen. Diese weisen wir vor Abschluss der Buchung als Vor-Ort-Kosten aus, soweit der Anbieter sie angegeben hat.",
            "Sieht das Angebot eine Anzahlung vor, wird der Restbetrag zu dem im Angebot genannten Zeitpunkt fällig. Bleibt die Restzahlung aus, kann der Anbieter nach seinen Stornobedingungen vom Vertrag zurücktreten.",
            "Zahlungen an den Anbieter außerhalb der Plattform nehmen wir nicht entgegen und können sie nicht nachvollziehen; sie fallen nicht unter unsere Zahlungsabwicklung — siehe [Gebühren außerhalb der Plattform](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Änderungen, Stornierungen und Rückerstattungen",
          paragraphs: [
            "Ob und zu welchen Bedingungen eine Buchung kostenfrei storniert oder geändert werden kann, richtet sich nach den im Angebot ausgewiesenen Stornobedingungen des Anbieters. Die Bedingungen, die wir Anbietern zur Auswahl stellen, sind unter [Stornierungsbedingungen](https://mybestdays.dk/rechtliches/stornierungsbedingungen) beschrieben.",
            "Bei Beherbergungsleistungen, die für einen bestimmten Zeitraum gebucht werden, besteht nach Artikel 16 Buchstabe l der Richtlinie 2011/83/EU bzw. den entsprechenden nationalen Vorschriften in der Regel kein gesetzliches Widerrufsrecht. Zwingende gesetzliche Rechte bleiben unberührt.",
            "Storniert der Anbieter, erstatten wir den über die Plattform gezahlten Betrag vollständig. Zusätzlich greift die [Umbuchungs- und Rückerstattungsrichtlinie](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Verhindert ein Ereignis außerhalb der Kontrolle beider Seiten die Reise oder den Aufenthalt, gilt die [Richtlinie für schwerwiegende Beeinträchtigungen](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Rückerstattungen erfolgen auf das für die Zahlung verwendete Zahlungsmittel, sofern nichts anderes vereinbart ist.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Was Sie außerdem wissen müssen",
          paragraphs: [
            "Anbieter können private Gastgeber oder Unternehmer sein. Ob ein Anbieter als Unternehmer auftritt, weisen wir im Angebot aus. Handelt es sich nicht um einen Unternehmer, gelten die Verbraucherschutzvorschriften der Union für den Beherbergungsvertrag nicht — auf diesen Umstand weisen wir Sie im Angebot hin.",
            "Angaben zu Lage, Umgebung, Entfernungen und Bewertungen Dritter dienen der Orientierung. Verbindlich sind die Angaben zur gebuchten Leistung selbst.",
            "In Gebieten mit Registrierungspflicht für die Kurzzeitvermietung nennen wir die vom Anbieter angegebene Registrierungsnummer im Angebot; siehe [Kurzzeitvermietung](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Bei mehreren identischen Einheiten eines Objekt- oder Zimmertyps buchen Sie eine Einheit dieses Typs. Welche konkrete Einheit Sie erhalten, bestimmt der Anbieter.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Lexikon",
      paragraphs: [
        "Die folgenden Begriffe haben in diesen Bedingungen die hier genannte Bedeutung.",
      ],
      definitions: [
        {
          term: "Anbieter",
          description:
            "Die natürliche oder juristische Person, die eine Unterkunft über die Plattform anbietet und Vertragspartner des Beherbergungsvertrags wird.",
        },
        {
          term: "Anfragebuchung",
          description:
            "Eine Buchung, die erst nach ausdrücklicher Annahme durch den Anbieter zustande kommt, im Unterschied zur Sofortbuchung.",
        },
        {
          term: "Buchungsbestätigung",
          description:
            "Die Nachricht, mit der wir Ihnen den Abschluss des Beherbergungsvertrags bestätigen; sie enthält Anbieter, Leistung, Zeitraum, Gesamtpreis und Stornobedingungen.",
        },
        {
          term: "Einheit",
          description:
            "Das konkrete buchbare Objekt unterhalb eines Objekt- oder Zimmertyps. Verkauft wird die Einheit, beschrieben und bepreist wird der Typ.",
        },
        {
          term: "Gesamtpreis",
          description:
            "Der beim Abschluss der Buchung ausgewiesene Betrag einschließlich aller Steuern und aller über die Plattform abgerechneten Gebühren.",
        },
        {
          term: "Höchstbelegung",
          description:
            "Die im Angebot ausgewiesene größte zulässige Anzahl von Personen, die in der Unterkunft übernachten dürfen.",
        },
        {
          term: "Kaution",
          description:
            "Ein Betrag, den der Anbieter als Sicherheit für Schäden verlangt und der vorautorisiert oder eingezogen und nach dem Aufenthalt freigegeben oder verrechnet wird.",
        },
        {
          term: "Kurtaxe",
          description:
            "Eine ortsbezogene Abgabe für Übernachtungen, die je nach Gemeinde vor Ort oder über den Anbieter erhoben wird; sie ist keine Leistung von myBestDays.",
        },
        {
          term: "Plattform",
          description:
            "Die Website, die mobilen Anwendungen und alle sonstigen Zugänge, über die myBestDays Unterkünfte anzeigt und Buchungen vermittelt.",
        },
        {
          term: "Servicegebühr",
          description:
            "Das Entgelt für die Vermittlungsleistung von myBestDays. Wer sie trägt und wie sie ausgewiesen wird, steht in den Angaben zu Servicegebühren.",
        },
        {
          term: "Stornobedingungen",
          description:
            "Die vom Anbieter gewählten Regeln dazu, bis wann und zu welchen Kosten eine Buchung storniert oder geändert werden kann.",
        },
        {
          term: "Unterkunft",
          description:
            "Die vom Anbieter angebotene Beherbergungsleistung — ein Ferienobjekt oder eine Einheit eines Zimmer- bzw. Objekttyps.",
        },
        {
          term: "Vor-Ort-Kosten",
          description:
            "Beträge, die nicht über die Plattform abgerechnet, sondern beim Anbieter fällig werden, etwa Kurtaxe, Kaution oder vor Ort gebuchte Zusatzleistungen.",
        },
      ],
    },
  ],
};
