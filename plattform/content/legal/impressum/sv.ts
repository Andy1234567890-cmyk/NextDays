import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Juridisk information",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    `Uppgifter om leverantören av marknadsplatsen myBestDays. Operatör är ${ANBIETER.firma}; myBestDays är ett varumärke som tillhör detta bolag och inte en egen juridisk person.`,
    "Obligatoriska uppgifter enligt § 7 i den danska e-handelslagen, som genomför artikel 5 i direktiv 2000/31/EG om elektronisk handel, samt uppgifter enligt artiklarna 11 och 12 i förordning (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Plattformens operatör",
      paragraphs: [
        `${ANBIETER.firma} — anpartsselskab (ApS) enligt dansk rätt`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Danmark`,
        `Firmatecknande ledning: ${ANBIETER.direktion.join(" och ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontakt",
      paragraphs: [
        `E-post: ${ANBIETER.email}`,
        `Telefon: ${ANBIETER.telefon}`,
        "För ärenden som rör en befintlig bokning använder du meddelandefunktionen i ditt konto — då har vi redan bokning och historik; se [Klagomål och tvistlösning](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Register och moms",
      paragraphs: [
        `CVR-nr. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danmark.`,
        ...(ANBIETER.ustId
          ? [`Momsregistreringsnummer: ${ANBIETER.ustId}.`]
          : [
              "Något momsregistreringsnummer finns för närvarande inte; § 7 i e-handelslagen kräver att det anges endast vid befintlig momsregistrering.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kontaktpunkter enligt förordning (EU) 2022/2065",
      paragraphs: [
        `Central kontaktpunkt för myndigheter enligt artikel 11 och för användare enligt artikel 12: ${ANBIETER.email}, per post på ovan angivna adress.`,
        "Kommunikationsspråken är tyska, danska och engelska.",
        "Förfarandena enligt förordningen — anmälan av rättsstridigt innehåll, motivering av åtgärder, klagomålshantering — beskrivs under [Förordningen om digitala tjänster](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Behöriga myndigheter",
      paragraphs: [
        `Samordnare för digitala tjänster enligt artikel 49 i förordning (EU) 2022/2065: ${DSA_KOORDINATOR.name}, Danmark ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Tillsynsmyndighet för dataskydd: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danmark, ${AUFSICHTSBEHOERDE.email}.`,
        "Förmedling av logitjänster kräver inget särskilt tillstånd i Danmark; någon näringsrättslig tillsynsmyndighet finns därför inte.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Konsumenttvistlösning",
      paragraphs: [
        "Europeiska kommissionens plattform för tvistlösning online har upphävts genom förordning (EU) 2024/3228 och har upphört med verksamheten.",
        "Vi är inte skyldiga och inte villiga att delta i ett tvistlösningsförfarande inför ett konsumenttvistlösningsorgan.",
        `Oberoende av detta kan du som konsument vända dig till det behöriga danska organet: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danmark ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Bor du i en annan medlemsstat hjälper Konsument Europa i ditt land vidare.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Om innehåll och länkar",
      paragraphs: [
        "Annonsinnehåll kommer från respektive leverantör. myBestDays gör det inte till sitt eget; se avsnitt A4 i [Användarvillkoren](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "För innehållet på länkade tredjepartssidor ansvarar deras operatör. Får vi kännedom om en rättskränkning tar vi omgående bort länken.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Upphovsrätt",
      paragraphs: [
        `Det egna innehåll, de texter, den grafik och de varumärken som publiceras på denna plattform är skyddade av upphovsrätt och varumärkesrätt. Användning utanför de lagligen tillåtna fallen kräver föregående skriftligt samtycke från ${ANBIETER.firma}; för varumärken gäller [Riktlinjer för varumärken](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Tillämplig lag",
      paragraphs: [
        `${ANBIETER.firma} har sitt säte i Danmark och är etablerat endast där. För detta onlineerbjudande gäller därför dansk rätt — även för den svenskspråkiga versionen (ursprungslandsprincipen enligt artikel 3 i direktiv 2000/31/EG). Tvingande konsumentskyddsbestämmelser i ditt hemvistland påverkas inte.`,
      ],
    },
  ],
};
