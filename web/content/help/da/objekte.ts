import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Boliger & faciliteter",
  description: "Opret og vedligehold værelser og ferieboliger.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Administrér boliger",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Bolig = én bookbar enhed",
          excerpt: "Hvorfor hver bolig i myNextDays er præcis én bookbar enhed.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "I myNextDays er en bolig altid præcis én bookbar enhed — et enkelt værelse på et hotel eller en komplet ferielejlighed/feriehus. Dette princip gælder uanset om du driver et feriehus, en ferielejlighed eller et hotel, og det er grundlaget for tilgængelighed, priser og reservationer.",
            },
            { type: "h2", text: "Ingen bygning med værelser under sig" },
            {
              type: "p",
              text: "En almindelig misforståelse er at afbilde en hotelbygning som én bolig med flere værelser under sig. Det er ikke understøttet i myNextDays. Driver du for eksempel et hotel med otte dobbeltværelser og fire enkeltværelser, opretter du tolv separate boliger — ikke én bolig med et antal værelser.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Et felt som »antal værelser« på boligniveau findes bevidst ikke. Hvert værelse skal have sin egen bolig med egen kalender og egne priser.",
            },
            { type: "h2", text: "Ferieboliger" },
            {
              type: "p",
              text: "Ved et feriehus eller en ferielejlighed svarer hele boligen til den bookbare enhed. Der er ingen yderligere opdeling her — en feriebolig er altid en selvstændig bolig med egen kalender.",
            },
            { type: "h2", text: "Hvorfor det er vigtigt" },
            {
              type: "ul",
              items: [
                "Hver bolig har sin egen tilgængelighedskalender — dobbeltbookinger forhindres boligpræcist.",
                "Priser, faciliteter og fotos gælder pr. bolig, ikke pr. bygning.",
                "En bolig tilhører altid præcis én ejer — ingen flerdobbelt tilknytning.",
                "Kanal-synlighed (hjemmeside, Platform-Markedsplads, portaler) styres pr. bolig.",
              ],
            },
            {
              type: "p",
              text: "Læs mere om, hvordan du vælger den rette boligtype til dit værelse eller din feriebolig, under [Fastlæg boligtype](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Fastlæg boligtype",
          excerpt: "Tilknyt kategori, ejendomstype og udbudstype korrekt.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Boligtypen bestemmer, hvordan din bolig kategoriseres og filtreres på portaler og Platform-Markedspladsen. Den består af tre indbyrdes afhængige valgfelter, som du gennemgår, når du opretter eller redigerer en bolig.",
            },
            { type: "h2", text: "De tre valgniveauer" },
            {
              type: "steps",
              items: [
                "Vælg først kategorien — for eksempel ferieophold eller hotel.",
                "Vælg derefter ejendomstypen — for eksempel ferielejlighed, feriehus, dobbeltværelse eller enkeltværelse.",
                "Vælg udbudstypen — for eksempel hele boligen eller et privat værelse.",
                "Udfyld de ekstra felter, der vises afhængigt af dit valg, for eksempel sengetype eller etage.",
              ],
            },
            { type: "h2", text: "Hvorfor rækkefølgen er vigtig" },
            {
              type: "p",
              text: "De tre dropdowns er indbyrdes afhængige: Valget af kategori begrænser de tilgængelige ejendomstyper, og valget af ejendomstype begrænser igen udbudstyperne. Sådan opstår kun meningsfulde kombinationer, som dem der også bruges på store portaler.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ændrer du kategorien senere, kontrollerer myNextDays, om ejendomstype og udbudstype stadig passer til den, og beder dig eventuelt om at vælge på ny.",
            },
            { type: "h2", text: "Redigér boligtype" },
            {
              type: "p",
              text: "Åbn den ønskede bolig under Boliger i menuen, og skift til fanen Grunddata. Der finder du de tre dropdowns under Boligtype. Gemmer du din ændring, videregives den nye kategorisering til alle aktive kanaler.",
            },
            {
              type: "ul",
              items: [
                "Kategori: overordnet kategorisering (f.eks. ferieophold, hotel)",
                "Ejendomstype: konkret boligtype (f.eks. ferielejlighed, dobbeltværelse)",
                "Udbudstype: hvad præcis der bookes (f.eks. hele boligen, privat værelse)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Vedligehold faciliteter",
          excerpt: "Vælg faciliteter og hold dem opdateret.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "En bolig faciliteter påvirker afgørende, hvor godt den findes og filtreres på portaler. Gæster filtrerer målrettet efter kendetegn som wifi, køkken eller parkering — manglende oplysninger kan udelukke en bolig fra søgeresultater.",
            },
            { type: "h2", text: "Vælg faciliteter" },
            {
              type: "steps",
              items: [
                "Åbn boligen, og skift til fanen Faciliteter.",
                "Vælg alle relevante kendetegn fra den foruddefinerede liste.",
                "Tilføj om nødvendigt detaljer som antal parkeringspladser eller køkkentype.",
                "Gem ændringerne — de sendes automatisk til alle aktive portaler.",
              ],
            },
            { type: "h2", text: "Hvor kendetegnene stammer fra" },
            {
              type: "p",
              text: "Facilitetslisten følger de store portalers kendetegnskatalog, så dine oplysninger kan tilknyttes korrekt der. Egne, frit opfundne kendetegn er ikke understøttet, da de ikke kan overføres pænt til portaler.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kontrollér faciliteterne efter hver bygningsmæssig ændring — for eksempel et nyt klimaanlæg eller et ekstra badeværelse — så oplysningerne forbliver opdaterede på alle kanaler.",
            },
            { type: "h2", text: "Almindelige kendetegnsgrupper" },
            {
              type: "ul",
              items: [
                "Grundudstyr: wifi, varme, klimaanlæg",
                "Køkken & forplejning: fuldt udstyret køkken, opvaskemaskine, kaffemaskine",
                "Bad & vaskeri: eget badeværelse, vaskemaskine, håndklæder",
                "Udendørs område: balkon, terrasse, have, parkering",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotos & beskrivelse",
          excerpt: "Overbevisende billeder og tekster for flere bookinger.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Fotos og beskrivelse er for gæster det vigtigste beslutningsgrundlag. En bolig kan først offentliggøres, når mindst et titelfoto og en beskrivelse er registreret.",
            },
            { type: "h2", text: "Upload fotos" },
            {
              type: "steps",
              items: [
                "Åbn boligen, og skift til fanen Fotos.",
                "Træk billedfiler ind i uploadområdet, eller vælg dem via fildialogen.",
                "Fastlæg et titelfoto — det vises i søgeresultater og kort.",
                "Sortér de øvrige fotos i en meningsfuld rækkefølge ved at trække dem.",
              ],
            },
            { type: "h2", text: "Skriv beskrivelse" },
            {
              type: "p",
              text: "Skift til fanen Beskrivelse, og angiv en titel samt en løbende tekst. Beskriv boligens beliggenhed, særlige kendetegn og målgruppe konkret — generelle floskler virker mindre overbevisende på portaler end håndgribelige detaljer.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fotos fra andre boliger eller fra internettet må ikke bruges — portaler kontrollerer dette og kan spærre boliger ved overtrædelser.",
            },
            { type: "h2", text: "Anbefalinger til gode fotos" },
            {
              type: "ul",
              items: [
                "Mindst fem fotos, gerne et for hvert rum",
                "Liggende format, god belysning, ingen vandmærker",
                "Titelfotoet viser boligen så indbydende og entydigt som muligt",
                "Opdatér regelmæssigt, især efter renoveringer",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Kapacitet & belægning",
          excerpt: "Angiv maksimalt antal gæster og sengefordeling korrekt.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Kapaciteten fastlægger, hvor mange gæster en bolig kan rumme, og kontrolleres ved hver søgning og booking. Forkerte oplysninger fører enten til afviste forespørgsler eller overbelægning — begge dele bør du undgå.",
            },
            { type: "h2", text: "Angiv kapacitet" },
            {
              type: "steps",
              items: [
                "Åbn boligen, og skift til fanen Kapacitet.",
                "Angiv det maksimale antal voksne.",
                "Angiv det maksimale antal børn, hvis tilladt.",
                "Registrér sengefordelingen pr. rum, for eksempel en dobbeltseng og to enkeltsenge.",
              ],
            },
            { type: "h2", text: "Grænser for kapaciteten" },
            {
              type: "p",
              text: "Ved en bookingforespørgsel kontrollerer myNextDays automatisk, om det forespurgte antal gæster ligger inden for den registrerede kapacitet. Forespørgsler, der overstiger den maksimale kapacitet, afvises eller vises slet ikke som bookbare.",
            },
            {
              type: "note",
              variant: "info",
              text: "En ekstraseng eller babyseng øger kun den reelle kapacitet, hvis du udtrykkeligt registrerer den i sengefordelingen — ellers forbliver det maksimale antal gæster uændret.",
            },
            { type: "h2", text: "Typiske fejlkilder" },
            {
              type: "ul",
              items: [
                "Maksimalt antal gæster sat for højt, selvom der kun er få senge",
                "Antal børn glemt, selvom boligen henvender sig til familier",
                "Sengefordeling ikke opdateret efter en renovering",
              ],
            },
            {
              type: "p",
              text: "Passer kapacitet og faciliteter ikke sammen, bør du desuden kontrollere fanen [Faciliteter](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Boligstatus & synlighed",
          excerpt: "Forskellen mellem aktiv/inaktiv og de tre kanal-akser.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays skelner mellem to forskellige ting, der ofte forveksles: boligstatus (aktiv eller inaktiv) og synlighed på de enkelte salgskanaler. Begge dele styrer du hver for sig.",
            },
            { type: "h2", text: "Boligstatus" },
            {
              type: "p",
              text: "Statussen active betyder, at en bolig grundlæggende er salgbar. Statussen inactive sætter en bolig helt ud af drift — for eksempel ved en langvarig renovering. En inaktiv bolig er ikke bookbar på nogen kanal, uanset kanal-kontakterne.",
            },
            { type: "h2", text: "De tre kanal-akser" },
            {
              type: "p",
              text: "Er en bolig aktiv, afgør tre uafhængige kontakter, hvor præcis den er synlig:",
            },
            {
              type: "ul",
              items: [
                "Hjemmeside — synlighed på din egen myNextDays-hjemmeside",
                "Platform-Markedsplads — synlighed på den globale myNextDays-markedsplads",
                "Portaler — synlighed på Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Disse tre akser er fuldstændig uafhængige af boligstatus og af hinanden. En aktiv bolig kan f.eks. kun være synlig på hjemmesiden, men ikke på portaler.",
            },
            { type: "h2", text: "Ændr status" },
            {
              type: "steps",
              items: [
                "Åbn boligen, og skift til fanen Oversigt.",
                "Sæt statussen til aktiv eller inaktiv.",
                "Justér om nødvendigt også de tre kanal-kontakter i fanen Synlighed.",
                "Gem ændringen — den virker straks på alle berørte kanaler.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Til en kortvarig spærring af enkelte dage bruger du i stedet stop-sell i kalenderen — det spærrer målrettet dage på alle kanaler uden at deaktivere hele boligen.",
            },
          ],
        },
      ],
    },
  ],
};
