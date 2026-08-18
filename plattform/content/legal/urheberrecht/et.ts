import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Autoriõiguse poliitika",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "myBestDays austab kolmandate isikute õigusi ja ootab sedasama oma kasutajatelt. Käesolev poliitika kirjeldab, kuidas teatada autoriõiguse rikkumisest ja kuidas me sellega toimime.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Põhimõte",
      paragraphs: [
        "Kes lisab Platvormile sisu, kinnitab, et tal on selleks vajalikud õigused. See kehtib eelkõige kuulutustes olevatele fotodele, plaanidele, tekstidele ja kaardiväljavõtetele.",
        "Võõra sisu lisamine ilma loata on [Kasutustingimuste](https://mybestdays.dk/rechtliches/nutzungsbedingungen) ja [Sobiva sisu reeglite](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) rikkumine.",
      ],
    },
    {
      id: "meldung",
      heading: "2. Rikkumisest teatamine",
      paragraphs: [
        "Teatage autoriõiguse rikkumisest asjaomase sisu juures oleva teatamisfunktsiooni kaudu või jaotises [Digiteenuste õigusakt](https://mybestdays.dk/rechtliches/dsa) nimetatud kontaktpunkti kaudu. Teade peaks sisaldama:",
      ],
      list: [
        "vaidlustatud sisu täpset tähistust, eelkõige URL-aadressi;",
        "kaitstud teose kirjeldust ja tõendit Teie õiguste omamise või Teie volituse kohta tegutseda õiguste omaja nimel;",
        "põhjendust, miks kasutamine ei ole lubatud;",
        "Teie nime ja kontaktaadressi;",
        "kinnitust, et Teie andmed on parima teadmise kohaselt õiged ja täielikud.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Kuidas menetleme teateid",
      paragraphs: [
        "Kinnitame Teie teate kättesaamist viivitamata ning otsustame kiiresti ja hoolikalt.",
        "Kui peame teadet põhjendatuks, eemaldame sisu või blokeerime sellele juurdepääsu ja teavitame isikut, kes selle lisas, märkides põhjused ja kaebetee.",
        "Kui peame teadet põhjendamatuks, teatame sellest Teile koos põhjendusega.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Asjaomase isiku vastuväide",
      paragraphs: [
        "Kui Teie sisu on eemaldatud ja peate seda põhjendamatuks, võite kuue kuu jooksul esitada tasuta kaebuse. Selgitage seejuures, miks olete kasutamiseks õigustatud.",
        "Kui kaebus osutub põhjendatuks, taastame sisu.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Korduvad rikkumised",
      paragraphs: [
        "Kontod, mille kaudu lisatakse korduvalt õigusi rikkuvat sisu, blokeerime pärast eelnevat hoiatust. See vastab määruse (EL) 2022/2065 artiklile 23.",
        "Samuti blokeerime teatamisfunktsiooni isikutele, kes esitavad korduvalt ilmselgelt põhjendamatuid teateid.",
      ],
    },
  ],
};
