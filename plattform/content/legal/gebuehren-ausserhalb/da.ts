import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Gebyrer uden om platformen",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Denne politik regulerer, hvilke beløb en udbyder må kræve uden om platformen, og hvilke ikke. Den beskytter gæster mod at blive mødt med krav på stedet, som ikke stod i opslaget.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Grundsætning",
      paragraphs: [
        "Alt, der skal betales for den bookede ydelse, skal være oplyst i opslaget før gennemførelsen af bookingen — enten som en del af totalprisen eller som en omkostningspost på stedet.",
        "Et beløb, der hverken var oplyst i totalprisen eller som omkostning på stedet, skylder gæsten ikke.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Hvad der må kræves på stedet",
      paragraphs: ["På stedet må udelukkende kræves:"],
      list: [
        "beløb, der udtrykkeligt er oplyst i opslaget som omkostninger på stedet (f.eks. slutrengøring, linnedpakke, parkeringsplads);",
        "lokale afgifter som turistskat, for så vidt den efter de lokale regler skal betales på stedet;",
        "et depositum, der er oplyst i opslaget;",
        "ydelser, som gæsten først booker på stedet og frivilligt, til en på forhånd nævnt pris;",
        "erstatning for dokumenterede skader, som gæsten har forvoldt.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Hvad der ikke må kræves",
      paragraphs: ["Navnlig følgende er ikke tilladt:"],
      list: [
        "et efterkrav på overnatningsprisen efter gennemførelsen af bookingen;",
        "et gebyr for, at bookingen er sket via myBestDays;",
        "et ekspeditions-, bookings- eller kortgebyr, der ikke var oplyst i opslaget;",
        "opfordringen til at afbestille bookingen og booke samme indkvartering på ny uden om platformen;",
        "opfordringen til at betale prisen eller en del af den ved overførsel, kontant eller via en betalingstjeneste uden om platformen, når opslaget indeholder betaling via platformen.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Omgåelse af platformen",
      paragraphs: [
        "Er kontakten mellem gæst og udbyder opstået via platformen, må bookingen ikke afvikles uden om den. Det gælder for begge parter.",
        "Den, der omgår platformen, mister dens beskyttelse: betalinger er ikke sikrede, vores afbestillings- og refusionspolitikker gælder ikke, og vi kan ikke mægle i tilfælde af tvist.",
        "Overtrædelser kan føre til spærring af kontoen. Over for udbydere kan vi desuden gøre det mistede servicegebyr gældende.",
      ],
    },
    {
      id: "melden",
      heading: "5. Anmeld",
      paragraphs: [
        "Kræves der på stedet et beløb af dig, som ikke stod i opslaget, så betal det ikke og anmeld det til os via kontaktvejene under [Klager og tvistbilæggelse](https://mybestdays.dk/rechtliches/beschwerden). Har du allerede betalt, hjælper vi med tilbagesøgningen.",
      ],
    },
  ],
};
