import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Forordningen om digitale tjenester",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "myBestDays er en formidlingstjeneste og en onlineplatform i henhold til forordning (EU) 2022/2065 om et indre marked for digitale tjenester (forordningen om digitale tjenester, DSA). Denne side samler de oplysninger og procedurer, forordningen kræver.",
    "myBestDays er ikke en meget stor onlineplatform i henhold til artikel 33 i forordningen. De yderligere pligter, der gælder for disse — kortlægning af systemiske risici, uafhængig revision, annoncearkiv og offentliggørelse af det månedlige brugertal efter den dér fastsatte procedure — påhviler os derfor ikke.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kontaktpunkter (artikel 11 og 12)",
      paragraphs: [
        `Centralt kontaktpunkt for medlemsstaternes myndigheder, Kommissionen og Det Europæiske Råd for Digitale Tjenester: ${ANBIETER.email}, pr. post ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danmark.`,
        `Centralt kontaktpunkt for brugere: ${ANBIETER.email}. Du når os der umiddelbart og uden automatiseret mellemled.`,
        "Med begge kontaktpunkter kan der kommunikeres på dansk, tysk og engelsk.",
        "En retlig repræsentant i Unionen efter artikel 13 skal ikke udpeges: operatøren er etableret i Danmark og dermed i Unionen.",
        `Kompetent koordinator for digitale tjenester efter artikel 49: ${DSA_KOORDINATOR.name}, Danmark ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Anmeld ulovligt indhold (artikel 16)",
      paragraphs: [
        "Enhver kan anmelde indhold til os, som vedkommende anser for ulovligt. Brug anmeldelsesfunktionen, der er tilgængelig ved hvert opslag, hver anmeldelse og hver besked, eller kontaktpunktet for brugere.",
        "For at vi kan vurdere en anmeldelse uden en indgående retlig undersøgelse, bør den indeholde:",
      ],
      list: [
        "en tilstrækkeligt begrundet redegørelse for, hvorfor indholdet er ulovligt;",
        "den præcise elektroniske placering, navnlig URL'en;",
        "navn og e-mailadresse på den anmeldende — undtagen ved anmeldelser om strafbare handlinger mod børns seksuelle selvbestemmelse, hvor angivelsen er frivillig;",
        "erklæringen om, at oplysningerne efter bedste overbevisning er rigtige og fuldstændige.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Hvordan vi behandler anmeldelser",
      paragraphs: [
        "Vi bekræfter modtagelsen straks og træffer afgørelse rettidigt, omhyggeligt, ikke-vilkårligt og objektivt.",
        "Indeholder en anmeldelse oplysningerne fra afsnit 2, giver den os kendskab i henhold til artikel 6 i forordningen.",
        "Vores afgørelse meddeler vi den anmeldende med oplysning om klagemulighederne.",
        "Behandles en anmeldelse automatiseret, oplyser vi det.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Begrundelse af foranstaltninger (artikel 17)",
      paragraphs: [
        "Begrænser vi synligheden af et indhold, fjerner det, spærrer adgangen til det, suspenderer betalinger, spærrer leveringen af tjenesten eller kontoen, modtager den berørte en klar og specifik begrundelse.",
        "Begrundelsen angiver foranstaltningens art og omfang, dens geografiske og tidsmæssige rækkevidde, de faktiske omstændigheder bag afgørelsen, om automatiseret behandling var involveret, retsgrundlaget eller den tilsidesatte aftalebestemmelse samt de tilgængelige klagemuligheder.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Mistanke om strafbare handlinger (artikel 18)",
      paragraphs: [
        "Foreligger der holdepunkter for en strafbar handling, der indebærer en fare for en persons liv eller sikkerhed, underretter vi straks de kompetente retshåndhævende eller retlige myndigheder.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Intern klagebehandling (artikel 20)",
      paragraphs: [
        "Mod enhver foranstaltning efter afsnit 4 og mod afvisning af en anmeldelse kan der inden for seks måneder klages vederlagsfrit.",
        "Klager behandles rettidigt, ikke-diskriminerende og omhyggeligt — under tilsyn af kvalificerede personer og ikke alene med automatiserede midler.",
        "Viser en klage sig begrundet, ophæver vi foranstaltningen. Vejen er beskrevet under [Klager og tvistbilæggelse](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Udenretslig tvistbilæggelse (artikel 21)",
      paragraphs: [
        "Ved tvister om foranstaltninger efter afsnit 4 kan brugere henvende sig til et udenretsligt tvistbilæggelsesorgan, der er certificeret af den kompetente koordinator for digitale tjenester. Europa-Kommissionen fører listen over certificerede organer.",
        "Disse organers afgørelser er ikke bindende for os; vi er ikke forpligtet til at deltage i procedurer hos uafhængige udbydere. Adgangen til domstolene berøres ikke.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Pålidelige indberettere (artikel 22)",
      paragraphs: [
        "Anmeldelser indgivet af en indberetter, der er anerkendt som pålidelig indberetter inden for sit fagområde, behandler vi prioriteret.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Foranstaltninger mod misbrug (artikel 23)",
      paragraphs: [
        "Konti, hvorigennem der hyppigt stilles åbenbart ulovligt indhold til rådighed, spærrer vi i en rimelig periode efter forudgående advarsel.",
        "Behandlingen af anmeldelser og klager suspenderer vi for personer, der hyppigt indgiver åbenbart ubegrundede anmeldelser eller klager — ligeledes efter forudgående advarsel.",
        "Vi vurderer herved altid den enkelte sag: antal, andel og grovhed af de berørte forhold samt hensigten.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Gennemsigtighedsrapporter (artikel 15 og 24)",
      paragraphs: [
        "Vi offentliggør årligt en rapport om indholdsmoderation: antallet af myndighedspåbud, antallet og arten af anmeldelser, trufne foranstaltninger, antallet af klager og deres udfald, oplysninger om anvendelsen af automatiserede metoder samt antallet af tvister ved udenretslige organer.",
        `Mikrovirksomheder og små virksomheder er efter artikel 19 i forordningen fritaget for en del af disse pligter. Så længe fritagelsen gælder, stiller vi oplysningerne til rådighed på anmodning under ${ANBIETER.email}; så snart den første rapport er offentliggjort, linkes den her.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Erhvervsdrivendes sporbarhed (artikel 30 til 32)",
      paragraphs: [
        "Udbydere, der handler erhvervsmæssigt på platformen, må først udbyde, når de har givet os navn, adresse, telefonnummer, e-mailadresse, registreringsoplysninger, momsnummer og betalingskonto, og deres oplysninger er plausible.",
        "Disse oplysninger viser vi i opslaget, for så vidt forordningen foreskriver det.",
        "Erfarer vi, at et opslag vedrørte et ulovligt produkt eller en ulovlig tjenesteydelse, underretter vi de berørte gæster, hvis vi har deres kontaktoplysninger.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Anbefalingssystemer (artikel 27)",
      paragraphs: [
        "De væsentligste parametre for søgeresultaternes rækkefølge og for anbefalinger samt muligheden for at påvirke dem er beskrevet under [Priser, rangordning og anbefalinger](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reklame (artikel 26)",
      paragraphs: [
        "Vi viser i øjeblikket ingen betalt reklame fra tredjeparter og ingen betalte placeringer i søgeresultaterne.",
        "Skulle vi indføre reklame, markerer vi den tydeligt, angiver annoncøren og de væsentligste parametre for visningen. Reklame på grundlag af særlige kategorier af personoplysninger efter artikel 9 i forordning (EU) 2016/679 og reklame til mindreårige på grundlag af profilering udelukker vi.",
      ],
    },
  ],
};
