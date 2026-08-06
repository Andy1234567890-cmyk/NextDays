// KOPIE aus web/content/legal/agb/de.ts — bewusst dupliziert, weil die
// Apps isoliert gebaut werden (ADR-0016): der Docker-Kontext dieser App
// enthält web/ nicht. Inhaltliche Änderungen IMMER in beiden Dateien.
// Zusätzlich zur web-Fassung: slug/metaDescription/numbered/toc für den
// Renderer dieser App.
import type { LegalDoc } from "../types";

// DE ist die Quell-/Referenzfassung: Alle anderen 23 Sprachfassungen werden aus
// dieser Datei übersetzt. Inhaltliche Änderungen IMMER zuerst hier, dann in
// allen Sprachen nachziehen. § 5 enthält die von Stripe für Custom-Plattformen
// vorgeschriebene Klausel (Stripe Connected Account Agreement) — Wortlaut an
// Stripes offiziellen Empfehlungstext angelehnt, URLs nicht verändern.
export const agb: LegalDoc = {
  slug: "agb",
  metaDescription:
    "Allgemeine Geschäftsbedingungen für die Nutzung der Plattform myNextDays durch Agenturen und Vermieter.",
  numbered: false,
  toc: true,
  title: "Allgemeine Geschäftsbedingungen (AGB) für Agenturen und Vermieter",
  stand: "Stand: 30. Juli 2026",
  intro: [
    "Diese Allgemeinen Geschäftsbedingungen (nachfolgend „AGB“) regeln die Nutzung der Software-Plattform myNextDays (nachfolgend „Plattform“) durch Agenturen, Vermieter, Hausverwaltungen und sonstige gewerbliche Nutzer (nachfolgend „Nutzer“).",
    "Anbieterin der Plattform ist myNextDays ApS, ein Anpartsselskab (ApS) dänischen Rechts, Hirtshalsvej 21, 9881 Bindslev, Dänemark, eingetragen im dänischen Centrale Virksomhedsregister (CVR) unter CVR-nr. 46615182 (nachfolgend „myNextDays“ oder „wir“).",
    "Die Plattform richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB bzw. der entsprechenden Vorschriften des jeweiligen EU-Mitgliedstaats. Sie richtet sich nicht an Verbraucher.",
  ],
  sections: [
    {
      heading: "§ 1 Geltungsbereich",
      paragraphs: [
        "Diese AGB gelten für sämtliche Verträge über die Nutzung der Plattform zwischen myNextDays und dem Nutzer sowie für alle darüber bereitgestellten Leistungen und Module.",
        "Abweichende, entgegenstehende oder ergänzende Geschäftsbedingungen des Nutzers werden nur dann Vertragsbestandteil, wenn myNextDays ihrer Geltung ausdrücklich in Textform zugestimmt hat.",
      ],
    },
    {
      heading: "§ 2 Vertragsgegenstand und Leistungen",
      paragraphs: [
        "myNextDays stellt dem Nutzer eine cloudbasierte Software zur Verwaltung von Ferienunterkünften und Beherbergungsbetrieben bereit. Der Funktionsumfang ergibt sich aus der jeweils aktuellen Leistungsbeschreibung und umfasst insbesondere:",
      ],
      list: [
        "Verwaltung von Objekten, Belegungskalendern und Reservierungen (Property-Management-System),",
        "Anbindung an Buchungskanäle Dritter (z. B. Booking.com, Airbnb) über einen Channel-Manager,",
        "Veröffentlichung von Angeboten über den plattformeigenen Buchungskanal myNextDays,",
        "Erstellung eigener Websites über den integrierten Page-Builder,",
        "Buchhaltungs-, Abrechnungs- und Auswertungsfunktionen einschließlich Eigentümerabrechnungen,",
        "Kommunikation mit Gästen sowie Annahme von Zahlungen über die integrierte Zahlungsabwicklung (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registrierung, Konto und Angaben des Nutzers",
      paragraphs: [
        "Die Nutzung der Plattform setzt die Registrierung eines Kontos voraus. Der Nutzer ist verpflichtet, bei der Registrierung und während der gesamten Vertragslaufzeit richtige, aktuelle und vollständige Angaben zu seiner Person und seinem Unternehmen zu machen und diese bei Änderungen unverzüglich zu aktualisieren.",
        "Zugangsdaten sind geheim zu halten und vor dem Zugriff Dritter zu schützen. Der Nutzer hat myNextDays unverzüglich zu informieren, wenn es Anhaltspunkte für eine missbräuchliche Nutzung seines Kontos gibt.",
        "Ein Konto ist nicht übertragbar. Der Nutzer stellt sicher, dass alle Personen, die das Konto für ihn nutzen, diese AGB einhalten.",
      ],
    },
    {
      heading: "§ 4 Rolle von myNextDays bei Buchungen",
      paragraphs: [
        "Beherbergungsverträge über die auf der Plattform, über angebundene Drittkanäle oder über die eigene Website des Nutzers angebotenen Unterkünfte kommen ausschließlich zwischen dem Nutzer (bzw. dem von ihm vertretenen Eigentümer) und dem jeweiligen Gast zustande. myNextDays wird nicht Vertragspartei des Beherbergungsvertrags.",
        "Für die Richtigkeit und Rechtmäßigkeit der Angebotsinhalte (Beschreibungen, Fotos, Preise, Verfügbarkeiten, Steuern und Abgaben) ist allein der Nutzer verantwortlich.",
      ],
    },
    {
      heading: "§ 5 Zahlungsabwicklung durch Stripe",
      paragraphs: [
        "Die Zahlungsabwicklungsdienste für Agenturen und Vermieter auf myNextDays werden von Stripe erbracht und unterliegen dem [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), das die Stripe-Nutzungsbedingungen einschließt (zusammen der „Stripe-Rahmenvertrag“). Durch die Zustimmung zu diesen AGB oder die fortgesetzte Tätigkeit als Agentur oder Vermieter auf myNextDays erklärt sich der Nutzer an den Stripe-Rahmenvertrag gebunden, der von Stripe von Zeit zu Zeit geändert werden kann.",
        "Voraussetzung dafür, dass myNextDays Zahlungsabwicklungsdienste über Stripe ermöglicht, ist, dass der Nutzer myNextDays richtige und vollständige Informationen über sich und sein Unternehmen zur Verfügung stellt. Der Nutzer ermächtigt myNextDays, diese Informationen sowie Transaktionsdaten, die mit der Nutzung der von Stripe bereitgestellten Zahlungsabwicklungsdienste zusammenhängen, an Stripe weiterzugeben.",
        "Maßgeblich für das Rechtsverhältnis zu Stripe ist der verlinkte englischsprachige Vertragstext in seiner jeweils gültigen Fassung. Vertragspartner für Nutzer im Europäischen Wirtschaftsraum ist die im Stripe-Rahmenvertrag benannte Stripe-Gesellschaft (derzeit Stripe Payments Europe, Limited, Irland). Stripe verarbeitet personenbezogene Daten gemäß der [Stripe-Datenschutzerklärung](https://stripe.com/privacy).",
        "Zur Erfüllung gesetzlicher Identifizierungs- und Prüfpflichten (u. a. Geldwäscheprävention, „Know Your Customer“) können myNextDays und Stripe jederzeit weitere Angaben und Nachweise verlangen, insbesondere Identitätsdokumente, Angaben zu wirtschaftlich Berechtigten und zur Bankverbindung. Werden angeforderte Angaben oder Nachweise nicht innerhalb der gesetzten Frist bereitgestellt, können Zahlungsannahme oder Auszahlungen ganz oder teilweise ausgesetzt werden, bis die Angaben vollständig vorliegen.",
      ],
    },
    {
      heading: "§ 6 Auszahlungen, Rückbelastungen und negative Salden",
      paragraphs: [
        "Der Zahlungsweg richtet sich nach dem Buchungskanal. Bei Buchungen über die eigene Buchungsstrecke des Nutzers sowie bei Buchungen über angebundene Vertriebsportale werden die Zahlungen der Gäste unmittelbar auf dem Zahlungskonto des Nutzers vereinnahmt; der Nutzer ist insoweit gegenüber dem Gast Zahlungsempfänger und Vertragspartner der Beherbergungsleistung (§ 4), und myNextDays wird zu keinem Zeitpunkt Inhaber dieser Gelder. Auf solche Buchungen erhebt myNextDays keine prozentuale Buchungsgebühr; die Provision für Buchungen über angebundene Vertriebsportale wird gesondert ausgewiesen und nachträglich in Rechnung gestellt.",
        "Bei Buchungen, die über das myNextDays-Buchungsportal zustande kommen, wird die Zahlung über myNextDays abgewickelt. myNextDays behält hierbei die in der jeweils gültigen Preisliste ausgewiesene Vermittlungsprovision einschließlich der Kosten der Zahlungsabwicklung ein und leitet den verbleibenden Betrag nach Maßgabe der nachstehenden Absätze an den Nutzer weiter. Das Entgelt für die Softwarenutzung (§ 7) bleibt hiervon unberührt.",
        "Auszahlungen erfolgen auf das vom Nutzer hinterlegte Bankkonto. myNextDays kann den Auszahlungsrhythmus aus Risikogründen anpassen, insbesondere bei neuen Konten, auffälligen Transaktionsmustern oder laufenden Prüfungen.",
        "Rückerstattungen an Gäste trägt wirtschaftlich der Nutzer. Rückbelastungen (Chargebacks) und daraus entstehende Gebühren trägt bei Buchungen über die eigene Buchungsstrecke des Nutzers sowie über angebundene Vertriebsportale der Nutzer, da er insoweit Zahlungsempfänger ist; bei Buchungen über das myNextDays-Buchungsportal trägt myNextDays das Rückbelastungsrisiko, soweit die Rückbelastung nicht auf einer Pflichtverletzung des Nutzers beruht (insbesondere Nichterbringung oder erhebliche Abweichung der Beherbergungsleistung). myNextDays ist berechtigt, vom Nutzer zu tragende Beträge mit künftigen Auszahlungen zu verrechnen.",
        "Entsteht auf dem Zahlungskonto des Nutzers ein negativer Saldo, hat der Nutzer diesen unverzüglich auszugleichen. Der Nutzer ermächtigt myNextDays und Stripe, negative Salden vom hinterlegten Bankkonto einzuziehen, soweit dies rechtlich zulässig ist.",
      ],
    },
    {
      heading: "§ 7 Entgelte und Abrechnung",
      paragraphs: [
        "Die Entgelte für die Nutzung der Plattform ergeben sich aus der bei Vertragsschluss vereinbarten Preisliste bzw. dem individuellen Angebot. Alle Preise verstehen sich zuzüglich der jeweils gesetzlich anfallenden Steuern und in der im Vertrag ausgewiesenen Währung.",
        "Transaktionsabhängige Entgelte (z. B. Zahlungs- oder Kanalgebühren) können unmittelbar bei der Abwicklung der jeweiligen Transaktion einbehalten oder verrechnet werden.",
        "Gerät der Nutzer mit Zahlungen in Verzug, kann myNextDays den Zugang zur Plattform nach vorheriger Ankündigung bis zum Ausgleich der offenen Forderungen sperren.",
      ],
    },
    {
      heading: "§ 8 Pflichten des Nutzers; eigene Rechtstexte",
      paragraphs: [
        "Der Nutzer stellt sicher, dass seine Angebote, Inhalte und Geschäftspraktiken den jeweils anwendbaren Gesetzen entsprechen, insbesondere dem Beherbergungs-, Melde-, Steuer- und Verbraucherschutzrecht am Ort der Unterkunft. Erforderliche Genehmigungen, Registrierungen und Lizenzen hält der Nutzer auf eigene Verantwortung vor.",
        "Für Websites, die der Nutzer über den Page-Builder betreibt, sowie für seine Angebote auf der Plattform ist der Nutzer selbst verantwortlich; dazu gehören insbesondere eigene Gäste-AGB, ein eigenes Impressum und eigene Datenschutzinformationen.",
        "Untersagt sind insbesondere: das Einstellen unrichtiger oder irreführender Angebote, die Abwicklung von Scheingeschäften oder betrügerischen Transaktionen, die Umgehung der Zahlungsabwicklung nach § 5 für über die Plattform zustande gekommene Buchungen sowie jede Nutzung, die die Sicherheit oder Verfügbarkeit der Plattform beeinträchtigt.",
      ],
    },
    {
      heading: "§ 9 Buchungskanäle Dritter",
      paragraphs: [
        "Bei der Anbindung von Drittkanälen (z. B. Booking.com, Airbnb) gelten zusätzlich die Bedingungen des jeweiligen Kanalbetreibers. Der Nutzer schließt die hierfür erforderlichen Verträge mit dem Kanalbetreiber selbst ab.",
        "myNextDays übernimmt die technische Synchronisation von Verfügbarkeiten, Preisen und Buchungsdaten, hat jedoch keinen Einfluss auf Inhalte, Provisionen oder Entscheidungen der Kanalbetreiber und haftet nicht für deren Verfügbarkeit.",
      ],
    },
    {
      heading: "§ 10 Verfügbarkeit und Weiterentwicklung",
      paragraphs: [
        "myNextDays erbringt die Leistungen mit der Sorgfalt eines ordentlichen Kaufmanns und strebt eine hohe Verfügbarkeit der Plattform an. Wartungsfenster, Weiterentwicklungen und Umstände außerhalb des Einflussbereichs von myNextDays (z. B. Störungen bei Drittanbietern) können die Verfügbarkeit vorübergehend einschränken.",
        "myNextDays darf die Plattform weiterentwickeln und Funktionen ändern, soweit der Vertragszweck dadurch nicht gefährdet wird und die Änderung für den Nutzer zumutbar ist.",
      ],
    },
    {
      heading: "§ 11 Daten und Datenschutz",
      paragraphs: [
        "Soweit myNextDays bei der Bereitstellung der Plattform personenbezogene Daten im Auftrag des Nutzers verarbeitet (insbesondere Gästedaten), schließen die Parteien eine Vereinbarung zur Auftragsverarbeitung nach Art. 28 DSGVO.",
        "Der Nutzer bleibt für die datenschutzrechtliche Zulässigkeit der Erhebung und Verarbeitung der von ihm eingebrachten Daten verantwortlich. Einzelheiten zur Datenverarbeitung durch myNextDays ergeben sich aus den Datenschutzinformationen der Plattform; für die Datenverarbeitung durch Stripe gilt § 5.",
      ],
    },
    {
      heading: "§ 12 Geistiges Eigentum",
      paragraphs: [
        "Alle Rechte an der Plattform, ihrer Software und ihren Inhalten (mit Ausnahme der vom Nutzer eingestellten Inhalte) stehen myNextDays bzw. deren Lizenzgebern zu. Der Nutzer erhält für die Vertragslaufzeit ein einfaches, nicht übertragbares Recht zur Nutzung der Plattform im vertraglich vereinbarten Umfang.",
        "An den vom Nutzer eingestellten Inhalten räumt der Nutzer myNextDays die für den Betrieb der Plattform erforderlichen einfachen Nutzungsrechte ein (insbesondere zur Speicherung, Vervielfältigung, Anzeige und Übermittlung an angebundene Kanäle).",
      ],
    },
    {
      heading: "§ 13 Haftung",
      paragraphs: [
        "myNextDays haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung von Leben, Körper oder Gesundheit.",
        "Bei einfacher Fahrlässigkeit haftet myNextDays nur für die Verletzung wesentlicher Vertragspflichten (Kardinalpflichten), begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Die Haftung nach dem Produkthaftungsgesetz sowie aus übernommenen Garantien bleibt unberührt.",
        "Für den Verlust von Daten haftet myNextDays nur in dem Umfang, in dem der Schaden auch bei ordnungsgemäßer, regelmäßiger Datensicherung durch den Nutzer eingetreten wäre, soweit die Datensicherung nicht vertraglich myNextDays obliegt.",
      ],
    },
    {
      heading: "§ 14 Laufzeit, Kündigung und Sperrung",
      paragraphs: [
        "Laufzeit und Kündigungsfristen ergeben sich aus dem jeweiligen Vertrag. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.",
        "myNextDays kann den Zugang zur Plattform oder einzelne Funktionen (einschließlich Zahlungsannahme und Auszahlungen) vorübergehend sperren, wenn konkrete Anhaltspunkte für einen Verstoß gegen diese AGB, für Betrug oder für eine missbräuchliche Nutzung bestehen, oder wenn myNextDays hierzu gesetzlich oder durch Anordnung eines Zahlungsdienstleisters verpflichtet ist. Der Nutzer wird über die Sperrung informiert, soweit dies rechtlich zulässig ist.",
        "Nach Vertragsende stellt myNextDays dem Nutzer seine Daten auf Anforderung innerhalb von 30 Tagen in einem gängigen Format zum Export bereit; danach werden die Daten gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.",
      ],
    },
    {
      heading: "§ 15 Änderungen dieser AGB",
      paragraphs: [
        "myNextDays kann diese AGB mit Wirkung für die Zukunft ändern, soweit dies aus triftigen Gründen erforderlich ist (insbesondere Gesetzesänderungen, Änderungen der Rechtsprechung oder Anforderungen von Zahlungsdienstleistern) und der Nutzer dadurch nicht unangemessen benachteiligt wird.",
        "Änderungen werden dem Nutzer mindestens sechs Wochen vor Inkrafttreten in Textform angekündigt. Widerspricht der Nutzer nicht innerhalb der Ankündigungsfrist oder nutzt er die Plattform nach Inkrafttreten weiter, gelten die geänderten AGB als angenommen; auf diese Folge wird in der Ankündigung gesondert hingewiesen.",
      ],
    },
    {
      heading: "§ 16 Schlussbestimmungen",
      paragraphs: [
        "Es gilt das Recht des Staates, in dem die Anbieterin ihren Sitz hat, unter Ausschluss des UN-Kaufrechts. Zwingende Vorschriften des Staates, in dem der Nutzer seinen Sitz hat, bleiben unberührt.",
        "Ausschließlicher Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit diesem Vertrag ist — soweit gesetzlich zulässig — der Sitz der Anbieterin.",
        "Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
      ],
    },
  ],
};
