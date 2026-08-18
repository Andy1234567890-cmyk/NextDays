import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kratkoročni najam i obveze registracije",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "U mnogim je gradovima i regijama kratkoročno iznajmljivanje stambenog prostora vezano uz dozvolu, registraciju ili prijavu. Ova stranica objašnjava što to znači za pružatelje i za goste.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Pravni okvir",
      paragraphs: [
        "Uredba (EU) 2024/1028 o prikupljanju i razmjeni podataka u vezi s uslugama kratkoročnog najma smještaja stvara jedinstven okvir: gdje je država članica ili jedinica lokalne samouprave uvela postupak registracije, svaka jedinica dobiva registarski broj.",
        "Platforme moraju taj broj prikazivati, njegovu valjanost nasumično provjeravati i nadležnim tijelima u redovitim razmacima dostavljati podatke o djelatnosti.",
        "Uz to i dalje vrijede nacionalni i mjesni propisi — primjerice o prenamjeni stambenog prostora, o najvećem broju dana iznajmljivanja, o zaštiti od požara i o prijavi gostiju.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Što pružatelji moraju učiniti",
      paragraphs: [
        "Prije objave provjerite postoji li za Vaš smještaj obveza registracije, dozvole ili prijave i ispunite je.",
        "Unesite registarski broj uz objekt, ako postoji. Prikazujemo ga u oglasu.",
        "Poštujte najveći broj dana iznajmljivanja i ostala mjesna ograničenja. Njihov je nadzor Vaša zadaća, a ne naša.",
        "Oglas bez potrebnog registarskog broja ne smijemo trajno prikazivati. Ako nedostaje ili se pokaže nevaljanim, naknadno ga tražimo; izostane li podatak, oglas deaktiviramo.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Što to znači za goste",
      paragraphs: [
        "Postoji li za smještaj obveza registracije, registarski broj vidite u oglasu. On je naznaka da je iznajmljivanje prijavljeno nadležnom tijelu.",
        "Na odredištu može biti potrebna prijava (prijavnica, podaci iz osobne isprave, izjava o boravišnoj pristojbi). Pružatelj traži potrebne podatke; dostavite ih pravodobno.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Dostava podataka tijelima",
      paragraphs: [
        "Ako to predviđa Uredba (EU) 2024/1028 ili nacionalno pravo, nadležnim tijelima dostavljamo podatke o djelatnosti iznajmljivanja — osobito registarski broj, adresu jedinice, broj zauzetih noćenja i broj gostiju.",
        "Ta se dostava vrši radi ispunjenja pravne obveze prema članku 6. stavku 1. točki (c) Uredbe (EU) 2016/679. Pojedinosti su navedene u [Politici privatnosti](https://mybestdays.dk/rechtliches/datenschutz).",
        "Odvojeno od toga postoji porezna obveza prijave prema DAC7; vidi [Poreznu politiku](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Prijava povreda",
      paragraphs: [
        "Imate li naznake da se smještaj nudi bez potrebne dozvole ili registracije, prijavite nam to putem funkcije prijave uz oglas. Svaku prijavu istražujemo.",
      ],
    },
  ],
};
