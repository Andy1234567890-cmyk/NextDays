import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Omdömespolicy",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Omdömen är för gäster den viktigaste oberoende källan. Denna policy beskriver vem som får lämna omdöme, hur vi säkerställer att omdömen kommer från faktiska gäster och när vi tar bort ett omdöme.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Hur vi säkerställer äktheten",
      paragraphs: [
        "Ett omdöme kan endast lämnas av den som bokat boendet via myBestDays och vars vistelseperiod har börjat. Omdömet knyts tekniskt till den konkreta bokningen.",
        "Därmed uppfyller vi skyldigheten enligt punkt 23b i bilaga I till direktiv 2005/29/EG att endast presentera sådana omdömen som gästomdömen där vi vidtagit rimliga åtgärder för att kontrollera att de kommer från faktiska gäster.",
        "Vi köper inga omdömen, beställer inga och lägger inte in falska omdömen. Vi accepterar inte heller att leverantörer gör det.",
      ],
    },
    {
      id: "frist",
      heading: "2. Frist och publicering",
      paragraphs: [
        "Efter avresan har du 14 dagar på dig att lämna ett omdöme. Leverantören kan inom samma frist lämna ett omdöme om dig.",
        "Båda omdömena publiceras samtidigt så snart båda finns eller fristen löpt ut. Så påverkar ingen part den andra.",
        "Ett lämnat omdöme kan du dra tillbaka inom fristen. Efter publiceringen är en ändring inte längre möjlig; du kan låta radera det.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Leverantörens svar",
      paragraphs: [
        "Leverantören kan svara offentligt på ett omdöme. För svaret gäller samma regler som för omdömet självt.",
        "Ett svar ändrar inte omdömet och påverkar inte helhetsbetyget.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. När vi tar bort ett omdöme",
      paragraphs: [
        "Vi tar inte bort ett omdöme för att det är negativt eller för att leverantören är missnöjd med det. Vi tar bort det när det:",
      ],
      list: [
        "strider mot [Riktlinjer för lämpligt innehåll](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "innehåller tredje mans personuppgifter;",
        "uppenbart avser ett annat boende eller en annan vistelse;",
        "i allt väsentligt rör omständigheter som varken gäst eller leverantör hade inflytande över (t.ex. väder, kommunens byggarbetsplats, trafik vid ankomst) — i så fall tar vi endast bort den berörda delen om den kan avskiljas;",
        "uppenbart syftar till utpressning, t.ex. för att det kopplats till ett krav;",
        "erhållits genom incitament eller lämnats i samordnat syfte.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Incitament är otillåtna",
      paragraphs: [
        "Leverantörer får varken erbjuda pengar, rabatter, uppgraderingar, gåvor eller andra förmåner för ett omdöme — inte heller för att avstå från ett omdöme.",
        "Leverantörer får bjuda in gäster att lämna omdöme utan att påverka betyget. En inbjudan som endast uppmanar till omdöme vid en positiv upplevelse är otillåten.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Hur vi visar omdömen",
      paragraphs: [
        "Helhetsbetyget är det ovägda genomsnittet av alla publicerade omdömen om ett boende. Vi viktar inget omdöme högre för att det är bättre.",
        "Standardsorteringen visar de senaste omdömena först. Du kan byta till andra sorteringar; vilken sortering som är aktiv visas.",
        "Vi anger hur många omdömen ett helhetsbetyg grundas på. Vid färre än tre omdömen visar vi inget helhetsbetyg, endast de enskilda omdömena.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Klagomål mot ett beslut",
      paragraphs: [
        "Tar vi bort ditt omdöme eller avslår vi borttagandet av ett omdöme motiverar vi det och hänvisar till klagomålsvägen — se [Klagomål och tvistlösning](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
