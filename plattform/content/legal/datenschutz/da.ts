import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Privatlivspolitik",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Denne politik beskriver, hvilke personoplysninger myBestDays behandler, til hvilke formål, på hvilket retsgrundlag, og hvilke rettigheder du har. Den gælder for websitet, mobilapplikationerne og alle øvrige adgange til platformen.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Dataansvarlig og databeskyttelsesrådgiver",
      paragraphs: [
        `Dataansvarlig i henhold til forordning (EU) 2016/679 (databeskyttelsesforordningen) er ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danmark, CVR-nr. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. De fuldstændige udbyderoplysninger findes i [Juridiske oplysninger](https://mybestdays.dk/rechtliches/impressum).`,
        "Der er ikke udpeget en databeskyttelsesrådgiver; betingelserne i artikel 37 i forordningen er ikke opfyldt. Henvendelser om databeskyttelse rettes til ovenstående e-mailadresse.",
        "Udbydere, hos hvem du booker, er selvstændigt dataansvarlige for de oplysninger, de modtager fra os. For dem gælder [Databeskyttelsesstandarder for værter](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Hvilke oplysninger vi behandler",
      paragraphs: ["Alt efter hvordan du bruger platformen, behandler vi:"],
      list: [
        "stamdata — navn, e-mailadresse, telefonnummer, sprog og valuta, adgangskode i krypteret form;",
        "bookingdata — booket indkvartering, periode, antal og navne på rejsende, særlige ønsker, bookingstatus;",
        "betalingsdata — beløb, valuta, betalingsstatus, de sidste cifre i betalingsmidlet samt vores betalingstjenesteudbyders transaktionsreference. Fuldstændige kortoplysninger når ikke frem til os;",
        "kommunikationsdata — beskeder mellem dig og udbyderen, henvendelser til vores kundeservice, klager;",
        "indholdsdata — anmeldelser, billeder, ønskelister;",
        "brugsdata — besøgte sider, søgeforespørgsler, tidspunkt for adgangen;",
        "tekniske data — IP-adresse, browser- og enhedsidentifikatorer, styresystem, referrer.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Formål og retsgrundlag",
      paragraphs: [
        "Levering af platformen, konto, søgning, booking, betalingsafvikling og kommunikation med udbyderen — artikel 6, stk. 1, litra b) (aftale eller foranstaltninger forud for aftale).",
        "Kundeservice, klagebehandling og tvistbilæggelse — artikel 6, stk. 1, litra b) og f).",
        "Opdagelse og forhindring af svindel, misbrug og sikkerhedshændelser samt håndhævelse af vores vilkår — artikel 6, stk. 1, litra f) (legitim interesse i en sikker markedsplads).",
        "Anmeldelser og offentliggørelsen heraf — artikel 6, stk. 1, litra b) og f).",
        "Opfyldelse af retlige forpligtelser, navnlig bogførings- og skattemæssige opbevaringspligter, indberetningspligten efter direktiv (EU) 2021/514 (DAC7) og pligterne efter forordning (EU) 2022/2065 — artikel 6, stk. 1, litra c).",
        "Forbedring af platformen gennem analyse af aggregerede brugsdata — artikel 6, stk. 1, litra f).",
        "Markedsføringsmails og ikke-nødvendige cookies — artikel 6, stk. 1, litra a) (samtykke), som du til enhver tid kan trække tilbage med virkning for fremtiden.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Modtagere",
      paragraphs: [
        "Udbydere modtager de oplysninger, de har brug for til at gennemføre din booking og opfylde deres retlige forpligtelser — navnlig navn, kontaktoplysninger, periode, antal rejsende og dine beskeder til dem.",
        "Vores betalingstjenesteudbyder Stripe behandler betalingsdata som selvstændig dataansvarlig; desuden gælder [Stripes privatlivspolitik](https://stripe.com/privacy).",
        "Leverandører, der for os leverer hosting, databasedrift, e-mailudsendelse, fejlfinding og kundeserviceværktøjer, behandler udelukkende data efter instruks på grundlag af en aftale efter artikel 28 i forordningen.",
        "Myndigheder og domstole modtager kun data, for så vidt vi er forpligtet hertil; se [Retningslinjer for myndigheds- og politianmodninger](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Skattemyndigheder modtager de oplysninger om udbydere, der skal indberettes efter DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Overførsel til tredjelande",
      paragraphs: [
        "Vores servere og vores databehandleres servere står i Den Europæiske Union.",
        "For så vidt der i enkelttilfælde sker behandling uden for Det Europæiske Økonomiske Samarbejdsområde, sker det kun på grundlag af en tilstrækkelighedsafgørelse fra Europa-Kommissionen eller standardkontraktbestemmelserne efter artikel 46, stk. 2, litra c), i forordningen sammen med supplerende beskyttelsesforanstaltninger.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Opbevaringsperioder",
      paragraphs: [
        "Kontodata opbevarer vi, så længe din konto består, og sletter dem derefter, medmindre en opbevaringspligt er til hinder herfor.",
        "Bookings- og betalingsdata er omfattet af bogførings- og skattemæssige opbevaringsfrister; efter dansk bogføringslov er det som udgangspunkt fem år fra udgangen af det regnskabsår, oplysningerne vedrører.",
        "Beskeder om en booking opbevarer vi indtil tre år efter opholdets afslutning, så tvister kan afklares.",
        "Anmeldelser forbliver i anonymiseret form efter sletning af din konto, fordi de er en del af en indkvarterings vurderingsgrundlag.",
        "Data om svindel- og misbrugssager opbevarer vi, så længe det er nødvendigt for at afværge yderligere overtrædelser, dog højst tre år efter den seneste hændelse.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Dine rettigheder",
      paragraphs: ["Efter forordningen har du følgende rettigheder:"],
      list: [
        "indsigt i de oplysninger, der er gemt om dig (artikel 15);",
        "berigtigelse af urigtige oplysninger (artikel 16);",
        "sletning (artikel 17), medmindre en opbevaringspligt er til hinder herfor;",
        "begrænsning af behandlingen (artikel 18);",
        "dataportabilitet (artikel 20);",
        "indsigelse mod en behandling baseret på legitime interesser (artikel 21), navnlig mod direkte markedsføring;",
        "tilbagetrækning af et afgivet samtykke med virkning for fremtiden (artikel 7, stk. 3);",
        `klage til en tilsynsmyndighed (artikel 77) — kompetent er myndigheden på dit bopælssted, dit arbejdssted eller stedet for den påståede overtrædelse. På den dataansvarliges hjemsted er det ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danmark, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Sådan udøver du dine rettigheder",
      paragraphs: [
        `Mange oplysninger kan du se, ændre eller slette direkte i din konto. For alt øvrigt henvender du dig til ${ANBIETER.email}.`,
        "Vi svarer straks og senest inden for en måned. Kan vi ikke overholde fristen, meddeler vi dig det med en begrundelse.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatiserede afgørelser",
      paragraphs: [
        "Vi anvender automatiserede metoder til at opdage svindel, misbrug og ulovligt indhold. Fører en sådan metode til en foranstaltning mod din konto eller dit indhold, begrunder vi den, og du kan forlange en efterprøvelse af et menneske.",
        "En afgørelse alene baseret på automatisk behandling med retsvirkning i henhold til artikel 22 i forordningen træffer vi ikke.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Pligt til at afgive oplysninger",
      paragraphs: [
        "De oplysninger, der er nødvendige for en booking, skal du afgive; uden dem kan der ikke indgås en aftale, og indkvarteringen kan ikke stilles til rådighed. Alle øvrige oplysninger er frivillige.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Ændringer af denne politik",
      paragraphs: [
        "Vi tilpasser denne politik, når behandlingen eller retstilstanden ændrer sig. Den til enhver tid gældende version kan hentes her; opdateringsdatoen står øverst.",
      ],
    },
  ],
};
