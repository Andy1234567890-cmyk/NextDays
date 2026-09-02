import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerprogram",
  description: "Rekommendera företag, bygg ett team och tjäna på prenumerationsintäkter.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Så fungerar det",
      articles: [
        {
          slug: "ueberblick",
          title: "Partnerprogrammet i korthet",
          excerpt: "Vem kan delta, hur provision genereras och vad du ser.",
          updated: "Status: September 2026",
          body: [
            {
              type: "p",
              text: "Som partner rekommenderar du myNextDays till hyresvärdar, agenturer och hotell. Om ett företag registrerar sig med din kod eller via din länk och betalar sina prenumerationsfakturor, får du en andel av netto-prenumerationsintäkterna i tolv månader. Nivån baserad på betalande kunder visas live på programsidan.",
            },
            { type: "h2", text: "Vem kan bli partner" },
            {
              type: "ul",
              items: [
                "Personer och företag inom EU, Schweiz eller Storbritannien med en verklig kanal till värdar: Influencers, konsulter, agenturer, skattebyråer, föreningar.",
                "Även myNextDays-kunder själva – en prenumeration är inget krav.",
                "Obligatoriskt i ansökan: minst ett sociala medier-konto (Instagram, TikTok, YouTube, Facebook, LinkedIn …) med adress, användarnamn och räckvidd. Webbplats eller nyhetsbrev är också välkommet.",
              ],
            },
            { type: "h2", text: "Hur ett företag tilldelas dig" },
            {
              type: "steps",
              items: [
                "Du delar din länk (mynextdays.com/p/DIN-KOD) eller din kod.",
                "Företaget ser koden vid registreringen i fältet ”Rekommenderad av” och bekräftar den genom att skicka in – utan cookie.",
                "Med den första betalda prenumerationsfakturan börjar den tolv månader långa perioden.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Du ser dina kunder pseudonymt (Kund #1, #2 …) med land, status och belopp – aldrig namn eller e-post. Ett företag tilldelas exakt en partner; den första vinner.",
            },
            { type: "h2", text: "Vad du hittar i instrumentpanelen" },
            {
              type: "ul",
              items: [
                "Översikt: Rang, klick, registrerade och betalande företag, öppna, utbetalningsbara och utbetalda provisioner.",
                "Provisioner: varje betald prenumerationsfaktura som en rad med bas, sats, belopp och status.",
                "Utbetalningar: månatligen per valuta från minimibeloppet, med kredit (självfakturering) som underlag.",
                "Länkar & material: dina koder, reklammaterial och obligatorisk märkning per land.",
                "Meddelanden: direktkontakt med partnerteamet.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Bygg team: teamprovisionen",
          excerpt: "Värva partners som ansluter sig med din kod – och tjäna på intäkterna från deras kunder.",
          updated: "Status: September 2026",
          body: [
            {
              type: "p",
              text: "Du kan ta in andra partners i ditt team. Om någon ansöker via din teamlänk (mynextdays.com/p/DIN-KOD?team=1) och tydligt anger din kod i ansökan, tillhör de ditt team efter godkännande. Du får en teamprovision på netto-prenumerationsintäkterna från dina team-partners kunder.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Team-satsen baseras på DIN rang vid betalningstillfället – inte på storleken på ditt team. Satserna finns på programsidan.",
                "Din rang baseras endast på dina egna betalande kunder. Team-kunder räknas inte för rangen.",
                "Exakt en nivå: dina team-partners bygger inte ett eget team under dig.",
                "Ingen deltagaravgift, inga pengar för att värva en partner. Teamprovision uppstår uteslutande från betalda prenumerationsintäkter.",
                "Tolv månader från den första betalda fakturan från respektive team-kund, 30 dagars återbetalningsfönster, återkallande vid återbetalning eller chargeback – som med den egna provisionen.",
                "Teambonus uppstår endast när du och din teampartner har godkänts; annars pausas den.",
              ],
            },
            { type: "h2", text: "Teamutvärderingen" },
            {
              type: "p",
              text: "Under \"Team\" ser du varje teampartner med rankning, betalande kunder, prenumerationsintäkter från deras kunder (30 dagar och totalt) och din teambonus från detta – öppen, utbetalningsbar, utbetald – samt utvecklingen under de senaste tolv månaderna. Du ser inte kunddetaljer för dina teampartners; de tillhör dem.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Via \"Team\" kan du kontakta dina teampartners direkt med ett meddelande – och din sponsor dig.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Samma e-postdomän eller samma bankuppgifter mellan sponsor och teampartner markeras och kontrolleras av partnerteamet innan teambonusen betalas ut.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Utbetalning, kreditering och skatter",
          excerpt: "När provisionen blir utbetalningsbar, hur krediteringen ser ut och vad som gäller skattemässigt.",
          updated: "Status: September 2026",
          body: [
            {
              type: "steps",
              items: [
                "En provisionsrad uppstår med den betalda prenumerationsfakturan och är \"öppen\" i 30 dagar (återbetalningsfönster).",
                "Därefter är den utbetalningsbar. Den första i månaden samlar vi alla utbetalningsbara rader per valuta.",
                "Om summan överstiger minimibeloppet för din valuta, skapas en utbetalning med kreditering (självfakturering). Du behöver inte skicka en faktura.",
                "Efter överföringen visas utbetalningen som \"Betald\" med referens i instrumentpanelen.",
              ],
            },
            {
              type: "ul",
              items: [
                "Företag: Krediteringen innehåller en omvänd skattskyldighet; förutsättningen är ett bekräftat momsregistreringsnummer (VIES-kontroll).",
                "Privatpersoner: Krediteringen visar ingen moms; provisionen ska beskattas av dig själv.",
                "Utbetalning via SEPA, Wise eller PayPal – du anger uppgifterna i profilen; ändringar kräver ditt lösenord.",
                "Ingen omräkning: Provision i DKK betalas ut i DKK, provision i EUR i EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reklam måste vara igenkännbar som reklam – i början av inlägget, på inläggets språk. De bekräftade formuleringarna per land hittar du under \"Länkar & Material\". Överträdelser kan leda till avstängning.",
            },
          ],
        },
      ],
    },
  ],
};
