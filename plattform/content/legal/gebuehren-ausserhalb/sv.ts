import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Avgifter utanför plattformen",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Denna policy reglerar vilka belopp en leverantör får kräva utanför plattformen och vilka som inte får krävas. Den skyddar gäster från att på plats mötas av krav som inte stod i annonsen.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Utgångspunkt",
      paragraphs: [
        "Allt som ska betalas för den bokade tjänsten måste anges i annonsen före slutförandet av bokningen — antingen som en del av totalpriset eller som en kostnadspost på plats.",
        "Ett belopp som varken angetts i totalpriset eller som kostnad på plats är gästen inte skyldig att betala.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Vad som får krävas på plats",
      paragraphs: ["På plats får uteslutande krävas:"],
      list: [
        "belopp som i annonsen uttryckligen angetts som kostnader på plats (t.ex. slutstädning, linnepaket, parkeringsplats);",
        "lokala avgifter som turistskatt, i den mån den enligt lokala föreskrifter ska betalas på plats;",
        "en i annonsen angiven deposition;",
        "tjänster som gästen bokar först på plats och frivilligt, till ett i förväg angivet pris;",
        "ersättning för styrkta skador som gästen orsakat.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Vad som inte får krävas",
      paragraphs: ["Otillåtet är särskilt:"],
      list: [
        "ett efterkrav på övernattningspriset efter slutförandet av bokningen;",
        "en avgift för att bokningen skett via myBestDays;",
        "en expeditions-, boknings- eller kortavgift som inte angetts i annonsen;",
        "uppmaningen att avboka bokningen och boka samma boende på nytt utanför plattformen;",
        "uppmaningen att betala priset eller en del av det via överföring, kontant eller genom en betaltjänst utanför plattformen, när annonsen anger betalning via plattformen.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Kringgående av plattformen",
      paragraphs: [
        "Uppstod kontakten mellan gäst och leverantör via plattformen får bokningen inte hanteras vid sidan av den. Detta gäller för båda parter.",
        "Den som kringgår plattformen förlorar dess skydd: betalningar är inte säkrade, våra avboknings- och återbetalningspolicyer gäller inte, och vi kan inte medla vid en tvist.",
        "Överträdelser kan leda till spärr av kontot. Gentemot leverantörer kan vi dessutom göra gällande den uteblivna serviceavgiften.",
      ],
    },
    {
      id: "melden",
      heading: "5. Anmäla",
      paragraphs: [
        "Krävs det på plats ett belopp av dig som inte stod i annonsen, betala det inte och anmäl det till oss via kontaktvägarna under [Klagomål och tvistlösning](https://mybestdays.dk/rechtliches/beschwerden). Har du redan betalat hjälper vi till med återkravet.",
      ],
    },
  ],
};
