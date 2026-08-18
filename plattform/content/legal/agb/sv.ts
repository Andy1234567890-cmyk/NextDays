import type { LegalDoc } from "../types";

// Schwedische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. Zielgruppe sind Verbraucher (Gäste) — anders als die
// Agentur-AGB in apps/web.
export const agb: LegalDoc = {
  title: "Användarvillkor för gäster",
  stand: "Senast uppdaterad: 3 juli 2026",
  intro: [
    "Dessa användarvillkor reglerar resandes och bokares (nedan ”gästen”) användning av bokningsportalen myBestDays (nedan ”plattformen”).",
    "Plattformen drivs av [fullständigt företagsnamn, bolagsform, adress och registeruppgifter för operatören — kompletteras före publicering] (nedan ”myBestDays” eller ”vi”).",
  ],
  sections: [
    {
      heading: "§ 1 Tillämpningsområde",
      paragraphs: [
        "Dessa villkor gäller för användningen av plattformen, i synnerhet för sökning efter boenden och bokning av logitjänster via plattformen.",
        "För själva logitjänsten gäller dessutom respektive leverantörs villkor (t.ex. ordningsregler, avbokningsvillkor) som anges i erbjudandet.",
      ],
    },
    {
      heading: "§ 2 myBestDays roll; avtalets ingående",
      paragraphs: [
        "myBestDays förmedlar logitjänster som erbjuds av respektive leverantör (byråer, uthyrare eller ägare, nedan ”leverantören”). Avtalet om boendet ingås uteslutande mellan gästen och den aktuella leverantören. myBestDays blir inte part i inkvarteringsavtalet.",
        "Respektive leverantör anges i erbjudandet och i bokningsbekräftelsen.",
      ],
    },
    {
      heading: "§ 3 Bokning och bokningsbekräftelse",
      paragraphs: [
        "Presentationen av boendena på plattformen är en uppmaning att lämna ett bokningsanbud. Genom att slutföra bokningsprocessen (klick på bokningsknappen som medför betalningsskyldighet) lämnar gästen ett bindande anbud om att ingå ett inkvarteringsavtal med leverantören.",
        "Avtalet kommer till stånd när bokningen bekräftas. Bokningsbekräftelsen skickas till gästen på den angivna e-postadressen.",
        "Gästen är skyldig att lämna riktiga och fullständiga uppgifter vid bokningen (i synnerhet namn, kontaktuppgifter och antal resande).",
      ],
    },
    {
      heading: "§ 4 Priser och betalning",
      paragraphs: [
        "De priser som anges i erbjudandet vid bokningstillfället gäller, inklusive de skatter, avgifter och tilläggskostnader som anges där. Priser visas i den valuta som anges i erbjudandet. På plats kan ytterligare lokala avgifter (t.ex. turistskatt) tillkomma, i den mån detta anges i erbjudandet.",
        "Betalningen hanteras via betaltjänstleverantören Stripe. Betalningsuppgifter (t.ex. kortuppgifter) samlas in och behandlas direkt av Stripe; myBestDays lagrar inga fullständiga kortuppgifter. Stripe behandlar personuppgifter i enlighet med [Stripes integritetspolicy](https://stripe.com/privacy).",
        "Om en deposition anges i erbjudandet kan den förauktoriseras vid bokning eller ankomst och vid skada helt eller delvis hållas inne; uppgifterna i erbjudandet är avgörande.",
      ],
    },
    {
      heading: "§ 5 Avbokning, ombokning och ångerrätt",
      paragraphs: [
        "Om och på vilka villkor en bokning kan avbokas eller ändras kostnadsfritt följer av leverantörens avbokningsvillkor som anges i erbjudandet.",
        "För logitjänster som bokas för en viss period finns enligt artikel 16 l i EU:s konsumenträttighetsdirektiv respektive motsvarande nationella bestämmelser i regel ingen lagstadgad ångerrätt. Gästens tvingande lagstadgade rättigheter påverkas inte.",
      ],
    },
    {
      heading: "§ 6 Gästens skyldigheter",
      paragraphs: [
        "Gästen använder boendet i enlighet med avtalet, håller sig till det högsta antal gäster som anges i erbjudandet och följer leverantörens ordningsregler.",
        "Plattformen får inte missbrukas, i synnerhet inte för skenbokningar, bedrägliga betalningar eller publicering av olagligt innehåll (t.ex. i omdömen eller meddelanden).",
      ],
    },
    {
      heading: "§ 7 myBestDays ansvar",
      paragraphs: [
        "För utförandet av logitjänsten ansvarar enbart leverantören. myBestDays ansvarar inte för riktigheten i det erbjudandeinnehåll som leverantörer lägger in, men utför förmedlingen och betalningshanteringen med den omsorg som krävs av en ansvarsfull näringsidkare.",
        "myBestDays ansvarar obegränsat vid uppsåt och grov vårdslöshet samt för skador till följd av skada på liv, kropp eller hälsa. Vid ringa vårdslöshet ansvarar myBestDays endast för åsidosättande av väsentliga avtalsförpliktelser (kardinalförpliktelser), begränsat till den för avtalet typiska, förutsebara skadan. Tvingande lagstadgade ansvarsregler påverkas inte.",
      ],
    },
    {
      heading: "§ 8 Dataskydd",
      paragraphs: [
        "myBestDays behandlar gästens personuppgifter för att genomföra förmedlingen och bokningen. Bokningsuppgifter överförs till den aktuella leverantören i den mån det är nödvändigt för att fullgöra inkvarteringsavtalet. För betalningshanteringen gäller § 4.",
        "Närmare uppgifter framgår av plattformens dataskyddsinformation.",
      ],
    },
    {
      heading: "§ 9 Klagomål och tvistlösning",
      paragraphs: [
        "Klagomål som rör boendet riktar gästen i första hand till leverantören; vid frågor om bokningen eller betalningen hjälper myBestDays support till via de kontaktvägar som anges på plattformen.",
        "myBestDays är varken skyldigt eller villigt att delta i tvistlösningsförfaranden inför en konsumenttvistenämnd, såvida ingen lagstadgad skyldighet föreligger.",
      ],
    },
    {
      heading: "§ 10 Ändringar av dessa villkor",
      paragraphs: [
        "myBestDays kan ändra dessa villkor med verkan för framtiden, i den mån detta är nödvändigt av godtagbara skäl (i synnerhet lagändringar eller ändringar i rättspraxis) och gästen inte missgynnas oskäligt av detta. För redan genomförda bokningar gäller den version som var i kraft vid bokningstillfället.",
      ],
    },
    {
      heading: "§ 11 Slutbestämmelser",
      paragraphs: [
        "Lagen i den stat där operatören har sitt säte tillämpas, med uteslutande av FN:s konvention om avtal om internationella köp av varor (CISG). Om gästen är konsument påverkas inte de tvingande konsumentskyddsbestämmelserna i den stat där gästen har sin vanliga vistelseort.",
        "Om enskilda bestämmelser i dessa villkor är eller blir ogiltiga påverkas inte giltigheten av övriga bestämmelser.",
      ],
    },
  ],
};
