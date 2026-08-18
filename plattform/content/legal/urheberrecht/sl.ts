import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika avtorskih pravic",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "myBestDays spoštuje pravice tretjih oseb in enako pričakuje od svojih uporabnikov. Ta politika opisuje, kako prijavite kršitev avtorske pravice in kako z njo ravnamo.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Načelo",
      paragraphs: [
        "Kdor na Platformo objavi vsebino, zagotavlja, da ima za to potrebne pravice. To velja zlasti za fotografije, tlorise, besedila in izseke zemljevidov v oglasih.",
        "Objava tuje vsebine brez dovoljenja je kršitev [Pogojev uporabe](https://mybestdays.dk/rechtliches/nutzungsbedingungen) in [Pravil o primerni vsebini](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Prijava kršitve",
      paragraphs: [
        "Kršitev avtorske pravice prijavite prek funkcije prijave pri prizadeti vsebini ali prek kontaktne točke, navedene v razdelku [Akt o digitalnih storitvah](https://mybestdays.dk/rechtliches/dsa). Prijava naj vsebuje:",
      ],
      list: [
        "natančno navedbo sporne vsebine, zlasti naslov URL;",
        "opis zaščitenega dela in dokazilo o vašem imetništvu pravic ali o vašem pooblastilu za ravnanje v imenu imetnika pravic;",
        "obrazložitev, zakaj uporaba ni dovoljena;",
        "vaše ime in kontaktni naslov;",
        "izjavo, da so vaši podatki po najboljšem vedenju pravilni in popolni.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Kako obravnavamo prijave",
      paragraphs: [
        "Prejem vaše prijave nemudoma potrdimo ter odločimo hitro in skrbno.",
        "Če prijavo štejemo za utemeljeno, vsebino odstranimo ali blokiramo dostop do nje in obvestimo osebo, ki jo je objavila, z navedbo razlogov in pritožbene poti.",
        "Če prijavo štejemo za neutemeljeno, vam to sporočimo z obrazložitvijo.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Ugovor prizadete osebe",
      paragraphs: [
        "Če je bila vaša vsebina odstranjena in menite, da je bilo to neupravičeno, lahko v šestih mesecih brezplačno vložite pritožbo. Pri tem navedite, zakaj ste do uporabe upravičeni.",
        "Če se pritožba izkaže za utemeljeno, vsebino ponovno vzpostavimo.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Ponovljene kršitve",
      paragraphs: [
        "Račune, prek katerih se ponovno objavlja vsebina, ki krši pravice, po predhodnem opozorilu blokiramo. To ustreza členu 23 Uredbe (EU) 2022/2065.",
        "Prav tako blokiramo funkcijo prijave osebam, ki ponovno oddajajo očitno neutemeljene prijave.",
      ],
    },
  ],
};
