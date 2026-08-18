import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Uvjeti otkazivanja",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Svaki pružatelj za svoj smještaj bira uvjet otkazivanja. Koji vrijedi navedeno je u oglasu i u Vašoj potvrdi rezervacije. Ova stranica opisuje uvjete koje pružateljima nudimo na izbor.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Pregled uvjeta otkazivanja",
      paragraphs: [
        "Mjerodavan je uvijek uvjet naveden u oglasu. Rokovi se odnose na početak dana dolaska po lokalnom vremenu smještaja.",
      ],
      list: [
        "Fleksibilan — besplatno otkazivanje do 24 sata prije dolaska. Nakon toga naplaćuje se prva noć, ostale se noći vraćaju.",
        "Umjeren — besplatno otkazivanje do 5 dana prije dolaska. Nakon toga naplaćuje se 50 % cijene noćenja.",
        "Strog — besplatno otkazivanje do 14 dana prije dolaska, ako je rezervacija obavljena najmanje 14 dana prije dolaska. Nakon toga do 7 dana prije dolaska naplaćuje se 50 %, potom puna cijena.",
        "Nepovratan — bez besplatnog otkazivanja. Cijena je u pravilu niža; na izostanak povrata posebno upozoravamo prije rezervacije.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Što se vraća u svakom slučaju",
      paragraphs: [
        "Neovisno o odabranom uvjetu, kod svakog otkazivanja vraćamo:",
      ],
      list: [
        "boravišnu pristojbu i druga prolazna davanja, ako su bila obračunata putem Platforme i noćenje se ne ostvaruje;",
        "polog naplaćen putem Platforme u cijelosti;",
        "dodatne usluge koje nisu pružene.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Otkazivanje od strane pružatelja",
      paragraphs: [
        "Ako otkaže pružatelj, u cijelosti dobivate natrag iznos plaćen putem Platforme — neovisno o odabranom uvjetu otkazivanja.",
        "Dodatno Vas podupiremo u traženju usporedivog smještaja; vidi [Politiku prerezervacije i povrata](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Nema zakonskog prava na odustanak",
      paragraphs: [
        "Kod usluga smještaja rezerviranih za određeno razdoblje u pravilu ne postoji zakonsko pravo na odustanak prema članku 16. točki (l) Direktive 2011/83/EU. Ovdje opisani uvjeti otkazivanja stoga su ugovorna obveza, a ne provedba prava na odustanak.",
        "Prisilna zakonska prava, osobito prava iz jamstva kod nedostataka smještaja, nisu dirnuta.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Izmjena umjesto otkazivanja",
      paragraphs: [
        "Ako želite promijeniti razdoblje ili broj putnika, izmjenu podnesite putem svoje rezervacije. Pružatelj mora pristati; do tada izvorna rezervacija ostaje.",
        "Ako izmjena dovodi do više cijene, razlika dospijeva. Ako dovodi do niže cijene, razliku vraćamo, ako to važeći uvjet otkazivanja za dio koji otpada dopušta.",
      ],
    },
    {
      id: "wie",
      heading: "6. Kako otkazujete",
      paragraphs: [
        "Otkažite putem svog računa pod „Rezervacije“. Za rok je mjerodavan trenutak u kojem nam otkazivanje stigne.",
        "Dobivate potvrdu o otkazivanju s iznosom povrata. O isplati vidi [Uvjete plaćanja](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
