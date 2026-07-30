import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Kom godt i gang",
  description: "Opret konto og kom i gang på få minutter.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Opsætning",
      articles: [
        {
          slug: "willkommen",
          title: "Velkommen til myNextDays",
          excerpt: "Et overblik over PMS, kanalstyring, Markedsplads og app.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays er din centrale platform for ferieboliger og hoteller. I stedet for flere adskilte løsninger administrerer du tilgængelighed, priser, reservationer og gæstekommunikation ét sted — uanset om du driver et enkelt feriehus eller flere hotelværelser.",
            },
            { type: "h2", text: "De fire byggesten" },
            {
              type: "ul",
              items: [
                "PMS (Property-Management-System): boliger, kalender, priser, reservationer, opgaver og betalinger.",
                "Kanalstyring: forbindelse til portaler som Booking, Airbnb & Co. — én indtastning, mange portaler synkront.",
                "Platform-Markedsplads: myNextDays' egen markedsplads, en ligeværdig bookingkanal ved siden af portalerne.",
                "App: mobilapplikationen til gæster, ejere og medarbejdere med de samme data som på nettet.",
              ],
            },
            { type: "h2", text: "Sådan spiller byggestenene sammen" },
            {
              type: "p",
              text: "Du vedligeholder bolig, priser og tilgængelighed ét sted centralt i PMS'et. Derfra fordeler myNextDays automatisk dataene til alle aktive kanaler. En reservation — uanset hvilken kanal den kommer ind gennem — spærrer straks de tilsvarende nætter overalt, så dobbeltbookinger udelukkes.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Begynd med at opsætte konto og virksomhed, og opret derefter din første bolig — rækkefølgen sparer dig for rettelser senere.",
            },
            { type: "h2", text: "Næste skridt" },
            {
              type: "steps",
              items: [
                "Åbn Konto i menuen, og udfyld dine virksomhedsoplysninger.",
                "Opret din første bolig under Boliger.",
                "Kontrollér at faciliteter, fotos og priser er fuldstændige.",
                "Klik på Offentliggør for at gøre boligen synlig på alle kanaler.",
              ],
            },
            {
              type: "p",
              text: "Læs mere om de enkelte trin under [Opsæt konto & virksomhed](/hilfe/erste-schritte/konto-einrichten) og [Opret din første bolig](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Opsæt konto & virksomhed",
          excerpt: "Angiv stamdata, fakturaadresse og valuta korrekt.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Før du opretter boliger, skal du opsætte din virksomhed under Konto. Disse data bruges til fakturaer, portaler og afregning med myNextDays og bør derfor være fuldstændige og korrekte.",
            },
            { type: "h2", text: "Angiv stamdata" },
            {
              type: "steps",
              items: [
                "Åbn Konto i menuen.",
                "Angiv under Stamdata firmanavn eller navn på enkeltmandsvirksomheden, adresse og kontaktoplysninger.",
                "Angiv fakturaadressen — den vises på alle udstedte fakturaer.",
                "Vælg din basisvaluta. Den gælder for alle priser, indtil du ændrer den specifikt pr. bolig.",
              ],
            },
            { type: "h2", text: "Hvorfor valutaen er vigtig" },
            {
              type: "p",
              text: "Valutaen gættes eller udfyldes ikke automatisk: Mangler den, kan ingen pris vises eller afregnes korrekt. Derfor kræver myNextDays et bevidst valg ved opsætningen i stedet for at indsætte en standardværdi.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Hvis du senere ændrer valutaen for en bolig, omstilles alle tilknyttede rateplaner samtidig. Kontrollér priserne bagefter en gang.",
            },
            { type: "h2", text: "Fakturaadresse & afregning" },
            {
              type: "p",
              text: "Under Afregning i Konto ser du dine løbende fakturaer og den registrerede fakturaadresse. Hold den opdateret, især ved en ændring af selskabsform eller adresse, så fakturaer udstedes korrekt.",
            },
            {
              type: "ul",
              items: [
                "Firmanavn eller navn på enkeltmandsvirksomheden",
                "Fakturaadresse med land",
                "CVR- eller momsnummer, hvis relevant",
                "Basisvaluta for nye boliger",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Opret din første bolig",
          excerpt: "Sådan opretter du trin for trin din første bookbare bolig.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "En bolig i myNextDays er altid præcis én bookbar enhed: enten et enkelt værelse på et hotel eller en komplet ferielejlighed/feriehus. Driver du et hotel med flere værelser, opretter du en separat bolig for hvert værelse.",
            },
            { type: "h2", text: "Opret bolig" },
            {
              type: "steps",
              items: [
                "Åbn Boliger i menuen.",
                "Klik på Tilføj bolig.",
                "Vælg boligtypen: kategori, ejendomstype og udbudstype.",
                "Angiv adresse, kapacitet og grundpris i din registrerede valuta.",
                "Gem boligen som kladde for at fuldføre den senere.",
              ],
            },
            { type: "h2", text: "Hvad der stadig mangler bagefter" },
            {
              type: "p",
              text: "En nyoprettet bolig er indledningsvis en kladde og ikke synlig på nogen kanal. Tilføj faciliteter, fotos, beskrivelse og kalendertilgængelighed, før du offentliggør den — kun en fuldstændig bolig kan markedsføres pålideligt.",
            },
            {
              type: "ul",
              items: [
                "Vælg faciliteter fra kategorilisten",
                "Angiv mindst et titelfoto og en beskrivelse",
                "Registrér kapacitet (voksne, børn, senge) korrekt",
                "Kontrollér grundpris og kalendertilgængelighed",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Driver du flere værelsestyper, gentager du denne proces for hvert enkelt værelse — der findes ikke et overordnet bygningsniveau med værelser under sig.",
            },
            {
              type: "p",
              text: "Når alle obligatoriske felter er udfyldt, kan du offentliggøre boligen, se [Offentliggør en bolig](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Offentliggør en bolig",
          excerpt: "Ét klik aktiverer Platform-Markedsplads, portaler og hjemmeside samlet.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Offentliggørelse gør en bolig synlig og bookbar. Normalt er ét enkelt klik nok til at aktivere alle tre salgskanaler samtidig — men du kan altid justere synligheden for hver kanal individuelt.",
            },
            { type: "h2", text: "Sådan offentliggør du" },
            {
              type: "steps",
              items: [
                "Åbn boligen under Boliger.",
                "Kontrollér i fanen Oversigt, om alle obligatoriske oplysninger er markeret grønne.",
                "Klik på Offentliggør.",
                "Bekræft dialogen — Platform-Markedsplads, portaler og hjemmeside aktiveres.",
              ],
            },
            { type: "h2", text: "Styr kanalerne individuelt" },
            {
              type: "p",
              text: "Efter offentliggørelsen finder du i fanen Synlighed tre separate kontakter: Hjemmeside, Platform-Markedsplads og Portaler. Ønsker du eksempelvis kun at udbyde en bolig på din egen hjemmeside, men ikke via portaler, deaktiverer du blot den tilsvarende kontakt.",
            },
            {
              type: "ul",
              items: [
                "Hjemmeside: synlighed på din egen myNextDays-hjemmeside",
                "Platform-Markedsplads: synlighed på den globale myNextDays-markedsplads",
                "Portaler: synlighed på Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Disse tre kontakter er uafhængige af boligstatus (aktiv/inaktiv). En aktiv bolig kan alligevel være usynlig på enkelte kanaler.",
            },
            { type: "h2", text: "Spær boligen midlertidigt" },
            {
              type: "p",
              text: "Ønsker du at spærre en enkelt dag i stedet for hele boligen, bruger du stop-sell i kalenderen — det spærrer dagen på alle kanaler samtidig, uanset synligheds-kontakterne.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Forstå de tre salgskanaler",
          excerpt: "Portaler, Platform-Markedsplads og app i overblik.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays markedsfører hver bolig via flere ligeværdige veje samtidig. At forstå, hvordan disse spiller sammen, hjælper dig med målrettet at styre synlighed og priser.",
            },
            { type: "h2", text: "Portaler" },
            {
              type: "p",
              text: "Via kanalstyringen forbinder du din bolig med store bookingportaler som Booking, Airbnb & Co. Tilgængelighed og priser synkroniseres automatisk, så du ikke skal vedligeholde flere portalkalendere manuelt.",
            },
            { type: "h2", text: "Platform-Markedsplads" },
            {
              type: "p",
              text: "myNextDays-markedspladsen er en egen, global bookingkanal — sammenlignelig med Booking eller Airbnb, men en del af samme platform. Den er ikke en erstatning for »direkte booking«, men en ligeværdig kanal med sin egen synligheds-akse.",
            },
            { type: "h2", text: "App" },
            {
              type: "p",
              text: "Mobilappen giver gæster, ejere og medarbejdere adgang til de samme data som på nettet — for eksempel bookingdetaljer, beskeder eller opgaver, afhængigt af den respektive rolle.",
            },
            { type: "h2", text: "Tre adskilte synligheds-akser" },
            {
              type: "ul",
              items: [
                "Hjemmeside — din egen myNextDays-hjemmeside",
                "Platform-Markedsplads — den globale myNextDays-markedsplads",
                "Portaler — Booking, Airbnb & Co. via kanalstyringen",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Alle tre akser kan slås til/fra uafhængigt af hinanden. Stop-sell og boligstatus derimod virker på tværs af kanaler på alle tre samtidig.",
            },
          ],
        },
      ],
    },
  ],
};
