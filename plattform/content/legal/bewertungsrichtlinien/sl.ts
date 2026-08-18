import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika ocen",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ocene so za goste najpomembnejši neodvisni vir. Ta politika opisuje, kdo sme oceniti, kako zagotavljamo, da ocene izhajajo od dejanskih gostov, in kdaj oceno odstranimo.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Kako zagotavljamo pristnost",
      paragraphs: [
        "Oceno sme oddati le, kdor je nastanitev rezerviral prek myBestDays in se mu je obdobje bivanja začelo. Ocena je tehnično vezana na konkretno rezervacijo.",
        "S tem izpolnjujemo obveznost iz Priloge I, točke 23b Direktive 2005/29/ES, da kot ocene gostov prikazujemo le tiste, pri katerih smo sprejeli razumne ukrepe za preverjanje, da izhajajo od dejanskih gostov.",
        "Ocen ne kupujemo, ne naročamo in ne objavljamo lažnih ocen. Prav tako ne dopuščamo, da to počnejo ponudniki.",
      ],
    },
    {
      id: "frist",
      heading: "2. Rok in objava",
      paragraphs: [
        "Po odhodu imate 14 dni časa za oddajo ocene. Ponudnik lahko v istem roku odda oceno o vas.",
        "Obe oceni se objavita hkrati, takoj ko sta obe na voljo ali ko rok poteče. Tako nobena stran ne vpliva na drugo.",
        "Oddano oceno lahko v roku umaknete. Po objavi sprememba ni več mogoča; lahko zahtevate njen izbris.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Odgovor ponudnika",
      paragraphs: [
        "Ponudnik lahko na oceno javno odgovori. Za odgovor veljajo enaka pravila kot za oceno samo.",
        "Odgovor ocene ne spremeni in ne vpliva na skupno oceno.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Kdaj oceno odstranimo",
      paragraphs: [
        "Ocene ne odstranimo zato, ker je negativna, ali zato, ker je ponudnik z njo nezadovoljen. Odstranimo jo, kadar:",
      ],
      list: [
        "krši [Pravila o primerni vsebini](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "vsebuje osebne podatke tretjih oseb;",
        "se očitno nanaša na drugo nastanitev ali drugo bivanje;",
        "se v bistvu nanaša na okoliščine, na katere nista imela vpliva ne gost ne ponudnik (npr. vreme, občinsko gradbišče, prometne razmere ob prihodu) — v tem primeru odstranimo le prizadeti del, če ga je mogoče ločiti;",
        "očitno služi izsiljevanju, na primer ker je bila povezana z zahtevo;",
        "je bila pridobljena s spodbudami ali oddana v usklajenem namenu.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Spodbude niso dopustne",
      paragraphs: [
        "Ponudniki za oceno ne smejo ponujati denarja, popustov, nadgradenj, daril ali drugih ugodnosti — niti za opustitev ocene.",
        "Ponudniki lahko goste povabijo k oceni, ne da bi vplivali na oceno. Vabilo, ki k oceni poziva le ob pozitivni izkušnji, ni dopustno.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Kako prikazujemo ocene",
      paragraphs: [
        "Skupna ocena je neuteženo povprečje vseh objavljenih ocen nastanitve. Nobene ocene ne utežimo višje zato, ker je boljša.",
        "Privzeto razvrščanje najprej prikaže najnovejše ocene. Preklopite lahko na druga razvrščanja; katero razvrščanje je aktivno, je prikazano.",
        "Navedemo, koliko ocen je podlaga skupne ocene. Pri manj kot treh ocenah skupne ocene ne prikazujemo, temveč le posamezne ocene.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Pritožba zoper odločitev",
      paragraphs: [
        "Če vašo oceno odstranimo ali odstranitev ocene zavrnemo, to obrazložimo in napotimo na pritožbeno pot — glej [Pritožbe in reševanje sporov](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
