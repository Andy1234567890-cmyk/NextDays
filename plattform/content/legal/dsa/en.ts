import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Digital Services Act",
  stand: "Last updated: 18 August 2026",
  intro: [
    "myBestDays is an intermediary service and an online platform within the meaning of Regulation (EU) 2022/2065 on a Single Market for Digital Services (the “Digital Services Act”, DSA). This page brings together the information and procedures that Regulation requires.",
    "myBestDays is not a very large online platform within the meaning of Article 33 of the Regulation. The additional obligations applicable to those — systemic risk assessment, independent audit, advertisement repository and publication of monthly user numbers in the procedure provided for there — therefore do not apply to us.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Points of contact (Articles 11 and 12)",
      paragraphs: [
        `Single point of contact for Member State authorities, the Commission and the European Board for Digital Services: ${ANBIETER.email}, by post ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Denmark.`,
        `Single point of contact for users: ${ANBIETER.email}. You reach us there directly and without an automated intermediary step.`,
        "Both points of contact can be addressed in German, Danish and English.",
        "No legal representative in the Union under Article 13 needs to be designated: the operator is established in Denmark and therefore in the Union.",
        `Competent Digital Services Coordinator under Article 49: ${DSA_KOORDINATOR.name}, Denmark ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Reporting illegal content (Article 16)",
      paragraphs: [
        "Anyone may report content to us that they consider illegal. Use the reporting function available on every listing, review and message, or the point of contact for users.",
        "So that we can assess a notice without a detailed legal examination, it should contain:",
      ],
      list: [
        "a sufficiently substantiated explanation of why the content is illegal;",
        "the exact electronic location, in particular the URL;",
        "the name and email address of the person submitting the notice — except for notices concerning offences against the sexual self-determination of children, where this is voluntary;",
        "a statement that the information is accurate and complete to the best of the submitter's knowledge.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. How we handle notices",
      paragraphs: [
        "We confirm receipt without delay and decide in a timely, diligent, non-arbitrary and objective manner.",
        "Where a notice contains the information set out in section 2, it gives us knowledge within the meaning of Article 6 of the Regulation.",
        "We inform the person submitting the notice of our decision and of the redress available.",
        "Where a notice is handled by automated means, we say so.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Statements of reasons (Article 17)",
      paragraphs: [
        "Where we restrict the visibility of content, remove it, disable access to it, suspend payments, suspend the provision of the service or suspend the account, the person concerned receives a clear and specific statement of reasons.",
        "The statement sets out the nature and extent of the measure, its territorial and temporal scope, the facts and circumstances of the decision, whether automated processing was involved, the legal basis or the contractual provision breached, and the redress available.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Suspicion of criminal offences (Article 18)",
      paragraphs: [
        "Where there are indications of a criminal offence involving a threat to the life or safety of a person, we inform the competent law enforcement or judicial authorities without delay.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Internal complaint-handling system (Article 20)",
      paragraphs: [
        "A complaint may be lodged free of charge within six months against any measure under section 4 and against the rejection of a notice.",
        "Complaints are handled in a timely, non-discriminatory and diligent manner — under the supervision of qualified staff and not solely by automated means.",
        "If a complaint proves well founded, we reverse the measure. The route is described under [Complaints and dispute resolution](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Out-of-court dispute settlement (Article 21)",
      paragraphs: [
        "For disputes about measures under section 4, users may turn to an out-of-court dispute settlement body certified by the competent Digital Services Coordinator. The European Commission maintains the list of certified bodies.",
        "The decisions of those bodies are not binding on us; we are not obliged to participate in proceedings of independent providers. Recourse to the courts is unaffected.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Trusted flaggers (Article 22)",
      paragraphs: [
        "Notices submitted by a flagger recognised as a trusted flagger within its field of expertise are given priority.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Measures against misuse (Article 23)",
      paragraphs: [
        "Accounts through which manifestly illegal content is frequently provided are suspended for a reasonable period after a prior warning.",
        "We suspend the handling of notices and complaints from persons who frequently submit manifestly unfounded notices or complaints — likewise after a prior warning.",
        "In doing so we always assess the individual case: the number, proportion and gravity of the items concerned and the intention behind them.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Transparency reports (Articles 15 and 24)",
      paragraphs: [
        "We publish an annual report on content moderation: the number of orders from authorities, the number and type of notices, the measures taken, the number of complaints and their outcome, information on the use of automated means, and the number of disputes before out-of-court bodies.",
        `Micro and small enterprises are exempt from some of these obligations under Article 19 of the Regulation. While the exemption applies, we make the information available on request at ${ANBIETER.email}; once the first report is published it will be linked here.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Traceability of traders (Articles 30 to 32)",
      paragraphs: [
        "Providers acting in a commercial capacity on the Platform may not offer until they have supplied us with their name, address, telephone number, email address, register details, VAT identification number and payment account, and their information is plausible.",
        "We display that information in the listing to the extent the Regulation so provides.",
        "If we learn that a listing concerned an illegal product or service, we inform the guests concerned where we have their contact details.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Recommender systems (Article 27)",
      paragraphs: [
        "The main parameters of the search result order and of recommendations, and the option to influence them, are described under [Prices, ranking and recommendations](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Advertising (Article 26)",
      paragraphs: [
        "We currently display no paid third-party advertising and no paid placements in search results.",
        "Should we introduce advertising, we will label it clearly, name the advertiser and state the main parameters of its delivery. We exclude advertising based on special categories of personal data under Article 9 of Regulation (EU) 2016/679 and advertising to minors based on profiling.",
      ],
    },
  ],
};
