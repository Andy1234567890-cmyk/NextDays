import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Betalingsvilkår",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Disse betalingsvilkår regulerer, hvordan betalinger i forbindelse med en booking via myBestDays afvikles. De supplerer [Brugsvilkår for gæster](https://mybestdays.dk/rechtliches/nutzungsbedingungen); ved modstrid i betalingsspørgsmål har disse betalingsvilkår forrang.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Vores rolle ved betaling",
      paragraphs: [
        "myBestDays afvikler betalinger på udbyderens vegne. Vi er ikke et betalingsinstitut eller et e-pengeinstitut; selve betalingstjenesten leveres af vores betalingstjenesteudbyder.",
        "Betalinger via platformen afvikles gennem Stripe (Stripe Payments Europe, Limited). Kortoplysninger og andre betalingsdata indsamles og behandles direkte af Stripe. myBestDays gemmer ingen fuldstændige kortoplysninger.",
        "Betaler du via platformen, anses din betalingspligt over for udbyderen for opfyldt med det betalte beløb, så snart betalingen er godkendt og opkrævet af vores betalingstjenesteudbyder.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Betalingsmåder",
      paragraphs: [
        "Hvilke betalingsmåder der er til rådighed, afhænger af opslaget, af udbyderens land og af dit land. De tilgængelige betalingsmåder vises før gennemførelsen af bookingen.",
        "For visse betalingsmåder kræves stærk kundeautentifikation efter direktiv (EU) 2015/2366. Uden vellykket autentifikation kan betalingen ikke gennemføres.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Forfald, depositum og restbetaling",
      paragraphs: [
        "Hvornår hvilket beløb forfalder, bestemmer udbyderen i opslaget. Tre modeller er almindelige: fuld betaling ved booking, depositum ved booking med restbetaling før ankomst, eller betaling på stedet hos udbyderen.",
        "Den model, der gælder for din booking, og forfaldsdatoerne vises før gennemførelsen af bookingen og gentages i bookingbekræftelsen.",
        "Før restbetalingen forfalder, minder vi dig herom på den angivne e-mailadresse. Udebliver restbetalingen, kan udbyderen efter sine afbestillingsvilkår træde tilbage fra aftalen.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Valuta",
      paragraphs: [
        "Der afregnes i opslagets valuta. Denne valuta oplyses ved hver pris og i betalingsforløbet.",
        "Vises et beløb desuden i en anden valuta, er det en uforbindende omregning til orientering og ikke en bindende pris.",
        "Omregner din betalingstjenesteudbyder til en anden valuta eller opkræver et udlandsgebyr, bærer du disse omkostninger. De er ikke en del af totalprisen og fastsættes eller opkræves ikke af os.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Depositum",
      paragraphs: [
        "Indeholder opslaget et depositum, oplyses dets størrelse før gennemførelsen af bookingen.",
        "Alt efter opslag forhåndsgodkendes depositummet på dit betalingsmiddel (beløbet reserveres, men trækkes ikke) eller opkræves. En forhåndsgodkendelse kan midlertidigt mindske dit tilgængelige kortmaksimum.",
        "Efter opholdet frigives forhåndsgodkendelsen, eller det opkrævede depositum refunderes, medmindre udbyderen gør en skade gældende. Gør udbyderen en skade gældende, skal denne dokumentere den; om kravet er berettiget, afgøres i forholdet mellem dig og udbyderen.",
        "Kræver udbyderen i stedet depositummet på stedet, er det en omkostningspost på stedet og afvikles ikke via platformen.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Refusioner",
      paragraphs: [
        "Refusioner sker til det betalingsmiddel, der er anvendt, medmindre andet er aftalt eller teknisk umuligt.",
        "Vi iværksætter en refusion straks, når grunden hertil er fastslået. Hvor længe det tager, før krediteringen er synlig på din konto eller dit kort, bestemmes af din betalingstjenesteudbyder; fem til ti bankdage er almindeligt.",
        "Om og i hvilket omfang der består krav på refusion, afhænger af [Afbestillingsvilkår](https://mybestdays.dk/rechtliches/stornierungsbedingungen) og [Ombookings- og refusionspolitik](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Mislykkede betalinger og tilbageførsler",
      paragraphs: [
        "Mislykkes en betaling, underretter vi dig og giver dig lejlighed til at angive et andet betalingsmiddel. Udebliver betalingen, kan bookingen afbestilles.",
        "Tilbagefører du en allerede gennemført betaling, uden at der består krav på refusion, kan udbyderen fortsat kræve beløbet. Omkostninger, vi påføres ved en uberettiget tilbageførsel, kan vi fakturere dig.",
        "Anser vi en betaling for svigagtig, kan vi tilbageholde den eller afbestille bookingen. Vi underretter dig herom og begrunder afgørelsen.",
      ],
    },
    {
      id: "belege",
      heading: "8. Kvitteringer og opgørelser",
      paragraphs: [
        "For de beløb, der er betalt via platformen, stiller vi en kvittering til rådighed, som du kan hente i din konto under „Bookinger“.",
        "En faktura for overnatningsydelsen udsteder udbyderen; denne er den leverende erhvervsdrivende. Om skatter se [Skattepolitik](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Ændringer af disse betalingsvilkår",
      paragraphs: [
        "For ændringer af disse betalingsvilkår gælder afsnit A22 i [Brugsvilkårene](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
