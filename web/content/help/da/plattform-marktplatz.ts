import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platform (Markedsplads)",
  description: "Sælg på myBestDays-markedspladsen.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Markedsplads",
      articles: [
        {
          slug: "der-marktplatz",
          title: "myBestDays-markedspladsen",
          excerpt: "Den globale myBestDays-markedsplads er en selvstændig bookingkanal ved siden af portaler og hjemmeside.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "myBestDays-markedspladsen (/plattform) er myBestDays' egen globale bookingkanal — sammenlignelig med Booking eller Airbnb, men en del af samme platform. Her gennemsøger gæster boliger fra alle tilsluttede virksomheder og booker direkte.",
            },
            { type: "h2", text: "Ikke »direkte«, men en ligestillet kanal" },
            {
              type: "p",
              text: "Markedspladsen erstatter ikke direkte booking via din egen hjemmeside. Den er en selvstændig, tredje salgskanal med sin egen synlighedsakse, sin egen gæstebase og sin egen provision — ligesom et portal, blot drevet af myBestDays selv.",
            },
            { type: "h2", text: "Sådan kommer boliger på markedspladsen" },
            {
              type: "ul",
              items: [
                "Boligen skal være aktiv (boligstatus tillader salg).",
                "Markedsplads-synligheden skal være slået til — adskilt fra portaler og hjemmeside.",
                "Der skal være tilgængelighed i kalenderen for den ønskede periode.",
              ],
            },
            { type: "h2", text: "Reservationer fra markedspladsen" },
            {
              type: "p",
              text: "En reservation fra markedspladsen spærrer straks de tilsvarende nætter på alle andre kanaler — ligesom en reservation fra et portal eller hjemmesiden. Den vises i din kalender og i reservationerne som enhver anden reservation, markeret med kanalen »Platform«.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-sell og en inaktiv boligstatus virker på tværs af kanaler og spærrer også markedspladsen — uafhængigt af markedsplads-synligheds-kontakten.",
            },
            {
              type: "p",
              text: "Hvordan du frigiver en bolig til markedspladsen, kan du læse under [List en bolig på markedspladsen](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "List en bolig på markedspladsen",
          excerpt: "Markedsplads-synlighed er en selvstændig kontakt, adskilt fra portaler og hjemmeside.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Synligheden på markedspladsen styrer du via en selvstændig kontakt på boligen — uafhængigt af, om den samme bolig også er synlig på portaler eller din hjemmeside.",
            },
            { type: "h2", text: "Sådan lister du en bolig" },
            {
              type: "steps",
              items: [
                "Åbn boligen under Boliger.",
                "Skift til fanen Synlighed.",
                "Aktivér kontakten Platform-markedsplads.",
                "Kontrollér, at boligstatus er aktiv, og at der er kalendertilgængelighed.",
              ],
            },
            { type: "h2", text: "Forudsætning: komplet profil" },
            {
              type: "p",
              text: "Markedspladsen viser kun boliger med fuldstændige oplysninger — titelfoto, beskrivelse, faciliteter og grundpris skal være angivet. Mangler der obligatoriske oplysninger, forbliver boligen usynlig, selvom kontakten er aktiveret.",
            },
            {
              type: "ul",
              items: [
                "Mindst ét titelfoto og en beskrivelse",
                "Facilitetsangivelser fra kategorilisten",
                "Belægning og grundpris i boligens angivne valuta",
                "Kalendertilgængelighed for den ønskede periode",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Klikker du på Udgiv, aktiverer myNextDays som udgangspunkt markedsplads, portaler og hjemmeside samlet — du kan altid slå markedsplads-kontakten fra igen separat bagefter.",
            },
            { type: "h2", text: "Fjern synlighed igen" },
            {
              type: "p",
              text: "Deaktiverer du kontakten Platform-markedsplads, forsvinder boligen fra markedsplads-søgningen. Allerede bekræftede reservationer berøres ikke og fortsætter som normalt, se [Markedsplads-provision](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Markedsplads-provision",
          excerpt: "For hver reservation, der formidles via markedspladsen, opkræves den provision, der er angivet i abonnementet.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Ligesom hos ethvert bookingportal opkræves der provision for reservationer, der kommer i stand via myBestDays-markedspladsen. Den beregnes pr. reservation og er uafhængig af eventuelle provisioner for portaler.",
            },
            { type: "h2", text: "Sådan beregnes provisionen" },
            {
              type: "p",
              text: "Beløbet afhænger af den provision, der er angivet i din virksomheds abonnement. Du finder den aktuelle sats til enhver tid under Konto i afsnittet Afregning — der antages ingen fast standardværdi, men den sats, der faktisk gælder for dit abonnement, vises.",
            },
            { type: "h2", text: "Hvor du kan se provisionen" },
            {
              type: "steps",
              items: [
                "Åbn Konto i menuen.",
                "Skift til afsnittet Afregning.",
                "Åbn en markedsplads-reservation for at se omsætning og provision i detaljer.",
                "Kontrollér oversigten over provisioner for den aktuelle afregningsperiode.",
              ],
            },
            { type: "h2", text: "Afgrænsning fra portal-provisioner" },
            {
              type: "ul",
              items: [
                "Markedsplads-provision gælder udelukkende for reservationer via myBestDays-markedspladsen.",
                "Portal-reservationer (Booking, Airbnb m.fl.) følger vilkårene for det pågældende portal.",
                "Reservationer via hjemmesiden følger de vilkår, der er angivet i dit abonnement, uden markedsplads-provision.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Provisionen beregnes automatisk ud fra dit abonnement. Et manglende eller uklart abonnement giver en tydelig fejlmeddelelse i stedet for en anslået værdi.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Gæsteprofil & anmeldelser",
          excerpt: "Markedsplads-gæster har en profil med reservationshistorik og kan afgive anmeldelser.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Gæster, der booker via myBestDays-markedspladsen, opretter deres egen gæsteprofil. Her samles deres reservationer, beskeder med virksomheder og afgivne anmeldelser — ligesom ved en portal-gæstekonto.",
            },
            { type: "h2", text: "Hvad du som virksomhed ser" },
            {
              type: "p",
              text: "I reservationsdetaljerne for en markedsplads-reservation finder du gæsteprofilen med tidligere ophold hos din virksomhed og, hvis gæsten har givet samtykke, offentligt synlige anmeldelser af andre overnatningssteder.",
            },
            { type: "h2", text: "Anmeldelser efter opholdet" },
            {
              type: "steps",
              items: [
                "Efter check-out modtager gæsten en opfordring til at afgive en anmeldelse.",
                "Anmeldelsen vises på boligsiden på markedspladsen efter en kort kontrol.",
                "Som virksomhed kan du svare offentligt på enhver anmeldelse.",
                "Usaglige eller krænkende anmeldelser kan du indsende til kontrol via Rapportér.",
              ],
            },
            {
              type: "ul",
              items: [
                "Anmeldelser er knyttet til en faktisk reservation — ingen anmeldelse uden ophold.",
                "Gæsten vurderer renlighed, kommunikation, beliggenhed og pris-kvalitet-forhold.",
                "Dit svar er synligt for alle besøgende på markedspladsen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Gode anmeldelser påvirker direkte din boligs placering i markedsplads-søgningen — reager hurtigt og sagligt på kritik.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blokerede personer",
          excerpt: "En virksomhed kan blokere en gæst, så beskeder og reservationer forhindres.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Opstår der problemer med en gæst, kan du som virksomhed blokere vedkommende. En blokeret person kan ikke længere sende dig beskeder eller oprette en ny reservation hos din virksomhed.",
            },
            { type: "h2", text: "Blokér en person" },
            {
              type: "steps",
              items: [
                "Åbn beskedforløbet eller reservationen med den pågældende gæst.",
                "Klik på Blokér gæst.",
                "Bekræft dialogen — blokeringen gælder øjeblikkeligt.",
                "Den blokerede person vises herefter under Konto under Blokerede personer.",
              ],
            },
            { type: "h2", text: "Hvad blokeringen betyder" },
            {
              type: "ul",
              items: [
                "Gæsten kan ikke længere sende nye beskeder til din virksomhed.",
                "Gæsten kan ikke oprette en ny reservation hos din virksomhed.",
                "En igangværende reservation med en allerede bekræftet ankomst inden for de næste to uger berøres ikke af blokeringen, så opholdet kan afvikles korrekt.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokeringen gælder udelukkende for din virksomhed. Andre virksomheder på markedspladsen ser ikke blokeringen og berøres ikke af den.",
            },
            { type: "h2", text: "Ophæv blokeringen igen" },
            {
              type: "p",
              text: "Åbn Konto og dér Blokerede personer. Vælg posten, og klik på Ophæv blokering — gæsten kan derefter igen sende beskeder og booke.",
            },
          ],
        },
      ],
    },
  ],
};
