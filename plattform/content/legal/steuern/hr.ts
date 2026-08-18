import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Porezna politika",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ova stranica objašnjava koji porezi i davanja mogu nastati pri rezervaciji putem myBestDays, tko ih duguje i koje obveze prijave imamo mi kao operator platforme.",
    "Ovo nije porezno savjetovanje. Za porezno postupanje u pojedinačnom slučaju obratite se poreznom savjetniku.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Što se tiče gostiju",
      paragraphs: [
        "Prikazana ukupna cijena sadrži poreze koji se obračunavaju putem Platforme — osobito PDV na uslugu smještaja, ako ga pružatelj duguje.",
        "Mjesna davanja poput boravišne pristojbe, poreza na krevet ili turističke pristojbe ovisno o općini ili se obračunavaju putem Platforme ili se naplaćuju na licu mjesta. Koji slučaj vrijedi navodimo prije završetka rezervacije.",
        "Račun za uslugu smještaja izdaje pružatelj; on je poduzetnik koji pruža uslugu. Ako trebate račun s iskazanim PDV-om, zatražite ga od pružatelja.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Što se tiče pružatelja",
      paragraphs: [
        "Pružatelji su sami odgovorni za ispravno porezno postupanje sa svojim prihodima — porez na dohodak ili dobit, PDV i mjesna davanja.",
        "Podliježe li iznajmljivanje PDV-u i koja se stopa primjenjuje ravna se prema pravu države u kojoj se smještaj nalazi (mjesto obavljanja usluge kod nekretnina).",
        "Pružatelji davanja koja vrijede za njihov smještaj unose u objekt kako bi u oglasu bila ispravno prikazana.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Prijava poreznim tijelima (DAC7)",
      paragraphs: [
        "Kao operator digitalne platforme dužni smo prema Direktivi (EU) 2021/514 („DAC7“) i nacionalnim propisima za njezinu provedbu godišnje prijaviti nadležnom poreznom tijelu podatke o pružateljima o kojima se izvješćuje i o naknadama koje su ostvarili putem Platforme.",
        "Prijavljuju se osobito ime, adresa, porezni identifikacijski broj, datum rođenja ili matični broj, podaci o računu za isplatu, adresa smještaja i po tromjesečjima isplaćene naknade te zadržane naknade.",
        "Pružatelji dobivaju presliku prijavljenih podataka koji se na njih odnose.",
        "Ako pružatelj unatoč dvostrukom pozivu ne dostavi podatke potrebne za prijavu, dužni smo zadržati isplate i blokirati račun.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Odbici",
      paragraphs: [
        "Ako nas pravo neke države obvezuje da od isplate odbijemo i uplatimo poreze, to činimo i odbitak prikazujemo u obračunu.",
      ],
    },
  ],
};
