import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Erklärung zur Barrierefreiheit",
  stand: "Stand: 18. August 2026",
  intro: [
    "myBestDays soll für alle nutzbar sein. Diese Erklärung beschreibt den Stand der Barrierefreiheit der Plattform, bekannte Einschränkungen und den Weg, uns Barrieren zu melden.",
    "Sie bezieht sich auf die Anforderungen der Richtlinie (EU) 2019/882 über die Barrierefreiheitsanforderungen für Produkte und Dienstleistungen, die seit dem 28. Juni 2025 für Dienstleistungen des elektronischen Geschäftsverkehrs gilt.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Stand der Barrierefreiheit",
      paragraphs: [
        "Wir orientieren uns an der harmonisierten Norm EN 301 549 und den ihr zugrunde liegenden Web Content Accessibility Guidelines (WCAG) 2.1 auf Konformitätsstufe AA.",
        "Umgesetzt sind unter anderem: durchgängige Bedienbarkeit mit der Tastatur, sichtbarer Fokus, semantische Überschriftenstruktur, Beschriftungen an allen Formularfeldern, Textalternativen für Bedienelemente, ausreichende Farbkontraste, Skalierbarkeit des Textes ohne Verlust von Inhalt sowie eine Darstellung, die sich an die Bildschirmgröße anpasst.",
        "Die Rechtstexte sind in allen 24 Amtssprachen der Union abrufbar und mit korrekter Sprachauszeichnung versehen, damit Screenreader sie richtig vorlesen.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Bekannte Einschränkungen",
      paragraphs: [
        "Nicht barrierefrei sind derzeit insbesondere:",
      ],
      list: [
        "Fotos und Beschreibungen in Angeboten stammen von Anbietern; Textalternativen zu Fotos können fehlen oder unzureichend sein. Wir fordern Anbieter dazu auf, sie zu ergänzen.",
        "Eingebettete Kartendarstellungen Dritter sind nur eingeschränkt mit der Tastatur bedienbar. Alle Standortangaben stehen zusätzlich als Text zur Verfügung.",
        "Von Anbietern hochgeladene Dokumente (etwa Hausordnungen als PDF) sind nicht durchgängig barrierefrei ausgezeichnet.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Barrierefreiheit der Unterkünfte",
      paragraphs: [
        "Diese Erklärung betrifft die Plattform, nicht die Unterkünfte. Angaben zur baulichen Barrierefreiheit einer Unterkunft stammen vom Anbieter.",
        "Wenn Sie auf bestimmte Merkmale angewiesen sind — stufenloser Zugang, Türbreiten, bodengleiche Dusche, Aufzug —, klären Sie diese vor der Buchung über die Nachrichtenfunktion mit dem Anbieter ab. Unzutreffende Angaben zur Barrierefreiheit sind ein Verstoß gegen unsere Richtlinien und können gemeldet werden.",
      ],
    },
    {
      id: "melden",
      heading: "4. Barrieren melden",
      paragraphs: [
        `Stoßen Sie auf eine Barriere, melden Sie sie uns unter ${ANBIETER.email} oder über die Kontaktwege unter [Beschwerden und Streitbeilegung](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Beschreiben Sie bitte, welche Seite betroffen ist, was Sie tun wollten und welche Hilfsmittel Sie verwenden. Wir bestätigen den Eingang und teilen Ihnen mit, wie und bis wann wir die Barriere beheben.",
        "Benötigen Sie eine Information in einer zugänglichen Form, stellen wir sie Ihnen auf Anfrage bereit.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Durchsetzungsverfahren",
      paragraphs: [
        "Sind Sie mit unserer Antwort nicht zufrieden, können Sie sich an die für die Marktüberwachung nach der Richtlinie (EU) 2019/882 zuständige Stelle wenden.",
        "Erhvervsstyrelsen | Markedsovervågning (früher Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Dänemark",
        "Telefon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
