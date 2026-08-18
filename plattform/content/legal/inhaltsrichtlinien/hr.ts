import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pravila o primjerenom sadržaju",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ova pravila vrijede za sav sadržaj koji korisnici objavljuju na myBestDays: oglase, fotografije, recenzije, poruke, podatke profila i odgovore na recenzije.",
    "Sastavni su dio [Uvjeta korištenja](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Povreda može dovesti do uklanjanja sadržaja i do mjera protiv računa.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Što nije dopušteno",
      paragraphs: ["Na myBestDays nedopušten je osobito sljedeći sadržaj:"],
      list: [
        "protupravan sadržaj bilo koje vrste, osobito pozivi na kaznena djela, teroristički sadržaj i prikazi seksualnog zlostavljanja djece;",
        "sadržaj koji potiče na mržnju ili nasilje protiv osoba ili skupina zbog podrijetla, boje kože, vjere, svjetonazora, spola, rodnog identiteta, spolne orijentacije, invaliditeta ili dobi;",
        "uvrede, prijetnje, uznemiravanje i ciljano izlaganje pojedinih osoba;",
        "osobni podaci trećih osoba bez njihove privole, osobito imena, adrese, telefonski brojevi, podaci iz osobnih isprava ili podaci o plaćanju;",
        "obmanjujući podaci o smještaju, njegovom položaju, opremi, veličini ili raspoloživosti;",
        "tuđe fotografije, tekstovi ili žigovi bez potrebnih prava;",
        "oglašavanje, neželjene poruke i sadržaj koji vodi na druge putove rezervacije izvan Platforme;",
        "zlonamjerni softver, pokušaji krađe identiteta i poveznice na takav sadržaj;",
        "oglasi za nešto drugo osim usluge smještaja.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fotografije",
      paragraphs: [
        "Fotografije moraju prikazivati stvarno ponuđeni smještaj i biti snimljene u stanju koje odgovara današnjem.",
        "Fotografije ne smiju prikazivati prepoznatljive osobe bez njihove privole. Obrada je dopuštena ako ne iskrivljuje dojam o smještaju — posvjetljivanje da, retuširana susjedna građevina ne.",
        "Videonadzor u smještaju mora se objaviti u oglasu. U unutarnjim prostorima u kojima gosti opravdano očekuju privatnost — spavaće sobe, kupaonice — kamere nisu dopuštene, ni isključene.",
      ],
    },
    {
      id: "melden",
      heading: "3. Prijava sadržaja",
      paragraphs: [
        "Ako sadržaj smatrate protupravnim ili povredom ovih pravila, možete ga prijaviti putem funkcije prijave uz svaki oglas, svaku recenziju i svaku poruku.",
        "Postupak prijave prema članku 16. Uredbe (EU) 2022/2065 i obrada prijava opisani su u dijelu [Akt o digitalnim uslugama](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Kako provodimo pravila",
      paragraphs: [
        "Svaki prijavljeni sadržaj ispitujemo i biramo najblažu prikladnu mjeru: upozorenje, uklanjanje zahvaćenog dijela, uklanjanje cjelokupnog sadržaja, ograničenje vidljivosti, blokadu funkcije ili blokadu računa.",
        "Ponovljene ili teške povrede teže su. Kod očito protupravnog sadržaja ili opasnosti za osobe djelujemo odmah.",
        "Svaku mjeru obrazlažemo pogođenoj osobi i upućujemo na pritužbeni put. Pritužbu obrađuju ljudi.",
      ],
    },
  ],
};
