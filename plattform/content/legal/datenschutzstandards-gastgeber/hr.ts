import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Standardi zaštite podataka za domaćine",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Kada nudite putem myBestDays, primate osobne podatke svojih gostiju. Za njihovu obradu samostalni ste voditelj obrade u smislu Uredbe (EU) 2016/679 (OUZP). Ovi standardi opisuju što pritom očekujemo od Vas.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Ograničenje svrhe",
      paragraphs: [
        "Podatke gostiju koristite isključivo za provedbu rezervacije, za komunikaciju s gostom i za ispunjavanje svojih zakonskih obveza (primjerice prijavnica, boravišna pristojba, porezne obveze i obveze čuvanja).",
        "Svaka daljnja uporaba — osobito oglašavanje, bilteni, prosljeđivanje trećim osobama, uvrštavanje u vlastitu evidenciju gostiju za kasnije izravne rezervacije — zahtijeva vlastitu pravnu osnovu, u pravilu privolu gosta.",
        "Podatke gostiju ne koristite kako biste gosta naveli na rezervaciju izvan Platforme.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Smanjenje količine podataka",
      paragraphs: [
        "Prikupljate samo podatke koji su Vam stvarno potrebni. Preslike osobnih isprava tražite samo kada to zahtijeva pravni propis i pohranjujete ih samo dok propis to predviđa.",
        "Podatke o plaćanju ne tražite. Plaćanja teku putem Platforme.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Sigurnost",
      paragraphs: [
        "Podatke gostiju štitite primjerenim tehničkim i organizacijskim mjerama — pristup samo osobama kojima su podaci potrebni, zaštićeni uređaji, šifrirani prijenos.",
        "Ako angažirate zaposlenike, osoblje za čišćenje ili sudomaćine, obvezujete ih na povjerljivost i dajete im samo podatke koji su im potrebni za njihovu zadaću.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Čuvanje i brisanje",
      paragraphs: [
        "Podatke gostiju brišete čim svrha prestane i više ne postoji obveza čuvanja.",
        "Prijavnice i porezno relevantne dokumente čuvate onoliko dugo koliko propisuje pravo Vaše države — ne dulje.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Prava gostiju",
      paragraphs: [
        "Ako Vam se gost obrati sa zahtjevom za pristup, ispravak, brisanje ili s prigovorom, odgovarate na njega pravodobno. Ako se odnosi na podatke koji su kod nas, upućujete ga na nas.",
        "Svoje goste obavještavate o tome kako obrađujete njihove podatke, ako izlazite izvan provedbe rezervacije.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Povrede zaštite podataka",
      paragraphs: [
        "Dođe li do povrede zaštite podataka gostiju, bez odgode obavještavate nadležno nadzorno tijelo i, gdje je potrebno, pogođene goste.",
        "Ako se povreda odnosi na podatke primljene putem Platforme, dodatno obavještavate i nas kako bismo mogli provjeriti vlastite obveze.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kamere i uređaji za snimanje",
      paragraphs: [
        "U unutarnjim prostorima s opravdanim očekivanjem privatnosti — spavaće sobe, kupaonice — kamere i mikrofoni nisu dopušteni, ni isključeni.",
        "Sve ostale kamere, senzore pokreta sa snimanjem, zvona s kamerom i senzore buke objavljujete u oglasu uz navođenje mjesta i onoga što se snima.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Posljedice povreda",
      paragraphs: [
        "Povrede ovih standarda tretiramo kao povrede [Dodatnih uvjeta za domaćine](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) i možemo poduzeti mjere do blokade računa.",
      ],
    },
  ],
};
