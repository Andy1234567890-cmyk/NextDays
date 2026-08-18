import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Non-discrimination Policy",
  stand: "Last updated: 18 August 2026",
  intro: [
    "myBestDays is open to everyone. Anyone who books or offers via the Platform must not treat anyone less favourably on account of personal characteristics.",
    "This policy forms part of the [Terms of Service](https://mybestdays.dk/rechtliches/nutzungsbedingungen) and applies to guests and providers alike.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principle",
      paragraphs: [
        "On myBestDays it is not permitted to disadvantage a person on account of their origin, colour, nationality, ethnicity, religion or belief, sex, gender identity, sexual orientation, disability, age or marital status.",
        "This applies to the acceptance or rejection of bookings, to prices and conditions, to conduct during the stay and to communication via the Platform.",
        "Article 20 of Regulation (EU) 2018/302 applies in addition: providers may not restrict access to their offer on account of a guest's nationality, place of residence or place of establishment within the Union.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. What this means for providers",
      paragraphs: ["As a provider you must not, in particular:"],
      list: [
        "reject a booking request on account of any of the characteristics listed;",
        "require different prices, deposits or conditions from guests because they have one of those characteristics;",
        "state in the listing or in messages that certain groups of people are unwelcome;",
        "refuse assistance or guide dogs, even where your house rules exclude animals;",
        "treat a guest differently because they reside in another Member State of the Union.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. What remains permitted",
      paragraphs: [
        "You may set a maximum occupancy, a minimum age for the lead booker and objective house rules (such as a smoking ban or quiet hours), provided they apply equally to all guests.",
        "If you live in the accommodation yourself and share living space with the guest, you may make that clear in the listing; the characteristics in section 1 nonetheless do not justify a rejection.",
        "You may reject a booking where there are concrete indications of a breach of the house rules or of fraud. The reason must relate to conduct, not to the person.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Accessibility",
      paragraphs: [
        "Information about the accessibility of an accommodation must be accurate. Describing an accommodation as accessible when it is not is also a breach of the [Content Policy](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Where an adjustment is possible without unreasonable effort, we expect providers to make it.",
      ],
    },
    {
      id: "melden",
      heading: "5. Reporting discrimination",
      paragraphs: [
        "If you have experienced or observed discrimination, report it to us using the reporting function or the contact routes under [Complaints and dispute resolution](https://mybestdays.dk/rechtliches/beschwerden).",
        "We review every report. Where a breach is confirmed we take measures up to permanent suspension of the account. If a booking was refused to you on that ground, we will help you find comparable accommodation.",
      ],
    },
  ],
};
