import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Integritetspolicy",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Denna policy beskriver vilka personuppgifter myBestDays behandlar, för vilka ändamål, på vilken rättslig grund och vilka rättigheter du har. Den gäller för webbplatsen, mobilapplikationerna och alla övriga ingångar till plattformen.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Personuppgiftsansvarig och dataskyddsombud",
      paragraphs: [
        `Personuppgiftsansvarig i den mening som avses i förordning (EU) 2016/679 (dataskyddsförordningen) är ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danmark, CVR-nr. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. De fullständiga leverantörsuppgifterna finns i [Juridisk information](https://mybestdays.dk/rechtliches/impressum).`,
        "Något dataskyddsombud är inte utsett; förutsättningarna i artikel 37 i förordningen är inte uppfyllda. Frågor om dataskydd riktar du till den ovan angivna e-postadressen.",
        "Leverantörer hos vilka du bokar är självständigt personuppgiftsansvariga för de uppgifter de får från oss. För dem gäller [Dataskyddsstandarder för värdar](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Vilka uppgifter vi behandlar",
      paragraphs: ["Beroende på hur du använder plattformen behandlar vi:"],
      list: [
        "grunduppgifter — namn, e-postadress, telefonnummer, språk och valuta, lösenord i krypterad form;",
        "bokningsuppgifter — bokat boende, period, antal och namn på resenärer, särskilda önskemål, bokningsstatus;",
        "betalningsuppgifter — belopp, valuta, betalningsstatus, de sista siffrorna i betalningsmedlet samt vår betaltjänstleverantörs transaktionsreferens. Fullständiga kortuppgifter når inte oss;",
        "kommunikationsuppgifter — meddelanden mellan dig och leverantören, förfrågningar till vår kundtjänst, klagomål;",
        "innehållsuppgifter — omdömen, bilder, önskelistor;",
        "användningsuppgifter — besökta sidor, sökfrågor, tidpunkt för åtkomst;",
        "tekniska uppgifter — IP-adress, webbläsar- och enhetsidentifierare, operativsystem, hänvisande sida.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Ändamål och rättsliga grunder",
      paragraphs: [
        "Tillhandahållande av plattformen, konto, sökning, bokning, betalningshantering och kommunikation med leverantören — artikel 6.1 b (avtal eller åtgärder före avtal).",
        "Kundtjänst, klagomålshantering och tvistlösning — artikel 6.1 b och f.",
        "Upptäckt och förhindrande av bedrägeri, missbruk och säkerhetsincidenter, upprätthållande av våra villkor — artikel 6.1 f (berättigat intresse av en säker marknadsplats).",
        "Omdömen och publiceringen av dem — artikel 6.1 b och f.",
        "Uppfyllande av rättsliga förpliktelser, särskilt bokförings- och skatterättsliga arkiveringsskyldigheter, rapporteringsskyldigheten enligt direktiv (EU) 2021/514 (DAC7) och skyldigheterna enligt förordning (EU) 2022/2065 — artikel 6.1 c.",
        "Förbättring av plattformen genom analys av aggregerade användningsuppgifter — artikel 6.1 f.",
        "Marknadsföringsmejl och icke nödvändiga kakor — artikel 6.1 a (samtycke), som du när som helst kan återkalla med verkan för framtiden.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Mottagare",
      paragraphs: [
        "Leverantörer får de uppgifter de behöver för att genomföra din bokning och uppfylla sina rättsliga förpliktelser — särskilt namn, kontaktuppgifter, period, antal resenärer och dina meddelanden till dem.",
        "Vår betaltjänstleverantör Stripe behandlar betalningsuppgifter som självständigt personuppgiftsansvarig; därutöver gäller [Stripes integritetspolicy](https://stripe.com/privacy).",
        "Leverantörer som för vår räkning utför hosting, databasdrift, e-postutskick, felsökning och kundtjänstverktyg behandlar uppgifter uteslutande enligt instruktion på grundval av ett avtal enligt artikel 28 i förordningen.",
        "Myndigheter och domstolar får endast uppgifter i den mån vi är skyldiga till det; se [Riktlinjer för myndighets- och brottsbekämpningsförfrågningar](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Skattemyndigheter får de uppgifter om leverantörer som ska rapporteras enligt DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Överföring till tredjeland",
      paragraphs: [
        "Våra servrar och våra personuppgiftsbiträdens servrar står i Europeiska unionen.",
        "I den mån behandling i enskilda fall sker utanför Europeiska ekonomiska samarbetsområdet sker det endast på grundval av ett beslut om adekvat skyddsnivå från Europeiska kommissionen eller standardavtalsklausulerna enligt artikel 46.2 c i förordningen jämte kompletterande skyddsåtgärder.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Lagringstider",
      paragraphs: [
        "Kontouppgifter lagrar vi så länge ditt konto finns och raderar dem därefter, om inte en arkiveringsskyldighet hindrar det.",
        "Boknings- och betalningsuppgifter omfattas av bokförings- och skatterättsliga arkiveringstider; enligt dansk bokföringslag är de som regel fem år från utgången av det räkenskapsår uppgifterna avser.",
        "Meddelanden om en bokning lagrar vi till tre år efter vistelsens slut, så att tvister kan redas ut.",
        "Omdömen kvarstår i anonymiserad form efter radering av ditt konto, eftersom de utgör en del av ett boendes betygsunderlag.",
        "Uppgifter om bedrägeri- och missbruksärenden lagrar vi så länge det är nödvändigt för att avvärja ytterligare överträdelser, dock högst tre år efter den senaste händelsen.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Dina rättigheter",
      paragraphs: ["Enligt dataskyddsförordningen har du följande rättigheter:"],
      list: [
        "tillgång till de uppgifter som lagrats om dig (artikel 15);",
        "rättelse av oriktiga uppgifter (artikel 16);",
        "radering (artikel 17), om inte en arkiveringsskyldighet hindrar det;",
        "begränsning av behandlingen (artikel 18);",
        "dataportabilitet (artikel 20);",
        "invändning mot behandling som grundas på berättigade intressen (artikel 21), särskilt mot direktmarknadsföring;",
        "återkallelse av lämnat samtycke med verkan för framtiden (artikel 7.3);",
        `klagomål till en tillsynsmyndighet (artikel 77) — behörig är myndigheten på din hemvistort, din arbetsplats eller platsen för den påstådda överträdelsen. På den personuppgiftsansvariges säte är det ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danmark, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Så utövar du dina rättigheter",
      paragraphs: [
        `Många uppgifter kan du se, ändra eller radera direkt i ditt konto. För allt övrigt vänder du dig till ${ANBIETER.email}.`,
        "Vi svarar omgående, senast inom en månad. Kan vi inte hålla fristen meddelar vi dig det med en motivering.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatiserade beslut",
      paragraphs: [
        "Vi använder automatiserade förfaranden för att upptäcka bedrägeri, missbruk och rättsstridigt innehåll. Leder ett sådant förfarande till en åtgärd mot ditt konto eller ditt innehåll motiverar vi den och du kan begära en prövning av en människa.",
        "Ett beslut som enbart grundas på automatiserad behandling med rättslig verkan i den mening som avses i artikel 22 i förordningen fattar vi inte.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Skyldighet att lämna uppgifter",
      paragraphs: [
        "De uppgifter som krävs för en bokning måste du lämna; utan dem kan inget avtal ingås och boendet inte tillhandahållas. Alla övriga uppgifter är frivilliga.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Ändringar av denna policy",
      paragraphs: [
        "Vi anpassar denna policy när behandlingen eller rättsläget ändras. Den vid var tid gällande versionen finns här; uppdateringsdatumet står överst.",
      ],
    },
  ],
};
