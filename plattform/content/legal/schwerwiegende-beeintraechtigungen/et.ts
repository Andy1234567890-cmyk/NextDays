import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Raskete häirete poliitika",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Vahel takistab reisi või viibimist sündmus, milles ei ole süüdi ei külaline ega pakkuja. Käesolev poliitika kirjeldab, millised sündmused need on ja mis siis kehtib.",
    "See on ülimuslik kuulutuses valitud tühistamistingimuse suhtes.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Millised sündmused on hõlmatud",
      paragraphs: [
        "Hõlmatud on sündmused, mis leiavad aset pärast broneerimist, olid mõlemale poolele ettenägematud ja muudavad reisi või viibimise võimatuks või õiguslikult lubamatuks:",
      ],
      list: [
        "ametiasutuste reisi- või viibimiskeelud, liikumiskeelud ja piiride sulgemine, mis puudutavad sihtkohta või lähtekohta;",
        "loodusõnnetused ja loodusnähtused, mis puudutavad sihtkohta – maavärin, üleujutus, torm, suurpõleng, vulkaanipurse;",
        "sõda, relvakonfliktid, terrorirünnakud ja rahutused sihtkohas;",
        "ametlikult tuvastatud epideemia või pandeemia meetmetega, mis keelavad viibimise;",
        "elektri-, vee- või soojusvarustuse katkemine sihtkohas pikema aja jooksul;",
        "täielik võimatus sihtkohta jõuda mõne eelnimetatud sündmuse tõttu.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Millised sündmused ei ole hõlmatud",
      paragraphs: ["Hõlmatud ei ole eelkõige:"],
      list: [
        "külalise või tema lähedaste haigus või vigastus – selleks on ette nähtud reisikindlustus;",
        "tööalane takistus, eksamiajad või puhkuse ärajäämine;",
        "ürituse ärajäämine, mille tõttu reis broneeriti, kui majutuskoht jääb kasutatavaks;",
        "ilm, mis ei kujuta endast loodusõnnetust – vihm, külm, kuumus, lume puudumine;",
        "üksikute transpordivahendite ärajäämine, kuni mõistlik kohalejõudmine jääb võimalikuks;",
        "lennu tühistamine või streik veoettevõttes – selleks on nõuded veoettevõtte vastu.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Mis kehtib, kui hõlmatud sündmus leiab aset",
      paragraphs: [
        "Kui sündmus puudutab Teie broneeringu perioodi, võite tühistada tasuta. Platvormi kaudu makstud summa saate täies ulatuses tagasi.",
        "Kui viibimine on juba alanud, hüvitame osa ööde eest, mida enam kasutada ei saa.",
        "Pakkujale ei kaasne sellisest tühistamisest puudusi tema usaldusväärsuse hindamisel.",
        "Alternatiivina võite pakkujaga kokku leppida edasilükkamise; aitame ümber broneerida.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Kuidas sellele tugineda",
      paragraphs: [
        "Võtke ühendust kontaktiteid pidi jaotises [Kaebused ja vaidluste lahendamine](https://mybestdays.dk/rechtliches/beschwerden) ning nimetage broneeringu number ja sündmus.",
        "Kontrollime avalikult kättesaadavate allikate alusel – ametiasutuste korraldused, ametlikud hoiatused, tunnustatud uudisteallikate teated – ja otsustame kiiresti.",
        "Kui olukorda ei saa veel lõplikult hinnata, ootame arengut kuni vahetult enne saabumispäeva ja otsustame siis. Teie broneering jääb seni muutmata.",
      ],
    },
  ],
};
