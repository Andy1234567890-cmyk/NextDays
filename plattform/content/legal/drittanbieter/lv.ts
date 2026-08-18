import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Trešo pušu sniedzēji un maksājumu pakalpojumi",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Platformas darbībai myBestDays izmanto trešo pušu pakalpojumus. Šī lapa tos nosauc un skaidro, kāda ir to loma un kā noteikumi katrā gadījumā piemērojami.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Princips",
      paragraphs: [
        "Tur, kur trešās puses sniedzējs sniedz pakalpojumu tieši Jums, papildus mūsējiem piemēro viņa noteikumus un viņa privātuma politiku. Uz to norādām attiecīgajā vietā.",
        "Tur, kur trešās puses sniedzējs apstrādā datus tikai mūsu uzdevumā, mēs paliekam Jūsu kontaktpersona. Kurus apstrādātājus izmantojam, norādīts [Privātuma politikā](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Maksājumu pakalpojumu sniedzējs",
      paragraphs: [
        "Maksājumus caur Platformu apstrādā Stripe. Stripe maksājumu datus ievāc un apstrādā tieši un ir par tiem patstāvīgs pārzinis. Papildus piemēro [Stripe privātuma politiku](https://stripe.com/privacy).",
        "Izmaksai saimniekiem Stripe veic tiesību aktos noteikto identitātes pārbaudi.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Maksājumu pakalpojumu direktīva un trešo pušu piekļuve",
      paragraphs: [
        "Direktīva (ES) 2015/2366 („PSD2“) daudziem maksājumiem prasa klienta drošu autentificēšanu. To veic Jūsu banka vai kartes izdevējs; bez sekmīgas autentificēšanas maksājums var tikt noraidīts.",
        "myBestDays nav maksājuma ierosināšanas vai konta informācijas pakalpojums un nepiekļūst Jūsu bankas kontiem.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Kartes, attēli un iegultais saturs",
      paragraphs: [
        "Karšu attēlojumiem un atrašanās vietas datiem iegulstam trešo pušu karšu pakalpojumus. Šāda satura ielādes laikā dati var tikt nodoti attiecīgajam sniedzējam; sīkāk un piekrišanas pārvaldība norādīta [Sīkdatņu politikā](https://mybestdays.dk/rechtliches/cookies).",
        "Attēli un apraksti sludinājumos nāk no attiecīgā sniedzēja, nevis no mums.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Saistītās lapas",
      paragraphs: [
        "Platformā var būt saites uz trešo pušu lapām. Uz to saturu mums nav ietekmes, un par to neuzņemamies atbildību. Uzzinot par tiesību pārkāpumu, saiti nekavējoties noņemam.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Lietotņu veikali",
      paragraphs: [
        "Ja myBestDays lietotni iegūstat caur lietotņu veikalu, papildus piemēro attiecīgā veikala operatora noteikumus. Veikala operators nav līguma starp Jums un mums puse un neatbild ne par atbalstu, ne par garantiju lietotnei.",
      ],
    },
  ],
};
