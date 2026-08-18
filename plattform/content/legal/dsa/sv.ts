import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Förordningen om digitala tjänster",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "myBestDays är en förmedlingstjänst och en onlineplattform i den mening som avses i förordning (EU) 2022/2065 om en inre marknad för digitala tjänster (förordningen om digitala tjänster, DSA). Denna sida samlar de uppgifter och förfaranden som förordningen kräver.",
    "myBestDays är ingen mycket stor onlineplattform i den mening som avses i artikel 33 i förordningen. De ytterligare skyldigheter som gäller för dessa — kartläggning av systemrisker, oberoende revision, annonsarkiv och offentliggörande av det månatliga användarantalet enligt det där föreskrivna förfarandet — åligger oss därför inte.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kontaktpunkter (artiklarna 11 och 12)",
      paragraphs: [
        `Central kontaktpunkt för medlemsstaternas myndigheter, kommissionen och Europeiska nämnden för digitala tjänster: ${ANBIETER.email}, per post ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danmark.`,
        `Central kontaktpunkt för användare: ${ANBIETER.email}. Du når oss där direkt och utan automatiserat mellansteg.`,
        "Med båda kontaktpunkterna går det att kommunicera på tyska, danska och engelska.",
        "Någon rättslig företrädare i unionen enligt artikel 13 behöver inte utses: operatören är etablerad i Danmark och därmed i unionen.",
        `Behörig samordnare för digitala tjänster enligt artikel 49: ${DSA_KOORDINATOR.name}, Danmark ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Anmäla rättsstridigt innehåll (artikel 16)",
      paragraphs: [
        "Var och en kan anmäla innehåll till oss som denne anser vara rättsstridigt. Använd anmälningsfunktionen som finns vid varje annons, varje omdöme och varje meddelande, eller kontaktpunkten för användare.",
        "För att vi ska kunna bedöma en anmälan utan ingående rättslig prövning bör den innehålla:",
      ],
      list: [
        "en tillräckligt underbyggd förklaring till varför innehållet är rättsstridigt;",
        "den exakta elektroniska platsen, särskilt URL:en;",
        "namn och e-postadress för den anmälande — utom vid anmälningar om brott mot barns sexuella självbestämmande, där uppgiften är frivillig;",
        "förklaringen att uppgifterna enligt bästa förmåga är riktiga och fullständiga.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Hur vi handlägger anmälningar",
      paragraphs: [
        "Vi bekräftar mottagandet omgående och beslutar i rätt tid, omsorgsfullt, icke godtyckligt och objektivt.",
        "Innehåller en anmälan uppgifterna i avsnitt 2 ger den oss kännedom i den mening som avses i artikel 6 i förordningen.",
        "Vårt beslut meddelar vi den anmälande och upplyser om rättsmedlen.",
        "Vid automatiserad handläggning meddelar vi det.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Motivering av åtgärder (artikel 17)",
      paragraphs: [
        "Begränsar vi synligheten av ett innehåll, tar bort det, spärrar tillgången till det, håller inne betalningar, spärrar tillhandahållandet av tjänsten eller kontot, får den berörda personen en tydlig och specifik motivering.",
        "Motiveringen anger åtgärdens art och omfattning, dess territoriella och tidsmässiga räckvidd, de fakta och omständigheter som ligger till grund för beslutet, om automatiserad behandling varit inblandad, den rättsliga grunden eller den avtalsbestämmelse som överträtts samt tillgängliga rättsmedel.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Misstanke om brott (artikel 18)",
      paragraphs: [
        "Finns det hållpunkter för ett brott som innebär fara för en persons liv eller säkerhet underrättar vi omgående behöriga brottsbekämpande eller rättsliga myndigheter.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Internt klagomålsförfarande (artikel 20)",
      paragraphs: [
        "Mot varje åtgärd enligt avsnitt 4 och mot avslag på en anmälan kan klagomål lämnas kostnadsfritt inom sex månader.",
        "Klagomål handläggs i rätt tid, icke-diskriminerande och omsorgsfullt — under tillsyn av kvalificerade personer och inte enbart med automatiserade medel.",
        "Visar sig ett klagomål befogat återkallar vi åtgärden. Vägen beskrivs under [Klagomål och tvistlösning](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Tvistlösning utanför domstol (artikel 21)",
      paragraphs: [
        "För tvister om åtgärder enligt avsnitt 4 kan användare vända sig till ett organ för tvistlösning utanför domstol som certifierats av behörig samordnare för digitala tjänster. Europeiska kommissionen för förteckningen över certifierade organ.",
        "Dessa organs beslut är inte bindande för oss; vi är inte skyldiga att delta i förfaranden hos oberoende leverantörer. Vägen till domstol påverkas inte.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Betrodda anmälare (artikel 22)",
      paragraphs: [
        "Anmälningar som lämnas av en anmälare som erkänts som betrodd anmälare inom sitt sakområde handlägger vi med förtur.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Åtgärder mot missbruk (artikel 23)",
      paragraphs: [
        "Konton genom vilka uppenbart rättsstridigt innehåll ofta tillhandahålls spärrar vi under skälig tid efter föregående varning.",
        "Handläggningen av anmälningar och klagomål håller vi inne för personer som ofta lämnar uppenbart obefogade anmälningar eller klagomål — likaså efter föregående varning.",
        "Vi prövar därvid alltid det enskilda fallet: antal, andel och allvar i de berörda ärendena samt avsikten.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Transparensrapporter (artiklarna 15 och 24)",
      paragraphs: [
        "Vi offentliggör årligen en rapport om innehållsmoderering: antalet förelägganden från myndigheter, antalet och arten av anmälningar, vidtagna åtgärder, antalet klagomål och deras utgång, uppgifter om användningen av automatiserade medel samt antalet tvister inför organ utanför domstol.",
        `Mikroföretag och små företag är enligt artikel 19 i förordningen undantagna från en del av dessa skyldigheter. Så länge undantaget gäller tillhandahåller vi uppgifterna på begäran via ${ANBIETER.email}; så snart den första rapporten är offentliggjord länkas den här.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Spårbarhet för näringsidkare (artiklarna 30–32)",
      paragraphs: [
        "Leverantörer som handlar näringsmässigt på plattformen får erbjuda först när de har lämnat oss namn, adress, telefonnummer, e-postadress, registeruppgifter, momsregistreringsnummer och betalkonto, och deras uppgifter är rimliga.",
        "Dessa uppgifter visar vi i annonsen i den mån förordningen föreskriver det.",
        "Får vi veta att en annons avsåg en olaglig produkt eller tjänst informerar vi de berörda gästerna, i den mån vi har deras kontaktuppgifter.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Rekommendationssystem (artikel 27)",
      paragraphs: [
        "De huvudsakliga parametrarna för sökresultatens ordning och för rekommendationer samt möjligheten att påverka dem beskrivs under [Priser, rangordning och rekommendationer](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reklam (artikel 26)",
      paragraphs: [
        "Vi visar för närvarande ingen betald reklam från tredje part och inga betalda placeringar i sökresultaten.",
        "Skulle vi införa reklam märker vi den tydligt, anger annonsören och de huvudsakliga parametrarna för visningen. Reklam som grundas på särskilda kategorier av personuppgifter enligt artikel 9 i förordning (EU) 2016/679 och reklam till minderåriga som grundas på profilering utesluter vi.",
      ],
    },
  ],
};
