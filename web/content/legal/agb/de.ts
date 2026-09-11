import type { LegalDoc } from "../types";

// DE ist die Quell-/Referenzfassung: Alle anderen 23 Sprachfassungen werden aus
// dieser Datei übersetzt. Inhaltliche Änderungen IMMER zuerst hier, dann in
// allen Sprachen nachziehen. § 5 enthält die von Stripe für Custom-Plattformen
// vorgeschriebene Klausel (Stripe Connected Account Agreement) — Wortlaut an
// Stripes offiziellen Empfehlungstext angelehnt, URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Allgemeine Geschäftsbedingungen (AGB) für Agenturen und Vermieter",
  stand: "Stand: 11. September 2026",
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
        "Jedes vom Nutzer in der Plattform angelegte Objekt wird zugleich auf dem plattformeigenen Marktplatz myBestDays gelistet (Pflichtkanal). Der Nutzer kann diesen Kanal nicht einzeln abwählen; er kann ein Objekt jedoch jederzeit über die Funktion „Verkauf pausieren“ bei allen Kanälen gleichzeitig aus dem Verkauf nehmen oder es löschen. Sichtbar wird ein Objekt auf myBestDays erst, wenn der Nutzer es veröffentlicht hat und myNextDays das Inserat freigegeben hat; myNextDays kann die Freigabe aus sachlichem Grund verweigern oder widerrufen. Für Buchungen über myBestDays gilt das Entgelt nach § 7.",
      ],
      list: [
        "Verwaltung von Objekten, Belegungskalendern und Reservierungen (Property-Management-System),",
        "Anbindung an Buchungskanäle Dritter (z. B. Booking.com, Airbnb) über einen Channel-Manager,",
        "Veröffentlichung von Angeboten über den plattformeigenen Marktplatz myBestDays (Pflichtkanal, siehe Absatz 2),",
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
        "Zusatzleistungen, die der Nutzer seinen Gästen über die Plattform in Rechnung stellt (z. B. Reinigung, Wäsche, Transfer, Frühstück), werden unmittelbar auf dem Zahlungskonto des Nutzers vereinnahmt; der Nutzer ist auch insoweit Zahlungsempfänger und Erbringer der Leistung. Für die Bereitstellung und Abwicklung dieses Zahlungswegs behält myNextDays den in der jeweils gültigen Preisliste ausgewiesenen Anteil ein (derzeit 5 %). Bemessungsgrundlage ist der Nettobetrag der Zusatzleistung ohne die vom Nutzer geschuldete Umsatzsteuer. Der Anteil wird bei der Zahlung einbehalten und dem Nutzer vor dem Erstellen des Zahlungslinks betragsmäßig angezeigt. Die Entgelte des Zahlungsdienstleisters für die jeweilige Transaktion trägt der Nutzer.",
        "Bei Buchungen, die über das myNextDays-Buchungsportal zustande kommen, wird die Zahlung über myNextDays abgewickelt. myNextDays behält hierbei die in der jeweils gültigen Preisliste ausgewiesene Vermittlungsprovision einschließlich der Kosten der Zahlungsabwicklung ein und leitet den verbleibenden Betrag nach Maßgabe der nachstehenden Absätze an den Nutzer weiter. Das Entgelt für die Softwarenutzung (§ 7) bleibt hiervon unberührt.",
        "Auszahlungen erfolgen auf das vom Nutzer hinterlegte Bankkonto. Den Rhythmus wählt der Nutzer in seinem Konto selbst: täglich, wöchentlich, monatlich oder ausschließlich auf eigenen Antrag. Die Umstellung wirkt für künftige Auszahlungen. Auszahlbar ist ein Guthaben erst nach Ablauf der Abwicklungsfrist des Zahlungsdienstleisters; bis dahin wird es als ausstehend ausgewiesen. myNextDays kann den Rhythmus aus Risikogründen anpassen, insbesondere bei neuen Konten, auffälligen Transaktionsmustern oder laufenden Prüfungen, und informiert den Nutzer darüber.",
        "Rückerstattungen an Gäste trägt wirtschaftlich der Nutzer. Rückbelastungen (Chargebacks) und daraus entstehende Gebühren trägt bei Buchungen über die eigene Buchungsstrecke des Nutzers sowie über angebundene Vertriebsportale der Nutzer, da er insoweit Zahlungsempfänger ist; bei Buchungen über das myNextDays-Buchungsportal trägt myNextDays das Rückbelastungsrisiko, soweit die Rückbelastung nicht auf einer Pflichtverletzung des Nutzers beruht (insbesondere Nichterbringung oder erhebliche Abweichung der Beherbergungsleistung). myNextDays ist berechtigt, vom Nutzer zu tragende Beträge mit künftigen Auszahlungen zu verrechnen.",
        "Entsteht auf dem Zahlungskonto des Nutzers ein negativer Saldo, hat der Nutzer diesen unverzüglich auszugleichen. Der Nutzer ermächtigt myNextDays und Stripe, negative Salden vom hinterlegten Bankkonto einzuziehen, soweit dies rechtlich zulässig ist.",
      ],
    },
    {
      heading: "§ 7 Entgelte und Abrechnung",
      paragraphs: [
        "Die Entgelte für die Nutzung der Plattform ergeben sich aus der bei Vertragsschluss vereinbarten Preisliste bzw. dem individuellen Angebot. Alle Preise verstehen sich zuzüglich der jeweils gesetzlich anfallenden Steuern und in der im Vertrag ausgewiesenen Währung.",
        "Transaktionsabhängige Entgelte (z. B. Zahlungs- oder Kanalgebühren sowie der Anteil an über die Plattform kassierten Zusatzleistungen nach § 6) können unmittelbar bei der Abwicklung der jeweiligen Transaktion einbehalten oder verrechnet werden. Sie sind in der Preisliste ausgewiesen; eine Änderung wird nach § 17 angekündigt.",
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
      heading: "§ 12 Einsatz künstlicher Intelligenz",
      paragraphs: [
        "myNextDays setzt in einzelnen Funktionen KI-Systeme ein, insbesondere für Preisempfehlungen (Dynamic Pricing), für Antwortvorschläge im Nachrichten-Posteingang und für die Unterstützung im Support. Diese Funktionen erzeugen Vorschläge; Entscheidung und Verantwortung für deren Verwendung liegen beim Nutzer. Preisempfehlungen ersetzen keine eigene kaufmännische Prüfung.",
        "Innerhalb der Plattform antwortet kein KI-System selbsttätig an Gäste oder an den Nutzer: Jede von einer KI erzeugte Nachricht wird einem Menschen zur Prüfung vorgelegt, der sie ändern und absenden kann oder nicht. Der Support gegenüber dem Nutzer wird von Menschen geführt. Davon zu unterscheiden ist der Produktberater auf unserer Website: Er beantwortet Fragen von Interessenten zum Leistungsumfang unmittelbar und ohne menschliche Freigabe, ist kein Bestandteil der Plattform und nicht Gegenstand dieses Vertrages. Auskünfte dieses Beraters begründen keine Zusicherung einer Eigenschaft und gehen den Regelungen dieser AGB und der jeweils aktuellen Leistungsbeschreibung nicht vor; maßgeblich ist § 2. Einzelheiten zur Datenverarbeitung stehen in unseren Datenschutzinformationen.",
        "Interagiert eine natürliche Person unmittelbar mit einem KI-System, wird ihr dies offengelegt (Artikel 50 Absatz 1 der Verordnung (EU) 2024/1689 — „KI-Verordnung“); beim Produktberater auf unserer Website geschieht das zu Beginn des Dialogs. Texte, die ein KI-System erzeugt oder wesentlich verändert hat und die der Nutzer an Gäste weitergibt, hat der Nutzer kenntlich zu machen, soweit ihn hierzu eine gesetzliche Pflicht trifft.",
        "myNextDays betreibt keine KI-Systeme, die nach Anhang III der KI-Verordnung als Hochrisiko-Systeme gelten, und keine nach Artikel 5 der KI-Verordnung verbotenen Praktiken. Eingaben des Nutzers und Daten seiner Gäste werden ohne gesonderten Auftrag nicht zum Training von Modellen verwendet.",
        "Der Nutzer darf die KI-Funktionen nicht dazu verwenden, Gästen gegenüber den Anschein einer menschlichen Kommunikation zu erwecken, wo eine Offenlegungspflicht besteht, oder rechtlich verbindliche Erklärungen ohne eigene Prüfung abzugeben.",
        "Verbindet der Nutzer sein Konto über die dafür vorgesehene Schnittstelle mit einem eigenen KI-Assistenten (etwa Claude von Anthropic), gilt Folgendes: Der Nutzer schließt den Vertrag über diesen Dienst selbst ab und ist für dessen Einsatz verantwortlich. Die Verbindung ist seine Weisung an myNextDays, die freigegebenen Daten dorthin herauszugeben — einschließlich einer Übermittlung in ein Drittland, wenn der Anbieter außerhalb der Europäischen Union sitzt. Der Nutzer stellt sicher, dass er dafür eine Rechtsgrundlage hat, dass seine eigenen Datenschutzinformationen den Empfänger ausweisen und dass die erforderlichen Garantien der Übermittlung vorliegen.",
        "Für eine solche Verbindung setzt der Nutzer einen Zugang ein, für den der Anbieter eine Auftragsverarbeitung anbietet und eine Verwendung der Daten zum Training von Modellen ausschließt — bei Claude sind das die Geschäftskunden-Zugänge (Team, Enterprise oder API). Zugänge für private Nutzung erfüllen das regelmäßig nicht; für Gästedaten sind sie deshalb ungeeignet. myNextDays kann nicht erkennen, welchen Zugang der Nutzer verwendet, und weist hierauf im Zustimmungsdialog hin.",
        "Der Nutzer beachtet dabei, dass Inhalte, die er aus der Oberfläche heraus von Hand in ein Eingabefeld des Assistenten kopiert, von den vertraglichen Beschränkungen des Anbieters regelmäßig nicht erfasst werden — anders als die über die Schnittstelle abgerufenen Daten.",
        "Daten, die aus einem Buchungsportal stammen, verwendet der Nutzer auch über die Schnittstelle nur zur Abwicklung und Betreuung der jeweiligen Buchung — nicht zur Bewertung von Personen, zur Profilbildung oder für Werbung. Die Portale geben diese Zweckbindung in ihren eigenen Bedingungen vor.",
      ],
    },
    {
      heading: "§ 13 Beschwerden und Mediation",
      paragraphs: [
        "myNextDays unterhält für gewerbliche Nutzer ein kostenloses internes Beschwerdemanagement (Artikel 11 der Verordnung (EU) 2019/1150 — „P2B-Verordnung“). Beschwerden — insbesondere zu behaupteten Verstößen gegen diese AGB, zu technischen Problemen mit erheblicher Auswirkung oder zu Maßnahmen von myNextDays gegenüber dem Nutzer — können formlos an info@mynextdays.dk oder über den Support in der Anwendung eingereicht werden. Der Eingang wird bestätigt; die Bearbeitung erfolgt zügig und in angemessener Frist, bei einfach gelagerten Fällen in der Regel innerhalb von 14 Tagen. Das Ergebnis wird dem Nutzer in klarer Sprache mitgeteilt.",
        "Kommt es im Beschwerdeverfahren zu keiner Einigung, ist myNextDays bereit, sich mit dem Nutzer außergerichtlich an folgende Mediatoren zu wenden (Artikel 12 der P2B-Verordnung): (1) WIPO Arbitration and Mediation Center, 34 chemin des Colombettes, 1211 Genf 20, Schweiz — Verfahren auch aus der Ferne und mehrsprachig; (2) Voldgiftsinstituttet — Danish Institute of Arbitration, Kronprinsessegade 28, 1306 Kopenhagen K, Dänemark — Sitzstaat der Anbieterin.",
        "Die Benennung verpflichtet den Nutzer nicht, ein Mediationsverfahren durchzuführen; das Recht, ein Gericht anzurufen, bleibt unberührt. An den angemessenen Kosten einer Mediation beteiligt sich myNextDays; die Aufteilung richtet sich nach der Ordnung des jeweiligen Mediators und den Umständen des Einzelfalls.",
        "myNextDays veröffentlicht jährlich Angaben zum Beschwerdeaufkommen, zur Bearbeitungsdauer und zu den ergriffenen Maßnahmen.",
      ],
    },
    {
      heading: "§ 14 Geistiges Eigentum",
      paragraphs: [
        "Alle Rechte an der Plattform, ihrer Software und ihren Inhalten (mit Ausnahme der vom Nutzer eingestellten Inhalte) stehen myNextDays bzw. deren Lizenzgebern zu. Der Nutzer erhält für die Vertragslaufzeit ein einfaches, nicht übertragbares Recht zur Nutzung der Plattform im vertraglich vereinbarten Umfang.",
        "An den vom Nutzer eingestellten Inhalten räumt der Nutzer myNextDays die für den Betrieb der Plattform erforderlichen einfachen Nutzungsrechte ein (insbesondere zur Speicherung, Vervielfältigung, Anzeige und Übermittlung an angebundene Kanäle).",
      ],
    },
    {
      heading: "§ 15 Haftung",
      paragraphs: [
        "myNextDays haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung von Leben, Körper oder Gesundheit.",
        "Bei einfacher Fahrlässigkeit haftet myNextDays nur für die Verletzung wesentlicher Vertragspflichten (Kardinalpflichten), begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Die Haftung nach dem Produkthaftungsgesetz sowie aus übernommenen Garantien bleibt unberührt.",
        "Für den Verlust von Daten haftet myNextDays nur in dem Umfang, in dem der Schaden auch bei ordnungsgemäßer, regelmäßiger Datensicherung durch den Nutzer eingetreten wäre, soweit die Datensicherung nicht vertraglich myNextDays obliegt.",
      ],
    },
    {
      heading: "§ 16 Laufzeit, Kündigung und Sperrung",
      paragraphs: [
        "Laufzeit und Kündigungsfristen ergeben sich aus dem jeweiligen Vertrag. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.",
        "myNextDays kann den Zugang zur Plattform oder einzelne Funktionen (einschließlich Zahlungsannahme und Auszahlungen) vorübergehend sperren, wenn konkrete Anhaltspunkte für einen Verstoß gegen diese AGB, für Betrug oder für eine missbräuchliche Nutzung bestehen, oder wenn myNextDays hierzu gesetzlich oder durch Anordnung eines Zahlungsdienstleisters verpflichtet ist. Der Nutzer wird über die Sperrung informiert, soweit dies rechtlich zulässig ist.",
        "Nach Vertragsende stellt myNextDays dem Nutzer seine Daten auf Anforderung innerhalb von 30 Tagen in einem gängigen Format zum Export bereit; danach werden die Daten gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.",
      ],
    },
    {
      heading: "§ 17 Änderungen dieser AGB",
      paragraphs: [
        "myNextDays kann diese AGB mit Wirkung für die Zukunft ändern, soweit dies aus triftigen Gründen erforderlich ist (insbesondere Gesetzesänderungen, Änderungen der Rechtsprechung oder Anforderungen von Zahlungsdienstleistern) und der Nutzer dadurch nicht unangemessen benachteiligt wird.",
        "Änderungen werden dem Nutzer mindestens sechs Wochen vor Inkrafttreten in Textform angekündigt. Widerspricht der Nutzer nicht innerhalb der Ankündigungsfrist oder nutzt er die Plattform nach Inkrafttreten weiter, gelten die geänderten AGB als angenommen; auf diese Folge wird in der Ankündigung gesondert hingewiesen.",
      ],
    },
    {
      heading: "§ 18 Schlussbestimmungen",
      paragraphs: [
        "Es gilt das Recht des Staates, in dem die Anbieterin ihren Sitz hat, unter Ausschluss des UN-Kaufrechts. Zwingende Vorschriften des Staates, in dem der Nutzer seinen Sitz hat, bleiben unberührt.",
        "Ausschließlicher Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit diesem Vertrag ist — soweit gesetzlich zulässig — der Sitz der Anbieterin.",
        "Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
      ],
    },
  ],
};
