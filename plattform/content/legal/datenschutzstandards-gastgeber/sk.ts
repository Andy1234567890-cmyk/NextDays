import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Štandardy ochrany údajov pre hostiteľov",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Ak ponúkate cez myBestDays, dostávate osobné údaje svojich hostí. Za ich spracúvanie ste samostatným prevádzkovateľom v zmysle nariadenia (EÚ) 2016/679 (GDPR). Tieto štandardy opisujú, čo od Vás pritom očakávame.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Obmedzenie účelu",
      paragraphs: [
        "Údaje hostí používate výlučne na uskutočnenie rezervácie, na komunikáciu s hosťom a na splnenie svojich zákonných povinností (napríklad prihlasovací lístok, kúpeľný poplatok, daňové a archivačné povinnosti).",
        "Každé ďalšie použitie — najmä reklama, newslettre, poskytnutie tretím osobám, zaradenie do vlastnej databázy hostí pre neskoršie priame rezervácie — si vyžaduje vlastný právny základ, spravidla súhlas hosťa.",
        "Údaje hostí nepoužívate na to, aby ste hosťa priviedli k rezervácii mimo Platformy.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Minimalizácia údajov",
      paragraphs: [
        "Zbierate len tie údaje, ktoré skutočne potrebujete. Kópie dokladov totožnosti žiadate len vtedy, ak to vyžaduje právny predpis, a uchovávate ich len tak dlho, ako predpis ustanovuje.",
        "Platobné údaje nežiadate. Platby prebiehajú cez Platformu.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Bezpečnosť",
      paragraphs: [
        "Údaje hostí chránite primeranými technickými a organizačnými opatreniami — prístup len pre osoby, ktoré údaje potrebujú, chránené zariadenia, šifrovaný prenos.",
        "Ak zamestnávate pracovníkov, upratovacie sily alebo spoluhostiteľov, zaviažete ich k mlčanlivosti a poskytnete im len tie údaje, ktoré potrebujú na svoju úlohu.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Uchovávanie a vymazanie",
      paragraphs: [
        "Údaje hostí vymažete, len čo účel odpadol a už neexistuje povinnosť uchovávania.",
        "Prihlasovacie lístky a daňovo relevantné doklady uchovávate tak dlho, ako predpisuje právo Vašej krajiny — nie dlhšie.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Práva hostí",
      paragraphs: [
        "Ak sa na Vás hosť obráti so žiadosťou o prístup, opravu, vymazanie alebo s námietkou, zodpoviete ju v lehote. Ak sa týka údajov, ktoré máme my, odkážete ho na nás.",
        "Informujete svojich hostí o tom, ako spracúvate ich údaje, pokiaľ presahujete uskutočnenie rezervácie.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Incidenty ochrany údajov",
      paragraphs: [
        "Ak dôjde k porušeniu ochrany údajov hostí, bezodkladne informujete príslušný dozorný orgán a tam, kde je to potrebné, dotknutých hostí.",
        "Ak sa incident týka údajov získaných cez Platformu, informujete dodatočne aj nás, aby sme mohli preskúmať vlastné povinnosti.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kamery a záznamové zariadenia",
      paragraphs: [
        "Vo vnútorných priestoroch s oprávneným očakávaním súkromia — spálne, kúpeľne — sú kamery a mikrofóny neprípustné, aj vypnuté.",
        "Všetky ostatné kamery, pohybové snímače so záznamom, zvončeky s kamerou a hlukové snímače zverejňujete v inzeráte s uvedením umiestnenia a toho, čo sa zaznamenáva.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Následky porušení",
      paragraphs: [
        "Porušenia týchto štandardov posudzujeme ako porušenia [Dodatočných podmienok pre hostiteľov](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) a môžeme prijať opatrenia až po zablokovanie účtu.",
      ],
    },
  ],
};
