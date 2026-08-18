import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Treći pružatelji i platne usluge",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "myBestDays za rad Platforme koristi usluge trećih strana. Ova ih stranica navodi i objašnjava koju ulogu imaju i čiji uvjeti u pojedinom slučaju vrijede.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Načelo",
      paragraphs: [
        "Ondje gdje treći pružatelj uslugu pruža neposredno Vama, uz naše vrijede njegovi uvjeti i njegova politika privatnosti. Na to upozoravamo na dotičnom mjestu.",
        "Ondje gdje treći pružatelj obrađuje isključivo po našem nalogu, mi ostajemo Vaš sugovornik. Koje izvršitelje obrade koristimo navedeno je u [Politici privatnosti](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Pružatelj platnih usluga",
      paragraphs: [
        "Plaćanja putem Platforme obrađuje Stripe. Stripe podatke o plaćanju prikuplja i obrađuje neposredno te je za njih samostalni voditelj obrade. Dodatno vrijedi [Politika privatnosti Stripea](https://stripe.com/privacy).",
        "Za isplatu domaćinima Stripe provodi zakonom propisanu provjeru identiteta.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Direktiva o platnim uslugama i pristup trećih strana",
      paragraphs: [
        "Direktiva (EU) 2015/2366 („PSD2“) za mnoga plaćanja zahtijeva pouzdanu autentifikaciju klijenta. Provodi je Vaša banka ili izdavatelj kartice; bez uspješne autentifikacije plaćanje može biti odbijeno.",
        "myBestDays nije usluga iniciranja plaćanja ni usluga informiranja o računu i ne pristupa Vašim bankovnim računima.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Karte, slike i ugrađeni sadržaj",
      paragraphs: [
        "Za prikaz karata i podatke o položaju ugrađujemo kartografske usluge trećih strana. Pri učitavanju takvog sadržaja podaci se mogu prenijeti dotičnom pružatelju; pojedinosti i upravljanje privolom navedeni su u [Politici kolačića](https://mybestdays.dk/rechtliches/cookies).",
        "Slike i opisi u oglasima potječu od pojedinog pružatelja, a ne od nas.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Povezane stranice",
      paragraphs: [
        "Platforma može sadržavati poveznice na stranice trećih strana. Na njihov sadržaj nemamo utjecaj i za njega ne preuzimamo odgovornost. Čim saznamo za povredu prava, poveznicu bez odgode uklanjamo.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Trgovine aplikacija",
      paragraphs: [
        "Ako aplikaciju myBestDays pribavite putem trgovine aplikacija, dodatno vrijede uvjeti dotičnog operatora trgovine. Operator trgovine nije strana ugovora između Vas i nas i ne duguje ni podršku ni jamstvo za aplikaciju.",
      ],
    },
  ],
};
