import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kurzzeitvermietung und Registrierungspflichten",
  stand: "Stand: 18. August 2026",
  intro: [
    "In vielen Städten und Regionen ist die kurzfristige Vermietung von Wohnraum genehmigungs-, registrierungs- oder meldepflichtig. Diese Seite erklärt, was das für Anbieter und für Gäste bedeutet.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Rechtsrahmen",
      paragraphs: [
        "Die Verordnung (EU) 2024/1028 über die Erhebung und den Austausch von Daten im Zusammenhang mit Dienstleistungen der kurzfristigen Vermietung von Unterkünften schafft einen einheitlichen Rahmen: Wo ein Mitgliedstaat oder eine Gebietskörperschaft ein Registrierungsverfahren eingeführt hat, erhält jede Einheit eine Registrierungsnummer.",
        "Plattformen müssen diese Nummer anzeigen, ihre Gültigkeit stichprobenartig prüfen und den zuständigen Stellen in regelmäßigen Abständen Daten zur Tätigkeit übermitteln.",
        "Daneben gelten weiterhin nationale und örtliche Vorschriften — etwa zur Zweckentfremdung von Wohnraum, zu Höchstvermietungstagen, zum Brandschutz und zur Anmeldung von Gästen.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Was Anbieter tun müssen",
      paragraphs: [
        "Prüfen Sie vor der Veröffentlichung, ob für Ihre Unterkunft eine Registrierungs-, Genehmigungs- oder Anzeigepflicht besteht, und erfüllen Sie sie.",
        "Tragen Sie die Registrierungsnummer im Objekt ein, wenn eine besteht. Wir zeigen sie im Angebot an.",
        "Halten Sie Höchstvermietungstage und sonstige örtliche Grenzen ein. Diese zu überwachen ist Ihre Aufgabe, nicht unsere.",
        "Wir dürfen ein Angebot ohne die erforderliche Registrierungsnummer nicht dauerhaft anzeigen. Fehlt sie oder erweist sie sich als ungültig, fordern wir sie nach; bleibt die Angabe aus, deaktivieren wir das Angebot.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Was das für Gäste bedeutet",
      paragraphs: [
        "Besteht für eine Unterkunft eine Registrierungspflicht, sehen Sie die Registrierungsnummer im Angebot. Sie ist ein Hinweis darauf, dass die Vermietung bei der zuständigen Stelle angezeigt ist.",
        "Am Zielort kann eine Anmeldung erforderlich sein (Meldeschein, Ausweisdaten, Erklärung zur Kurtaxe). Der Anbieter fordert die nötigen Angaben an; stellen Sie sie rechtzeitig bereit.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Datenübermittlung an Behörden",
      paragraphs: [
        "Soweit die Verordnung (EU) 2024/1028 oder nationales Recht es vorsieht, übermitteln wir den zuständigen Stellen Daten zur Vermietungstätigkeit — insbesondere Registrierungsnummer, Anschrift der Einheit, Zahl der belegten Nächte und Zahl der Gäste.",
        "Diese Übermittlung erfolgt zur Erfüllung einer rechtlichen Verpflichtung nach Artikel 6 Absatz 1 Buchstabe c der Verordnung (EU) 2016/679. Einzelheiten stehen in der [Datenschutzerklärung](https://mybestdays.dk/rechtliches/datenschutz).",
        "Getrennt davon besteht die steuerliche Meldepflicht nach DAC7; siehe [Steuerrichtlinie](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Verstöße melden",
      paragraphs: [
        "Haben Sie Anhaltspunkte dafür, dass eine Unterkunft ohne die erforderliche Genehmigung oder Registrierung angeboten wird, melden Sie es uns über die Meldefunktion am Angebot. Wir gehen jeder Meldung nach.",
      ],
    },
  ],
};
