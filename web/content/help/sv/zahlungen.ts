import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Betalningar och fakturor",
  description: "Betalningsleverantörer, betalningsregler och fakturor.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Betalningar",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Ansluta betalningsleverantör",
          excerpt:
            "Så ansluter du Stripe eller PayPal till myNextDays för att hantera betalningar automatiskt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Tillgängliga leverantörer" },
            {
              type: "p",
              text: "myNextDays hanterar betalningar via anslutna betalningsleverantörer. För närvarande stöds Stripe och PayPal — du kan ansluta en eller båda leverantörerna samtidigt och använda dem beroende på objekt eller gästönskemål.",
            },
            {
              type: "steps",
              items: [
                "Öppna Konto och byt till avsnittet ”Betalningar”.",
                "Välj önskad leverantör — Stripe eller PayPal.",
                "Följ anslutningsdialogen och logga in hos leverantören eller skapa ett nytt konto.",
                "Bekräfta anslutningen — statusen ändras till ”ansluten”.",
              ],
            },
            { type: "h2", text: "Vad som händer därefter" },
            {
              type: "p",
              text: "Så snart en leverantör är ansluten kan du skicka betalningslänkar, ta ut handpenning och utlösa återbetalningar direkt från bokningen. Alla belopp behandlas i den valuta som anges för respektive objekt.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Utan ansluten leverantör kan du bara markera betalningar manuellt som mottagna — en automatisk uttagning är då inte möjlig.",
            },
            { type: "h2", text: "Flera objekt, en leverantör" },
            {
              type: "p",
              text: "En anslutning som skapats en gång gäller kontoomfattande för alla dina objekt. Hur uttagningen går till i detalj fastställer du under [Betalningsregler](/hilfe/zahlungen/zahlungsregeln). Utbetalningar till dig sker därefter via respektive leverantör, se [Utbetalningar](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe passar för kortbetalningar och många lokala betalningssätt",
                "PayPal erbjuder gäster ett välkänt alternativ",
                "Båda leverantörerna kan kopplas bort och anslutas på nytt oberoende av varandra",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Betalningsregler",
          excerpt: "Fastställ när handpenning och slutbetalning för en bokning förfaller.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Handpenning och slutbetalning" },
            {
              type: "p",
              text: "Betalningsregler bestämmer hur en bokning hanteras ekonomiskt — till exempel en handpenning vid bokningen och en slutbetalning före ankomst, eller full betalning direkt. Reglerna gäller per objekt och kan justeras när som helst.",
            },
            {
              type: "steps",
              items: [
                "Öppna objektet och byt till avsnittet ”Betalningsregler”.",
                "Välj om en handpenning tas ut och fastställ andelen.",
                "Bestäm när slutbetalningen förfaller, till exempel ett visst antal dagar före ankomst.",
                "Spara inställningarna.",
              ],
            },
            { type: "h2", text: "Automatisk uttagning" },
            {
              type: "p",
              text: "Är en betalningsleverantör ansluten tar myNextDays automatiskt ut handpenning och slutbetalning vid den angivna tidpunkten och informerar gästen i förväg via meddelande.",
            },
            {
              type: "note",
              variant: "info",
              text: "Betalningsregler gäller bara för bokningar med ansluten betalningsleverantör. Utan leverantör markerar du betalningar manuellt i bokningen.",
            },
            { type: "h2", text: "Skillnader per kanal" },
            {
              type: "p",
              text: "På portaler kan avvikande deras egen betalningshantering gälla — kontrollera i så fall respektive portals villkor. För bokningar via den egna plattformen eller webbplatsen gäller alltid dina regler som anges här. Detaljer om leverantörsanslutningen hittar du under [Ansluta betalningsleverantör](/hilfe/zahlungen/zahlungsanbieter-verbinden), om fakturering under [Skapa fakturor](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Handpenning möjlig som fast belopp eller procentsats",
                "Slutbetalningsfristen fritt valbar",
                "Ändringar gäller bara nya bokningar, inte retroaktivt",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Skapa fakturor",
          excerpt: "Så skapar du en faktura med korrekt fakturaadress för en bokning.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Skapa faktura" },
            {
              type: "p",
              text: "För varje bokning kan en faktura skapas — för gästen själv eller för ett avvikande företag, om bokningen sker i affärssyfte.",
            },
            {
              type: "steps",
              items: [
                "Öppna bokningen i Reservationer.",
                "Välj ”Skapa faktura”.",
                "Kontrollera eller komplettera fakturaadressen.",
                "Kontrollera de angivna posterna — övernattning, tillägg, avgifter.",
                "Skapa fakturan och skicka den till gästen.",
              ],
            },
            { type: "h2", text: "Underhålla fakturaadress" },
            {
              type: "p",
              text: "Fakturaadressen kan du ange direkt i bokningen eller låta gästen komplettera via bokningsbekräftelsen. Utan en fullständig adress går det i vissa länder inte att ställa ut en juridiskt giltig faktura.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Kontrollera särskilt företagsnamn och adress för affärskunder — korrigeringar i efterhand kräver en korrigeringsfaktura.",
            },
            { type: "h2", text: "Belopp och valuta" },
            {
              type: "p",
              text: "Alla poster anges i den valuta som är angiven för objektet. Redan gjorda betalningar noteras på fakturan som betalningsinbetalning. Hur handpenning och slutbetalning kommer till läser du under [Betalningsregler](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Fakturor kan laddas ner som PDF",
                "Korrigeringsfakturor är möjliga när som helst vid ändringar",
                "Tillägg visas som en egen post",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Återbetalningar",
          excerpt:
            "Så återbetalar du en betalning helt eller delvis när en bokning avbokas eller ändras.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "När en återbetalning behövs" },
            {
              type: "p",
              text: "En återbetalning uppstår typiskt vid en avbokning, men kan även behövas vid en prisjustering i efterhand eller ett avbokat tillägg.",
            },
            {
              type: "steps",
              items: [
                "Öppna den berörda bokningen i Reservationer.",
                "Välj ”Återbetalning” i bokningens betalningsområde.",
                "Ange det belopp som ska återbetalas — helt eller delvis.",
                "Bekräfta återbetalningen.",
              ],
            },
            { type: "h2", text: "Förlopp via betalningsleverantören" },
            {
              type: "p",
              text: "Återbetalningen görs via den leverantör som användes vid betalningen — Stripe eller PayPal — och överförs direkt tillbaka till gästens ursprungliga betalningsmedel. Förloppet noteras automatiskt i bokningens tidslinje.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Utan ansluten betalningsleverantör kan en återbetalning inte utlösas automatiskt — klargör återbetalningen i så fall direkt med gästen.",
            },
            { type: "h2", text: "Påverkan på provisioner" },
            {
              type: "p",
              text: "Redan fakturerade marknadsplats- eller portalprovisioner justeras proportionellt vid en återbetalning. Mer om det under [Förstå provisioner](/hilfe/zahlungen/provisionen-verstehen). Detaljer om själva avbokningen hittar du under [Avbokning och återbetalning](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Delvisa återbetalningar är möjliga för enskilda poster",
                "Bearbetningsstatusen är alltid synlig i bokningen",
                "Återbetalningar sker uteslutande via den ursprungligen använda leverantören",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Utbetalningar",
          excerpt:
            "Så får du intäkterna från dina bokningar utbetalda från de anslutna betalningsleverantörerna.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Hur utbetalningar fungerar" },
            {
              type: "p",
              text: "Inkommande betalningar samlas först hos den anslutna betalningsleverantören. Därifrån sker utbetalningen till ditt angivna bankkonto enligt respektive leverantörs vanliga rytm.",
            },
            {
              type: "steps",
              items: [
                "Öppna Konto och byt till avsnittet ”Betalningar”.",
                "Kontrollera statusen för respektive leverantör under ”Utbetalningar”.",
                "Öppna vid behov detaljvyn för leverantören för den fullständiga utbetalningshistoriken.",
              ],
            },
            { type: "h2", text: "Vad som dras av före utbetalningen" },
            {
              type: "p",
              text: "Före utbetalningen beaktas eventuella marknadsplats- och portalprovisioner samt leverantörsavgifter. Det utbetalda beloppet motsvarar därmed inte nödvändigtvis den ursprungliga bokningssumman.",
            },
            {
              type: "note",
              variant: "info",
              text: "Den exakta uppbyggnaden av avdragen förklaras i [Förstå provisioner](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Flera objekt och ägare" },
            {
              type: "p",
              text: "Förvaltar du objekt för olika ägare tilldelas utbetalningar enligt de angivna ägarredovisningarna. Kontrollera vid oklarheter först statusen för de underliggande bokningarna i Reservationer.",
            },
            {
              type: "ul",
              items: [
                "Utbetalningsrytm och -metod bestäms av respektive leverantör",
                "Kvarhållna belopp, till exempel vid pågående återbetalningar, är märkta",
                "Den fullständiga historiken finns tillgänglig direkt hos leverantören",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Förstå provisioner",
          excerpt:
            "En översikt över hur marknadsplats- och portalprovisioner sätts samman och var de faktureras.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Två typer av provisioner" },
            {
              type: "p",
              text: "Vid bokningar via myNextDays kan två olika provisioner uppstå: marknadsplatsprovisionen för bokningar via den egna plattformen samt portalprovisioner för bokningar som kommer in via anslutna portaler som Booking eller Airbnb. Båda är oberoende av varandra och kan variera beroende på bokningens försäljningsväg.",
            },
            {
              type: "ul",
              items: [
                "Marknadsplatsprovision: tas ut vid bokningar via myNextDays-plattformen",
                "Portalprovision: beräknas av respektive portal enligt dess egna villkor",
                "Direktbokningar via din egen webbplats ska betraktas oberoende av detta",
              ],
            },
            { type: "h2", text: "Var provisioner är synliga" },
            {
              type: "steps",
              items: [
                "Öppna Konto och byt till avsnittet ”Avräkning”.",
                "Välj önskad månad.",
                "Kontrollera sammanställningen per bokning med tillhörande provision.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Via vilken kanal en bokning kom in ser du direkt på bokningen själv — det förklarar vilken provision som tillämpats i respektive fall.",
            },
            { type: "h2", text: "Samband med utbetalningar" },
            {
              type: "p",
              text: "Provisioner dras av från bokningssumman före utbetalningen. Detaljer om utbetalningsförloppet hittar du under [Utbetalningar](/hilfe/zahlungen/auszahlungen). Vid en återbetalning korrigeras den tillhörande provisionen proportionellt — hela bokningsförloppet visas i [Bokningens tidslinje](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
