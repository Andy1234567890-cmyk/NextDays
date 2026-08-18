import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika recenzija",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Recenzije su gostima najvažniji neovisan izvor. Ova politika opisuje tko smije recenzirati, kako osiguravamo da recenzije potječu od stvarnih gostiju i kada recenziju uklanjamo.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Kako osiguravamo vjerodostojnost",
      paragraphs: [
        "Recenziju smije ostaviti samo tko je smještaj rezervirao putem myBestDays i kome je razdoblje boravka započelo. Recenzija je tehnički vezana uz konkretnu rezervaciju.",
        "Time ispunjavamo obvezu iz Priloga I. točke 23.b Direktive 2005/29/EZ da kao recenzije gostiju prikazujemo samo one za koje smo poduzeli razumne korake provjere da potječu od stvarnih gostiju.",
        "Recenzije ne kupujemo, ne naručujemo ih i ne objavljujemo lažne recenzije. Ne toleriramo ni da to čine pružatelji.",
      ],
    },
    {
      id: "frist",
      heading: "2. Rok i objava",
      paragraphs: [
        "Nakon odlaska imate 14 dana za ostavljanje recenzije. Pružatelj u istom roku može ostaviti recenziju o Vama.",
        "Obje se recenzije objavljuju istodobno, čim obje postoje ili rok istekne. Tako nijedna strana ne utječe na drugu.",
        "Danu recenziju možete unutar roka povući. Nakon objave izmjena više nije moguća; možete zatražiti njezino brisanje.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Odgovor pružatelja",
      paragraphs: [
        "Pružatelj može javno odgovoriti na recenziju. Za odgovor vrijede ista pravila kao za samu recenziju.",
        "Odgovor ne mijenja recenziju i ne utječe na ukupnu ocjenu.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Kada uklanjamo recenziju",
      paragraphs: [
        "Recenziju ne uklanjamo zato što je negativna ili zato što je pružatelj njome nezadovoljan. Uklanjamo je kada:",
      ],
      list: [
        "povređuje [Pravila o primjerenom sadržaju](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "sadrži osobne podatke trećih osoba;",
        "očito se odnosi na drugi smještaj ili drugi boravak;",
        "u bitnome se odnosi na okolnosti na koje ni gost ni pružatelj nisu imali utjecaj (npr. vrijeme, općinsko gradilište, prometne prilike pri dolasku) — u tom slučaju uklanjamo samo zahvaćeni dio, ako se može odvojiti;",
        "očito služi iznudi, primjerice jer je povezana sa zahtjevom;",
        "pribavljena je poticajima ili dana u usklađenoj namjeri.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Poticaji nisu dopušteni",
      paragraphs: [
        "Pružatelji za recenziju ne smiju nuditi novac, popuste, nadogradnje, darove ni druge pogodnosti — ni za izostavljanje recenzije.",
        "Pružatelji goste smiju pozvati na recenziju bez utjecaja na ocjenu. Poziv koji na recenziju poziva samo u slučaju pozitivnog iskustva nije dopušten.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Kako prikazujemo recenzije",
      paragraphs: [
        "Ukupna ocjena je neponderirani prosjek svih objavljenih recenzija smještaja. Nijednu recenziju ne ponderiramo više zato što je bolja.",
        "Zadano razvrstavanje najprije prikazuje najnovije recenzije. Možete prijeći na druga razvrstavanja; koje je razvrstavanje aktivno prikazuje se.",
        "Navodimo koliko je recenzija u osnovi ukupne ocjene. Kod manje od tri recenzije ne prikazujemo ukupnu ocjenu, nego samo pojedinačne recenzije.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Pritužba protiv odluke",
      paragraphs: [
        "Ako uklonimo Vašu recenziju ili odbijemo uklanjanje recenzije, to obrazlažemo i upućujemo na pritužbeni put — vidi [Pritužbe i rješavanje sporova](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
