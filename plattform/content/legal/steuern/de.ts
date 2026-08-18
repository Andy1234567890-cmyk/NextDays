import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Steuerrichtlinie",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Seite erklärt, welche Steuern und Abgaben bei einer Buchung über myBestDays anfallen können, wer sie schuldet und welche Meldepflichten uns als Plattformbetreiber treffen.",
    "Sie ist keine Steuerberatung. Für Ihre steuerliche Behandlung im Einzelfall wenden Sie sich an eine steuerberatende Person.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Was Gäste betrifft",
      paragraphs: [
        "Der angezeigte Gesamtpreis enthält die Steuern, die über die Plattform abgerechnet werden — insbesondere die Umsatzsteuer auf die Beherbergungsleistung, soweit der Anbieter sie schuldet.",
        "Ortsbezogene Abgaben wie Kurtaxe, Bettensteuer oder Tourismusabgabe werden je nach Gemeinde entweder über die Plattform abgerechnet oder vor Ort erhoben. Welcher Fall gilt, weisen wir vor Abschluss der Buchung aus.",
        "Eine Rechnung über die Beherbergungsleistung stellt der Anbieter aus; er ist der leistende Unternehmer. Benötigen Sie eine Rechnung mit Umsatzsteuerausweis, fordern Sie sie beim Anbieter an.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Was Anbieter betrifft",
      paragraphs: [
        "Anbieter sind für die zutreffende steuerliche Behandlung ihrer Einkünfte selbst verantwortlich — Einkommen- oder Körperschaftsteuer, Umsatzsteuer und ortsbezogene Abgaben.",
        "Ob eine Vermietung umsatzsteuerpflichtig ist und welcher Satz gilt, richtet sich nach dem Recht des Staates, in dem die Unterkunft liegt (Ort der Leistung bei Grundstücken).",
        "Anbieter tragen die für ihre Unterkunft geltenden Abgaben im Objekt ein, damit sie im Angebot richtig ausgewiesen werden.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Meldung an die Steuerbehörden (DAC7)",
      paragraphs: [
        "Als Betreiber einer digitalen Plattform sind wir nach der Richtlinie (EU) 2021/514 („DAC7“) und den sie umsetzenden nationalen Vorschriften verpflichtet, Angaben zu meldepflichtigen Anbietern und deren über die Plattform erzielten Vergütungen jährlich an die zuständige Steuerbehörde zu melden.",
        "Gemeldet werden insbesondere Name, Anschrift, Steueridentifikationsnummer, Geburtsdatum oder Registernummer, Kontoangaben für die Auszahlung, Anschrift der Unterkunft und die je Quartal gezahlten Vergütungen sowie einbehaltene Gebühren.",
        "Anbieter erhalten eine Kopie der sie betreffenden gemeldeten Daten.",
        "Stellt ein Anbieter die für die Meldung erforderlichen Angaben trotz zweifacher Aufforderung nicht bereit, sind wir verpflichtet, Auszahlungen zurückzuhalten und das Konto zu sperren.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Einbehalte",
      paragraphs: [
        "Verpflichtet uns das Recht eines Staates, von einer Auszahlung Steuern einzubehalten und abzuführen, tun wir das und weisen den Einbehalt in der Abrechnung aus.",
      ],
    },
  ],
};
