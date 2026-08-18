import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady autorského práva",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "myBestDays rešpektuje práva tretích osôb a to isté očakáva od svojich používateľov. Tieto zásady opisujú, ako nahlásiť porušenie autorského práva a ako s ním zaobchádzame.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zásada",
      paragraphs: [
        "Kto vkladá obsah na Platformu, zaručuje, že má na to potrebné práva. Platí to najmä pre fotografie, pôdorysy, texty a mapové výrezy v inzerátoch.",
        "Vkladanie cudzieho obsahu bez povolenia je porušením [Podmienok používania](https://mybestdays.dk/rechtliches/nutzungsbedingungen) a [Pravidiel pre vhodný obsah](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Nahlásenie porušenia",
      paragraphs: [
        "Porušenie autorského práva nahláste cez funkciu nahlásenia pri dotknutom obsahu alebo cez kontaktné miesto uvedené v časti [Akt o digitálnych službách](https://mybestdays.dk/rechtliches/dsa). Hlásenie by malo obsahovať:",
      ],
      list: [
        "presné označenie namietaného obsahu, najmä URL adresu;",
        "opis chráneného diela a preukázanie Vášho nositeľstva práv alebo Vášho oprávnenia konať za nositeľa práv;",
        "odôvodnenie, prečo použitie nie je dovolené;",
        "Vaše meno a kontaktnú adresu;",
        "vyhlásenie, že Vaše údaje sú podľa najlepšieho vedomia správne a úplné.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Ako hlásenia spracúvame",
      paragraphs: [
        "Prijatie Vášho hlásenia bezodkladne potvrdíme a rozhodneme rýchlo a starostlivo.",
        "Ak hlásenie považujeme za dôvodné, obsah odstránime alebo k nemu zablokujeme prístup a informujeme osobu, ktorá ho vložila, s uvedením dôvodov a cesty sťažnosti.",
        "Ak hlásenie považujeme za nedôvodné, oznámime Vám to s odôvodnením.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Námietka dotknutej osoby",
      paragraphs: [
        "Ak bol Váš obsah odstránený a považujete to za neoprávnené, môžete do šiestich mesiacov bezplatne podať sťažnosť. Uveďte pritom, prečo ste na použitie oprávnení.",
        "Ak sa sťažnosť ukáže ako dôvodná, obsah obnovíme.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Opakované porušenia",
      paragraphs: [
        "Účty, cez ktoré sa opakovane vkladá obsah porušujúci práva, po predchádzajúcom upozornení zablokujeme. Zodpovedá to článku 23 nariadenia (EÚ) 2022/2065.",
        "Rovnako zablokujeme funkciu nahlasovania osobám, ktoré opakovane podávajú zjavne nedôvodné hlásenia.",
      ],
    },
  ],
};
