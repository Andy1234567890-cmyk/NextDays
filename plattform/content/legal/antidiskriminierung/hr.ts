import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Antidiskriminacijska politika",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "myBestDays je otvoren svima. Tko putem Platforme rezervira ili nudi, nikoga ne smije lošije tretirati zbog osobnih obilježja.",
    "Ova politika sastavni je dio [Uvjeta korištenja](https://mybestdays.dk/rechtliches/nutzungsbedingungen) i vrijedi za goste kao i za pružatelje.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Načelo",
      paragraphs: [
        "Na myBestDays nedopušteno je osobu stavljati u nepovoljniji položaj zbog njezina podrijetla, boje kože, državljanstva, etničke pripadnosti, vjere ili svjetonazora, spola, rodnog identiteta, spolne orijentacije, invaliditeta, dobi ili bračnog stanja.",
        "To vrijedi za prihvat ili odbijanje rezervacija, za cijene i uvjete, za postupanje tijekom boravka i za komunikaciju putem Platforme.",
        "Dodatno vrijedi članak 20. Uredbe (EU) 2018/302: pružatelji ne smiju ograničavati pristup svojoj ponudi zbog državljanstva, prebivališta ili mjesta poslovnog nastana gosta unutar Unije.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Što to znači za pružatelje",
      paragraphs: ["Kao pružatelj osobito ne smijete:"],
      list: [
        "odbiti zahtjev za rezervaciju zbog nekog od navedenih obilježja;",
        "od gostiju tražiti različite cijene, pologe ili uvjete zato što ispunjavaju neko od obilježja;",
        "u oglasu ili u porukama izjaviti da određene skupine osoba nisu poželjne;",
        "odbiti pse pomagače ili pse vodiče, čak i ako Vaš kućni red isključuje životinje;",
        "gosta tretirati drukčije zbog njegova prebivališta u drugoj državi članici Unije.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Što ostaje dopušteno",
      paragraphs: [
        "Možete odrediti najveću popunjenost, najnižu dob glavnog rezervanta i objektivna kućna pravila (primjerice zabranu pušenja ili razdoblja tišine), dok god vrijede jednako za sve goste.",
        "Ako u smještaju stanujete i sami te s gostom dijelite stambeni prostor, to možete jasno navesti u oglasu; obilježja iz odjeljka 1. ipak ne opravdavaju odbijanje.",
        "Rezervaciju možete odbiti kada postoje konkretni pokazatelji povrede kućnog reda ili prijevare. Razlog se mora odnositi na ponašanje, a ne na osobu.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Pristupačnost",
      paragraphs: [
        "Podaci o pristupačnosti smještaja moraju biti točni. Opisati kao pristupačan smještaj koji to nije istodobno je povreda [Pravila o primjerenom sadržaju](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Kada je prilagodba moguća bez nerazmjernog napora, očekujemo da je pružatelji provedu.",
      ],
    },
    {
      id: "melden",
      heading: "5. Prijava diskriminacije",
      paragraphs: [
        "Ako ste doživjeli ili primijetili diskriminaciju, prijavite nam to putem funkcije prijave ili putem kontaktnih putova u dijelu [Pritužbe i rješavanje sporova](https://mybestdays.dk/rechtliches/beschwerden).",
        "Svaku prijavu ispitujemo. Potvrdi li se povreda, poduzimamo mjere do trajne blokade računa. Ako Vam je zbog toga rezervacija otkazana, pomažemo Vam pronaći usporediv smještaj.",
      ],
    },
  ],
};
