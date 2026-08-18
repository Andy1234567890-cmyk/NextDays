import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Guidelines for authority and law enforcement requests",
  stand: "Last updated: 18 August 2026",
  intro: [
    "These guidelines are addressed to authorities, courts and law enforcement bodies requesting data from myBestDays or issuing an order concerning content. They are published here so that users can also read under what conditions we disclose data.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principle",
      paragraphs: [
        "We disclose user data only where a valid legal basis exists and the request meets the formal requirements. An informal request for data is not sufficient.",
        "We examine every request for competence, legal basis, specificity and proportionality, and disclose only the data the request identifies.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Requirements for a request",
      paragraphs: ["A request should contain:"],
      list: [
        "the requesting body, the case reference and the contact details of the officer dealing with the matter, on official letterhead;",
        "the legal basis under national or Union law;",
        "a precise identification of the person or account concerned — email address, booking number or listing URL;",
        "the precisely identified data and the period concerned;",
        "where the applicable law so requires, a court order;",
        "an indication where notifying the person concerned would jeopardise the investigation, stating the legal basis.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Orders under Regulation (EU) 2022/2065",
      paragraphs: [
        "Orders to act against illegal content (Article 9) and orders to provide information (Article 10) must contain the information set out there, in particular the legal basis, the exact electronic location, the statement of reasons, the redress available and the language.",
        "We confirm receipt and inform the issuing authority of the measures we have taken and when.",
        "We inform the person concerned of an order at the latest at the time of implementation, unless the authority orders a deferral stating the legal basis.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Emergencies",
      paragraphs: [
        "Where there is an imminent threat to life or physical integrity, we disclose the data necessary to avert it even without a prior formal order. Please mark such a request expressly as an emergency and describe the threat.",
        "Where there are indications of a criminal offence involving a threat to the life or safety of a person, we inform the competent authorities on our own initiative (Article 18 of Regulation (EU) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. What data we hold",
      paragraphs: [
        "Which categories of data we process and how long we store them is set out in the [Privacy Policy](https://mybestdays.dk/rechtliches/datenschutz). We hold no data beyond the periods stated there.",
        "We do not retain data beyond what is needed. A request to preserve data temporarily for ongoing proceedings is implemented within the legally permissible scope.",
        "Full payment data are not held by us; they must be requested from the payment service provider.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Notifying the person concerned",
      paragraphs: [
        "We notify affected users of a request concerning their data, unless a legal provision or a reasoned official order prohibits it or there is an imminent threat to life or physical integrity.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Where to send requests",
      paragraphs: [
        "Send requests to the single point of contact for authorities set out under [Digital Services Act](https://mybestdays.dk/rechtliches/dsa). We handle them in German and English.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparency",
      paragraphs: [
        "We report the number and type of orders from authorities in our annual transparency report; see [Digital Services Act](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
