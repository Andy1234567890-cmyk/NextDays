import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Richtlinien für Behörden- und Strafverfolgungsanfragen",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Richtlinien richten sich an Behörden, Gerichte und Strafverfolgungsstellen, die von myBestDays Daten verlangen oder eine Anordnung gegen Inhalte richten. Sie sind hier öffentlich, damit auch Nutzer nachlesen können, unter welchen Voraussetzungen wir Daten herausgeben.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Grundsatz",
      paragraphs: [
        "Wir geben Nutzerdaten nur heraus, wenn eine gültige Rechtsgrundlage besteht und die Anfrage die formalen Anforderungen erfüllt. Eine formlose Bitte um Daten genügt nicht.",
        "Wir prüfen jede Anfrage auf Zuständigkeit, Rechtsgrundlage, Bestimmtheit und Verhältnismäßigkeit und geben nur die Daten heraus, die die Anfrage bezeichnet.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Anforderungen an eine Anfrage",
      paragraphs: ["Eine Anfrage sollte enthalten:"],
      list: [
        "die anfragende Stelle, das Aktenzeichen und die Kontaktdaten der bearbeitenden Person auf amtlichem Briefkopf;",
        "die Rechtsgrundlage nach nationalem Recht oder Unionsrecht;",
        "eine genaue Bezeichnung der betroffenen Person oder des betroffenen Kontos — E-Mail-Adresse, Buchungsnummer oder Angebots-URL;",
        "die genau bezeichneten Daten und den Zeitraum;",
        "gegebenenfalls die Anordnung eines Gerichts, soweit das anwendbare Recht sie verlangt;",
        "einen Hinweis, falls die Unterrichtung der betroffenen Person die Ermittlungen gefährden würde, mit Angabe der Rechtsgrundlage.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Anordnungen nach der Verordnung (EU) 2022/2065",
      paragraphs: [
        "Anordnungen zum Vorgehen gegen rechtswidrige Inhalte (Artikel 9) und Anordnungen zur Bereitstellung von Informationen (Artikel 10) müssen die dort genannten Angaben enthalten, insbesondere die Rechtsgrundlage, die genaue elektronische Fundstelle, die Begründung, die Rechtsbehelfe und die Sprache.",
        "Wir bestätigen den Eingang und teilen der anordnenden Behörde mit, welche Maßnahmen wir ergriffen haben und wann.",
        "Über eine Anordnung informieren wir die betroffene Person spätestens zum Zeitpunkt der Umsetzung, sofern die Behörde nicht unter Angabe der Rechtsgrundlage einen Aufschub anordnet.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Notfälle",
      paragraphs: [
        "Besteht eine unmittelbare Gefahr für Leben oder körperliche Unversehrtheit, geben wir die zur Abwehr erforderlichen Daten auch ohne vorherige förmliche Anordnung heraus. Kennzeichnen Sie eine solche Anfrage ausdrücklich als Notfall und beschreiben Sie die Gefahr.",
        "Bestehen Anhaltspunkte für eine Straftat, die eine Gefahr für das Leben oder die Sicherheit einer Person begründet, unterrichten wir von uns aus die zuständigen Behörden (Artikel 18 der Verordnung (EU) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Welche Daten wir vorhalten",
      paragraphs: [
        "Welche Datenkategorien wir verarbeiten und wie lange wir sie speichern, steht in der [Datenschutzerklärung](https://mybestdays.dk/rechtliches/datenschutz). Über die dort genannten Fristen hinaus halten wir keine Daten vor.",
        "Eine Vorratsspeicherung über den Bedarf hinaus findet nicht statt. Eine Aufforderung, Daten für ein laufendes Verfahren vorübergehend zu sichern, setzen wir im rechtlich zulässigen Rahmen um.",
        "Vollständige Zahlungsdaten liegen uns nicht vor; sie sind beim Zahlungsdienstleister zu erfragen.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Unterrichtung der betroffenen Person",
      paragraphs: [
        "Wir unterrichten betroffene Nutzer über eine Anfrage, die ihre Daten betrifft, es sei denn, eine Rechtsvorschrift oder eine begründete behördliche Anordnung untersagt es oder es besteht eine unmittelbare Gefahr für Leben oder körperliche Unversehrtheit.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Wohin Anfragen zu richten sind",
      paragraphs: [
        "Anfragen richten Sie an die zentrale Kontaktstelle für Behörden, die unter [Gesetz über digitale Dienste](https://mybestdays.dk/rechtliches/dsa) genannt ist. Wir bearbeiten sie in deutscher und englischer Sprache.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparenz",
      paragraphs: [
        "Zahl und Art der behördlichen Anordnungen weisen wir in unserem jährlichen Transparenzbericht aus; siehe [Gesetz über digitale Dienste](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
