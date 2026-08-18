import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Klachten en geschillenbeslechting",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "Deze pagina beschrijft hoe u myBestDays bereikt, hoe wij klachten behandelen en welke wegen u openstaan wanneer u het met onze beslissing niet eens bent.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Hoe u ons bereikt",
      paragraphs: [
        "Het snelst bereikt u ons via het Helpcentrum en de daar vermelde contactwegen. Voor een bestaande boeking gebruikt u de berichtenfunctie in uw account — dan liggen boeking en verloop al bij ons.",
        `Schriftelijk bereikt u ons op ${ANBIETER.email} of ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Denemarken; telefonisch op ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Wat uw klacht zou moeten bevatten",
      paragraphs: ["Om snel te kunnen helpen, vermeldt u:"],
      list: [
        "uw boekingsnummer en het voor de boeking gebruikte e-mailadres;",
        "een korte beschrijving van het probleem;",
        "wat u als oplossing wenst;",
        "de bijbehorende bewijzen — foto's, berichten, bonnen, rekeningafschriften.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Hoe wij behandelen",
      paragraphs: [
        "Elke klacht wordt vastgelegd en krijgt een zaaknummer waaronder u de stand kunt volgen.",
        "Wij bevestigen de ontvangst onverwijld en antwoorden inhoudelijk in de regel binnen zeven dagen. Is een langere beoordeling nodig, dan delen wij u de tussenstand mee.",
        "Klachten waarbij personen gevaar lopen of een aankomst ophanden is, behandelen wij met voorrang.",
        "Onze beslissing motiveren wij en wij noemen de grondslag waarop zij berust.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Klacht tegen een maatregel van ons",
      paragraphs: [
        "Hebben wij inhoud verwijderd, de zichtbaarheid ervan beperkt, een boeking geannuleerd of een account geblokkeerd, dan kunt u daartegen binnen zes maanden kosteloos klagen. Dat komt overeen met artikel 20 van Verordening (EU) 2022/2065.",
        "De klacht wordt door mensen beoordeeld, niet uitsluitend door geautomatiseerde procedures. Blijkt zij gegrond, dan trekken wij de maatregel in.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Buitengerechtelijke geschillenbeslechting",
      paragraphs: [
        "Het platform van de Europese Commissie voor onlinegeschillenbeslechting (ODR-platform) is bij Verordening (EU) 2024/3228 ingetrokken en heeft zijn werkzaamheden gestaakt. Daarlangs kunnen geen klachten meer worden ingediend.",
        "Wij zijn niet verplicht en niet bereid deel te nemen aan een geschillenbeslechtingsprocedure voor een consumentengeschillencommissie.",
        `Los daarvan kunt u zich als consument wenden tot de bevoegde Deense instantie: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Denemarken ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Woont u in een andere lidstaat, dan helpt het Europees Consumenten Centrum in uw land verder.`,
        "Betreft het geschil een maatregel die wij tegen uw inhoud of uw account hebben genomen, dan kunt u zich daarnaast wenden tot een op grond van artikel 21 van Verordening (EU) 2022/2065 gecertificeerde buitengerechtelijke geschillenbeslechtingsinstantie. De beslissingen daarvan zijn voor ons niet bindend en wij zijn niet verplicht aan dergelijke procedures deel te nemen.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Gang naar de rechter",
      paragraphs: [
        "De gang naar de rechter staat u te allen tijde open, ook zonder voorafgaande klachtenprocedure. Welke gerechten bevoegd zijn, staat in onderdeel A19 van de [Gebruiksvoorwaarden](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Klachten van aanbieders",
      paragraphs: [
        "Aanbieders kunnen klachten over de toepassing van deze voorwaarden, over rangschikkingsbeslissingen en over beperkingen van hun advertentie via dezelfde procedure indienen. Dat komt overeen met artikel 11 van Verordening (EU) 2019/1150.",
        "Over aantal, onderwerp en gemiddelde behandelduur van dergelijke klachten rapporteren wij jaarlijks; het verslag is te raadplegen onder [Digitaledienstenverordening](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
