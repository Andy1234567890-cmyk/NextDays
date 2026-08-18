import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kratkoročno oddajanje in obveznosti registracije",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "V mnogih mestih in regijah je kratkoročno oddajanje stanovanj vezano na dovoljenje, registracijo ali prijavo. Ta stran pojasnjuje, kaj to pomeni za ponudnike in za goste.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Pravni okvir",
      paragraphs: [
        "Uredba (EU) 2024/1028 o zbiranju in izmenjavi podatkov v zvezi s storitvami kratkoročnega najema nastanitev vzpostavlja enoten okvir: kjer je država članica ali lokalna skupnost uvedla registracijski postopek, vsaka enota prejme registrsko številko.",
        "Platforme morajo to številko prikazovati, njeno veljavnost naključno preverjati in pristojnim organom v rednih presledkih posredovati podatke o dejavnosti.",
        "Poleg tega še naprej veljajo nacionalni in krajevni predpisi — na primer o spremembi namembnosti stanovanj, o največjem številu dni oddajanja, o požarni varnosti in o prijavi gostov.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Kaj morajo storiti ponudniki",
      paragraphs: [
        "Pred objavo preverite, ali za vašo nastanitev velja obveznost registracije, dovoljenja ali prijave, in jo izpolnite.",
        "Vnesite registrsko številko pri objektu, če obstaja. Prikažemo jo v oglasu.",
        "Upoštevajte največje število dni oddajanja in druge krajevne omejitve. Njihovo spremljanje je vaša naloga, ne naša.",
        "Oglasa brez potrebne registrske številke ne smemo trajno prikazovati. Če manjka ali se izkaže za neveljavno, jo naknadno zahtevamo; če navedba izostane, oglas deaktiviramo.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Kaj to pomeni za goste",
      paragraphs: [
        "Če za nastanitev velja obveznost registracije, registrsko številko vidite v oglasu. Je znak, da je bilo oddajanje prijavljeno pristojnemu organu.",
        "V ciljnem kraju je lahko potrebna prijava (prijavnica, podatki iz osebnega dokumenta, izjava o turistični taksi). Ponudnik zahteva potrebne podatke; zagotovite jih pravočasno.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Posredovanje podatkov organom",
      paragraphs: [
        "Kolikor Uredba (EU) 2024/1028 ali nacionalno pravo to predvideva, pristojnim organom posredujemo podatke o dejavnosti oddajanja — zlasti registrsko številko, naslov enote, število zasedenih noči in število gostov.",
        "To posredovanje poteka zaradi izpolnjevanja pravne obveznosti po členu 6(1)(c) Uredbe (EU) 2016/679. Podrobnosti so navedene v [Politiki zasebnosti](https://mybestdays.dk/rechtliches/datenschutz).",
        "Ločeno od tega obstaja davčna obveznost poročanja po DAC7; glej [Davčno politiko](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Prijava kršitev",
      paragraphs: [
        "Če imate znake, da se nastanitev ponuja brez potrebnega dovoljenja ali registracije, nam to prijavite prek funkcije prijave pri oglasu. Vsaki prijavi sledimo.",
      ],
    },
  ],
};
