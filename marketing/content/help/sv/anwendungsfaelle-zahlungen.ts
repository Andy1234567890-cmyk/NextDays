import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Betalningar",
  description: "Hantera betalningar korrekt.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Betalningar",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Ställa in en handpenning",
          excerpt: "Så begär du bara ett delbelopp vid bokning istället för hela summan.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Istället för att ta ut hela bokningsbeloppet direkt kan du fastställa en handpenning som betalningsregel. Gästen betalar vid bokning bara ett delbelopp via Stripe eller PayPal, resten senare via en slutbetalning.",
            },
            {
              type: "steps",
              items: [
                "Öppna avsnittet ”Betalningsregler” i objektet.",
                "Skapa en ny regel av typen ”Handpenning”.",
                "Fastställ handpenningsbeloppet som en procentsats eller ett fast belopp av totalsumman.",
                "Fastställ när handpenningen förfaller, vanligtvis omedelbart vid bokning.",
                "Spara regeln och kontrollera den mot en testbokning.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Handpenningen hanteras via den betalningsleverantör som angetts för objektet. Det matchande beloppet mot restsumman ställer du in under [Automatisera slutbetalningen](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatisera slutbetalningen",
          excerpt: "Så tas det öppna restbeloppet ut automatiskt före ankomsten.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Efter en handpenning återstår ett restbelopp. Istället för att följa upp det manuellt ställer du in en betalningsregel som automatiskt tar ut slutbetalningen vid en fast tidpunkt före ankomsten via Stripe eller PayPal.",
            },
            {
              type: "steps",
              items: [
                "Öppna avsnittet ”Betalningsregler” i objektet.",
                "Skapa en ny regel av typen ”Slutbetalning”, förutsatt att en handpenningsregel redan finns.",
                "Fastställ hur många dagar före ankomsten slutbetalningen förfaller.",
                "Aktivera den automatiska uttagningen, så att den angivna betalningsleverantören drar beloppet självständigt.",
                "Kontrollera därefter slutbetalningens status i respektive reservations tidslinje.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Misslyckas den automatiska uttagningen, till exempel på grund av ett utgånget kort, avbokas bokningen inte automatiskt. Kontrollera misslyckade slutbetalningar snabbt och kontakta gästen direkt.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Genomföra en återbetalning",
          excerpt: "Så återbetalar du ett belopp till en gäst helt eller delvis.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Vid en avbokning eller reklamation kan du återbetala det betalda beloppet till en gäst helt eller delvis. Återbetalningen sker via samma betalningsleverantör som ursprungligen användes för betalningen — Stripe eller PayPal.",
            },
            {
              type: "steps",
              items: [
                "Öppna den berörda bokningen i bokningens tidslinje.",
                "Välj den ursprungliga betalningen som ska återbetalas i avsnittet ”Betalningar”.",
                "Välj mellan full eller delvis återbetalning.",
                "Ange önskat belopp vid en delvis återbetalning.",
                "Bekräfta återbetalningen och kontrollera den uppdaterade betalningsstatusen i tidslinjen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "En återbetalning ändrar inte automatiskt bokningsstatusen eller de bokade kalendernätterna. Kontrollera vid en avbokning dessutom om de berörda nätterna behöver frigöras igen i beläggningsplanen.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Hantera en deposition",
          excerpt: "Så ställer du in en deposition och frigör den igen efter vistelsen.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "En deposition säkrar dig mot skador under vistelsen. Den anges som en egen betalningsregel och antingen förhandsauktoriseras eller tas ut via Stripe eller PayPal, beroende på objektets konfiguration.",
            },
            {
              type: "steps",
              items: [
                "Öppna avsnittet ”Betalningsregler” i objektet och skapa en regel av typen ”Deposition”.",
                "Fastställ depositionsbeloppet och tidpunkten för auktoriseringen, vanligtvis strax före ankomsten.",
                "Kontrollera objektets skick efter utcheckningen.",
                "Frigör depositionen helt via bokningen om skicket är felfritt.",
                "Återbetala vid en skada endast den ej behövda delen och dokumentera anledningen till kvarhållandet.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En auktoriserad men ej uttagen deposition förfaller automatiskt efter en viss frist beroende på betalningsleverantör. Frigör depositionen snabbt efter utcheckningen eller ta ut det behövda beloppet i tid.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Korrigera en faktura",
          excerpt: "Så korrigerar du en redan utställd faktura i efterhand.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Innehåller en redan utställd faktura ett fel, till exempel i fakturaadressen eller en post, korrigerar du den via bokningen istället för att helt enkelt ta bort den ursprungliga fakturan.",
            },
            {
              type: "steps",
              items: [
                "Öppna den berörda bokningen i bokningens tidslinje och byt till avsnittet ”Fakturor”.",
                "Välj den felaktiga fakturan.",
                "Skapa en korrigerings- respektive kreditfaktura till den ursprungliga fakturan.",
                "Skapa därefter en ny, korrigerad faktura med rätt uppgifter.",
                "Skicka den korrigerade fakturan på nytt till gästen respektive fakturaadressen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "En redan skickad faktura bör av spårbarhetsskäl inte skrivas över direkt. Korrigeringen via en kreditfaktura bevarar det ursprungliga underlaget och gör ändringen spårbar.",
            },
          ],
        },
      ],
    },
  ],
};
