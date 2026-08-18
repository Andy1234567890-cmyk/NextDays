import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Prices, ranking and recommendations",
  stand: "Last updated: 18 August 2026",
  intro: [
    "This page explains how prices are displayed on myBestDays, what determines the order of search results and how recommendations are produced. It fulfils the transparency obligations under Article 6a of Directive 2005/29/EC, Article 5 of Regulation (EU) 2019/1150 and Article 27 of Regulation (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. How prices are displayed",
      paragraphs: [
        "As soon as the period and number of travellers are known, we display the total price for the whole stay, including taxes and all fees settled via the Platform.",
        "While no period has been selected we show a price per night as guidance and label it as such.",
        "Costs payable only on site are disclosed separately before the booking is completed. They are not part of the total price but are visible before booking.",
        "Where we show a struck-through comparison price, that is the lowest price the provider charged for the same service in the 30 days before the reduction (Article 6a of Directive 98/6/EC).",
        "Prices are the same for all guests. We do not adjust the price to your person, your device or your previous search behaviour.",
      ],
    },
    {
      id: "ranking",
      heading: "2. What determines the order of search results",
      paragraphs: [
        "In the default sorting the following factors determine the order, in descending importance:",
      ],
      list: [
        "match with your search — availability in the period sought, capacity for the number of travellers, location in the area sought and the filters set;",
        "completeness and quality of the listing — description, photos, maintained amenity details;",
        "reviews — overall rating and number of reviews;",
        "reliability of the provider — response behaviour, acceptance rate and cancellations by the provider;",
        "how up to date prices and availability are;",
        "value for money compared with similar listings in the same area.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Paid placement",
      paragraphs: [
        "A provider cannot buy a better position in the default sorting. The level of the service fee does not affect the order.",
        "Should we offer paid placements in future, we will label them unmistakably as advertising and separate them visibly from the other results.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Changing the sorting",
      paragraphs: [
        "You can change the sorting at any time, for example by price or rating. The active sorting is displayed above the result list.",
        "At least one sorting is available to you that is not based on profiling within the meaning of Article 4(4) of Regulation (EU) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Recommendations",
      paragraphs: [
        "Where we show you suggestions (“you might like”, “similar accommodation”), these are based on the current search, on listings viewed earlier and on features of similar accommodation.",
        "You can switch off personalised recommendations in your account. You will then see suggestions based solely on the current search.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Reviews in the ranking",
      paragraphs: [
        "How reviews are produced and verified is set out in the [Review Policy](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Reviews feed into the order, but we neither weight individual reviews more heavily nor suppress negative ones.",
      ],
    },
  ],
};
