import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Standardi varstva podatkov za gostitelje",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Kadar ponujate prek myBestDays, prejemate osebne podatke svojih gostov. Za njihovo obdelavo ste samostojni upravljavec v smislu Uredbe (EU) 2016/679 (GDPR). Ti standardi opisujejo, kaj pri tem pričakujemo od vas.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Omejitev namena",
      paragraphs: [
        "Podatke gostov uporabljate izključno za izvedbo rezervacije, za komunikacijo z gostom in za izpolnjevanje svojih zakonskih obveznosti (na primer prijavnica, turistična taksa, davčne obveznosti in obveznosti hrambe).",
        "Vsaka nadaljnja uporaba — zlasti oglaševanje, e-novice, posredovanje tretjim osebam, vključitev v lastno zbirko gostov za poznejše neposredne rezervacije — zahteva lastno pravno podlago, praviloma privolitev gosta.",
        "Podatkov gostov ne uporabljate, da bi gosta pripravili do rezervacije izven Platforme.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Najmanjši obseg podatkov",
      paragraphs: [
        "Zbirate le podatke, ki jih dejansko potrebujete. Kopije osebnih dokumentov zahtevate le, kadar to zahteva pravni predpis, in jih hranite le tako dolgo, kot predpis določa.",
        "Plačilnih podatkov ne zahtevate. Plačila potekajo prek Platforme.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Varnost",
      paragraphs: [
        "Podatke gostov varujete z ustreznimi tehničnimi in organizacijskimi ukrepi — dostop le za osebe, ki podatke potrebujejo, zaščitene naprave, šifriran prenos.",
        "Če zaposlujete sodelavce, čistilno osebje ali sogostitelje, jih zavežete k zaupnosti in jim daste le podatke, ki jih potrebujejo za svojo nalogo.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Hramba in izbris",
      paragraphs: [
        "Podatke gostov izbrišete takoj, ko namen preneha in obveznost hrambe ne obstaja več.",
        "Prijavnice in davčno pomembne dokumente hranite tako dolgo, kot določa pravo vaše države — ne dlje.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Pravice gostov",
      paragraphs: [
        "Če se gost obrne na vas z zahtevo za dostop, popravek, izbris ali z ugovorom, jo pravočasno rešite. Če se nanaša na podatke, ki so pri nas, ga napotite k nam.",
        "Svoje goste obveščate o tem, kako obdelujete njihove podatke, kolikor presegate izvedbo rezervacije.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Incidenti varstva podatkov",
      paragraphs: [
        "Če pride do kršitve varstva podatkov gostov, nemudoma obvestite pristojni nadzorni organ in, kjer je potrebno, prizadete goste.",
        "Če se incident nanaša na podatke, ki ste jih prejeli prek Platforme, dodatno obvestite tudi nas, da lahko preverimo svoje obveznosti.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kamere in snemalne naprave",
      paragraphs: [
        "V notranjih prostorih z upravičenim pričakovanjem zasebnosti — spalnice, kopalnice — kamere in mikrofoni niso dopustni, tudi izklopljeni ne.",
        "Vse druge kamere, senzorje gibanja s snemanjem, zvonce s kamero in senzorje hrupa razkrijete v oglasu z navedbo mesta in tega, kaj se snema.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Posledice kršitev",
      paragraphs: [
        "Kršitve teh standardov obravnavamo kot kršitve [Dodatnih pogojev za gostitelje](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) in lahko sprejmemo ukrepe do blokade računa.",
      ],
    },
  ],
};
