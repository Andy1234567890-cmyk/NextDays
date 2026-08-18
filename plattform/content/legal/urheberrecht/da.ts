import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ophavsretspolitik",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "myBestDays respekterer tredjemands rettigheder og forventer det samme af sine brugere. Denne politik beskriver, hvordan du anmelder en ophavsretskrænkelse, og hvordan vi håndterer den.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Grundsætning",
      paragraphs: [
        "Den, der indlægger indhold på platformen, indestår for at besidde de nødvendige rettigheder. Det gælder navnlig billeder, plantegninger, tekster og kortudsnit i opslag.",
        "At indlægge andres indhold uden tilladelse er en overtrædelse af [Brugsvilkårene](https://mybestdays.dk/rechtliches/nutzungsbedingungen) og af [Retningslinjer for passende indhold](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Anmeld en krænkelse",
      paragraphs: [
        "Anmeld en ophavsretskrænkelse via anmeldelsesfunktionen ved det berørte indhold eller via det kontaktpunkt, der er nævnt under [Forordningen om digitale tjenester](https://mybestdays.dk/rechtliches/dsa). En anmeldelse bør indeholde:",
      ],
      list: [
        "en præcis angivelse af det påklagede indhold, navnlig URL'en;",
        "en beskrivelse af det beskyttede værk og dokumentation for din rettighedsindehavelse eller din berettigelse til at handle for rettighedshaveren;",
        "en begrundelse for, hvorfor brugen ikke er tilladt;",
        "dit navn og en kontaktadresse;",
        "erklæringen om, at dine oplysninger efter bedste overbevisning er rigtige og fuldstændige.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Hvordan vi behandler anmeldelser",
      paragraphs: [
        "Vi bekræfter modtagelsen af din anmeldelse straks og træffer afgørelse hurtigt og omhyggeligt.",
        "Anser vi anmeldelsen for begrundet, fjerner vi indholdet eller spærrer adgangen til det og underretter den person, der har indlagt det, med angivelse af grundene og klagevejen.",
        "Anser vi anmeldelsen for ubegrundet, meddeler vi dig det med en begrundelse.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Indsigelse fra den berørte",
      paragraphs: [
        "Er dit indhold fjernet, og anser du det for uberettiget, kan du inden for seks måneder klage vederlagsfrit. Redegør herved for, hvorfor du er berettiget til brugen.",
        "Viser klagen sig begrundet, genopretter vi indholdet.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Gentagne overtrædelser",
      paragraphs: [
        "Konti, hvorigennem der gentagne gange indlægges krænkende indhold, spærrer vi efter forudgående advarsel. Det svarer til artikel 23 i forordning (EU) 2022/2065.",
        "Ligeledes spærrer vi anmeldelsesfunktionen for personer, der gentagne gange indgiver åbenbart ubegrundede anmeldelser.",
      ],
    },
  ],
};
