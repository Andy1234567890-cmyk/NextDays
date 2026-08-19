import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Reserveringen & kalender",
  description: "Reserveringen en kalender onder controle houden.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Reserveringen & kalender",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Overboekingen betrouwbaar voorkomen",
          excerpt: "Zo zorgt u dat een object nooit dubbel wordt geboekt.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Een object wordt via meerdere kanalen tegelijk verkocht — portalen zoals Booking, Airbnb & Co., het eigen platform en de app. Een overboeking ontstaat wanneer beschikbaarheid op het ene kanaal niet tijdig wordt geblokkeerd nadat op een ander kanaal is geboekt.",
            },
            {
              type: "steps",
              items: [
                "Controleer in het belegplan dat elk object precies één rij met één boekbare eenheid is — geen gedeelde capaciteit van meerdere kamers.",
                "Laat nieuwe boekingen uitsluitend via het belegplan of de gekoppelde kanalen aanmaken, nooit door handmatig afzonderlijke dagen te bewerken.",
                "Controleer na elke boeking dat de geboekte nachten meteen als bezet verschijnen in de kalender.",
                "Gebruik bij technische problemen of onderhoud direct stopverkoop, in plaats van de dag open te laten.",
                "Controleer bij onduidelijkheid de boekingstijdlijn van de betreffende reservering om het tijdsverloop na te gaan.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Wijzig nachten of blokkeringen nooit handmatig buiten het belegplan om — alleen zo blijft gegarandeerd dat alle kanalen dezelfde beschikbaarheidsstand zien en er geen gat ontstaat voor een dubbele boeking.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Een boeking naar een ander object verplaatsen",
          excerpt: "Zo verplaatst u een bestaande reservering netjes naar een ander object.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Soms moet een gast van het ene object naar het andere verhuizen, bijvoorbeeld vanwege een technisch defect of op wens van de gast. Bij de verhuizing worden de bestaande kalendernachten automatisch vrijgegeven en in het doelobject opnieuw bezet.",
            },
            {
              type: "steps",
              items: [
                "Open de betreffende boeking in de boekingstijdlijn.",
                "Kies in het actiemenu Object wisselen respectievelijk Verplaatsen.",
                "Kies het doelobject en controleer de beschikbaarheid ervan in de gekozen periode.",
                "Bevestig de verplaatsing.",
                "Controleer vervolgens in het belegplan dat de oude nachten in het oorspronkelijke object weer als beschikbaar worden weergegeven.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Het systeem geeft de oude nachten automatisch vrij — u hoeft de oorspronkelijke periode niet zelf handmatig te openen. Informeer de gast over de objectwissel, vooral wanneer voorzieningen of toegang verschillen.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Een langetermijnboeking aanmaken",
          excerpt: "Zo legt u een reservering over een langere periode correct vast.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Voor langetermijngasten — bijvoorbeeld meerdere weken of maanden — maakt u een reservering aan zoals gebruikelijk, maar let u extra op minimumverblijf, betalingsregels en de kanaalzichtbaarheid van het object over de hele periode.",
            },
            {
              type: "steps",
              items: [
                "Open het belegplan van het gewenste object en markeer de volledige periode.",
                "Maak de boeking aan met de gastgegevens en de geplande aankomst- en vertrekdatum.",
                "Stel indien nodig een betalingsregel in met een aanbetaling en restbetaling, in plaats van het volledige bedrag direct verschuldigd te stellen.",
                "Controleer dat geen minimum- of maximumverblijfregel in strijd is met de lange periode.",
                "Sla de boeking op en controleer dat de volledige periode correct als bezet verschijnt in de kalender.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Bij zeer lange verblijven is een restbetaling in meerdere deelbedragen aan te raden in plaats van één grote vervaldatum — zo blijft het betalingsrisico overzichtelijk. Meer hierover onder [De restbetaling automatiseren](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
