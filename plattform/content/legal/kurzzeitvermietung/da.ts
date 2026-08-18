import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Korttidsudlejning og registreringspligter",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "I mange byer og regioner kræver korttidsudlejning af bolig tilladelse, registrering eller anmeldelse. Denne side forklarer, hvad det betyder for udbydere og for gæster.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Retlig ramme",
      paragraphs: [
        "Forordning (EU) 2024/1028 om indsamling og udveksling af data vedrørende korttidsudlejning af indkvartering skaber en ensartet ramme: hvor en medlemsstat eller en lokal myndighed har indført en registreringsordning, får hver enhed et registreringsnummer.",
        "Platforme skal vise dette nummer, kontrollere dets gyldighed stikprøvevis og med regelmæssige mellemrum overføre data om aktiviteten til de kompetente myndigheder.",
        "Derudover gælder fortsat nationale og lokale regler — f.eks. om ændret anvendelse af bolig, maksimalt antal udlejningsdage, brandsikkerhed og registrering af gæster.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Hvad udbydere skal gøre",
      paragraphs: [
        "Kontrollér før offentliggørelsen, om der gælder en registrerings-, tilladelses- eller anmeldelsespligt for din indkvartering, og opfyld den.",
        "Indtast registreringsnummeret i objektet, hvis der findes et. Vi viser det i opslaget.",
        "Overhold maksimale udlejningsdage og andre lokale grænser. At overvåge dem er din opgave, ikke vores.",
        "Vi må ikke vedvarende vise et opslag uden det påkrævede registreringsnummer. Mangler det eller viser sig ugyldigt, rykker vi for det; udebliver oplysningen, deaktiverer vi opslaget.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Hvad det betyder for gæster",
      paragraphs: [
        "Gælder der en registreringspligt for en indkvartering, ser du registreringsnummeret i opslaget. Det er en indikation af, at udlejningen er anmeldt til den kompetente myndighed.",
        "På rejsemålet kan der være krav om registrering (registreringsblanket, legitimationsoplysninger, erklæring om turistskat). Udbyderen indhenter de nødvendige oplysninger; stil dem til rådighed i god tid.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Overførsel af data til myndigheder",
      paragraphs: [
        "For så vidt forordning (EU) 2024/1028 eller national ret foreskriver det, overfører vi data om udlejningsaktiviteten til de kompetente myndigheder — navnlig registreringsnummer, enhedens adresse, antal belagte nætter og antal gæster.",
        "Denne overførsel sker for at opfylde en retlig forpligtelse efter artikel 6, stk. 1, litra c), i forordning (EU) 2016/679. Nærmere fremgår af [Privatlivspolitik](https://mybestdays.dk/rechtliches/datenschutz).",
        "Adskilt herfra består den skattemæssige indberetningspligt efter DAC7; se [Skattepolitik](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Anmeld overtrædelser",
      paragraphs: [
        "Har du holdepunkter for, at en indkvartering udbydes uden den påkrævede tilladelse eller registrering, så anmeld det til os via anmeldelsesfunktionen ved opslaget. Vi følger op på enhver anmeldelse.",
      ],
    },
  ],
};
