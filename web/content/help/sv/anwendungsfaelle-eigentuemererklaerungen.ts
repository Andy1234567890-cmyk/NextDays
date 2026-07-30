import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Ägarredovisningar",
  description: "Skapa ägarredovisningar.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Ägarredovisningar",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Skapa ett ägarstatement",
          excerpt: "Så skapar du en överskådlig redovisning av en ägares period.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Förvaltar du objekt för ägare behöver de regelbundet en spårbar översikt över intäkter, avdragen provision och utbetalning för sina objekt under en viss period — ägarstatementet sammanfattar denna data automatiskt.",
            },
            {
              type: "steps",
              items: [
                "Öppna avsnittet Ägare i kontot och välj den berörda ägaren.",
                "Välj den redovisningsperiod som statementet ska skapas för.",
                "Kontrollera att alla objekt för denna ägare är korrekt kopplade, eftersom bara kopplade objekt ingår i statementet.",
                "Låt statementet skapas och kontrollera de listade reservationerna för fullständighet.",
                "Gör statementet tillgängligt för ägaren via ägaråtkomsten eller exportera det som ett dokument.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Statementet visar varje reservation med belopp i respektive objekts valuta — det finns ingen schablonmässig valutaangivelse, eftersom flera objekt även kan ha olika valutor. Mer om kopplingen under [Koppla objekt till en ägare](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Fakturera provision med ägaren",
          excerpt: "Så säkerställer du att din provision beräknas korrekt utifrån ägarens intäkter.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Din provision för förvaltningen av ett objekt anges i ägarens tariff och dras automatiskt av från bruttointäkterna vid varje statement. För att redovisningen ska stämma måste provisionssatsen vara korrekt inställd innan den första bokningen under perioden.",
            },
            {
              type: "steps",
              items: [
                "Öppna den berörda ägarens tariff i kontot och kontrollera den angivna provisionssatsen.",
                "Justera satsen vid behov innan nya reservationer kommer in under den kommande redovisningsperioden.",
                "Skapa ägarstatementet för perioden och kontrollera att provisionen redovisas korrekt per reservation.",
                "Kontrollera rimligheten i summan av bruttointäkter, avdragen provision och nettoutbetalning.",
                "Klargör avvikelser direkt med ägaren innan statementet godkänns, istället för att ändra statementet i efterhand.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En ändring av provisionssatsen i efterhand gäller bara för framtida perioder, inte retroaktivt för redan skapade statement. Kontrollera därför satsen i god tid före starten av en ny redovisningsperiod — se även [Ägarredovisning (statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
