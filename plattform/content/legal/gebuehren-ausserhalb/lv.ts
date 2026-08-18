import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Maksas ārpus platformas",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Šī politika regulē, kādas summas sniedzējs drīkst pieprasīt ārpus Platformas un kādas ne. Tā aizsargā viesus no tā, ka uz vietas viņiem tiek izvirzītas prasības, kuru sludinājumā nebija.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Princips",
      paragraphs: [
        "Viss, kas jāmaksā par rezervēto pakalpojumu, pirms rezervācijas pabeigšanas jānorāda sludinājumā – vai nu kā kopējās cenas daļa, vai kā izmaksu uz vietas pozīcija.",
        "Summa, kas nebija norādīta ne kopējā cenā, ne kā izmaksas uz vietas, viesim nav jāmaksā.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Ko drīkst pieprasīt uz vietas",
      paragraphs: ["Uz vietas drīkst pieprasīt tikai:"],
      list: [
        "summas, kas sludinājumā skaidri norādītas kā izmaksas uz vietas (piemēram, gala uzkopšana, veļas komplekts, stāvvieta);",
        "vietējās nodevas, piemēram, kūrorta nodevu, ciktāl saskaņā ar vietējām normām tā maksājama uz vietas;",
        "sludinājumā norādīto drošības naudu;",
        "pakalpojumus, ko viesis pasūta tikai uz vietas un brīvprātīgi, par iepriekš paziņotu cenu;",
        "pierādītu bojājumu atlīdzināšanu, ko radījis viesis.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Ko nedrīkst pieprasīt",
      paragraphs: ["Jo īpaši nav pieļaujams:"],
      list: [
        "papildu prasība par nakšņošanas cenu pēc rezervācijas pabeigšanas;",
        "maksa par to, ka rezervācija veikta caur myBestDays;",
        "apstrādes, rezervācijas vai kartes maksa, kas nebija norādīta sludinājumā;",
        "aicinājums atcelt rezervāciju un to pašu naktsmītni rezervēt no jauna ārpus Platformas;",
        "aicinājums cenu vai tās daļu samaksāt ar pārskaitījumu, skaidrā naudā vai maksājumu pakalpojumu ārpus Platformas, ja sludinājums paredz maksājumu caur Platformu.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Platformas apiešana",
      paragraphs: [
        "Ja kontakts starp viesi un sniedzēju radies caur Platformu, rezervāciju nedrīkst noformēt to apejot. Tas attiecas uz abām pusēm.",
        "Kas apiet Platformu, zaudē tās aizsardzību: maksājumi nav nodrošināti, mūsu atcelšanas un atmaksas politikas nepiemēro, un strīda gadījumā nevaram starpniekot.",
        "Pārkāpumi var novest pie konta bloķēšanas. No sniedzējiem varam papildus pieprasīt neiegūto pakalpojuma maksu.",
      ],
    },
    {
      id: "melden",
      heading: "5. Ziņošana",
      paragraphs: [
        "Ja no Jums uz vietas pieprasa summu, kuras sludinājumā nebija, nemaksājiet to un ziņojiet mums pa kontaktceļiem sadaļā [Sūdzības un strīdu risināšana](https://mybestdays.dk/rechtliches/beschwerden). Ja jau esat samaksājis, palīdzam to atgūt.",
      ],
    },
  ],
};
