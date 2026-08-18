import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Storitvene pristojbine",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "myBestDays se financira s storitveno pristojbino na posredovane rezervacije. Ta stran pojasnjuje, kdo jo plača, kako se izračuna in kje je prikazana.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Kdo plača storitveno pristojbino",
      paragraphs: [
        "Storitveno pristojbino nosi ponudnik. Zadrži se od vrednosti rezervacije in zmanjša izplačilo njemu; gost je ne plača dodatno.",
        "Če izjemoma pri rezervaciji nastane storitvena pristojbina za gosta, jo pred zaključkom rezervacije prikažemo kot ločeno postavko v skupni ceni. Brez tega prikaza za gosta ne nastane nobena pristojbina.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Kako se izračuna",
      paragraphs: [
        "Storitvena pristojbina je odstotek vrednosti rezervacije, obračunane prek Platforme. Stopnja, ki velja za vaše rezervacije, je navedena v vašem računu gostitelja in v dogovoru, s katerim ste soglašali ob registraciji.",
        "Osnova za odmero je cena prenočitve, povečana za doplačila, obračunana prek Platforme. Ne vključujejo se prehodne postavke, ki niso protidajatev ponudnika — zlasti turistična taksa in varščina.",
        "Storitvena pristojbina se izračuna in prikaže v valuti oglasa.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Davek na dodano vrednost",
      paragraphs: [
        "Na storitveno pristojbino se obračuna DDV, kolikor je zakonsko dolgovan. Ali se izkaže ali velja obrnjena davčna obveznost, je odvisno od sedeža in statusa ponudnika.",
        "Za storitveno pristojbino ponudniku izdamo obračun, ki je dostopen v njegovem računu.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Odpoved in vračilo",
      paragraphs: [
        "Če je rezervacija v celoti povrnjena, storitveno pristojbino vrnemo sorazmerno v obsegu, v katerem se povrne vrednost rezervacije.",
        "Če ponudnik odpove brez pomembnega razloga, storitvena pristojbina ne odpade samodejno; pridržujemo si pravico uveljavljati stroške, nastale zaradi odpovedi.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Sprememba storitvene pristojbine",
      paragraphs: [
        "Spremembo stopnje ponudnikom napovemo najmanj 30 dni pred začetkom veljavnosti na trajnem nosilcu podatkov; to ustreza členu 3(2) Uredbe (EU) 2019/1150.",
        "Za že potrjene rezervacije velja stopnja, ki je veljala ob rezervaciji.",
      ],
    },
  ],
};
