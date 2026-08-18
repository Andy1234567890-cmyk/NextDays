import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tax Policy",
  stand: "Last updated: 18 August 2026",
  intro: [
    "This page explains which taxes and levies may arise on a booking via myBestDays, who owes them and what reporting obligations apply to us as a platform operator.",
    "It is not tax advice. For your individual tax position please consult a tax adviser.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. What concerns guests",
      paragraphs: [
        "The total price displayed includes the taxes settled via the Platform — in particular VAT on the accommodation service where the provider owes it.",
        "Local levies such as tourist tax, bed tax or tourism levy are, depending on the municipality, either settled via the Platform or collected on site. We disclose which applies before the booking is completed.",
        "An invoice for the accommodation service is issued by the provider, which is the supplying trader. If you need an invoice showing VAT, request it from the provider.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. What concerns providers",
      paragraphs: [
        "Providers are themselves responsible for the correct tax treatment of their income — income or corporation tax, VAT and local levies.",
        "Whether a letting is subject to VAT and at what rate is governed by the law of the State in which the accommodation is located (place of supply for immovable property).",
        "Providers enter the levies applicable to their accommodation in the property record so that they are correctly disclosed in the listing.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Reporting to tax authorities (DAC7)",
      paragraphs: [
        "As the operator of a digital platform we are required under Directive (EU) 2021/514 (“DAC7”) and the national provisions implementing it to report annually to the competent tax authority information about reportable providers and the consideration they earn via the Platform.",
        "The information reported includes name, address, tax identification number, date of birth or registration number, payout account details, the address of the accommodation and the consideration paid per quarter as well as fees withheld.",
        "Providers receive a copy of the data reported about them.",
        "If a provider fails to supply the information required for the report despite two requests, we are required to withhold payouts and suspend the account.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Withholding",
      paragraphs: [
        "Where the law of a State requires us to withhold and remit tax from a payout, we do so and disclose the withholding in the statement.",
      ],
    },
  ],
};
