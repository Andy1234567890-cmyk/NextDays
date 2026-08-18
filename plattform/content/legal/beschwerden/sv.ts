import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Klagomål och tvistlösning",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Denna sida beskriver hur du når myBestDays, hur vi behandlar klagomål och vilka vägar som står dig till buds om du inte är nöjd med vårt beslut.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Så når du oss",
      paragraphs: [
        "Snabbast når du oss via Hjälpcentret och de kontaktvägar som anges där. För en befintlig bokning använder du meddelandefunktionen i ditt konto — då har vi redan bokning och historik.",
        `Skriftligen når du oss på ${ANBIETER.email} eller ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danmark; per telefon på ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Vad ditt klagomål bör innehålla",
      paragraphs: ["För att vi ska kunna hjälpa snabbt anger du:"],
      list: [
        "ditt bokningsnummer och den e-postadress som använts för bokningen;",
        "en kort beskrivning av problemet;",
        "vad du önskar som lösning;",
        "tillhörande underlag — bilder, meddelanden, kvitton, kontoutdrag.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Så handlägger vi",
      paragraphs: [
        "Varje klagomål registreras och får ett ärendenummer under vilket du kan följa status.",
        "Vi bekräftar mottagandet omgående och svarar i sak som regel inom sju dagar. Krävs en längre prövning meddelar vi dig delbeskedet.",
        "Klagomål där personer är i fara eller där en ankomst är nära förestående behandlar vi med förtur.",
        "Vårt beslut motiverar vi och anger den grund det vilar på.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Klagomål mot en åtgärd från oss",
      paragraphs: [
        "Har vi tagit bort innehåll, begränsat dess synlighet, avbokat en bokning eller spärrat ett konto kan du klaga på det kostnadsfritt inom sex månader. Detta motsvarar artikel 20 i förordning (EU) 2022/2065.",
        "Klagomålet prövas av människor, inte enbart av automatiserade förfaranden. Visar det sig befogat återkallar vi åtgärden.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Tvistlösning utanför domstol",
      paragraphs: [
        "Europeiska kommissionens plattform för tvistlösning online (ODR-plattformen) har upphävts genom förordning (EU) 2024/3228 och har upphört med verksamheten. Via den kan inga klagomål längre lämnas in.",
        "Vi är inte skyldiga och inte villiga att delta i ett tvistlösningsförfarande inför ett konsumenttvistlösningsorgan.",
        `Oberoende av detta kan du som konsument vända dig till det behöriga danska organet: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danmark ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Bor du i en annan medlemsstat hjälper Konsument Europa i ditt land vidare.`,
        "Rör tvisten en åtgärd som vi vidtagit mot ditt innehåll eller ditt konto kan du dessutom vända dig till ett organ för tvistlösning utanför domstol som certifierats enligt artikel 21 i förordning (EU) 2022/2065. Dess beslut är inte bindande för oss och vi är inte skyldiga att delta i sådana förfaranden.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Vägen till domstol",
      paragraphs: [
        "Vägen till domstol står dig alltid öppen, även utan föregående klagomålsförfarande. Vilka domstolar som är behöriga framgår av avsnitt A19 i [Användarvillkoren](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Klagomål från leverantörer",
      paragraphs: [
        "Leverantörer kan lämna klagomål om tillämpningen av dessa villkor, om rangordningsbeslut och om begränsningar av sin annons genom samma förfarande. Detta motsvarar artikel 11 i förordning (EU) 2019/1150.",
        "Om antal, föremål och genomsnittlig handläggningstid för sådana klagomål rapporterar vi årligen; rapporten finns under [Förordningen om digitala tjänster](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
