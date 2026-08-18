import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Gebühren außerhalb der Plattform",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Richtlinie regelt, welche Beträge ein Anbieter außerhalb der Plattform verlangen darf und welche nicht. Sie schützt Gäste davor, vor Ort mit Forderungen konfrontiert zu werden, die im Angebot nicht standen.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Grundsatz",
      paragraphs: [
        "Alles, was für die gebuchte Leistung zu zahlen ist, muss vor Abschluss der Buchung im Angebot ausgewiesen sein — entweder als Bestandteil des Gesamtpreises oder als Vor-Ort-Kostenposition.",
        "Ein Betrag, der weder im Gesamtpreis noch als Vor-Ort-Kosten ausgewiesen war, ist vom Gast nicht geschuldet.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Was vor Ort verlangt werden darf",
      paragraphs: ["Vor Ort dürfen ausschließlich verlangt werden:"],
      list: [
        "Beträge, die im Angebot ausdrücklich als Vor-Ort-Kosten ausgewiesen sind (etwa Endreinigung, Wäschepaket, Stellplatz);",
        "ortsbezogene Abgaben wie die Kurtaxe, soweit sie nach den örtlichen Vorschriften vor Ort zu entrichten ist;",
        "eine im Angebot ausgewiesene Kaution;",
        "Leistungen, die der Gast erst vor Ort und freiwillig hinzubucht, zu einem vorher genannten Preis;",
        "der Ersatz nachgewiesener Schäden, die der Gast verursacht hat.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Was nicht verlangt werden darf",
      paragraphs: ["Unzulässig ist insbesondere:"],
      list: [
        "eine Nachforderung auf den Übernachtungspreis nach Abschluss der Buchung;",
        "eine Gebühr dafür, dass die Buchung über myBestDays erfolgt ist;",
        "eine Bearbeitungs-, Buchungs- oder Kartengebühr, die im Angebot nicht ausgewiesen war;",
        "die Aufforderung, die Buchung zu stornieren und dieselbe Unterkunft außerhalb der Plattform erneut zu buchen;",
        "die Aufforderung, den Preis oder einen Teil davon per Überweisung, Bargeld oder Zahlungsdienst außerhalb der Plattform zu begleichen, wenn das Angebot Zahlung über die Plattform vorsieht.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Umgehung der Plattform",
      paragraphs: [
        "Kam der Kontakt zwischen Gast und Anbieter über die Plattform zustande, darf die Buchung nicht an der Plattform vorbei abgewickelt werden. Das gilt für beide Seiten.",
        "Wer die Plattform umgeht, verliert deren Schutz: Zahlungen sind nicht abgesichert, unsere Stornierungs- und Rückerstattungsrichtlinien greifen nicht, und wir können im Streitfall nicht vermitteln.",
        "Verstöße können zur Sperrung des Kontos führen. Bei Anbietern können wir zusätzlich die entgangene Servicegebühr geltend machen.",
      ],
    },
    {
      id: "melden",
      heading: "5. Melden",
      paragraphs: [
        "Wird von Ihnen vor Ort ein Betrag verlangt, der nicht im Angebot stand, zahlen Sie ihn nicht und melden Sie es uns über die Kontaktwege unter [Beschwerden und Streitbeilegung](https://mybestdays.dk/rechtliches/beschwerden). Haben Sie bereits gezahlt, helfen wir bei der Rückforderung.",
      ],
    },
  ],
};
