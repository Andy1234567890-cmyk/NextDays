import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Dataskyddsstandarder för värdar",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "När du erbjuder boende via myBestDays får du personuppgifter om dina gäster. För behandlingen av dessa är du självständigt personuppgiftsansvarig i den mening som avses i förordning (EU) 2016/679 (dataskyddsförordningen). Dessa standarder beskriver vad vi förväntar oss av dig.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Ändamålsbegränsning",
      paragraphs: [
        "Du använder gästuppgifter uteslutande för att genomföra bokningen, kommunicera med gästen och uppfylla dina lagstadgade skyldigheter (t.ex. registreringsblankett, turistskatt, skatte- och arkiveringsskyldigheter).",
        "All ytterligare användning — särskilt marknadsföring, nyhetsbrev, utlämnande till tredje man, upptagande i ett eget gästregister för senare direktbokningar — kräver en egen rättslig grund, som regel gästens samtycke.",
        "Du använder inte gästuppgifter för att förmå gästen att boka utanför plattformen.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Uppgiftsminimering",
      paragraphs: [
        "Du samlar endast in de uppgifter du faktiskt behöver. Kopior av id-handlingar begär du endast när en rättsregel kräver det, och du lagrar dem endast så länge regeln föreskriver.",
        "Betalningsuppgifter begär du inte. Betalningar går via plattformen.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Säkerhet",
      paragraphs: [
        "Du skyddar gästuppgifter genom lämpliga tekniska och organisatoriska åtgärder — åtkomst endast för personer som behöver uppgifterna, skyddade enheter, krypterad överföring.",
        "Anlitar du medarbetare, städpersonal eller medvärdar förbinder du dem till sekretess och ger dem endast de uppgifter de behöver för sin uppgift.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Lagring och radering",
      paragraphs: [
        "Du raderar gästuppgifter så snart ändamålet upphört och ingen arkiveringsskyldighet längre föreligger.",
        "Registreringsblanketter och skattemässigt relevanta handlingar bevarar du så länge lagen i ditt land föreskriver — inte längre.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Gästernas rättigheter",
      paragraphs: [
        "Vänder sig en gäst till dig med en begäran om tillgång, rättelse, radering eller invändning besvarar du den inom fristen. Rör den uppgifter som finns hos oss hänvisar du gästen till oss.",
        "Du informerar dina gäster om hur du behandlar deras uppgifter, i den mån du går utöver genomförandet av bokningen.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Personuppgiftsincidenter",
      paragraphs: [
        "Inträffar en incident som rör skyddet av gästuppgifter informerar du omgående behörig tillsynsmyndighet och, där så krävs, de berörda gästerna.",
        "Rör incidenten uppgifter som du fått via plattformen informerar du dessutom oss, så att vi kan bedöma våra egna skyldigheter.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kameror och inspelningsutrustning",
      paragraphs: [
        "I inomhusutrymmen med berättigad förväntan om privatliv — sovrum, badrum — är kameror och mikrofoner otillåtna, även avstängda.",
        "All övrig kamerautrustning, rörelsedetektorer med inspelning, dörrklockor med kamera och ljudsensorer anger du i annonsen, med uppgift om plats och vad som spelas in.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Följder av överträdelser",
      paragraphs: [
        "Överträdelser av dessa standarder behandlar vi som överträdelser av [Kompletterande villkor för värdar](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) och kan vidta åtgärder upp till spärr av kontot.",
      ],
    },
  ],
};
