import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika piškotkov",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ta politika pojasnjuje, katere piškotke in podobne tehnologije uporablja myBestDays, za kaj, kako dolgo ostanejo shranjeni in kako jih upravljate.",
    "Dopolnjuje [Politiko zasebnosti](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Kaj so piškotki",
      paragraphs: [
        "Piškotki so majhne besedilne datoteke, ki jih spletno mesto shrani v vaš brskalnik. Podobne tehnologije so lokalna shramba brskalnika in sledilne slikovne pike v e-poštnih sporočilih.",
        "Piškotke, ki so nujno potrebni za delovanje Platforme, smemo nastaviti brez vaše privolitve. Za vse druge pridobimo vašo privolitev (člen 5(3) Direktive 2002/58/ES).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Nujni piškotki",
      paragraphs: [
        "Ti piškotki so potrebni za delovanje in jih ni mogoče izklopiti. Trenutno uporabljamo:",
      ],
      list: [
        "»nd_access« — ohranja vašo prijavo. Berljiv le za strežnik (HttpOnly), trajanje ustreza veljavnosti seje.",
        "»nd_refresh« — obnavlja vašo prijavo, da se vam ni treba nenehno znova prijavljati. Berljiv le za strežnik, trajanje 30 dni.",
        "»nd_gast_locale« — si zapomni vaš izbrani jezik. Trajanje eno leto.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funkcionalni, statistični in trženjski piškotki",
      paragraphs: [
        "myBestDays trenutno ne uporablja piškotkov za statistiko, merjenje dosega ali oglaševanje in ne vgrajuje oglaševalskih omrežij ali analitičnih storitev.",
        "Če bi se to spremenilo, bomo predhodno pridobili vašo privolitev prek izbirnega pogovornega okna, v katerem je zavrnitev enako preprosta kot privolitev, in to politiko dopolnili s konkretnimi piškotki.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Vgrajena vsebina tretjih oseb",
      paragraphs: [
        "Na straneh s podrobnostmi so lahko vgrajeni zemljevidi. Tako vsebino naložimo šele, ko jo izrecno aktivirate; šele takrat se lahko podatki prenesejo posameznemu ponudniku.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Kako upravljate piškotke",
      paragraphs: [
        "Svojo privolitev lahko kadar koli spremenite ali prekličete prek nastavitev piškotkov v nogi strani.",
        "Poleg tega lahko piškotke v svojem brskalniku izbrišete ali blokirate. Če izbrišete nujne piškotke, boste odjavljeni in Platforma bo delovala omejeno.",
      ],
    },
  ],
};
