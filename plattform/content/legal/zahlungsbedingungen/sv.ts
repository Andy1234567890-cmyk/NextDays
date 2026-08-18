import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Betalningsvillkor",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Dessa betalningsvillkor reglerar hur betalningar i samband med en bokning via myBestDays hanteras. De kompletterar [Användarvillkor för gäster](https://mybestdays.dk/rechtliches/nutzungsbedingungen); vid motstridighet i betalningsfrågor har dessa betalningsvillkor företräde.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Vår roll vid betalningen",
      paragraphs: [
        "myBestDays hanterar betalningar på leverantörens uppdrag. Vi är inget betalningsinstitut och inget institut för elektroniska pengar; själva betaltjänsten utförs av vår betaltjänstleverantör.",
        "Betalningar via plattformen hanteras av Stripe (Stripe Payments Europe, Limited). Kortuppgifter och andra betalningsuppgifter samlas in och behandlas direkt av Stripe. myBestDays lagrar inga fullständiga kortuppgifter.",
        "Betalar du via plattformen anses din betalningsskyldighet gentemot leverantören fullgjord med det betalda beloppet så snart betalningen godkänts och dragits av vår betaltjänstleverantör.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Betalningssätt",
      paragraphs: [
        "Vilka betalningssätt som är tillgängliga beror på annonsen, på leverantörens land och på ditt land. Tillgängliga betalningssätt visas före slutförandet av bokningen.",
        "För vissa betalningssätt krävs stark kundautentisering enligt direktiv (EU) 2015/2366. Utan lyckad autentisering kan betalningen inte genomföras.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Förfallodag, handpenning och slutbetalning",
      paragraphs: [
        "När vilket belopp förfaller bestämmer leverantören i annonsen. Tre modeller är vanliga: full betalning vid bokning, handpenning vid bokning med slutbetalning före ankomst, eller betalning på plats hos leverantören.",
        "Den modell som gäller för din bokning och förfallodagarna visas före slutförandet av bokningen och upprepas i bokningsbekräftelsen.",
        "Innan slutbetalningen förfaller påminner vi dig på den angivna e-postadressen. Uteblir slutbetalningen kan leverantören enligt sina avbokningsvillkor frånträda avtalet.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Valuta",
      paragraphs: [
        "Avräkning sker i annonsens valuta. Denna valuta anges vid varje pris och i betalningsflödet.",
        "Visas ett belopp därutöver i en annan valuta är det en icke bindande omräkning för orientering och inget bindande pris.",
        "Räknar din betaltjänstleverantör om till en annan valuta eller tar ut en utlandsavgift bär du dessa kostnader. De ingår inte i totalpriset och fastställs eller uppbärs inte av oss.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Deposition",
      paragraphs: [
        "Anger annonsen en deposition visas dess storlek före slutförandet av bokningen.",
        "Beroende på annonsen förhandsgodkänns depositionen på ditt betalningsmedel (beloppet reserveras men dras inte) eller dras. Ett förhandsgodkännande kan tillfälligt minska din tillgängliga kortlimit.",
        "Efter vistelsen frisläpps förhandsgodkännandet eller den dragna depositionen återbetalas, i den mån leverantören inte gör gällande någon skada. Gör leverantören gällande en skada måste denne styrka den; om anspråket är berättigat avgörs i förhållandet mellan dig och leverantören.",
        "Kräver leverantören i stället depositionen på plats är det en kostnadspost på plats och hanteras inte via plattformen.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Återbetalningar",
      paragraphs: [
        "Återbetalningar sker till det betalningsmedel som använts, om inte annat avtalats eller det är tekniskt omöjligt.",
        "Vi initierar en återbetalning omgående så snart grunden för den är fastställd. Hur lång tid det tar innan krediteringen syns på ditt konto eller kort bestäms av din betaltjänstleverantör; fem till tio bankdagar är vanligt.",
        "Om och i vilken omfattning rätt till återbetalning finns följer av [Avbokningsvillkor](https://mybestdays.dk/rechtliches/stornierungsbedingungen) och [Omboknings- och återbetalningspolicy](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Misslyckade betalningar och återkrav",
      paragraphs: [
        "Misslyckas en betalning informerar vi dig och ger dig möjlighet att ange ett annat betalningsmedel. Uteblir betalningen kan bokningen avbokas.",
        "Återkräver du en redan genomförd betalning utan att rätt till återbetalning finns kan leverantören alltjämt kräva beloppet. Kostnader som uppstår för oss genom ett obefogat återkrav kan vi fakturera dig.",
        "Anser vi att en betalning är bedräglig kan vi hålla inne den eller avboka bokningen. Vi informerar dig om detta och motiverar beslutet.",
      ],
    },
    {
      id: "belege",
      heading: "8. Underlag och avräkningar",
      paragraphs: [
        "För de belopp som betalats via plattformen tillhandahåller vi ett underlag som du kan hämta i ditt konto under „Bokningar“.",
        "En faktura för logitjänsten utfärdar leverantören; denne är den presterande näringsidkaren. Om skatter se [Skattepolicy](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Ändringar av dessa betalningsvillkor",
      paragraphs: [
        "För ändringar av dessa betalningsvillkor gäller avsnitt A22 i [Användarvillkoren](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
