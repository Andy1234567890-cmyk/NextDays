import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Legal Notice",
  stand: "Last updated: 18 August 2026",
  intro: [
    `Provider details for the myBestDays marketplace. The operator is ${ANBIETER.firma}; myBestDays is a brand of that company and not a separate legal entity.`,
    "Mandatory information under section 7 of the Danish E-handelslov, which implements Article 5 of Directive 2000/31/EC on electronic commerce, together with the information required by Articles 11 and 12 of Regulation (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Operator of the Platform",
      paragraphs: [
        `${ANBIETER.firma} — a private limited company (Anpartsselskab, ApS) under Danish law`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Denmark`,
        `Authorised management: ${ANBIETER.direktion.join(" and ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Contact",
      paragraphs: [
        `Email: ${ANBIETER.email}`,
        `Telephone: ${ANBIETER.telefon}`,
        "For matters relating to an existing booking, use the messaging function in your account — the booking and the message history are then already before us; see [Complaints and dispute resolution](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Register and VAT",
      paragraphs: [
        `CVR no. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Denmark.`,
        ...(ANBIETER.ustId
          ? [`VAT identification number: ${ANBIETER.ustId}.`]
          : [
              "There is currently no VAT identification number; section 7 of the E-handelslov requires it to be stated only where a VAT registration exists.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Points of contact under Regulation (EU) 2022/2065",
      paragraphs: [
        `Single point of contact for authorities under Article 11 and for users under Article 12: ${ANBIETER.email}, by post at the address given above.`,
        "The languages of communication are German, Danish and English.",
        "The procedures under that Regulation — reporting illegal content, statements of reasons, complaint handling — are described under [Digital Services Act](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Competent authorities",
      paragraphs: [
        `Digital Services Coordinator under Article 49 of Regulation (EU) 2022/2065: ${DSA_KOORDINATOR.name}, Denmark ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Data protection supervisory authority: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Denmark, ${AUFSICHTSBEHOERDE.email}.`,
        "Brokering accommodation services requires no special authorisation in Denmark; there is therefore no professional supervisory authority.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Consumer dispute resolution",
      paragraphs: [
        "The European Commission's online dispute resolution platform was repealed by Regulation (EU) 2024/3228 and has ceased operating.",
        "We are not obliged and not willing to take part in dispute resolution proceedings before a consumer arbitration body.",
        `Independently of that, as a consumer you can turn to the competent Danish body: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Denmark ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). If you live in another Member State, the European Consumer Centre in your country can help.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Notes on content and links",
      paragraphs: [
        "Listing content comes from the respective providers. myBestDays does not adopt it as its own; see Section A4 of the [Terms of Service](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "The operator of a linked third-party site is responsible for its content. Once we become aware of an infringement we remove the link without delay.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Copyright",
      paragraphs: [
        `Our own content, texts, graphics and marks published on this Platform are protected by copyright and trade mark law. Any use outside the cases permitted by law requires the prior written consent of ${ANBIETER.firma}; for marks the [Trademark Guidelines](https://mybestdays.dk/rechtliches/markenzeichen) apply.`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Applicable law",
      paragraphs: [
        `${ANBIETER.firma} has its seat in Denmark and is established there only. Danish law therefore applies to this online offering — including to the English version (country-of-origin principle under Article 3 of Directive 2000/31/EC). Mandatory consumer protection provisions of your country of residence are unaffected.`,
      ],
    },
  ],
};
