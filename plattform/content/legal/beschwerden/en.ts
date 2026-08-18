import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Complaints and dispute resolution",
  stand: "Last updated: 18 August 2026",
  intro: [
    "This page describes how to reach myBestDays, how we handle complaints and what routes are open to you if you disagree with our decision.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. How to reach us",
      paragraphs: [
        "The fastest way to reach us is through the Help Centre and the contact routes provided there. For an existing booking, use the messaging function in your account — the booking and the message history are then already before us.",
        `You can reach us in writing at ${ANBIETER.email} or ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Denmark; by telephone on ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. What your complaint should contain",
      paragraphs: ["So that we can help quickly, please state:"],
      list: [
        "your booking number and the email address used for the booking;",
        "a short description of the problem;",
        "the solution you would like;",
        "the supporting evidence — photos, messages, receipts, bank statements.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. How we handle complaints",
      paragraphs: [
        "Every complaint is recorded and given a case number under which you can track its status.",
        "We confirm receipt without delay and respond substantively as a rule within seven days. Where a longer examination is required we inform you of the interim position.",
        "Complaints where persons are at risk or an arrival is imminent are treated as a priority.",
        "We give reasons for our decision and state the basis on which it rests.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Complaining against a measure taken by us",
      paragraphs: [
        "Where we have removed content, restricted its visibility, cancelled a booking or suspended an account, you may complain against that free of charge within six months. This corresponds to Article 20 of Regulation (EU) 2022/2065.",
        "Complaints are examined by people, not solely by automated procedures. If a complaint proves well founded, we reverse the measure.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Out-of-court dispute resolution",
      paragraphs: [
        "The European Commission's online dispute resolution platform (ODR platform) was repealed by Regulation (EU) 2024/3228 and has ceased operating. Complaints can no longer be submitted through it.",
        "We are not obliged and not willing to take part in dispute resolution proceedings before a consumer arbitration body.",
        `Independently of that, as a consumer you can turn to the competent Danish body: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Denmark ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). If you live in another Member State, the European Consumer Centre in your country can help.`,
        "Where the dispute concerns a measure we have taken against your content or your account, you may in addition turn to an out-of-court dispute settlement body certified under Article 21 of Regulation (EU) 2022/2065. Their decisions are not binding on us, and we are not obliged to participate in such proceedings.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Court proceedings",
      paragraphs: [
        "The courts remain open to you at any time, including without a prior complaint procedure. Which courts have jurisdiction is set out in Section A19 of the [Terms of Service](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Complaints by providers",
      paragraphs: [
        "Providers may submit complaints about the application of these terms, about ranking decisions and about restrictions on their listing through the same procedure. This corresponds to Article 11 of Regulation (EU) 2019/1150.",
        "We report annually on the number, subject matter and average handling time of such complaints; the report is available under [Digital Services Act](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
