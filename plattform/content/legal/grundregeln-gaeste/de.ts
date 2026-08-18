import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Grundregeln für Gäste",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Grundregeln gelten für jeden Aufenthalt, der über myBestDays gebucht wurde. Sie ergänzen die Hausordnung des jeweiligen Anbieters — bei strengeren Hausregeln gelten diese zusätzlich.",
    "Wer gegen die Grundregeln verstößt, muss mit Maßnahmen bis zur Sperrung des Kontos rechnen und haftet dem Anbieter gegenüber für entstandene Schäden.",
  ],
  sections: [
    {
      id: "belegung",
      heading: "1. Belegung",
      paragraphs: [
        "In der Unterkunft übernachten nur die Personen, die bei der Buchung angegeben wurden, und höchstens so viele, wie die Höchstbelegung erlaubt.",
        "Besuch, der nicht übernachtet, ist zulässig, soweit die Hausordnung nichts anderes bestimmt.",
        "Die Unterkunft darf nicht untervermietet oder weitergegeben werden.",
      ],
    },
    {
      id: "ruhe",
      heading: "2. Rücksicht und Ruhezeiten",
      paragraphs: [
        "Nehmen Sie auf Nachbarn Rücksicht. Halten Sie die in der Hausordnung genannten Ruhezeiten ein; fehlt eine Angabe, gilt die ortsübliche Nachtruhe.",
        "Partys und Veranstaltungen sind ohne ausdrückliche Erlaubnis des Anbieters nicht gestattet. Das gilt auch dann, wenn die Höchstbelegung eingehalten wird.",
        "Gewerbliche Nutzung der Unterkunft — etwa Foto- oder Filmproduktionen, Verkaufsveranstaltungen — bedarf der vorherigen Zustimmung des Anbieters.",
      ],
    },
    {
      id: "umgang",
      heading: "3. Umgang mit der Unterkunft",
      paragraphs: [
        "Behandeln Sie die Unterkunft und ihre Einrichtung pfleglich und hinterlassen Sie sie in einem ordentlichen Zustand.",
        "Melden Sie Schäden und Störungen dem Anbieter unverzüglich — nicht erst nach der Abreise. Nur so kann er sie beheben und Sie behalten Ihre Ansprüche.",
        "Sie haften für Schäden, die Sie oder Ihre Mitreisenden verursachen. Ist eine Kaution vereinbart, kann sie dafür in Anspruch genommen werden.",
      ],
    },
    {
      id: "sicherheit",
      heading: "4. Sicherheit",
      paragraphs: [
        "Halten Sie Rauchmelder, Feuerlöscher und Fluchtwege frei und funktionsfähig. Rauchmelder dürfen nicht abgeklebt oder entfernt werden.",
        "Rauchen ist nur erlaubt, wenn die Hausordnung es ausdrücklich gestattet, und nur in den dafür ausgewiesenen Bereichen.",
        "Bei Pool, Sauna, Kamin, Grill oder Whirlpool folgen Sie den Hinweisen des Anbieters. Kinder dürfen solche Einrichtungen nur unter Aufsicht nutzen.",
      ],
    },
    {
      id: "tiere",
      heading: "5. Tiere",
      paragraphs: [
        "Tiere dürfen Sie nur mitbringen, wenn das Angebot es erlaubt und Sie sie bei der Buchung angegeben haben.",
        "Assistenz- und Blindenführhunde sind stets erlaubt, auch wenn das Angebot Tiere ausschließt. Bitte kündigen Sie sie an, damit der Anbieter vorbereitet ist.",
      ],
    },
    {
      id: "anreise",
      heading: "6. An- und Abreise",
      paragraphs: [
        "Halten Sie die im Angebot genannten An- und Abreisezeiten ein. Brauchen Sie davon abweichende Zeiten, stimmen Sie diese vorher mit dem Anbieter ab.",
        "Stellen Sie die Angaben, die der Anbieter zur Anmeldung benötigt (Meldeschein, Ausweisdaten, Kurtaxe), rechtzeitig bereit.",
        "Zugangsdaten, Schlüsselcodes und Schlüssel geben Sie nicht an Dritte weiter.",
      ],
    },
    {
      id: "kommunikation",
      heading: "7. Kommunikation",
      paragraphs: [
        "Führen Sie Buchung, Zahlung und Absprachen über die Plattform. Nur dann sind sie belegt und wir können im Streitfall helfen.",
        "Bleiben Sie gegenüber dem Anbieter und unserem Team sachlich. Beleidigungen und Drohungen führen unmittelbar zu Maßnahmen gegen das Konto.",
      ],
    },
  ],
};
