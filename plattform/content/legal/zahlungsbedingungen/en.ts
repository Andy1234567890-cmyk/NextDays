import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Payment Terms",
  stand: "Last updated: 18 August 2026",
  intro: [
    "These Payment Terms govern how payments relating to a booking via myBestDays are processed. They supplement the [Terms of Service for Guests](https://mybestdays.dk/rechtliches/nutzungsbedingungen); in the event of conflict on payment matters, these Payment Terms prevail.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Our role in payment",
      paragraphs: [
        "myBestDays processes payments on behalf of the provider. We are not a payment institution or an electronic money institution; the payment service itself is provided by our payment service provider.",
        "Payments via the Platform are processed by Stripe (Stripe Payments Europe, Limited). Card data and other payment data are collected and processed directly by Stripe. myBestDays does not store full card details.",
        "Where you pay via the Platform, your payment obligation towards the provider is discharged in the amount paid as soon as the payment has been successfully authorised and collected by our payment service provider.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Payment methods",
      paragraphs: [
        "Which payment methods are available depends on the listing, on the provider's country and on your country. The available methods are shown before the booking is completed.",
        "Certain payment methods require strong customer authentication under Directive (EU) 2015/2366. Without successful authentication the payment cannot be executed.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Due dates, deposit and balance",
      paragraphs: [
        "The provider determines in the listing which amount falls due when. Three models are common: full payment at booking; a deposit at booking with the balance before arrival; or payment on site to the provider.",
        "The model applicable to your booking and the due dates are shown before the booking is completed and repeated in the booking confirmation.",
        "Before the balance falls due we send a reminder to the email address you provided. If the balance is not paid, the provider may withdraw from the contract in accordance with its cancellation terms.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Currency",
      paragraphs: [
        "Settlement is in the currency of the listing. That currency is shown with every price and at checkout.",
        "Where an amount is additionally shown in another currency, that is a non-binding conversion for guidance and not a binding price.",
        "If your payment service provider converts into another currency or charges a foreign transaction fee, you bear those costs. They are not part of the total price and are neither set nor collected by us.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Security deposit",
      paragraphs: [
        "Where the listing provides for a security deposit, its amount is shown before the booking is completed.",
        "Depending on the listing, the deposit is pre-authorised on your payment method (the amount is reserved but not debited) or collected. A pre-authorisation may temporarily reduce your available card limit.",
        "After the stay the pre-authorisation is released or the deposit collected is refunded, unless the provider asserts damage. If the provider asserts damage, it must substantiate it; whether the claim is justified is a matter between you and the provider.",
        "Where the provider instead requires the deposit on site, it is an on-site cost item and is not processed via the Platform.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Refunds",
      paragraphs: [
        "Refunds are made to the payment method used, unless otherwise agreed or technically impossible.",
        "We initiate a refund without delay once the ground for it is established. How long the credit takes to appear on your account or card is determined by your payment service provider; five to ten banking days is usual.",
        "Whether and to what extent a refund is due is governed by the [Cancellation Terms](https://mybestdays.dk/rechtliches/stornierungsbedingungen) and the [Rebooking and Refund Policy](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Failed payments and chargebacks",
      paragraphs: [
        "If a payment fails we will inform you and give you the opportunity to provide another payment method. If payment is not made, the booking may be cancelled.",
        "If you charge back a payment already executed without being entitled to a refund, the provider may still claim the amount. Costs we incur through an unjustified chargeback may be invoiced to you.",
        "If we consider a payment fraudulent we may withhold it or cancel the booking. We will inform you and give reasons for the decision.",
      ],
    },
    {
      id: "belege",
      heading: "8. Receipts and statements",
      paragraphs: [
        "For amounts paid via the Platform we make a receipt available, which you can retrieve in your account under “Bookings”.",
        "An invoice for the accommodation service is issued by the provider, which is the supplying trader. On taxes see the [Tax Policy](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Amendments to these Payment Terms",
      paragraphs: [
        "Section A22 of the [Terms of Service](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen) applies to amendments to these Payment Terms.",
      ],
    },
  ],
};
